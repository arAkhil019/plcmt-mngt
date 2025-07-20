// app/api/createAdmin/route.js
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let adminInitialized = false;

function initializeAdmin() {
  if (adminInitialized || admin.apps.length > 0) {
    return;
  }

  try {
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Parse the service account from environment variable
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      // Fallback to JSON file for local development
      try {
        serviceAccount = require('../../../serviceAccountKey.json');
      } catch (error) {
        throw new Error('No service account found. Please set FIREBASE_SERVICE_ACCOUNT_JSON environment variable or add serviceAccountKey.json file.');
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    adminInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

export async function POST(req) {
  try {
    // Initialize Firebase Admin
    initializeAdmin();
    
    const body = await req.json();
    const { email, password, name } = body;
    
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log('Creating admin user:', { email, name }); // Debug log
    
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });
    
    console.log('User created in Auth:', userRecord.uid); // Debug log
    
    // Set custom claim for admin
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });
    
    console.log('Custom claims set'); // Debug log
    
    // Add user profile to Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name,
      role: 'admin',
      createdAt: new Date().toISOString(),
      isActive: true,
    });
    
    console.log('User profile added to Firestore'); // Debug log
    
    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create admin user',
      details: error.code || 'Unknown error'
    }, { status: 500 });
  }
}
