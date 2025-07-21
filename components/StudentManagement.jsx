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
      const overviewData = await studentsService.getDepartmentsOverview();
      
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Loading student data...
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we fetch your department information
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-start gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Student Database Management
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Manage student records across all departments with comprehensive tools
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={downloadTemplate} variant="outline" className="px-4 py-2.5">
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template
          </Button>
          <Button onClick={calculateAndPopulateStats} variant="outline" disabled={loading} className="px-4 py-2.5">
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
            className="px-4 py-2.5"
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
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <Button
          variant={currentView === 'overview' ? 'default' : 'outline'}
          onClick={() => setCurrentView('overview')}
          className="px-6 py-2.5 font-medium"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Overview
        </Button>
        {currentView === 'department' && (
          <Button
            variant="outline"
            onClick={() => setCurrentView('overview')}
            className="px-6 py-2.5 font-medium"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Overview
          </Button>
        )}
      </div>

      {/* Overview View */}
      {currentView === 'overview' && (
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-lg border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {studentStats.totalStudents || 0}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Total Students
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {departments.length || 0}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Active Departments
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {departments.reduce((total, dept) => total + dept.activeStudents, 0)}
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Active Students
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                    <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="shadow-lg border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                Search Students
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Find students by name, roll number, or admission number across all departments
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Search students by name, roll number, or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  onClick={handleSearch} 
                  disabled={!searchTerm.trim()}
                  className="px-6 py-3"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Department Collections Grid */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Department Collections
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Overview of all department student collections
                </p>
              </div>
              <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
                {departments.length} collections
              </Badge>
            </div>
            
            {departments.length === 0 ? (
              <Card className="shadow-lg border-gray-200 dark:border-gray-700">
                <CardContent className="p-12 text-center">
                  <div className="space-y-4">
                    <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                      <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-medium text-gray-900 dark:text-white">
                        No department collections found
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        Import Excel files to create department collections automatically and start managing student data
                      </p>
                    </div>
                    <Button 
                      onClick={() => document.getElementById('excel-upload').click()}
                      className="mt-6 px-6 py-3"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      Import Your First Excel File
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.map((dept) => (
                  <Card key={dept.name} className="hover:shadow-xl transition-all duration-200 border-gray-200 dark:border-gray-700 group">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg flex items-center justify-between text-gray-900 dark:text-white">
                        <span className="truncate mr-2 font-semibold">{dept.name}</span>
                        <Badge variant="success" className="font-medium">{dept.totalStudents}</Badge>
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Collection: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">{dept.collectionName}</code>
                      </CardDescription>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span className="font-medium">Total Students: {dept.totalStudents}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Active Students: {dept.activeStudents}</span>
                        </div>
                        {dept.inactiveStudents > 0 && (
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
                            </svg>
                            <span className="font-medium">Inactive Students: {dept.inactiveStudents}</span>
                          </div>
                        )}
                        {dept.lastUpdated && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 pt-1">
                            <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Last updated: {new Date(dept.lastUpdated).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardFooter className="pt-4">
                      <Button 
                        onClick={() => loadDepartmentStudents(dept.name)}
                        className="w-full group-hover:bg-blue-600 transition-colors"
                        variant="default"
                      >
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        View Students ({dept.totalStudents})
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
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedDepartment}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Student records for this department
              </p>
            </div>
            <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
              {students.length} students
            </Badge>
          </div>

          {students.length > 0 ? (
            <Card className="shadow-lg border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Student Records
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Complete list of students in {selectedDepartment}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200 dark:border-gray-700">
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Name
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Roll Number
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Admission Number
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Year
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-gray-300 py-4 px-6">
                          Department
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id} className="border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <TableCell className="font-medium text-gray-900 dark:text-white py-4 px-6">
                            {student.name}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6 font-mono">
                            {student.rollNumber}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6 font-mono">
                            {student.admissionNumber}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6">
                            {student.year || 'N/A'}
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400 py-4 px-6">
                            {student.department}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-lg border-gray-200 dark:border-gray-700">
              <CardContent className="p-12 text-center">
                <div className="space-y-4">
                  <div className="h-16 w-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-medium text-gray-900 dark:text-white">
                      No students found
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {selectedDepartment === 'Search Results' 
                        ? 'Try a different search term or check your spelling'
                        : 'Import students using the Excel upload feature to populate this department'
                      }
                    </p>
                  </div>
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
