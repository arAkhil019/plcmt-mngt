// lib/admissionNumberParser.js
// Optimized admission number parsing service for targeted collection queries

// Department Code Mapping - Maps 2-digit department codes to department names
const DEPARTMENT_CODE_MAP = {
  "01": "Civil",
  "02": "Mech", 
  "04": "ECE",
  "05": "CSE",
  "06": "EEE",
  "07": "IT",
  "08": "Chem",
  "09": "Bio tech",
  "12": "CSM",
  "13": "IOT", 
  "14": "AIDS",
  "15": "AIML"
};

// Section Code Mapping - Maps department code + section number to Firestore collection names
// Format: "DEPT_CODE + SECTION_NUMBER" -> "collection_name"
const SECTION_CODE_MAP = {
  // Civil Engineering - Department Code: 01
  "011": "students_civil_1",
  "012": "students_civil_2",
  
  // Mechanical Engineering - Department Code: 02
  "021": "students_mech_1", 
  "022": "students_mech_2",
  
  // Electronics and Communication Engineering - Department Code: 04
  "041": "students_ece_1",
  "042": "students_ece_2", 
  "043": "students_ece_3",
  
  // Computer Science Engineering - Department Code: 05
  "051": "students_cse_1",
  "052": "students_cse_2",
  "053": "students_cse_3",
  
  // Electrical and Electronics Engineering - Department Code: 06
  "061": "students_eee_1",
  "062": "students_eee_2",
  
  // Information Technology - Department Code: 07
  "071": "students_it_1",
  "072": "students_it_2", 
  "073": "students_it_3",
  
  // Chemical Engineering - Department Code: 08
  "081": "students_chem",
  
  // Biotechnology - Department Code: 09
  "091": "students_bio_tech",
  
  // CSM (AI&ML) - Department Code: 12
  "121": "students_csm",
  
  // IoT - Department Code: 13
  "131": "students_iot",
  
  // AIDS - Department Code: 14
  "141": "students_aids_1",
  "142": "students_aids_2",
  
  // AIML - Department Code: 15
  "151": "students_aiml"
};

// Reverse mapping for collection name to section info
const COLLECTION_TO_SECTION_MAP = {};
Object.entries(SECTION_CODE_MAP).forEach(([sectionCode, collectionName]) => {
  COLLECTION_TO_SECTION_MAP[collectionName] = sectionCode;
});

export const admissionNumberParser = {
  
  /**
   * Parse 7-digit admission number and extract section information
   * Format: YYDDSNN where YY=year, DD=department code, S=section number, NN=serial number
   * @param {string} admissionNumber - The 7-digit admission number to parse
   * @returns {Object} Parsed components or null if invalid
   */
  parseAdmissionNumber(admissionNumber) {
    try {
      // Clean and validate input
      const cleanAdmissionNumber = admissionNumber?.toString().trim();
      
      if (!cleanAdmissionNumber || cleanAdmissionNumber.length !== 7) {
        return null;
      }

      // Validate all characters are digits
      if (!/^\d{7}$/.test(cleanAdmissionNumber)) {
        return null;
      }

      // Extract components based on pattern YYDDSNN
      const year = cleanAdmissionNumber.substring(0, 2);           // First 2 digits: Year
      const departmentCode = cleanAdmissionNumber.substring(2, 4); // Next 2 digits: Department
      const sectionNumber = cleanAdmissionNumber.substring(4, 5);  // Next 1 digit: Section
      const serialNumber = cleanAdmissionNumber.substring(5, 7);   // Last 2 digits: Serial/Roll number
      
      // Validate department code
      const departmentName = DEPARTMENT_CODE_MAP[departmentCode];
      if (!departmentName) {
        return null;
      }
      
      // Create section lookup key by combining department code and section number
      const sectionLookupKey = departmentCode + sectionNumber;
      
      // Find matching collection
      const collectionName = SECTION_CODE_MAP[sectionLookupKey];
      
      if (!collectionName) {
        return null;
      }
      
      const result = {
        original: cleanAdmissionNumber,
        year: year,
        fullYear: `20${year}`,
        departmentCode: departmentCode,
        departmentName: departmentName,
        sectionNumber: sectionNumber,
        serialNumber: serialNumber,
        sectionLookupKey: sectionLookupKey,
        collectionName: collectionName,
        isValid: true
      };

      return result;

    } catch (error) {
      return null;
    }
  },

  /**
   * Get target collection name for a 7-digit admission number
   * @param {string} admissionNumber - The 7-digit admission number
   * @returns {string|null} Collection name or null if not found
   */
  getTargetCollection(admissionNumber) {
    const parsed = this.parseAdmissionNumber(admissionNumber);
    const result = parsed ? parsed.collectionName : null;
    return result;
  },

  /**
   * Get all possible collections for fallback search
   * @returns {Array<string>} Array of all collection names
   */
  getAllCollections() {
    return Object.values(SECTION_CODE_MAP);
  },

  /**
   * Get section lookup key for a collection name
   * @param {string} collectionName - The collection name
   * @returns {string|null} Section lookup key or null if not found
   */
  getSectionKeyForCollection(collectionName) {
    return COLLECTION_TO_SECTION_MAP[collectionName] || null;
  },

  /**
   * Get department info from department code
   * @param {string} departmentCode - The 2-digit department code
   * @returns {Object} Department information
   */
  getDepartmentInfo(departmentCode) {
    const departmentDetailMapping = {
      "01": { 
        code: "01", 
        shortName: "Civil", 
        fullName: "Civil Engineering",
        maxSections: 2
      },
      "02": { 
        code: "02", 
        shortName: "Mech", 
        fullName: "Mechanical Engineering",
        maxSections: 2
      },
      "04": { 
        code: "04", 
        shortName: "ECE", 
        fullName: "Electronics and Communication Engineering",
        maxSections: 3
      },
      "05": { 
        code: "05", 
        shortName: "CSE", 
        fullName: "Computer Science Engineering",
        maxSections: 3
      },
      "06": { 
        code: "06", 
        shortName: "EEE", 
        fullName: "Electrical and Electronics Engineering",
        maxSections: 2
      },
      "07": { 
        code: "07", 
        shortName: "IT", 
        fullName: "Information Technology",
        maxSections: 3
      },
      "08": { 
        code: "08", 
        shortName: "Chem", 
        fullName: "Chemical Engineering",
        maxSections: 1
      },
      "09": { 
        code: "09", 
        shortName: "Bio tech", 
        fullName: "Biotechnology",
        maxSections: 1
      },
      "12": { 
        code: "12", 
        shortName: "CSM", 
        fullName: "Computer Science and Engineering (AI&ML)",
        maxSections: 1
      },
      "13": { 
        code: "13", 
        shortName: "IOT", 
        fullName: "Internet of Things",
        maxSections: 1
      },
      "14": { 
        code: "14", 
        shortName: "AIDS", 
        fullName: "Artificial Intelligence and Data Science",
        maxSections: 2
      },
      "15": { 
        code: "15", 
        shortName: "AIML", 
        fullName: "Artificial Intelligence and Machine Learning",
        maxSections: 1
      }
    };

    return departmentDetailMapping[departmentCode] || null;
  },

  /**
   * Get all sections for a department
   * @param {string} departmentCode - The 2-digit department code
   * @returns {Array<Object>} Array of section information
   */
  getSectionsForDepartment(departmentCode) {
    const departmentInfo = this.getDepartmentInfo(departmentCode);
    if (!departmentInfo) return [];

    const sections = [];
    for (let i = 1; i <= departmentInfo.maxSections; i++) {
      const sectionKey = departmentCode + i.toString();
      const collectionName = SECTION_CODE_MAP[sectionKey];
      
      if (collectionName) {
        sections.push({
          sectionKey: sectionKey,
          sectionNumber: i.toString(),
          collectionName: collectionName,
          departmentCode: departmentCode,
          departmentName: departmentInfo.shortName,
          fullSectionName: `${departmentInfo.shortName} Section ${i}`
        });
      }
    }
    
    return sections;
  },

  /**
   * Validate 7-digit admission number format
   * @param {string} admissionNumber - The admission number to validate
   * @returns {Object} Validation result with details
   */
  validateAdmissionNumber(admissionNumber) {
    const parsed = this.parseAdmissionNumber(admissionNumber);
    
    if (!parsed) {
      return {
        isValid: false,
        error: "Invalid 7-digit admission number format or unrecognized department/section",
        details: "Expected format: YYDDSNN where YY=year, DD=department code, S=section number, NN=serial",
        validDepartmentCodes: Object.keys(DEPARTMENT_CODE_MAP)
      };
    }

    return {
      isValid: true,
      parsed: parsed,
      targetCollection: parsed.collectionName,
      departmentInfo: this.getDepartmentInfo(parsed.departmentCode)
    };
  },

  /**
   * Get year batch information
   * @param {string} yearCode - The 2-digit year code
   * @returns {Object} Year information
   */
  getYearInfo(yearCode) {
    const currentYear = new Date().getFullYear();
    const admissionYear = 2000 + parseInt(yearCode);
    const currentSemester = Math.ceil((currentYear - admissionYear) * 2) + 1;
    
    return {
      yearCode: yearCode,
      admissionYear: admissionYear,
      batchName: `Batch ${yearCode}'`,
      estimatedSemester: Math.min(Math.max(currentSemester, 1), 8), // Clamp between 1-8
      graduationYear: admissionYear + 4
    };
  }
};

// Export the mappings for use in other modules if needed
export { SECTION_CODE_MAP, COLLECTION_TO_SECTION_MAP, DEPARTMENT_CODE_MAP };
