// components/AdmissionScanner.jsx
import React, { useState, useEffect, useRef } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService.js";
import {
  QrCodeIcon,
  UsersIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
} from "./icons";

export default function AdmissionScanner({
  activity,
  userProfile,
  onClose,
  isScriptLoaded,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
}) {
  // Validate required props
  useEffect(() => {
    console.log("AdmissionScanner props:", { activity, userProfile, isScriptLoaded });
    
    if (!activity || !activity.id) {
      console.error("Invalid activity prop:", activity);
    }
    
    if (!userProfile) {
      console.error("userProfile is not provided");
    } else {
      console.log("userProfile:", {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email
      });
    }
  }, [activity, userProfile]);

  const [scannedAdmissions, setScannedAdmissions] = useState([]);
  const [existingAdmissions, setExistingAdmissions] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [scanFeedback, setScanFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastScannedTime, setLastScannedTime] = useState(0);
  const [recentlyScanned, setRecentlyScanned] = useState(new Set());

  const scannerRef = useRef(null);
  const html5QrCode = useRef(null);
  const localStorageKey = `admissionScanner_${activity.id}`;
  
  // Debounce time in milliseconds to prevent rapid duplicate scans
  const SCAN_DEBOUNCE_TIME = 2000;

  // Load existing scanned admissions from activity and localStorage on component mount
  useEffect(() => {
    const loadExistingAdmissions = async () => {
      try {
        // Load existing admissions from the activity
        const currentActivity = await unifiedActivitiesService.getActivityById(activity.id);
        const existing = currentActivity.scannedAdmissions || [];
        
        // Validate and normalize existing admission numbers to uppercase for consistency
        const normalizedExisting = existing
          .filter(item => {
            return item && 
                   typeof item === 'object' && 
                   item.admissionNumber && 
                   typeof item.admissionNumber === 'string';
          })
          .map(item => ({
            ...item,
            admissionNumber: item.admissionNumber.toUpperCase(),
            scannedAt: item.scannedAt || new Date().toISOString(),
            scannedBy: item.scannedBy || 'unknown',
            scannedByName: item.scannedByName || 'Unknown User'
          }));
        
        setExistingAdmissions(normalizedExisting);
      } catch (error) {
        console.error("Error loading existing admissions:", error);
        setExistingAdmissions([]);
      }
    };

    const savedAdmissions = localStorage.getItem(localStorageKey);
    if (savedAdmissions) {
      try {
        const parsed = JSON.parse(savedAdmissions);
        
        // Validate and normalize localStorage admission numbers to uppercase for consistency
        const normalizedParsed = (Array.isArray(parsed) ? parsed : [])
          .filter(item => {
            return item && 
                   typeof item === 'object' && 
                   item.admissionNumber && 
                   typeof item.admissionNumber === 'string';
          })
          .map(item => ({
            ...item,
            admissionNumber: item.admissionNumber.toUpperCase(),
            scannedAt: item.scannedAt || new Date().toISOString(),
            scannedBy: item.scannedBy || 'unknown',
            scannedByName: item.scannedByName || 'Unknown User'
          }));
        
        setScannedAdmissions(normalizedParsed);
      } catch (error) {
        console.error("Error parsing saved admissions:", error);
        localStorage.removeItem(localStorageKey);
      }
    }

    loadExistingAdmissions();
  }, [activity.id, localStorageKey]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCode.current) {
        html5QrCode.current.stop().catch(console.error);
      }
    };
  }, []);

  // Save scanned admissions to localStorage whenever it changes
  useEffect(() => {
    if (scannedAdmissions.length > 0) {
      localStorage.setItem(localStorageKey, JSON.stringify(scannedAdmissions));
    } else {
      localStorage.removeItem(localStorageKey);
    }
  }, [scannedAdmissions, localStorageKey]);

  const startScanner = async () => {
    if (!isScriptLoaded || !window.Html5Qrcode) {
      setScannerError(
        "QR Code scanner library not loaded. Please refresh the page."
      );
      return;
    }

    try {
      setIsScanning(true);
      setScannerError("");
      setScanFeedback(""); // Clear any previous feedback

      // Clean up any existing scanner instance
      if (html5QrCode.current) {
        try {
          await html5QrCode.current.stop();
        } catch (e) {
          // Scanner may already be stopped
        }
      }

      // Small delay to ensure cleanup is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      html5QrCode.current = new window.Html5Qrcode("admission-qr-reader");

      const qrCodeSuccessCallback = (decodedText) => {
        handleScanSuccess(decodedText);
      };

      const qrCodeErrorCallback = (error) => {
        // Silent scanning - frequent errors are expected during scanning
      };

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: "environment",
        },
      };

      await html5QrCode.current.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );
    } catch (error) {
      setScannerError(
        `Failed to start camera: ${error.message}. Please check camera permissions and ensure no other scanner is active.`
      );
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCode.current) {
        await html5QrCode.current.stop();
        html5QrCode.current = null;
      }
      setIsScanning(false);
      setScanFeedback(""); // Clear feedback when stopping scanner
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }
  };

  const handleScanSuccess = async (decodedText) => {
    try {
      // Clean and normalize the admission number
      const admissionNumber = decodedText.trim().toUpperCase();
      
      if (!admissionNumber) {
        return;
      }

      // Debouncing mechanism to prevent rapid scanning of the same code
      const currentTime = Date.now();
      if (currentTime - lastScannedTime < SCAN_DEBOUNCE_TIME && recentlyScanned.has(admissionNumber)) {
        return;
      }

      // Get current state to ensure we have the latest data
      const currentScanned = scannedAdmissions.map(item => item.admissionNumber.toUpperCase());
      const currentExisting = existingAdmissions.map(item => item.admissionNumber.toUpperCase());

      // Check if already scanned locally (case-insensitive)
      const alreadyScannedLocally = currentScanned.includes(admissionNumber);

      // Check if already exists in previously saved admissions (case-insensitive)
      const alreadyExistsInActivity = currentExisting.includes(admissionNumber);

      if (alreadyScannedLocally) {
        setScanFeedback(`Already scanned in this session: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      if (alreadyExistsInActivity) {
        setScanFeedback(`Already exists in activity: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      // Update debouncing state
      setLastScannedTime(currentTime);
      setRecentlyScanned(prev => {
        const newSet = new Set(prev);
        newSet.add(admissionNumber);
        // Clear the recently scanned after debounce time
        setTimeout(() => {
          setRecentlyScanned(current => {
            const updated = new Set(current);
            updated.delete(admissionNumber);
            return updated;
          });
        }, SCAN_DEBOUNCE_TIME);
        return newSet;
      });

      // Add to local state with normalized case
      const newScan = {
        admissionNumber: admissionNumber, // Store in uppercase for consistency
        scannedAt: new Date().toISOString(),
        scannedBy: userProfile?.id || "unknown",
        scannedByName: userProfile?.name || "Unknown User",
      };
      
      setScannedAdmissions((prev) => {
        // Double-check for duplicates before adding
        const existingNumbers = prev.map(item => item.admissionNumber.toUpperCase());
        if (existingNumbers.includes(admissionNumber)) {
          return prev;
        }
        return [...prev, newScan];
      });
      
      setScanFeedback(`Successfully scanned: ${admissionNumber}`);
      setTimeout(() => setScanFeedback(""), 2000);
    } catch (error) {
      console.error("Error processing scan:", error);
      setScanFeedback("Error processing scan. Please try again.");
      setTimeout(() => setScanFeedback(""), 3000);
    }
  };

  const handleManualAdd = async () => {
    if (!manualInput.trim()) return;

    try {
      // Clean and normalize the admission number
      const admissionNumber = manualInput.trim().toUpperCase();
      
      // Get current state to ensure we have the latest data
      const currentScanned = scannedAdmissions.map(item => item.admissionNumber.toUpperCase());
      const currentExisting = existingAdmissions.map(item => item.admissionNumber.toUpperCase());

      // Check if already scanned locally (case-insensitive)
      const alreadyScannedLocally = currentScanned.includes(admissionNumber);

      // Check if already exists in previously saved admissions (case-insensitive)
      const alreadyExistsInActivity = currentExisting.includes(admissionNumber);

      if (alreadyScannedLocally) {
        setScanFeedback(`Already scanned in this session: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      if (alreadyExistsInActivity) {
        setScanFeedback(`Already exists in activity: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      // Add to local state with normalized case
      const newScan = {
        admissionNumber: admissionNumber, // Store in uppercase for consistency
        scannedAt: new Date().toISOString(),
        scannedBy: userProfile?.id || "unknown",
        scannedByName: userProfile?.name || "Unknown User",
      };
      
      setScannedAdmissions((prev) => {
        // Double-check for duplicates before adding
        const existingNumbers = prev.map(item => item.admissionNumber.toUpperCase());
        if (existingNumbers.includes(admissionNumber)) {
          return prev;
        }
        return [...prev, newScan];
      });
      
      setManualInput("");
      setScanFeedback(`Successfully added: ${admissionNumber}`);
      setTimeout(() => setScanFeedback(""), 2000);
    } catch (error) {
      console.error("Error adding manual admission:", error);
      setScanFeedback("Failed to add admission number");
      setTimeout(() => setScanFeedback(""), 3000);
    }
  };

  const handleRemoveAdmission = (admissionNumber) => {
    setScannedAdmissions((prev) =>
      prev.filter((item) => item.admissionNumber !== admissionNumber)
    );
  };

  const handleComplete = async () => {
    if (scannedAdmissions.length === 0) {
      setScanFeedback("No admission numbers to save");
      setTimeout(() => setScanFeedback(""), 3000);
      return;
    }

    // Capture userProfile at the beginning to prevent race conditions
    const currentUserProfile = userProfile;
    console.log("Current userProfile at start:", currentUserProfile);

    if (!currentUserProfile || !currentUserProfile.id || !currentUserProfile.name) {
      setScanFeedback("User profile not available. Please try again.");
      setTimeout(() => setScanFeedback(""), 3000);
      return;
    }

    try {
      setIsSaving(true);

      // Get current activity to check for existing scanned admissions
      const currentActivity = await unifiedActivitiesService.getActivityById(activity.id);
      const existingScannedAdmissions = currentActivity.scannedAdmissions || [];
      
      // Validate and clean existing admissions data
      const cleanedExistingAdmissions = existingScannedAdmissions.filter(item => {
        return item && 
               typeof item === 'object' && 
               item.admissionNumber && 
               typeof item.admissionNumber === 'string';
      });

      // Validate and clean new scanned admissions data
      const cleanedScannedAdmissions = scannedAdmissions.filter(item => {
        return item && 
               typeof item === 'object' && 
               item.admissionNumber && 
               typeof item.admissionNumber === 'string';
      });

      // Create a case-insensitive set of existing admission numbers
      const existingAdmissionNumbers = new Set(
        cleanedExistingAdmissions.map((item) => item.admissionNumber.toUpperCase())
      );

      // Filter out duplicates using case-insensitive comparison
      const newAdmissions = cleanedScannedAdmissions.filter((item) => {
        const upperCaseNumber = item.admissionNumber.toUpperCase();
        return !existingAdmissionNumbers.has(upperCaseNumber);
      });

      // Ensure all new admissions have the required structure
      const validatedNewAdmissions = newAdmissions.map(item => ({
        admissionNumber: item.admissionNumber || '',
        scannedAt: item.scannedAt || new Date().toISOString(),
        scannedBy: item.scannedBy || currentUserProfile.id,
        scannedByName: item.scannedByName || currentUserProfile.name,
      }));

      // Combine existing and new admissions
      const allScannedAdmissions = [...cleanedExistingAdmissions, ...validatedNewAdmissions];

      // Double-check userProfile before making the update call
      console.log("UserProfile before update call:", currentUserProfile);
      
      if (!currentUserProfile.id || !currentUserProfile.name) {
        throw new Error("User profile became invalid during processing");
      }

      // Validate updater info before making the call
      const updaterInfo = {
        id: currentUserProfile.id,
        name: currentUserProfile.name,
      };

      // Update activity with scanned admissions
      await unifiedActivitiesService.updateActivity(
        activity.id,
        {
          scannedAdmissions: allScannedAdmissions,
        },
        updaterInfo
      );

      // Clear local storage and update state
      localStorage.removeItem(localStorageKey);
      
      // Update existing admissions state to include newly saved ones
      setExistingAdmissions(allScannedAdmissions);
      
      // Clear the local scanned admissions since they're now saved
      setScannedAdmissions([]);

      // Note: We don't call onScanningComplete here because this component
      // only handles admission number scanning, not student participant management
      // The parent component expects student objects with full details, not just admission numbers

      setScanFeedback(`Successfully saved ${validatedNewAdmissions.length} new admission numbers`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error saving admissions:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        userProfile: userProfile,
        activity: activity
      });
      setScanFeedback(`Failed to save admission numbers: ${error.message}`);
      setTimeout(() => setScanFeedback(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Component is ready to render immediately
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <div
        className={`w-full h-full max-h-[95vh] ${
          isScanning ? "max-w-4xl" : "max-w-6xl"
        } flex flex-col`}
      >
        <Card className="h-full flex flex-col shadow-2xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="flex justify-between items-start p-2 sm:p-2">
              <div className="flex-1 pr-2 sm:pr-4">
                <CardTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                  {isScanning ? (
                    <>
                      <div className="animate-pulse bg-destructive rounded-full w-2 sm:w-3 h-2 sm:h-3"></div>
                      <span className="hidden sm:inline">Scanner Active</span>
                      <span className="sm:hidden">Active</span>
                    </>
                  ) : (
                    <>
                      <QrCodeIcon className="w-5 sm:w-6 h-5 sm:h-6" />
                      <span className="hidden sm:inline">Admission Scanner</span>
                      <span className="sm:hidden">Scanner</span>
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-primary-foreground/80 leading-relaxed text-xs sm:text-sm">
                  <span className="hidden sm:inline">{activity.companyName || activity.name} • </span>
                  {isScanning
                    ? "Scanning in progress"
                    : "Scan or enter admission numbers"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8 sm:h-10 sm:w-10 p-1 sm:p-2 shrink-0"
              >
                ✕
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-6">
            <div className="p-6 space-y-6 min-h-0">
              {/* Camera Feed Section - Prominent when scanning */}
              {isScanning && (
                <div className="border-2 border-primary/20 rounded-lg p-6 bg-muted/30">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="bg-primary p-3 rounded-lg shrink-0">
                        <QrCodeIcon className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold mb-2">
                          Camera Scanner
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Position QR codes within the scanner frame for
                          automatic detection
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={stopScanner}
                      variant="destructive"
                      size="sm"
                      className="shrink-0 ml-2 sm:ml-4"
                    >
                      <div className="w-2 h-2 bg-background rounded-full mr-1 sm:mr-2"></div>
                      <span className="hidden sm:inline">Stop Scanner</span>
                      <span className="sm:hidden">Stop</span>
                    </Button>
                  </div>

                  {scannerError && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-start gap-3 text-destructive">
                        <div className="text-lg shrink-0 mt-0.5">⚠️</div>
                        <div className="min-w-0">
                          <p className="leading-relaxed">{scannerError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {scanFeedback && (
                    <div
                      className={`mb-6 p-4 rounded-lg border ${
                        scanFeedback.includes("Already scanned") ||
                        scanFeedback.includes("Error") ||
                        scanFeedback.includes("Failed")
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-green-50 border-green-200 text-green-800"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-lg shrink-0 mt-0.5">
                          {scanFeedback.includes("Already scanned")
                            ? "⚠️"
                            : scanFeedback.includes("Error") ||
                              scanFeedback.includes("Failed")
                            ? "❌"
                            : "✅"}
                        </div>
                        <div className="min-w-0">
                          <p className="leading-relaxed font-medium">
                            {scanFeedback}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Scanner Container - Ensure camera is visible */}
                  <div className="flex justify-center mb-4 sm:mb-6">
                    <div className="bg-background p-2 sm:p-4 rounded-lg border-2 border-border shadow-lg w-full max-w-sm">
                      <div
                        id="admission-qr-reader"
                        className="rounded-md overflow-hidden w-full"
                        style={{
                          minHeight: "250px",
                          minWidth: "250px",
                          maxWidth: "100%",
                          display: "block",
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-background/80 backdrop-blur-sm px-6 py-3 rounded-full text-sm border">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      <span className="text-foreground leading-relaxed">
                        Scanner ready • Good lighting recommended
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Scanner Section - When not scanning */}
              {!isScanning && (
                <div className="bg-muted/50 rounded-lg p-6 border">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="bg-muted-foreground p-3 rounded-lg shrink-0">
                        <QrCodeIcon className="w-6 h-6 text-background" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold mb-2">
                          QR Code Scanner
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Activate camera to scan QR codes containing admission
                          numbers
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={startScanner}
                      disabled={!isScriptLoaded}
                      className="shadow-lg shrink-0 ml-2 sm:ml-4"
                    >
                      <QrCodeIcon className="w-4 h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Start Scanner</span>
                      <span className="sm:hidden">Start</span>
                    </Button>
                  </div>

                  {scannerError && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-start gap-3 text-destructive">
                        <div className="text-lg shrink-0 mt-0.5">⚠️</div>
                        <div className="min-w-0">
                          <p className="leading-relaxed">{scannerError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Scanner Placeholder */}
                  <div className="flex justify-center">
                    <div className="w-80 h-80 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-background">
                      <div className="text-center text-muted-foreground p-6">
                        <div className="bg-muted p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <QrCodeIcon className="w-8 h-8" />
                        </div>
                        <p className="font-medium mb-2 leading-relaxed">
                          Camera Preview
                        </p>
                        <p className="text-sm leading-relaxed">
                          Click "Start Scanner" to activate camera
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Input Section */}
              <Card className={isScanning ? "shadow-md" : "shadow-lg"}>
                <CardContent className={isScanning ? "p-3 sm:p-5" : "p-4 sm:p-6"}>
                  <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="bg-accent p-3 rounded-lg shrink-0">
                      <EditIcon className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-semibold mb-2 ${
                          isScanning ? "text-base" : "text-lg"
                        }`}
                      >
                        Manual Entry
                      </h3>
                      <p
                        className={`text-muted-foreground leading-relaxed ${
                          isScanning ? "text-xs" : "text-sm"
                        }`}
                      >
                        {isScanning
                          ? "Alternative input method while scanner is active"
                          : "Type admission numbers directly if QR codes are not available"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <input
                      type="text"
                      placeholder="Enter admission number..."
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleManualAdd()}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                    />
                    <Button
                      onClick={handleManualAdd}
                      disabled={!manualInput.trim()}
                      className="px-3 sm:px-6 shrink-0"
                      size="sm"
                    >
                      <span className="hidden sm:inline">Add Number</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  </div>

                  {/* Show feedback for manual entry as well */}
                  {scanFeedback && !isScanning && (
                    <div
                      className={`mt-4 p-3 rounded-lg border ${
                        scanFeedback.includes("Already scanned") ||
                        scanFeedback.includes("Error") ||
                        scanFeedback.includes("Failed")
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-green-50 border-green-200 text-green-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm shrink-0">
                          {scanFeedback.includes("Already scanned")
                            ? "⚠️"
                            : scanFeedback.includes("Error") ||
                              scanFeedback.includes("Failed")
                            ? "❌"
                            : "✅"}
                        </div>
                        <p className="text-sm font-medium">{scanFeedback}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scanned Admissions List */}
              <Card className={isScanning ? "shadow-md" : "shadow-lg"}>
                <CardContent className={isScanning ? "p-3 sm:p-5" : "p-4 sm:p-6"}>
                  <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1">
                      <div className="bg-secondary p-3 rounded-lg shrink-0">
                        <UsersIcon className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          className={`font-semibold mb-2 ${
                            isScanning ? "text-base" : "text-lg"
                          }`}
                        >
                          Scanned Admissions
                        </h3>
                        <p
                          className={`text-muted-foreground leading-relaxed ${
                            isScanning ? "text-xs" : "text-sm"
                          }`}
                        >
                          {scannedAdmissions.length} new admission numbers in this session
                          {existingAdmissions.length > 0 && 
                            `, ${existingAdmissions.length} previously saved`
                          }
                          {` (Total: ${scannedAdmissions.length + existingAdmissions.length})`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(existingAdmissions.length > 0 || scannedAdmissions.length > 0) ? (
                    <div
                      className={`border rounded-lg overflow-hidden ${
                        isScanning ? "max-h-40" : "max-h-64"
                      } overflow-y-auto`}
                    >
                      {/* Show existing admissions first */}
                      {existingAdmissions.map((item, index) => (
                        <div
                          key={`existing-${index}`}
                          className="flex justify-between items-center p-4 border-b last:border-b-0 bg-gray-50 dark:bg-gray-800/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-gray-300 dark:bg-gray-600 p-2 rounded-lg shrink-0">
                              <div className="w-4 h-4 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`font-mono font-semibold mb-1 ${
                                  isScanning ? "text-sm" : "text-base"
                                }`}
                              >
                                {item.admissionNumber}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Previously saved
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Existing
                          </Badge>
                        </div>
                      ))}
                      
                      {/* Show new scanned admissions */}
                      {scannedAdmissions.map((item, index) => (
                        <div
                          key={`new-${index}`}
                          className="flex justify-between items-center p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors duration-150"
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-muted p-2 rounded-lg shrink-0">
                              <div className="w-4 h-4 bg-primary rounded-full"></div>
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`font-mono font-semibold mb-1 ${
                                  isScanning ? "text-sm" : "text-base"
                                }`}
                              >
                                {item.admissionNumber}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Scanned at{" "}
                                {new Date(item.scannedAt).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  }
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() =>
                              handleRemoveAdmission(item.admissionNumber)
                            }
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`text-center text-muted-foreground ${
                        isScanning ? "py-8" : "py-12"
                      }`}
                    >
                      <div className="bg-muted p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <UsersIcon
                          className={`${isScanning ? "w-6 h-6" : "w-8 h-8"}`}
                        />
                      </div>
                      <p
                        className={`font-medium mb-2 leading-relaxed ${
                          isScanning ? "text-sm" : ""
                        }`}
                      >
                        No admissions scanned yet
                      </p>
                      <p
                        className={`leading-relaxed ${
                          isScanning ? "text-xs" : "text-sm"
                        }`}
                      >
                        {isScanning
                          ? "Use scanner or manual entry above"
                          : "Start by scanning QR codes or entering admission numbers manually"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>

          <CardFooter className="border-t p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-3 sm:gap-0">
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto px-6 sm:px-8 py-2 order-2 sm:order-1">
                Cancel
              </Button>

              <div className="flex gap-2 sm:gap-4 w-full sm:w-auto order-1 sm:order-2">
                {scannedAdmissions.length > 0 && (
                  <Button 
                    onClick={handleComplete} 
                    disabled={isSaving}
                    className="flex-1 sm:flex-none px-4 sm:px-8 py-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="hidden sm:inline">Saving...</span>
                        <span className="sm:hidden">Save</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 sm:w-5 h-4 sm:h-5 mr-2 sm:mr-3" />
                        <span className="hidden sm:inline">Save Admissions</span>
                        <span className="sm:hidden">Save</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
