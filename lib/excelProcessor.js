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
            errors: []
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

              // Just store raw sheet data for manual processing
              const headers = jsonData[0] ? jsonData[0].map(h => h?.toString().trim() || '') : [];
              const rows = jsonData.slice(1); // Skip header row
              
              result.sheets[sheetName] = {
                headers,
                rows,
                totalRows: rows.length
              };
              
              result.sheetNames.push(sheetName);
              result.totalRows += rows.length;

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

  // Process sheet data with manual column mapping
  static processSheetWithMapping(sheetData, columnMapping) {
    const result = {
      students: [],
      errors: [],
      skippedRows: 0
    };

    const { headers, rows } = sheetData;
    const { nameColumn, rollColumn, admissionColumn, yearColumn } = columnMapping;

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
          admissionNumber: this.getCellValue(row, admissionColumn),
          year: yearColumn !== null ? this.getCellValue(row, yearColumn) : ''
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
        student.year = student.year ? student.year.toString().trim() : '';

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
      admissionNumber: null,
      year: null
    };

    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase().trim();
      
      // Name column variations
      if (headerLower.includes('name') || headerLower === 'student' || headerLower === 'student name') {
        mapping.name = index;
      }
      
      // Roll number variations
      else if (headerLower.includes('roll') || headerLower.includes('roll no') || 
               headerLower.includes('rollno') || headerLower.includes('roll number') ||
               headerLower === 'roll' || headerLower === 'rno') {
        mapping.rollNumber = index;
      }
      
      // Admission number variations
      else if (headerLower.includes('admission') || headerLower.includes('admission no') ||
               headerLower.includes('admission number') || headerLower.includes('admno') ||
               headerLower === 'admission' || headerLower === 'adm no') {
        mapping.admissionNumber = index;
      }
      
      // Year variations
      else if (headerLower.includes('year') || headerLower.includes('class') ||
               headerLower.includes('semester') || headerLower.includes('sem')) {
        mapping.year = index;
      }
    });

    return mapping;
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
        ['Name', 'Roll Number', 'Admission Number', 'Year'],
        ['John Doe', 'CS001', 'ADM2024001', '2024'],
        ['Jane Smith', 'CS002', 'ADM2024002', '2024'],
        ['Sample Student', 'CS003', 'ADM2024003', '2024']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths
      worksheet['!cols'] = [
        { width: 20 }, // Name
        { width: 15 }, // Roll Number
        { width: 18 }, // Admission Number
        { width: 10 }  // Year
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
        ['Name', 'Roll Number', 'Admission Number', 'Year', 'Created At', 'Last Updated']
      ];

      students.forEach(student => {
        exportData.push([
          student.name,
          student.rollNumber,
          student.admissionNumber,
          student.year || '',
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
        { width: 10 }, // Year
        { width: 12 }, // Created At
        { width: 12 }  // Last Updated
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, department);
    });

    return workbook;
  }
}
