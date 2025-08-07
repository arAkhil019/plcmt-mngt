// components/UserManagement.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import AdminUserForm from "./AdminUserForm";
import { MailIcon, ClipboardIcon } from "./icons";

export default function UserManagement({
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  isXlsxScriptLoaded,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [preApprovedEmails, setPreApprovedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState({
    email: '',
    name: '',
    role: 'placement_coordinator',
    department: ''
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Filtering and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  
  const { userProfile, addPreApprovedEmail } = useAuth();

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "placement_coordinator",
  });

  // Excel upload states
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    email: '',
    role: '',
    department: ''
  });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchUsers();
    if (activeTab === "emails") {
      fetchPreApprovedEmails();
    }
  }, [activeTab]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const fetchUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(usersQuery);
      const usersList = [];
      querySnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: Implement user creation functionality
      console.log('User creation not implemented yet:', newUser);
      alert('User creation functionality is not implemented yet. Please use the "Create Admin" button instead.');
      setShowCreateUser(false);
    } catch (error) {
      console.error("Error creating user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus,
      });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  // Handle role change for a user
  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      
      // Prevent removing admin role from the main admin email
      const user = users.find(u => u.id === userId);
      if (user?.email === 'cbitplacementtraker@gmail.com' && newRole !== 'admin') {
        alert('Cannot change role for the main admin account');
        return;
      }
      
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
        updatedAt: new Date(),
        updatedBy: userProfile.id
      });
      
      setMessage(`User role updated to ${getRoleLabel(newRole)} successfully!`);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      setError("Failed to update user role");
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      admin: 'Admin',
      cpc: 'Chief Placement Coordinator',
      placement_coordinator: 'Placement Coordinator',
      attendance_marker: 'Attendance Marker'
    };
    return roleLabels[role] || role;
  };

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role) => {
    const roleConfig = {
      admin: { variant: "default", label: "Admin" },
      cpc: { variant: "destructive", label: "CPC" },
      placement_coordinator: { variant: "secondary", label: "PC" },
      attendance_marker: { variant: "success", label: "Marker" },
    };

    const config = roleConfig[role] || {
      variant: "secondary",
      label: "Unknown",
    };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Email management functions
  const fetchPreApprovedEmails = async () => {
    try {
      setEmailLoading(true);
      const querySnapshot = await getDocs(collection(db, 'preApprovedUsers'));
      const emails = [];
      querySnapshot.forEach((doc) => {
        emails.push({ id: doc.id, ...doc.data() });
      });
      setPreApprovedEmails(emails);
    } catch (error) {
      console.error('Error fetching pre-approved emails:', error);
      setError('Failed to load pre-approved emails.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setMessage('');
    setError('');

    try {
      await addPreApprovedEmail(newEmail.email, {
        name: newEmail.name,
        role: newEmail.role,
        department: newEmail.department
      });
      
      setMessage(`Email ${newEmail.email} has been pre-approved successfully!`);
      setNewEmail({ email: '', name: '', role: 'placement_coordinator', department: '' });
      await fetchPreApprovedEmails();
    } catch (error) {
      console.error('Error adding pre-approved email:', error);
      setError(error.message || 'Failed to add pre-approved email.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRemoveEmail = async (emailId, email) => {
    if (!confirm(`Are you sure you want to remove pre-approval for ${email}?`)) {
      return;
    }

    try {
      setEmailLoading(true);
      await deleteDoc(doc(db, 'preApprovedUsers', emailId));
      setMessage(`Pre-approval removed for ${email}`);
      await fetchPreApprovedEmails();
    } catch (error) {
      console.error('Error removing pre-approved email:', error);
      setError('Failed to remove pre-approved email.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailInputChange = (e) => {
    const { name, value } = e.target;
    setNewEmail(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Clear messages when switching tabs
  useEffect(() => {
    setMessage('');
    setError('');
  }, [activeTab]);

  // Excel upload functions
  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      setExcelFile(file);
      processExcelFile(file);
    }
  };

  const processExcelFile = (file) => {
    if (!window.XLSX) {
      setError('Excel processing library is not loaded yet. Please wait and try again.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          const headers = jsonData[0];
          const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
          
          setExcelHeaders(headers);
          setExcelData(rows);
          setError('');
          setMessage(`Excel file loaded successfully! Found ${rows.length} users to process.`);
        } else {
          setError('Excel file appears to be empty');
        }
      } catch (error) {
        console.error('Error processing Excel file:', error);
        setError('Failed to process Excel file. Please ensure it\'s a valid Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleColumnMappingChange = (field, headerIndex) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: headerIndex
    }));
  };

  const handleBulkUpload = async () => {
    if (!excelData.length || !columnMapping.name || !columnMapping.email) {
      setError('Please map at least Name and Email columns');
      return;
    }

    setUploadLoading(true);
    setUploadProgress(0);
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      for (let i = 0; i < excelData.length; i++) {
        const row = excelData[i];
        setUploadProgress(Math.round(((i + 1) / excelData.length) * 100));

        try {
          const userData = {
            email: row[columnMapping.email]?.toString().trim(),
            name: row[columnMapping.name]?.toString().trim(),
            role: columnMapping.role ? (row[columnMapping.role]?.toString().trim() || 'placement_coordinator') : 'placement_coordinator',
            department: columnMapping.department ? (row[columnMapping.department]?.toString().trim() || '') : ''
          };

          // Validate required fields
          if (!userData.email || !userData.name) {
            errorCount++;
            errors.push(`Row ${i + 2}: Missing email or name`);
            continue;
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(userData.email)) {
            errorCount++;
            errors.push(`Row ${i + 2}: Invalid email format - ${userData.email}`);
            continue;
          }

          // Add to pre-approved emails
          await addPreApprovedEmail(userData.email, {
            name: userData.name,
            role: userData.role,
            department: userData.department
          });

          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }

      // Show results
      let resultMessage = `Bulk upload completed! ${successCount} users added successfully.`;
      if (errorCount > 0) {
        resultMessage += ` ${errorCount} errors occurred.`;
      }
      setMessage(resultMessage);

      if (errors.length > 0) {
        console.log('Upload errors:', errors);
        setError(`Some errors occurred during upload. Check console for details.`);
      }

      // Refresh the pre-approved emails list
      if (successCount > 0) {
        await fetchPreApprovedEmails();
      }

      // Reset upload state
      setShowExcelUpload(false);
      setExcelFile(null);
      setExcelData([]);
      setExcelHeaders([]);
      setColumnMapping({ name: '', email: '', role: '', department: '' });

    } catch (error) {
      console.error('Bulk upload error:', error);
      setError(`Bulk upload failed: ${error.message}`);
    } finally {
      setUploadLoading(false);
      setUploadProgress(0);
    }
  };

  const downloadTemplate = () => {
    if (!window.XLSX) {
      setError('Excel library is not loaded yet. Please wait and try again.');
      return;
    }

    const templateData = [
      ['Name', 'Email', 'Role', 'Department'],
      ['John Doe', 'john.doe@example.com', 'placement_coordinator', 'Computer Science'],
      ['Jane Smith', 'jane.smith@example.com', 'admin', 'Information Technology'],
      ['Bob Johnson', 'bob.johnson@example.com', 'placement_coordinator', 'Electronics Engineering']
    ];

    const ws = window.XLSX.utils.aoa_to_sheet(templateData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Users');
    
    // Auto-fit column widths
    const colWidths = templateData[0].map((header, i) => {
      const maxLength = Math.max(
        header.length,
        ...templateData.slice(1).map(row => (row[i] || '').toString().length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
    ws['!cols'] = colWidths;

    window.XLSX.writeFile(wb, 'user_template.xlsx');
  };

  if (userProfile?.role !== "admin") {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          Access denied. Admin privileges required.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage users, roles, and pre-approved emails
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className="p-4 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab("emails")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === "emails"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
        >
          <MailIcon className="h-4 w-4 mr-2" />
          Pre-approved Emails
        </button>
      </div>

      {/* Users Tab Content */}
      {activeTab === "users" && (
        <>
          {/* Create User Buttons */}
          <div className="flex justify-end gap-3">
            <div className="relative">
              <Button
                onClick={() => setShowExcelUpload(true)}
                variant="outline"
                className="px-6 py-2.5"
                disabled={!isXlsxScriptLoaded}
                title={!isXlsxScriptLoaded ? "Loading Excel library..." : "Upload Excel file with user data"}
              >
                <ClipboardIcon className="h-4 w-4 mr-2" />
                Bulk Upload Excel
                {!isXlsxScriptLoaded && (
                  <div className="absolute -top-1 -right-1 h-3 w-3">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                )}
              </Button>
            </div>
            <Button
              onClick={() => setShowCreateAdmin(true)}
              variant="outline"
              className="px-6 py-2.5"
            >
              <span className="mr-2">+</span>
              Create Admin
            </Button>
            <Button
              onClick={() => setShowCreateUser(true)}
              className="px-6 py-2.5"
            >
              <span className="mr-2">+</span>
              Create User
            </Button>
          </div>

          {/* Create User Form */}
          {showCreateUser && (
            <Card className="shadow-lg border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl text-gray-900 dark:text-white">
                  Create New User
                </CardTitle>
                <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                  Add a new user to the system with specific role permissions
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateUser}>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) =>
                          setNewUser((prev) => ({ ...prev, name: e.target.value }))
                        }
                        required
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) =>
                          setNewUser((prev) => ({ ...prev, email: e.target.value }))
                        }
                        required
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Password
                      </label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        required
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter password"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Role
                      </label>
                      <select
                        value={newUser.role}
                        onChange={(e) =>
                          setNewUser((prev) => ({ ...prev, role: e.target.value }))
                        }
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="placement_coordinator">
                          Placement Coordinator
                        </option>
                        <option value="cpc">Chief Placement Coordinator</option>
                        <option value="attendance_marker">Attendance Marker</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-4 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateUser(false)}
                      className="px-6 py-2.5"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5"
                    >
                      {loading ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </CardContent>
              </form>
            </Card>
          )}

          {/* Create Admin Form */}
          {showCreateAdmin && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Create Admin User
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateAdmin(false)}
                    className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    ×
                  </Button>
                </div>
                <div className="p-6">
                  <AdminUserForm
                    Button={Button}
                    onSuccess={() => {
                      setShowCreateAdmin(false);
                      fetchUsers();
                    }}
                    onCancel={() => setShowCreateAdmin(false)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Excel Bulk Upload Modal */}
          {showExcelUpload && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Bulk Upload Users from Excel
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExcelUpload(false)}
                    className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    ×
                  </Button>
                </div>
                <div className="p-6 space-y-6">
                  {/* Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Excel File Format Instructions</h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                      <li>• Excel file should have headers in the first row</li>
                      <li>• Required columns: Name, Email</li>
                      <li>• Optional columns: Role, Department</li>
                      <li>• Supported formats: .xlsx, .xls</li>
                      <li>• Users will be added to pre-approved list and can sign in with Google</li>
                    </ul>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadTemplate}
                        disabled={!isXlsxScriptLoaded}
                        className="text-blue-600 border-blue-300 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/20"
                      >
                        📥 Download Template
                      </Button>
                    </div>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Excel File
                      </label>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcelFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                      />
                    </div>

                    {message && (
                      <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm">
                        {message}
                      </div>
                    )}
                    {error && (
                      <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm">
                        {error}
                      </div>
                    )}
                  </div>

                  {/* Column Mapping */}
                  {excelHeaders.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Map Excel Columns</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Name Column *
                          </label>
                          <select
                            value={columnMapping.name}
                            onChange={(e) => handleColumnMappingChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">Select column...</option>
                            {excelHeaders.map((header, index) => (
                              <option key={index} value={index}>{header}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email Column *
                          </label>
                          <select
                            value={columnMapping.email}
                            onChange={(e) => handleColumnMappingChange('email', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">Select column...</option>
                            {excelHeaders.map((header, index) => (
                              <option key={index} value={index}>{header}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Role Column (Optional)
                          </label>
                          <select
                            value={columnMapping.role}
                            onChange={(e) => handleColumnMappingChange('role', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">Select column...</option>
                            {excelHeaders.map((header, index) => (
                              <option key={index} value={index}>{header}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Department Column (Optional)
                          </label>
                          <select
                            value={columnMapping.department}
                            onChange={(e) => handleColumnMappingChange('department', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">Select column...</option>
                            {excelHeaders.map((header, index) => (
                              <option key={index} value={index}>{header}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview Data */}
                  {excelData.length > 0 && columnMapping.name && columnMapping.email && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Preview ({Math.min(5, excelData.length)} of {excelData.length} rows)</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {excelData.slice(0, 5).map((row, index) => (
                              <tr key={index} className="bg-white dark:bg-gray-900">
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{row[columnMapping.name] || '-'}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{row[columnMapping.email] || '-'}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{columnMapping.role ? (row[columnMapping.role] || 'placement_coordinator') : 'placement_coordinator'}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{columnMapping.department ? (row[columnMapping.department] || '-') : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Upload Progress */}
                  {uploadLoading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading users...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="outline"
                      onClick={() => setShowExcelUpload(false)}
                      disabled={uploadLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleBulkUpload}
                      disabled={!excelData.length || !columnMapping.name || !columnMapping.email || uploadLoading}
                    >
                      {uploadLoading ? 'Uploading...' : `Upload ${excelData.length} Users`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          <Card className="shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-gray-900 dark:text-white">
                System Users
              </CardTitle>
              <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                Overview of all users and their access levels
              </CardDescription>
              
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by name, email, or department..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
                <div className="sm:w-48">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="cpc">Chief Placement Coordinator</option>
                    <option value="placement_coordinator">Placement Coordinator</option>
                    <option value="attendance_marker">Attendance Marker</option>
                  </select>
                </div>
              </div>
              
              {/* Results count */}
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600 dark:text-gray-400">
                      Loading users...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-700">
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Name
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Email
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Role
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Status
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Last Login
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                            {searchTerm || roleFilter !== 'all' 
                              ? 'No users match the current filters' 
                              : 'No users found'
                            }
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow
                            key={user.id}
                            className="border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <TableCell className="font-medium text-gray-900 dark:text-white py-4 px-6">
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                {user.department && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {user.department}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6">
                              {user.email}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <div className="flex items-center space-x-2">
                                {getRoleBadge(user.role)}
                                {userProfile?.role === 'admin' && user.email !== 'cbitplacementtraker@gmail.com' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingUser(user.id)}
                                    className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                    title="Edit role"
                                  >
                                    ✏️
                                  </Button>
                                )}
                              </div>
                              
                              {/* Role editing dropdown */}
                              {editingUser === user.id && (
                                <div className="mt-2 space-y-2">
                                  <select
                                    value={user.role}
                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                    className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800"
                                  >
                                    <option value="placement_coordinator">Placement Coordinator</option>
                                    <option value="cpc">Chief Placement Coordinator</option>
                                    <option value="admin">Admin</option>
                                    <option value="attendance_marker">Attendance Marker</option>
                                  </select>
                                  <div className="flex space-x-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingUser(null)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Badge
                                variant={user.isActive ? "success" : "secondary"}
                                className="font-medium"
                              >
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6">
                              {user.lastLogin
                                ? new Date(
                                    user.lastLogin.seconds * 1000
                                  ).toLocaleDateString()
                                : "Never"}
                            </TableCell>
                            <TableCell className="py-4 px-6">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleToggleUserStatus(user.id, user.isActive)
                                }
                                className="px-4 py-2"
                                disabled={user.email === 'cbitplacementtraker@gmail.com'}
                                title={user.email === 'cbitplacementtraker@gmail.com' ? 'Cannot deactivate main admin' : ''}
                              >
                                {user.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Emails Tab Content */}
      {activeTab === "emails" && (
        <div className="space-y-6">
          {/* Add New Pre-approved Email */}
          <Card className="shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Add Pre-approved Email</CardTitle>
              <CardDescription>
                Pre-approve email addresses for password authentication setup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {message && (
                <div className="p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm mb-4">
                  {message}
                </div>
              )}
              {error && (
                <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm mb-4">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleAddEmail} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={newEmail.email}
                      onChange={handleEmailInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={newEmail.name}
                      onChange={handleEmailInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={newEmail.role}
                      onChange={handleEmailInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="placement_coordinator">Placement Coordinator</option>
                      <option value="cpc">Chief Placement Coordinator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Department
                    </label>
                    <input
                      id="department"
                      name="department"
                      type="text"
                      value={newEmail.department}
                      onChange={handleEmailInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="Computer Science"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={emailLoading} className="w-full md:w-auto">
                  {emailLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Adding...
                    </div>
                  ) : (
                    "Add Pre-approved Email"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List of Pre-approved Emails */}
          <Card className="shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Pre-approved Emails</CardTitle>
              <CardDescription>
                Users with these email addresses can set up password authentication after signing in with Google
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailLoading && preApprovedEmails.length === 0 ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading pre-approved emails...
                </div>
              ) : preApprovedEmails.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No pre-approved emails found. Add some above to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {preApprovedEmails.map((emailData) => (
                    <div key={emailData.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {emailData.email}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {emailData.name} • {emailData.role} • {emailData.department || 'No department'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          Added: {emailData.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveEmail(emailData.id, emailData.email)}
                        disabled={emailLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
