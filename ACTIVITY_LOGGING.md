# Enhanced Activity Logging System

## Overview

The placement management system now includes comprehensive activity logging with detailed metadata capture and admin filtering capabilities. This system tracks all user actions, login/logout activities, admission number scanning, and activity lifecycle events.

## Features

### 1. Detailed Activity Tracking
- **Login/Logout Events**: Comprehensive tracking with session duration, device info, and authentication methods
- **Admission Number Scanning**: Track individual scans, bulk operations, duplicates, and invalid attempts
- **Activity Lifecycle**: Monitor creation, editing, status changes, and deletion of activities
- **System Events**: Error tracking, data exports, and administrative actions

### 2. Enhanced Metadata Capture
Each logged activity includes:
- User identification (ID, name, email)
- Timestamp and session information
- Device and browser details
- Activity-specific metadata (admission numbers, company details, etc.)
- Session tracking and duration calculations

### 3. Admin Dashboard and Filtering
Access comprehensive logs through the admin interface with:
- **Category-based filtering**: Authentication, Activity Management, Attendance Scanning, etc.
- **Date range filtering**: Filter by specific time periods
- **User-based filtering**: Search by user name or email
- **Export functionality**: Download logs as CSV files
- **Multiple view modes**: Table, timeline, and statistics views

## Activity Categories

The system organizes activities into the following categories:

### AUTHENTICATION
- LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_RESET

### ACTIVITY_MANAGEMENT  
- CREATE_ACTIVITY, EDIT_ACTIVITY, DELETE_ACTIVITY, CHANGE_ACTIVITY_STATUS

### ATTENDANCE_SCANNING
- SCAN_ADMISSION_NUMBER, BULK_SCAN_ADMISSIONS, REMOVE_SCANNED_ADMISSION, COMPLETE_SCANNING_SESSION

### COMPANY_MANAGEMENT
- CREATE_COMPANY, EDIT_COMPANY, DELETE_COMPANY

### USER_MANAGEMENT
- CREATE_USER, EDIT_USER, DELETE_USER, APPROVE_USER

### SYSTEM
- ERROR_OCCURRED, SYSTEM_BACKUP, DATA_EXPORT

## Usage

### For Administrators

1. **Access Activity Logs**
   - Navigate to the "Logs" tab in the admin dashboard
   - View comprehensive activity statistics and recent logs

2. **Filter Activities**
   - Use category filters to focus on specific types of activities
   - Apply date ranges to analyze activity during specific periods
   - Search by user to track individual user actions

3. **Export Data**
   - Click "Export CSV" to download filtered log data
   - Use exported data for compliance reporting or analysis

4. **Monitor Real-time Activity**
   - The logs update automatically as activities occur
   - Use the refresh button to get the latest data

### For Developers

#### Basic Activity Logging
```javascript
import { activityLogsService, ACTIVITY_LOG_TYPES } from '../lib/activityLogsService';

// Basic activity logging
await activityLogsService.logActivity(
  userId,
  userName,
  userEmail,
  ACTIVITY_LOG_TYPES.LOGIN,
  'User logged in successfully',
  { additionalMetadata: 'optional' }
);
```

#### Enhanced Login Logging
```javascript
// Detailed login with comprehensive metadata
await activityLogsService.logDetailedLogin(
  userId,
  userName,
  userEmail,
  {
    loginMethod: 'google',
    loginAttempts: 1,
    successOnAttempt: 1,
    previousLoginTime: previousLogin,
    preApprovalStatus: 'approved'
  }
);
```

#### Admission Number Scanning
```javascript
// Log admission number scans with detailed context
await activityLogsService.logAdmissionScanning(
  userId,
  userName,
  userEmail,
  {
    admissionNumber: '12345',
    studentName: 'John Doe',
    companyName: 'Tech Corp',
    activityName: 'Campus Interview',
    scanMethod: 'qr',
    scanResult: 'success'
  }
);
```

#### Activity Lifecycle Events
```javascript
// Track activity creation, editing, status changes
await activityLogsService.logActivityLifecycle(
  userId,
  userName,
  userEmail,
  {
    activityId: 'act_123',
    activityName: 'Campus Drive',
    companyName: 'ABC Company',
    actionType: 'create',
    newStatus: 'Active',
    changedFields: ['name', 'date', 'venue'],
    newValues: { name: 'New Name', date: '2024-01-15' }
  }
);
```

## Data Schema

### Core Log Structure
```javascript
{
  id: 'unique_log_id',
  userId: 'user_id',
  userName: 'Display Name',
  userEmail: 'user@email.com',
  action: 'ACTIVITY_TYPE',
  description: 'Human readable description',
  timestamp: '2024-01-15T10:30:00Z',
  metadata: {
    // Activity-specific data
    sessionId: 'session_123',
    category: 'AUTHENTICATION',
    // ... additional fields
  }
}
```

### Specialized Metadata Structures

#### Login Events
```javascript
metadata: {
  loginMethod: 'google|email',
  loginAttempts: 1,
  successOnAttempt: 1,
  sessionDuration: 3600000, // milliseconds
  deviceFingerprint: 'device_hash',
  ipAddress: '192.168.1.1',
  browserInfo: { /* browser details */ }
}
```

#### Scanning Events
```javascript
metadata: {
  admissionNumber: '12345',
  studentName: 'Student Name',
  companyId: 'company_id',
  companyName: 'Company Name',
  scanMethod: 'qr|manual|barcode',
  scanResult: 'success|duplicate|invalid',
  scanDuration: 1500 // milliseconds
}
```

## API Reference

### Main Service Methods

#### `logActivity(userId, userName, userEmail, action, description, metadata)`
Basic activity logging method for simple events.

#### `logDetailedActivity(userId, userName, userEmail, action, description, detailedMetadata)`
Enhanced logging with automatic metadata enrichment (browser info, device details).

#### `logDetailedLogin(userId, userName, userEmail, loginData)`
Specialized method for login events with authentication-specific metadata.

#### `logDetailedLogout(userId, userName, userEmail, logoutData)`
Specialized method for logout events with session duration tracking.

#### `logAdmissionScanning(userId, userName, userEmail, scannedData)`
Track admission number scanning with detailed context.

#### `logActivityLifecycle(userId, userName, userEmail, lifecycleData)`
Monitor activity creation, editing, and status changes.

### Query Methods

#### `getLogsWithFilters(filters)`
Retrieve logs with advanced filtering options:
```javascript
const logs = await activityLogsService.getLogsWithFilters({
  category: 'AUTHENTICATION',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  userId: 'specific_user_id',
  limit: 100
});
```

#### `getActivityStatistics(dateRange)`
Get comprehensive statistics for the admin dashboard:
```javascript
const stats = await activityLogsService.getActivityStatistics(7); // last 7 days
// Returns: totalActivities, uniqueUsers, actionBreakdown, categoryBreakdown, etc.
```

## Security and Privacy

- All logs include user consent through the application's terms of service
- Personal data is limited to necessary identification and activity context
- Logs are stored securely in Firestore with appropriate access controls
- Admin access is restricted to users with 'admin' role
- Export functionality includes data sanitization

## Performance Considerations

- Logs are paginated to handle large datasets efficiently
- Filtering operations use Firestore indexes for optimal performance
- Background logging doesn't block user interface operations
- Metadata is structured to support efficient querying

## Troubleshooting

### Common Issues

1. **Logs not appearing**
   - Check user permissions (admin role required for viewing)
   - Verify Firebase connection and authentication
   - Check browser console for errors

2. **Performance issues**
   - Use date range filters to limit query scope
   - Avoid exporting very large datasets
   - Consider increasing pagination limits gradually

3. **Missing metadata**
   - Ensure enhanced logging methods are used for detailed tracking
   - Check that user context is available when logging occurs
   - Verify that metadata objects are properly structured

### Support

For technical support or feature requests related to the activity logging system, contact the development team or create an issue in the project repository.
