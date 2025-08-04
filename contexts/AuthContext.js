// contexts/AuthContext.js
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { activityLogsService, ACTIVITY_LOG_TYPES } from '../lib/activityLogsService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account' // Always show account selection dialog
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for redirect result first
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('User logged in with Google via redirect:', result.user.email);
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
      }
    };

    checkRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      
      if (user) {
        try {
          // User is signed in, fetch their profile
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profileData = { id: user.uid, ...userDoc.data() };
            setUserProfile(profileData);
            setUser(user);
            setIsAuthenticated(true);
          } else {
            // User exists in Auth but not in Firestore
            // Check if this user is pre-approved before creating profile
            console.log('Checking pre-approval for new user:', user.email);
            
            // Check if this user is pre-approved
            const preApprovedData = await checkPreApprovedEmail(user.email);
            
            // Check if this is the admin email
            const isAdminEmail = user.email === 'cbitplacementtraker@gmail.com';
            
            if (!isAdminEmail && !preApprovedData) {
              // User is not pre-approved, sign them out
              console.log('User not pre-approved:', user.email);
              await signOut(auth);
              setUser(null);
              setUserProfile(null);
              setIsAuthenticated(false);
              throw new Error('Your email is not pre-approved for access. Please contact the administrator.');
            }
            
            // Create profile for pre-approved user
            const userData = {
              name: preApprovedData?.name || user.displayName || 'Unknown User',
              email: user.email,
              photoURL: user.photoURL || null,
              role: isAdminEmail ? 'admin' : (preApprovedData?.role || 'placement_coordinator'),
              department: preApprovedData?.department || '',
              isActive: true,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              authProvider: 'google',
              hasPasswordAuth: false, // Track if user has set up password authentication
              isPreApproved: true,
              isFirstLogin: true // Flag to trigger password setup
            };
            
            await setDoc(doc(db, 'users', user.uid), userData);
            
            // Fetch the newly created profile
            const newUserDoc = await getDoc(doc(db, 'users', user.uid));
            const profileData = { id: user.uid, ...newUserDoc.data() };
            setUserProfile(profileData);
            setUser(user);
            setIsAuthenticated(true);
            
            console.log('Profile created for pre-approved user:', user.email);
          }
        } catch (error) {
          console.error('Error fetching/creating user profile:', error);
          // If there's an error, sign out the user
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsAuthenticated(false);
        }
      } else {
        // User is signed out
        setUser(null);
        setUserProfile(null);
        setIsAuthenticated(false);
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Use redirect instead of popup to avoid Cross-Origin-Opener-Policy issues
      await signInWithRedirect(auth, googleProvider);
      // The redirect will handle the authentication
      // onAuthStateChanged will be called when the user returns
    } catch (error) {
      setLoading(false);
      
      // Handle specific Google Auth errors
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection and try again.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Google Sign-In is not enabled. Please contact the administrator.');
      }
      
      throw error;
    }
  };  const loginWithEmailPassword = async (email, password) => {
    try {
      setLoading(true);
      
      // Check if user exists and has password authentication enabled
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(usersQuery);
      
      if (querySnapshot.empty) {
        throw new Error('No account found with this email address.');
      }
      
      const userDocData = querySnapshot.docs[0].data();
      console.log('User document data:', userDocData);
      
      if (!userDocData.hasPasswordAuth) {
        throw new Error('This email is not set up for password authentication. Please sign in with Google and set up a password first.');
      }
      
      let result;
      try {
        console.log('Attempting to sign in with email/password for:', email);
        result = await signInWithEmailAndPassword(auth, email, password);
        console.log('Sign in successful. User providers:', result.user.providerData.map(p => p.providerId));
      } catch (authError) {
        console.error('Authentication error:', authError);
        if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
          // The user exists in Firestore but not in Firebase Auth with email/password
          throw new Error('Your password authentication is not properly set up. Please sign in with Google and reset your password in settings.');
        } else if (authError.code === 'auth/wrong-password') {
          throw new Error('Incorrect password. Please try again.');
        } else if (authError.code === 'auth/too-many-requests') {
          throw new Error('Too many failed attempts. Please try again later.');
        }
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      
      // Update last login timestamp
      await updateDoc(doc(db, 'users', result.user.uid), {
        lastLogin: serverTimestamp()
      });
      
      // Log the login activity - re-enabled
      await activityLogsService.logActivity(
        result.user.uid,
        userDocData.name,
        userDocData.email,
        ACTIVITY_LOG_TYPES.LOGIN,
        `User logged in successfully via email/password`,
        { 
          loginMethod: 'email-password',
          userRole: userDocData.role 
        }
      );
      
      return result;
    } catch (error) {
      setLoading(false);
      
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      }
      
      throw error;
    }
  };

  const setupPasswordAuth = async (password) => {
    try {
      if (!user || !userProfile) {
        throw new Error('No user logged in.');
      }
      
      // Check if user is pre-approved for password setup
      if (!userProfile.isPreApproved) {
        throw new Error('Your email is not pre-approved for password authentication.');
      }
      
      if (userProfile.hasPasswordAuth) {
        throw new Error('Password authentication is already set up for this account.');
      }
      
      console.log('Setting up password for user:', user.email);
      console.log('Current providers:', user.providerData.map(p => p.providerId));
      
      // Link email/password credential to the existing Google account
      const credential = EmailAuthProvider.credential(user.email, password);
      
      try {
        // Link the email/password credential to the current user
        const linkResult = await linkWithCredential(user, credential);
        console.log('Email/password credential linked successfully');
        console.log('New providers:', linkResult.user.providerData.map(p => p.providerId));
      } catch (linkError) {
        console.error('Error linking credential:', linkError);
        if (linkError.code === 'auth/credential-already-in-use') {
          // This means there's already an email/password account with this email
          throw new Error('An account with this email already exists. Please use the existing password or contact administrator.');
        } else if (linkError.code === 'auth/email-already-in-use') {
          throw new Error('This email is already in use by another account.');
        } else if (linkError.code === 'auth/weak-password') {
          throw new Error('Password is too weak. Please choose a stronger password.');
        } else {
          throw new Error(`Failed to set up password: ${linkError.message}`);
        }
      }
      
      // Update user profile to indicate password auth is now available
      await updateDoc(doc(db, 'users', user.uid), {
        hasPasswordAuth: true,
        passwordSetupDate: serverTimestamp(),
        isFirstLogin: false
      });
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        hasPasswordAuth: true,
        isFirstLogin: false
      }));
      
      // Log the activity
      await activityLogsService.logActivity(
        user.uid,
        userProfile.name,
        userProfile.email,
        ACTIVITY_LOG_TYPES.USER_UPDATED,
        `User set up password authentication`,
        { userRole: userProfile.role }
      );
      
      return { success: true, message: 'Password authentication set up successfully! You can now login with email and password.' };
    } catch (error) {
      console.error('Error setting up password auth:', error);
      throw error;
    }
  };

  const checkUserProviders = () => {
    if (!user) {
      console.log('No user logged in');
      return [];
    }
    
    const providers = user.providerData.map(provider => ({
      providerId: provider.providerId,
      email: provider.email,
      displayName: provider.displayName
    }));
    
    console.log('Current user providers:', providers);
    return providers;
  };

  const resetPasswordAuth = async () => {
    try {
      if (!user || !userProfile) {
        throw new Error('No user logged in.');
      }
      
      // Reset the password auth status in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        hasPasswordAuth: false,
        passwordSetupDate: null,
        isFirstLogin: true
      });
      
      // Update local state
      setUserProfile(prev => ({
        ...prev,
        hasPasswordAuth: false,
        isFirstLogin: true
      }));
      
      return { success: true, message: 'Password authentication reset. You can set up a new password.' };
    } catch (error) {
      console.error('Error resetting password auth:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      
      // Log the logout activity before signing out
      if (user && userProfile) {
        await activityLogsService.logActivity(
          user.uid,
          userProfile.name,
          userProfile.email,
          ACTIVITY_LOG_TYPES.LOGOUT,
          `User logged out successfully`,
          { 
            userRole: userProfile.role 
          }
        );
      }
      
      await signOut(auth);
      // Clear all state
      setUser(null);
      setUserProfile(null);
      setIsAuthenticated(false);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Admin function to pre-approve emails for password authentication
  const addPreApprovedEmail = async (email, userData = {}) => {
    try {
      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Only administrators can pre-approve emails.');
      }
      
      // Check if email is already pre-approved
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(usersQuery);
      
      if (!querySnapshot.empty) {
        // Update existing user to be pre-approved
        const existingUserDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'users', existingUserDoc.id), {
          isPreApproved: true,
          ...userData
        });
        return { success: true, message: 'User updated and pre-approved successfully.' };
      } else {
        // Create pre-approved user entry
        const preApprovedUserData = {
          name: userData.name || 'Pre-approved User',
          email: email,
          role: userData.role || 'placement_coordinator',
          department: userData.department || '',
          isActive: true,
          isPreApproved: true,
          hasPasswordAuth: false,
          createdAt: serverTimestamp(),
          createdBy: userProfile.email,
          authProvider: 'pending' // Will be updated when user first signs in
        };
        
        // Use email as document ID for pre-approved users
        const docId = email.replace(/[.#$[\]]/g, '_');
        await setDoc(doc(db, 'preApprovedUsers', docId), preApprovedUserData);
        
        return { success: true, message: 'Email pre-approved successfully.' };
      }
    } catch (error) {
      throw error;
    }
  };

  // Function to check if email is pre-approved and get user data
  const checkPreApprovedEmail = async (email) => {
    try {
      // Check in users collection first
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const userSnapshot = await getDocs(usersQuery);
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        return userData.isPreApproved ? userData : null;
      }
      
      // Check in preApprovedUsers collection
      const docId = email.replace(/[.#$[\]]/g, '_');
      const preApprovedDoc = await getDoc(doc(db, 'preApprovedUsers', docId));
      
      if (preApprovedDoc.exists()) {
        return preApprovedDoc.data();
      }
      
      return null;
    } catch (error) {
      console.error('Error checking pre-approved email:', error);
      return null;
    }
  };

  const value = {
    user,
    userProfile,
    isAuthenticated,
    loginWithGoogle,
    loginWithEmailPassword,
    setupPasswordAuth,
    checkUserProviders,
    resetPasswordAuth,
    logout,
    addPreApprovedEmail,
    checkPreApprovedEmail,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
