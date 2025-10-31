// components/AdminCollectionManager.jsx
import React, { useState, useEffect } from 'react';
import { studentsService } from '../lib/studentsService';
import { useAuth } from '../contexts/AuthContext';
import { activityLogsService, ACTIVITY_LOG_TYPES } from '../lib/activityLogsService';
import { EditIcon, TrashIcon, AlertCircleIcon, PencilIcon } from './icons';

export default function AdminCollectionManager({ uiComponents }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = uiComponents;
  const { userProfile } = useAuth();
  
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionDetails, setCollectionDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState('list'); // 'list', 'details', 'students'
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('department');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Bulk operations
  const [selectedCollections, setSelectedCollections] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkArchiveModal, setShowBulkArchiveModal] = useState(false);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState('');
  const [bulkOperationInProgress, setBulkOperationInProgress] = useState(false);

  // Lazy loading states
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [collectionStudents, setCollectionStudents] = useState([]);
  
  // Inline editing states
  const [editingCollection, setEditingCollection] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    loadCollectionsBasic();
  }, []);

  // Load basic collections list (optimized - minimal reads)
  const loadCollectionsBasic = async () => {
    try {
      setLoading(true);
      setError('');
      const collectionsData = await studentsService.getAllCollectionsBasic();
      setCollections(collectionsData);
    } catch (error) {
      setError(`Failed to load collections: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load full collections with details (expensive - only when needed)
  const loadCollections = async () => {
    try {
      setLoading(true);
      setError('');
      const collectionsData = await studentsService.getAllCollectionsWithDetails();
      setCollections(collectionsData);
    } catch (error) {
      setError(`Failed to load collections: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load detailed collection information (lazy loading)
  const loadCollectionStudents = async (collectionName) => {
    if (studentsLoading || !collectionName) return;
    
    setStudentsLoading(true);
    setSelectedCollection(collectionName);
    
    try {
      const students = await studentsService.getStudentsByCollection(collectionName);
      const details = await studentsService.getCollectionDetails(collectionName);
      
      setCollectionDetails(details);
      setCollectionStudents(students);
      setView('students');
      
      // Log activity
      if (user) {
        await activityLogger.log(
          user,
          'view_collection_students',
          `Viewed students in collection: ${collectionName}`,
          { collectionName, studentCount: students.length }
        );
      }
    } catch (error) {
      console.error('Error loading collection students:', error);
      setError(`Failed to load students for ${collectionName}`);
    } finally {
      setStudentsLoading(false);
    }
  };

  // Quick collection name update (optimized)
  const handleQuickRename = async (department, newName) => {
    if (!userProfile || !newName.trim()) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await studentsService.updateCollectionName(
        department, 
        newName.trim(), 
        userProfile
      );

      // Log the admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin renamed collection: ${department} → ${newName.trim()}`,
        metadata: {
          action: 'rename_collection',
          oldDepartment: department,
          newDepartment: newName.trim()
        }
      });

      setSuccess(`Successfully renamed collection "${department}" to "${newName.trim()}"`);
      await loadCollectionsBasic(); // Refresh the basic list
      
    } catch (error) {
      setError(`Failed to rename collection: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Inline editing functions
  const startEditing = (department) => {
    setEditingCollection(department);
    setEditingName(department);
  };

  const cancelEditing = () => {
    setEditingCollection(null);
    setEditingName('');
  };

  const saveCollectionName = async () => {
    if (!editingCollection || !editingName.trim()) return;

    try {
      setSavingName(true);
      await handleQuickRename(editingCollection, editingName.trim());
      setEditingCollection(null);
      setEditingName('');
    } catch (error) {
      // Error is already handled in handleQuickRename
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!selectedCollection || !userProfile) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await studentsService.deleteCollection(
        selectedCollection, 
        userProfile, 
        deleteConfirmation
      );

      // Log the admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin deleted entire collection: ${selectedCollection} (${result.deletedStudents} students)`,
        metadata: {
          action: 'delete_collection',
          department: selectedCollection,
          deletedStudents: result.deletedStudents,
          severity: 'critical'
        }
      });

      setSuccess(`Successfully deleted collection "${selectedCollection}" with ${result.deletedStudents} students`);
      setShowDeleteModal(false);
      setDeleteConfirmation('');
      setSelectedCollection(null);
      setView('list');
      await loadCollectionsBasic();
      
    } catch (error) {
      setError(`Failed to delete collection: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameCollection = async () => {
    if (!selectedCollection || !newDepartmentName || !userProfile) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await studentsService.renameCollection(
        selectedCollection, 
        newDepartmentName, 
        userProfile
      );

      // Log the admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin renamed collection: ${selectedCollection} → ${newDepartmentName} (${result.studentsCount} students)`,
        metadata: {
          action: 'rename_collection',
          oldDepartment: selectedCollection,
          newDepartment: newDepartmentName,
          studentsCount: result.studentsCount
        }
      });

      setSuccess(`Successfully renamed collection "${selectedCollection}" to "${newDepartmentName}"`);
      setShowRenameModal(false);
      setNewDepartmentName('');
      setSelectedCollection(null);
      setView('list');
      await loadCollectionsBasic();
      
    } catch (error) {
      setError(`Failed to rename collection: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveCollection = async (department) => {
    if (!userProfile) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await studentsService.archiveCollection(department, userProfile);

      // Log the admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin archived collection: ${department} (${result.archivedStudents} students)`,
        metadata: {
          action: 'archive_collection',
          department: department,
          archivedStudents: result.archivedStudents
        }
      });

      setSuccess(`Successfully archived collection "${department}" with ${result.archivedStudents} students`);
      await loadCollectionsBasic();
      
    } catch (error) {
      setError(`Failed to archive collection: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreCollection = async (department) => {
    if (!userProfile) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await studentsService.restoreCollection(department, userProfile);

      // Log the admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin restored collection: ${department} (${result.restoredStudents} students)`,
        metadata: {
          action: 'restore_collection',
          department: department,
          restoredStudents: result.restoredStudents
        }
      });

      setSuccess(`Successfully restored collection "${department}" with ${result.restoredStudents} students`);
      await loadCollectionsBasic();
      
    } catch (error) {
      setError(`Failed to restore collection: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Bulk operations functions
  const handleSelectAllCollections = (checked) => {
    if (checked) {
      setSelectedCollections(new Set(filteredAndSortedCollections.map(c => c.department)));
    } else {
      setSelectedCollections(new Set());
    }
  };

  const handleSelectCollection = (department, checked) => {
    const newSelected = new Set(selectedCollections);
    if (checked) {
      newSelected.add(department);
    } else {
      newSelected.delete(department);
    }
    setSelectedCollections(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!userProfile || selectedCollections.size === 0) return;

    try {
      setBulkOperationInProgress(true);
      setError('');
      
      const departmentsArray = Array.from(selectedCollections);
      const result = await studentsService.deleteMultipleCollections(
        departmentsArray, 
        userProfile, 
        bulkDeleteConfirmation
      );

      // Log the bulk admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin bulk deleted ${result.successfulDeletions} collections (${result.totalStudentsDeleted} total students)`,
        metadata: {
          action: 'bulk_delete_collections',
          totalCollections: result.totalCollections,
          successfulDeletions: result.successfulDeletions,
          failedDeletions: result.failedDeletions,
          totalStudentsDeleted: result.totalStudentsDeleted,
          deletedCollections: result.deletedCollections.map(c => c.department),
          severity: 'critical'
        }
      });

      let message = `Bulk deletion completed: ${result.successfulDeletions}/${result.totalCollections} collections deleted`;
      if (result.totalStudentsDeleted > 0) {
        message += `, ${result.totalStudentsDeleted} total students removed`;
      }
      if (result.failedDeletions > 0) {
        message += `. ${result.failedDeletions} deletions failed.`;
      }

      setSuccess(message);
      setShowBulkDeleteModal(false);
      setBulkDeleteConfirmation('');
      setSelectedCollections(new Set());
      await loadCollectionsBasic();
      
    } catch (error) {
      setError(`Bulk deletion failed: ${error.message}`);
    } finally {
      setBulkOperationInProgress(false);
    }
  };

  const handleBulkArchive = async () => {
    if (!userProfile || selectedCollections.size === 0) return;

    try {
      setBulkOperationInProgress(true);
      setError('');
      
      const departmentsArray = Array.from(selectedCollections);
      const result = await studentsService.archiveMultipleCollections(departmentsArray, userProfile);

      // Log the bulk admin action
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userEmail: userProfile.email,
        type: ACTIVITY_LOG_TYPES.ADMIN_ACTION,
        description: `Admin bulk archived ${result.successfulArchives} collections (${result.totalStudentsArchived} total students)`,
        metadata: {
          action: 'bulk_archive_collections',
          totalCollections: result.totalCollections,
          successfulArchives: result.successfulArchives,
          failedArchives: result.failedArchives,
          totalStudentsArchived: result.totalStudentsArchived,
          archivedCollections: result.archivedCollections.map(c => c.department)
        }
      });

      let message = `Bulk archiving completed: ${result.successfulArchives}/${result.totalCollections} collections archived`;
      if (result.totalStudentsArchived > 0) {
        message += `, ${result.totalStudentsArchived} total students archived`;
      }
      if (result.failedArchives > 0) {
        message += `. ${result.failedArchives} archives failed.`;
      }

      setSuccess(message);
      setShowBulkArchiveModal(false);
      setSelectedCollections(new Set());
      await loadCollectionsBasic();
      
    } catch (error) {
      setError(`Bulk archiving failed: ${error.message}`);
    } finally {
      setBulkOperationInProgress(false);
    }
  };

  // Simple search filter
  const filteredAndSortedCollections = collections
    .filter(collection => {
      if (!searchTerm.trim()) return true;
      
      const query = searchTerm.toLowerCase();
      return (
        collection.department.toLowerCase().includes(query) ||
        collection.collectionName.toLowerCase().includes(query) ||
        (collection.departmentCode && collection.departmentCode.toLowerCase().includes(query)) ||
        (collection.createdBy && collection.createdBy.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  // Check if user is admin
  const isAdmin = userProfile && (userProfile.role === 'admin' || userProfile.role === 'super_admin');

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-red-600">
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p>You need admin privileges to access collection management.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Collection Management</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage student collections and departments</p>
        </div>
        
        {view !== 'list' && (
          <Button variant="outline" onClick={() => {setView('list'); setSelectedCollection(null); setCollectionDetails(null);}}>
            ← Back to Collections
          </Button>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-green-600 dark:text-green-400">{success}</div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSuccess('')} 
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Collections List View */}
      {view === 'list' && (
        <div className="space-y-4">
          {/* Search and Sort Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {/* Search and Sort Row */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search collections by name, department, or code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="department">Department</option>
                      <option value="totalStudents">Student Count</option>
                      <option value="createdAt">Created Date</option>
                      <option value="lastUpdated">Last Updated</option>
                    </select>
                    <Button
                      variant="outline"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </Button>
                  </div>
                </div>
                
                {/* Bulk Operations Row */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center border-t pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selectAll"
                      checked={selectedCollections.size === filteredAndSortedCollections.length && filteredAndSortedCollections.length > 0}
                      onChange={(e) => handleSelectAllCollections(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="selectAll" className="text-sm font-medium">
                      Select All ({selectedCollections.size} selected)
                    </label>
                  </div>
                  
                  {selectedCollections.size > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBulkArchiveModal(true)}
                        disabled={bulkOperationInProgress}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6 6-6" />
                        </svg>
                        Archive ({selectedCollections.size})
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteModal(true)}
                        disabled={bulkOperationInProgress}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete ({selectedCollections.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCollections(new Set())}
                        disabled={bulkOperationInProgress}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Collections Grid */}
          {loading ? (
            <div className="text-center py-8">Loading collections...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedCollections.map((collection) => (
                <Card key={collection.department} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCollections.has(collection.department)}
                        onChange={(e) => handleSelectCollection(collection.department, e.target.checked)}
                        className="w-4 h-4 mt-1 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <CardTitle className="flex justify-between items-start">
                          <div className="flex-1">
                            {editingCollection === collection.department ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none focus:border-blue-600"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') saveCollectionName();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={saveCollectionName}
                                    disabled={savingName || !editingName.trim()}
                                    className="h-6 w-6 p-0"
                                  >
                                    {savingName ? '...' : '✓'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    disabled={savingName}
                                    className="h-6 w-6 p-0"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <span className="text-lg">{collection.department}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditing(collection.department)}
                                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Edit collection name"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary">
                            {collection.totalStudents} students
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {collection.collectionName}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Active:</span>
                        <span className="text-green-600">{collection.activeStudents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inactive:</span>
                        <span className="text-red-600">{collection.inactiveStudents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Created by:</span>
                        <span>{collection.createdBy}</span>
                      </div>
                      {collection.departmentCode && (
                        <div className="flex justify-between">
                          <span>Code:</span>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {collection.departmentCode}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => loadCollectionDetails(collection.department)}
                        disabled={detailsLoading}
                        className="flex-1"
                      >
                        {detailsLoading && selectedCollection === collection.department ? (
                          <>
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                            Loading...
                          </>
                        ) : (
                          'View Details'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadCollectionStudents(collection.department)}
                        disabled={studentsLoading || !collection.hasStudents}
                        title={!collection.hasStudents ? 'No students in this collection' : ''}
                      >
                        {studentsLoading && selectedCollection === collection.department ? (
                          <>
                            <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                            Loading...
                          </>
                        ) : (
                          `Students (${collection.totalStudents})`
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedCollection(collection.department);
                          setShowDeleteModal(true);
                        }}
                        className="px-2"
                        title="Delete collection"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {collection.error && (
                      <div className="text-red-500 text-xs mt-2">
                        Error: {collection.error}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collection Details View */}
      {view === 'details' && collectionDetails && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{collectionDetails.department}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedCollection(collectionDetails.department);
                      setShowRenameModal(true);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleArchiveCollection(collectionDetails.department)}
                  >
                    Archive
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleRestoreCollection(collectionDetails.department)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedCollection(collectionDetails.department);
                      setShowDeleteModal(true);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Collection: {collectionDetails.collectionName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{collectionDetails.totalStudents}</div>
                  <div className="text-sm text-blue-800">Total Students</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{collectionDetails.activeStudents}</div>
                  <div className="text-sm text-green-800">Active Students</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{collectionDetails.inactiveStudents}</div>
                  <div className="text-sm text-red-800">Inactive Students</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{collectionDetails.recentStudents}</div>
                  <div className="text-sm text-yellow-800">Recent (30 days)</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Collection Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span>{formatDate(collectionDetails.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span>{formatDate(collectionDetails.lastUpdated)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created By:</span>
                      <span>{collectionDetails.createdBy}</span>
                    </div>
                    {collectionDetails.departmentCode && (
                      <div className="flex justify-between">
                        <span>Department Code:</span>
                        <span>{collectionDetails.departmentCode}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Data Quality</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Missing Data:</span>
                      <span className={collectionDetails.dataQuality.studentsWithMissingData > 0 ? 'text-red-600' : 'text-green-600'}>
                        {collectionDetails.dataQuality.studentsWithMissingData}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duplicate Admissions:</span>
                      <span className={collectionDetails.dataQuality.duplicateAdmissionNumbers.length > 0 ? 'text-red-600' : 'text-green-600'}>
                        {collectionDetails.dataQuality.duplicateAdmissionNumbers.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duplicate Roll Numbers:</span>
                      <span className={collectionDetails.dataQuality.duplicateRollNumbers.length > 0 ? 'text-red-600' : 'text-green-600'}>
                        {collectionDetails.dataQuality.duplicateRollNumbers.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invalid Roll Numbers:</span>
                      <span className={collectionDetails.dataQuality.invalidRollNumbers > 0 ? 'text-red-600' : 'text-green-600'}>
                        {collectionDetails.dataQuality.invalidRollNumbers}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => loadCollectionStudents(selectedCollection)}
                  disabled={studentsLoading}
                  className="w-full"
                >
                  {studentsLoading ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Loading Students...
                    </>
                  ) : (
                    `View All Students (${collectionDetails.totalStudents})`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Students List View */}
      {view === 'students' && collectionDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Students in {selectedCollection}</CardTitle>
            <CardDescription>
              {collectionStudents?.length || 0} students total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading students...
              </div>
            ) : collectionStudents && collectionStudents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Admission Number</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collectionStudents.map((student, index) => (
                    <TableRow key={student.id || index}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.rollNumber}</TableCell>
                      <TableCell>{student.admissionNumber}</TableCell>
                      <TableCell>{student.year || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={student.isActive === false ? 'secondary' : 'default'}>
                          {student.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(student.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No students found in this collection.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600 flex items-center gap-2">
              <AlertCircleIcon className="h-5 w-5" />
              Delete Collection
            </h3>
            <p className="mb-4">
              This will permanently delete the entire collection <strong>"{selectedCollection}"</strong> and all its students.
              This action cannot be undone.
            </p>
            <p className="mb-4 text-sm text-gray-600">
              To confirm, please type: <code className="bg-gray-100 px-2 py-1 rounded">DELETE-{selectedCollection?.toUpperCase()}</code>
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={`DELETE-${selectedCollection?.toUpperCase()}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteCollection}
                disabled={deleteConfirmation !== `DELETE-${selectedCollection?.toUpperCase()}` || loading}
                className="flex-1"
              >
                {loading ? 'Deleting...' : 'Delete Collection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Rename Collection</h3>
            <p className="mb-4">
              Rename collection <strong>"{selectedCollection}"</strong> to:
            </p>
            <input
              type="text"
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="New department name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRenameModal(false);
                  setNewDepartmentName('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenameCollection}
                disabled={!newDepartmentName.trim() || loading}
                className="flex-1"
              >
                {loading ? 'Renaming...' : 'Rename Collection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600 flex items-center gap-2">
              <AlertCircleIcon className="h-5 w-5" />
              Bulk Delete Collections
            </h3>
            <p className="mb-4">
              This will permanently delete <strong>{selectedCollections.size} collections</strong> and all their students.
              This action cannot be undone.
            </p>
            <div className="mb-4 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded border">
              <p className="text-sm font-medium mb-2">Collections to be deleted:</p>
              <ul className="text-sm space-y-1">
                {Array.from(selectedCollections).map(dept => (
                  <li key={dept} className="text-gray-700">• {dept}</li>
                ))}
              </ul>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              To confirm, please type: <code className="bg-gray-100 px-2 py-1 rounded">BULK-DELETE-{selectedCollections.size}-COLLECTIONS</code>
            </p>
            <input
              type="text"
              value={bulkDeleteConfirmation}
              onChange={(e) => setBulkDeleteConfirmation(e.target.value)}
              placeholder={`BULK-DELETE-${selectedCollections.size}-COLLECTIONS`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeleteConfirmation('');
                }}
                className="flex-1"
                disabled={bulkOperationInProgress}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={bulkDeleteConfirmation !== `BULK-DELETE-${selectedCollections.size}-COLLECTIONS` || bulkOperationInProgress}
                className="flex-1"
              >
                {bulkOperationInProgress ? 'Deleting...' : `Delete ${selectedCollections.size} Collections`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Archive Confirmation Modal */}
      {showBulkArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-yellow-600">📦 Bulk Archive Collections</h3>
            <p className="mb-4">
              This will archive <strong>{selectedCollections.size} collections</strong> and all their students.
              Archived collections can be restored later.
            </p>
            <div className="mb-4 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded border">
              <p className="text-sm font-medium mb-2">Collections to be archived:</p>
              <ul className="text-sm space-y-1">
                {Array.from(selectedCollections).map(dept => (
                  <li key={dept} className="text-gray-700">• {dept}</li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBulkArchiveModal(false)}
                className="flex-1"
                disabled={bulkOperationInProgress}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkArchive}
                disabled={bulkOperationInProgress}
                className="flex-1"
              >
                {bulkOperationInProgress ? 'Archiving...' : `Archive ${selectedCollections.size} Collections`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}