// app/page.js
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Script from 'next/script';
import { initialCompanies } from '../lib/data';
import { QrCodeIcon, UsersIcon, ActivityIcon, LogOutIcon } from '../components/icons';
import { useAuth } from '../contexts/AuthContext';
import { logActivity, ACTIVITY_TYPES } from '../utils/activityLogger';
import { activitiesService } from '../lib/activitiesService';
import { activityLogsService, ACTIVITY_LOG_TYPES } from '../lib/activityLogsService';
import { activityParticipationService } from '../lib/activityParticipationService';
import Dashboard from '../components/dashboard';
import BarcodeScannerPage from '../components/scanner';
import AttendanceView from '../components/attendance-view';
import ColumnMappingModal from '../components/ColMapModal';
import AddActivityModal from '../components/AddActivityModal';
import EditActivityModal from '../components/EditActivityModal';
import LoginForm from '../components/LoginForm';
import UserManagement from '../components/UserManagement';
import StudentManagement from '../components/StudentManagement';
import ActivityLogs from '../components/ActivityLogs';

// UI Component Primitives
const Card = ({ children, className = '' }) => (<div className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm ${className}`}>{children}</div>);
const CardHeader = ({ children, className = '' }) => (<div className={`p-6 flex flex-col space-y-1.5 ${className}`}>{children}</div>);
const CardTitle = ({ children, className = '' }) => (<h3 className={`text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white ${className}`}>{children}</h3>);
const CardDescription = ({ children, className = '' }) => (<p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>{children}</p>);
const CardContent = ({ children, className = '' }) => (<div className={`p-6 pt-0 ${className}`}>{children}</div>);
const CardFooter = ({ children, className = '' }) => (<div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>);
const Button = ({ children, onClick, className = '', variant = 'default', as: Component = 'button', disabled, size, title, type }) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950";
    const variantClasses = {
        default: "bg-gray-900 text-white hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90",
        outline: "border border-gray-200 bg-transparent hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-50",
    };
    const sizeClasses = {
        'icon': 'h-10 w-10',
        'sm': 'h-8 px-3 py-1',
        'default': 'h-10 px-4 py-2'
    };
    const finalSizeClasses = sizeClasses[size] || sizeClasses['default'];
    return (<Component onClick={onClick} disabled={disabled} title={title} type={type} className={`${baseClasses} ${variantClasses[variant]} ${finalSizeClasses} ${className}`}>{children}</Component>);
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
    const { user, userProfile, logout, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [activities, setActivities] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [isScannerScriptLoaded, setIsScannerScriptLoaded] = useState(false);
    const [isXlsxScriptLoaded, setIsXlsxScriptLoaded] = useState(false);
    const [colMapModalData, setColMapModalData] = useState({ isOpen: false, activityId: null, file: null, headers: [] });
    const [isAddActivityModalOpen, setAddActivityModalOpen] = useState(false);
    const [editActivityModal, setEditActivityModal] = useState({ isOpen: false, activity: null });

    // Reset to dashboard when user logs in
    useEffect(() => {
        if (user && userProfile && !loading) {
            setCurrentPage('dashboard');
        }
    }, [user, userProfile, loading]);

    // Utility function to normalize activity structure from different sources
    const normalizeActivity = (activity, source = 'old') => {
        if (source === 'new') {
            // Activity from activityParticipationService.getAllActivitiesWithParticipants()
            return {
                id: activity.id,
                activityId: activity.activityId,
                companyName: activity.name,
                name: activity.name,
                activityType: 'Pre-placement Talk', // Default for new system
                interviewRound: 1,
                date: activity.date,
                time: '',
                mode: 'Offline',
                location: '',
                status: activity.isActive ? 'Active' : 'Inactive',
                eligibleDepartments: [],
                spocName: '',
                spocContact: '',
                allowedUsers: [],
                students: activity.participants?.map(p => ({
                    id: p.admissionNumber,
                    name: p.name,
                    rollNumber: p.rollNumber,
                    admissionNumber: p.admissionNumber,
                    department: p.department,
                    attendance: p.attendance || false
                })) || [],
                totalRegistered: activity.totalParticipants || 0,
                totalPresent: activity.participants?.filter(p => p.attendance).length || 0,
                createdBy: activity.createdBy,
                createdAt: activity.createdAt,
                lastUpdated: activity.lastUpdated,
                participants: activity.participants || []
            };
        } else {
            // Activity from activitiesService.getAllActivities() (old system)
            return {
                ...activity,
                participants: [], // Old system doesn't have participants in this format
                totalRegistered: activity.students?.length || 0,
                totalPresent: activity.students?.filter(s => s.attendance).length || 0
            };
        }
    };

    // Load activities from Firebase when user is authenticated
    useEffect(() => {
        const loadActivities = async () => {
            if (user && userProfile && !loading) {
                try {
                    // Load activities from both the new and old systems to avoid missing any
                    const [oldActivities, newActivities] = await Promise.all([
                        activitiesService.getAllActivities().catch(err => {
                            console.error('Error loading old activities:', err);
                            return [];
                        }),
                        activityParticipationService.getAllActivitiesWithParticipants().catch(err => {
                            console.error('Error loading new activities:', err);
                            return [];
                        })
                    ]);

                    // Normalize activities from both sources
                    const normalizedOldActivities = oldActivities.map(activity => normalizeActivity(activity, 'old'));
                    const normalizedNewActivities = newActivities.map(activity => normalizeActivity(activity, 'new'));

                    // Merge and deduplicate activities based on ID
                    const allActivities = [...normalizedOldActivities, ...normalizedNewActivities];
                    const uniqueActivities = allActivities.reduce((acc, current) => {
                        // Use custom activityId if available, otherwise use document id
                        const key = current.activityId || current.id;
                        const existing = acc.find(activity => 
                            (activity.activityId || activity.id) === key
                        );
                        
                        if (!existing) {
                            acc.push(current);
                        } else {
                            // If duplicate found, prefer the one with participants (new system)
                            if (current.participants && current.participants.length > 0) {
                                const index = acc.findIndex(activity => 
                                    (activity.activityId || activity.id) === key
                                );
                                acc[index] = current;
                            }
                        }
                        return acc;
                    }, []);

                    setActivities(uniqueActivities);
                } catch (error) {
                    console.error('Error loading activities:', error);
                    // Keep empty activities array on error
                    setActivities([]);
                }
            }
        };

        loadActivities();
    }, [user, userProfile, loading]);

    // All hooks must be called before any return or conditional logic
    const hasPermission = (requiredRole) => {
        if (userProfile?.role === 'admin') return true;
        if (requiredRole === 'placement_coordinator') {
            return userProfile?.role === 'placement_coordinator';
        }
        return true;
    };

    const canMarkAttendance = (activity) => {
        if (userProfile?.role === 'admin') return true;
        if (activity.createdBy === userProfile?.id) return true;
        return activity.allowedUsers?.some(u => u.id === userProfile?.id);
    };

    const handleSelectActivity = (activity) => {
        // Check permissions before allowing access
        if (!canMarkAttendance(activity) && activity.status !== 'Inactive') {
            alert('You do not have permission to mark attendance for this activity.');
            return;
        }
        setSelectedActivity(activity);
        if (activity.status === 'Inactive') {
            setCurrentPage("view");
        } else {
            setCurrentPage("scanner");
        }
    };

    const handleEditActivity = (activity) => {
        // Only admins and placement coordinators can edit, and only their own activities
        if (userProfile?.role !== 'admin' && 
            (userProfile?.role !== 'placement_coordinator' || activity.createdBy !== userProfile?.id)) {
            alert('You do not have permission to edit this activity.');
            return;
        }
        setEditActivityModal({ isOpen: true, activity });
    };

    const handleUpdateActivity = async (updatedActivity, uploadedFile) => {
        // First, validate that all required fields are filled
        if (!updatedActivity.companyName.trim() || !updatedActivity.date) {
            alert('Please enter a company name and select a date.');
            return;
        }

        try {
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
                const updated = await activitiesService.updateActivity(
                    updatedActivity.id,
                    updatedActivity,
                    { id: userProfile?.id, name: userProfile?.name }
                );
                setActivities(prev => prev.map(a => a.id === updatedActivity.id ? updated : a));
                
                // Log the activity update
                await activityLogsService.logActivity(
                    userProfile?.id,
                    userProfile?.name,
                    userProfile?.email,
                    ACTIVITY_LOG_TYPES.UPDATE_ACTIVITY,
                    `Updated activity: ${updated.companyName} - ${updated.activityType}`,
                    {
                        activityId: updated.id,
                        companyName: updated.companyName,
                        activityType: updated.activityType
                    }
                );
            }
            setEditActivityModal({ isOpen: false, activity: null });
        } catch (error) {
            console.error('Error updating activity:', error);
            alert('Failed to update activity. Please try again.');
        }
    };

    const handleDeleteActivity = async (activity) => {
        if (!userProfile) return;

        try {
            // Delete the activity using activityParticipationService
            const result = await activityParticipationService.deleteActivity(
                activity.id, 
                activity.id, 
                userProfile
            );
            
            // Remove from local state
            setActivities(prev => prev.filter(a => a.id !== activity.id));
            
            // Log the activity deletion
            await activityLogsService.logActivity(
                userProfile?.id,
                userProfile?.name,
                userProfile?.email,
                ACTIVITY_LOG_TYPES.DELETE_ACTIVITY,
                `Deleted activity: ${activity.companyName || activity.name} - ${activity.activityType || 'Activity'}`,
                {
                    activityId: activity.id,
                    companyName: activity.companyName || activity.name,
                    activityType: activity.activityType || 'Activity',
                    deletedParticipationRecords: result.deletedParticipationRecords
                }
            );
            
            alert(`Activity "${activity.companyName || activity.name}" deleted successfully. ${result.deletedParticipationRecords} participation records were also removed.`);
        } catch (error) {
            console.error('Error deleting activity:', error);
            alert(`Failed to delete activity: ${error.message}`);
        }
    };

    const handleBackToDashboard = () => {
        setCurrentPage("dashboard");
        setSelectedActivity(null);
    };

    const handleMarkAttendance = useCallback(async (activityId, studentId) => {
        const activity = activities.find(a => a.id === activityId);
        if (!activity?.students.some(s => s.id === studentId)) return;
        
        // Check if user has permission to mark attendance
        if (!canMarkAttendance(activity)) {
            alert('You do not have permission to mark attendance for this activity.');
            return;
        }

        // Check if student is already marked present
        const student = activity.students.find(s => s.id === studentId);
        if (student?.attendance) {
            alert('Student attendance is already marked.');
            return;
        }

        try {
            // Update attendance in Firebase
            const updatedActivity = await activitiesService.updateStudentAttendance(
                activityId,
                studentId,
                true,
                { id: userProfile?.id, name: userProfile?.name }
            );

            // Update local state
            setActivities(prev => prev.map(a => a.id === activityId ? updatedActivity : a));

            // Log the attendance marking
            await activityLogsService.logActivity(
                userProfile?.id,
                userProfile?.name,
                userProfile?.email,
                ACTIVITY_LOG_TYPES.MARK_ATTENDANCE,
                `Marked attendance for ${student?.name || studentId} in ${activity.companyName} - ${activity.activityType}`,
                {
                    activityId: activityId,
                    studentId: studentId,
                    studentName: student?.name,
                    companyName: activity.companyName,
                    activityType: activity.activityType
                }
            );

            // Also update the legacy attendance state for backward compatibility
            setAttendance(prev => {
                const activityAttendance = prev[activityId] || [];
                if (activityAttendance.some(att => att.studentId === studentId)) return prev;
                return { 
                    ...prev, 
                    [activityId]: [...activityAttendance, { 
                        studentId, 
                        timestamp: new Date().toISOString(),
                        markedBy: userProfile?.id,
                        markedByName: userProfile?.name
                    }] 
                };
            });
        } catch (error) {
            console.error('Error marking attendance:', error);
            alert('Failed to mark attendance. Please try again.');
        }
    }, [activities, userProfile, canMarkAttendance]);

    const handleAddActivity = async (newActivity, uploadedFile) => {
        // Only admins and placement coordinators can create activities
        if (!hasPermission('placement_coordinator')) {
            alert('You do not have permission to create activities.');
            return;
        }
        // First, validate that all required fields are filled
        if (!newActivity.companyName.trim() || !newActivity.date) {
            alert('Please enter a company name and select a date.');
            return;
        }

        try {
            if (uploadedFile) {
                // Process the uploaded file for student data using the new unified system
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = window.XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                        const headers = json[0] || [];
                        
                        // Clean the activity data before processing
                        const cleanActivityData = {
                            companyName: newActivity.companyName.trim(),
                            activityType: newActivity.activityType,
                            interviewRound: newActivity.interviewRound || 1,
                            date: newActivity.date,
                            time: newActivity.time || '',
                            mode: newActivity.mode,
                            location: newActivity.location.trim(),
                            eligibleDepartments: newActivity.eligibleDepartments || [],
                            spocName: newActivity.spocName.trim(),
                            spocContact: newActivity.spocContact.trim(),
                            status: newActivity.status || 'Active',
                            allowedUsers: newActivity.allowedUsers || []
                        };
                        
                        // Generate a temporary activity ID for the column mapping process
                        const tempActivityId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        setColMapModalData({ 
                            isOpen: true, 
                            activityId: tempActivityId, 
                            file: uploadedFile, 
                            headers: headers,
                            newActivity: cleanActivityData
                        });
                    } catch (error) {
                        console.error("Error reading Excel file or creating activity:", error);
                        alert("Failed to process the Excel file or create activity. Please check the file format and try again.");
                    }
                };
                reader.readAsArrayBuffer(uploadedFile);
            } else {
                // For activities without files, create directly using the old system
                const cleanActivityData = {
                    companyName: newActivity.companyName.trim(),
                    activityType: newActivity.activityType,
                    interviewRound: newActivity.interviewRound || 1,
                    date: newActivity.date,
                    time: newActivity.time || '',
                    mode: newActivity.mode,
                    location: newActivity.location.trim(),
                    eligibleDepartments: newActivity.eligibleDepartments || [],
                    spocName: newActivity.spocName.trim(),
                    spocContact: newActivity.spocContact.trim(),
                    status: newActivity.status || 'Active',
                    allowedUsers: newActivity.allowedUsers || []
                };
                
                // Create activity without student data using the old system
                const createdActivity = await activitiesService.createActivity(
                    cleanActivityData,
                    { id: userProfile?.id, name: userProfile?.name }
                );
                
                setActivities(prev => [...prev, createdActivity].sort((a, b) => new Date(a.date) - new Date(b.date)));
                
                // Log the activity creation
                await activityLogsService.logActivity(
                    userProfile?.id,
                    userProfile?.name,
                    userProfile?.email,
                    ACTIVITY_LOG_TYPES.CREATE_ACTIVITY,
                    `Created activity: ${createdActivity.companyName} - ${createdActivity.activityType}`,
                    { 
                        activityId: createdActivity.id,
                        companyName: createdActivity.companyName,
                        activityType: createdActivity.activityType 
                    }
                );
            }
        } catch (error) {
            console.error('Error creating activity:', error);
            alert('Failed to create activity. Please try again.');
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

    const handleColumnMappingSubmit = async (mapping) => {
        const { activityId, file, newActivity, updatedActivity } = colMapModalData;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = window.XLSX.utils.sheet_to_json(worksheet);
                
                // Extract participants with name and roll number
                const participants = json.map((row, index) => {
                    // Skip empty rows
                    if (!row || Object.keys(row).length === 0) return null;
                    
                    const studentName = String(row[mapping.name] || '').trim();
                    const rollNumber = String(row[mapping.rollNumber] || '').trim();
                    
                    // Skip rows with empty essential data
                    if (!studentName || !rollNumber) {
                        return null;
                    }
                    
                    return {
                        name: studentName,
                        rollNumber: rollNumber,
                        sheetName: sheetName
                    };
                }).filter(participant => participant !== null); // Remove null entries

                if (participants.length === 0) {
                    alert("No valid participants found in the Excel file. Please ensure you have Name and Roll Number columns with data.");
                    return;
                }

                // Process participants using activity participation service to find admission numbers
                const activityDetails = {
                    id: newActivity ? `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : activityId,
                    name: (newActivity?.companyName || updatedActivity?.companyName || `Activity_${activityId}`),
                    date: (newActivity?.date || updatedActivity?.date || new Date().toISOString().split('T')[0])
                };

                // Show processing message
                const processingMessage = `Processing ${participants.length} participants...\nThis may take a few minutes for large files.\nPlease do not close this window.`;
                
                // Create a simple progress dialog (you could enhance this with a proper modal)
                const progressAlert = () => {
                    console.log(processingMessage);
                    // You could replace this with a proper loading modal in the future
                };
                
                progressAlert();

                const processingResults = await activityParticipationService.processActivityParticipation(
                    participants,
                    activityDetails,
                    userProfile
                );

                if (processingResults.summary.successful > 0) {
                    // Transform successful results to include all required participant details
                    const participantsList = processingResults.successful.map((result) => ({
                        name: result.providedName,
                        rollNumber: result.rollNumber,
                        admissionNumber: result.admissionNumber,
                        department: result.department,
                        departmentCode: result.departmentCode,
                        year: result.year || result.joiningYear || new Date().getFullYear(),
                        addedAt: new Date().toISOString(),
                        addedBy: userProfile.name,
                        addedById: userProfile.id,
                        attendance: false // Initialize attendance as false
                    }));

                    // Save activity with participant details using activity participation service
                    const savedActivity = await activityParticipationService.saveActivityWithParticipants(
                        activityDetails,
                        participantsList,
                        userProfile
                    );

                    // Update activities list
                    if (newActivity) {
                        // Normalize the saved activity from the new system
                        const normalizedActivity = normalizeActivity(savedActivity, 'new');
                        
                        // Add the new activity to the list
                        setActivities(prev => [...prev, normalizedActivity].sort((a, b) => new Date(a.date) - new Date(b.date)));
                        
                        // Log the activity creation
                        await activityLogsService.logActivity(
                            userProfile?.id,
                            userProfile?.name,
                            userProfile?.email,
                            ACTIVITY_LOG_TYPES.CREATE_ACTIVITY,
                            `Created activity: ${savedActivity.name} with ${participantsList.length} participants`,
                            { 
                                activityId: savedActivity.id,
                                companyName: savedActivity.name,
                                participantsCount: participantsList.length
                            }
                        );
                    } else {
                        // Normalize the updated activity
                        const normalizedActivity = normalizeActivity(savedActivity, 'new');
                        // Update existing activity
                        setActivities(prev => prev.map(a => a.id === activityId ? normalizedActivity : a));
                    }

                    // Create detailed success/failure message
                    let message = `Processing Complete!\n\n`;
                    message += `✅ Successfully processed: ${processingResults.summary.successful} participants\n`;
                    
                    if (processingResults.summary.failed > 0) {
                        message += `❌ Failed to process: ${processingResults.summary.failed} participants\n\n`;
                        message += `Failed participants:\n`;
                        
                        // Group failures by error type
                        const failuresByError = processingResults.failed.reduce((acc, failure) => {
                            const error = failure.error || 'Unknown error';
                            if (!acc[error]) acc[error] = [];
                            acc[error].push(`${failure.name} (${failure.rollNumber})`);
                            return acc;
                        }, {});
                        
                        Object.entries(failuresByError).forEach(([error, students]) => {
                            message += `\n${error}:\n`;
                            students.slice(0, 10).forEach(student => {
                                message += `  • ${student}\n`;
                            });
                            if (students.length > 10) {
                                message += `  ... and ${students.length - 10} more\n`;
                            }
                        });
                        
                        message += `\nPlease check the console for detailed error logs.`;
                    }
                    
                    alert(message);
                } else {
                    // No successful participants
                    let message = `❌ No participants could be processed successfully.\n\n`;
                    message += `Total attempted: ${processingResults.summary.totalProcessed}\n`;
                    message += `Failed: ${processingResults.summary.failed}\n\n`;
                    
                    if (processingResults.failed.length > 0) {
                        message += `Common issues:\n`;
                        
                        // Group failures by error type
                        const failuresByError = processingResults.failed.reduce((acc, failure) => {
                            const error = failure.error || 'Unknown error';
                            acc[error] = (acc[error] || 0) + 1;
                            return acc;
                        }, {});
                        
                        Object.entries(failuresByError).forEach(([error, count]) => {
                            message += `• ${error}: ${count} students\n`;
                        });
                        
                        message += `\nPlease check:\n`;
                        message += `• Roll numbers are in correct format (1601YYXXXNNN)\n`;
                        message += `• Students exist in the database\n`;
                        message += `• Names and roll numbers are not empty\n`;
                        message += `\nCheck the console for detailed error logs.`;
                    }
                    
                    alert(message);
                }

                handleColMapModalClose();
            } catch (error) {
                console.error('Error processing participants:', error);
                alert("Failed to process the Excel file or update the database.");
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
    const UserManagementWithUI = (props) => <UserManagement {...props} {...uiComponents} />;
    const StudentManagementWithUI = (props) => <StudentManagement {...props} uiComponents={uiComponents} />;
    const ActivityLogsWithUI = (props) => <ActivityLogs {...props} {...uiComponents} />;

    const handleLogout = async () => {
        try {
            await logActivity(
                userProfile?.id,
                userProfile?.name,
                userProfile?.email,
                ACTIVITY_TYPES.LOGOUT,
                'User logged out'
            );
            // Reset page state before logout
            setCurrentPage('dashboard');
            setSelectedActivity(null);
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Show loading screen while authentication is loading
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
                <div className="text-center">
                    <QrCodeIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Show login form if user is not authenticated
    if (!user || !userProfile) {
        return <LoginForm {...uiComponents} />;
    }

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
                onDelete={handleDeleteActivity}
                onFileUpload={handleFileUpload}
                activity={editActivityModal.activity}
            />
            <div className="bg-gray-50 dark:bg-black min-h-screen text-gray-800 dark:text-gray-200 font-sans">
                <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
                    <nav className="container mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <img 
                                src="/graduation-hat.svg" 
                                alt="Placerly Logo" 
                                className="h-6 w-6 object-contain"
                            />
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Placerly</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant={currentPage === 'dashboard' ? 'default' : 'outline'}
                                    onClick={() => {
                                        setCurrentPage('dashboard');
                                        setSelectedActivity(null);
                                    }}
                                    size="sm"
                                >
                                    Dashboard
                                </Button>
                                {userProfile?.role === 'admin' && (
                                    <>
                                        <Button 
                                            variant={currentPage === 'users' ? 'default' : 'outline'}
                                            onClick={() => {
                                                setCurrentPage('users');
                                                setSelectedActivity(null);
                                            }}
                                            size="sm"
                                        >
                                            <UsersIcon className="h-4 w-4 mr-2" />
                                            Users
                                        </Button>
                                        <Button 
                                            variant={currentPage === 'students' ? 'default' : 'outline'}
                                            onClick={() => {
                                                setCurrentPage('students');
                                                setSelectedActivity(null);
                                            }}
                                            size="sm"
                                        >
                                            🎓
                                            Students
                                        </Button>
                                        <Button 
                                            variant={currentPage === 'logs' ? 'default' : 'outline'}
                                            onClick={() => {
                                                setCurrentPage('logs');
                                                setSelectedActivity(null);
                                            }}
                                            size="sm"
                                        >
                                            <ActivityIcon className="h-4 w-4 mr-2" />
                                            Logs
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2 border-l pl-4">
                                <div className="text-sm">
                                    <div className="font-medium">{userProfile?.name}</div>
                                    <div className="text-gray-500 capitalize">{userProfile?.role?.replace('_', ' ')}</div>
                                </div>
                                <Button variant="outline" size="sm" onClick={handleLogout}>
                                    <LogOutIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </nav>
                </header>
                <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                    {currentPage === 'dashboard' && (
                        <DashboardWithUI
                            activities={activities}
                            attendance={attendance}
                            onSelectActivity={handleSelectActivity}
                            onAddActivityClick={() => hasPermission('placement_coordinator') ? setAddActivityModalOpen(true) : alert('Access denied')}
                            onEditActivity={handleEditActivity}
                            userRole={userProfile?.role}
                            userId={userProfile?.id}
                        />
                    )}
                    {currentPage === 'users' && userProfile?.role === 'admin' && (
                        <UserManagementWithUI />
                    )}
                    {currentPage === 'students' && userProfile?.role === 'admin' && (
                        <StudentManagementWithUI />
                    )}
                    {currentPage === 'logs' && userProfile?.role === 'admin' && (
                        <ActivityLogsWithUI />
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
