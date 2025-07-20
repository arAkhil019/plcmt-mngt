// utils/activityLogger.js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const logActivity = async (userId, userName, userEmail, action, details, metadata = {}) => {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId,
      userName,
      userEmail,
      action,
      details,
      timestamp: serverTimestamp(),
      ipAddress: metadata.ipAddress || null,
      userAgent: metadata.userAgent || null,
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
  MARK_ATTENDANCE: 'mark_attendance',
  UPLOAD_EXCEL: 'upload_excel',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user'
};
