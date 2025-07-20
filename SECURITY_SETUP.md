# Firebase Security & Environment Setup Guide

## 🔒 Secure Configuration Setup

### 1. Environment Variables Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Add your Firebase configuration to `.env.local`:**
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
   ```

### 2. Getting Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon (Project Settings)
4. Scroll down to "Your apps"
5. Select your web app or create one
6. Copy the configuration values to your `.env.local`

### 3. Security Best Practices

#### ✅ **What's Secure:**
- Environment variables are automatically excluded from version control (`.gitignore`)
- Firebase client-side config is safe to expose (this is by design)
- Security comes from Firebase Security Rules, not hiding config
- Each environment (dev/staging/prod) can have different configs

#### ⚠️ **Important Notes:**
- `NEXT_PUBLIC_` prefix makes variables available to the browser
- This is required for Firebase client-side initialization
- Firebase security relies on Firestore Security Rules, not hiding config
- Never commit `.env.local` or `.env.production.local` to version control

### 4. Production Deployment

#### **For Vercel:**
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add each variable:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

#### **For Other Platforms:**
Set the same environment variables in your hosting platform's environment configuration.

### 5. Additional Security Measures

#### **A. Firestore Security Rules (Essential!):**
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
    
    // Activities - role-based access
    match /activities/{activityId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'placement_coordinator']
      );
    }
    
    // Attendance records
    match /attendance/{attendanceId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

#### **B. Firebase Authentication Settings:**
1. Enable only required sign-in methods
2. Set up authorized domains for production
3. Configure password requirements
4. Enable account enumeration protection

#### **C. API Key Restrictions (Optional but Recommended):**
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" > "Credentials"
3. Find your Firebase API key
4. Add HTTP referrer restrictions for production domains

### 6. Environment Validation

The application includes automatic validation that will show an error if any required environment variables are missing. This helps catch configuration issues early.

### 7. Creating Admin User Securely

```bash
# Install dependencies if not already done
npm install

# Set up your .env.local first, then run:
node scripts/createAdminUser.js
```

The script will automatically load environment variables from `.env.local` and create an admin user securely.

### 8. File Structure Summary

```
├── .env.example          # Template with placeholder values
├── .env.local           # Your actual config (never commit!)
├── .gitignore           # Protects .env files from being committed
├── lib/firebase.js      # Uses environment variables
└── scripts/createAdminUser.js  # Uses environment variables
```

## 🚨 Security Checklist

- [ ] `.env.local` created with actual Firebase config
- [ ] `.env.local` is listed in `.gitignore`
- [ ] Firestore Security Rules configured
- [ ] Production environment variables set in hosting platform
- [ ] Only necessary Firebase features enabled
- [ ] Admin user created and password changed
- [ ] Authentication domains configured for production

Remember: The security of your Firebase app primarily depends on proper Security Rules, not hiding the client configuration!
