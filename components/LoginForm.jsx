import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginForm({
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [authMode, setAuthMode] = useState("google"); // "google", "email", or "create"
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const { loginWithGoogle, loginWithEmailPassword, authError, clearAuthError } = useAuth();

  // Watch for auth errors from the context and display them
  useEffect(() => {
    if (authError) {
      if (authError.includes('not pre-approved')) {
        setError("Access Denied: Your email address is not pre-approved for this system. Please contact your administrator to request access.");
      } else {
        setError(authError);
      }
    }
  }, [authError]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    clearAuthError(); // Clear any auth context errors

    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('LoginForm: Google sign-in error:', error);
      if (error.message && error.message.includes('popup-closed-by-user')) {
        setError("Sign-in was cancelled. Please try again.");
      } else if (error.message && error.message.includes('popup-blocked')) {
        setError("Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.");
      } else {
        setError(error.message || "Failed to sign in with Google. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await loginWithEmailPassword(formData.email, formData.password);
    } catch (error) {
      console.error('Email/password sign-in error:', error);
      if (error.message && error.message.includes('not pre-approved')) {
        setError("Access Denied: Your email address is not pre-approved for this system. Please contact your administrator to request access.");
      } else if (error.message && error.message.includes('Invalid email or password')) {
        setError("Invalid credentials. Please check your email and password and try again.");
      } else {
        setError(error.message || "Failed to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <img
              src="/graduation-hat.svg"
              alt="Placerly Logo"
              className="h-6 w-6 object-contain"
            />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Placerly
            </h1>
          </div>
          <div>
            <CardTitle className="text-lg">Welcome Back</CardTitle>
            <CardDescription className="text-sm">
              Sign in to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <div className="flex items-start gap-2">
                <div className="font-medium">
                  {error}
                </div>
              </div>
              {error.includes('not pre-approved') && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  <strong>Need access?</strong> Contact your system administrator with your email address to get added to the approved users list.
                </div>
              )}
            </div>
          )}
          
          {success && (
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">
              {success}
            </div>
          )}
          
          {/* Simple Tab Toggle */}
          <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setAuthMode("google")}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                authMode === "google"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Google
            </button>
            <button
              onClick={() => setAuthMode("email")}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                authMode === "email"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Email & Password
            </button>
          </div>

          {/* Google Sign-In */}
          {authMode === "google" && (
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {loading ? "Signing in..." : "Continue with Google"}
            </Button>
          )}

          {/* Email & Password Sign-In */}
          {authMode === "email" && (
            <form onSubmit={handleEmailPasswordSignIn} className="space-y-3">
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                placeholder="Email"
              />
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                placeholder="Password"
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Need access? Contact your administrator.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}