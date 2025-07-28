// utils/activityLogger.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const logActivity = async (userId, userName, userEmail, action, details, metadata = {}) => {
  try {
    // Get IP address if not provided
    let ipAddress = metadata.ipAddress;
    if (!ipAddress) {
      try {
        const { getClientIP } = await import('./ipUtils');
        ipAddress = await getClientIP();
      } catch (error) {
        console.warn('Could not get IP address:', error);
        ipAddress = 'Unknown';
      }
    }

    await addDoc(collection(db, 'activityLogs'), {
      userId,
      userName,
      userEmail,
      action,
      details,
      timestamp: serverTimestamp(),
      ipAddress,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      clientTimezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Unknown',
      ...metadata
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Predefined activity types
export const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  CREATE_ACTIVITY: 'create_activity',
  EDIT_ACTIVITY: 'edit_activity',
  DELETE_ACTIVITY: 'delete_activity',
  ACTIVATE_ACTIVITY: 'activate_activity',
  DEACTIVATE_ACTIVITY: 'deactivate_activity',
  CHANGE_ACTIVITY_STATUS: 'change_activity_status',
  MARK_ATTENDANCE: 'mark_attendance',
  UPLOAD_EXCEL: 'upload_excel',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user'
};
