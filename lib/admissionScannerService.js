// lib/admissionScannerService.js
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
} from "firebase/firestore";
import { db } from "./firebase.js";
import { studentsService } from "./studentsService.js";
import { unifiedActivitiesService } from "./unifiedActivitiesService.js";

export const admissionScannerService = {
    // Debug function to investigate activity lookup issues
  async debugActivityLookup(activityId) {
    // Debug function commented out for production
    // Uncomment for debugging activity lookup issues
    return;
  },

  // Get Firestore activity document ID
  async getActivityDocumentId(activityId) {
    try {
      // Try to get the activity using the unified service
      const activity = await unifiedActivitiesService.getActivityById(
        activityId
      );

      if (activity) {
        return activity.id;
      }

      // If not found, return original ID
      return activityId;
    } catch (error) {
      return activityId; // Return original ID if lookup fails
    }
  },

  // Create a new admission scanning session for an activity
  async createScanningSession(activityId, activityName, creatorInfo) {
    try {
      // Get the activity document ID using unified service
      const activityDocumentId = await this.getActivityDocumentId(activityId);

      const sessionData = {
        activityId: activityDocumentId, // Always use Firestore document ID
        activityName,
        scannedAdmissions: [],
        createdAt: serverTimestamp(),
        createdBy: creatorInfo.id,
        createdByName: creatorInfo.name,
        status: "active", // active, completed, cancelled
        totalScanned: 0,
        lastScannedAt: null,
      };

      const docRef = await addDoc(
        collection(db, "admissionScanSessions"),
        sessionData
      );
      return { id: docRef.id, ...sessionData };
    } catch (error) {
      console.error("Error creating scanning session:", error,"with data:", sessionData);
      throw new Error("Failed to create scanning session");
    }
  },

  // Add a scanned admission number to the session
  async addScannedAdmission(sessionId, admissionNumber, scannerInfo) {
    try {
      const sessionRef = doc(db, "admissionScanSessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error("Scanning session not found");
      }

      const sessionData = sessionSnap.data();
      const scannedAdmissions = sessionData.scannedAdmissions || [];

      // Check if admission number is already scanned
      if (
        scannedAdmissions.some(
          (item) => item.admissionNumber === admissionNumber
        )
      ) {
        return {
          success: false,
          message: "Admission number already scanned",
          duplicate: true,
        };
      }

      // Add new scanned admission
      const newScan = {
        admissionNumber,
        scannedAt: new Date().toISOString(),
        scannedBy: scannerInfo.id,
        scannedByName: scannerInfo.name,
      };

      scannedAdmissions.push(newScan);

      await updateDoc(sessionRef, {
        scannedAdmissions,
        totalScanned: scannedAdmissions.length,
        lastScannedAt: serverTimestamp(),
        lastUpdatedBy: scannerInfo.id,
      });

      return {
        success: true,
        message: "Admission number added successfully",
        totalScanned: scannedAdmissions.length,
      };
    } catch (error) {
      console.error("Error adding scanned admission:", error);
      throw new Error("Failed to add scanned admission");
    }
  },

  // Remove a scanned admission number from the session
  async removeScannedAdmission(sessionId, admissionNumber, removerInfo) {
    try {
      const sessionRef = doc(db, "admissionScanSessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error("Scanning session not found");
      }

      const sessionData = sessionSnap.data();
      const scannedAdmissions = sessionData.scannedAdmissions || [];

      // Remove the admission number
      const updatedAdmissions = scannedAdmissions.filter(
        (item) => item.admissionNumber !== admissionNumber
      );

      await updateDoc(sessionRef, {
        scannedAdmissions: updatedAdmissions,
        totalScanned: updatedAdmissions.length,
        lastUpdatedBy: removerInfo.id,
      });

      return {
        success: true,
        message: "Admission number removed successfully",
        totalScanned: updatedAdmissions.length,
      };
    } catch (error) {
      console.error("Error removing scanned admission:", error);
      throw new Error("Failed to remove scanned admission");
    }
  },

  // Get scanning session data
  async getScanningSession(sessionId) {
    try {
      const sessionRef = doc(db, "admissionScanSessions", sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error("Scanning session not found");
      }

      const data = sessionSnap.data();
      return {
        id: sessionSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        lastScannedAt:
          data.lastScannedAt?.toDate?.()?.toISOString() || data.lastScannedAt,
      };
    } catch (error) {
      console.error("Error getting scanning session:", error);
      throw new Error("Failed to get scanning session");
    }
  },

  // Get all scanning sessions for an activity
  async getSessionsForActivity(activityId) {
    try {
      // Get the activity document ID using unified service
      const activityDocumentId = await this.getActivityDocumentId(activityId);

      const q = query(
        collection(db, "admissionScanSessions"),
        where("activityId", "==", activityDocumentId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const sessions = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          ...data,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          lastScannedAt:
            data.lastScannedAt?.toDate?.()?.toISOString() || data.lastScannedAt,
        });
      });

      return sessions;
    } catch (error) {
      console.error("Error getting sessions for activity:", error);
      throw new Error("Failed to get scanning sessions");
    }
  },

  // Map scanned admission numbers to student details
  async mapAdmissionsToStudents(sessionId, processorInfo) {
    try {
      const session = await this.getScanningSession(sessionId);
      const scannedAdmissions = session.scannedAdmissions || [];

      if (scannedAdmissions.length === 0) {
        return {
          success: true,
          mapped: [],
          notFound: [],
          summary: { total: 0, found: 0, notFound: 0 },
        };
      }

      const results = {
        mapped: [],
        notFound: [],
        errors: [],
      };

      // Process each admission number
      for (const scanItem of scannedAdmissions) {
        try {
          const studentDetails = await this.findStudentByAdmissionNumber(
            scanItem.admissionNumber
          );

          if (studentDetails.found) {
            results.mapped.push({
              ...scanItem,
              student: studentDetails.student,
              department: studentDetails.department,
              collectionName: studentDetails.collectionName,
            });
          } else {
            results.notFound.push({
              ...scanItem,
              error: studentDetails.error || "Student not found",
            });
          }
        } catch (error) {
          console.error(`Error processing ${scanItem.admissionNumber}:`, error);
          results.errors.push({
            ...scanItem,
            error: error.message,
          });
        }
      }

      // Update session with mapping results
      await updateDoc(doc(db, "admissionScanSessions", sessionId), {
        mappingResults: {
          mapped: results.mapped,
          notFound: results.notFound,
          errors: results.errors,
          lastMappedAt: serverTimestamp(),
          mappedBy: processorInfo.id,
          mappedByName: processorInfo.name,
        },
      });

      return {
        success: true,
        ...results,
        summary: {
          total: scannedAdmissions.length,
          found: results.mapped.length,
          notFound: results.notFound.length,
          errors: results.errors.length,
        },
      };
    } catch (error) {
      console.error("Error mapping admissions to students:", error);
      throw new Error("Failed to map admissions to students");
    }
  },

  // Find student by admission number across all departments
  async findStudentByAdmissionNumber(admissionNumber) {
    try {
      // Use the enhanced search method from studentsService for better performance
      const result = await studentsService.searchByAdmissionNumber(
        admissionNumber
      );

      if (result.found) {
        return {
          found: true,
          student: result.student,
          department: result.department,
          collectionName: result.collectionName,
        };
      } else {
        return {
          found: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error("Error finding student by admission number:", error);
      return {
        found: false,
        error: `Database error: ${error.message}`,
      };
    }
  },

  // Complete scanning session and add participants to activity
  async completeScanningSession(sessionId, options = {}) {
    try {
      const session = await this.getScanningSession(sessionId);

      if (!session.mappingResults) {
        throw new Error("Session must be mapped before completion");
      }

      const { mapped } = session.mappingResults;

      if (options.createParticipants && mapped.length > 0) {
        // Transform mapped results to standardized participant format
        const participants = mapped.map((item) => ({
          id: item.student.id || `${item.student.rollNumber}_${Date.now()}`,
          name: item.student.name,
          rollNumber: item.student.rollNumber,
          admissionNumber: item.student.admissionNumber,
          department: item.student.department,
          year: item.student.year,
          attendance: false, // Initialize as not present
          addedViaScanning: true,
          scanningSessionId: sessionId,
          scannedAt: item.scannedAt,
          scannedBy: item.scannedBy,
          scannedByName: item.scannedByName,
          addedAt: new Date().toISOString(),
          addedBy: session.createdBy,
          addedByName: session.createdByName,
        }));

        try {
          // Use unified service to add participants
          const result = await unifiedActivitiesService.addParticipants(
            session.activityId,
            participants,
            {
              id: session.createdBy,
              name: session.createdByName,
            }
          );

          // Mark the scanning session as completed with integration info
          await updateDoc(doc(db, "admissionScanSessions", sessionId), {
            preparedParticipants: participants,
            status: "completed",
            completedAt: serverTimestamp(),
            integratedWithActivity: true,
            participantsAdded: result.added,
            duplicatesFound: result.duplicates,
          });

          return {
            success: true,
            participants,
            participantsAdded: result.added,
            duplicatesFound: result.duplicates,
            totalParticipants: result.total,
            message: `Successfully added ${
              result.added
            } participants to activity${
              result.duplicates > 0
                ? ` (${result.duplicates} duplicates skipped)`
                : ""
            }`,
          };
        } catch (activityError) {
          console.error(
            "Error adding participants to activity:",
            activityError
          );

          // Still mark session as completed but note the integration failure
          await updateDoc(doc(db, "admissionScanSessions", sessionId), {
            preparedParticipants: participants,
            status: "completed",
            completedAt: serverTimestamp(),
            integratedWithActivity: false,
            integrationError: activityError.message,
          });

          throw new Error(
            `Failed to add participants to activity: ${activityError.message}`
          );
        }
      } else {
        // Just mark session as completed without creating participants
        await updateDoc(doc(db, "admissionScanSessions", sessionId), {
          status: "completed",
          completedAt: serverTimestamp(),
        });

        return {
          success: true,
          message: "Scanning session completed",
        };
      }
    } catch (error) {
      console.error("Error completing scanning session:", error);
      throw new Error("Failed to complete scanning session");
    }
  },

  // Delete a scanning session
  async deleteScanningSession(sessionId, deleterInfo) {
    try {
      await deleteDoc(doc(db, "admissionScanSessions", sessionId));
      return {
        success: true,
        message: "Scanning session deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting scanning session:", error);
      throw new Error("Failed to delete scanning session");
    }
  },

  // Get scanning statistics for an activity
  async getScanningStats(activityId) {
    try {
      // Use the updated getSessionsForActivity which handles ID conversion
      const sessions = await this.getSessionsForActivity(activityId);

      const stats = {
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s) => s.status === "active").length,
        completedSessions: sessions.filter((s) => s.status === "completed")
          .length,
        totalScanned: sessions.reduce(
          (sum, s) => sum + (s.totalScanned || 0),
          0
        ),
        totalMapped: sessions.reduce((sum, s) => {
          return sum + (s.mappingResults?.mapped?.length || 0);
        }, 0),
        totalNotFound: sessions.reduce((sum, s) => {
          return sum + (s.mappingResults?.notFound?.length || 0);
        }, 0),
      };

      return stats;
    } catch (error) {
      console.error("Error getting scanning stats:", error);
      throw new Error("Failed to get scanning statistics");
    }
  },
};
