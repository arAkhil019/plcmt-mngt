// components/AddActivityModal.jsx
import React, { useState, useRef } from 'react';
import { XIcon, UploadIcon } from './icons';

export default function AddActivityModal({
    isOpen,
    onClose,
    onSubmit,
    onFileUpload,
    companies,
    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
    Button,
    Badge
}) {
    const [activity, setActivity] = useState({
        companyName: '',
        activityType: 'Pre-placement Talk',
        interviewRound: 1,
        date: '',
        mode: 'Offline',
        location: '',
        eligibleDepartments: [],
        spocName: '',
        spocContact: '',
        status: 'Active'
    });
    const [currentDept, setCurrentDept] = useState({ name: '', year: '4th Year' });
    const [uploadedFile, setUploadedFile] = useState(null);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setActivity(prev => ({ ...prev, [name]: value }));
    };

    const handleAddDepartment = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentDept.name.trim() === '') return;
        setActivity(prev => ({
            ...prev,
            eligibleDepartments: [...prev.eligibleDepartments, currentDept]
        }));
        setCurrentDept({ name: '', year: '4th Year' });
    };

    const handleRemoveDepartment = (index) => {
        setActivity(prev => ({
            ...prev,
            eligibleDepartments: prev.eligibleDepartments.filter((_, i) => i !== index)
        }));
    };

    const handleFileUpload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
        }
        e.target.value = null;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const newActivity = {
            ...activity,
            id: Date.now(),
            students: []
        };

        onSubmit(newActivity, uploadedFile);
        
        // Reset form
        setActivity({
            companyName: '',
            activityType: 'Pre-placement Talk',
            interviewRound: 1,
            date: '',
            mode: 'Offline',
            location: '',
            eligibleDepartments: [],
            spocName: '',
            spocContact: '',
            status: 'Active'
        });
        setUploadedFile(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
            <Card className="w-full max-w-2xl relative">
                <Button variant="outline" size="icon" className="absolute top-4 right-4 h-8 w-8" onClick={onClose}>
                    <XIcon className="h-4 w-4" />
                </Button>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>Add New Placement Activity</CardTitle>
                        <CardDescription>Fill in the details for the new activity.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-[70vh] overflow-y-auto grid gap-4 pr-3">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                        />

                        {/* Row 1: Company & Activity Type */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Company Name</label>
                                <input 
                                    type="text" 
                                    name="companyName" 
                                    value={activity.companyName} 
                                    onChange={handleChange} 
                                    placeholder="Enter company name"
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Activity Type</label>
                                <select name="activityType" value={activity.activityType} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3">
                                    <option>Pre-placement Talk</option>
                                    <option>Online Assessment</option>
                                    <option>Interview Round</option>
                                </select>
                            </div>
                        </div>

                        {/* File Upload Section */}
                        <div>
                            <label className="text-sm font-medium">Student List (Optional)</label>
                            <div className="mt-1 flex gap-2">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={handleFileUpload}
                                    className="flex-1"
                                >
                                    <UploadIcon className="h-4 w-4 mr-2" />
                                    {uploadedFile ? 'Change File' : 'Upload Excel'}
                                </Button>
                                {uploadedFile && (
                                    <div className="flex-1 flex items-center text-sm text-green-600 dark:text-green-400">
                                        File: {uploadedFile.name}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Upload an Excel file with student data (optional)</p>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="text-sm font-medium">Status</label>
                            <select name="status" value={activity.status} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3">
                                <option>Active</option>
                                <option>In Progress</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        {/* Conditional: Interview Round */}
                        {activity.activityType === 'Interview Round' && (
                            <div>
                                <label className="text-sm font-medium">Round Number</label>
                                <input type="number" name="interviewRound" value={activity.interviewRound} onChange={handleChange} min="1" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3" />
                            </div>
                        )}
                        {/* Row 2: Date & Mode */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Date</label>
                                <input type="date" name="date" value={activity.date} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Mode</label>
                                <select name="mode" value={activity.mode} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3">
                                    <option>Offline</option>
                                    <option>Online</option>
                                </select>
                            </div>
                        </div>
                        {/* Row 3: Location/Platform */}
                        <div>
                            <label className="text-sm font-medium">{activity.mode === 'Offline' ? 'Venue' : 'Platform'}</label>
                            <input type="text" name="location" value={activity.location} onChange={handleChange} placeholder={activity.mode === 'Offline' ? 'e.g., Auditorium' : 'e.g., Zoom Link'} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3" />
                        </div>
                        {/* Row 4: Eligible Departments */}
                        <div>
                             <label className="text-sm font-medium">Eligible Departments</label>
                             <div className="grid grid-cols-3 gap-2 mt-1">
                                <input type="text" placeholder="Dept. Name" value={currentDept.name} onChange={(e) => setCurrentDept(p => ({...p, name: e.target.value}))} className="col-span-1 rounded-md h-10 px-3" />
                                <select value={currentDept.year} onChange={(e) => setCurrentDept(p => ({...p, year: e.target.value}))} className="col-span-1 rounded-md h-10 px-3">
                                    <option>4th Year</option>
                                    <option>3rd Year</option>
                                    <option>2nd Year</option>
                                    <option>1st Year</option>
                                </select>
                                <Button type="button" variant="outline" onClick={handleAddDepartment}>Add</Button>
                             </div>
                             <div className="mt-2 space-x-1">
                                {activity.eligibleDepartments.map((dept, i) => (
                                    <Badge key={i} variant="secondary" className="relative pr-6">
                                        {dept.name} ({dept.year})
                                        <button type="button" onClick={() => handleRemoveDepartment(i)} className="absolute top-1/2 right-1 -translate-y-1/2 ml-1 text-gray-500 hover:text-red-500">
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                             </div>
                        </div>
                        {/* Row 5: SPOC Details */}
                        <div>
                            <label className="text-sm font-medium">Student Point of Contact</label>
                            <div className="grid sm:grid-cols-2 gap-4 mt-1">
                                <input type="text" name="spocName" value={activity.spocName} onChange={handleChange} placeholder="SPOC Name" className="rounded-md h-10 px-3" />
                                <input type="text" name="spocContact" value={activity.spocContact} onChange={handleChange} placeholder="SPOC Contact (Phone/Email)" className="rounded-md h-10 px-3" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit">Create Activity</Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
