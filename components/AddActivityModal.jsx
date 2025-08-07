// components/AddActivityModal.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XIcon, UploadIcon } from './icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { unifiedActivitiesService } from '../lib/unifiedActivitiesService';

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
        company: '',
        activityName: '',
        activityType: 'Pre-placement Talk',
        interviewRound: 1,
        date: '',
        time: '', // Optional time field
        mode: 'Offline',
        location: '',
        eligibleDepartments: [],
        spocName: '',
        spocContact: '', // Can be email or phone
        status: 'Active',
        allowedUsers: [] // Users who can mark attendance
    });
    const [currentDept, setCurrentDept] = useState({ name: '', year: '4th Year' });
    const [uploadedFile, setUploadedFile] = useState(null);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const fileInputRef = useRef(null);

    // Move these above useEffect to avoid ReferenceError
    const fetchAvailableCompanies = useCallback(async () => {
        try {
            const companies = await unifiedActivitiesService.getAllCompanies();
            setAvailableCompanies(companies);
        } catch (error) {
            console.error('Error fetching companies:', error);
        }
    }, []);

    const fetchAvailableUsers = useCallback(async () => {
        try {
            const usersQuery = query(
                collection(db, 'users'),
                where('isActive', '==', true)
            );
            const snapshot = await getDocs(usersQuery);
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })).filter(user => user.role !== 'admin'); // Exclude admins as they have full access
            setAvailableUsers(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            // Error fetching users - continue with empty list
            setAvailableUsers([]);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchAvailableUsers();
            fetchAvailableCompanies();
        }
    }, [isOpen, fetchAvailableUsers, fetchAvailableCompanies]);

    useEffect(() => {
        // Filter companies based on input
        if (activity.company) {
            const filtered = availableCompanies.filter(company =>
                company.toLowerCase().includes(activity.company.toLowerCase())
            );
            setFilteredCompanies(filtered);
            setShowCompanyDropdown(filtered.length > 0 && activity.company !== '');
        } else {
            setFilteredCompanies([]);
            setShowCompanyDropdown(false);
        }
    }, [activity.company, availableCompanies]);

    const handleCompanySelect = (company) => {
        setActivity(prev => ({ ...prev, company }));
        setShowCompanyDropdown(false);
        
        // Clear validation error when user selects a company
        if (validationErrors.company) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.company;
                return newErrors;
            });
        }
    };

    if (!isOpen) return null;

    // Validation functions
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone) => {
        // Indian phone number validation (10 digits, can start with +91)
        const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
        return phoneRegex.test(phone.replace(/[\s-]/g, ''));
    };

    const validateDate = (date) => {
        if (!date) return false;
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate >= today;
    };

    const validateTime = (time) => {
        if (!time) return true; // Time is optional
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    };

    const validateForm = () => {
        const errors = {};

        // Required field validations
        if (!activity.company.trim()) {
            errors.company = 'Company name is required';
        }

        if (!activity.activityName.trim()) {
            errors.activityName = 'Activity name is required';
        }

        if (!activity.date) {
            errors.date = 'Date is required';
        } else if (!validateDate(activity.date)) {
            errors.date = 'Date must be today or in the future';
        }

        if (!activity.spocName.trim()) {
            errors.spocName = 'SPOC name is required';
        }

        if (!activity.spocContact.trim()) {
            errors.spocContact = 'SPOC contact is required';
        } else {
            const contact = activity.spocContact.trim();
            if (!validateEmail(contact) && !validatePhone(contact)) {
                errors.spocContact = 'Please enter a valid email address or phone number';
            }
        }

        if (activity.time && !validateTime(activity.time)) {
            errors.time = 'Please enter time in HH:MM format (24-hour)';
        }

        if (activity.mode === 'Offline' && !activity.location.trim()) {
            errors.location = 'Location is required for offline activities';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setActivity(prev => ({ ...prev, [name]: value }));
        
        // Clear validation error when user starts typing
        if (validationErrors[name]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
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

    const handleAddUser = (userId) => {
        const user = availableUsers.find(u => u.id === userId);
        if (user && !selectedUsers.find(u => u.id === userId)) {
            const newSelectedUsers = [...selectedUsers, user];
            setSelectedUsers(newSelectedUsers);
            setActivity(prev => ({
                ...prev,
                allowedUsers: newSelectedUsers.map(u => ({ id: u.id, name: u.name, email: u.email }))
            }));
        }
    };

    const handleRemoveUser = (userId) => {
        const newSelectedUsers = selectedUsers.filter(u => u.id !== userId);
        setSelectedUsers(newSelectedUsers);
        setActivity(prev => ({
            ...prev,
            allowedUsers: newSelectedUsers.map(u => ({ id: u.id, name: u.name, email: u.email }))
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate form before submission
        if (!validateForm()) {
            return;
        }
        
        const newActivity = {
            ...activity,
            participants: []
        };

        onSubmit(newActivity, uploadedFile);
        
        // Reset form
        setActivity({
            company: '',
            activityName: '',
            activityType: 'Pre-placement Talk',
            interviewRound: 1,
            date: '',
            time: '',
            mode: 'Offline',
            location: '',
            eligibleDepartments: [],
            spocName: '',
            spocContact: '',
            status: 'Active',
            allowedUsers: []
        });
        setSelectedUsers([]);
        setUploadedFile(null);
        setValidationErrors({});
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

                        {/* Row 1: Company & Activity Name */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="text-sm font-medium">Company Name *</label>
                                <input 
                                    type="text" 
                                    name="company" 
                                    value={activity.company} 
                                    onChange={handleChange} 
                                    onFocus={() => setShowCompanyDropdown(filteredCompanies.length > 0)}
                                    placeholder="Enter or select company name"
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.company 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.company && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.company}</p>
                                )}
                                
                                {/* Company Dropdown */}
                                {showCompanyDropdown && filteredCompanies.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredCompanies.map((company, index) => (
                                            <div
                                                key={index}
                                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                                                onClick={() => handleCompanySelect(company)}
                                            >
                                                {company}
                                            </div>
                                        ))}
                                        {!filteredCompanies.includes(activity.company) && activity.company.trim() && (
                                            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600 text-sm text-blue-600 dark:text-blue-400">
                                                Add "{activity.company}" as new company
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Activity Name *</label>
                                <input 
                                    type="text" 
                                    name="activityName" 
                                    value={activity.activityName} 
                                    onChange={handleChange} 
                                    placeholder="e.g., Pre-placement Talk, Technical Round 1"
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.activityName 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.activityName && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.activityName}</p>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Activity Type */}
                        <div>
                            <label className="text-sm font-medium">Activity Type</label>
                            <select 
                                name="activityType" 
                                value={activity.activityType} 
                                onChange={handleChange} 
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                            >
                                <option>Pre-placement Talk</option>
                                <option>Online Assessment</option>
                                <option>Interview Round</option>
                                <option>Group Discussion</option>
                                <option>Technical Interview</option>
                                <option>HR Interview</option>
                                <option>Final Selection</option>
                            </select>
                        </div>

                        {/* Row 3: Date & Time */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Date *</label>
                                <input 
                                    type="date" 
                                    name="date" 
                                    value={activity.date} 
                                    onChange={handleChange}
                                    min={new Date().toISOString().split('T')[0]}
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.date 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.date && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.date}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Time (Optional)</label>
                                <input 
                                    type="time" 
                                    name="time" 
                                    value={activity.time} 
                                    onChange={handleChange}
                                    placeholder="HH:MM"
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.time 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.time && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.time}</p>
                                )}
                            </div>
                        </div>

                        {/* Row 4: Mode & Location */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Mode</label>
                                <select 
                                    name="mode" 
                                    value={activity.mode} 
                                    onChange={handleChange} 
                                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                                >
                                    <option>Online</option>
                                    <option>Offline</option>
                                    <option>Hybrid</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">
                                    Location {activity.mode === 'Offline' && '*'}
                                </label>
                                <input 
                                    type="text" 
                                    name="location" 
                                    value={activity.location} 
                                    onChange={handleChange} 
                                    placeholder={activity.mode === 'Online' ? 'Meeting link (optional)' : 'Enter location'}
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.location 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.location && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.location}</p>
                                )}
                            </div>
                        </div>

                        {/* Row 5: SPOC Details */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">SPOC Name *</label>
                                <input 
                                    type="text" 
                                    name="spocName" 
                                    value={activity.spocName} 
                                    onChange={handleChange} 
                                    placeholder="Enter SPOC name"
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.spocName 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.spocName && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.spocName}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">SPOC Contact * (Email or Phone)</label>
                                <input 
                                    type="text" 
                                    name="spocContact" 
                                    value={activity.spocContact} 
                                    onChange={handleChange} 
                                    placeholder="email@company.com or +91-9876543210"
                                    className={`mt-1 block w-full rounded-md border shadow-sm h-10 px-3 ${
                                        validationErrors.spocContact 
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                                    }`}
                                />
                                {validationErrors.spocContact && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.spocContact}</p>
                                )}
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

                        {/* Row 6: Eligible Departments */}
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

                        {/* Row 7: User Permissions */}
                        <div>
                            <label className="text-sm font-medium">Attendance Marking Permissions</label>
                            <div className="mt-1">
                                <select 
                                    onChange={(e) => e.target.value && handleAddUser(e.target.value)}
                                    value=""
                                    className="w-full h-10 px-3 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                                >
                                    <option value="">Select users who can mark attendance...</option>
                                    {availableUsers
                                        .filter(user => !selectedUsers.find(s => s.id === user.id))
                                        .map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.email}) - {user.role === 'placement_coordinator' ? 'PC' : 'Marker'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mt-2 space-x-1">
                                {selectedUsers.map((user) => (
                                    <Badge key={user.id} variant="secondary" className="relative pr-6">
                                        {user.name} ({user.role === 'placement_coordinator' ? 'PC' : 'Marker'})
                                        <button type="button" onClick={() => handleRemoveUser(user.id)} className="absolute top-1/2 right-1 -translate-y-1/2 ml-1 text-gray-500 hover:text-red-500">
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Select users who can mark attendance for this activity. Admins and activity creators always have access.</p>
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
