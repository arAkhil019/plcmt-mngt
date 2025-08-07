// contexts/AuthContext.js
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  linkWithCredential,
  EmailAuthProvider,
  deleteUser,
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
  const [authError, setAuthError] = useState(null); // Add auth error state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setAuthError(null); // Clear previous errors
      
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
            // Check if this user is pre-approved before creating profile
            
            // Check if this user is pre-approved
            const preApprovedData = await checkPreApprovedEmail(user.email);
            
            // Check if this is the admin email
            const isAdminEmail = user.email === 'cbitplacementtraker@gmail.com';
            
            if (!isAdminEmail && !preApprovedData) {
              // Log unauthorized access attempt
              try {
                await activityLogsService.logActivity(
                  user.uid || 'unknown',
                  user.displayName || user.email?.split('@')[0] || 'Unknown',
                  user.email || 'unknown@email.com',
                  ACTIVITY_LOG_TYPES.PERMISSION_DENIED,
                  `Unauthorized access attempt by non-pre-approved user: ${user.email}`,
                  {
                    attemptedAccess: true,
                    userEmail: user.email,
                    authProvider: 'google',
                    actionTaken: 'user_deleted_and_signed_out',
                    timestamp: new Date().toISOString()
                  }
                );
              } catch (loggingError) {
                console.error('Error logging unauthorized access:', loggingError);
              }
              
              // User is not pre-approved, delete the Firebase Auth user and sign them out
              try {
                // Delete the user from Firebase Auth completely
                await deleteUser(user);
              } catch (deleteError) {
                console.error('Error deleting unauthorized user:', deleteError);
                // If deletion fails, at least sign them out
                await signOut(auth);
              }
              
              setUser(null);
              setUserProfile(null);
              setIsAuthenticated(false);
              setAuthError('Your email is not pre-approved for access. Please contact the administrator.');
              setLoading(false);
              return; // Exit early to prevent further processing
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
            
            // Profile creation completed
          }
        } catch (error) {
          console.error('Error fetching/creating user profile:', error);
          // If there's an error, sign out the user and set error state
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsAuthenticated(false);
          setAuthError(error.message || 'Authentication failed. Please try again.');
        }
      } else {
        // User is signed out
        setUser(null);
        setUserProfile(null);
        setIsAuthenticated(false);
        setAuthError(null); // Clear any previous errors on sign out
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setAuthError(null); // Clear any previous errors
      
      const loginStartTime = Date.now();
      
      // Use popup instead of redirect for better user experience
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Log successful Google login with detailed metadata
      if (user) {
        const loginData = {
          loginMethod: 'google',
          loginAttempts: 1,
          successOnAttempt: 1,
          previousLoginTime: userProfile?.lastLogin || null,
          redirectUrl: window.location.pathname,
          preApprovalStatus: 'approved', // Will be validated in auth state listener
          loginDuration: Date.now() - loginStartTime
        };
        
        await activityLogsService.logDetailedLogin(
          user.uid,
          user.displayName || user.email.split('@')[0],
          user.email,
          loginData
        );
      }
      
      // The onAuthStateChanged will handle the rest including pre-approval check
      // No need to check pre-approval here as it's handled in the auth state listener
      
    } catch (error) {
      setLoading(false);
      
      // Log failed login attempt if we have user context
      if (auth.currentUser || error.user) {
        const errorUser = auth.currentUser || error.user;
        await activityLogsService.logActivity(
          errorUser?.uid || 'unknown',
          errorUser?.displayName || errorUser?.email?.split('@')[0] || 'Unknown',
          errorUser?.email || 'unknown@email.com',
          ACTIVITY_LOG_TYPES.LOGIN_FAILED,
          `Google sign-in failed: ${error.message}`,
          { 
            loginMethod: 'google',
            errorCode: error.code,
            errorMessage: error.message,
            timestamp: new Date().toISOString()
          }
        );
      }
      
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
      
      throw new Error(`Google sign-in failed: ${error.message}`);
    }
  };

  // Function to clear auth errors
  const clearAuthError = () => {
    setAuthError(null);
  };

  const loginWithEmailPassword = async (email, password) => {
    try {
      setLoading(true);
      
      // First, try to authenticate with Firebase Auth
      let result;
      try {
        result = await signInWithEmailAndPassword(auth, email, password);
      } catch (authError) {
        console.error('Firebase Auth error:', authError);
        if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/user-not-found') {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (authError.code === 'auth/wrong-password') {
          throw new Error('Incorrect password. Please try again.');
        } else if (authError.code === 'auth/too-many-requests') {
          throw new Error('Too many failed attempts. Please try again later.');
        } else if (authError.code === 'auth/user-disabled') {
          throw new Error('This account has been disabled. Please contact the administrator.');
        }
        throw new Error(`Authentication failed: ${authError.message}`);
      }
      
      // Check if user exists in Firestore, if not create profile
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Check if this user is pre-approved
        const preApprovedData = await checkPreApprovedEmail(email);
        const isAdminEmail = email === 'cbitplacementtraker@gmail.com';
        
        if (!isAdminEmail && !preApprovedData) {
          // User is not pre-approved, sign them out
          await signOut(auth);
          throw new Error('Your email is not pre-approved for access. Please contact the administrator.');
        }
        
        // Create profile for pre-approved user
        const userData = {
          name: preApprovedData?.name || result.user.displayName || result.user.email.split('@')[0],
          email: result.user.email,
          photoURL: result.user.photoURL || null,
          role: isAdminEmail ? 'admin' : (preApprovedData?.role || 'placement_coordinator'),
          department: preApprovedData?.department || '',
          isActive: true,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          authProvider: 'email-password',
          hasPasswordAuth: true, // User logged in with email/password so they have it
          isPreApproved: true,
          isFirstLogin: false // Since they're logging in with email/password, they've set it up
        };
        
        await setDoc(userDocRef, userData);
        
        // Log the account creation with detailed metadata
        const loginData = {
          loginMethod: 'email-password',
          loginAttempts: 1,
          successOnAttempt: 1,
          isNewProfile: true,
          userRole: userData.role,
          preApprovalStatus: 'approved',
          accountType: 'first_time_setup'
        };
        
        await activityLogsService.logDetailedLogin(
          result.user.uid,
          userData.name,
          userData.email,
          loginData
        );
      } else {
        // User exists in Firestore, update last login and hasPasswordAuth flag
        const userData = userDoc.data();
        await updateDoc(userDocRef, {
          lastLogin: serverTimestamp(),
          hasPasswordAuth: true, // Ensure this is set since they successfully logged in with password
          authProvider: 'email-password' // Update auth provider if it was previously google-only
        });
        
        // Log the login activity with detailed metadata
        const loginData = {
          loginMethod: 'email-password',
          loginAttempts: 1, // Would need to track actual attempts in a real scenario
          successOnAttempt: 1,
          previousLoginTime: userData.lastLogin?.toDate?.()?.toISOString() || null,
          userRole: userData.role,
          preApprovalStatus: 'approved',
          accountType: 'existing_user'
        };
        
        await activityLogsService.logDetailedLogin(
          result.user.uid,
          userData.name,
          userData.email,
          loginData
        );
      }
      
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
      
      // Link email/password credential to the existing Google account
      const credential = EmailAuthProvider.credential(user.email, password);
      
      try {
        // Link the email/password credential to the current user
        const linkResult = await linkWithCredential(user, credential);
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
      return [];
    }
    
    const providers = user.providerData.map(provider => ({
      providerId: provider.providerId,
      email: provider.email,
      displayName: provider.displayName
    }));
    
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
      
      // Calculate session duration and gather logout data
      const logoutTime = new Date();
      const loginTime = userProfile?.lastLogin?.toDate?.() || null;
      const sessionDuration = loginTime ? logoutTime.getTime() - loginTime.getTime() : null;
      
      // Log the logout activity with detailed metadata before signing out
      if (user && userProfile) {
        const logoutData = {
          logoutReason: 'manual',
          sessionDuration: sessionDuration,
          loginTime: loginTime?.toISOString() || null,
          logoutTime: logoutTime.toISOString(),
          activitiesPerformed: [], // Could be enhanced to track user actions during session
          pagesVisited: [window.location.pathname], // Could be enhanced to track navigation
          dataModified: false, // Could be enhanced to track if user made changes
          unsavedChanges: false,
          logoutMethod: 'button',
          userRole: userProfile.role
        };
        
        await activityLogsService.logDetailedLogout(
          user.uid,
          userProfile.name,
          userProfile.email,
          logoutData
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

  // Function to create account directly with email/password (for pre-approved users)
  const createAccountWithEmailPassword = async (email, password, userData = {}) => {
    try {
      setLoading(true);
      
      // Check if this email is pre-approved or is admin email
      const isAdminEmail = email === 'cbitplacementtraker@gmail.com';
      const preApprovedData = await checkPreApprovedEmail(email);
      
      if (!isAdminEmail && !preApprovedData) {
        throw new Error('Your email is not pre-approved for account creation. Please contact the administrator.');
      }
      
      // Create Firebase Auth account
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in Firestore
      const userProfileData = {
        name: userData.name || preApprovedData?.name || result.user.email.split('@')[0],
        email: result.user.email,
        photoURL: userData.photoURL || null,
        role: isAdminEmail ? 'admin' : (userData.role || preApprovedData?.role || 'placement_coordinator'),
        department: userData.department || preApprovedData?.department || '',
        isActive: true,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        authProvider: 'email-password',
        hasPasswordAuth: true,
        isPreApproved: true,
        isFirstLogin: false
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userProfileData);
      
      // Log the account creation
      await activityLogsService.logActivity(
        result.user.uid,
        userProfileData.name,
        userProfileData.email,
        ACTIVITY_LOG_TYPES.LOGIN,
        `New account created via email/password`,
        { 
          loginMethod: 'email-password',
          userRole: userProfileData.role,
          isNewAccount: true
        }
      );
      
      return result;
    } catch (error) {
      setLoading(false);
      
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please try signing in instead.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please choose a stronger password (at least 6 characters).');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      }
      
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    isAuthenticated,
    authError,
    clearAuthError,
    loginWithGoogle,
    loginWithEmailPassword,
    createAccountWithEmailPassword,
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
