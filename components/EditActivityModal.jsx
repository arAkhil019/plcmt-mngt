// components/EditActivityModal.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { XIcon, CheckIcon, TrashIcon, UploadIcon } from "./icons";
import { useAuth } from "../contexts/AuthContext";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function EditActivityModal({
  isOpen,
  onClose,
  onSubmit,
  onFileUpload,
  onDelete,
  activity,
  onShowConfirmDialog,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
}) {
  const { userProfile } = useAuth();
  const [editedActivity, setEditedActivity] = useState({
    company: "",
    activityName: "",
    activityType: "Pre-placement Talk",
    interviewRound: 1,
    date: "",
    mode: "Offline",
    location: "",
    eligibleDepartments: [],
    spocName: "",
    spocContact: "",
    status: "Active",
  });
  const [currentDept, setCurrentDept] = useState({
    name: "",
    year: "4th Year",
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const fileInputRef = useRef(null);

  // Define fetchAvailableUsers early to avoid hoisting issues
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
      setAvailableUsers([]);
    }
  }, []);

  // Initialize form with activity data when modal opens
  useEffect(() => {
    if (isOpen && activity) {
      setEditedActivity({
        company: activity.company || "",
        activityName: activity.activityName || "",
        activityType: activity.activityType || "Pre-placement Talk",
        interviewRound: activity.interviewRound || 1,
        date: activity.date || "",
        mode: activity.mode || "Offline",
        location: activity.location || "",
        eligibleDepartments: activity.eligibleDepartments || [],
        spocName: activity.spocName || "",
        spocContact: activity.spocContact || "",
        status: activity.status || "Active",
      });
      
      // Initialize selected users from activity allowedUsers
      if (activity.allowedUsers) {
        setSelectedUsers(activity.allowedUsers);
      } else {
        setSelectedUsers([]);
      }
      
      fetchAvailableCompanies();
      fetchAvailableUsers();
    }
  }, [isOpen, activity, fetchAvailableUsers]);

  useEffect(() => {
    // Filter companies based on input
    if (editedActivity.company) {
      const filtered = availableCompanies.filter(company =>
        company.toLowerCase().includes(editedActivity.company.toLowerCase())
      );
      setFilteredCompanies(filtered);
      setShowCompanyDropdown(filtered.length > 0 && editedActivity.company !== '');
    } else {
      setFilteredCompanies([]);
      setShowCompanyDropdown(false);
    }
  }, [editedActivity.company, availableCompanies]);

  const fetchAvailableCompanies = async () => {
    try {
      const companies = await unifiedActivitiesService.getAllCompanies();
      setAvailableCompanies(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleAddUser = (userId) => {
    const user = availableUsers.find(u => u.id === userId);
    if (user && !selectedUsers.find(u => u.id === userId)) {
      const newSelectedUsers = [...selectedUsers, user];
      setSelectedUsers(newSelectedUsers);
    }
  };

  const handleRemoveUser = (userId) => {
    const newSelectedUsers = selectedUsers.filter(u => u.id !== userId);
    setSelectedUsers(newSelectedUsers);
  };

  const handleCompanySelect = (company) => {
    setEditedActivity(prev => ({ ...prev, company }));
    setShowCompanyDropdown(false);
  };

  if (!isOpen || !activity) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedActivity((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddDepartment = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentDept.name.trim() === "") return;
    setEditedActivity((prev) => ({
      ...prev,
      eligibleDepartments: [...prev.eligibleDepartments, currentDept],
    }));
    setCurrentDept({ name: "", year: "4th Year" });
  };

  const handleRemoveDepartment = (index) => {
    setEditedActivity((prev) => ({
      ...prev,
      eligibleDepartments: prev.eligibleDepartments.filter(
        (_, i) => i !== index
      ),
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

    const updatedActivity = {
      ...activity,
      ...editedActivity,
      id: activity.id, // Keep original ID
      allowedUsers: selectedUsers.map(u => ({ id: u.id, name: u.name, email: u.email })), // Update allowedUsers
    };

    onSubmit(updatedActivity, uploadedFile);

    // Reset uploaded file
    setUploadedFile(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!userProfile || userProfile.role !== "admin") return;

    const participantCount =
      activity.totalParticipants || activity.eligibleDepartments?.length || 0;
    const confirmMessage = `Are you sure you want to delete "${
      activity.activityName || activity.name
    }"? This will permanently remove the activity and all ${participantCount} participant records. This action cannot be undone.`;
    
    if (onShowConfirmDialog) {
      onShowConfirmDialog(
        "Delete Activity",
        confirmMessage,
        async () => {
          try {
            setIsDeleting(true);
            await onDelete(activity);
            // Don't close here - let the parent handle closing after successful deletion
          } catch (error) {
            console.error("Error deleting activity:", error);
            // Error handled by parent component
          } finally {
            setIsDeleting(false);
          }
        },
        "danger"
      );
    } else {
      // Fallback to window.confirm
      if (!window.confirm(confirmMessage)) {
        return;
      }

      try {
        setIsDeleting(true);
        await onDelete(activity);
        onClose();
      } catch (error) {
        console.error("Error deleting activity:", error);
        // Error handled by parent component
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4">
      <Card className="w-full max-w-2xl relative">
        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 h-8 w-8"
          onClick={onClose}
        >
          <XIcon className="h-4 w-4" />
        </Button>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Edit Activity</CardTitle>
            <CardDescription>
              Update the details for this placement activity.
            </CardDescription>
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
                <label className="text-sm font-medium">Company Name</label>
                <input
                  type="text"
                  name="company"
                  value={editedActivity.company}
                  onChange={handleChange}
                  onFocus={() => setShowCompanyDropdown(filteredCompanies.length > 0)}
                  placeholder="Enter or select company name"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                />
                
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
                    {!filteredCompanies.includes(editedActivity.company) && editedActivity.company.trim() && (
                      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600 text-sm text-blue-600 dark:text-blue-400">
                        Update to "{editedActivity.company}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Activity Name</label>
                <input
                  type="text"
                  name="activityName"
                  value={editedActivity.activityName}
                  onChange={handleChange}
                  placeholder="e.g., Pre-placement Talk, Technical Round 1"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                />
              </div>
            </div>

            {/* Row 2: Activity Type */}
            <div>
              <label className="text-sm font-medium">Activity Type</label>
              <select
                name="activityType"
                value={editedActivity.activityType}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
              >
                <option>Pre-placement Talk</option>
                <option>Online Assessment</option>
                <option>Interview Round</option>
              </select>
            </div>

            {/* Update student list section - only for Active status */}
            {editedActivity.status === "Active" && (
              <div>
                <label className="text-sm font-medium">
                  Update Student List (Optional)
                </label>
                <div className="mt-1 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFileUpload}
                    className="flex-1"
                  >
                    <UploadIcon className="h-4 w-4 mr-2" />
                    {uploadedFile ? "Change File" : "Upload New Excel"}
                  </Button>
                  {uploadedFile && (
                    <div className="flex-1 flex items-center text-sm text-green-600 dark:text-green-400">
                      New file: {uploadedFile.name}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Upload a new Excel file to replace current student data
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                name="status"
                value={editedActivity.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
              >
                <option>Active</option>
                <option>In Progress</option>
                <option>Inactive</option>
              </select>
            </div>

            {/* Conditional: Interview Round */}
            {editedActivity.activityType === "Interview Round" && (
              <div>
                <label className="text-sm font-medium">Round Number</label>
                <input
                  type="number"
                  name="interviewRound"
                  value={editedActivity.interviewRound}
                  onChange={handleChange}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                />
              </div>
            )}

            {/* Row 3: Date & Mode */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  name="date"
                  value={editedActivity.date}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Mode</label>
                <select
                  name="mode"
                  value={editedActivity.mode}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
                >
                  <option>Offline</option>
                  <option>Online</option>
                </select>
              </div>
            </div>

            {/* Row 4: Location/Platform */}
            <div>
              <label className="text-sm font-medium">
                {editedActivity.mode === "Offline" ? "Venue" : "Platform"}
              </label>
              <input
                type="text"
                name="location"
                value={editedActivity.location}
                onChange={handleChange}
                placeholder={
                  editedActivity.mode === "Offline"
                    ? "e.g., Auditorium"
                    : "e.g., Zoom Link"
                }
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm h-10 px-3"
              />
            </div>

            {/* Row 5: Eligible Departments */}
            <div>
              <label className="text-sm font-medium">
                Eligible Departments
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <input
                  type="text"
                  placeholder="Dept. Name"
                  value={currentDept.name}
                  onChange={(e) =>
                    setCurrentDept((p) => ({ ...p, name: e.target.value }))
                  }
                  className="col-span-1 rounded-md h-10 px-3"
                />
                <select
                  value={currentDept.year}
                  onChange={(e) =>
                    setCurrentDept((p) => ({ ...p, year: e.target.value }))
                  }
                  className="col-span-1 rounded-md h-10 px-3"
                >
                  <option>4th Year</option>
                  <option>3rd Year</option>
                  <option>2nd Year</option>
                  <option>1st Year</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddDepartment}
                >
                  Add
                </Button>
              </div>
              <div className="mt-2 space-x-1">
                {editedActivity.eligibleDepartments.map((dept, i) => (
                  <Badge key={i} variant="secondary" className="relative pr-6">
                    {dept.name} ({dept.year})
                    <button
                      type="button"
                      onClick={() => handleRemoveDepartment(i)}
                      className="absolute top-1/2 right-1 -translate-y-1/2 ml-1 text-gray-500 hover:text-red-500"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Row 6: SPOC Details */}
            <div>
              <label className="text-sm font-medium">
                Student Point of Contact
              </label>
              <div className="grid sm:grid-cols-2 gap-4 mt-1">
                <input
                  type="text"
                  name="spocName"
                  value={editedActivity.spocName}
                  onChange={handleChange}
                  placeholder="SPOC Name"
                  className="rounded-md h-10 px-3"
                />
                <input
                  type="text"
                  name="spocContact"
                  value={editedActivity.spocContact}
                  onChange={handleChange}
                  placeholder="SPOC Contact (Phone/Email)"
                  className="rounded-md h-10 px-3"
                />
              </div>
            </div>

            {/* User Permissions Management */}
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
          <CardFooter className="justify-between">
            <div>
              {/* Admin and CPC delete button */}
              {(userProfile?.role === "admin" || userProfile?.role === "cpc") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {isDeleting ? "Deleting..." : "Delete Activity"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Update Activity</Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
