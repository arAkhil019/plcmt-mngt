import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function AdminEmailManager({
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
}) {
  const [preApprovedEmails, setPreApprovedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState({
    email: '',
    name: '',
    role: 'placement_coordinator',
    department: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { userProfile, addPreApprovedEmail } = useAuth();

  // Check if user is admin
  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600 dark:text-red-400">
            Access denied. Only administrators can manage pre-approved emails.
          </p>
        </CardContent>
      </Card>
    );
  }

  const fetchPreApprovedEmails = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreApprovedEmails();
  }, []);

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
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
      await fetchPreApprovedEmails(); // Refresh the list
    } catch (error) {
      console.error('Error adding pre-approved email:', error);
      setError(error.message || 'Failed to add pre-approved email.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmail = async (emailId, email) => {
    if (!confirm(`Are you sure you want to remove pre-approval for ${email}?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'preApprovedUsers', emailId));
      setMessage(`Pre-approval removed for ${email}`);
      await fetchPreApprovedEmails(); // Refresh the list
    } catch (error) {
      console.error('Error removing pre-approved email:', error);
      setError('Failed to remove pre-approved email.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEmail(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-6">
      {/* Add New Pre-approved Email */}
      <Card>
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="placement_coordinator">Placement Coordinator</option>
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
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Computer Science"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full md:w-auto">
              {loading ? (
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
      <Card>
        <CardHeader>
          <CardTitle>Pre-approved Emails</CardTitle>
          <CardDescription>
            Users with these email addresses can set up password authentication after signing in with Google
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && preApprovedEmails.length === 0 ? (
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
                    disabled={loading}
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
  );
}
