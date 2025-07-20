# Firebase Setup Instructions

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "plcmt-mngt")
4. Enable/disable Google Analytics as needed
5. Click "Create project"

## 2. Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Save the changes

## 3. Create Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll secure it later)
4. Select a location close to your users
5. Click "Done"

## 4. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon to add web app
4. Register your app with a nickname
5. Copy the firebaseConfig object

# Firebase Setup Instructions

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "plcmt-mngt")
4. Enable/disable Google Analytics as needed
5. Click "Create project"

## 2. Enable Authentication

1. In Firebase Console, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Save the changes

## 3. Create Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll secure it later)
4. Select a location close to your users
5. Click "Done"

## 4. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon to add web app
4. Register your app with a nickname
5. Copy the firebaseConfig object

## 5. Secure Environment Setup

⚠️ **IMPORTANT: Follow the security setup guide for proper configuration**

See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for detailed instructions on:
- Setting up environment variables securely
- Configuring `.env.local` with your Firebase credentials
- Production deployment best practices
- Security rules and restrictions

Quick setup:
```bash
# Copy the template
cp .env.example .env.local

# Edit .env.local with your actual Firebase config values
# Never commit this file to version control!
```

## 6. Create Admin User

Since this is the first setup, you'll need to create an admin user manually:

1. Run the app: `npm run dev`
2. The login screen will appear, but you don't have users yet
3. Temporarily modify the auth context to create the first admin user, or
4. Use Firebase Console to add a user manually:
   - Go to Authentication > Users
   - Click "Add user"
   - Enter email and password
   - After creating, go to Firestore Database
   - Create a document in "users" collection with the user's UID:
     ```
     {
       email: "admin@example.com",
       name: "Admin User",
       role: "admin",
       isActive: true,
       createdAt: [current timestamp]
     }
     ```

## 7. Firestore Security Rules

After testing, update Firestore rules for security:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Activity logs - only admins can read
    match /activityLogs/{logId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // All other collections require authentication
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 8. Test the Application

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Login with your admin credentials
4. Test creating users, activities, and marking attendance

## User Roles Explained

- **Admin**: Full access to everything - manage users, view logs, create/edit activities
- **Placement Coordinator**: Can create activities, assign users to mark attendance, edit their own activities
- **Attendance Marker**: Can only mark attendance for activities they're assigned to

## Troubleshooting

1. **Authentication errors**: Check if Email/Password is enabled in Firebase Auth
2. **Firestore errors**: Ensure database is created and rules allow access
3. **Build errors**: Make sure all Firebase dependencies are installed: `npm install firebase`
