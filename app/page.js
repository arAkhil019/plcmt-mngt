// app/page.js
'use client';

import React, { useState, useCallback } from 'react';
import Script from 'next/script';
import { initialCompanies } from '../lib/data';
import { QrCodeIcon } from '../components/icons';
import Dashboard from '../components/dashboard';
import BarcodeScannerPage from '../components/scanner';
import AttendanceView from '../components/attendance-view';
import ColumnMappingModal from '../components/ColMapModal';
import AddActivityModal from '../components/AddActivityModal';
import EditActivityModal from '../components/EditActivityModal';

// UI Component Primitives
const Card = ({ children, className = '' }) => (<div className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm ${className}`}>{children}</div>);
const CardHeader = ({ children, className = '' }) => (<div className={`p-6 flex flex-col space-y-1.5 ${className}`}>{children}</div>);
const CardTitle = ({ children, className = '' }) => (<h3 className={`text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white ${className}`}>{children}</h3>);
const CardDescription = ({ children, className = '' }) => (<p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>{children}</p>);
const CardContent = ({ children, className = '' }) => (<div className={`p-6 pt-0 ${className}`}>{children}</div>);
const CardFooter = ({ children, className = '' }) => (<div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>);
const Button = ({ children, onClick, className = '', variant = 'default', as: Component = 'button', disabled, size, title }) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950";
    const variantClasses = {
        default: "bg-gray-900 text-white hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90",
        outline: "border border-gray-200 bg-transparent hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-50",
    };
    const sizeClasses = size === 'icon' ? 'h-10 w-10' : 'h-10 px-4 py-2';
    return (<Component onClick={onClick} disabled={disabled} title={title} className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses} ${className}`}>{children}</Component>);
};
const Table = ({ children, className = '' }) => (<div className="relative w-full overflow-auto"><table className={`w-full caption-bottom text-sm ${className}`}>{children}</table></div>);
const TableHeader = ({ children, className = '' }) => (<thead className={`[&_tr]:border-b ${className}`}>{children}</thead>);
const TableBody = ({ children, className = '' }) => (<tbody className={`[&_tr:last-child]:border-0 ${className}`}>{children}</tbody>);
const TableRow = ({ children, className = '' }) => (<tr className={`border-b transition-colors hover:bg-gray-100/50 data-[state=selected]:bg-gray-100 dark:hover:bg-gray-800/50 dark:data-[state=selected]:bg-gray-800 ${className}`}>{children}</tr>);
const TableHead = ({ children, className = '' }) => (<th className={`h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0 dark:text-gray-400 ${className}`}>{children}</th>);
const TableCell = ({ children, className = '' }) => (<td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>{children}</td>);
const Badge = ({ children, className = '', variant = 'default' }) => {
    const variantClasses = {
        default: "border-transparent bg-gray-900 text-gray-50 hover:bg-gray-900/80 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/80",
        success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
        secondary: "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-800/80",
    };
    return (<div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClasses[variant]} ${className}`}>{children}</div>);
};

const uiComponents = { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge };

export default function Home() {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [activities, setActivities] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [isScannerScriptLoaded, setIsScannerScriptLoaded] = useState(false);
    const [isXlsxScriptLoaded, setIsXlsxScriptLoaded] = useState(false);
    const [colMapModalData, setColMapModalData] = useState({ isOpen: false, activityId: null, file: null, headers: [] });
    const [isAddActivityModalOpen, setAddActivityModalOpen] = useState(false);
    const [editActivityModal, setEditActivityModal] = useState({ isOpen: false, activity: null });

    const handleSelectActivity = (activity) => {
        setSelectedActivity(activity);
        if (activity.status === 'Inactive') {
            setCurrentPage("view");
        } else {
            setCurrentPage("scanner");
        }
    };

    const handleEditActivity = (activity) => {
        setEditActivityModal({ isOpen: true, activity });
    };

    const handleUpdateActivity = (updatedActivity, uploadedFile) => {
        // First, validate that all required fields are filled
        if (!updatedActivity.companyName.trim() || !updatedActivity.date) {
            alert('Please enter a company name and select a date.');
            return;
        }
        
        if (uploadedFile) {
            // Process the uploaded file for student data update
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    const headers = json[0] || [];
                    
                    setColMapModalData({ 
                        isOpen: true, 
                        activityId: updatedActivity.id, 
                        file: uploadedFile, 
                        headers: headers,
                        updatedActivity: updatedActivity
                    });
                } catch (error) {
                    console.error("Error reading Excel file:", error);
                    alert("Failed to read the Excel file. Please ensure it's a valid Excel file (.xlsx or .xls).");
                }
            };
            reader.readAsArrayBuffer(uploadedFile);
        } else {
            // Update activity without student data change
            setActivities(prev => prev.map(a => a.id === updatedActivity.id ? updatedActivity : a));
        }
        setEditActivityModal({ isOpen: false, activity: null });
    };

    const handleBackToDashboard = () => {
        setCurrentPage("dashboard");
        setSelectedActivity(null);
    };

    const handleMarkAttendance = useCallback((activityId, studentId) => {
        const activity = activities.find(a => a.id === activityId);
        if (!activity?.students.some(s => s.id === studentId)) return;
        setAttendance(prev => {
            const activityAttendance = prev[activityId] || [];
            if (activityAttendance.some(att => att.studentId === studentId)) return prev;
            return { ...prev, [activityId]: [...activityAttendance, { studentId, timestamp: new Date().toISOString() }] };
        });
    }, [activities]);

    const handleAddActivity = (newActivity, uploadedFile) => {
        // First, validate that all required fields are filled
        if (!newActivity.companyName.trim() || !newActivity.date) {
            alert('Please enter a company name and select a date.');
            return;
        }
        
        if (uploadedFile) {
            // Process the uploaded file for student data
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    const headers = json[0] || [];
                    
                    setColMapModalData({ 
                        isOpen: true, 
                        activityId: newActivity.id, 
                        file: uploadedFile, 
                        headers: headers,
                        newActivity: newActivity
                    });
                } catch (error) {
                    console.error("Error reading Excel file:", error);
                    alert("Failed to read the Excel file. Please ensure it's a valid Excel file (.xlsx or .xls).");
                }
            };
            reader.readAsArrayBuffer(uploadedFile);
        } else {
            // Add activity without student data
            setActivities(prev => [...prev, newActivity].sort((a, b) => new Date(a.date) - new Date(b.date)));
        }
    };

    const handleFileUpload = (activityId, file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const headers = json[0] || [];
                setColMapModalData({ isOpen: true, activityId, file, headers });
            } catch (error) {
                alert("Failed to read the Excel file.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleColMapModalClose = () => {
        setColMapModalData({ isOpen: false, activityId: null, file: null, headers: [], newActivity: null, updatedActivity: null });
    };

    const handleColumnMappingSubmit = (mapping) => {
        const { activityId, file, newActivity, updatedActivity } = colMapModalData;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = window.XLSX.utils.sheet_to_json(worksheet);
                const newStudents = json.map((row, index) => ({
                    id: String(row[mapping.id] || `MISSING_ID_${index}`),
                    name: String(row[mapping.name] || 'N/A'),
                    roll: String(row[mapping.roll] || ''),
                    department: String(row[mapping.department] || ''),
                }));

                if (newActivity) {
                    // This is a new activity being created with file upload
                    const activityWithStudents = { ...newActivity, students: newStudents };
                    setActivities(prev => [...prev, activityWithStudents].sort((a, b) => new Date(a.date) - new Date(b.date)));
                } else if (updatedActivity) {
                    // This is updating an existing activity via edit modal
                    const activityWithUpdatedStudents = { ...updatedActivity, students: newStudents };
                    setActivities(prev => prev.map(a => a.id === activityId ? activityWithUpdatedStudents : a));
                } else {
                    // This is updating an existing activity (legacy flow)
                    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, students: newStudents } : a));
                }
                
                alert(`Successfully uploaded ${newStudents.length} students.`);
                handleColMapModalClose();
            } catch (error) {
                alert("Failed to parse the Excel file with mapping.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const DashboardWithUI = (props) => <Dashboard {...props} {...uiComponents} />;
    const BarcodeScannerPageWithUI = (props) => <BarcodeScannerPage {...props} {...uiComponents} />;
    const AttendanceViewWithUI = (props) => <AttendanceView {...props} {...uiComponents} />;
    const ColumnMappingModalWithUI = (props) => <ColumnMappingModal {...props} {...uiComponents} />;
    const AddActivityModalWithUI = (props) => <AddActivityModal {...props} {...uiComponents} />;
    const EditActivityModalWithUI = (props) => <EditActivityModal {...props} {...uiComponents} />;

    return (
        <>
            <Script src="https://unpkg.com/html5-qrcode" strategy="afterInteractive" onLoad={() => setIsScannerScriptLoaded(true)} />
            <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="afterInteractive" onLoad={() => setIsXlsxScriptLoaded(true)} />

            <ColumnMappingModalWithUI isOpen={colMapModalData.isOpen} onClose={handleColMapModalClose} headers={colMapModalData.headers} onSubmit={handleColumnMappingSubmit} />
            <AddActivityModalWithUI 
                isOpen={isAddActivityModalOpen} 
                onClose={() => setAddActivityModalOpen(false)} 
                onSubmit={handleAddActivity}
                onFileUpload={handleFileUpload}
                isXlsxScriptLoaded={isXlsxScriptLoaded}
            />
            <EditActivityModalWithUI 
                isOpen={editActivityModal.isOpen} 
                onClose={() => setEditActivityModal({ isOpen: false, activity: null })} 
                onSubmit={handleUpdateActivity}
                onFileUpload={handleFileUpload}
                activity={editActivityModal.activity}
            />

            <div className="bg-gray-50 dark:bg-black min-h-screen text-gray-800 dark:text-gray-200 font-sans">
                <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                    <nav className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <QrCodeIcon className="h-6 w-6 text-gray-900 dark:text-white" />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Placement Portal</h1>
                        </div>
                    </nav>
                </header>

                <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                    {currentPage === 'dashboard' && (
                        <DashboardWithUI
                            activities={activities}
                            attendance={attendance}
                            onSelectActivity={handleSelectActivity}
                            onAddActivityClick={() => setAddActivityModalOpen(true)}
                            onEditActivity={handleEditActivity}
                        />
                    )}
                    {currentPage === 'scanner' && selectedActivity && (
                        <BarcodeScannerPageWithUI
                            company={selectedActivity}
                            onBack={handleBackToDashboard}
                            attendance={attendance}
                            onMarkAttendance={handleMarkAttendance}
                            isScriptLoaded={isScannerScriptLoaded}
                        />
                    )}
                    {currentPage === "view" && selectedActivity && (
                        <AttendanceViewWithUI
                            company={selectedActivity}
                            onBack={handleBackToDashboard}
                            attendance={attendance}
                        />
                    )}
                </main>
            </div>
        </>
    );
}
