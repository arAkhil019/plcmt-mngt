// components/CompanyManagementModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  XIcon, 
  BuildingIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  LinkIcon,
  MapPinIcon,
  BriefcaseIcon
} from './icons';

export default function CompanyManagementModal({
  isOpen,
  onClose,
  company = null, // null for new company, object for editing
  onSave,
  onDelete,
  isLoading = false,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  userProfile
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    industry: '',
    location: ''
  });
  const [errors, setErrors] = useState({});

  // Pre-populate form when editing
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        description: company.description || '',
        website: company.website || '',
        industry: company.industry || '',
        location: company.location || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        website: '',
        industry: '',
        location: ''
      });
    }
    setErrors({});
  }, [company, isOpen]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }
    
    if (formData.website && !isValidUrl(formData.website)) {
      newErrors.website = 'Please enter a valid website URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string) => {
    try {
      new URL(string.startsWith('http') ? string : `https://${string}`);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const companyData = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      website: formData.website.trim(),
      industry: formData.industry.trim(),
      location: formData.location.trim(),
      createdBy: userProfile?.id,
      createdByName: userProfile?.name
    };

    try {
      await onSave(companyData);
      onClose();
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  const handleDelete = async () => {
    if (!company) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${company.name}"? This action cannot be undone and will affect all associated activities.`
    );
    
    if (confirmDelete) {
      try {
        await onDelete(company.id);
        onClose();
      } catch (error) {
        console.error('Error deleting company:', error);
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  if (!isOpen) return null;

  const isEditing = Boolean(company);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <BuildingIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl">
                  {isEditing ? `Edit ${company.name}` : 'Add New Company'}
                </CardTitle>
              </div>
              <Button onClick={onClose} variant="ghost" size="sm" className="p-2">
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full h-11 px-4 rounded-lg border ${
                    errors.name 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                  placeholder="Enter company name"
                  required
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <BriefcaseIcon className="h-4 w-4 inline mr-1" />
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Technology, Finance, Healthcare"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPinIcon className="h-4 w-4 inline mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full h-11 px-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Hyderabad, India"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <LinkIcon className="h-4 w-4 inline mr-1" />
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className={`w-full h-11 px-4 rounded-lg border ${
                    errors.website 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                  placeholder="https://company.com"
                />
                {errors.website && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.website}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  placeholder="Brief description about the company..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <div className="flex-1 flex gap-3">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        {isEditing ? <PencilIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                        {isEditing ? 'Update Company' : 'Create Company'}
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={onClose}
                    variant="outline"
                    disabled={isLoading}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                </div>

                {/* Delete Button (only when editing, admin and CPC) */}
                {isEditing && (userProfile?.role === 'admin' || userProfile?.role === 'cpc') && (
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full sm:w-auto px-6 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Delete Company
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
