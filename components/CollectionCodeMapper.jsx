// components/CollectionCodeMapper.jsx
import React, { useState, useEffect } from 'react';
import { studentsService } from '../lib/studentsService';
import { useAuth } from '../contexts/AuthContext';
import { activityLogsService, ACTIVITY_LOG_TYPES } from '../lib/activityLogsService';
import { EditIcon, TrashIcon, CheckIcon, XIcon, PlusIcon, SaveIcon } from './icons';

export default function CollectionCodeMapper({ uiComponents }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = uiComponents;
  const { userProfile } = useAuth();
  
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingCollection, setEditingCollection] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
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

  const startEditing = (collectionName, currentCode) => {
    setEditingCollection(collectionName);
    setNewCode(currentCode || '');
  };

  const cancelEditing = () => {
    setEditingCollection(null);
    setNewCode('');
  };

  const saveCode = async (collectionName) => {
    if (!newCode.trim()) {
      setError('Department code cannot be empty');
      return;
    }

    // Check for duplicate codes
    const existingCollection = collections.find(
      col => col.departmentCode?.toUpperCase() === newCode.toUpperCase() && 
      col.department !== collectionName
    );

    if (existingCollection) {
      setError(`Code "${newCode}" is already used by "${existingCollection.department}"`);
      return;
    }

    try {
      setSaving(true);
      setError('');

      await studentsService.updateCollectionDepartmentCode(collectionName, newCode.trim().toUpperCase());

      // Update local state
      setCollections(collections.map(col => 
        col.department === collectionName 
          ? { ...col, departmentCode: newCode.trim().toUpperCase() }
          : col
      ));

      setEditingCollection(null);
      setNewCode('');
      setHasChanges(true);
      setSuccess(`Updated department code for "${collectionName}"`);

      // Log activity
      if (userProfile) {
        await activityLogsService.logActivity(
          userProfile.id,
          userProfile.name,
          userProfile.email,
          ACTIVITY_LOG_TYPES.UPDATE,
          `Updated department code for collection "${collectionName}" to "${newCode.trim().toUpperCase()}"`
        );
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      setError(`Failed to update department code: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removeCode = async (collectionName) => {
    try {
      setSaving(true);
      setError('');

      await studentsService.updateCollectionDepartmentCode(collectionName, null);

      // Update local state
      setCollections(collections.map(col => 
        col.department === collectionName 
          ? { ...col, departmentCode: null }
          : col
      ));

      setHasChanges(true);
      setSuccess(`Removed department code from "${collectionName}"`);

      // Log activity
      if (userProfile) {
        await activityLogsService.logActivity(
          userProfile.id,
          userProfile.name,
          userProfile.email,
          ACTIVITY_LOG_TYPES.UPDATE,
          `Removed department code from collection "${collectionName}"`
        );
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      setError(`Failed to remove department code: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e, collectionName) => {
    if (e.key === 'Enter') {
      saveCode(collectionName);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const getUnmappedCollections = () => {
    return collections.filter(col => !col.departmentCode);
  };

  const getMappedCollections = () => {
    return collections.filter(col => col.departmentCode);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold mb-2">Collection Code Mapping</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Map department collections to short codes for easier identification and search.
        </p>
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
        </div>
      )}

      {/* Statistics */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{collections.length}</div>
              <div className="text-sm text-gray-500">Total Collections</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{getMappedCollections().length}</div>
              <div className="text-sm text-gray-500">Mapped with Codes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{getUnmappedCollections().length}</div>
              <div className="text-sm text-gray-500">Need Mapping</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Collections Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Code Mapping</CardTitle>
          <CardDescription>
            Assign short codes to department collections for easier reference
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading collections...</div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No collections found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection Name</TableHead>
                  <TableHead>Department Code</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow key={collection.department}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{collection.department}</div>
                        <div className="text-sm text-gray-500">{collection.collectionName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingCollection === collection.department ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newCode}
                            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => handleKeyPress(e, collection.department)}
                            placeholder="e.g., CS, ECE, ME"
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            maxLength={10}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {collection.departmentCode ? (
                            <Badge variant="outline" className="font-mono">
                              {collection.departmentCode}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 italic">Not set</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {collection.totalStudents} students
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {collection.departmentCode ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Mapped
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-300 text-orange-600">
                          Unmapped
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingCollection === collection.department ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveCode(collection.department)}
                              disabled={saving || !newCode.trim()}
                              className="h-8 w-8 p-0"
                              title="Save"
                            >
                              {saving ? (
                                <div className="w-4 h-4 border border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <CheckIcon className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={saving}
                              className="h-8 w-8 p-0"
                              title="Cancel"
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(collection.department, collection.departmentCode)}
                              className="h-8 w-8 p-0"
                              title="Edit code"
                            >
                              <EditIcon className="h-4 w-4" />
                            </Button>
                            {collection.departmentCode && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeCode(collection.department)}
                                disabled={saving}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                title="Remove code"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {!loading && getUnmappedCollections().length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Commonly used department codes for quick assignment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Common Engineering Codes:</h4>
                <div className="flex flex-wrap gap-2">
                  {['CS', 'ECE', 'ME', 'CE', 'EE', 'IT', 'CSE', 'EEE', 'MECH', 'CIVIL'].map(code => (
                    <Badge
                      key={code}
                      variant="outline"
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => {
                        if (editingCollection) {
                          setNewCode(code);
                        }
                      }}
                    >
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Click on a code while editing to use it, or create your own custom codes.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}