// lib/excelProcessor.js
import * as XLSX from 'xlsx';

export class ExcelProcessor {
  static async processStudentExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const result = {
            sheets: {},
            sheetNames: [],
            totalRows: 0,
            errors: [],
            departmentGroups: {} // Add department groups for merge functionality
          };

          // Process each sheet but don't auto-map columns
          workbook.SheetNames.forEach(sheetName => {
            try {
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1,
                defval: '',
                blankrows: false
              });

              if (jsonData.length === 0) {
                result.errors.push(`Sheet "${sheetName}" is empty`);
                return;
              }

              // Just store raw sheet data and suggestions for manual processing
              const headers = jsonData[0] ? jsonData[0].map(h => h?.toString().trim() || '') : [];
              const rows = jsonData.slice(1); // Skip header row
              
              // Get auto-detected mapping and suggestions
              const autoMapping = this.findColumnMapping(headers);
              const mappingSuggestions = this.getColumnMappingSuggestions(headers);
              
              result.sheets[sheetName] = {
                headers,
                rows,
                totalRows: rows.length,
                autoMapping, // Auto-detected column mapping
                suggestions: mappingSuggestions, // All possible suggestions with confidence
                departmentName: sheetName // Default collection name (user can edit)
              };
              
              result.sheetNames.push(sheetName);
              result.totalRows += rows.length;

              // Try to auto-process this sheet as a department for merge functionality
              try {
                const departmentStudents = this.autoProcessSheetAsDepartment(headers, rows, sheetName);
                if (departmentStudents.length > 0) {
                  result.departmentGroups[sheetName] = departmentStudents;
                }
              } catch (autoProcessError) {
                // Auto-processing failed, that's okay - will fall back to manual mapping
                console.warn(`Auto-processing failed for sheet ${sheetName}:`, autoProcessError.message);
              }

            } catch (error) {
              result.errors.push(`Error processing sheet "${sheetName}": ${error.message}`);
            }
          });

          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to process Excel file: ${error.message}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Auto-process sheet data assuming each sheet is a department
  static autoProcessSheetAsDepartment(headers, rows, departmentName) {
    const students = [];
    
    // Find column indices for required fields (case-insensitive)
    const columnMapping = this.findColumnMapping(headers);
    
    if (!columnMapping.name || !columnMapping.rollNumber || !columnMapping.admissionNumber) {
      throw new Error(`Missing required columns in ${departmentName}. Required: Name, Roll Number, Admission Number`);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      try {
        const student = {
          name: row[columnMapping.name] || '',
          rollNumber: row[columnMapping.rollNumber] || '',
          admissionNumber: row[columnMapping.admissionNumber] || '',
          // Removed year field
          department: departmentName
        };

        // Validate required fields
        if (!student.name || !student.rollNumber || !student.admissionNumber) {
          continue; // Skip rows with missing data
        }

        // Clean and validate data
        student.name = student.name.toString().trim();
        student.rollNumber = student.rollNumber.toString().trim();
        student.admissionNumber = student.admissionNumber.toString().trim();

        if (student.name.length === 0 || student.rollNumber.length === 0 || student.admissionNumber.length === 0) {
          continue; // Skip empty fields
        }

        students.push(student);
      } catch (error) {
        // Skip problematic rows
        continue;
      }
    }

    return students;
  }

  // Process sheet data with manual column mapping
  static processSheetWithMapping(sheetData, columnMapping) {
    const result = {
      students: [],
      errors: [],
      skippedRows: 0
    };

    const { headers, rows } = sheetData;
    const { nameColumn, rollColumn, admissionColumn } = columnMapping; // Removed yearColumn

    // Validate that required columns are selected
    if (nameColumn === null || rollColumn === null || admissionColumn === null) {
      result.errors.push('Please select Name, Roll Number, and Admission Number columns');
      return result;
    }

    // Process data rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '')) {
        result.skippedRows++;
        continue;
      }

      try {
        const student = {
          name: this.getCellValue(row, nameColumn),
          rollNumber: this.getCellValue(row, rollColumn),
          admissionNumber: this.getCellValue(row, admissionColumn)
          // Removed year field
        };

        // Validate required fields
        if (!student.name || !student.rollNumber || !student.admissionNumber) {
          result.errors.push(`Row ${i + 2}: Missing required data (Name: "${student.name}", Roll: "${student.rollNumber}", Admission: "${student.admissionNumber}")`);
          result.skippedRows++;
          continue;
        }

        // Clean and validate data
        student.name = student.name.toString().trim();
        student.rollNumber = student.rollNumber.toString().trim();
        student.admissionNumber = student.admissionNumber.toString().trim();

        if (student.name.length === 0 || student.rollNumber.length === 0 || student.admissionNumber.length === 0) {
          result.errors.push(`Row ${i + 2}: Empty required fields after trimming`);
          result.skippedRows++;
          continue;
        }

        result.students.push(student);
      } catch (error) {
        result.errors.push(`Row ${i + 2}: ${error.message}`);
        result.skippedRows++;
      }
    }

    return result;
  }

  static processSheetData(jsonData, departmentName) {
    const result = {
      department: departmentName,
      students: [],
      headers: [],
      errors: [],
      skippedRows: 0
    };

    if (jsonData.length === 0) {
      return result;
    }

    // Get headers from first row
    const headerRow = jsonData[0];
    result.headers = headerRow.map(h => h?.toString().trim() || '');

    // Find column indices for required fields
    const columnMapping = this.findColumnMapping(result.headers);
    
    if (!columnMapping.name || !columnMapping.rollNumber || !columnMapping.admissionNumber) {
      result.errors.push(`Missing required columns in ${departmentName}. Required: Name, Roll Number, Admission Number`);
      return result;
    }

    // Process data rows (skip header)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      if (!row || row.length === 0 || row.every(cell => !cell || cell.toString().trim() === '')) {
        result.skippedRows++;
        continue;
      }

      try {
        const student = {
          name: this.getCellValue(row, columnMapping.name),
          rollNumber: this.getCellValue(row, columnMapping.rollNumber),
          admissionNumber: this.getCellValue(row, columnMapping.admissionNumber),
          year: columnMapping.year ? this.getCellValue(row, columnMapping.year) : ''
        };

        // Validate required fields
        if (!student.name || !student.rollNumber || !student.admissionNumber) {
          result.errors.push(`Row ${i + 1}: Missing required data (Name: "${student.name}", Roll: "${student.rollNumber}", Admission: "${student.admissionNumber}")`);
          result.skippedRows++;
          continue;
        }

        // Clean and validate data
        student.name = student.name.toString().trim();
        student.rollNumber = student.rollNumber.toString().trim();
        student.admissionNumber = student.admissionNumber.toString().trim();
        student.year = student.year ? student.year.toString().trim() : '';

        if (student.name.length === 0 || student.rollNumber.length === 0 || student.admissionNumber.length === 0) {
          result.errors.push(`Row ${i + 1}: Empty required fields after trimming`);
          result.skippedRows++;
          continue;
        }

        result.students.push(student);
      } catch (error) {
        result.errors.push(`Row ${i + 1}: ${error.message}`);
        result.skippedRows++;
      }
    }

    return result;
  }

  static findColumnMapping(headers) {
    const mapping = {
      name: null,
      rollNumber: null,
      admissionNumber: null
      // Removed year field as requested
    };

    // Enhanced detection patterns with confidence scoring
    const patterns = {
      name: [
        { pattern: /^(student\s*)?(name|full\s*name|student\s*name)$/i, confidence: 1.0 },
        { pattern: /name/i, confidence: 0.8 },
        { pattern: /^(student|naam)$/i, confidence: 0.6 }
      ],
      rollNumber: [
        { pattern: /^(roll\s*)?no\.?$|^roll\s*number$/i, confidence: 1.0 },
        { pattern: /^(roll|rno|r\.?no\.?)$/i, confidence: 0.9 },
        { pattern: /roll/i, confidence: 0.7 },
        { pattern: /^(reg\s*no|registration)$/i, confidence: 0.6 }
      ],
      admissionNumber: [
        { pattern: /^admission\s*no\.?$|^admission\s*number$/i, confidence: 1.0 },
        { pattern: /^(adm\s*no\.?|admno)$/i, confidence: 0.9 },
        { pattern: /admission/i, confidence: 0.8 },
        { pattern: /^(id|student\s*id)$/i, confidence: 0.5 }
      ]
    };

    // Find best matches for each field
    Object.keys(patterns).forEach(field => {
      let bestMatch = { index: null, confidence: 0 };
      
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase().trim();
        
        patterns[field].forEach(({ pattern, confidence }) => {
          if (pattern.test(headerLower) && confidence > bestMatch.confidence) {
            bestMatch = { index, confidence };
          }
        });
      });
      
      if (bestMatch.confidence > 0.5) { // Only suggest if confidence is above threshold
        mapping[field] = bestMatch.index;
      }
    });

    return mapping;
  }

  // New function to get mapping suggestions with confidence levels
  static getColumnMappingSuggestions(headers) {
    const suggestions = {
      name: [],
      rollNumber: [],
      admissionNumber: []
    };

    const patterns = {
      name: [
        { pattern: /^(student\s*)?(name|full\s*name|student\s*name)$/i, confidence: 1.0, label: 'Exact match' },
        { pattern: /name/i, confidence: 0.8, label: 'Contains "name"' },
        { pattern: /^(student|naam)$/i, confidence: 0.6, label: 'Student identifier' }
      ],
      rollNumber: [
        { pattern: /^(roll\s*)?no\.?$|^roll\s*number$/i, confidence: 1.0, label: 'Exact match' },
        { pattern: /^(roll|rno|r\.?no\.?)$/i, confidence: 0.9, label: 'Roll number abbreviation' },
        { pattern: /roll/i, confidence: 0.7, label: 'Contains "roll"' },
        { pattern: /^(reg\s*no|registration)$/i, confidence: 0.6, label: 'Registration number' }
      ],
      admissionNumber: [
        { pattern: /^admission\s*no\.?$|^admission\s*number$/i, confidence: 1.0, label: 'Exact match' },
        { pattern: /^(adm\s*no\.?|admno)$/i, confidence: 0.9, label: 'Admission abbreviation' },
        { pattern: /admission/i, confidence: 0.8, label: 'Contains "admission"' },
        { pattern: /^(id|student\s*id)$/i, confidence: 0.5, label: 'Student ID' }
      ]
    };

    // Generate suggestions for each field
    Object.keys(patterns).forEach(field => {
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase().trim();
        
        patterns[field].forEach(({ pattern, confidence, label }) => {
          if (pattern.test(headerLower)) {
            suggestions[field].push({
              index,
              header: header.trim(),
              confidence,
              label,
              isRecommended: confidence >= 0.8
            });
          }
        });
      });
      
      // Sort by confidence (highest first)
      suggestions[field].sort((a, b) => b.confidence - a.confidence);
    });

    return suggestions;
  }

  static getCellValue(row, columnIndex) {
    if (columnIndex === null || columnIndex === undefined || columnIndex >= row.length) {
      return '';
    }
    
    const value = row[columnIndex];
    if (value === null || value === undefined) {
      return '';
    }
    
    return value.toString().trim();
  }

  // Generate template Excel file for download
  static generateTemplateExcel() {
    const departments = [
      'Computer Science Engineering',
      'Electronics and Communication Engineering', 
      'Information Technology'
    ];

    const workbook = XLSX.utils.book_new();

    departments.forEach(dept => {
      const templateData = [
        ['Name', 'Roll Number', 'Admission Number'], // Removed Year column
        ['John Doe', 'CS001', 'ADM2024001'],
        ['Jane Smith', 'CS002', 'ADM2024002'],
        ['Sample Student', 'CS003', 'ADM2024003']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths
      worksheet['!cols'] = [
        { width: 20 }, // Name
        { width: 15 }, // Roll Number
        { width: 18 }  // Admission Number (removed Year width)
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, dept);
    });

    return workbook;
  }

  // Export student data to Excel
  static exportStudentsToExcel(departmentData) {
    const workbook = XLSX.utils.book_new();

    Object.entries(departmentData).forEach(([department, students]) => {
      if (students.length === 0) return;

      const exportData = [
        ['Name', 'Roll Number', 'Admission Number', 'Created At', 'Last Updated'] // Removed Year column
      ];

      students.forEach(student => {
        exportData.push([
          student.name,
          student.rollNumber,
          student.admissionNumber,
          // Removed student.year || '',
          student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '',
          student.updatedAt ? new Date(student.updatedAt).toLocaleDateString() : ''
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(exportData);
      
      // Set column widths
      worksheet['!cols'] = [
        { width: 25 }, // Name
        { width: 15 }, // Roll Number
        { width: 18 }, // Admission Number
        // Removed { width: 10 }, // Year
        { width: 12 }, // Created At
        { width: 12 }  // Last Updated
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, department);
    });

    return workbook;
  }
}
