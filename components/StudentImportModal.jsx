// components/StudentImportModal.jsx
import React, { useState, useEffect } from 'react';
import { GraduationCapIcon } from './icons';
import { studentsService } from '../lib/studentsService';

export default function StudentImportModal({ 
  isOpen, 
  onClose, 
  fileData, 
  onConfirmImport,
  uiComponents 
}) {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = uiComponents;
  
  const [currentStep, setCurrentStep] = useState(1); // 1: Sheet mapping, 2: Department comparison selection, 3: Preview & Import
  const [sheetMappings, setSheetMappings] = useState({});
  const [previewData, setPreviewData] = useState({});
  const [importing, setImporting] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  
  // New state for department comparison
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [comparisonSettings, setComparisonSettings] = useState({});
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  useEffect(() => {
    if (isOpen && fileData) {
      // Initialize mappings for each sheet with auto-detected values
      const initialSheetMappings = {};
      const initialComparisonSettings = {};
      
      fileData.sheetNames.forEach(sheetName => {
        const sheetData = fileData.sheets[sheetName];
        
        // Use auto-detected mapping as initial values
        initialSheetMappings[sheetName] = {
          nameColumn: sheetData.autoMapping?.name ?? null,
          rollColumn: sheetData.autoMapping?.rollNumber ?? null,
          admissionColumn: sheetData.autoMapping?.admissionNumber ?? null,
          // Removed yearColumn
          departmentName: sheetData.departmentName || sheetName // Allow editing collection name
        };
        
        // Initialize comparison settings for each sheet
        initialComparisonSettings[sheetName] = {
          enableComparison: true,
          referenceCollections: [],
          addMissingStudents: true
        };
      });
      
      setSheetMappings(initialSheetMappings);
      setComparisonSettings(initialComparisonSettings);
      setCurrentStep(1);
      setPreviewData({});
      setTotalStudents(0);
      
      // Load available departments for comparison
      loadAvailableDepartments();
    }
  }, [isOpen, fileData]);

  const loadAvailableDepartments = async () => {
    try {
      setLoadingDepartments(true);
      const departments = await studentsService.getAllDepartments();
      const departmentStats = await Promise.all(
        departments.map(async (dept) => {
          try {
            const students = await studentsService.getStudentsByDepartment(dept);
            return {
              name: dept,
              studentCount: students.length,
              collectionName: studentsService.getDepartmentCollectionName(dept)
            };
          } catch (error) {
            return {
              name: dept,
              studentCount: 0,
              collectionName: studentsService.getDepartmentCollectionName(dept)
            };
          }
        })
      );
      setAvailableDepartments(departmentStats.filter(dept => dept.studentCount > 0));
    } catch (error) {
      console.error('Error loading departments:', error);
      setAvailableDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleColumnMapping = (sheetName, field, columnIndex) => {
    setSheetMappings(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        [field]: columnIndex
      }
    }));
  };

  const handleDepartmentNameChange = (sheetName, newName) => {
    setSheetMappings(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        departmentName: newName.trim()
      }
    }));
  };

  const handleComparisonSettingChange = (sheetName, setting, value) => {
    setComparisonSettings(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        [setting]: value
      }
    }));
  };

  const handleReferenceCollectionToggle = (sheetName, departmentName) => {
    setComparisonSettings(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        referenceCollections: prev[sheetName].referenceCollections.includes(departmentName)
          ? prev[sheetName].referenceCollections.filter(d => d !== departmentName)
          : [...prev[sheetName].referenceCollections, departmentName]
      }
    }));
  };

  const proceedToComparisonStep = () => {
    setCurrentStep(2);
  };

  const proceedToPreview = async () => {
    // Generate preview data with mapped columns
    const preview = {};
    let total = 0;

    fileData.sheetNames.forEach(sheetName => {
      const mapping = sheetMappings[sheetName];
      if (mapping.nameColumn !== null && mapping.rollColumn !== null && mapping.admissionColumn !== null) {
        const sheetData = fileData.sheets[sheetName];
        
        // Use ExcelProcessor to process the sheet with mapping
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
          skippedRows: result.skippedRows,
          comparisonSettings: comparisonSettings[sheetName]
        };
        
        total += result.students.length;
      }
    });
    
    setPreviewData(preview);
    setTotalStudents(total);
    setCurrentStep(3);
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
          department: mapping.departmentName || sheetName, // Use custom department name
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
      const importSettings = {};
      
      for (const sheetName of fileData.sheetNames) {
        const sheetData = fileData.sheets[sheetName];
        const mapping = sheetMappings[sheetName];
        const comparison = comparisonSettings[sheetName];
        
        if (mapping.nameColumn !== null && mapping.rollColumn !== null && mapping.admissionColumn !== null) {
          // Process full sheet data
          const result = window.ExcelProcessor?.processSheetWithMapping?.(sheetData, mapping) || {
            students: [],
            errors: ['ExcelProcessor not available'],
            skippedRows: 0
          };
          
          if (result.students.length > 0) {
            // Use custom department name (or sheet name as fallback)
            const departmentName = mapping.departmentName || sheetName;
            if (!importData[departmentName]) {
              importData[departmentName] = [];
            }
            importData[departmentName].push(...result.students);
            
            // Store comparison settings for this department
            importSettings[departmentName] = {
              enableComparison: comparison.enableComparison,
              referenceCollections: comparison.referenceCollections,
              addMissingStudents: comparison.addMissingStudents
            };
          }
        }
      }
      
      // Pass both import data and settings to the parent
      await onConfirmImport(importData, importSettings);
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
    } else if (currentStep === 2) {
      // Step 2 is always valid - comparison settings are optional
      return true;
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
              <span>Import Students - Step {currentStep} of 3</span>
              <Button variant="outline" onClick={onClose} size="sm">✕</Button>
            </CardTitle>
            <CardDescription>
              {currentStep === 1 ? 
                'Map columns for each sheet' : 
                currentStep === 2 ?
                'Configure department comparison settings' :
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
                    <li>Auto-detected column mappings are shown with ✓ (you can verify and change if needed)</li>
                    <li>Edit the collection name if you want to use a different name than the sheet name</li>
                    <li>All three fields (Name, Roll Number, Admission Number) are required</li>
                    <li>At least one sheet must have all required mappings to proceed</li>
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
                        {/* Collection Name Input */}
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                          <label className="block text-sm font-medium mb-2 text-blue-700 dark:text-blue-300">
                            Collection Name
                          </label>
                          <input
                            type="text"
                            value={mapping?.departmentName || ''}
                            onChange={(e) => handleDepartmentNameChange(sheetName, e.target.value)}
                            placeholder={`Enter collection name (default: ${sheetName})`}
                            className="w-full px-3 py-2 border border-blue-200 rounded-md bg-white dark:bg-gray-950"
                          />
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            This will be the department/collection name in the database
                          </p>
                        </div>

                        {/* Column Mapping with Auto-Detection */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Name Column */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-red-600">Name *</label>
                            <select
                              value={mapping?.nameColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'nameColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>
                                  {header || `Column ${index + 1}`}
                                  {sheet.suggestions?.name?.find(s => s.index === index) && 
                                    ` (${sheet.suggestions.name.find(s => s.index === index).confidence >= 0.8 ? '✓ Recommended' : 'Possible match'})`
                                  }
                                </option>
                              ))}
                            </select>
                            {sheet.suggestions?.name?.length > 0 && (
                              <div className="mt-2 text-xs">
                                <p className="text-gray-600 mb-1">Suggestions:</p>
                                {sheet.suggestions.name.slice(0, 3).map((suggestion, idx) => (
                                  <div key={idx} className={`flex items-center gap-2 ${suggestion.isRecommended ? 'text-green-600' : 'text-gray-500'}`}>
                                    {suggestion.isRecommended ? '✓' : '•'} 
                                    <span className="font-mono">{suggestion.header}</span>
                                    <span>({suggestion.label})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Roll Number Column */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-red-600">Roll Number *</label>
                            <select
                              value={mapping?.rollColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'rollColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>
                                  {header || `Column ${index + 1}`}
                                  {sheet.suggestions?.rollNumber?.find(s => s.index === index) && 
                                    ` (${sheet.suggestions.rollNumber.find(s => s.index === index).confidence >= 0.8 ? '✓ Recommended' : 'Possible match'})`
                                  }
                                </option>
                              ))}
                            </select>
                            {sheet.suggestions?.rollNumber?.length > 0 && (
                              <div className="mt-2 text-xs">
                                <p className="text-gray-600 mb-1">Suggestions:</p>
                                {sheet.suggestions.rollNumber.slice(0, 3).map((suggestion, idx) => (
                                  <div key={idx} className={`flex items-center gap-2 ${suggestion.isRecommended ? 'text-green-600' : 'text-gray-500'}`}>
                                    {suggestion.isRecommended ? '✓' : '•'} 
                                    <span className="font-mono">{suggestion.header}</span>
                                    <span>({suggestion.label})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Admission Number Column */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-red-600">Admission Number *</label>
                            <select
                              value={mapping?.admissionColumn ?? ''}
                              onChange={(e) => handleColumnMapping(sheetName, 'admissionColumn', e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950"
                            >
                              <option value="">Select Column</option>
                              {sheet.headers.map((header, index) => (
                                <option key={index} value={index}>
                                  {header || `Column ${index + 1}`}
                                  {sheet.suggestions?.admissionNumber?.find(s => s.index === index) && 
                                    ` (${sheet.suggestions.admissionNumber.find(s => s.index === index).confidence >= 0.8 ? '✓ Recommended' : 'Possible match'})`
                                  }
                                </option>
                              ))}
                            </select>
                            {sheet.suggestions?.admissionNumber?.length > 0 && (
                              <div className="mt-2 text-xs">
                                <p className="text-gray-600 mb-1">Suggestions:</p>
                                {sheet.suggestions.admissionNumber.slice(0, 3).map((suggestion, idx) => (
                                  <div key={idx} className={`flex items-center gap-2 ${suggestion.isRecommended ? 'text-green-600' : 'text-gray-500'}`}>
                                    {suggestion.isRecommended ? '✓' : '•'} 
                                    <span className="font-mono">{suggestion.header}</span>
                                    <span>({suggestion.label})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Auto-Detection Status */}
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <div className="flex items-center gap-2 text-sm">
                            {mapping?.nameColumn !== null && mapping?.rollColumn !== null && mapping?.admissionColumn !== null ? (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-green-700 dark:text-green-300">All required columns mapped</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-yellow-700 dark:text-yellow-300">
                                  Missing: {[
                                    mapping?.nameColumn === null && 'Name',
                                    mapping?.rollColumn === null && 'Roll Number', 
                                    mapping?.admissionColumn === null && 'Admission Number'
                                  ].filter(Boolean).join(', ')}
                                </span>
                              </>
                            )}
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

            {/* Step 2: Department Comparison Settings */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                  <p><strong>Configure Department Comparison:</strong></p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Enable comparison to automatically add missing students from existing departments</li>
                    <li>Select which departments to use as reference for comparison</li>
                    <li>Students from reference departments will be added if they're missing in your import</li>
                  </ul>
                </div>

                {fileData.sheetNames.map(sheetName => {
                  const mapping = sheetMappings[sheetName];
                  const settings = comparisonSettings[sheetName];
                  
                  // Only show sheets that have valid column mappings
                  if (!mapping || mapping.nameColumn === null || mapping.rollColumn === null || mapping.admissionNumber === null) {
                    return null;
                  }

                  return (
                    <Card key={sheetName}>
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                          <span>Department: {sheetName}</span>
                          <div className="flex items-center space-x-2">
                            <label className="text-sm">Enable Comparison</label>
                            <input
                              type="checkbox"
                              checked={settings.enableComparison}
                              onChange={(e) => handleComparisonSettingChange(sheetName, 'enableComparison', e.target.checked)}
                              className="rounded"
                            />
                          </div>
                        </CardTitle>
                      </CardHeader>
                      
                      {settings.enableComparison && (
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={settings.addMissingStudents}
                                onChange={(e) => handleComparisonSettingChange(sheetName, 'addMissingStudents', e.target.checked)}
                                className="rounded"
                              />
                              <label className="text-sm">Automatically add missing students to import</label>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium mb-3">Reference Departments to Compare Against:</h4>
                              {loadingDepartments ? (
                                <div className="text-center py-4">Loading departments...</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                                  {availableDepartments.map(dept => (
                                    <div key={dept.name} className="flex items-center space-x-2 p-2 border rounded">
                                      <input
                                        type="checkbox"
                                        checked={settings.referenceCollections.includes(dept.name)}
                                        onChange={() => handleReferenceCollectionToggle(sheetName, dept.name)}
                                        className="rounded"
                                      />
                                      <div className="flex-1">
                                        <div className="text-sm font-medium">{dept.name}</div>
                                        <div className="text-xs text-gray-500">{dept.studentCount} students</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {settings.referenceCollections.length === 0 && !loadingDepartments && (
                                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                                  <strong>Note:</strong> No reference departments selected. Will compare against all departments if comparison is enabled.
                                </div>
                              )}
                              
                              {settings.referenceCollections.length > 0 && (
                                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                                  Selected {settings.referenceCollections.length} departments for comparison
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Step 3: Preview */}
            {currentStep === 3 && (
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
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{data.totalStudents} students</Badge>
                          {data.comparisonSettings?.enableComparison && (
                            <Badge variant="outline" className="text-xs">
                              📊 {data.comparisonSettings.referenceCollections.length || 'All'} refs
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                      {data.errors.length > 0 && (
                        <CardDescription className="text-red-600">
                          {data.errors.length} warnings (will skip {data.skippedRows} rows)
                        </CardDescription>
                      )}
                      {data.comparisonSettings?.enableComparison && (
                        <CardDescription className="text-blue-600">
                          🔍 Department comparison enabled 
                          {data.comparisonSettings.referenceCollections.length > 0 
                            ? ` with ${data.comparisonSettings.referenceCollections.length} reference departments`
                            : ' with all departments'}
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
              {currentStep === 3 && (
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  ← Back to Comparison
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              {currentStep === 1 ? (
                <Button 
                  onClick={proceedToComparisonStep}
                  disabled={!isStepValid()}
                >
                  Next: Configure Comparison →
                </Button>
              ) : currentStep === 2 ? (
                <Button 
                  onClick={proceedToPreview}
                  disabled={!isStepValid()}
                >
                  Next: Preview Import →
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
