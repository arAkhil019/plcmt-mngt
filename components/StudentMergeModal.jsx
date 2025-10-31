// components/StudentMergeModal.jsx
import React, { useState } from 'react';

export default function StudentMergeModal({ isOpen, onClose, fileData, existingDepartments, onConfirmMerge, uiComponents }) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } = uiComponents;
  
  const [mergeStrategy, setMergeStrategy] = useState({});
  const [selectedDepartments, setSelectedDepartments] = useState({});

  if (!isOpen || !fileData) return null;

  // Get departments from Excel file
  const excelDepartments = Object.keys(fileData.departmentGroups || {});
  const totalDepartmentStudents = excelDepartments.reduce((sum, dept) => 
    sum + (fileData.departmentGroups[dept]?.length || 0), 0
  );
  
  // Create mapping of existing departments by name
  const existingDeptMap = existingDepartments.reduce((acc, dept) => {
    acc[dept.name] = dept;
    return acc;
  }, {});

  // Check if we have processing issues
  const hasProcessingIssues = excelDepartments.length === 0 && fileData.totalRows > 0;

  const handleMergeStrategyChange = (department, strategy) => {
    setMergeStrategy(prev => ({
      ...prev,
      [department]: strategy
    }));
  };

  const handleDepartmentSelection = (excelDept, existingDept) => {
    setSelectedDepartments(prev => ({
      ...prev,
      [excelDept]: existingDept
    }));
  };

  const handleConfirm = () => {
    const mergeConfig = {
      fileData,
      mergeStrategy,
      selectedDepartments
    };
    onConfirmMerge(mergeConfig);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Import & Merge Students
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Review departments and choose merge strategy for existing data
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* File Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Excel File Summary</CardTitle>
              <CardDescription>
                {hasProcessingIssues ? (
                  `Found ${fileData.totalRows} students in ${fileData.sheetNames?.length || 0} sheets, but could not auto-process departments. Please check column headers.`
                ) : (
                  `Found ${totalDepartmentStudents} valid students across ${excelDepartments.length} departments`
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasProcessingIssues ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="font-medium">Auto-processing failed</span>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                      Could not automatically identify required columns (Name, Roll Number, Admission Number) in the Excel sheets. 
                      Please ensure your Excel file has proper column headers or use the regular import for manual column mapping.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">Available Sheets:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {fileData.sheetNames?.map(sheetName => (
                        <div key={sheetName} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="font-medium text-gray-900 dark:text-white">{sheetName}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {fileData.sheets?.[sheetName]?.totalRows || 0} rows
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {excelDepartments.map(dept => (
                    <div key={dept} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="font-medium text-gray-900 dark:text-white">{dept}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {fileData.departmentGroups[dept]?.length || 0} students
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Mapping & Merge Strategy */}
          {!hasProcessingIssues && excelDepartments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Department Merge Configuration</CardTitle>
                <CardDescription>
                  Configure how to handle each department from the Excel file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {excelDepartments.map(excelDept => {
                    const existingDept = existingDeptMap[excelDept];
                    const studentCount = fileData.departmentGroups[excelDept]?.length || 0;
                    
                    return (
                      <div key={excelDept} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">{excelDept}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {studentCount} students in Excel file
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {existingDept ? (
                              <Badge variant="secondary">
                                Exists ({existingDept.totalStudents} students)
                              </Badge>
                            ) : (
                              <Badge variant="outline">New Department</Badge>
                            )}
                          </div>
                        </div>

                        {existingDept ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Merge Strategy:
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`strategy-${excelDept}`}
                                    value="merge"
                                    checked={mergeStrategy[excelDept] === 'merge'}
                                    onChange={() => handleMergeStrategyChange(excelDept, 'merge')}
                                    className="text-blue-600"
                                  />
                                  <span className="text-sm">Merge & Update</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`strategy-${excelDept}`}
                                    value="skip"
                                    checked={mergeStrategy[excelDept] === 'skip'}
                                    onChange={() => handleMergeStrategyChange(excelDept, 'skip')}
                                    className="text-blue-600"
                                  />
                                  <span className="text-sm">Skip Duplicates</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name={`strategy-${excelDept}`}
                                    value="replace"
                                    checked={mergeStrategy[excelDept] === 'replace'}
                                    onChange={() => handleMergeStrategyChange(excelDept, 'replace')}
                                    className="text-blue-600"
                                  />
                                  <span className="text-sm">Replace Existing</span>
                                </label>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              <p><strong>Merge & Update:</strong> Add new students, update existing ones with Excel data</p>
                              <p><strong>Skip Duplicates:</strong> Only add students that don't exist (by admission/roll number)</p>
                              <p><strong>Replace Existing:</strong> Remove all existing students and add Excel students</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            This department will be created as new with all {studentCount} students.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          {hasProcessingIssues ? (
            <Button disabled variant="outline">
              Cannot Import - Column Issues
            </Button>
          ) : (
            <Button 
              onClick={handleConfirm}
              disabled={excelDepartments.length === 0 || excelDepartments.some(dept => 
                existingDeptMap[dept] && !mergeStrategy[dept]
              )}
            >
              Start Import & Merge
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}