import React, { useState } from "react";
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
  const [authMode, setAuthMode] = useState("google"); // "google" or "email"
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const { loginWithGoogle, loginWithEmailPassword } = useAuth();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Google sign-in error:', error);
      if (error.message.includes('not pre-approved')) {
        setError("Your email is not pre-approved for access. Please contact the administrator to get your email added to the system.");
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

    try {
      await loginWithEmailPassword(formData.email, formData.password);
    } catch (error) {
      console.error('Email/password sign-in error:', error);
      setError(error.message || "Failed to sign in. Please check your credentials.");
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src="/graduation-hat.svg"
              alt="Placerly Logo"
              className="h-8 w-8 object-contain"
            />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Placerly
            </h1>
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm mb-4">
              {error}
            </div>
          )}
          
          {/* Auth Method Toggle */}
          <div className="flex space-x-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 mb-6">
            <button
              onClick={() => setAuthMode("google")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === "google"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Google Sign-In
            </button>
            <button
              onClick={() => setAuthMode("email")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                authMode === "email"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Email & Password
            </button>
          </div>

          {/* Google Sign-In */}
          {authMode === "google" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Only pre-approved email addresses can sign in. 
                  If this is your first time, you'll be asked to set up a password after signing in with Google.
                </p>
              </div>
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
            </div>
          )}

          {/* Email & Password Sign-In */}
          {authMode === "email" && (
            <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Note:</strong> You must have signed in with Google at least once and set up a password to use this option.
                </p>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Enter your password"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Need access? Contact your administrator to get your email pre-approved.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}