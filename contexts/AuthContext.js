// contexts/AuthContext.js
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { createAdminUser, createRegularUser } from '../lib/adminApi';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
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
            // User exists in Auth but not in Firestore - sign them out
            console.warn('User profile not found in Firestore, signing out...');
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // If there's an error fetching profile, sign out the user
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

  const login = async (email, password) => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('User logged in:', result.user.email);
      // Fetch user profile to ensure it exists
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        // User exists in Auth but not in Firestore
        await signOut(auth);
        throw new Error('User profile not found. Please contact administrator.');
      }
      
      // Update last login timestamp
      await updateDoc(doc(db, 'users', result.user.uid), {
        lastLogin: serverTimestamp()
      });
      
      return result;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
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

  const createUser = async (email, password, userData) => {
    try {
      // Use the secure API route for user creation
      const result = await createRegularUser({ 
        email, 
        password, 
        userData: {
          ...userData,
          createdBy: userProfile?.id || null
        }
      });
      return result;
    } catch (error) {
      throw error;
    }
  };

  // Create admin user using secure API route
  const createAdmin = async (email, password, name) => {
    try {
      const result = await createAdminUser({ email, password, name });
      // Optionally, fetch the new admin profile from Firestore here if needed
      return result;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    isAuthenticated,
    login,
    logout,
    createUser,
    createAdmin,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
