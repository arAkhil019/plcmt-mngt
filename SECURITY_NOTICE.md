# Security Notice

## ⚠️ Service Account Key Removed

This commit history previously contained Firebase service account keys in:
- `.env.local` file
- `serviceAccountKey.json` files  
- Various Firebase admin SDK key files

## Actions Taken

1. **Reverted commit** `4f3d393` which contained sensitive credentials
2. **Updated `.gitignore`** to prevent future commits of:
   - `serviceAccountKey.json`
   - `*firebase-adminsdk*.json` 
   - `firebase-service-account.json`
3. **Cleaned `.env.local`** to remove service account credentials
4. **Pushed changes** to remove sensitive data from repository

## Security Recommendations

### For Development
1. Download a new service account key from Firebase Console
2. Place it as `serviceAccountKey.json` in project root (will be ignored by git)
3. Or set `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable

### For Production
1. Use environment variables for service account credentials
2. Never commit service account keys to version control
3. Rotate service account keys regularly
4. Use GitHub secrets for CI/CD deployments

## Firebase Console Steps

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`placement-tracker-cbit`)
3. Go to Project Settings > Service Accounts  
4. Click "Generate new private key"
5. Download the JSON file
6. **DO NOT commit this file to git**

## Git History Note

The service account credentials that were previously committed have been removed from the main branch. However, they may still exist in git history. Consider:

1. Rotating the service account keys in Firebase Console
2. Creating new service account keys
3. Disabling the old service account if needed

## Prevention

The updated `.gitignore` file now includes patterns to prevent accidental commits of:
```
# Firebase service account keys (NEVER commit these!)
serviceAccountKey.json
*firebase-adminsdk*.json
firebase-service-account.json
```

Always verify that sensitive files are properly ignored before committing.
