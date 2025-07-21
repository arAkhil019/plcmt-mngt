// lib/activityParticipationService.js
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  limit,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { studentsService } from "./studentsService.js";

export const activityParticipationService = {
  // Debug function to test department code collision handling
  async debugDepartmentCodes() {
    try {
      console.log("=== DEBUG: Department Code Mapping ===");
      
      // Get all departments from stats
      const q = query(
        collection(db, "stats"),
        where("isActive", "==", true)
      );
      
      const querySnapshot = await getDocs(q);
      const departmentsByCode = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const code = data.departmentCode;
        
        if (!departmentsByCode[code]) {
          departmentsByCode[code] = [];
        }
        
        departmentsByCode[code].push({
          name: data.name,
          collectionName: data.collectionName,
          totalStudents: data.totalStudents || 0
        });
        
        console.log(`Department: ${data.name} | Code: ${code} | Collection: ${data.collectionName} | Students: ${data.totalStudents || 0}`);
      });
      
      console.log("\n=== Department Code Groups ===");
      Object.keys(departmentsByCode).forEach(code => {
        const depts = departmentsByCode[code];
        if (depts.length > 1) {
          console.log(`Code ${code} has ${depts.length} departments:`, depts.map(d => d.name).join(', '));
        }
      });
      
      return departmentsByCode;
    } catch (error) {
      console.error("Error debugging department codes:", error);
      return {};
    }
  },

  // Test function to verify roll number processing for collision handling
  async testRollNumberLookup(rollNumber) {
    try {
      console.log(`\n=== Testing Roll Number: ${rollNumber} ===`);
      
      const result = await this.findStudentByRollNumber(rollNumber);
      console.log("Result:", result);
      
      return result;
    } catch (error) {
      console.error(`Error testing roll number ${rollNumber}:`, error);
      return { found: false, error: error.message };
    }
  },

  // Parse roll number to extract information
  parseRollNumber(rollNumber) {
    try {
      const rollStr = rollNumber.toString().trim();

      // Validate roll number format (should be 12 digits starting with 1601)
      if (!/^1601\d{8}$/.test(rollStr)) {
        return {
          rollNumber: rollStr,
          error: `Invalid roll number format: ${rollNumber}. Expected format: 1601YYXXXNNN (12 digits starting with 1601)`,
          isValid: false,
          details: {
            provided: rollStr,
            length: rollStr.length,
            startsWithCorrectCode: rollStr.startsWith("1601"),
            isNumeric: /^\d+$/.test(rollStr),
          },
        };
      }

      const institutionCode = rollStr.substring(0, 4); // 1601
      const yearCode = rollStr.substring(4, 6); // YY
      const departmentCode = rollStr.substring(6, 9); // XXX
      const studentSequence = rollStr.substring(9, 12); // NNN

      const joiningYear = 2000 + parseInt(yearCode);

      // Validate year is reasonable (not too old or in future)
      const currentYear = new Date().getFullYear();
      if (joiningYear < 2010 || joiningYear > currentYear + 1) {
        return {
          rollNumber: rollStr,
          error: `Invalid joining year: ${joiningYear}. Expected year between 2010 and ${
            currentYear + 1
          }`,
          isValid: false,
          details: {
            provided: rollStr,
            yearCode: yearCode,
            joiningYear: joiningYear,
          },
        };
      }

      return {
        rollNumber: rollStr,
        institutionCode,
        joiningYear,
        departmentCode,
        studentSequence,
        isValid: true,
      };
    } catch (error) {
      return {
        rollNumber: rollNumber.toString(),
        error: `Parse error: ${error.message}`,
        isValid: false,
      };
    }
  },

  // Find all departments with the same department code using stats collection
  async findDepartmentsByCode(departmentCode) {
    try {
      const q = query(
        collection(db, "stats"),
        where("isActive", "==", true),
        where("departmentCode", "==", departmentCode)
      );

      const querySnapshot = await getDocs(q);
      const departments = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        departments.push({
          id: doc.id,
          name: data.name,
          collectionName: data.collectionName,
          departmentCode: data.departmentCode,
        });
      });

      return departments;
    } catch (error) {
      console.error(
        `Error finding departments by code ${departmentCode}:`,
        error
      );
      return [];
    }
  },

  // Find department by code using stats collection
  async findDepartmentByCode(departmentCode) {
    try {
      const q = query(
        collection(db, "stats"),
        where("isActive", "==", true),
        where("departmentCode", "==", departmentCode),
        limit(1)
      );

      // Add timeout to prevent hanging queries
      const queryPromise = getDocs(q);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Department query timeout after 5 seconds")),
          5000
        );
      });

      const querySnapshot = await Promise.race([queryPromise, timeoutPromise]);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name,
        collectionName: data.collectionName,
        departmentCode: data.departmentCode,
      };
    } catch (error) {
      console.error(
        `Error finding department by code ${departmentCode}:`,
        error
      );
      return null;
    }
  },

  // Find student details by roll number using stats-based lookup with department code collision handling
  async findStudentByRollNumber(rollNumber) {
    try {
      const rollInfo = this.parseRollNumber(rollNumber);

      if (!rollInfo.isValid) {
        return {
          found: false,
          error: rollInfo.error,
          rollNumber,
        };
      }

      // Find ALL departments with this department code (handles collisions like CSE 1, CSE 2, CSE 3)
      const departments = await this.findDepartmentsByCode(
        rollInfo.departmentCode
      );

      if (departments.length === 0) {
        return {
          found: false,
          error: `No departments found for code: ${rollInfo.departmentCode}`,
          rollNumber,
          parsedInfo: rollInfo,
        };
      }

      console.log(`Found ${departments.length} departments with code ${rollInfo.departmentCode}:`, 
        departments.map(d => d.name).join(', '));

      // Search for student in ALL department collections with this code
      for (const department of departments) {
        try {
          console.log(`Searching in ${department.name} (${department.collectionName}) for roll number ${rollInfo.rollNumber}...`);

          const q = query(
            collection(db, department.collectionName),
            where("rollNumber", "==", rollInfo.rollNumber),
            where("isActive", "==", true),
            limit(1)
          );

          // Add timeout to prevent hanging queries
          const queryPromise = getDocs(q);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Query timeout after 10 seconds")),
              10000
            );
          });

          const querySnapshot = await Promise.race([queryPromise, timeoutPromise]);

          if (!querySnapshot.empty) {
            const studentDoc = querySnapshot.docs[0];
            const studentData = studentDoc.data();

            console.log(`✅ Found student in ${department.name}: ${studentData.name} (${studentData.rollNumber}) -> ${studentData.admissionNumber}`);

            return {
              found: true,
              student: {
                id: studentDoc.id,
                name: studentData.name,
                rollNumber: studentData.rollNumber,
                admissionNumber: studentData.admissionNumber,
                department: studentData.department || department.name,
                year: studentData.year,
                joiningYear: rollInfo.joiningYear,
                departmentCode: rollInfo.departmentCode,
                collectionName: department.collectionName,
              },
              parsedInfo: rollInfo,
              department: department.name,
            };
          } else {
            console.log(`Student ${rollInfo.rollNumber} not found in ${department.name}`);
          }
        } catch (error) {
          console.error(`Error searching in ${department.name}:`, error);
          // Continue searching in other departments
        }
      }

      // If we get here, student was not found in any department with this code
      const departmentNames = departments.map(d => d.name).join(', ');
      return {
        found: false,
        error: `Student with roll number ${rollNumber} not found in any department with code ${rollInfo.departmentCode} (searched: ${departmentNames})`,
        rollNumber,
        parsedInfo: rollInfo,
        searchedDepartments: departmentNames,
      };
    } catch (error) {
      console.error(
        `Error finding student by roll number ${rollNumber}:`,
        error
      );

      // Provide specific error messages for common issues
      let errorMessage = error.message;
      if (error.message.includes("timeout")) {
        errorMessage = "Database query timeout - please try again";
      } else if (error.message.includes("permission-denied")) {
        errorMessage = "Database access denied - check permissions";
      } else if (error.message.includes("unavailable")) {
        errorMessage = "Database temporarily unavailable - please try again";
      }

      return {
        found: false,
        error: `Failed to find student: ${errorMessage}`,
        rollNumber,
      };
    }
  },

  // Process activity participation data from Excel
  async processActivityParticipation(
    participationData,
    activityInfo,
    processorInfo
  ) {
    try {
      console.log(
        `Starting to process ${participationData.length} participants for activity: ${activityInfo.name}`
      );

      const results = {
        successful: [],
        failed: [],
        summary: {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
        },
      };

      // Process in smaller batches to avoid rate limiting and timeout issues
      const batchSize = 10; // Process 10 students at a time
      const batches = [];

      for (let i = 0; i < participationData.length; i += batchSize) {
        batches.push(participationData.slice(i, i + batchSize));
      }

      console.log(
        `Processing ${participationData.length} participants in ${batches.length} batches of ${batchSize}`
      );

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(
          `Processing batch ${batchIndex + 1}/${batches.length} with ${
            batch.length
          } participants`
        );

        // Process batch sequentially to avoid overwhelming Firestore
        for (const participant of batch) {
          results.summary.totalProcessed++;

          try {
            console.log(
              `Processing participant ${results.summary.totalProcessed}: ${participant.name} (${participant.rollNumber})`
            );

            // Validate required fields
            if (!participant.name || !participant.rollNumber) {
              console.warn(
                `Missing data for participant ${results.summary.totalProcessed}: name="${participant.name}", rollNumber="${participant.rollNumber}"`
              );
              results.failed.push({
                name: participant.name || "Unknown",
                rollNumber: participant.rollNumber || "Missing",
                error: "Missing name or roll number",
              });
              results.summary.failed++;
              continue;
            }

            // Find student details by roll number
            const studentResult = await this.findStudentByRollNumber(
              participant.rollNumber
            );

            if (!studentResult.found) {
              console.warn(
                `Student not found: ${participant.name} (${participant.rollNumber}) - ${studentResult.error}`
              );
              results.failed.push({
                name: participant.name,
                rollNumber: participant.rollNumber,
                error: studentResult.error,
              });
              results.summary.failed++;
              continue;
            }

            console.log(
              `Found student: ${studentResult.student.name} (${studentResult.student.rollNumber}) - ${studentResult.student.admissionNumber}`
            );

            // Verify name matches (optional but recommended)
            const nameMatch = this.fuzzyNameMatch(
              participant.name,
              studentResult.student.name
            );

            const participantRecord = {
              activityId: activityInfo.id,
              activityName: activityInfo.name,
              activityDate: activityInfo.date,
              studentId: studentResult.student.id,
              studentName: studentResult.student.name,
              providedName: participant.name,
              rollNumber: studentResult.student.rollNumber,
              admissionNumber: studentResult.student.admissionNumber,
              department: studentResult.student.department,
              departmentCode: studentResult.student.departmentCode,
              joiningYear: studentResult.student.joiningYear,
              year: studentResult.student.year,
              nameVerified: nameMatch.isMatch,
              nameConfidence: nameMatch.confidence,
              createdAt: serverTimestamp(),
              createdBy: processorInfo.id,
              createdByName: processorInfo.name,
            };

            results.successful.push(participantRecord);
            results.summary.successful++;
            console.log(
              `Successfully processed: ${participant.name} -> ${studentResult.student.admissionNumber}`
            );
          } catch (error) {
            console.error(
              `Error processing participant ${participant.name} (${participant.rollNumber}):`,
              error
            );
            results.failed.push({
              name: participant.name,
              rollNumber: participant.rollNumber,
              error: `Processing error: ${error.message}`,
            });
            results.summary.failed++;
          }

          // Add a small delay between each student to avoid rate limiting
          if (results.summary.totalProcessed % 10 === 0) {
            console.log(
              `Processed ${results.summary.totalProcessed} participants so far. Brief pause to avoid rate limiting...`
            );
            await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay every 10 students
          }
        }

        // Add a longer delay between batches
        if (batchIndex < batches.length - 1) {
          console.log(
            `Completed batch ${batchIndex + 1}. Pausing before next batch...`
          );
          await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay between batches
        }
      }

      console.log(
        `Processing complete. Success: ${results.summary.successful}, Failed: ${results.summary.failed}`
      );

      if (results.summary.failed > 0) {
        console.log("Failed participants:", results.failed);
      }

      return results;
    } catch (error) {
      console.error("Error processing activity participation:", error);
      throw new Error(
        `Failed to process activity participation: ${error.message}`
      );
    }
  },

  // Save activity participation to database
  async saveActivityParticipation(participationRecords, activityInfo) {
    try {
      const savedRecords = [];
      const errors = [];

      for (const record of participationRecords) {
        try {
          const docRef = await addDoc(
            collection(db, "activity_participation"),
            record
          );
          savedRecords.push({
            id: docRef.id,
            ...record,
          });
        } catch (error) {
          errors.push({
            student: record.studentName,
            rollNumber: record.rollNumber,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        savedCount: savedRecords.length,
        errorCount: errors.length,
        savedRecords,
        errors,
      };
    } catch (error) {
      console.error("Error saving activity participation:", error);
      throw new Error(
        `Failed to save activity participation: ${error.message}`
      );
    }
  },

  // Fuzzy name matching for verification
  fuzzyNameMatch(providedName, actualName) {
    try {
      const normalize = (name) =>
        name
          .toLowerCase()
          .trim()
          .replace(/[^a-z\s]/g, "");
      const provided = normalize(providedName);
      const actual = normalize(actualName);

      // Exact match
      if (provided === actual) {
        return { isMatch: true, confidence: 1.0 };
      }

      // Split into words and check
      const providedWords = provided.split(/\s+/);
      const actualWords = actual.split(/\s+/);

      let matchedWords = 0;
      for (const word of providedWords) {
        if (
          actualWords.some(
            (actualWord) =>
              actualWord.includes(word) || word.includes(actualWord)
          )
        ) {
          matchedWords++;
        }
      }

      const confidence =
        matchedWords / Math.max(providedWords.length, actualWords.length);
      const isMatch = confidence >= 0.7; // 70% confidence threshold

      return { isMatch, confidence };
    } catch (error) {
      return { isMatch: false, confidence: 0 };
    }
  },

  // Get available departments with codes from stats collection
  async getAvailableDepartments() {
    try {
      const departments = await studentsService.getAllDepartmentsFromStats();
      return departments.map((dept) => ({
        name: dept.name,
        code: dept.departmentCode,
        collectionName: dept.collectionName,
        totalStudents: dept.totalStudents,
      }));
    } catch (error) {
      console.error("Error getting available departments:", error);
      return [];
    }
  },

  // Validate single roll number using stats-based lookup
  async validateRollNumber(rollNumber) {
    try {
      const parsed = this.parseRollNumber(rollNumber);

      if (!parsed.isValid) {
        return {
          valid: false,
          error: parsed.error,
          rollNumber,
        };
      }

      const department = await this.findDepartmentByCode(parsed.departmentCode);

      return {
        valid: !!department,
        parsed,
        department: department ? department.name : null,
        departmentCode: parsed.departmentCode,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        rollNumber,
      };
    }
  },

  // Save activity with participants list for display
  async saveActivityWithParticipants(
    activityDetails,
    participantsList,
    creatorInfo
  ) {
    try {
      // Validate required fields
      if (!activityDetails?.id) {
        throw new Error("Activity ID is required");
      }
      if (!activityDetails?.name) {
        throw new Error("Activity name is required");
      }
      if (!activityDetails?.date) {
        throw new Error("Activity date is required");
      }
      if (!creatorInfo?.id || !creatorInfo?.name) {
        throw new Error("Creator information is required");
      }

      const activityRecord = {
        id: activityDetails.id,
        name: activityDetails.name,
        date: activityDetails.date,
        participants: participantsList,
        totalParticipants: participantsList.length,
        createdAt: serverTimestamp(),
        createdBy: creatorInfo.id,
        createdByName: creatorInfo.name,
        lastUpdated: serverTimestamp(),
        isActive: true,
      };

      // Save to activities collection
      const activityRef = await addDoc(
        collection(db, "activities"),
        activityRecord
      );

      // Also save individual participation records for detailed tracking
      const participationRecords = participantsList.map((participant) => ({
        activityId: activityDetails.id,
        activityName: activityDetails.name,
        activityDate: activityDetails.date,
        studentName: participant.name,
        rollNumber: participant.rollNumber,
        admissionNumber: participant.admissionNumber,
        department: participant.department,
        departmentCode: participant.departmentCode,
        year: participant.year,
        addedAt: serverTimestamp(),
        addedBy: creatorInfo.id,
        addedByName: creatorInfo.name,
      }));

      // Save all participation records
      const participationPromises = participationRecords.map((record) =>
        addDoc(collection(db, "activity_participation"), record)
      );

      await Promise.all(participationPromises);

      // Return the activity object in the format expected by the activities list
      return {
        id: activityRef.id, // Firestore document ID
        activityId: activityDetails.id, // Custom activity ID
        name: activityDetails.name,
        date: activityDetails.date,
        participants: participantsList,
        totalParticipants: participantsList.length,
        createdAt: new Date().toISOString(),
        createdBy: creatorInfo.name,
        lastUpdated: new Date().toISOString(),
        isActive: true,
      };
    } catch (error) {
      console.error("Error saving activity with participants:", error);
      throw new Error(`Failed to save activity: ${error.message}`);
    }
  },

  // Get activity participants for display
  async getActivityParticipants(activityId) {
    try {
      const q = query(
        collection(db, "activity_participation"),
        where("activityId", "==", activityId)
      );

      const querySnapshot = await getDocs(q);
      const participants = [];

      querySnapshot.forEach((doc) => {
        participants.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return participants.sort((a, b) =>
        a.studentName.localeCompare(b.studentName)
      );
    } catch (error) {
      console.error("Error getting activity participants:", error);
      throw new Error(`Failed to get participants: ${error.message}`);
    }
  },

  // Get all activities with participant counts
  async getAllActivitiesWithParticipants() {
    try {
      const q = query(
        collection(db, "activities"),
        where("isActive", "==", true)
      );

      const querySnapshot = await getDocs(q);
      const activities = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        activities.push({
          id: doc.id, // This is the document ID from Firestore
          activityId: data.id, // This is the custom activity ID
          name: data.name,
          date: data.date,
          totalParticipants: data.totalParticipants || 0,
          participants: data.participants || [],
          createdAt: data.createdAt,
          createdBy: data.createdByName,
          lastUpdated: data.lastUpdated,
        });
      });

      return activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error("Error getting activities:", error);
      throw new Error(`Failed to get activities: ${error.message}`);
    }
  },

  // Delete activity and all its participation records
  async deleteActivity(activityDocId, customActivityId, userInfo) {
    try {
      const batch = writeBatch(db);

      // First, get all participation records for this activity using the custom activity ID
      const participationQuery = query(
        collection(db, "activity_participation"),
        where("activityId", "==", customActivityId)
      );

      const participationSnapshot = await getDocs(participationQuery);

      // Add all participation records to delete batch
      participationSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete the main activity document using the document ID
      const activityRef = doc(db, "activities", activityDocId);
      batch.delete(activityRef);

      // Execute the batch delete
      await batch.commit();

      return {
        success: true,
        deletedParticipationRecords: participationSnapshot.size,
        message: `Activity deleted successfully along with ${participationSnapshot.size} participation records`,
      };
    } catch (error) {
      console.error("Error deleting activity:", error);
      throw new Error(`Failed to delete activity: ${error.message}`);
    }
  },

  // Soft delete activity (mark as inactive)
  async deactivateActivity(activityDocId, userInfo) {
    try {
      const activityRef = doc(db, "activities", activityDocId);

      await updateDoc(activityRef, {
        isActive: false,
        deactivatedAt: serverTimestamp(),
        deactivatedBy: userInfo.id,
        deactivatedByName: userInfo.name,
        lastUpdated: serverTimestamp(),
      });

      return {
        success: true,
        message: "Activity deactivated successfully",
      };
    } catch (error) {
      console.error("Error deactivating activity:", error);
      throw new Error(`Failed to deactivate activity: ${error.message}`);
    }
  },

  // Validate multiple roll numbers using stats-based lookup
  async validateRollNumbers(rollNumbers) {
    const results = {
      valid: [],
      invalid: [],
      found: [],
      notFound: [],
    };

    for (const rollNumber of rollNumbers) {
      const validation = await this.validateRollNumber(rollNumber);

      if (validation.valid) {
        results.valid.push(validation);

        // Try to find the student
        const studentResult = await this.findStudentByRollNumber(rollNumber);
        if (studentResult.found) {
          results.found.push(studentResult);
        } else {
          results.notFound.push(studentResult);
        }
      } else {
        results.invalid.push(validation);
      }
    }

    return results;
  },
};
