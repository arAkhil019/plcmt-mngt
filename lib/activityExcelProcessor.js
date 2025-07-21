// lib/activityExcelProcessor.js
import * as XLSX from 'xlsx';

export const ActivityExcelProcessor = {
  
  // Process activity participation Excel file
  processActivityParticipationExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          const result = {
            participants: [],
            sheetNames: workbook.SheetNames,
            totalRows: 0,
            errors: [],
            warnings: []
          };

          // Process all sheets
          workbook.SheetNames.forEach(sheetName => {
            try {
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1,
                defval: '',
                blankrows: false
              });

              // Skip empty sheets
              if (jsonData.length === 0) {
                result.warnings.push(`Sheet "${sheetName}" is empty`);
                return;
              }

              // Find header row (look for 'name' and 'roll' columns)
              let headerRowIndex = -1;
              let nameColIndex = -1;
              let rollColIndex = -1;

              for (let i = 0; i < Math.min(5, jsonData.length); i++) {
                const row = jsonData[i];
                if (Array.isArray(row)) {
                  for (let j = 0; j < row.length; j++) {
                    const cell = String(row[j] || '').toLowerCase().trim();
                    
                    if (cell.includes('name') && nameColIndex === -1) {
                      nameColIndex = j;
                      headerRowIndex = i;
                    }
                    if ((cell.includes('roll') || cell.includes('number')) && rollColIndex === -1) {
                      rollColIndex = j;
                      headerRowIndex = i;
                    }
                  }
                  
                  // If we found both columns, break
                  if (nameColIndex !== -1 && rollColIndex !== -1) {
                    break;
                  }
                }
              }

              if (nameColIndex === -1 || rollColIndex === -1) {
                result.errors.push(`Sheet "${sheetName}": Could not find name and roll number columns. Expected columns containing "name" and "roll"`);
                return;
              }

              // Process data rows
              for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!Array.isArray(row) || row.length === 0) continue;

                const name = String(row[nameColIndex] || '').trim();
                const rollNumber = String(row[rollColIndex] || '').trim();

                // Skip empty rows
                if (!name && !rollNumber) continue;

                result.participants.push({
                  name,
                  rollNumber,
                  sheetName,
                  rowNumber: i + 1
                });
                result.totalRows++;
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

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsBinaryString(file);
    });
  },

  // Generate template for activity participation
  generateActivityParticipationTemplate() {
    const templateData = [
      ['Student Name', 'Roll Number'],
      ['John Doe', '160122729001'],
      ['Jane Smith', '160122729002'],
      ['Example Student', '160122730003'],
      ['', ''],
      ['Instructions:', ''],
      ['1. Enter only Student Name and Roll Number', ''],
      ['2. Roll Number format: 1601YYXXXNNN', ''],
      ['3. System will auto-find admission numbers', ''],
      ['4. Delete instruction rows before upload', '']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    worksheet['!cols'] = [
      { width: 30 }, // Student Name
      { width: 20 }  // Roll Number
    ];

    // Style the header row
    const headerStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "366092" } },
      alignment: { horizontal: "center" }
    };

    ['A1', 'B1'].forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = headerStyle;
      }
    });

    // Style instruction rows
    const instructionStyle = {
      font: { italic: true },
      fill: { fgColor: { rgb: "E8F4FD" } }
    };

    ['A6', 'A7', 'A8', 'A9', 'A10'].forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = instructionStyle;
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Participants');

    return workbook;
  },

  // Export activity participation results
  exportActivityParticipationResults(results, activityName) {
    const workbook = XLSX.utils.book_new();

    // Create successful participants sheet
    if (results.successful && results.successful.length > 0) {
      const successData = [
        [
          'Student Name',
          'Provided Name', 
          'Roll Number',
          'Admission Number',
          'Department',
          'Joining Year',
          'Name Verified',
          'Confidence'
        ],
        ...results.successful.map(participant => [
          participant.studentName,
          participant.providedName,
          participant.rollNumber,
          participant.admissionNumber,
          participant.department,
          participant.joiningYear,
          participant.nameVerified ? 'Yes' : 'No',
          Math.round(participant.nameConfidence * 100) + '%'
        ])
      ];

      const successSheet = XLSX.utils.aoa_to_sheet(successData);
      successSheet['!cols'] = [
        { width: 20 }, // Student Name
        { width: 20 }, // Provided Name
        { width: 15 }, // Roll Number
        { width: 15 }, // Admission Number
        { width: 30 }, // Department
        { width: 12 }, // Joining Year
        { width: 12 }, // Name Verified
        { width: 12 }  // Confidence
      ];

      XLSX.utils.book_append_sheet(workbook, successSheet, 'Successful');
    }

    // Create failed participants sheet
    if (results.failed && results.failed.length > 0) {
      const failedData = [
        ['Provided Name', 'Roll Number', 'Error'],
        ...results.failed.map(participant => [
          participant.name,
          participant.rollNumber,
          participant.error
        ])
      ];

      const failedSheet = XLSX.utils.aoa_to_sheet(failedData);
      failedSheet['!cols'] = [
        { width: 20 }, // Name
        { width: 15 }, // Roll Number
        { width: 50 }  // Error
      ];

      XLSX.utils.book_append_sheet(workbook, failedSheet, 'Failed');
    }

    // Create summary sheet
    const summaryData = [
      ['Activity Participation Summary'],
      ['Activity Name', activityName || 'Unknown Activity'],
      ['Total Processed', results.summary?.totalProcessed || 0],
      ['Successful', results.summary?.successful || 0],
      ['Failed', results.summary?.failed || 0],
      ['Success Rate', `${Math.round(((results.summary?.successful || 0) / (results.summary?.totalProcessed || 1)) * 100)}%`]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ width: 20 }, { width: 30 }];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    return workbook;
  }
};
