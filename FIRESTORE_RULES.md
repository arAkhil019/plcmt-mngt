# Firestore Security Rules Documentation

## Overview
These security rules provide comprehensive role-based access control for the placement management system with three main user roles:
- **Admin**: Full access to all data and user management
- **Placement Coordinator**: Can manage activities, view logs, and mark attendance
- **Attendance Marker**: Can mark attendance on assigned activities and view related logs

## Key Security Features

### 🔐 **Role-Based Access Control**
- Dynamic role checking using Firestore document lookups
- Granular permissions based on user roles and ownership
- Active user validation for all operations
- **Universal Activity Visibility**: All authenticated users can view all activities

### 🛡️ **Data Integrity**
- Required field validation on document creation
- Automatic timestamp enforcement
- Immutable audit logs
- Ownership validation for sensitive operations
- Protected student data structure during attendance updates

### 📊 **Permission Matrix**

| Collection | Role | Create | Read | Update | Delete |
|------------|------|--------|------|--------|---------|
| **users** | Admin | ✅ All | ✅ All | ✅ All | ✅ All |
| | User | ❌ | ✅ Own + Active | ✅ Own Profile | ❌ |
| **activities** | Admin | ✅ | ✅ **ALL** | ✅ All | ✅ All |
| | Coordinator | ✅ | ✅ **ALL** | ✅ Own | ✅ Own |
| | Marker | ❌ | ✅ **ALL** | ✅ Attendance Only | ❌ |
| | All Users | ❌ | ✅ **ALL** | ❌ | ❌ |
| **activityLogs** | Admin | ✅ Own | ✅ All | ❌ | ✅ Emergency |
| | User | ✅ Own | ✅ Own | ❌ | ❌ |

## Rule Breakdown

### Key Changes for Universal Activity Visibility

#### `/activities/{activityId}` - Enhanced Activity Access
- **🌍 Universal Read Access**: ALL authenticated users can view ALL activities
- **🔒 Restricted Write Access**: Only authorized users can create/edit
- **👥 Attendance Permissions**: Only assigned markers can update attendance
- **🛡️ Data Protection**: Student list structure protected during attendance updates

### Detailed Permissions

#### **Read Access (✅ Everyone)**
```javascript
allow read: if isAuthenticated();
```
- Any logged-in user can view all activities
- Perfect for dashboard visibility and transparency
- Enables all users to see upcoming placements

#### **Edit Access (🔒 Restricted)**
- **Admins**: Can edit any activity
- **Creators**: Can edit their own activities  
- **Attendance Markers**: Can ONLY update attendance status
- **Other Users**: View-only access

#### **Attendance Marking (👥 Controlled)**
```javascript
// Only assigned attendance markers can update attendance
request.auth.uid in resource.data.get('attendanceMarkers', []) &&
request.resource.data.diff(resource.data).affectedKeys().hasOnly(['students', 'updatedAt']) &&
request.resource.data.students.size() == resource.data.students.size()
```

### Security Safeguards

1. **Protected Student Data**: Attendance markers cannot modify student information, only attendance status
2. **Size Validation**: Ensures student list size remains unchanged during attendance updates
3. **Field Restrictions**: Attendance updates limited to specific fields only
4. **Creator Protection**: Only activity creators can make structural changes
5. **Admin Override**: Admins maintain full access for system management

## Use Cases Enabled

### 👀 **Universal Visibility**
- Students can see all placement activities
- Faculty can monitor all placements
- Coordinators have full visibility across departments
- Transparent placement process

### 🔐 **Controlled Editing**
- Activity creators maintain ownership
- Attendance marking delegated to authorized users
- Admin oversight for all operations
- Data integrity protection

## Deployment Instructions

### Using Firebase CLI
```bash
# Deploy rules only
firebase deploy --only firestore:rules

# Deploy rules and indexes  
firebase deploy --only firestore
```

### Using Firebase Console
1. Go to Firebase Console → Firestore Database → Rules
2. Copy content from `firestore.rules`
3. Paste and publish

## Testing Scenarios

### ✅ **Positive Tests**
- Any user can read all activities
- Coordinators can create new activities
- Assigned markers can update attendance
- Admins can perform all operations

### ❌ **Negative Tests**
- Regular users cannot edit activities
- Attendance markers cannot modify student data
- Non-assigned users cannot mark attendance
- Users cannot delete activities they didn't create

This configuration provides the perfect balance of transparency and security - everyone can see what's happening, but only authorized users can make changes! 🎯✨

---

## Public Student Info Collection

Introduce a dedicated collection to power the public landing page announcements and resources curated by Admins.

- Collection name: `studentPublicInfo`
- Document shape (example):
	- title: string
	- description: string
	- type: 'announcement' | 'link' | 'resource' | 'faq'
	- url?: string
	- category?: string
	- isActive: boolean
	- startDate?: timestamp/string (ISO)
	- endDate?: timestamp/string (ISO)
	- createdAt: timestamp
	- updatedAt: timestamp
	- createdBy, createdByName, lastUpdatedBy, lastUpdatedByName

### Suggested Rules

```rules
match /databases/{database}/documents {
	function isAdmin() {
		return exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
					 get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
	}

	match /studentPublicInfo/{docId} {
		// Public read of active items; optionally enforce visibility window in security rules if dates are timestamps
		allow get, list, read: if request.time != null; // Public site can read without auth if needed

		// Alternatively, to limit to active only at rules level when using timestamp fields:
		// allow read: if resource.data.isActive == true &&
		//   (!('startDate' in resource.data) || resource.data.startDate <= request.time) &&
		//   (!('endDate' in resource.data) || resource.data.endDate >= request.time);

		// Admin-only writes
		allow create, update, delete: if request.auth != null && isAdmin();
	}
}
```

Notes:
- If you store `startDate`/`endDate` as ISO strings, perform visibility filtering on the client (as implemented). If you store them as Firestore Timestamps, you can enforce the window in rules as shown.
- Keep writes restricted to Admin. CPC can be added by extending `isAdmin()` to include role checks.
