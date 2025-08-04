// components/PasswordSetupModal.jsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const PasswordSetupModal = ({ Button, isOpen, onComplete, userEmail, showReset = false }) => {
  const { setupPasswordAuth, resetPasswordAuth } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    setError('');
    
    try {
      await resetPasswordAuth();
      setError('');
      // Reset form
      setPassword('');
      setConfirmPassword('');
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Password reset error:', error);
      setError(error.message);
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await setupPasswordAuth(password);
      // Reset form
      setPassword('');
      setConfirmPassword('');
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Password setup error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {showReset ? 'Reset Password Authentication' : 'Set Up Password Authentication'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {showReset 
                ? 'Your password authentication needs to be reset. Please create a new password for your account.'
                : 'Welcome! Since this is your first time logging in, please create a password for your account. This will allow you to login with either Google or email/password in the future.'
              }
            </p>
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Email: <strong>{userEmail}</strong>
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                placeholder="Confirm your password"
              />
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>Password requirements:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>At least 6 characters long</li>
                <li>Use a strong, unique password</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              {showReset && (
                <Button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {resetting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Resetting...
                    </div>
                  ) : (
                    'Reset & Start Over'
                  )}
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Setting up...
                  </div>
                ) : (
                  showReset ? 'Set New Password' : 'Set Up Password'
                )}
              </Button>
            </div>
          </form>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> After setting up your password, you can sign in using either:
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-1">
              <li>• Google Sign-In (same as today)</li>
              <li>• Email and Password combination</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordSetupModal;
