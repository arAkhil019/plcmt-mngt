// lib/activitiesService.js
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
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';

const ACTIVITIES_COLLECTION = 'activities';

// Activity structure:
// {
//   id: string,
//   companyName: string,
//   activityType: string, // 'Pre-placement Talk', 'Aptitude Test', 'Group Discussion', 'Technical Interview', 'HR Interview', 'Final Selection'
//   interviewRound: number,
//   date: string,
//   mode: string, // 'Online', 'Offline'
//   location: string,
//   eligibleDepartments: array, // [{ name: string, year: string }]
//   spocName: string,
//   spocContact: string,
//   status: string, // 'Active', 'Inactive', 'Completed'
//   allowedUsers: array, // [{ id: string, name: string, email: string }] - Users who can mark attendance
//   students: array, // [{ id: string, name: string, department: string, year: string, rollNumber: string, attendance: boolean }]
//   createdBy: string, // User ID
//   createdByName: string,
//   createdAt: timestamp,
//   updatedAt: timestamp,
//   totalRegistered: number,
//   totalPresent: number
// }

export const activitiesService = {
  // Create a new activity
  async createActivity(activityData, creatorInfo) {
    try {
      console.log('Creating activity with data:', activityData);
      console.log('Creator info:', creatorInfo);
      
      // Validate required fields
      if (!activityData.companyName || !activityData.date) {
        throw new Error('Company name and date are required');
      }
      
      if (!creatorInfo || !creatorInfo.id || !creatorInfo.name) {
        throw new Error('Creator information is required');
      }
      
      const activity = {
        companyName: activityData.companyName,
        activityType: activityData.activityType || 'Pre-placement Talk',
        interviewRound: activityData.interviewRound || 1,
        date: activityData.date,
        time: activityData.time || '',
        mode: activityData.mode || 'Offline',
        location: activityData.location || '',
        eligibleDepartments: activityData.eligibleDepartments || [],
        spocName: activityData.spocName || '',
        spocContact: activityData.spocContact || '',
        status: activityData.status || 'Active',
        allowedUsers: activityData.allowedUsers || [],
        createdBy: creatorInfo.id,
        createdByName: creatorInfo.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        students: activityData.students || [],
        totalRegistered: activityData.students?.length || 0,
        totalPresent: 0
      };

      console.log('Activity object before save:', activity);
      const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), activity);
      console.log('Activity created with ID:', docRef.id);
      
      return {
        id: docRef.id,
        ...activity,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating activity:', error);
      console.error('Activity data that failed:', activityData);
      console.error('Creator info that failed:', creatorInfo);
      throw new Error(`Failed to create activity: ${error.message}`);
    }
  },

  // Get all activities
  async getAllActivities() {
    try {
      const q = query(
        collection(db, ACTIVITIES_COLLECTION),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      }));
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw new Error('Failed to fetch activities');
    }
  },

  // Get activities for a specific user (created by them or they have permission)
  async getActivitiesForUser(userId) {
    try {
      // Get all activities first, then filter client-side for allowed users
      // This is because Firestore doesn't support complex array queries well
      const allActivities = await this.getAllActivities();
      
      return allActivities.filter(activity => 
        activity.createdBy === userId || 
        activity.allowedUsers?.some(user => user.id === userId)
      );
    } catch (error) {
      console.error('Error fetching user activities:', error);
      throw new Error('Failed to fetch user activities');
    }
  },

  // Get a specific activity by ID
  async getActivityById(activityId) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      } else {
        throw new Error('Activity not found');
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      throw new Error('Failed to fetch activity');
    }
  },

  // Update an activity
  async updateActivity(activityId, updates, updaterInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo.id,
        lastUpdatedByName: updaterInfo.name
      };

      // If students array is being updated, recalculate totals
      if (updates.students) {
        updateData.totalRegistered = updates.students.length;
        updateData.totalPresent = updates.students.filter(student => student.attendance).length;
      }

      await updateDoc(docRef, updateData);
      
      // Return the updated activity
      return await this.getActivityById(activityId);
    } catch (error) {
      console.error('Error updating activity:', error);
      throw new Error('Failed to update activity');
    }
  },

  // Update student attendance for an activity
  async updateStudentAttendance(activityId, studentId, attendanceStatus, updaterInfo) {
    try {
      const activity = await this.getActivityById(activityId);
      
      const updatedStudents = activity.students.map(student => 
        student.id === studentId 
          ? { ...student, attendance: attendanceStatus }
          : student
      );

      const totalPresent = updatedStudents.filter(student => student.attendance).length;

      await updateDoc(doc(db, ACTIVITIES_COLLECTION, activityId), {
        students: updatedStudents,
        totalPresent: totalPresent,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo.id,
        lastUpdatedByName: updaterInfo.name
      });

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error('Error updating student attendance:', error);
      throw new Error('Failed to update student attendance');
    }
  },

  // Add students to an activity (bulk upload from Excel)
  async addStudentsToActivity(activityId, students, updaterInfo) {
    try {
      const activity = await this.getActivityById(activityId);
      
      // Merge new students with existing ones, avoiding duplicates
      const existingStudentIds = new Set(activity.students.map(s => s.id));
      const newStudents = students.filter(s => !existingStudentIds.has(s.id));
      const allStudents = [...activity.students, ...newStudents];

      await updateDoc(doc(db, ACTIVITIES_COLLECTION, activityId), {
        students: allStudents,
        totalRegistered: allStudents.length,
        totalPresent: allStudents.filter(student => student.attendance).length,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo.id,
        lastUpdatedByName: updaterInfo.name
      });

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error('Error adding students to activity:', error);
      throw new Error('Failed to add students to activity');
    }
  },

  // Delete an activity
  async deleteActivity(activityId) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw new Error('Failed to delete activity');
    }
  },

  // Add allowed user to activity
  async addAllowedUser(activityId, userInfo, updaterInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      
      await updateDoc(docRef, {
        allowedUsers: arrayUnion({
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email
        }),
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo.id,
        lastUpdatedByName: updaterInfo.name
      });

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error('Error adding allowed user:', error);
      throw new Error('Failed to add allowed user');
    }
  },

  // Remove allowed user from activity
  async removeAllowedUser(activityId, userInfo, updaterInfo) {
    try {
      const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
      
      await updateDoc(docRef, {
        allowedUsers: arrayRemove({
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email
        }),
        updatedAt: serverTimestamp(),
        lastUpdatedBy: updaterInfo.id,
        lastUpdatedByName: updaterInfo.name
      });

      return await this.getActivityById(activityId);
    } catch (error) {
      console.error('Error removing allowed user:', error);
      throw new Error('Failed to remove allowed user');
    }
  },

  // Get activities by status
  async getActivitiesByStatus(status) {
    try {
      const q = query(
        collection(db, ACTIVITIES_COLLECTION),
        where('status', '==', status),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      }));
    } catch (error) {
      console.error('Error fetching activities by status:', error);
      throw new Error('Failed to fetch activities by status');
    }
  },

  // Get activities by company
  async getActivitiesByCompany(companyName) {
    try {
      const q = query(
        collection(db, ACTIVITIES_COLLECTION),
        where('companyName', '==', companyName),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      }));
    } catch (error) {
      console.error('Error fetching activities by company:', error);
      throw new Error('Failed to fetch activities by company');
    }
  }
};
