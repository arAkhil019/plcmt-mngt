// components/StudentManagement.jsx
import React, { useState, useEffect } from 'react';
import { studentsService } from '../lib/studentsService';
import { ExcelProcessor } from '../lib/excelProcessor';
import { useAuth } from '../contexts/AuthContext';
import { activityLogsService, ACTIVITY_LOG_TYPES } from '../lib/activityLogsService';
import StudentImportModal from './StudentImportModal';
import * as XLSX from 'xlsx';

export default function StudentManagement({ uiComponents }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = uiComponents;
  const { userProfile } = useAuth();
  
  const [currentView, setCurrentView] = useState('overview'); // overview, department, import
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentStats, setStudentStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Import states
  const [importFile, setImportFile] = useState(null);
  const [importFileData, setImportFileData] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Use optimized overview function that loads all data from stats collection
      console.log('Loading overview data from stats collection...');
      const overviewData = await studentsService.getDepartmentsOverview();
      console.log('Overview data received:', overviewData);
      
      setDepartments(overviewData.departments);
      setStudentStats({
        totalStudents: overviewData.summary.totalStudents,
        totalDepartments: overviewData.summary.totalDepartments,
        departmentCounts: overviewData.departments.reduce((acc, dept) => {
          acc[dept.name] = dept.totalStudents;
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentStudents = async (departmentName) => {
    try {
      setLoading(true);
      const departmentStudents = await studentsService.getStudentsByDepartment(departmentName);
      setStudents(departmentStudents);
      setSelectedDepartment(departmentName);
      setCurrentView('department');
    } catch (error) {
      setError(`Failed to load students: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await ExcelProcessor.processStudentExcel(file);
      setImportFile(file);
      setImportFileData(result);
      
      // Make ExcelProcessor available globally for the modal
      window.ExcelProcessor = ExcelProcessor;
      
      setShowImportModal(true);
      
      if (result.errors.length > 0) {
        setError(`File processed with warnings: ${result.errors.join(', ')}`);
      } else {
        setSuccess(`File processed successfully! Found ${result.totalRows} total rows across ${result.sheetNames.length} sheets.`);
      }
    } catch (error) {
      setError(`Failed to process file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportConfirm = async (departmentData) => {
    if (!userProfile) return;

    try {
      setImporting(true);
      setError('');
      
      const results = [];
      
      for (const [department, students] of Object.entries(departmentData)) {
        try {
          const importedStudents = await studentsService.bulkImportStudents(
            students, 
            department, 
            userProfile
          );
          results.push(`${department}: ${importedStudents.length} students imported`);
          
          // Log the import activity
          await activityLogsService.logActivity({
            userId: userProfile.id,
            userName: userProfile.name,
            userEmail: userProfile.email,
            action: ACTIVITY_LOG_TYPES.BULK_IMPORT_STUDENTS,
            description: `Imported ${importedStudents.length} students to ${department}`,
            metadata: {
              department,
              studentCount: importedStudents.length,
              fileName: importFile?.name
            }
          });
        } catch (error) {
          results.push(`${department}: Failed - ${error.message}`);
        }
      }
      
      setSuccess(`Import completed! ${results.join('; ')}`);
      
      // Refresh data
      await loadInitialData();
      
      // Clear import state
      setImportFile(null);
      setImportFileData(null);
      setShowImportModal(false);
      
    } catch (error) {
      setError(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setStudents([]);
      return;
    }

    try {
      setLoading(true);
      const searchResults = await studentsService.searchStudents(searchTerm);
      setStudents(searchResults);
      setCurrentView('department');
      setSelectedDepartment('Search Results');
    } catch (error) {
      setError(`Search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDepartment = async (department) => {
    try {
      const departmentStudents = await studentsService.getStudentsByDepartment(department);
      const exportData = { [department]: departmentStudents };
      const workbook = ExcelProcessor.exportStudentsToExcel(exportData);
      
      XLSX.writeFile(workbook, `${department}_students.xlsx`);
      setSuccess(`Exported ${departmentStudents.length} students from ${department}`);
    } catch (error) {
      setError(`Export failed: ${error.message}`);
    }
  };

  const handleClearDepartment = async (department) => {
    if (!confirm(`Are you sure you want to clear all students from ${department}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await studentsService.clearDepartmentStudents(department, userProfile);
      
      await activityLogsService.logActivity({
        userId: userProfile.id,
        userName: userProfile.name,
        userEmail: userProfile.email,
        action: ACTIVITY_LOG_TYPES.CLEAR_DEPARTMENT_STUDENTS,
        description: `Cleared all students from ${department}`,
        metadata: { department }
      });
      
      setSuccess(`Cleared all students from ${department}`);
      await loadInitialData();
    } catch (error) {
      setError(`Failed to clear department: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const workbook = ExcelProcessor.generateTemplateExcel();
    XLSX.writeFile(workbook, 'student_import_template.xlsx');
    setSuccess('Template downloaded successfully!');
  };

  const calculateAndPopulateStats = async () => {
    if (!userProfile) {
      setError('User profile not available');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Use the comprehensive stats calculation function
      const result = await studentsService.calculateAndPopulateAllStats(userProfile);
      console.log('Complete stats calculation result:', result);

      // Reload the initial data to show updated stats
      await loadInitialData();

      setSuccess(
        `Stats calculation completed successfully! ` +
        `Synced ${result.syncedDepartments} departments, ` +
        `refreshed ${result.refreshedDepartments} department stats. ` +
        `Total: ${result.summary.totalStudents} students across ${result.summary.totalDepartments} departments ` +
        `(${result.summary.activeStudents} active, ${result.summary.inactiveStudents} inactive).`
      );
    } catch (error) {
      console.error('Error calculating stats:', error);
      setError(`Failed to calculate stats: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && currentView === 'overview') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p>Loading student data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Database Management</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage student records across all departments
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </Button>
          <Button onClick={calculateAndPopulateStats} variant="outline" disabled={loading}>
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Calculate Stats
          </Button>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-upload"
          />
          <Button 
            onClick={() => document.getElementById('excel-upload').click()}
            disabled={loading}
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import Excel
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
          {success}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <Button
          variant={currentView === 'overview' ? 'default' : 'outline'}
          onClick={() => setCurrentView('overview')}
        >
          Overview
        </Button>
        {currentView === 'department' && (
          <Button
            variant="outline"
            onClick={() => setCurrentView('overview')}
          >
            ← Back to Overview
          </Button>
        )}
      </div>

      {/* Overview View */}
      {currentView === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{studentStats.totalStudents || 0}</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Students</p>
                  </div>
                  <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{departments.length || 0}</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Departments</p>
                  </div>
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {departments.reduce((total, dept) => total + dept.activeStudents, 0)}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Students</p>
                  </div>
                  <div className="h-8 w-8 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search students by name, roll number, or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={!searchTerm.trim()}>
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Department Collections Grid */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Department Collections</h2>
              <Badge variant="secondary">{departments.length} collections</Badge>
            </div>
            
            {departments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-gray-500 dark:text-gray-400 mb-4">
                    <p className="text-lg mb-2">No department collections found</p>
                    <p className="text-sm">Import Excel files to create department collections automatically</p>
                  </div>
                  <Button 
                    onClick={() => document.getElementById('excel-upload').click()}
                    className="mt-4"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Import Your First Excel File
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.map((dept) => (
                  <Card key={dept.name} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="truncate mr-2">{dept.name}</span>
                        <Badge variant="success">{dept.totalStudents}</Badge>
                      </CardTitle>
                      <CardDescription>
                        Collection: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">{dept.collectionName}</code>
                      </CardDescription>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Total Students: {dept.totalStudents}
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Active Students: {dept.activeStudents}
                        </div>
                        {dept.inactiveStudents > 0 && (
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
                            </svg>
                            Inactive Students: {dept.inactiveStudents}
                          </div>
                        )}
                        {dept.lastUpdated && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Updated: {new Date(dept.lastUpdated).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardFooter className="flex gap-2">
                      <Button 
                        onClick={() => loadDepartmentStudents(dept.name)}
                        className="flex-1"
                        variant="default"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        View Students
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Department View */}
      {currentView === 'department' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{selectedDepartment}</h2>
            <Badge variant="secondary">{students.length} students</Badge>
          </div>

          {students.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Admission Number</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.rollNumber}</TableCell>
                      <TableCell>{student.admissionNumber}</TableCell>
                      <TableCell>{student.year || 'N/A'}</TableCell>
                      <TableCell>{student.department}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-500 dark:text-gray-400">
                  <p className="text-lg mb-2">No students found</p>
                  <p className="text-sm">
                    {selectedDepartment === 'Search Results' 
                      ? 'Try a different search term'
                      : 'Import students using the Excel upload feature'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Student Import Modal */}
      <StudentImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportFileData(null);
        }}
        fileData={importFileData}
        onConfirmImport={handleImportConfirm}
        uiComponents={uiComponents}
      />
    </div>
  );
}
