// lib/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Validate that all required environment variables are present
// const requiredEnvVars = [
//   'NEXT_PUBLIC_FIREBASE_API_KEY',
//   'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
//   'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
//   'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
//   'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
//   'NEXT_PUBLIC_FIREBASE_APP_ID'
// ];

// const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

// if (missingVars.length > 0) {
//   console.error('Missing Firebase environment variables:', missingVars);
//   console.error('Current environment variables:', {
//     NODE_ENV: process.env.NODE_ENV,
//     hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//     hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//     hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   });
  
//   // In development, provide a more helpful error message
//   if (process.env.NODE_ENV === 'development') {
//     console.warn(
//       '🔥 Firebase configuration is missing. Please ensure .env.local exists with all required variables.\n' +
//       'The app will continue to load but Firebase features will not work.'
//     );
//   } else {
//     throw new Error(
//       `Missing required Firebase environment variables: ${missingVars.join(', ')}\n` +
//       'Please copy .env.example to .env.local and add your Firebase configuration values.'
//     );
//   }
// }

// Initialize Firebase (avoid duplicate initialization)
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
