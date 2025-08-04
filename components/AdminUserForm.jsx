// components/AdminUserForm.jsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminUserForm = ({ Button, onSuccess, onCancel }) => {
  const { addPreApprovedEmail } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'placement_coordinator',
    department: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await addPreApprovedEmail(formData.email, formData.name, formData.role, formData.department);
      setMessage('User email pre-approved! They can now sign in with Google.');
      setFormData({ email: '', name: '', role: 'placement_coordinator', department: '' });
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="w-full">
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Google Authentication System</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Users will sign in with their Google accounts. You can pre-configure their roles and departments here, 
          which will be applied when they first sign in.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter full name"
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Google Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter their Google email address"
          />
        </div>
        
        <div>
          <label htmlFor="role" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="placement_coordinator">Placement Coordinator</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="department" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Department
          </label>
          <input
            type="text"
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Enter department (optional)"
          />
        </div>
        
        {message && (
          <div className={`text-sm p-3 rounded-md ${
            message.includes('Error') 
              ? 'bg-red-100 text-red-700 border border-red-200' 
              : 'bg-green-100 text-green-700 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Setting up...' : 'Setup User Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdminUserForm;
