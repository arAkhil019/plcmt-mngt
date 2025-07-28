# Firestore Rules Update for Admission Scanner

Add these rules to your `firestore.rules` file:

```javascript
// Admission Scan Sessions - for admission number scanning functionality
match /admissionScanSessions/{sessionId} {
  allow read, write: if isAuthenticated() && 
    (resource == null || 
     resource.data.createdBy == request.auth.uid || 
     isAdmin());
}

// Optional: Add enhanced security for session data
match /admissionScanSessions/{sessionId} {
  allow create: if isAuthenticated() && request.auth.uid == request.resource.data.createdBy;
  allow read: if isAuthenticated() && 
    (resource.data.createdBy == request.auth.uid || isAdmin());
  allow update: if isAuthenticated() && 
    (resource.data.createdBy == request.auth.uid || isAdmin()) &&
    // Prevent modification of core session data
    request.resource.data.activityId == resource.data.activityId &&
    request.resource.data.createdBy == resource.data.createdBy;
  allow delete: if isAuthenticated() && 
    (resource.data.createdBy == request.auth.uid || isAdmin());
}
```

## Complete Updated Rules Section

Here's how the complete rules file should look with the new additions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isPlacementCoordinator() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'placement_coordinator' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
      allow create: if isAdmin();
      allow delete: if isAdmin();
    }

    // Activities collection  
    match /activities/{activityId} {
      allow read: if isAuthenticated();
      allow create: if isPlacementCoordinator();
      allow update: if isAuthenticated() && 
        (isAdmin() || 
         resource.data.createdBy == request.auth.uid ||
         request.auth.uid in resource.data.allowedUsers);
      allow delete: if isAdmin() || resource.data.createdBy == request.auth.uid;
    }

    // Activity Participation collection
    match /activityParticipation/{participationId} {
      allow read: if isAuthenticated();
      allow create: if isPlacementCoordinator();
      allow update: if isAuthenticated() && 
        (isAdmin() || 
         resource.data.createdBy == request.auth.uid);
      allow delete: if isAdmin() || resource.data.createdBy == request.auth.uid;
    }

    // Admission Scan Sessions
    match /admissionScanSessions/{sessionId} {
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.createdBy;
      allow read: if isAuthenticated() && 
        (resource.data.createdBy == request.auth.uid || isAdmin());
      allow update: if isAuthenticated() && 
        (resource.data.createdBy == request.auth.uid || isAdmin()) &&
        // Prevent modification of core session data
        request.resource.data.activityId == resource.data.activityId &&
        request.resource.data.createdBy == resource.data.createdBy;
      allow delete: if isAuthenticated() && 
        (resource.data.createdBy == request.auth.uid || isAdmin());
    }

    // Student collections (all departments)
    match /students_{department}/{studentId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
      allow create: if isAdmin();
      allow delete: if isAdmin();
    }

    // Stats collection for department metadata
    match /stats/{statId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
      allow create: if isAdmin();
    }

    // Activity logs
    match /activityLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Logs are immutable
    }
  }
}
```

## Deployment

After updating your `firestore.rules` file, deploy with:

```bash
firebase deploy --only firestore:rules
```

## Security Notes

1. **Session Ownership**: Only the creator of a scanning session can modify it (plus admins)
2. **Immutable Core Data**: Activity ID and creator cannot be changed after session creation
3. **Read Access**: Users can only read their own sessions (plus admins can read all)
4. **Integration**: These rules work with the existing activity and user permission system
