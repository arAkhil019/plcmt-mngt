// lib/activityLogsService.js
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

const ACTIVITY_LOGS_COLLECTION = 'activityLogs';

// Activity log structure:
// {
//   id: string,
//   userId: string,
//   userName: string,
//   userEmail: string,
//   action: string, // 'LOGIN', 'LOGOUT', 'CREATE_ACTIVITY', 'UPDATE_ACTIVITY', 'MARK_ATTENDANCE', 'CREATE_USER', etc.
//   description: string,
//   timestamp: timestamp,
//   metadata: object, // Additional context-specific data
//   ipAddress: string (optional),
//   userAgent: string (optional)
// }

export const activityLogsService = {
  // Log a new activity
  async logActivity(userId, userName, userEmail, action, description, metadata = {}) {
    try {
      const logEntry = {
        userId,
        userName,
        userEmail,
        action,
        description,
        metadata,
        timestamp: serverTimestamp(),
        // You can add these if you want to track IP and user agent
        // ipAddress: getUserIP(),
        // userAgent: navigator.userAgent
      };

      const docRef = await addDoc(collection(db, ACTIVITY_LOGS_COLLECTION), logEntry);
      
      return {
        id: docRef.id,
        ...logEntry,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw error for logging failures to avoid breaking main functionality
      return null;
    }
  },

  // Get all activity logs (admin only)
  async getAllLogs(limitCount = 100) {
    try {
      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw new Error('Failed to fetch activity logs');
    }
  },

  // Get logs for a specific user
  async getUserLogs(userId, limitCount = 50) {
    try {
      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));
    } catch (error) {
      console.error('Error fetching user logs:', error);
      throw new Error('Failed to fetch user logs');
    }
  },

  // Get logs by action type
  async getLogsByAction(action, limitCount = 50) {
    try {
      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        where('action', '==', action),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));
    } catch (error) {
      console.error('Error fetching logs by action:', error);
      throw new Error('Failed to fetch logs by action');
    }
  },

  // Get logs within a date range
  async getLogsByDateRange(startDate, endDate, limitCount = 100) {
    try {
      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        where('timestamp', '>=', Timestamp.fromDate(new Date(startDate))),
        where('timestamp', '<=', Timestamp.fromDate(new Date(endDate))),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));
    } catch (error) {
      console.error('Error fetching logs by date range:', error);
      throw new Error('Failed to fetch logs by date range');
    }
  },

  // Get recent activity summary
  async getRecentActivitySummary(limitCount = 20) {
    try {
      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));

      // Group by action type for summary
      const summary = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {});

      return {
        logs,
        summary,
        totalLogs: logs.length
      };
    } catch (error) {
      console.error('Error fetching activity summary:', error);
      throw new Error('Failed to fetch activity summary');
    }
  }
};

// Activity types constants
export const ACTIVITY_LOG_TYPES = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  
  // User Management
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  
  // Activity Management
  CREATE_ACTIVITY: 'CREATE_ACTIVITY',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  
  // Attendance
  MARK_ATTENDANCE: 'MARK_ATTENDANCE',
  BULK_ATTENDANCE_UPDATE: 'BULK_ATTENDANCE_UPDATE',
  
  // File Operations
  UPLOAD_STUDENT_LIST: 'UPLOAD_STUDENT_LIST',
  EXPORT_DATA: 'EXPORT_DATA',
  
  // System
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};
