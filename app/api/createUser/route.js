// app/api/createUser/route.js
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
    const { email, password, userData } = body;
    
    if (!email || !password || !userData || !userData.name || !userData.role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log('Creating user:', { email, name: userData.name, role: userData.role }); // Debug log
    
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: userData.name,
    });
    
    console.log('User created in Auth:', userRecord.uid); // Debug log
    
    // Set custom claim for role
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: userData.role });
    
    console.log('Custom claims set for role:', userData.role); // Debug log
    
    // Add user profile to Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name: userData.name,
      role: userData.role,
      createdAt: new Date().toISOString(),
      createdBy: userData.createdBy || null,
      isActive: true,
      ...userData
    });
    
    console.log('User profile added to Firestore'); // Debug log
    
    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create user',
      details: error.code || 'Unknown error'
    }, { status: 500 });
  }
}
