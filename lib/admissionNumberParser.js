// lib/admissionNumberParser.js
// Optimized admission number parsing service for targeted collection queries

// Section Code Mapping - Maps section codes to actual Firestore collection names
const SECTION_CODE_MAP = {
  // Civil Engineering
  "01": "students_civil_1",
  "012": "students_civil_2",
  
  // Mechanical Engineering  
  "21": "students_mech_1", 
  "22": "students_mech_2",
  
  // Electronics and Communication Engineering
  "41": "students_ece_1",
  "42": "students_ece_2", 
  "43": "students_ece_3",
  
  // Computer Science Engineering
  "51": "students_cse_1",
  "52": "students_cse_2",
  "53": "students_cse_3",
  
  // Electrical and Electronics Engineering
  "61": "students_eee_1",
  "62": "students_eee_2",
  
  // Information Technology
  "71": "students_it_1",
  "72": "students_it_2", 
  "73": "students_it_3",
  
  // Single section departments
  "08": "students_chem",          // Chemical Engineering
  "09": "students_bio_tech",      // Biotechnology
  "12": "students_csm",           // CSM (AI&ML)
  "13": "students_iot",           // CIE (IoT)
  "15": "students_aiml",          // AIM (AI&ML)
  
  // AI & Data Science
  "141": "students_aids_1",
  "142": "students_aids_2"
};

// Reverse mapping for collection name to section info
const COLLECTION_TO_SECTION_MAP = {};
Object.entries(SECTION_CODE_MAP).forEach(([sectionCode, collectionName]) => {
  COLLECTION_TO_SECTION_MAP[collectionName] = sectionCode;
});

export const admissionNumberParser = {
  
  /**
   * Parse admission number and extract section information
   * Format: YYBCSXXXX where YY=year, B=batch, C=campus, S=section(1-3 digits)
   * @param {string} admissionNumber - The admission number to parse
   * @returns {Object} Parsed components or null if invalid
   */
  parseAdmissionNumber(admissionNumber) {
    try {
      // Clean and validate input
      const cleanAdmissionNumber = admissionNumber?.toString().trim();
      if (!cleanAdmissionNumber || cleanAdmissionNumber.length < 8) {
        return null;
      }

      // Extract components based on pattern YYBCSXXXX
      const year = cleanAdmissionNumber.substring(0, 2);
      const batch = cleanAdmissionNumber.substring(2, 3);
      const campus = cleanAdmissionNumber.substring(3, 4);
      
      // Section extraction - can be 1-3 digits
      let sectionCode = '';
      let serialNumber = '';
      
      // Try 3-digit section first (like 141, 142)
      if (cleanAdmissionNumber.length >= 11) {
        const possibleThreeDigitSection = cleanAdmissionNumber.substring(4, 7);
        if (SECTION_CODE_MAP[possibleThreeDigitSection]) {
          sectionCode = possibleThreeDigitSection;
          serialNumber = cleanAdmissionNumber.substring(7);
        }
      }
      
      // Try 2-digit section (like 01, 21, 41, etc.)
      if (!sectionCode && cleanAdmissionNumber.length >= 10) {
        const possibleTwoDigitSection = cleanAdmissionNumber.substring(4, 6);
        if (SECTION_CODE_MAP[possibleTwoDigitSection]) {
          sectionCode = possibleTwoDigitSection;
          serialNumber = cleanAdmissionNumber.substring(6);
        }
      }
      
      // Try 1-digit section (fallback)
      if (!sectionCode && cleanAdmissionNumber.length >= 9) {
        const possibleOneDigitSection = cleanAdmissionNumber.substring(4, 5);
        if (SECTION_CODE_MAP[possibleOneDigitSection]) {
          sectionCode = possibleOneDigitSection;
          serialNumber = cleanAdmissionNumber.substring(5);
        }
      }

      if (!sectionCode) {
        return null; // Section code not found in mapping
      }

      return {
        original: cleanAdmissionNumber,
        year: year,
        batch: batch,
        campus: campus,
        sectionCode: sectionCode,
        serialNumber: serialNumber,
        collectionName: SECTION_CODE_MAP[sectionCode],
        isValid: true
      };

    } catch (error) {
      console.error('Error parsing admission number:', error);
      return null;
    }
  },

  /**
   * Get target collection name for an admission number
   * @param {string} admissionNumber - The admission number
   * @returns {string|null} Collection name or null if not found
   */
  getTargetCollection(admissionNumber) {
    const parsed = this.parseAdmissionNumber(admissionNumber);
    return parsed ? parsed.collectionName : null;
  },

  /**
   * Get all possible collections for fallback search
   * @returns {Array<string>} Array of all collection names
   */
  getAllCollections() {
    return Object.values(SECTION_CODE_MAP);
  },

  /**
   * Get section code for a collection name
   * @param {string} collectionName - The collection name
   * @returns {string|null} Section code or null if not found
   */
  getSectionCodeForCollection(collectionName) {
    return COLLECTION_TO_SECTION_MAP[collectionName] || null;
  },

  /**
   * Get department info from section code
   * @param {string} sectionCode - The section code
   * @returns {Object} Department information
   */
  getDepartmentInfo(sectionCode) {
    const departmentMapping = {
      // Civil Engineering
      "01": { department: "Civil Engineering", section: "1", fullName: "Civil Engineering 1" },
      "012": { department: "Civil Engineering", section: "2", fullName: "Civil Engineering 2" },
      
      // Mechanical Engineering
      "21": { department: "Mechanical Engineering", section: "1", fullName: "Mechanical Engineering 1" },
      "22": { department: "Mechanical Engineering", section: "2", fullName: "Mechanical Engineering 2" },
      
      // Electronics and Communication Engineering
      "41": { department: "Electronics and Communication Engineering", section: "1", fullName: "Electronics and Communication Engineering 1" },
      "42": { department: "Electronics and Communication Engineering", section: "2", fullName: "Electronics and Communication Engineering 2" },
      "43": { department: "Electronics and Communication Engineering", section: "3", fullName: "Electronics and Communication Engineering 3" },
      
      // Computer Science Engineering
      "51": { department: "Computer Science Engineering", section: "1", fullName: "Computer Science Engineering 1" },
      "52": { department: "Computer Science Engineering", section: "2", fullName: "Computer Science Engineering 2" },
      "53": { department: "Computer Science Engineering", section: "3", fullName: "Computer Science Engineering 3" },
      
      // Electrical and Electronics Engineering
      "61": { department: "Electrical and Electronics Engineering", section: "1", fullName: "Electrical and Electronics Engineering 1" },
      "62": { department: "Electrical and Electronics Engineering", section: "2", fullName: "Electrical and Electronics Engineering 2" },
      
      // Information Technology
      "71": { department: "Information Technology", section: "1", fullName: "Information Technology 1" },
      "72": { department: "Information Technology", section: "2", fullName: "Information Technology 2" },
      "73": { department: "Information Technology", section: "3", fullName: "Information Technology 3" },
      
      // Single section departments
      "08": { department: "Chemical Engineering", section: "1", fullName: "Chemical Engineering" },
      "09": { department: "Biotechnology", section: "1", fullName: "Biotechnology" },
      "12": { department: "Computer Science and Engineering (AI&ML)", section: "1", fullName: "Computer Science and Engineering (AI&ML)" },
      "13": { department: "Internet of Things", section: "1", fullName: "Internet of Things" },
      "15": { department: "Artificial Intelligence and Machine Learning", section: "1", fullName: "Artificial Intelligence and Machine Learning" },
      
      // AI & Data Science
      "141": { department: "Artificial Intelligence and Data Science", section: "1", fullName: "Artificial Intelligence and Data Science 1" },
      "142": { department: "Artificial Intelligence and Data Science", section: "2", fullName: "Artificial Intelligence and Data Science 2" }
    };

    return departmentMapping[sectionCode] || null;
  },

  /**
   * Validate admission number format
   * @param {string} admissionNumber - The admission number to validate
   * @returns {Object} Validation result with details
   */
  validateAdmissionNumber(admissionNumber) {
    const parsed = this.parseAdmissionNumber(admissionNumber);
    
    if (!parsed) {
      return {
        isValid: false,
        error: "Invalid admission number format or unrecognized section code",
        details: "Expected format: YYBCSXXXX where S is a valid section code"
      };
    }

    return {
      isValid: true,
      parsed: parsed,
      targetCollection: parsed.collectionName,
      departmentInfo: this.getDepartmentInfo(parsed.sectionCode)
    };
  }
};

// Export the section mapping for use in other modules if needed
export { SECTION_CODE_MAP, COLLECTION_TO_SECTION_MAP };
