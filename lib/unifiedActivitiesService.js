// lib/unifiedActivitiesService.js
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
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const ACTIVITIES_COLLECTION = "activities";

/**
 * Helper function to remove undefined values from objects recursively
 * Firebase doesn't allow undefined values in documents
 */
const cleanUndefinedValues = (obj) => {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = cleanUndefinedValues(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }
  
  return obj;
};

/**
 * Unified Activities Service - Single source of truth for all activity operations
 *
 * This service replaces both activitiesService and activityParticipationService
 * to provide a single, consistent API for all activity-related operations.
 *
 * Key Features:
 * - Single data model for all activities
 * - Firestore document IDs as primary identifiers
 * - Unified participant management
 * - Consistent API across all operations
 * - Backward compatibility during migration
 */

// Standard activity structure - single source of truth
const createStandardActivity = (activityData, docId = null) => ({
  // Core identifiers
  id: docId || activityData.id, // Firestore document ID is primary

  // Basic activity information
  companyName: activityData.companyName || "",
  activityType: activityData.activityType || "Pre-placement Talk",
  interviewRound: activityData.interviewRound || 1,
  date: activityData.date || "",
  time: activityData.time || "",
  mode: activityData.mode || "Offline",
  location: activityData.location || "",
  status: activityData.status || "Active",

  // Department and contact information
  eligibleDepartments: activityData.eligibleDepartments || [],
  spocName: activityData.spocName || "",
  spocContact: activityData.spocContact || "",

  // Participants (standardized to 'participants' only)
  participants: activityData.participants || [],

  // Scanned admission numbers (new field)
  scannedAdmissions: activityData.scannedAdmissions || [],

  // Computed fields (standardized naming)
  totalParticipants: (activityData.participants || []).length,
  totalPresent: (activityData.participants || []).filter((p) => p.attendance)
    .length,
  totalScannedAdmissions: (activityData.scannedAdmissions || []).length,

  // Access control
  allowedUsers: activityData.allowedUsers || [],

  // Metadata (standardized naming)
  createdAt: activityData.createdAt,
  createdBy: activityData.createdBy,
  createdByName: activityData.createdByName,
  updatedAt: activityData.updatedAt,
  lastUpdatedBy: activityData.lastUpdatedBy,
  lastUpdatedByName: activityData.lastUpdatedByName,

  // Status tracking
  isActive:
    activityData.isActive !== false && activityData.status !== "Inactive",
});

export const unifiedActivitiesService = {
  // ==================== ACTIVITY CRUD OPERATIONS ====================

  /**
   * Create a new activity
   */
  async createActivity(activityData, creatorInfo) {
    try {
      // Validate required fields
      if (!activityData.companyName || !activityData.date) {
        throw new Error("Company name and date are required");
      }

      if (!creatorInfo?.id || !creatorInfo?.name) {
        throw new Error("Creator information is required");
      }

      // Create standardized activity object
      const activity = {
        companyName: activityData.companyName.trim(),
        activityType: activityData.activityType || "Pre-placement Talk",
        interviewRound: activityData.interviewRound || 1,
        date: activityData.date,
        time: activityData.time || "",
        mode: activityData.mode || "Offline",
        location: activityData.location?.trim() || "",
        status: activityData.status || "Active",
        eligibleDepartments: activityData.eligibleDepartments || [],
        spocName: activityData.spocName?.trim() || "",
        spocContact: activityData.spocContact?.trim() || "",
        participants: activityData.participants || [],
        scannedAdmissions: activityData.scannedAdmissions || [],
        allowedUsers: activityData.allowedUsers || [],

        // Metadata
        createdAt: serverTimestamp(),
        createdBy: creatorInfo.id || 'unknown',
        createdByName: creatorInfo.name || 'Unknown User',
        updatedAt: serverTimestamp(),
        lastUpdatedBy: creatorInfo.id || 'unknown',
        lastUpdatedByName: creatorInfo.name || 'Unknown User',
        isActive: true,
      };

      // Clean undefined values before saving
      const cleanActivity = cleanUndefinedValues(activity);

      // Save to Firestore
      const docRef = await addDoc(
        collection(db, ACTIVITIES_COLLECTION),
        cleanActivity
      );

      // Return standardized activity
      return createStandardActivity(
        {
          ...cleanActivity,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        docRef.id
      );
    } catch (error) {
      console.error("Error creating activity:", error);
      throw new Error(`Failed to create activity: ${error.message}`);
    }
  },

  /**
   * Get all activities
   */
  async getAllActivities() {
    try {
      // Simple query without compound index requirement
      const q = query(
        collection(db, 'activities'),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(q);

      // Filter out only deleted activities, keep all others (including inactive)
      const activities = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return createStandardActivity(
            {
              ...data,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            },
            doc.id
          );
        })
        .filter((activity) => activity.status !== "Deleted"); // Only filter out deleted activities, keep inactive ones

      return activities;
    } catch (error) {
      console.error("Error fetching activities:", error);
      throw new Error("Failed to fetch activities");
    }
  },

  /**
   * Get activity by ID
   */
  async getActivityById(activityId) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Activity not found");
      }

      const data = docSnap.data();
      return createStandardActivity(
        {
          ...data,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt:
            data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        },
        docSnap.id
      );
    } catch (error) {
      console.error("Error fetching activity:", error);
      throw new Error("Failed to fetch activity");
    }
  },

  /**
   * Update activity
   */
  async updateActivity(activityId, updates, updaterInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);

      // Clean and validate updaterInfo to prevent undefined values
      const cleanUpdaterInfo = {
        id: updaterInfo?.id || 'unknown',
        name: updaterInfo?.name || 'Unknown User'
      };

      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: cleanUpdaterInfo.id,
        lastUpdatedByName: cleanUpdaterInfo.name,
      };

      // Auto-calculate participant totals if participants are updated
      if (updates.participants) {
        updateData.totalParticipants = updates.participants.length;
        updateData.totalPresent = updates.participants.filter(
          (p) => p.attendance
        ).length;
      }

      // Clean undefined values recursively
      const cleanUpdateData = cleanUndefinedValues(updateData);

      await updateDoc(docRef, cleanUpdateData);

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error("Error updating activity:", error);
      throw new Error(`Failed to update activity: ${error.message}`);
    }
  },

  /**
   * Delete activity (soft delete)
   */
  async deleteActivity(activityId, userInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      
      // Check if the activity exists
      const activitySnap = await getDoc(docRef);
      if (!activitySnap.exists()) {
        throw new Error("Activity not found");
      }

      const activityData = activitySnap.data();
      const participantCount = activityData.totalParticipants || (activityData.participants?.length || 0);

      const updateData = {
        isActive: false,
        status: "Deleted",
        deletedAt: serverTimestamp(),
        deletedBy: userInfo?.id || 'unknown',
        deletedByName: userInfo?.name || 'Unknown User',
        updatedAt: serverTimestamp(),
      };

      const cleanUpdateData = cleanUndefinedValues(updateData);
      await updateDoc(docRef, cleanUpdateData);

      return {
        success: true,
        message: "Activity deleted successfully",
        deletedParticipationRecords: participantCount,
      };
    } catch (error) {
      console.error("Error deleting activity:", error);
      throw new Error(`Failed to delete activity: ${error.message}`);
    }
  },

  // ==================== PARTICIPANT MANAGEMENT ====================

  /**
   * Add participants to activity with duplicate checking and data merging
   */
  async addParticipants(activityId, participants, updaterInfo) {
    try {
      const activity = await this.getActivityById(activityId);

      // Create maps for efficient lookup
      const existingParticipantsMap = new Map();
      activity.participants.forEach(p => {
        // Use admission number as primary key, roll number as secondary
        // Normalize to strings for consistent comparison
        if (p.admissionNumber) {
          const normalizedAdmissionNumber = String(p.admissionNumber).trim();
          existingParticipantsMap.set(`admission_${normalizedAdmissionNumber}`, p);
        }
        if (p.rollNumber) {
          const normalizedRollNumber = String(p.rollNumber).trim();
          existingParticipantsMap.set(`roll_${normalizedRollNumber}`, p);
        }
      });

      const newParticipants = [];
      const updatedParticipants = [];
      const duplicates = [];

      participants.forEach(newParticipant => {
        let existingParticipant = null;
        let matchKey = null;

        // Check for duplicates by admission number first (more reliable)
        if (newParticipant.admissionNumber) {
          const normalizedAdmissionNumber = String(newParticipant.admissionNumber).trim();
          const admissionKey = `admission_${normalizedAdmissionNumber}`;
          if (existingParticipantsMap.has(admissionKey)) {
            existingParticipant = existingParticipantsMap.get(admissionKey);
            matchKey = admissionKey;
          }
        }

        // If not found by admission number, check by roll number
        if (!existingParticipant && newParticipant.rollNumber) {
          const normalizedRollNumber = String(newParticipant.rollNumber).trim();
          const rollKey = `roll_${normalizedRollNumber}`;
          if (existingParticipantsMap.has(rollKey)) {
            existingParticipant = existingParticipantsMap.get(rollKey);
            matchKey = rollKey;
          }
        }

        if (existingParticipant) {
          // Merge data - fill in missing fields in existing participant
          const mergedParticipant = {
            ...existingParticipant,
            // Update fields that might be missing or need updating
            name: existingParticipant.name || newParticipant.name,
            admissionNumber: existingParticipant.admissionNumber || newParticipant.admissionNumber,
            department: existingParticipant.department || newParticipant.department,
            departmentCode: existingParticipant.departmentCode || newParticipant.departmentCode,
            year: existingParticipant.year || newParticipant.year,
            // Keep attendance status from existing participant
            // Update metadata
            lastUpdatedAt: new Date().toISOString(),
            lastUpdatedBy: updaterInfo?.name || 'Unknown User',
            lastUpdatedById: updaterInfo?.id || 'unknown',
          };

          // Check if any data was actually updated
          const dataChanged = JSON.stringify(existingParticipant) !== JSON.stringify(mergedParticipant);
          
          if (dataChanged) {
            updatedParticipants.push(mergedParticipant);
            // Update the existing participant in the map
            existingParticipantsMap.set(matchKey, mergedParticipant);
          } else {
            duplicates.push({
              participant: newParticipant,
              reason: 'Exact duplicate found'
            });
          }
        } else {
          // New participant - add creation metadata
          const participantWithMetadata = {
            ...newParticipant,
            addedAt: new Date().toISOString(),
            addedBy: updaterInfo?.name || 'Unknown User',
            addedById: updaterInfo?.id || 'unknown',
          };
          
          newParticipants.push(participantWithMetadata);
          
          // Add to map to prevent duplicates within the same batch
          if (participantWithMetadata.admissionNumber) {
            const normalizedAdmissionNumber = String(participantWithMetadata.admissionNumber).trim();
            existingParticipantsMap.set(`admission_${normalizedAdmissionNumber}`, participantWithMetadata);
          }
          if (participantWithMetadata.rollNumber) {
            const normalizedRollNumber = String(participantWithMetadata.rollNumber).trim();
            existingParticipantsMap.set(`roll_${normalizedRollNumber}`, participantWithMetadata);
          }
        }
      });

      // Reconstruct the full participants list with updates
      const finalParticipants = activity.participants.map(existingP => {
        // Find if this participant was updated - normalize for comparison
        const updatedP = updatedParticipants.find(updP => 
          (existingP.admissionNumber && updP.admissionNumber && 
           String(existingP.admissionNumber).trim() === String(updP.admissionNumber).trim()) ||
          (existingP.rollNumber && updP.rollNumber && 
           String(existingP.rollNumber).trim() === String(updP.rollNumber).trim())
        );
        return updatedP || existingP;
      });

      // Add new participants
      finalParticipants.push(...newParticipants);

      await this.updateActivity(
        activityId,
        {
          participants: finalParticipants,
        },
        updaterInfo
      );

      return {
        success: true,
        added: newParticipants.length,
        updated: updatedParticipants.length,
        duplicates: duplicates.length,
        total: finalParticipants.length,
        details: {
          newParticipants: newParticipants.map(p => ({ name: p.name, rollNumber: p.rollNumber })),
          updatedParticipants: updatedParticipants.map(p => ({ name: p.name, rollNumber: p.rollNumber })),
          duplicates: duplicates.map(d => ({ name: d.participant.name, rollNumber: d.participant.rollNumber, reason: d.reason }))
        }
      };
    } catch (error) {
      console.error("Error adding participants:", error);
      throw new Error(`Failed to add participants: ${error.message}`);
    }
  },

  /**
   * Update participant attendance
   */
  async markAttendance(
    activityId,
    participantIdentifier,
    isPresent,
    updaterInfo
  ) {
    try {
      const activity = await this.getActivityById(activityId);

      const participantIndex = activity.participants.findIndex(
        (p) =>
          (p.admissionNumber && String(p.admissionNumber).trim() === String(participantIdentifier).trim()) ||
          (p.rollNumber && String(p.rollNumber).trim() === String(participantIdentifier).trim())
      );

      if (participantIndex === -1) {
        throw new Error("Participant not found in activity");
      }

      // Update participant attendance
      const updatedParticipants = [...activity.participants];
      updatedParticipants[participantIndex] = {
        ...updatedParticipants[participantIndex],
        attendance: isPresent,
        attendanceMarkedAt: new Date().toISOString(),
        attendanceMarkedBy: updaterInfo.id,
        attendanceMarkedByName: updaterInfo.name,
      };

      await this.updateActivity(
        activityId,
        {
          participants: updatedParticipants,
        },
        updaterInfo
      );

      return {
        success: true,
        participant: updatedParticipants[participantIndex],
      };
    } catch (error) {
      console.error("Error marking attendance:", error);
      throw new Error(`Failed to mark attendance: ${error.message}`);
    }
  },

  /**
   * Mark attendance for multiple participants at once
   */
  async markAttendanceForParticipants(activityId, participantUpdates, updaterInfo) {
    try {
      const activity = await this.getActivityById(activityId);
      const updatedParticipants = [...(activity.participants || [])];

      // Process each participant update
      for (const update of participantUpdates) {
        // Find existing participant - normalize admission numbers for comparison
        const existingIndex = updatedParticipants.findIndex(
          (p) => {
            // Primary match: admission number
            if (p.admissionNumber && update.admissionNumber) {
              const participantAdmission = String(p.admissionNumber).trim();
              const updateAdmission = String(update.admissionNumber).trim();
              if (participantAdmission === updateAdmission) {
                return true;
              }
            }
            
            // Secondary match: roll number
            if (p.rollNumber && update.rollNumber) {
              const participantRoll = String(p.rollNumber).trim();
              const updateRoll = String(update.rollNumber).trim();
              if (participantRoll === updateRoll) {
                return true;
              }
            }
            
            // Tertiary match: ID
            if (p.id && update.id && p.id === update.id) {
              return true;
            }
            
            return false;
          }
        );

        if (existingIndex !== -1) {
          // Update existing participant - only update attendance-related fields
          // NEVER update admissionNumber, rollNumber, name, or department for existing participants
          // as this could corrupt the data by overwriting correct values
          const updateFields = {
            attendance: update.attendance,
            attendanceMarkedAt: new Date().toISOString(),
            attendanceMarkedBy: updaterInfo.id,
            attendanceMarkedByName: updaterInfo.name,
          };
          
          updatedParticipants[existingIndex] = {
            ...updatedParticipants[existingIndex],
            ...updateFields,
          };
        } else {
          // Add new participant - create complete participant data
          const participantData = {
            id: update.id || update.admissionNumber,
            admissionNumber: update.admissionNumber,
            name: update.name || "N/A",
            rollNumber: update.rollNumber || "",
            department: update.department || "",
            attendance: update.attendance,
            attendanceMarkedAt: new Date().toISOString(),
            attendanceMarkedBy: updaterInfo.id,
            attendanceMarkedByName: updaterInfo.name,
          };
          updatedParticipants.push(participantData);
        }
      }

      // Update the activity with new participants list
      await this.updateActivity(
        activityId,
        {
          participants: updatedParticipants,
        },
        updaterInfo
      );

      return {
        success: true,
        updatedCount: participantUpdates.length,
        participants: updatedParticipants,
      };
    } catch (error) {
      console.error("Error marking attendance for participants:", error);
      throw new Error(`Failed to mark attendance for participants: ${error.message}`);
    }
  },

  /**
   * Remove participant from activity
   */
  async removeParticipant(activityId, participantIdentifier, updaterInfo) {
    try {
      const activity = await this.getActivityById(activityId);

      const updatedParticipants = activity.participants.filter(
        (p) =>
          p.admissionNumber !== participantIdentifier &&
          p.rollNumber !== participantIdentifier
      );

      await this.updateActivity(
        activityId,
        {
          participants: updatedParticipants,
        },
        updaterInfo
      );

      return {
        success: true,
        removed: activity.participants.length - updatedParticipants.length,
      };
    } catch (error) {
      console.error("Error removing participant:", error);
      throw new Error(`Failed to remove participant: ${error.message}`);
    }
  },

  // ==================== ACCESS CONTROL ====================

  /**
   * Add allowed user to activity
   */
  async addAllowedUser(activityId, userInfo, updaterInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);

      const updateData = {
        allowedUsers: arrayUnion({
          id: userInfo?.id || 'unknown',
          name: userInfo?.name || 'Unknown User',
          email: userInfo?.email || '',
        }),
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo?.id || 'unknown',
        lastUpdatedByName: updaterInfo?.name || 'Unknown User',
      };

      const cleanUpdateData = cleanUndefinedValues(updateData);
      await updateDoc(docRef, cleanUpdateData);

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error("Error adding allowed user:", error);
      throw new Error("Failed to add allowed user");
    }
  },

  /**
   * Remove allowed user from activity
   */
  async removeAllowedUser(activityId, userInfo, updaterInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);

      const updateData = {
        allowedUsers: arrayRemove({
          id: userInfo?.id || 'unknown',
          name: userInfo?.name || 'Unknown User',
          email: userInfo?.email || '',
        }),
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo?.id || 'unknown',
        lastUpdatedByName: updaterInfo?.name || 'Unknown User',
      };

      const cleanUpdateData = cleanUndefinedValues(updateData);
      await updateDoc(docRef, cleanUpdateData);

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error("Error removing allowed user:", error);
      throw new Error("Failed to remove allowed user");
    }
  },

  // ==================== QUERY METHODS ====================

  /**
   * Get activities by status
   */
  async getActivitiesByStatus(status) {
    try {
      // Simple query without compound index requirement
      const q = query(
        collection(db, ACTIVITIES_COLLECTION),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(q);

      // Filter by status and active flag in memory
      const activities = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return createStandardActivity(
            {
              ...data,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            },
            doc.id
          );
        })
        .filter(activity => 
          activity.status === status && 
          activity.isActive !== false && 
          activity.status !== "Deleted"
        );

      return activities;
    } catch (error) {
      console.error("Error fetching activities by status:", error);
      throw new Error("Failed to fetch activities by status");
    }
  },

  /**
   * Get activities by company
   */
  async getActivitiesByCompany(companyName) {
    try {
      // Simple query without compound index requirement
      const q = query(
        collection(db, ACTIVITIES_COLLECTION),
        orderBy("date", "desc")
      );

      const snapshot = await getDocs(q);

      // Filter by company and active flag in memory
      const activities = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return createStandardActivity(
            {
              ...data,
              createdAt:
                data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
              updatedAt:
                data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            },
            doc.id
          );
        })
        .filter(activity => 
          activity.companyName === companyName && 
          activity.isActive !== false && 
          activity.status !== "Deleted"
        );

      return activities;
    } catch (error) {
      console.error("Error fetching activities by company:", error);
      throw new Error("Failed to fetch activities by company");
    }
  },

  /**
   * Get activities for a specific user
   */
  async getActivitiesForUser(userId) {
    try {
      const allActivities = await this.getAllActivities();

      return allActivities.filter(
        (activity) =>
          activity.createdBy === userId ||
          activity.allowedUsers?.some((user) => user.id === userId)
      );
    } catch (error) {
      console.error("Error fetching user activities:", error);
      throw new Error("Failed to fetch user activities");
    }
  },

  // ==================== UTILITY METHODS ====================

  /**
   * Get activity statistics
   */
  async getActivityStats() {
    try {
      const activities = await this.getAllActivities();

      const stats = {
        total: activities.length,
        active: activities.filter((a) => a.status === "Active").length,
        completed: activities.filter((a) => a.status === "Completed").length,
        totalParticipants: activities.reduce(
          (sum, a) => sum + a.totalParticipants,
          0
        ),
        totalPresent: activities.reduce((sum, a) => sum + a.totalPresent, 0),
      };

      return stats;
    } catch (error) {
      console.error("Error getting activity stats:", error);
      throw new Error("Failed to get activity statistics");
    }
  },

  /**
   * Validate participant data structure
   */
  validateParticipant(participant) {
    const required = ["name", "rollNumber", "admissionNumber", "department"];
    const missing = required.filter((field) => !participant[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required participant fields: ${missing.join(", ")}`
      );
    }

    return {
      id: participant.id || `${participant.rollNumber}_${Date.now()}`,
      name: participant.name.trim(),
      rollNumber: participant.rollNumber.trim(),
      admissionNumber: participant.admissionNumber.trim(),
      department: participant.department.trim(),
      year: participant.year || "",
      attendance: participant.attendance || false,
      addedAt: participant.addedAt || new Date().toISOString(),
      addedBy: participant.addedBy || null,
      addedByName: participant.addedByName || null,
    };
  },

  /**
   * Bulk add participants with validation
   */
  async bulkAddParticipants(activityId, participants, updaterInfo) {
    try {
      const validatedParticipants = participants.map((p) =>
        this.validateParticipant(p)
      );
      return await this.addParticipants(
        activityId,
        validatedParticipants,
        updaterInfo
      );
    } catch (error) {
      console.error("Error in bulk add participants:", error);
      throw new Error(`Failed to bulk add participants: ${error.message}`);
    }
  },
};
