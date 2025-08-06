// components/StudentImportModal.jsx
import React, { useState, useEffect } from 'react';
import { GraduationCapIcon } from './icons';

export default function StudentImportModal({ 
  isOpen, 
  onClose, 
  fileData, 
  onConfirmImport,
  uiComponents 
}) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = uiComponents;
  
  const [currentStep, setCurrentStep] = useState(1); // 1: Sheet mapping, 2: Preview & Import
  const [sheetMappings, setSheetMappings] = useState({});
  const [previewData, setPreviewData] = useState({});
  const [importing, setImporting] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if (isOpen && fileData) {
      // Initialize mappings for each sheet
      const initialSheetMappings = {};
      
      fileData.sheetNames.forEach(sheetName => {
        initialSheetMappings[sheetName] = {
          nameColumn: null,
          rollColumn: null,
          admissionColumn: null,
          yearColumn: null
        };
      });
      
      setSheetMappings(initialSheetMappings);
      setCurrentStep(1);
      setPreviewData({});
      setTotalStudents(0);
    }
  }, [isOpen, fileData]);

  const handleColumnMapping = (sheetName, field, columnIndex) => {
    setSheetMappings(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        [field]: columnIndex
      }
    }));
  };

  const generatePreview = () => {
    const preview = {};
    let total = 0;
    
    fileData.sheetNames.forEach(sheetName => {
      const sheetData = fileData.sheets[sheetName];
      const mapping = sheetMappings[sheetName];
      
      if (mapping.nameColumn !== null && mapping.rollColumn !== null && mapping.admissionColumn !== null) {
        // Use the ExcelProcessor method to process with mapping
        const result = window.ExcelProcessor?.processSheetWithMapping?.(sheetData, mapping) || {
          students: [],
          errors: ['ExcelProcessor not available'],
          skippedRows: 0
        };
        
        preview[sheetName] = {
          department: sheetName, // Use sheet name as department name
          students: result.students.slice(0, 5), // Preview first 5 students
          totalStudents: result.students.length,
          errors: result.errors,
          skippedRows: result.skippedRows
        };
        
        total += result.students.length;
      }
    });
    
    setPreviewData(preview);
    setTotalStudents(total);
    setCurrentStep(2);
  };

  const handleImport = async () => {
    setImporting(true);
    
    try {
      const importData = {};
      
      for (const sheetName of fileData.sheetNames) {
        const sheetData = fileData.sheets[sheetName];
        const mapping = sheetMappings[sheetName];
        
        if (mapping.nameColumn !== null && mapping.rollColumn !== null && mapping.admissionColumn !== null) {
          // Process full sheet data
          const result = window.ExcelProcessor?.processSheetWithMapping?.(sheetData, mapping) || {
            students: [],
            errors: ['ExcelProcessor not available'],
            skippedRows: 0
          };
          
          if (result.students.length > 0) {
            // Use sheet name as department name
            const departmentName = sheetName;
            if (!importData[departmentName]) {
              importData[departmentName] = [];
            }
            importData[departmentName].push(...result.students);
          }
        }
      }
      
      await onConfirmImport(importData);
      onClose();
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      return fileData.sheetNames.some(sheetName => {
        const mapping = sheetMappings[sheetName];
        return mapping?.nameColumn !== null && mapping?.rollColumn !== null && mapping?.admissionColumn !== null;
      });
    }
    return totalStudents > 0;
  };

  if (!isOpen || !fileData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-950 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Import Students - Step {currentStep} of 2</span>
              <Button variant="outline" onClick={onClose} size="sm">✕</Button>
            </CardTitle>
            <CardDescription>
              {currentStep === 1 ? 
                'Map columns for each sheet' : 
                'Review and Import'
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 1: Column Mapping */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                  <p><strong>Instructions:</strong></p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <li>Select the correct column for each required field (Name, Roll Number, Admission Number)</li>
                    <li>Department name will be automatically set to the sheet name</li>
                    <li>Year column is optional</li>
                    <li>At least one sheet must have all required mappings</li>
                  </ul>
                </div>

                {fileData.sheetNames.map(sheetName => {
                  const sheet = fileData.sheets[sheetName];
                  const mapping = sheetMappings[sheetName];

                  return (
                    <Card key={sheetName} className="border border-gray-200 dark:border-gray-800">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span>Sheet: {sheetName}</span>
                          <Badge variant="secondary">{sheet.totalRows} rows</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Sheet will be used as department name: {sheetName} */}
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                            <GraduationCapIcon className="h-4 w-4 mr-2" />
                            Department: <strong className="ml-1">{sheetName}</strong>
                          </p>
                        </div>

                        {/* Column Mapping */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-red-600">Name *</label>
                            <select
                              value={mapping?.nameColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'nameColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>{header || `Column ${index + 1}`}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2 text-red-600">Roll Number *</label>
                            <select
                              value={mapping?.rollColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'rollColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>{header || `Column ${index + 1}`}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2 text-red-600">Admission Number *</label>
                            <select
                              value={mapping?.admissionColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'admissionColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>{header || `Column ${index + 1}`}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Year</label>
                            <select
                              value={mapping?.yearColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'yearColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column (Optional)</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>{header || `Column ${index + 1}`}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Preview first few rows */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">Data Preview:</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {sheet.headers.map((header, index) => (
                                  <TableHead key={index} className="text-xs">
                                    {header || `Col ${index + 1}`}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sheet.rows.slice(0, 3).map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                  {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex} className="text-xs max-w-20 truncate">
                                      {cell?.toString() || ''}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Step 2: Preview */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{totalStudents}</div>
                      <p className="text-sm text-gray-500">Total Students</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{Object.keys(previewData).length}</div>
                      <p className="text-sm text-gray-500">Sheets to Import</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{new Set(Object.values(previewData).map(d => d.department)).size}</div>
                      <p className="text-sm text-gray-500">Departments</p>
                    </CardContent>
                  </Card>
                </div>

                {Object.entries(previewData).map(([sheetName, data]) => (
                  <Card key={sheetName}>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center">
                        <span>{sheetName} → {data.department}</span>
                        <Badge variant="secondary">{data.totalStudents} students</Badge>
                      </CardTitle>
                      {data.errors.length > 0 && (
                        <CardDescription className="text-red-600">
                          {data.errors.length} warnings (will skip {data.skippedRows} rows)
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Roll Number</TableHead>
                            <TableHead>Admission Number</TableHead>
                            <TableHead>Year</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.students.map((student, index) => (
                            <TableRow key={index}>
                              <TableCell>{student.name}</TableCell>
                              <TableCell>{student.rollNumber}</TableCell>
                              <TableCell>{student.admissionNumber}</TableCell>
                              <TableCell>{student.year || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                          {data.totalStudents > 5 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-gray-500">
                                ... and {data.totalStudents - 5} more students
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              {currentStep === 2 && (
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  ← Back to Mapping
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              {currentStep === 1 ? (
                <Button 
                  onClick={generatePreview}
                  disabled={!isStepValid()}
                >
                  Preview Import →
                </Button>
              ) : (
                <Button 
                  onClick={handleImport}
                  disabled={!isStepValid() || importing}
                >
                  {importing ? 'Importing...' : `Confirm Import (${totalStudents} students)`}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
