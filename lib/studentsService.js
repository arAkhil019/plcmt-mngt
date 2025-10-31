// lib/studentsService.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { admissionNumberParser } from "./admissionNumberParser.js";
import { studentsCache } from "./studentsCache.js";

// Student structure per department:
// {
//   id: string,
//   name: string,
//   rollNumber: string,
//   admissionNumber: string,
//   department: string,
//   year: string,
//   isActive: boolean,
//   createdAt: timestamp,
//   updatedAt: timestamp,
//   createdBy: string, // Admin user ID
//   lastUpdatedBy: string
// }

export const studentsService = {
  // Register a department in the stats collection
  async registerDepartment(departmentName, collectionName, creatorInfo) {
    try {
      // Check if department already exists in stats
      const statsRef = collection(db, 'stats');
      const q = query(statsRef, where('name', '==', departmentName));
      const existingDept = await getDocs(q);

      if (!existingDept.empty) {
        // Department already registered in stats
        return;
      }

      // Get initial stats
      const initialStats = await this.getDepartmentStats(departmentName);

      // Extract department code from existing roll numbers in the collection
      let departmentCode = null;
      try {
        const sampleQuery = query(
          collection(db, collectionName),
          where("isActive", "==", true),
          limit(1)
        );
        const sampleSnapshot = await getDocs(sampleQuery);
        
        if (!sampleSnapshot.empty) {
          const sampleStudent = sampleSnapshot.docs[0].data();
          if (sampleStudent.rollNumber && /^1601\d{8}$/.test(sampleStudent.rollNumber)) {
            departmentCode = sampleStudent.rollNumber.substring(6, 9);
            console.log(`Extracted department code ${departmentCode} for ${departmentName}`);
          }
        }
      } catch (error) {
        console.log(`Could not extract department code for ${departmentName}: ${error.message}`);
      }

      // Register new department with comprehensive data including department code
      const departmentDoc = {
        name: departmentName,
        collectionName: collectionName,
        departmentCode: departmentCode, // Store the extracted department code
        totalStudents: initialStats.totalStudents,
        activeStudents: initialStats.activeStudents,
        inactiveStudents: initialStats.totalStudents - initialStats.activeStudents,
        lastSync: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        createdBy: creatorInfo.id,
        createdByName: creatorInfo.name,
        isActive: true
      };

      await addDoc(statsRef, departmentDoc);
      // Department registered in stats successfully
    } catch (error) {
      console.error('Error registering department in stats:', error);
      // Don't throw error to avoid breaking the main operation
    }
  },

  // Update department statistics
  // Update department statistics in the stats collection
  async updateDepartmentStats(departmentName) {
    try {
      const collectionName = this.getDepartmentCollectionName(departmentName);
      const stats = await this.getDepartmentStats(departmentName);

      // Find department in stats collection
      const statsRef = collection(db, 'stats');
      const q = query(statsRef, where('name', '==', departmentName));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Department not found in stats, return current stats unchanged
        return stats;
      }

      // Extract department code from existing roll numbers
      let departmentCode = null;
      try {
        // Query for a sample student with roll number to extract department code
        const studentsQuery = query(
          collection(db, collectionName),
          where('rollNumber', '!=', null),
          limit(1)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        if (!studentsSnapshot.empty) {
          const sampleStudent = studentsSnapshot.docs[0].data();
          if (sampleStudent.rollNumber && sampleStudent.rollNumber.length >= 9) {
            // Extract department code from roll number (positions 6-9)
            departmentCode = sampleStudent.rollNumber.substring(6, 9);
            console.log(`Extracted department code ${departmentCode} for ${departmentName}`);
          }
        }
      } catch (codeError) {
        console.warn(`Could not extract department code for ${departmentName}:`, codeError.message);
      }

      // Update the first matching document with comprehensive stats including department code
      const deptDoc = querySnapshot.docs[0];
      const updateData = {
        totalStudents: stats.totalStudents,
        activeStudents: stats.activeStudents,
        inactiveStudents: stats.totalStudents - stats.activeStudents,
        lastSync: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };

      // Only add department code if successfully extracted
      if (departmentCode) {
        updateData.departmentCode = departmentCode;
      }

      await updateDoc(deptDoc.ref, updateData);

      // Stats updated successfully for department
    } catch (error) {
      console.error(`Error updating department stats for ${departmentName}:`, error);
      throw new Error('Failed to update department stats');
    }
  },

  // Get all departments from stats collection
  async getAllDepartmentsFromStats() {
    try {
      const q = query(collection(db, 'stats'), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      const departments = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        departments.push({
          id: doc.id,
          name: data.name,
          collectionName: data.collectionName,
          departmentCode: data.departmentCode, // Include department code
          totalStudents: data.totalStudents || 0,
          activeStudents: data.activeStudents || 0,
          inactiveStudents: data.inactiveStudents || 0,
          lastSync: data.lastSync,
          createdAt: data.createdAt,
          lastUpdated: data.lastUpdated,
          createdBy: data.createdBy,
          createdByName: data.createdByName
        });
      });

      return departments.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error getting departments from stats:', error);
      return [];
    }
  },

  // Optimized function for overview page - returns only essential department data
  async getDepartmentsOverview() {
    try {
      // Use single where clause to avoid composite index requirement
      const q = query(
        collection(db, 'stats'), 
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const departments = [];
      let totalStudentsAcrossAllDepts = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter out departments with 0 students in JavaScript instead of Firestore
        if (data.totalStudents > 0) {
          const dept = {
            id: doc.id,
            name: data.name,
            collectionName: data.collectionName,
            totalStudents: data.totalStudents || 0,
            activeStudents: data.activeStudents || 0,
            inactiveStudents: data.inactiveStudents || 0,
            lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
          };
          departments.push(dept);
          totalStudentsAcrossAllDepts += dept.totalStudents;
        }
      });

      const result = {
        departments: departments.sort((a, b) => a.name.localeCompare(b.name)),
        summary: {
          totalDepartments: departments.length,
          totalStudents: totalStudentsAcrossAllDepts,
          averageStudentsPerDept: departments.length > 0 ? Math.round(totalStudentsAcrossAllDepts / departments.length) : 0
        }
      };
      
      return result;
    } catch (error) {
      console.error('Error getting departments overview:', error);
      return {
        departments: [],
        summary: {
          totalDepartments: 0,
          totalStudents: 0,
          averageStudentsPerDept: 0
        }
      };
    }
  },

  // Sync existing collections with stats (one-time setup)
  async syncExistingDepartments(creatorInfo) {
    try {
      const knownCollections = [
        "students_aids_1",
        "students_aids_2", 
        "students_aiml",
        "students_bio_tech",
        "students_chem",
        "students_civil_1",
        "students_civil_2",
        "students_cse_1",
        "students_cse_2",
        "students_cse_3",
        "students_csm",
        "students_ece_1",
        "students_ece_2",
        "students_ece_3",
        "students_eee_1",
        "students_eee_2",
        "students_iot",
        "students_mech_1",
        "students_mech_2",
        "students_it_1",
        "students_it_2",
        "students_it_3"
      ];

      const results = [];

      for (const collectionName of knownCollections) {
        try {
          // Check if collection has data
          const q = query(collection(db, collectionName), limit(1));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const departmentName = this.collectionNameToDepartment(collectionName);
            await this.registerDepartment(departmentName, collectionName, creatorInfo);
            await this.updateDepartmentStats(departmentName);
            results.push(departmentName);
          }
        } catch (error) {
          console.log(`Skipping ${collectionName}: ${error.message}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Error syncing existing departments:', error);
      throw new Error('Failed to sync existing departments');
    }
  },
  // Get all departments that have student collections by checking stats
  async getAllDepartments() {
    try {
      // First try to get from stats collection
      const departmentsFromStats = await this.getAllDepartmentsFromStats();
      
      if (departmentsFromStats.length > 0) {
        return departmentsFromStats.map(dept => dept.name);
      }

      // Fallback: scan for existing collections (for backward compatibility)
      console.log('No departments in stats, scanning collections...');
      const knownCollections = [
        "students_aids_1",
        "students_aids_2",
        "students_aiml",
        "students_bio_tech",
        "students_chem",
        "students_civil_1",
        "students_civil_2",
        "students_cse_1",
        "students_cse_2",
        "students_cse_3",
        "students_csm",
        "students_ece_1",
        "students_ece_2",
        "students_ece_3",
        "students_eee_1",
        "students_eee_2",
        "students_iot",
        "students_mech_1",
        "students_mech_2",
        "students_it_1",
        "students_it_2",
        "students_it_3"
      ];

      const existingDepartments = [];

      for (const collectionName of knownCollections) {
        try {
          // Try to get at least one document to check if collection exists and has data
          const q = query(collection(db, collectionName), limit(1));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            // Convert collection name back to readable department name
            const departmentName = this.collectionNameToDepartment(collectionName);
            existingDepartments.push(departmentName);
          }
        } catch (error) {
          // Collection doesn't exist or no access, skip it
          console.log(`Collection ${collectionName} doesn't exist or has no documents`);
        }
      }

      return existingDepartments;
    } catch (error) {
      console.error("Error fetching departments:", error);
      throw new Error("Failed to fetch departments");
    }
  },

  // Convert collection name to readable department name
  collectionNameToDepartment(collectionName) {
    const mapping = {
      students_aids_1: "Artificial Intelligence and Data Science 1",
      students_aids_2: "Artificial Intelligence and Data Science 2",
      students_aiml: "Artificial Intelligence and Machine Learning",
      students_bio_tech: "Biotechnology",
      students_chem: "Chemical Engineering",
      students_civil_1: "Civil Engineering 1",
      students_civil_2: "Civil Engineering 2",
      students_cse_1: "Computer Science Engineering 1",
      students_cse_2: "Computer Science Engineering 2",
      students_cse_3: "Computer Science Engineering 3",
      students_csm: "Computer Science and Engineering (AI&ML)",
      students_ece_1: "Electronics and Communication Engineering 1",
      students_ece_2: "Electronics and Communication Engineering 2",
      students_ece_3: "Electronics and Communication Engineering 3",
      students_eee_1: "Electrical and Electronics Engineering 1",
      students_eee_2: "Electrical and Electronics Engineering 2",
      students_iot: "Internet of Things",
      students_mech_1: "Mechanical Engineering 1",
      students_mech_2: "Mechanical Engineering 2",
      students_it_1: "Information Technology 1",
      students_it_2: "Information Technology 2",
      students_it_3: "Information Technology 3",
    };

    return mapping[collectionName] || collectionName;
  },

  // Get all department collections that exist (for admin purposes)
  async getExistingDepartmentCollections() {
    try {
      // Get departments from stats with updated stats
      const departmentsFromStats = await this.getAllDepartmentsFromStats();
      
      if (departmentsFromStats.length > 0) {
        // Update stats for each department and return
        const updatedDepartments = [];
        
        for (const dept of departmentsFromStats) {
          try {
            // Get fresh stats
            const stats = await this.getDepartmentStats(dept.name);
            
            // Update stats if stats changed
            if (stats.totalStudents !== dept.totalStudents || stats.activeStudents !== dept.activeStudents) {
              await this.updateDepartmentStats(dept.name);
            }
            
            updatedDepartments.push({
              name: dept.name,
              collectionName: dept.collectionName,
              totalStudents: stats.totalStudents,
              activeStudents: stats.activeStudents
            });
          } catch (error) {
            console.log(`Error updating stats for ${dept.name}: ${error.message}`);
            // Use cached stats if fresh stats fail
            updatedDepartments.push(dept);
          }
        }
        
        return updatedDepartments.filter(dept => dept.totalStudents > 0);
      }

      // Fallback: scan for existing collections
      const existingDepartments = await this.getAllDepartments();
      const departmentInfo = [];

      for (const dept of existingDepartments) {
        try {
          const collectionName = this.getDepartmentCollectionName(dept);
          const stats = await this.getDepartmentStats(dept);

          if (stats.totalStudents > 0) {
            departmentInfo.push({
              name: dept,
              collectionName,
              totalStudents: stats.totalStudents,
              activeStudents: stats.activeStudents,
            });
          }
        } catch (error) {
          // Collection doesn't exist or no access, skip it
          console.log(`Skipping ${dept}: ${error.message}`);
        }
      }

      return departmentInfo;
    } catch (error) {
      console.error("Error fetching existing department collections:", error);
      throw new Error("Failed to fetch department collections");
    }
  },

  // Get collection name for a department (updated to use proper mapping)
  getDepartmentCollectionName(department) {
    // First try the exact mapping
    const mapping = {
      "Artificial Intelligence and Data Science 1": "students_aids_1",
      "Artificial Intelligence and Data Science 2": "students_aids_2",
      "Artificial Intelligence and Machine Learning": "students_aiml",
      Biotechnology: "students_bio_tech",
      "Chemical Engineering": "students_chem",
      "Civil Engineering 1": "students_civil_1",
      "Civil Engineering 2": "students_civil_2",
      "Computer Science Engineering 1": "students_cse_1",
      "Computer Science Engineering 2": "students_cse_2",
      "Computer Science Engineering 3": "students_cse_3",
      "Computer Science and Engineering (AI&ML)": "students_csm",
      "Electronics and Communication Engineering 1": "students_ece_1",
      "Electronics and Communication Engineering 2": "students_ece_2",
      "Electronics and Communication Engineering 3": "students_ece_3",
      "Electrical and Electronics Engineering 1": "students_eee_1",
      "Electrical and Electronics Engineering 2": "students_eee_2",
      "Internet of Things": "students_iot",
      "Mechanical Engineering 1": "students_mech_1",
      "Mechanical Engineering 2": "students_mech_2",
      "Information Technology 1": "students_it_1",
      "Information Technology 2": "students_it_2",
      "Information Technology 3": "students_it_3",
    };

    // Return mapped collection name or fallback to generated name
    return (
      mapping[department] ||
      `students_${department.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
    );
  },

  // Add a single student to a department
  async addStudent(studentData, department, creatorInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      
      // Register department in metadata if not already registered
      await this.registerDepartment(department, collectionName, creatorInfo);
      
      const studentDoc = {
        ...studentData,
        department,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: creatorInfo.id,
        createdByName: creatorInfo.name,
        lastUpdatedBy: creatorInfo.id,
        lastUpdatedByName: creatorInfo.name,
      };

      const docRef = await addDoc(collection(db, collectionName), studentDoc);
      
      // Update department stats after adding student
      await this.updateDepartmentStats(department);
      
      // Student added successfully
      return { id: docRef.id, ...studentDoc };
    } catch (error) {
      console.error("Error adding student:", error);
      throw new Error("Failed to add student");
    }
  },

  // Bulk import students for a department
  async bulkImportStudents(studentsData, department, creatorInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const batch = writeBatch(db);
      const results = [];

      console.log(
        `Starting bulk import for ${department}:`,
        studentsData.length,
        "students"
      );

      // Register department in metadata if not already registered
      await this.registerDepartment(department, collectionName, creatorInfo);

      for (const studentData of studentsData) {
        // Validate required fields
        if (
          !studentData.name ||
          !studentData.rollNumber ||
          !studentData.admissionNumber
        ) {
          console.warn("Skipping student with missing data:", studentData);
          continue;
        }

        const docRef = doc(collection(db, collectionName));
        const studentDoc = {
          name: studentData.name.toString().trim(),
          rollNumber: studentData.rollNumber.toString().trim(),
          admissionNumber: studentData.admissionNumber.toString().trim(),
          year: studentData.year ? studentData.year.toString().trim() : "",
          department,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: creatorInfo.id,
          createdByName: creatorInfo.name,
          lastUpdatedBy: creatorInfo.id,
          lastUpdatedByName: creatorInfo.name,
        };

        batch.set(docRef, studentDoc);
        results.push({ id: docRef.id, ...studentDoc });
      }

      await batch.commit();
      
      // Update department stats in metadata after successful import
      await this.updateDepartmentStats(department);
      
      console.log(
        `Successfully imported ${results.length} students to ${department}`
      );
      return results;
    } catch (error) {
      console.error("Error in bulk import:", error);
      throw new Error(`Failed to import students: ${error.message}`);
    }
  },

  // Get all students from a department
  async getStudentsByDepartment(department) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const q = query(
        collection(db, collectionName),
        where("isActive", "==", true)
      );

      const querySnapshot = await getDocs(q);
      const students = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          id: doc.id,
          ...data,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt:
            data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        });
      });

      // Sort by roll number in JavaScript
      return students.sort((a, b) => {
        const rollA = a.rollNumber || "";
        const rollB = b.rollNumber || "";
        return rollA.localeCompare(rollB);
      });
    } catch (error) {
      console.error("Error fetching students by department:", error);
      throw new Error("Failed to fetch students");
    }
  },

  // Bulk import with merge capability for handling duplicates
  async bulkImportWithMerge(studentsData, department, creatorInfo, mergeStrategy = 'merge') {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const batch = writeBatch(db);
      const results = {
        added: 0,
        updated: 0,
        skipped: 0,
        newStudents: [], // New students added to this department
        updatedStudents: [], // Existing students that were updated
        skippedStudents: [], // Students that were skipped
        existingCount: 0, // Count of students that were already in the department
        details: [],
        summary: {
          beforeImport: 0,
          afterImport: 0
        }
      };

      console.log(
        `Starting bulk import with merge for ${department}:`,
        studentsData.length,
        "students, strategy:",
        mergeStrategy
      );

      // Register department in metadata if not already registered
      await this.registerDepartment(department, collectionName, creatorInfo);

      // Get existing students count and data for comparison
      const existingQuery = query(collection(db, collectionName));
      const existingSnapshot = await getDocs(existingQuery);
      results.existingCount = existingSnapshot.size;
      results.summary.beforeImport = existingSnapshot.size;

      // If replace strategy, delete all existing students first
      if (mergeStrategy === 'replace') {
        existingSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        console.log(`Marked ${existingSnapshot.size} existing students for deletion (replace strategy)`);
        results.existingCount = 0; // Reset since we're replacing all
        results.summary.beforeImport = 0;
      }

      // Create map of existing students for duplicate detection
      const existingStudents = new Map();
      const existingStudentsList = [];
      
      if (mergeStrategy !== 'replace') {
        existingSnapshot.docs.forEach(doc => {
          const student = doc.data();
          existingStudentsList.push(student);
          
          // Create keys for duplicate detection
          const admissionKey = student.admissionNumber?.toLowerCase().trim();
          const rollKey = student.rollNumber?.toLowerCase().trim();
          
          if (admissionKey) existingStudents.set(`admission:${admissionKey}`, { ...student, docId: doc.id });
          if (rollKey) existingStudents.set(`roll:${rollKey}`, { ...student, docId: doc.id });
        });
      }

      // Process each student from the import data
      for (const studentData of studentsData) {
        // Validate required fields
        if (
          !studentData.name ||
          !studentData.rollNumber ||
          !studentData.admissionNumber
        ) {
          console.warn("Skipping student with missing data:", studentData);
          results.skipped++;
          results.skippedStudents.push({
            name: studentData.name || 'Unknown',
            reason: 'Missing required data',
            data: studentData
          });
          results.details.push(`Skipped: Missing required data for ${studentData.name || 'Unknown'}`);
          continue;
        }

        const admissionNumber = studentData.admissionNumber.toString().trim();
        const rollNumber = studentData.rollNumber.toString().trim();
        const name = studentData.name.toString().trim();

        // Check for duplicates
        let existingStudent = null;
        let matchType = '';

        // Priority 1: Admission number match
        const admKey = admissionNumber.toLowerCase();
        if (existingStudents.has(`admission:${admKey}`)) {
          existingStudent = existingStudents.get(`admission:${admKey}`);
          matchType = 'admission';
        }

        // Priority 2: Roll number match
        if (!existingStudent) {
          const rollKey = rollNumber.toLowerCase();
          if (existingStudents.has(`roll:${rollKey}`)) {
            existingStudent = existingStudents.get(`roll:${rollKey}`);
            matchType = 'roll';
          }
        }

        if (existingStudent && mergeStrategy === 'merge') {
          // Student exists - check if update is needed
          const needsUpdate = this.compareStudentData(existingStudent, {
            name,
            rollNumber,
            admissionNumber,
            department,
            year: studentData.year ? studentData.year.toString().trim() : ""
          });

          if (needsUpdate.hasChanges) {
            // Update existing student
            const updateData = {
              name,
              rollNumber,
              admissionNumber,
              department,
              year: studentData.year ? studentData.year.toString().trim() : "",
              updatedAt: serverTimestamp(),
              lastUpdatedBy: creatorInfo.id,
              lastUpdatedByName: creatorInfo.name,
            };

            const docRef = doc(db, collectionName, existingStudent.docId);
            batch.update(docRef, updateData);

            results.updated++;
            results.updatedStudents.push({
              ...existingStudent,
              updatedFields: needsUpdate.changes
            });
            results.details.push(`Updated: ${name} (${needsUpdate.changes.join(', ')})`);
          } else {
            // No changes needed
            results.skipped++;
            results.skippedStudents.push({
              name,
              reason: 'Already exists with same data',
              matchType
            });
            results.details.push(`Skipped: ${name} (already exists)`);
          }
        } else if (!existingStudent || mergeStrategy === 'replace') {
          // Add new student
          const docRef = doc(collection(db, collectionName));
          const studentDoc = {
            name,
            rollNumber,
            admissionNumber,
            year: studentData.year ? studentData.year.toString().trim() : "",
            department,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: creatorInfo.id,
            createdByName: creatorInfo.name,
            lastUpdatedBy: creatorInfo.id,
            lastUpdatedByName: creatorInfo.name,
          };

          batch.set(docRef, studentDoc);

          results.added++;
          results.newStudents.push({
            id: docRef.id,
            ...studentDoc
          });
          results.details.push(`Added: ${name}`);
        } else {
          // Skip due to duplicate (when strategy is skip)
          results.skipped++;
          results.skippedStudents.push({
            name,
            reason: 'Duplicate found',
            matchType
          });
          results.details.push(`Skipped: ${name} (duplicate)`);
        }
      }

      // Commit the batch
      await batch.commit();

      // Calculate final count
      const finalQuery = query(collection(db, collectionName));
      const finalSnapshot = await getDocs(finalQuery);
      results.summary.afterImport = finalSnapshot.size;

      // Update department stats
      await this.updateDepartmentStats(department);

      console.log(
        `Bulk import with merge completed for ${department}:`,
        `${results.added} added, ${results.updated} updated, ${results.skipped} skipped`
      );

      return results;
    } catch (error) {
      console.error("Error in bulk import with merge:", error);
      throw new Error(`Failed to import students with merge: ${error.message}`);
    }
  },

  // Helper function to compare student data
  compareStudentData(existing, incoming) {
    const changes = [];
    let hasChanges = false;

    if (existing.name !== incoming.name) {
      changes.push(`name: "${existing.name}" → "${incoming.name}"`);
      hasChanges = true;
    }

    if (existing.rollNumber !== incoming.rollNumber) {
      changes.push(`rollNumber: "${existing.rollNumber}" → "${incoming.rollNumber}"`);
      hasChanges = true;
    }

    if (existing.admissionNumber !== incoming.admissionNumber) {
      changes.push(`admissionNumber: "${existing.admissionNumber}" → "${incoming.admissionNumber}"`);
      hasChanges = true;
    }

    if (existing.year !== incoming.year) {
      changes.push(`year: "${existing.year || 'N/A'}" → "${incoming.year || 'N/A'}"`);
      hasChanges = true;
    }

    return { hasChanges, changes };
  },

  // Get student by ID from specific department
  async getStudentById(studentId, department) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const docRef = doc(db, collectionName, studentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt:
            data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching student:", error);
      throw new Error("Failed to fetch student");
    }
  },

  // Update student information
  async updateStudent(studentId, department, updateData, updaterInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const docRef = doc(db, collectionName, studentId);

      const updateDoc = {
        ...updateData,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo.id,
        lastUpdatedByName: updaterInfo.name,
      };

      await updateDoc(docRef, updateDoc);
      // Student updated successfully
      return { id: studentId, ...updateDoc };
    } catch (error) {
      console.error("Error updating student:", error);
      throw new Error("Failed to update student");
    }
  },

  // Soft delete student (mark as inactive)
  async deleteStudent(studentId, department, deleterInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const docRef = doc(db, collectionName, studentId);

      await updateDoc(docRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: deleterInfo.id,
        lastUpdatedByName: deleterInfo.name,
      });

      // Student deleted successfully
      return true;
    } catch (error) {
      console.error("Error deleting student:", error);
      throw new Error("Failed to delete student");
    }
  },

  // Search students across all departments
  async searchStudents(searchTerm) {
    try {
      const departments = await this.getAllDepartments();
      const allStudents = [];

      for (const department of departments) {
        try {
          const students = await this.getStudentsByDepartment(department);
          const filteredStudents = students.filter(
            (student) =>
              student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              student.rollNumber
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              student.admissionNumber
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
          );
          allStudents.push(...filteredStudents);
        } catch (error) {
          // Department collection might not exist yet, continue with others
          console.log(`No students found in ${department}`);
        }
      }

      return allStudents;
    } catch (error) {
      console.error("Error searching students:", error);
      throw new Error("Failed to search students");
    }
  },

  // Optimized search by admission number using section code mapping
  async searchByAdmissionNumber(admissionNumber, options = {}) {
    const { useCache = true, forceDirect = false } = options;
    
    if (useCache && !forceDirect) {
      try {
        return await this.searchByAdmissionNumberCached(admissionNumber);
      } catch (error) {
        console.warn("Cache search failed, falling back to direct search:", error);
      }
    }

    // Original direct database search implementation
    return await this._searchByAdmissionNumberDirect(admissionNumber);
  },

  // Enhanced search by roll number with caching support
  async searchByRollNumber(rollNumber, options = {}) {
    const { useCache = true, forceDirect = false } = options;
    
    if (useCache && !forceDirect) {
      try {
        return await this.searchByRollNumberCached(rollNumber);
      } catch (error) {
        console.warn("Cache search failed, falling back to direct search:", error);
      }
    }

    // Original direct database search implementation
    return await this._searchByRollNumberDirect(rollNumber);
  },

  // Optimized batch search for multiple admission numbers using section mapping
  async optimizedBatchSearchByAdmissionNumbers(admissionNumbers) {
    try {
      const results = {
        found: [],
        notFound: [],
        errors: []
      };

      // Step 1: Group admission numbers by target collections
      const collectionGroups = {};
      const unmappedNumbers = [];

      for (const admissionNumber of admissionNumbers) {
        const targetCollection = admissionNumberParser.getTargetCollection(admissionNumber);
        if (targetCollection) {
          if (!collectionGroups[targetCollection]) {
            collectionGroups[targetCollection] = [];
          }
          collectionGroups[targetCollection].push(admissionNumber);
        } else {
          unmappedNumbers.push(admissionNumber);
        }
      }

      // Step 2: Search each collection group efficiently
      for (const [collectionName, groupedNumbers] of Object.entries(collectionGroups)) {
        try {
          // Use Firestore 'in' operator for batch queries (max 10 per query)
          const batchSize = 10;
          for (let i = 0; i < groupedNumbers.length; i += batchSize) {
            const batch = groupedNumbers.slice(i, i + batchSize);
            
            const q = query(
              collection(db, collectionName),
              where('admissionNumber', 'in', batch),
              where('isActive', '==', true)
            );

            const querySnapshot = await getDocs(q);
            const foundNumbers = new Set();

            querySnapshot.forEach((doc) => {
              const studentData = doc.data();
              const parseResult = admissionNumberParser.parseAdmissionNumber(studentData.admissionNumber);
              
              foundNumbers.add(studentData.admissionNumber);
              results.found.push({
                admissionNumber: studentData.admissionNumber,
                student: {
                  id: doc.id,
                  name: studentData.name || "N/A",
                  rollNumber: studentData.rollNumber || "N/A",
                  admissionNumber: studentData.admissionNumber || "N/A",
                  department: studentData.department || parseResult?.departmentInfo?.fullName || "N/A",
                  departmentCode: studentData.departmentCode || parseResult?.sectionCode || "N/A",
                  year: studentData.year || "N/A",
                  isActive: studentData.isActive,
                  createdAt: studentData.createdAt?.toDate?.()?.toISOString() || studentData.createdAt,
                  updatedAt: studentData.updatedAt?.toDate?.()?.toISOString() || studentData.updatedAt
                },
                department: studentData.department || parseResult?.departmentInfo?.fullName,
                collectionName: collectionName,
                searchMethod: "optimized_batch_section_mapping"
              });
            });

            // Mark unfound numbers from this batch
            for (const admissionNumber of batch) {
              if (!foundNumbers.has(admissionNumber)) {
                results.notFound.push({ 
                  admissionNumber, 
                  error: `Student not found in expected collection ${collectionName}`,
                  expectedCollection: collectionName
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error searching collection ${collectionName}:`, error);
          // Mark all numbers in this collection as errors
          for (const admissionNumber of collectionGroups[collectionName]) {
            results.errors.push({ 
              admissionNumber, 
              error: `Collection search failed: ${error.message}`,
              collection: collectionName
            });
          }
        }
      }

      // Step 3: Handle unmapped admission numbers with fallback search
      if (unmappedNumbers.length > 0) {
        console.warn(`${unmappedNumbers.length} admission numbers could not be mapped to collections, using fallback search`);
        
        for (const admissionNumber of unmappedNumbers) {
          try {
            const result = await this.searchByAdmissionNumber(admissionNumber);
            if (result.found) {
              results.found.push({ 
                admissionNumber, 
                ...result, 
                searchMethod: "fallback_unmapped" 
              });
            } else {
              results.notFound.push({ admissionNumber, error: result.error });
            }
          } catch (error) {
            results.errors.push({ admissionNumber, error: error.message });
          }
        }
      }

      return {
        summary: {
          total: admissionNumbers.length,
          found: results.found.length,
          notFound: results.notFound.length,
          errors: results.errors.length,
          mappedToCollections: Object.keys(collectionGroups).length,
          unmappedNumbers: unmappedNumbers.length
        },
        collectionGroups: Object.keys(collectionGroups),
        ...results
      };
    } catch (error) {
      console.error("Error in optimized batch search:", error);
      throw new Error("Failed to perform optimized batch search");
    }
  },

  // Enhanced batch search with intelligent caching
  async batchSearchByAdmissionNumbers(admissionNumbers, options = {}) {
    const { useCache = null, threshold = 20 } = options;
    
    // Auto-determine whether to use cache based on batch size
    const shouldUseCache = useCache !== null ? useCache : admissionNumbers.length >= threshold;
    
    if (shouldUseCache) {
      try {
        return await this.batchSearchByAdmissionNumbersCached(admissionNumbers);
      } catch (error) {
        console.warn("Cached batch search failed, falling back to optimized direct search:", error);
      }
    }

    // Use optimized direct search for smaller batches
    return await this.optimizedBatchSearchByAdmissionNumbers(admissionNumbers);
  },

  // Batch search for multiple roll numbers (optimized for Excel processing)
  async batchSearchByRollNumbers(rollNumbers) {
    try {
      const results = {
        found: [],
        notFound: [],
        errors: []
      };

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < rollNumbers.length; i += batchSize) {
        const batch = rollNumbers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (rollNumber) => {
          try {
            const result = await this.searchByRollNumber(rollNumber);
            if (result.found) {
              results.found.push({ rollNumber, ...result });
            } else {
              results.notFound.push({ rollNumber, error: result.error });
            }
          } catch (error) {
            results.errors.push({ rollNumber, error: error.message });
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to prevent rate limiting
        if (i + batchSize < rollNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        summary: {
          total: rollNumbers.length,
          found: results.found.length,
          notFound: results.notFound.length,
          errors: results.errors.length
        },
        ...results
      };
    } catch (error) {
      console.error("Error in batch roll number search:", error);
      throw new Error("Failed to perform batch roll number search");
    }
  },

  // Get statistics for a specific department
  async getDepartmentStats(department) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);

      let totalStudents = 0;
      let activeStudents = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalStudents++;
        if (data.isActive !== false) {
          activeStudents++;
        }
      });

      return { totalStudents, activeStudents };
    } catch (error) {
      console.error(`Error fetching stats for ${department}:`, error);
      return { totalStudents: 0, activeStudents: 0 };
    }
  },

  // Get statistics for admin dashboard
  async getStudentStats() {
    try {
      const departments = await this.getAllDepartments();
      const stats = {
        totalStudents: 0,
        departmentCounts: {},
        totalDepartments: 0,
      };

      for (const department of departments) {
        try {
          const students = await this.getStudentsByDepartment(department);
          if (students.length > 0) {
            stats.departmentCounts[department] = students.length;
            stats.totalStudents += students.length;
            stats.totalDepartments++;
          }
        } catch (error) {
          // Department collection might not exist
          stats.departmentCounts[department] = 0;
        }
      }

      return stats;
    } catch (error) {
      console.error("Error fetching student stats:", error);
      throw new Error("Failed to fetch student statistics");
    }
  },

  // Clear all students from a department (for re-import)
  async clearDepartmentStudents(department, clearedByInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);

      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      // Cleared all students from department
      return true;
    } catch (error) {
      console.error("Error clearing department students:", error);
      throw new Error("Failed to clear department students");
    }
  },

  // Initialize stats system by syncing existing departments
  async initializeStatsSystem(creatorInfo = { id: 'system', name: 'System' }) {
    try {
      console.log('Initializing department stats system...');
      
      // Check if stats collection exists and has data
      const statsSnapshot = await getDocs(collection(db, 'stats'));
      
      if (statsSnapshot.empty) {
        console.log('No stats found, syncing existing departments...');
        
        // Sync all existing departments
        const syncedDepartments = await this.syncExistingDepartments(creatorInfo);
        
        console.log(`Initialized stats for ${syncedDepartments.length} departments:`, syncedDepartments);
        return {
          success: true,
          message: `Initialized stats for ${syncedDepartments.length} departments`,
          departments: syncedDepartments
        };
      } else {
        console.log('Stats collection already exists with data, updating stats...');
        
        // Update stats for existing stats entries
        const departments = await this.getAllDepartmentsFromStats();
        let updatedCount = 0;
        
        for (const dept of departments) {
          try {
            await this.updateDepartmentStats(dept.name);
            updatedCount++;
          } catch (error) {
            console.log(`Failed to update stats for ${dept.name}: ${error.message}`);
          }
        }
        
        return {
          success: true,
          message: `Updated stats for ${updatedCount} existing departments`,
          departments: departments.map(d => d.name)
        };
      }
    } catch (error) {
      console.error('Error initializing stats system:', error);
      throw new Error(`Failed to initialize stats system: ${error.message}`);
    }
  },

  // Refresh all department stats (useful for periodic updates)
  async refreshAllDepartmentStats() {
    try {
      console.log('Refreshing all department stats...');
      
      const departments = await this.getAllDepartmentsFromStats();
      let refreshedCount = 0;
      const errors = [];

      for (const dept of departments) {
        try {
          await this.updateDepartmentStats(dept.name);
          refreshedCount++;
        } catch (error) {
          console.log(`Failed to refresh stats for ${dept.name}: ${error.message}`);
          errors.push({ department: dept.name, error: error.message });
        }
      }
      
      console.log(`Refreshed stats for ${refreshedCount}/${departments.length} departments`);
      
      return {
        success: true,
        refreshedCount,
        totalDepartments: departments.length,
        errors: errors.length > 0 ? errors : null
      };
    } catch (error) {
      console.error('Error refreshing department stats:', error);
      throw new Error(`Failed to refresh department stats: ${error.message}`);
    }
  },

  // Complete stats calculation and population function
  async calculateAndPopulateAllStats(creatorInfo) {
    try {
      console.log('Starting complete stats calculation and population...');
      
      // Step 1: Sync all existing departments
      const syncedDepartments = await this.syncExistingDepartments(creatorInfo);
      console.log(`Synced ${syncedDepartments.length} departments:`, syncedDepartments);
      
      // Step 2: Refresh all department stats
      const refreshResult = await this.refreshAllDepartmentStats();
      console.log('Refresh result:', refreshResult);
      
      // Step 3: Verify stats collection integrity
      const allStats = await this.getAllDepartmentsFromStats();
      console.log(`Verified ${allStats.length} departments in stats collection`);
      
      // Step 4: Calculate summary statistics
      const summary = {
        totalDepartments: allStats.length,
        totalStudents: allStats.reduce((sum, dept) => sum + dept.totalStudents, 0),
        activeStudents: allStats.reduce((sum, dept) => sum + dept.activeStudents, 0),
        inactiveStudents: allStats.reduce((sum, dept) => sum + dept.inactiveStudents, 0),
        lastCalculated: new Date().toISOString()
      };
      
      console.log('Final summary:', summary);
      
      return {
        success: true,
        syncedDepartments: syncedDepartments.length,
        refreshedDepartments: refreshResult.refreshedCount,
        summary,
        errors: refreshResult.errors
      };
    } catch (error) {
      console.error('Error in complete stats calculation:', error);
      throw new Error(`Failed to calculate and populate stats: ${error.message}`);
    }
  },

  // Debug function to check what student collections exist
  async debugExistingCollections() {
    try {
      const knownCollections = [
        "students_aids_1",
        "students_aids_2", 
        "students_aiml",
        "students_bio_tech",
        "students_chem",
        "students_civil_1",
        "students_civil_2",
        "students_cse_1",
        "students_cse_2",
        "students_cse_3",
        "students_csm",
        "students_ece_1",
        "students_ece_2",
        "students_ece_3",
        "students_eee_1",
        "students_eee_2",
        "students_iot",
        "students_mech_1",
        "students_mech_2",
        "students_it_1",
        "students_it_2",
        "students_it_3"
      ];

      const existingCollections = [];
      const emptyCollections = [];

      for (const collectionName of knownCollections) {
        try {
          const q = query(collection(db, collectionName), limit(1));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const count = await this.getStudentCountByCollectionName(collectionName);
            existingCollections.push({
              collectionName,
              departmentName: this.collectionNameToDepartment(collectionName),
              studentCount: count
            });
          } else {
            emptyCollections.push(collectionName);
          }
        } catch (error) {
          emptyCollections.push(collectionName);
        }
      }

      return {
        existingCollections,
        emptyCollections,
        totalExisting: existingCollections.length,
        totalEmpty: emptyCollections.length
      };
    } catch (error) {
      console.error('Error debugging collections:', error);
      throw new Error('Failed to debug existing collections');
    }
  },

  // Helper function to get student count by collection name
  async getStudentCountByCollectionName(collectionName) {
    try {
      const studentsRef = collection(db, collectionName);
      const snapshot = await getDocs(studentsRef);
      return snapshot.size;
    } catch (error) {
      console.error(`Error getting count for ${collectionName}:`, error);
      return 0;
    }
  },

  // ==========================================================
  // OPTIMIZED CACHED SEARCH METHODS
  // These methods use the cache to minimize Firestore reads
  // ==========================================================

  // Cached search by admission number (primary optimized method)
  async searchByAdmissionNumberCached(admissionNumber) {
    try {
      return await studentsCache.searchByAdmissionNumber(admissionNumber);
    } catch (error) {
      console.error("Error in cached admission number search:", error);
      // Fallback to direct database search if cache fails
      return await this._searchByAdmissionNumberDirect(admissionNumber);
    }
  },

  // Cached search by roll number (primary optimized method)
  async searchByRollNumberCached(rollNumber) {
    try {
      return await studentsCache.searchByRollNumber(rollNumber);
    } catch (error) {
      console.error("Error in cached roll number search:", error);
      // Fallback to direct database search if cache fails
      return await this._searchByRollNumberDirect(rollNumber);
    }
  },

  // Cached batch search (primary optimized method for batch operations)
  async batchSearchByAdmissionNumbersCached(admissionNumbers) {
    try {
      return await studentsCache.batchSearchByAdmissionNumbers(admissionNumbers);
    } catch (error) {
      console.error("Error in cached batch search:", error);
      // Fallback to direct database search if cache fails
      return await this._batchSearchByAdmissionNumbersDirect(admissionNumbers);
    }
  },

  // Smart batch search - uses cache when beneficial, direct when not
  async smartBatchSearch(admissionNumbers, options = {}) {
    const { 
      forceCached = false, 
      forceDirect = false, 
      cacheThreshold = 50 // Use cache if searching for more than 50 students
    } = options;

    try {
      // If explicitly requested to use cache or batch size exceeds threshold
      if (forceCached || (!forceDirect && admissionNumbers.length >= cacheThreshold)) {
        // Using cached search for admission numbers
        return await this.batchSearchByAdmissionNumbersCached(admissionNumbers);
      } else {
        console.log(`Using direct search for ${admissionNumbers.length} admission numbers`);
        return await this.optimizedBatchSearchByAdmissionNumbers(admissionNumbers);
      }
    } catch (error) {
      console.error("Error in smart batch search:", error);
      // Final fallback to legacy batch search
      return await this._batchSearchByAdmissionNumbersDirect(admissionNumbers);
    }
  },

  // Cache management methods
  async preloadStudentsCache() {
    try {
      return await studentsCache.preloadCache();
    } catch (error) {
      console.error("Error preloading students cache:", error);
      return false;
    }
  },

  async refreshStudentsCache() {
    try {
      return await studentsCache.forceRefresh();
    } catch (error) {
      console.error("Error refreshing students cache:", error);
      return false;
    }
  },

  clearStudentsCache() {
    studentsCache.clearCache();
  },

  getStudentsCacheStats() {
    return studentsCache.getCacheStats();
  },

  // ==========================================================
  // ADMIN COLLECTION MANAGEMENT METHODS
  // These methods allow admins to manage entire collections
  // ==========================================================

  // Get detailed information about all collections
  // Lightweight collection listing - optimized for minimal reads
  async getAllCollectionsBasic() {
    try {
      const statsCollection = await this.getAllDepartmentsFromStats();
      const collectionsBasic = [];

      for (const deptStats of statsCollection) {
        try {
          const department = deptStats.name;
          const collectionName = this.getDepartmentCollectionName(department);
          
          collectionsBasic.push({
            department,
            collectionName,
            totalStudents: deptStats.totalStudents || 0,
            activeStudents: deptStats.activeStudents || 0,
            inactiveStudents: deptStats.inactiveStudents || 0,
            recentStudents: deptStats.recentStudents || 0,
            createdAt: deptStats.createdAt || null,
            lastUpdated: deptStats.lastUpdated || null,
            createdBy: deptStats.createdByName || deptStats.createdBy || 'Unknown',
            departmentCode: deptStats.departmentCode || null,
            hasStudents: (deptStats.totalStudents || 0) > 0,
            // No student data loaded - saves significant reads
            dataQuality: {
              studentsWithMissingData: deptStats.studentsWithMissingData || 0,
              duplicateAdmissionNumbers: deptStats.duplicateAdmissionNumbers || [],
              duplicateRollNumbers: deptStats.duplicateRollNumbers || [],
              invalidRollNumbers: deptStats.invalidRollNumbers || 0
            }
          });
        } catch (error) {
          console.warn(`Error getting basic details for department ${deptStats.name}:`, error.message);
          collectionsBasic.push({
            department: deptStats.name,
            collectionName: this.getDepartmentCollectionName(deptStats.name),
            totalStudents: 0,
            activeStudents: 0,
            inactiveStudents: 0,
            error: error.message,
            hasStudents: false
          });
        }
      }

      return collectionsBasic.sort((a, b) => a.department.localeCompare(b.department));
    } catch (error) {
      console.error('Error getting basic collections list:', error);
      throw new Error(`Failed to get basic collections list: ${error.message}`);
    }
  },

  // Full collection details - only loaded when specifically requested
  async getAllCollectionsWithDetails() {
    try {
      const allDepartments = await this.getAllDepartments();
      const collectionsDetails = [];

      for (const department of allDepartments) {
        try {
          const collectionName = this.getDepartmentCollectionName(department);
          const students = await this.getStudentsByDepartment(department);
          const stats = await this.getDepartmentStats(department);
          
          // Get collection metadata from stats
          const statsCollection = await this.getAllDepartmentsFromStats();
          const deptStats = statsCollection.find(d => d.name === department);

          collectionsDetails.push({
            department,
            collectionName,
            totalStudents: students.length,
            activeStudents: students.filter(s => s.isActive !== false).length,
            inactiveStudents: students.filter(s => s.isActive === false).length,
            createdAt: deptStats?.createdAt || null,
            lastUpdated: deptStats?.lastUpdated || null,
            createdBy: deptStats?.createdByName || deptStats?.createdBy || 'Unknown',
            departmentCode: deptStats?.departmentCode || null,
            students: students.slice(0, 10) // Preview of first 10 students
          });
        } catch (error) {
          console.warn(`Error getting details for department ${department}:`, error.message);
          collectionsDetails.push({
            department,
            collectionName: this.getDepartmentCollectionName(department),
            totalStudents: 0,
            activeStudents: 0,
            inactiveStudents: 0,
            error: error.message,
            students: []
          });
        }
      }

      return collectionsDetails.sort((a, b) => a.department.localeCompare(b.department));
    } catch (error) {
      console.error('Error getting all collections with details:', error);
      throw new Error(`Failed to get collections details: ${error.message}`);
    }
  },

  // Get detailed information about a specific collection
  async getCollectionDetails(department) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const students = await this.getStudentsByDepartment(department);
      const stats = await this.getDepartmentStats(department);
      
      // Get collection metadata from stats
      const statsCollection = await this.getAllDepartmentsFromStats();
      const deptStats = statsCollection.find(d => d.name === department);

      // Get recent activity (students added in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentStudents = students.filter(student => {
        const createdAt = student.createdAt instanceof Date ? student.createdAt : new Date(student.createdAt);
        return createdAt >= thirtyDaysAgo;
      });

      // Analyze data quality
      const dataQuality = {
        studentsWithMissingData: students.filter(s => !s.name || !s.rollNumber || !s.admissionNumber).length,
        duplicateAdmissionNumbers: this.findDuplicateAdmissionNumbers(students),
        duplicateRollNumbers: this.findDuplicateRollNumbers(students),
        invalidRollNumbers: students.filter(s => s.rollNumber && !/^1601\d{8}$/.test(s.rollNumber)).length
      };

      return {
        department,
        collectionName,
        totalStudents: students.length,
        activeStudents: students.filter(s => s.isActive !== false).length,
        inactiveStudents: students.filter(s => s.isActive === false).length,
        recentStudents: recentStudents.length,
        createdAt: deptStats?.createdAt || null,
        lastUpdated: deptStats?.lastUpdated || null,
        createdBy: deptStats?.createdByName || deptStats?.createdBy || 'Unknown',
        departmentCode: deptStats?.departmentCode || null,
        dataQuality,
        students: students.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
      };
    } catch (error) {
      console.error(`Error getting collection details for ${department}:`, error);
      throw new Error(`Failed to get collection details: ${error.message}`);
    }
  },

  // Update collection name (lightweight operation for admin)
  async updateCollectionName(oldDepartment, newDepartment, userProfile) {
    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'super_admin')) {
      throw new Error('Insufficient permissions: Admin access required');
    }

    if (!oldDepartment || !newDepartment) {
      throw new Error('Both old and new department names are required');
    }

    if (oldDepartment === newDepartment) {
      throw new Error('New department name must be different from the current name');
    }

    // Check if new department name already exists
    const existingDepartments = await this.getAllDepartments();
    if (existingDepartments.includes(newDepartment)) {
      throw new Error(`Department "${newDepartment}" already exists`);
    }

    try {
      console.log(`Admin ${userProfile.email} updating collection name: ${oldDepartment} → ${newDepartment}`);

      // This is essentially the same as rename but optimized for UI feedback
      const result = await this.renameCollection(oldDepartment, newDepartment, userProfile);
      
      return {
        success: true,
        oldDepartment,
        newDepartment,
        studentsCount: result.studentsCount,
        message: `Collection renamed from "${oldDepartment}" to "${newDepartment}"`
      };

    } catch (error) {
      console.error('Error updating collection name:', error);
      throw new Error(`Failed to update collection name: ${error.message}`);
    }
  },

  // Update collection department code (lightweight operation for admin)
  async updateCollectionDepartmentCode(department, newCode) {
    if (!department) {
      throw new Error('Department name is required');
    }

    try {
      console.log(`Updating department code for collection: ${department} → ${newCode || 'null'}`);

      // Get the stats document for this department
      const statsRef = collection(db, 'stats');
      const q = query(statsRef, where('name', '==', department));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`No stats record found for department: ${department}`);
      }

      const statsDoc = querySnapshot.docs[0];
      const statsDocRef = doc(db, 'stats', statsDoc.id);

      // Update the department code in the stats document
      const updateData = {
        departmentCode: newCode,
        lastUpdated: serverTimestamp()
      };

      await updateDoc(statsDocRef, updateData);

      console.log(`Successfully updated department code for ${department} to ${newCode || 'null'}`);
      
      return {
        success: true,
        department,
        departmentCode: newCode,
        message: newCode 
          ? `Department code set to "${newCode}" for ${department}`
          : `Department code removed from ${department}`
      };

    } catch (error) {
      console.error('Error updating collection department code:', error);
      throw new Error(`Failed to update department code: ${error.message}`);
    }
  },

  // Helper functions for data quality analysis
  findDuplicateAdmissionNumbers(students) {
    const admissionNumbers = students.map(s => s.admissionNumber).filter(Boolean);
    const duplicates = admissionNumbers.filter((item, index) => admissionNumbers.indexOf(item) !== index);
    return [...new Set(duplicates)];
  },

  findDuplicateRollNumbers(students) {
    const rollNumbers = students.map(s => s.rollNumber).filter(Boolean);
    const duplicates = rollNumbers.filter((item, index) => rollNumbers.indexOf(item) !== index);
    return [...new Set(duplicates)];
  },

  // Delete an entire collection (ADMIN ONLY - DANGEROUS OPERATION)
  async deleteCollection(department, adminInfo, confirmation) {
    try {
      // Safety check - require explicit confirmation
      if (confirmation !== `DELETE-${department.toUpperCase()}`) {
        throw new Error('Invalid confirmation. Please type exactly: DELETE-' + department.toUpperCase());
      }

      const collectionName = this.getDepartmentCollectionName(department);
      console.log(`Admin ${adminInfo.name} (${adminInfo.id}) is deleting collection: ${collectionName}`);

      // Get student count before deletion for logging
      const studentsBeforeDeletion = await this.getStudentsByDepartment(department);
      const studentCount = studentsBeforeDeletion.length;

      if (studentCount === 0) {
        throw new Error('Collection is already empty or does not exist');
      }

      // Delete all students in batches to avoid timeout
      const batchSize = 500;
      let deletedCount = 0;
      
      const allStudentsQuery = query(collection(db, collectionName));
      const allStudentsSnapshot = await getDocs(allStudentsQuery);
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      allStudentsSnapshot.docs.forEach((doc) => {
        currentBatch.delete(doc.ref);
        operationCount++;
        deletedCount++;

        // Firestore batch limit is 500 operations
        if (operationCount === batchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      // Add the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Execute all batches
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        console.log(`Deleted batch ${i + 1}/${batches.length} (${Math.min((i + 1) * batchSize, deletedCount)}/${deletedCount} students)`);
      }

      // Remove from stats collection
      const statsRef = collection(db, 'stats');
      const statsQuery = query(statsRef, where('name', '==', department));
      const statsSnapshot = await getDocs(statsQuery);
      
      if (!statsSnapshot.empty) {
        const statsBatch = writeBatch(db);
        statsSnapshot.docs.forEach(doc => {
          statsBatch.delete(doc.ref);
        });
        await statsBatch.commit();
      }

      // Log the deletion activity
      console.log(`Successfully deleted collection ${collectionName} with ${deletedCount} students by admin ${adminInfo.name}`);

      return {
        success: true,
        department,
        collectionName,
        deletedStudents: deletedCount,
        deletedBy: adminInfo.name,
        deletedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error deleting collection for ${department}:`, error);
      throw new Error(`Failed to delete collection: ${error.message}`);
    }
  },

  // Rename a collection (moves all students to new collection name)
  async renameCollection(oldDepartment, newDepartment, adminInfo) {
    try {
      const oldCollectionName = this.getDepartmentCollectionName(oldDepartment);
      const newCollectionName = this.getDepartmentCollectionName(newDepartment);

      console.log(`Admin ${adminInfo.name} is renaming collection: ${oldCollectionName} → ${newCollectionName}`);

      // Check if new department already exists
      const existingDepartments = await this.getAllDepartments();
      if (existingDepartments.includes(newDepartment)) {
        throw new Error(`Department "${newDepartment}" already exists`);
      }

      // Get all students from old collection
      const students = await this.getStudentsByDepartment(oldDepartment);
      if (students.length === 0) {
        throw new Error('No students found in the collection to rename');
      }

      // Create new collection with updated department names
      const batch = writeBatch(db);
      const newCollectionRef = collection(db, newCollectionName);

      students.forEach(student => {
        const newDocRef = doc(newCollectionRef);
        const updatedStudent = {
          ...student,
          department: newDepartment,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: adminInfo.id,
          lastUpdatedByName: adminInfo.name
        };
        // Remove the old id field
        delete updatedStudent.id;
        batch.set(newDocRef, updatedStudent);
      });

      await batch.commit();

      // Register new department in stats
      await this.registerDepartment(newDepartment, newCollectionName, adminInfo);

      // Delete old collection
      await this.deleteCollection(oldDepartment, adminInfo, `DELETE-${oldDepartment.toUpperCase()}`);

      return {
        success: true,
        oldDepartment,
        newDepartment,
        oldCollectionName,
        newCollectionName,
        studentsCount: students.length,
        renamedBy: adminInfo.name,
        renamedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error renaming collection from ${oldDepartment} to ${newDepartment}:`, error);
      throw new Error(`Failed to rename collection: ${error.message}`);
    }
  },

  // Archive a collection (marks all students as inactive)
  async archiveCollection(department, adminInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      const students = await this.getStudentsByDepartment(department);

      if (students.length === 0) {
        throw new Error('No students found in the collection to archive');
      }

      // Mark all students as inactive
      const batch = writeBatch(db);
      const collectionRef = collection(db, collectionName);

      students.forEach(student => {
        const docRef = doc(collectionRef, student.id);
        batch.update(docRef, {
          isActive: false,
          archivedAt: serverTimestamp(),
          archivedBy: adminInfo.id,
          archivedByName: adminInfo.name,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: adminInfo.id,
          lastUpdatedByName: adminInfo.name
        });
      });

      await batch.commit();
      await this.updateDepartmentStats(department);

      return {
        success: true,
        department,
        collectionName,
        archivedStudents: students.length,
        archivedBy: adminInfo.name,
        archivedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error archiving collection for ${department}:`, error);
      throw new Error(`Failed to archive collection: ${error.message}`);
    }
  },

  // Restore an archived collection (marks all students as active)
  async restoreCollection(department, adminInfo) {
    try {
      const collectionName = this.getDepartmentCollectionName(department);
      
      // Get all students including inactive ones
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      const allStudents = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allStudents.push({
          id: doc.id,
          ...data
        });
      });

      const inactiveStudents = allStudents.filter(s => s.isActive === false);

      if (inactiveStudents.length === 0) {
        throw new Error('No archived students found in the collection to restore');
      }

      // Mark all inactive students as active
      const batch = writeBatch(db);
      const collectionRef = collection(db, collectionName);

      inactiveStudents.forEach(student => {
        const docRef = doc(collectionRef, student.id);
        batch.update(docRef, {
          isActive: true,
          restoredAt: serverTimestamp(),
          restoredBy: adminInfo.id,
          restoredByName: adminInfo.name,
          updatedAt: serverTimestamp(),
          lastUpdatedBy: adminInfo.id,
          lastUpdatedByName: adminInfo.name
        });
      });

      await batch.commit();
      await this.updateDepartmentStats(department);

      return {
        success: true,
        department,
        collectionName,
        restoredStudents: inactiveStudents.length,
        restoredBy: adminInfo.name,
        restoredAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error restoring collection for ${department}:`, error);
      throw new Error(`Failed to restore collection: ${error.message}`);
    }
  },

  // Store original direct search methods for fallback
  async _searchByAdmissionNumberDirect(admissionNumber) {
    try {
      // Step 1: Parse admission number to get target collection
      const targetCollection = admissionNumberParser.getTargetCollection(admissionNumber);
      
      if (targetCollection) {
        // Step 2: Search in the targeted collection first (fastest path)
        try {
          const q = query(
            collection(db, targetCollection),
            where('admissionNumber', '==', admissionNumber),
            where('isActive', '==', true),
            limit(1)
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const studentDoc = querySnapshot.docs[0];
            const studentData = studentDoc.data();
            const parseResult = admissionNumberParser.parseAdmissionNumber(admissionNumber);

            return {
              found: true,
              student: {
                id: studentDoc.id,
                name: studentData.name || "N/A",
                rollNumber: studentData.rollNumber || "N/A",
                admissionNumber: studentData.admissionNumber || "N/A",
                department: studentData.department || parseResult?.departmentInfo?.fullName || "N/A",
                departmentCode: studentData.departmentCode || parseResult?.sectionCode || "N/A",
                year: studentData.year || "N/A",
                isActive: studentData.isActive,
                createdAt: studentData.createdAt?.toDate?.()?.toISOString() || studentData.createdAt,
                updatedAt: studentData.updatedAt?.toDate?.()?.toISOString() || studentData.updatedAt
              },
              department: studentData.department || parseResult?.departmentInfo?.fullName,
              collectionName: targetCollection,
              searchMethod: "optimized_section_mapping_direct"
            };
          }
        } catch (error) {
          console.warn(`Error searching in target collection ${targetCollection}:`, error.message);
          // Continue to fallback search
        }
      }

      // Step 3: Fallback to searching all collections (if target collection failed or not found)
      const departments = await this.getAllDepartmentsFromStats();

      for (const department of departments) {
        // Skip the target collection if we already searched it
        if (department.collectionName === targetCollection) {
          continue;
        }

        try {
          const q = query(
            collection(db, department.collectionName),
            where('admissionNumber', '==', admissionNumber),
            where('isActive', '==', true),
            limit(1)
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const studentDoc = querySnapshot.docs[0];
            const studentData = studentDoc.data();

            return {
              found: true,
              student: {
                id: studentDoc.id,
                name: studentData.name || "N/A",
                rollNumber: studentData.rollNumber || "N/A",
                admissionNumber: studentData.admissionNumber || "N/A",
                department: studentData.department || department.name || "N/A",
                departmentCode: studentData.departmentCode || department.departmentCode || "N/A",
                year: studentData.year || "N/A",
                isActive: studentData.isActive,
                createdAt: studentData.createdAt?.toDate?.()?.toISOString() || studentData.createdAt,
                updatedAt: studentData.updatedAt?.toDate?.()?.toISOString() || studentData.updatedAt
              },
              department: department.name,
              collectionName: department.collectionName,
              searchMethod: "fallback_all_collections_direct"
            };
          }
        } catch (error) {
          console.error(`Error searching in ${department.name}:`, error);
          // Continue searching in other departments
        }
      }

      // Step 4: Not found in any collection
      return {
        found: false,
        error: `Student with admission number ${admissionNumber} not found`,
        searchMethod: targetCollection ? "optimized_with_fallback_direct" : "fallback_only_direct",
        targetCollection: targetCollection
      };
    } catch (error) {
      console.error("Error in direct admission number search:", error);
      return {
        found: false,
        error: `Search failed: ${error.message}`,
        searchMethod: "error_direct"
      };
    }
  },

  async _searchByRollNumberDirect(rollNumber) {
    try {
      const departments = await this.getAllDepartmentsFromStats();

      for (const department of departments) {
        try {
          // Use indexed query for better performance
          const q = query(
            collection(db, department.collectionName),
            where('rollNumber', '==', rollNumber),
            where('isActive', '==', true),
            limit(1)
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const studentDoc = querySnapshot.docs[0];
            const studentData = studentDoc.data();

            return {
              found: true,
              student: {
                id: studentDoc.id,
                name: studentData.name || "N/A",
                rollNumber: studentData.rollNumber || "N/A",
                admissionNumber: studentData.admissionNumber || "N/A",
                department: studentData.department || department.name || "N/A",
                departmentCode: studentData.departmentCode || department.departmentCode || "N/A",
                year: studentData.year || "N/A",
                isActive: studentData.isActive,
                createdAt: studentData.createdAt?.toDate?.()?.toISOString() || studentData.createdAt,
                updatedAt: studentData.updatedAt?.toDate?.()?.toISOString() || studentData.updatedAt
              },
              department: department.name,
              collectionName: department.collectionName
            };
          }
        } catch (error) {
          console.error(`Error searching in ${department.name}:`, error);
          // Continue searching in other departments
        }
      }

      return {
        found: false,
        error: `Student with roll number ${rollNumber} not found`
      };
    } catch (error) {
      console.error("Error searching by roll number:", error);
      return {
        found: false,
        error: `Search failed: ${error.message}`
      };
    }
  },

  async _batchSearchByAdmissionNumbersDirect(admissionNumbers) {
    try {
      const results = {
        found: [],
        notFound: [],
        errors: []
      };

      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < admissionNumbers.length; i += batchSize) {
        const batch = admissionNumbers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (admissionNumber) => {
          try {
            const result = await this._searchByAdmissionNumberDirect(admissionNumber);
            if (result.found) {
              results.found.push({ admissionNumber, ...result });
            } else {
              results.notFound.push({ admissionNumber, error: result.error });
            }
          } catch (error) {
            results.errors.push({ admissionNumber, error: error.message });
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to prevent rate limiting
        if (i + batchSize < admissionNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        summary: {
          total: admissionNumbers.length,
          found: results.found.length,
          notFound: results.notFound.length,
          errors: results.errors.length
        },
        ...results
      };
    } catch (error) {
      console.error("Error in direct batch search:", error);
      throw new Error("Failed to perform direct batch search");
    }
  },

  // Backward compatibility function
  async initializeMetadataSystem(creatorInfo) {
    console.log('Note: initializeMetadataSystem is deprecated, use initializeStatsSystem instead');
    return this.initializeStatsSystem(creatorInfo);
  },

  // Backward compatibility function  
  async getAllDepartmentsFromMetadata() {
    console.log('Note: getAllDepartmentsFromMetadata is deprecated, use getAllDepartmentsFromStats instead');
    return this.getAllDepartmentsFromStats();
  },

  // Compare students list across all departments and add missing data
  async compareDepartmentWiseStudents(newStudentsData, targetDepartment, creatorInfo, options = {}) {
    try {
      const {
        enableMissingDataDetection = true,
        addMissingStudents = true,
        strictComparison = false,
        logProgress = true,
        referenceCollections = [] // New option: specific collections to compare against
      } = options;

      if (logProgress) {
        console.log(`Starting department-wise comparison for ${targetDepartment} with ${newStudentsData.length} new students`);
      }

      // Get departments to compare against - either specified collections or all departments
      let departmentsToCompare = [];
      if (referenceCollections && referenceCollections.length > 0) {
        departmentsToCompare = referenceCollections;
        if (logProgress) {
          console.log(`Using specified reference collections:`, referenceCollections);
        }
      } else {
        departmentsToCompare = await this.getAllDepartments();
        if (logProgress) {
          console.log(`Using all available departments:`, departmentsToCompare);
        }
      }

      const comparisonResults = {
        targetDepartment,
        newStudentsCount: newStudentsData.length,
        departmentComparisons: [],
        missingStudentsFound: [],
        totalMissingStudents: 0,
        enhancedStudentsList: [...newStudentsData],
        shouldProceedWithImport: true,
        recommendations: [],
        referenceCollectionsUsed: referenceCollections.length > 0 ? referenceCollections : departmentsToCompare
      };

      if (logProgress) {
        console.log(`Found ${departmentsToCompare.length} departments to compare against:`, departmentsToCompare);
      }

      // Compare against each department
      for (const department of departmentsToCompare) {
        try {
          if (department === targetDepartment) {
            // Get existing students in target department for baseline comparison
            const existingStudents = await this.getStudentsByDepartment(department);
            
            comparisonResults.departmentComparisons.push({
              department,
              isTargetDepartment: true,
              existingCount: existingStudents.length,
              newCount: newStudentsData.length,
              countDifference: newStudentsData.length - existingStudents.length,
              status: newStudentsData.length >= existingStudents.length ? 'import_recommended' : 'requires_review'
            });

            // If new list has fewer students than existing, flag for review
            if (enableMissingDataDetection && newStudentsData.length < existingStudents.length) {
              comparisonResults.recommendations.push({
                type: 'missing_data_warning',
                message: `New list has ${newStudentsData.length} students vs existing ${existingStudents.length}. Consider reviewing for missing data.`,
                department: targetDepartment
              });
            }

            continue;
          }

          // Get students from other departments
          const departmentStudents = await this.getStudentsByDepartment(department);
          
          if (departmentStudents.length === 0) {
            continue;
          }

          const deptComparison = {
            department,
            isTargetDepartment: false,
            existingCount: departmentStudents.length,
            newCount: newStudentsData.length,
            countDifference: newStudentsData.length - departmentStudents.length,
            missingInNewList: [],
            potentialMatches: []
          };

          // Only proceed with missing data detection if the existing department has more students
          if (enableMissingDataDetection && departmentStudents.length > newStudentsData.length) {
            if (logProgress) {
              console.log(`Checking ${department}: ${departmentStudents.length} existing vs ${newStudentsData.length} new - detecting missing data`);
            }

            // Create lookup maps for new students
            const newStudentsByAdmission = new Map();
            const newStudentsByRoll = new Map();
            const newStudentsByName = new Map();

            newStudentsData.forEach(student => {
              if (student.admissionNumber) {
                newStudentsByAdmission.set(student.admissionNumber.toString().toLowerCase().trim(), student);
              }
              if (student.rollNumber) {
                newStudentsByRoll.set(student.rollNumber.toString().toLowerCase().trim(), student);
              }
              if (student.name) {
                newStudentsByName.set(student.name.toString().toLowerCase().trim(), student);
              }
            });

            // Find students from other departments that might be missing from new list
            for (const existingStudent of departmentStudents) {
              let foundInNewList = false;
              let matchType = '';

              // Check for matches using multiple criteria
              const admissionKey = existingStudent.admissionNumber?.toString().toLowerCase().trim();
              const rollKey = existingStudent.rollNumber?.toString().toLowerCase().trim();
              const nameKey = existingStudent.name?.toString().toLowerCase().trim();

              // Priority 1: Admission number match
              if (admissionKey && newStudentsByAdmission.has(admissionKey)) {
                foundInNewList = true;
                matchType = 'admission';
              }
              // Priority 2: Roll number match
              else if (rollKey && newStudentsByRoll.has(rollKey)) {
                foundInNewList = true;
                matchType = 'roll';
              }
              // Priority 3: Name match (with caution)
              else if (nameKey && newStudentsByName.has(nameKey)) {
                foundInNewList = true;
                matchType = 'name';
              }

              if (foundInNewList) {
                deptComparison.potentialMatches.push({
                  student: existingStudent,
                  matchType,
                  source: department
                });
              } else {
                // Student exists in other department but not found in new list
                const missingStudent = {
                  ...existingStudent,
                  sourceDepartment: department,
                  missingFromTarget: targetDepartment,
                  suggestedAction: 'add_to_import'
                };

                deptComparison.missingInNewList.push(missingStudent);
                comparisonResults.missingStudentsFound.push(missingStudent);
              }
            }

            deptComparison.status = deptComparison.missingInNewList.length > 0 ? 'missing_data_detected' : 'no_missing_data';
            
            if (deptComparison.missingInNewList.length > 0) {
              comparisonResults.recommendations.push({
                type: 'missing_students',
                message: `Found ${deptComparison.missingInNewList.length} students in ${department} that might be missing from your import list`,
                department,
                count: deptComparison.missingInNewList.length,
                action: addMissingStudents ? 'will_add_automatically' : 'requires_manual_review'
              });
            }
          } else {
            deptComparison.status = 'no_comparison_needed';
          }

          comparisonResults.departmentComparisons.push(deptComparison);

        } catch (deptError) {
          console.warn(`Error comparing with department ${department}:`, deptError.message);
          comparisonResults.departmentComparisons.push({
            department,
            status: 'error',
            error: deptError.message
          });
        }
      }

      comparisonResults.totalMissingStudents = comparisonResults.missingStudentsFound.length;

      // Add missing students to the enhanced list if requested
      if (addMissingStudents && comparisonResults.missingStudentsFound.length > 0) {
        if (logProgress) {
          console.log(`Adding ${comparisonResults.missingStudentsFound.length} missing students to import list`);
        }

        for (const missingStudent of comparisonResults.missingStudentsFound) {
          // Adapt the student data for the target department
          const adaptedStudent = {
            name: missingStudent.name,
            rollNumber: missingStudent.rollNumber,
            admissionNumber: missingStudent.admissionNumber,
            department: targetDepartment, // Update to target department
            year: missingStudent.year,
            // Preserve additional fields
            ...Object.fromEntries(
              Object.entries(missingStudent).filter(([key]) => 
                !['id', 'docId', 'createdAt', 'updatedAt', 'createdBy', 'lastUpdatedBy', 'sourceDepartment', 'missingFromTarget', 'suggestedAction'].includes(key)
              )
            ),
            // Add metadata about the source
            _sourceInfo: {
              originalDepartment: missingStudent.sourceDepartment,
              addedByComparison: true,
              addedAt: new Date().toISOString()
            }
          };

          comparisonResults.enhancedStudentsList.push(adaptedStudent);
        }

        comparisonResults.recommendations.push({
          type: 'students_added',
          message: `Automatically added ${comparisonResults.missingStudentsFound.length} missing students from selected reference collections`,
          count: comparisonResults.missingStudentsFound.length
        });
      }

      // Determine if import should proceed
      const hasSignificantMissingData = comparisonResults.totalMissingStudents > (newStudentsData.length * 0.1); // More than 10% missing
      if (hasSignificantMissingData && !addMissingStudents) {
        comparisonResults.shouldProceedWithImport = false;
        comparisonResults.recommendations.push({
          type: 'import_blocked',
          message: `Import blocked: Found ${comparisonResults.totalMissingStudents} missing students (${(comparisonResults.totalMissingStudents / newStudentsData.length * 100).toFixed(1)}% of new list). Please review.`,
          severity: 'warning'
        });
      }

      if (logProgress) {
        console.log(`Department-wise comparison completed. Enhanced list: ${comparisonResults.enhancedStudentsList.length} students (${comparisonResults.totalMissingStudents} added)`);
      }

      return comparisonResults;

    } catch (error) {
      console.error('Error in department-wise comparison:', error);
      throw new Error(`Failed to perform department-wise comparison: ${error.message}`);
    }
  },

  // Enhanced bulk import with department-wise comparison
  async bulkImportWithDepartmentComparison(studentsData, department, creatorInfo, options = {}) {
    try {
      const {
        enableDepartmentComparison = true,
        mergeStrategy = 'merge',
        addMissingStudents = true,
        strictComparison = false,
        referenceCollections = [], // New option: specific collections to compare against
        ...otherOptions
      } = options;

      console.log(`Starting enhanced bulk import for ${department} with department comparison: ${enableDepartmentComparison}`);

      let finalStudentsData = studentsData;
      let comparisonResults = null;

      // Perform department-wise comparison if enabled
      if (enableDepartmentComparison) {
        comparisonResults = await this.compareDepartmentWiseStudents(
          studentsData, 
          department, 
          creatorInfo, 
          {
            enableMissingDataDetection: true,
            addMissingStudents,
            strictComparison,
            logProgress: true,
            referenceCollections // Pass through the reference collections
          }
        );

        if (!comparisonResults.shouldProceedWithImport && !otherOptions.forceImport) {
          return {
            success: false,
            error: 'Import blocked due to significant missing data',
            comparisonResults,
            recommendations: comparisonResults.recommendations
          };
        }

        finalStudentsData = comparisonResults.enhancedStudentsList;
        console.log(`Using enhanced student list with ${finalStudentsData.length} students (${finalStudentsData.length - studentsData.length} added from comparison)`);
      }

      // Proceed with the standard bulk import process
      const importResults = await this.bulkImportWithMerge(finalStudentsData, department, creatorInfo, mergeStrategy);

      // Enhance results with comparison data
      return {
        ...importResults,
        comparisonResults,
        originalCount: studentsData.length,
        enhancedCount: finalStudentsData.length,
        studentsAddedByComparison: finalStudentsData.length - studentsData.length,
        departmentComparisonEnabled: enableDepartmentComparison,
        referenceCollectionsUsed: comparisonResults?.referenceCollectionsUsed || []
      };

    } catch (error) {
      console.error('Error in enhanced bulk import:', error);
      throw error;
    }
  },

  // Admin function to delete multiple collections
  async deleteMultipleCollections(departments, userProfile, confirmationInput) {
    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'super_admin')) {
      throw new Error('Insufficient permissions: Admin access required');
    }

    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      throw new Error('No departments provided for deletion');
    }

    // Validate confirmation input
    const expectedConfirmation = `BULK-DELETE-${departments.length}-COLLECTIONS`;
    if (confirmationInput !== expectedConfirmation) {
      throw new Error(`Invalid confirmation. Please type: ${expectedConfirmation}`);
    }

    try {
      console.log(`Starting bulk deletion of ${departments.length} collections by admin:`, userProfile.email);

      const results = {
        totalCollections: departments.length,
        successfulDeletions: 0,
        failedDeletions: 0,
        deletedCollections: [],
        failedCollections: [],
        totalStudentsDeleted: 0,
        errors: []
      };

      // Process each collection deletion
      for (const department of departments) {
        try {
          console.log(`Deleting collection: ${department}`);

          // Get collection details before deletion
          const collectionQuery = query(collection(db, `students_${department}`));
          const collectionSnapshot = await getDocs(collectionQuery);
          const studentCount = collectionSnapshot.size;

          if (studentCount > 0) {
            // Delete all students in batches (Firestore batch limit is 500)
            const batchSize = 500;
            let deleted = 0;

            while (deleted < studentCount) {
              const batch = writeBatch(db);
              const remainingQuery = query(
                collection(db, `students_${department}`),
                limit(batchSize)
              );
              const remainingSnapshot = await getDocs(remainingQuery);

              if (remainingSnapshot.empty) break;

              remainingSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
              });

              await batch.commit();
              deleted += remainingSnapshot.size;
              console.log(`Deleted ${deleted}/${studentCount} students from ${department}`);
            }
          }

          // Remove from department stats
          try {
            await deleteDoc(doc(db, 'departmentStats', department));
            console.log(`Removed department stats for: ${department}`);
          } catch (statsError) {
            console.warn(`Could not remove stats for ${department}:`, statsError.message);
          }

          // Update results
          results.successfulDeletions++;
          results.deletedCollections.push({
            department,
            studentsDeleted: studentCount,
            deletedAt: new Date().toISOString(),
            deletedBy: userProfile.email
          });
          results.totalStudentsDeleted += studentCount;

          console.log(`Successfully deleted collection ${department} with ${studentCount} students`);

        } catch (error) {
          console.error(`Failed to delete collection ${department}:`, error);
          results.failedDeletions++;
          results.failedCollections.push({
            department,
            error: error.message,
            attemptedAt: new Date().toISOString()
          });
          results.errors.push(`${department}: ${error.message}`);
        }
      }

      // Update overall department stats if any deletions were successful
      if (results.successfulDeletions > 0) {
        try {
          await this.updateOverallStats();
          console.log('Updated overall stats after bulk deletion');
        } catch (statsError) {
          console.warn('Failed to update overall stats:', statsError.message);
        }
      }

      const summary = `Bulk deletion completed: ${results.successfulDeletions}/${results.totalCollections} collections deleted, ${results.totalStudentsDeleted} total students removed`;
      console.log(summary);

      // Add metadata for logging
      results.summary = summary;
      results.adminUser = {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role
      };
      results.executedAt = new Date().toISOString();

      return results;

    } catch (error) {
      console.error('Error in bulk collection deletion:', error);
      throw new Error(`Bulk deletion failed: ${error.message}`);
    }
  },

  // Admin function to archive multiple collections
  async archiveMultipleCollections(departments, userProfile) {
    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'super_admin')) {
      throw new Error('Insufficient permissions: Admin access required');
    }

    if (!departments || !Array.isArray(departments) || departments.length === 0) {
      throw new Error('No departments provided for archiving');
    }

    try {
      console.log(`Starting bulk archiving of ${departments.length} collections by admin:`, userProfile.email);

      const results = {
        totalCollections: departments.length,
        successfulArchives: 0,
        failedArchives: 0,
        archivedCollections: [],
        failedCollections: [],
        totalStudentsArchived: 0,
        errors: []
      };

      // Process each collection archiving
      for (const department of departments) {
        try {
          const result = await this.archiveCollection(department, userProfile);
          
          results.successfulArchives++;
          results.archivedCollections.push({
            department,
            studentsArchived: result.archivedStudents,
            archivedAt: new Date().toISOString(),
            archivedBy: userProfile.email
          });
          results.totalStudentsArchived += result.archivedStudents;

          console.log(`Successfully archived collection ${department} with ${result.archivedStudents} students`);

        } catch (error) {
          console.error(`Failed to archive collection ${department}:`, error);
          results.failedArchives++;
          results.failedCollections.push({
            department,
            error: error.message,
            attemptedAt: new Date().toISOString()
          });
          results.errors.push(`${department}: ${error.message}`);
        }
      }

      const summary = `Bulk archiving completed: ${results.successfulArchives}/${results.totalCollections} collections archived, ${results.totalStudentsArchived} total students archived`;
      console.log(summary);

      results.summary = summary;
      results.adminUser = {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role
      };
      results.executedAt = new Date().toISOString();

      return results;

    } catch (error) {
      console.error('Error in bulk collection archiving:', error);
      throw new Error(`Bulk archiving failed: ${error.message}`);
    }
  },
};
