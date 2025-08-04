# Google Authentication Setup Guide

This application now uses **Google Authentication only**. Users will sign in using their Google accounts.

## Firebase Console Setup

### 1. Enable Google Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** > **Sign-in method**
4. Click on **Google** provider
5. Enable the provider
6. Add your support email
7. Click **Save**

### 2. Configure Authorized Domains

1. In the same **Sign-in method** tab
2. Scroll down to **Authorized domains**
3. Add your domains:
   - `localhost` (for development)
   - Your production domain (e.g., `yourdomain.com`)

### 3. Web App Configuration

1. Go to **Project Settings** > **General**
2. In the "Your apps" section, find your web app
3. Copy the Firebase config object
4. Update your `.env.local` file with the values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## How Google Authentication Works

### First-Time Users
1. User clicks "Continue with Google"
2. Google authentication popup appears
3. User selects their Google account
4. System automatically creates user profile in Firestore with:
   - Name from Google profile
   - Email from Google account
   - Profile photo (if available)
   - Default role: "coordinator"
   - Auth provider: "google"

### Existing Users
1. User signs in with Google
2. System updates their profile with latest info from Google
3. Updates last login timestamp

### Admin Features
- Admins can pre-configure user roles and departments
- When a user first signs in, their pre-configured settings are applied
- User management still available for role changes

## Benefits of Google Authentication

✅ **Enhanced Security**: No password management, leverages Google's security
✅ **User Convenience**: One-click sign-in with existing Google accounts  
✅ **Profile Sync**: Automatic name and photo updates from Google
✅ **Reduced Support**: No password resets or account recovery needed
✅ **Better UX**: Familiar Google sign-in flow

## Migration Notes

- All existing email/password accounts will need to sign in with Google
- User roles and data are preserved in Firestore
- The system automatically creates profiles for new Google users

## Testing

1. Start your development server: `npm run dev`
2. Go to the login page
3. Click "Continue with Google"
4. Select a Google account
5. Verify user profile is created in Firestore
6. Test admin functions for role management

## Troubleshooting

### Common Issues

**Popup Blocked**: Users need to allow popups in their browser
**Domain Not Authorized**: Add your domain to Firebase authorized domains
**Profile Not Created**: Check Firestore rules allow user creation
**Wrong Role**: Admin can update user roles in User Management

### Error Messages

- `Sign-in was cancelled`: User closed the popup
- `Pop-up was blocked`: Browser blocked the popup  
- `Network error`: Check internet connection
- `Only administrators can create user profiles`: Non-admin trying admin function
