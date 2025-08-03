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
        console.log(`Department ${departmentName} already registered in stats`);
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
      console.log(`Department ${departmentName} registered in stats with department code: ${departmentCode}`);
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
        console.log(`Department ${departmentName} not found in stats, cannot update`);
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

      console.log(`Updated stats for ${departmentName}: ${stats.totalStudents} total, ${stats.activeStudents} active, ${stats.totalStudents - stats.activeStudents} inactive${departmentCode ? `, code: ${departmentCode}` : ''}`);
      return stats;
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
      
      console.log("Student added successfully:", docRef.id);
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
      console.log("Student updated successfully:", studentId);
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

      console.log("Student deleted successfully:", studentId);
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

  // Enhanced search by admission number with indexing support
  async searchByAdmissionNumber(admissionNumber) {
    try {
      const departments = await this.getAllDepartmentsFromStats();

      for (const department of departments) {
        try {
          // Use indexed query for better performance
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
        error: `Student with admission number ${admissionNumber} not found`
      };
    } catch (error) {
      console.error("Error searching by admission number:", error);
      return {
        found: false,
        error: `Search failed: ${error.message}`
      };
    }
  },

  // Enhanced search by roll number with indexing support
  async searchByRollNumber(rollNumber) {
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

  // Batch search for multiple admission numbers (optimized for scanning)
  async batchSearchByAdmissionNumbers(admissionNumbers) {
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
            const result = await this.searchByAdmissionNumber(admissionNumber);
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
      console.error("Error in batch search:", error);
      throw new Error("Failed to perform batch search");
    }
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
      console.log(`Cleared all students from ${department}`);
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
};
