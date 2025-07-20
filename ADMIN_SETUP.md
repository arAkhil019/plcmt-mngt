# Admin User Creation Setup

## Overview
The application now supports secure admin user creation using the Firebase Admin SDK on the server-side.

## Setup Instructions

### 1. Firebase Service Account
You need to set up a Firebase service account to enable admin operations:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`placement-tracker-cbit`)
3. Go to Project Settings > Service Accounts
4. Click "Generate new private key"
5. Download the JSON file

### 2. Environment Configuration
You have two options to configure the service account:

**Option A: Environment Variable (Recommended for production)**
```bash
# Add to .env.local
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"placement-tracker-cbit",...}
```

**Option B: JSON File (For local development)**
- Place the downloaded JSON file as `serviceAccountKey.json` in the project root
- Make sure to add `serviceAccountKey.json` to `.gitignore`

### 3. Features Added

#### Backend API Route
- **Endpoint**: `POST /api/createAdmin`
- **Payload**: `{ email, password, name }`
- **Security**: Uses Firebase Admin SDK with elevated privileges
- **Function**: Creates user in Auth, sets admin custom claims, creates Firestore profile

#### Frontend Components
- **AdminUserForm**: Form component for creating admin users
- **UserManagement**: Updated with "Create Admin" button and modal
- **AuthContext**: Added `createAdmin` function

#### Security Features
- Admin creation happens server-side only
- Custom claims set for proper role-based access
- Firestore security rules can check for admin custom claims
- Separate from regular user creation flow

### 4. Usage

1. Only existing admins can access the "Create Admin" button in User Management
2. Click "Create Admin" to open the modal
3. Fill in admin details (name, email, password)
4. New admin user is created with:
   - Firebase Authentication account
   - Custom claim `role: 'admin'`
   - Firestore profile document

### 5. Security Considerations

- Service account credentials should never be exposed in client-side code
- Use environment variables in production
- Regularly rotate service account keys
- Monitor admin creation activities in logs

### 6. Troubleshooting

**Common Issues:**
- Ensure service account has proper Firebase permissions
- Check that the project ID matches in the service account JSON
- Verify `.env.local` is not committed to version control
- Make sure firebase-admin package is installed

**Error Messages:**
- "Service account not found" → Check environment variable or JSON file
- "Insufficient permissions" → Verify service account role in Firebase Console
- "Project not found" → Ensure correct project_id in service account

## Next Steps

After setup:
1. Create your first admin user
2. Test admin login and permissions
3. Configure Firestore security rules to use custom claims
4. Set up monitoring and logging for admin activities
