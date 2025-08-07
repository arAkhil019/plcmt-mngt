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
  // Utility function to clean metadata by removing undefined values
  cleanMetadata(obj) {
    if (obj === null || obj === undefined) return {};
    if (typeof obj !== 'object') return obj;
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value === null) {
          cleaned[key] = null;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          cleaned[key] = this.cleanMetadata(value);
        } else if (Array.isArray(value)) {
          cleaned[key] = value.filter(item => item !== undefined);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  },

  // Log a new activity with IP address
  async logActivity(userId, userName, userEmail, action, description, metadata = {}) {
    try {
      // Validate required parameters
      if (!userId || !userName || !userEmail || !action || !description) {
        console.error('Missing required parameters for activity log:', {
          userId: !!userId,
          userName: !!userName,
          userEmail: !!userEmail,
          action: !!action,
          description: !!description
        });
        return null;
      }

      // Get IP address if not provided
      let ipAddress = metadata.ipAddress;
      if (!ipAddress) {
        try {
          const { getClientIP } = await import('../utils/ipUtils');
          ipAddress = await getClientIP();
        } catch (error) {
          console.warn('Could not get IP address:', error);
          ipAddress = 'Unknown';
        }
      }

      const logEntry = {
        userId: userId || 'Unknown',
        userName: userName || 'Unknown',
        userEmail: userEmail || 'Unknown',
        action: action || 'UNKNOWN_ACTION',
        description: description || 'No description provided',
        metadata: this.cleanMetadata(metadata || {}),
        timestamp: serverTimestamp(),
        ipAddress,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        clientTimezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Unknown'
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
  },

  // Enhanced method to log detailed activity with specific metadata
  async logDetailedActivity(userId, userName, userEmail, action, description, detailedMetadata = {}) {
    try {
      // Enhanced metadata structure for detailed tracking
      const enhancedMetadata = this.cleanMetadata({
        ...detailedMetadata,
        sessionId: detailedMetadata.sessionId || `session_${Date.now()}`,
        browserInfo: typeof navigator !== 'undefined' ? {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled
        } : {},
        screenInfo: typeof window !== 'undefined' ? {
          width: window.screen?.width,
          height: window.screen?.height,
          colorDepth: window.screen?.colorDepth
        } : {},
        timestamp: new Date().toISOString(),
        category: this.getCategoryByAction(action)
      });

      return await this.logActivity(userId, userName, userEmail, action, description, enhancedMetadata);
    } catch (error) {
      console.error('Error logging detailed activity:', error);
      return null;
    }
  },

  // Get category by action type
  getCategoryByAction(action) {
    for (const [category, actions] of Object.entries(ACTIVITY_LOG_CATEGORIES)) {
      if (actions.includes(action)) {
        return category;
      }
    }
    return 'OTHER';
  },

  // Get logs filtered by category
  async getLogsByCategory(category, limitCount = 50) {
    try {
      const categoryActions = ACTIVITY_LOG_CATEGORIES[category];
      if (!categoryActions) {
        throw new Error('Invalid category');
      }

      // Get logs for all actions in the category
      const allLogs = [];
      
      for (const action of categoryActions) {
        const actionLogs = await this.getLogsByAction(action, limitCount);
        allLogs.push(...actionLogs);
      }

      // Sort by timestamp (newest first) and limit
      const sortedLogs = allLogs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limitCount);

      return sortedLogs;
    } catch (error) {
      console.error('Error fetching logs by category:', error);
      throw new Error('Failed to fetch logs by category');
    }
  },

  // Get logs with advanced filtering
  async getLogsWithFilters(filters = {}) {
    try {
      let q = collection(db, ACTIVITY_LOGS_COLLECTION);

      // Apply filters
      if (filters.userId) {
        q = query(q, where('userId', '==', filters.userId));
      }

      if (filters.action) {
        q = query(q, where('action', '==', filters.action));
      }

      if (filters.category) {
        const categoryActions = ACTIVITY_LOG_CATEGORIES[filters.category];
        if (categoryActions && categoryActions.length > 0) {
          q = query(q, where('action', 'in', categoryActions.slice(0, 10))); // Firestore 'in' limit
        }
      }

      if (filters.startDate) {
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(new Date(filters.startDate))));
      }

      if (filters.endDate) {
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(new Date(filters.endDate))));
      }

      // Always order by timestamp and apply limit
      q = query(q, orderBy('timestamp', 'desc'), limit(filters.limit || 100));

      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));
    } catch (error) {
      console.error('Error fetching logs with filters:', error);
      throw new Error('Failed to fetch filtered logs');
    }
  },

  // Get detailed session information
  async getSessionLogs(sessionId) {
    try {
      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        where('metadata.sessionId', '==', sessionId),
        orderBy('timestamp', 'asc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      }));
    } catch (error) {
      console.error('Error fetching session logs:', error);
      throw new Error('Failed to fetch session logs');
    }
  },

  // Get activity statistics for admin dashboard
  async getActivityStatistics(dateRange = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const q = query(
        collection(db, ACTIVITY_LOGS_COLLECTION),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => doc.data());

      // Calculate statistics
      const stats = {
        totalActivities: logs.length,
        uniqueUsers: new Set(logs.map(log => log.userId)).size,
        actionBreakdown: {},
        categoryBreakdown: {},
        dailyActivity: {},
        topUsers: {},
        recentSessions: new Set(logs.map(log => log.metadata?.sessionId).filter(Boolean)).size
      };

      // Action breakdown
      logs.forEach(log => {
        stats.actionBreakdown[log.action] = (stats.actionBreakdown[log.action] || 0) + 1;
        
        const category = this.getCategoryByAction(log.action);
        stats.categoryBreakdown[category] = (stats.categoryBreakdown[category] || 0) + 1;

        // Daily activity
        const date = new Date(log.timestamp?.toDate?.() || log.timestamp).toDateString();
        stats.dailyActivity[date] = (stats.dailyActivity[date] || 0) + 1;

        // Top users
        const userKey = `${log.userName} (${log.userEmail})`;
        stats.topUsers[userKey] = (stats.topUsers[userKey] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error generating activity statistics:', error);
      throw new Error('Failed to generate activity statistics');
    }
  },

  // Specialized logging methods for different activity types

  // Log admission number scanning with detailed metadata
  async logAdmissionScanning(userId, userName, userEmail, scannedData) {
    const metadata = this.cleanMetadata({
      admissionNumber: scannedData.admissionNumber,
      studentName: scannedData.studentName || 'Unknown',
      companyId: scannedData.companyId || null,
      companyName: scannedData.companyName || 'Unknown',
      activityId: scannedData.activityId || null,
      activityName: scannedData.activityName || 'Unknown',
      scanMethod: scannedData.scanMethod || 'manual', // 'qr', 'manual', 'barcode'
      scanResult: scannedData.scanResult || 'success', // 'success', 'duplicate', 'invalid'
      previouslyScanned: scannedData.previouslyScanned || false,
      scanDuration: scannedData.scanDuration || null, // time taken to scan in ms
      deviceInfo: scannedData.deviceInfo || {}
    });

    let action, description;
    
    if (scannedData.scanResult === 'duplicate') {
      action = ACTIVITY_LOG_TYPES.DUPLICATE_SCAN_ATTEMPT;
      description = `Attempted to scan already scanned admission number: ${scannedData.admissionNumber}`;
    } else if (scannedData.scanResult === 'invalid') {
      action = ACTIVITY_LOG_TYPES.INVALID_SCAN_ATTEMPT;
      description = `Invalid admission number scan attempted: ${scannedData.admissionNumber}`;
    } else {
      action = ACTIVITY_LOG_TYPES.SCAN_ADMISSION_NUMBER;
      description = `Scanned admission number: ${scannedData.admissionNumber} for ${scannedData.studentName}`;
    }

    return await this.logDetailedActivity(userId, userName, userEmail, action, description, metadata);
  },

  // Log bulk scanning operations
  async logBulkScanning(userId, userName, userEmail, bulkData) {
    const metadata = this.cleanMetadata({
      totalScanned: bulkData.totalScanned || 0,
      successfulScans: bulkData.successfulScans || 0,
      duplicateScans: bulkData.duplicateScans || 0,
      invalidScans: bulkData.invalidScans || 0,
      companyId: bulkData.companyId || null,
      companyName: bulkData.companyName || 'Unknown',
      activityId: bulkData.activityId || null,
      activityName: bulkData.activityName || 'Unknown',
      scanMethod: bulkData.scanMethod || 'bulk_upload',
      fileName: bulkData.fileName || null,
      fileSize: bulkData.fileSize || null,
      processingTime: bulkData.processingTime || null, // time taken in ms
      admissionNumbers: bulkData.admissionNumbers || [], // list of scanned numbers
      errors: bulkData.errors || []
    });

    const description = `Bulk scanned ${bulkData.totalScanned} admission numbers (${bulkData.successfulScans} successful, ${bulkData.duplicateScans} duplicates, ${bulkData.invalidScans} invalid)`;

    return await this.logDetailedActivity(userId, userName, userEmail, ACTIVITY_LOG_TYPES.BULK_SCAN_ADMISSIONS, description, metadata);
  },

  // Log scanning session completion
  async logScanningSessionComplete(userId, userName, userEmail, sessionData) {
    const metadata = this.cleanMetadata({
      sessionId: sessionData.sessionId,
      sessionStartTime: sessionData.sessionStartTime,
      sessionEndTime: sessionData.sessionEndTime || new Date().toISOString(),
      sessionDuration: sessionData.sessionDuration || null, // in ms
      totalScanned: sessionData.totalScanned || 0,
      uniqueStudents: sessionData.uniqueStudents || 0,
      companiesInvolved: sessionData.companiesInvolved || [],
      activitiesInvolved: sessionData.activitiesInvolved || [],
      scanningMethod: sessionData.scanningMethod || 'mixed',
      finalStatus: sessionData.finalStatus || 'completed', // 'completed', 'interrupted', 'error'
      notes: sessionData.notes || ''
    });

    const description = `Completed scanning session with ${sessionData.totalScanned} total scans across ${sessionData.companiesInvolved?.length || 0} companies`;

    return await this.logDetailedActivity(userId, userName, userEmail, ACTIVITY_LOG_TYPES.COMPLETE_SCANNING_SESSION, description, metadata);
  },

  // Log detailed login with enhanced tracking
  async logDetailedLogin(userId, userName, userEmail, loginData = {}) {
    const metadata = this.cleanMetadata({
      loginMethod: loginData.loginMethod || 'email', // 'email', 'google', 'microsoft'
      ipAddress: loginData.ipAddress || null,
      location: loginData.location || null, // city, country if available
      deviceFingerprint: loginData.deviceFingerprint || null,
      previousLoginTime: loginData.previousLoginTime || null,
      loginAttempts: loginData.loginAttempts || 1,
      successOnAttempt: loginData.successOnAttempt || 1,
      twoFactorUsed: loginData.twoFactorUsed || false,
      rememberMe: loginData.rememberMe || false,
      redirectUrl: loginData.redirectUrl || '/',
      preApprovalStatus: loginData.preApprovalStatus || 'approved'
    });

    const description = `User logged in via ${loginData.loginMethod || 'email'} ${loginData.loginAttempts > 1 ? `(attempt ${loginData.successOnAttempt}/${loginData.loginAttempts})` : ''}`;

    return await this.logDetailedActivity(userId, userName, userEmail, ACTIVITY_LOG_TYPES.LOGIN, description, metadata);
  },

  // Log detailed logout with session information
  async logDetailedLogout(userId, userName, userEmail, logoutData = {}) {
    const metadata = this.cleanMetadata({
      logoutReason: logoutData.logoutReason || 'manual', // 'manual', 'timeout', 'forced', 'error'
      sessionDuration: logoutData.sessionDuration || null, // in ms
      loginTime: logoutData.loginTime || null,
      logoutTime: logoutData.logoutTime || new Date().toISOString(),
      activitiesPerformed: logoutData.activitiesPerformed || [],
      pagesVisited: logoutData.pagesVisited || [],
      dataModified: logoutData.dataModified || false,
      unsavedChanges: logoutData.unsavedChanges || false,
      logoutMethod: logoutData.logoutMethod || 'button' // 'button', 'browser_close', 'timeout'
    });

    const description = `User logged out (${logoutData.logoutReason || 'manual'}) after ${this.formatDuration(logoutData.sessionDuration)}`;

    return await this.logDetailedActivity(userId, userName, userEmail, ACTIVITY_LOG_TYPES.LOGOUT, description, metadata);
  },

  // Log activity lifecycle events (create, edit, status changes)
  async logActivityLifecycle(userId, userName, userEmail, lifecycleData) {
    const metadata = this.cleanMetadata({
      activityId: lifecycleData.activityId,
      activityName: lifecycleData.activityName,
      companyId: lifecycleData.companyId,
      companyName: lifecycleData.companyName,
      actionType: lifecycleData.actionType, // 'create', 'edit', 'status_change', 'delete'
      previousStatus: lifecycleData.previousStatus || null,
      newStatus: lifecycleData.newStatus || null,
      changedFields: lifecycleData.changedFields || [],
      previousValues: lifecycleData.previousValues || {},
      newValues: lifecycleData.newValues || {},
      approvalRequired: lifecycleData.approvalRequired || false,
      approvedBy: lifecycleData.approvedBy || null,
      reason: lifecycleData.reason || ''
    });

    let action, description;
    
    switch (lifecycleData.actionType) {
      case 'create':
        action = ACTIVITY_LOG_TYPES.CREATE_ACTIVITY;
        description = `Created new activity: ${lifecycleData.activityName} for ${lifecycleData.companyName}`;
        break;
      case 'edit':
        action = ACTIVITY_LOG_TYPES.EDIT_ACTIVITY;
        description = `Edited activity: ${lifecycleData.activityName} (changed: ${lifecycleData.changedFields?.join(', ')})`;
        break;
      case 'status_change':
        action = ACTIVITY_LOG_TYPES.CHANGE_ACTIVITY_STATUS;
        description = `Changed activity status: ${lifecycleData.activityName} from ${lifecycleData.previousStatus} to ${lifecycleData.newStatus}`;
        break;
      case 'delete':
        action = ACTIVITY_LOG_TYPES.DELETE_ACTIVITY;
        description = `Deleted activity: ${lifecycleData.activityName} from ${lifecycleData.companyName}`;
        break;
      default:
        action = ACTIVITY_LOG_TYPES.EDIT_ACTIVITY;
        description = `Modified activity: ${lifecycleData.activityName}`;
    }

    return await this.logDetailedActivity(userId, userName, userEmail, action, description, metadata);
  },

  // Log attendance marking operations (both individual and bulk)
  async logAttendanceMarking(userId, userName, userEmail, attendanceData) {
    const metadata = this.cleanMetadata({
      activityId: attendanceData.activityId,
      activityName: attendanceData.activityName,
      companyId: attendanceData.companyId,
      companyName: attendanceData.companyName,
      operationType: attendanceData.operationType, // 'individual', 'bulk', 'scan_mapping'
      attendanceDetails: attendanceData.attendanceDetails || {},
      participantCount: attendanceData.participantCount || 0,
      presentCount: attendanceData.presentCount || 0,
      absentCount: attendanceData.absentCount || 0,
      markedBy: attendanceData.markedBy,
      markedAt: attendanceData.markedAt || new Date().toISOString(),
      admissionNumbers: attendanceData.admissionNumbers || [],
      departments: attendanceData.departments || [],
      updateMethod: attendanceData.updateMethod || 'manual' // 'manual', 'scanned', 'bulk_upload'
    });

    let action, description;
    
    switch (attendanceData.operationType) {
      case 'individual':
        action = ACTIVITY_LOG_TYPES.MARK_ATTENDANCE;
        description = `Marked individual attendance: ${attendanceData.participantName} as ${attendanceData.attendanceStatus} in ${attendanceData.activityName}`;
        break;
      case 'bulk':
        action = ACTIVITY_LOG_TYPES.BULK_ATTENDANCE_UPDATE;
        description = `Bulk attendance update: ${attendanceData.participantCount} participants (${attendanceData.presentCount} present, ${attendanceData.absentCount} absent) in ${attendanceData.activityName}`;
        break;
      case 'scan_mapping':
        action = ACTIVITY_LOG_TYPES.SCAN_MAPPING_ATTENDANCE;
        description = `Mapped scanned admissions to attendance: ${attendanceData.participantCount} participants in ${attendanceData.activityName}`;
        break;
      default:
        action = ACTIVITY_LOG_TYPES.MARK_ATTENDANCE;
        description = `Attendance operation in ${attendanceData.activityName}`;
    }

    return await this.logDetailedActivity(userId, userName, userEmail, action, description, metadata);
  },

  // Utility method to format duration
  formatDuration(durationMs) {
    if (!durationMs) return 'unknown duration';
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
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
  ACTIVATE_ACTIVITY: 'ACTIVATE_ACTIVITY',
  DEACTIVATE_ACTIVITY: 'DEACTIVATE_ACTIVITY',
  CHANGE_ACTIVITY_STATUS: 'CHANGE_ACTIVITY_STATUS',
  
  // Attendance & Scanning
  MARK_ATTENDANCE: 'MARK_ATTENDANCE',
  BULK_ATTENDANCE_UPDATE: 'BULK_ATTENDANCE_UPDATE',
  SCAN_MAPPING_ATTENDANCE: 'SCAN_MAPPING_ATTENDANCE',
  ADD_PARTICIPANTS: 'ADD_PARTICIPANTS',
  SCAN_ADMISSION_NUMBER: 'SCAN_ADMISSION_NUMBER',
  BULK_SCAN_ADMISSIONS: 'BULK_SCAN_ADMISSIONS',
  REMOVE_SCANNED_ADMISSION: 'REMOVE_SCANNED_ADMISSION',
  COMPLETE_SCANNING_SESSION: 'COMPLETE_SCANNING_SESSION',
  
  // Student Management
  ADD_STUDENT: 'ADD_STUDENT',
  UPDATE_STUDENT: 'UPDATE_STUDENT',
  DELETE_STUDENT: 'DELETE_STUDENT',
  BULK_IMPORT_STUDENTS: 'BULK_IMPORT_STUDENTS',
  CLEAR_DEPARTMENT_STUDENTS: 'CLEAR_DEPARTMENT_STUDENTS',
  EXPORT_STUDENTS: 'EXPORT_STUDENTS',
  
  // File Operations
  UPLOAD_STUDENT_LIST: 'UPLOAD_STUDENT_LIST',
  EXPORT_DATA: 'EXPORT_DATA',
  
  // System
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};

// Activity categories for filtering
export const ACTIVITY_LOG_CATEGORIES = {
  AUTHENTICATION: ['LOGIN', 'LOGOUT'],
  USER_MANAGEMENT: ['CREATE_USER', 'UPDATE_USER', 'DELETE_USER'],
  ACTIVITY_MANAGEMENT: ['CREATE_ACTIVITY', 'UPDATE_ACTIVITY', 'DELETE_ACTIVITY', 'ACTIVATE_ACTIVITY', 'DEACTIVATE_ACTIVITY', 'CHANGE_ACTIVITY_STATUS'],
  ATTENDANCE_SCANNING: ['MARK_ATTENDANCE', 'BULK_ATTENDANCE_UPDATE', 'SCAN_MAPPING_ATTENDANCE', 'ADD_PARTICIPANTS', 'SCAN_ADMISSION_NUMBER', 'BULK_SCAN_ADMISSIONS', 'REMOVE_SCANNED_ADMISSION', 'COMPLETE_SCANNING_SESSION'],
  STUDENT_MANAGEMENT: ['ADD_STUDENT', 'UPDATE_STUDENT', 'DELETE_STUDENT', 'BULK_IMPORT_STUDENTS', 'CLEAR_DEPARTMENT_STUDENTS', 'EXPORT_STUDENTS'],
  FILE_OPERATIONS: ['UPLOAD_STUDENT_LIST', 'EXPORT_DATA'],
  SYSTEM: ['SYSTEM_ERROR', 'PERMISSION_DENIED']
};
