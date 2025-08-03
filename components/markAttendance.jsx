// components/markAttendance.jsx
import React, { useState, useEffect, useRef } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService.js";
import { studentsService } from "../lib/studentsService.js";
import {
  QrCodeIcon,
  UsersIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ClockIcon,
  StopIcon,
} from "./icons";

export default function MarkAttendance({
  activity,
  userProfile,
  onBack,
  onMarkAttendance,
  isScriptLoaded,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
}) {
  // Validate required props
  useEffect(() => {
    console.log("MarkAttendance props:", { activity, userProfile, isScriptLoaded });
    
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
  const [lastScannedTime, setLastScannedTime] = useState(0);
  const [recentlyScanned, setRecentlyScanned] = useState(new Set());

  const scannerRef = useRef(null);
  const html5QrCode = useRef(null);
  const localStorageKey = `markAttendance_${activity.id}`;
  
  // Debounce time in milliseconds to prevent rapid duplicate scans
  const SCAN_DEBOUNCE_TIME = 2000;

  // Load existing scanned admissions from localStorage on component mount
  useEffect(() => {
    const loadData = async () => {
      // Load from localStorage first
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

      // Load existing scanned admissions from activity
      try {
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

    loadData();
  }, [activity.id, localStorageKey]);

  // Save scanned admissions to localStorage whenever it changes
  useEffect(() => {
    if (scannedAdmissions.length > 0) {
      localStorage.setItem(localStorageKey, JSON.stringify(scannedAdmissions));
    } else {
      localStorage.removeItem(localStorageKey);
    }
  }, [scannedAdmissions, localStorageKey]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCode.current) {
        html5QrCode.current.stop().catch(console.error);
      }
    };
  }, []);

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

      html5QrCode.current = new window.Html5Qrcode("attendance-qr-reader");

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

      // Check if this student is already marked present in the activity
      const alreadyPresent = activity.participants?.find(
        p => (p.admissionNumber === admissionNumber || p.rollNumber === admissionNumber) && p.attendance
      );

      if (alreadyScannedLocally) {
        setScanFeedback(`Already scanned in this session: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      if (alreadyExistsInActivity) {
        setScanFeedback(`Already saved to activity: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      if (alreadyPresent) {
        setScanFeedback(`Attendance already marked: ${alreadyPresent.name}`);
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

      // Check if this student is already marked present in the activity
      const alreadyPresent = activity.participants?.find(
        p => (p.admissionNumber === admissionNumber || p.rollNumber === admissionNumber) && p.attendance
      );

      if (alreadyScannedLocally) {
        setScanFeedback(`Already scanned in this session: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      if (alreadyExistsInActivity) {
        setScanFeedback(`Already saved to activity: ${admissionNumber}`);
        setTimeout(() => setScanFeedback(""), 3000);
        return;
      }

      if (alreadyPresent) {
        setScanFeedback(`Attendance already marked: ${alreadyPresent.name}`);
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

  const handleSaveScannedAdmissions = async () => {
    if (scannedAdmissions.length === 0) {
      setScanFeedback("No admission numbers to save");
      setTimeout(() => setScanFeedback(""), 3000);
      return;
    }

    try {
      setScanFeedback("Saving scanned admissions to activity...");

      // Get current activity to check for existing scanned admissions
      const currentActivity = await unifiedActivitiesService.getActivityById(activity.id);
      const existingScannedAdmissions = currentActivity.scannedAdmissions || [];
      
      // Create a case-insensitive set of existing admission numbers
      const existingAdmissionNumbers = new Set(
        existingScannedAdmissions.map((item) => item.admissionNumber.toUpperCase())
      );

      // Filter out duplicates using case-insensitive comparison
      const newAdmissions = scannedAdmissions.filter((item) => {
        const upperCaseNumber = item.admissionNumber.toUpperCase();
        return !existingAdmissionNumbers.has(upperCaseNumber);
      });

      // Combine existing and new admissions
      const allScannedAdmissions = [...existingScannedAdmissions, ...newAdmissions];

      // Update activity with scanned admissions
      await unifiedActivitiesService.updateActivity(
        activity.id,
        {
          scannedAdmissions: allScannedAdmissions,
        },
        {
          id: userProfile.id,
          name: userProfile.name,
        }
      );

      // Clear local storage and local state
      localStorage.removeItem(localStorageKey);
      setScannedAdmissions([]);

      setScanFeedback(`Successfully saved ${newAdmissions.length} new admission numbers to activity`);
      setTimeout(() => setScanFeedback(""), 3000);
      
      // Update existing admissions display
      setExistingAdmissions(allScannedAdmissions);
      
    } catch (error) {
      console.error("Error saving admissions:", error);
      setScanFeedback(`Error saving admissions: ${error.message}`);
      setTimeout(() => setScanFeedback(""), 3000);
    }
  };

  const handleSaveAdmissions = async () => {
    if (scannedAdmissions.length === 0) {
      setScanFeedback("No admission numbers to save");
      setTimeout(() => setScanFeedback(""), 3000);
      return;
    }

    try {
      setScanFeedback("Saving scanned admissions to activity...");

      // Get current activity to check for existing scanned admissions
      const currentActivity = await unifiedActivitiesService.getActivityById(activity.id);
      const existingScannedAdmissions = currentActivity.scannedAdmissions || [];
      
      // Create a case-insensitive set of existing admission numbers
      const existingAdmissionNumbers = new Set(
        existingScannedAdmissions.map((item) => item.admissionNumber.toUpperCase())
      );

      // Filter out duplicates using case-insensitive comparison
      const newAdmissions = scannedAdmissions.filter((item) => {
        const upperCaseNumber = item.admissionNumber.toUpperCase();
        return !existingAdmissionNumbers.has(upperCaseNumber);
      });

      // Combine existing and new admissions
      const allScannedAdmissions = [...existingScannedAdmissions, ...newAdmissions];

      // Update activity with scanned admissions
      await unifiedActivitiesService.updateActivity(
        activity.id,
        {
          scannedAdmissions: allScannedAdmissions,
        },
        {
          id: userProfile.id,
          name: userProfile.name,
        }
      );

      // Clear local storage and local state
      localStorage.removeItem(localStorageKey);
      setScannedAdmissions([]);

      setScanFeedback(`Successfully saved ${newAdmissions.length} new admission numbers to activity`);
      setTimeout(() => setScanFeedback(""), 3000);
      
    } catch (error) {
      console.error("Error saving admissions:", error);
      setScanFeedback(`Failed to save admission numbers: ${error.message}`);
      setTimeout(() => setScanFeedback(""), 3000);
    }
  };

  const handleClearAll = () => {
    setScannedAdmissions([]);
    localStorage.removeItem(localStorageKey);
    setScanFeedback("Cleared all scanned data");
    setTimeout(() => setScanFeedback(""), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="flex justify-between items-start p-2">
              <div className="flex-1 pr-4">
                <CardTitle className="text-xl font-semibold flex items-center gap-3 mb-2">
                  <QrCodeIcon className="w-6 h-6" />
                  Mark Attendance
                </CardTitle>
                <CardDescription className="text-primary-foreground/80 leading-relaxed">
                  {activity.companyName || activity.name} • 
                  {scannedAdmissions.length > 0 && ` ${scannedAdmissions.length} new scanned`}
                  {existingAdmissions.length > 0 && ` • ${existingAdmissions.length} previously saved`}
                  {scannedAdmissions.length === 0 && existingAdmissions.length === 0 && " Scan admission numbers and save them to activity"}
                </CardDescription>
              </div>
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20 h-10 w-10 p-2 shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Scanner Section */}
        <div className="space-y-6">
          {/* QR Scanner Card */}
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-primary p-3 rounded-lg shrink-0">
                  <QrCodeIcon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold mb-2">Camera Scanner</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Scan QR codes to collect admission numbers - they will be saved for mapping in View Attendance
                  </p>
                </div>
                {isScanning && (
                  <Button
                    onClick={stopScanner}
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                  >
                    <StopIcon className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>

              {/* Error Display */}
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

              {/* Scan Feedback */}
              {scanFeedback && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  scanFeedback.includes("Error") || scanFeedback.includes("Failed")
                    ? "bg-red-50 border-red-200 text-red-800"
                    : scanFeedback.includes("already")
                    ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                    : "bg-green-50 border-green-200 text-green-800"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="text-lg shrink-0 mt-0.5">
                      {scanFeedback.includes("Error") || scanFeedback.includes("Failed")
                        ? "❌"
                        : scanFeedback.includes("already")
                        ? "⚠️"
                        : "✅"}
                    </div>
                    <div className="min-w-0">
                      <p className="leading-relaxed font-medium">{scanFeedback}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Scanner Container */}
              <div className="flex justify-center mb-6">
                <div className="bg-background p-4 rounded-lg border-2 border-border shadow-lg">
                  <div
                    id="attendance-qr-reader"
                    className="rounded-md overflow-hidden"
                    style={{
                      minHeight: "300px",
                      minWidth: "300px",
                      maxWidth: "100%",
                      display: "block",
                    }}
                  >
                    {!isScanning && (
                      <div className="h-[300px] w-[300px] border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted">
                        <div className="text-center text-muted-foreground p-6">
                          <div className="bg-muted p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <QrCodeIcon className="w-8 h-8" />
                          </div>
                          <p className="font-medium mb-2 leading-relaxed">Camera Preview</p>
                          <p className="text-sm leading-relaxed mb-4">Click "Start Scanner" to activate camera</p>
                          <Button
                            onClick={startScanner}
                            disabled={!isScriptLoaded}
                            className="shadow-lg"
                          >
                            <QrCodeIcon className="w-4 h-4 mr-2" />
                            Start Scanner
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isScanning && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-background/80 backdrop-blur-sm px-6 py-3 rounded-full text-sm border">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    <span className="text-foreground leading-relaxed">
                      Scanner ready • Good lighting recommended
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Input Card */}
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-accent p-3 rounded-lg shrink-0">
                  <EditIcon className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold mb-2">Manual Entry</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Add admission numbers to the scanning list manually
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter admission number or roll number..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleManualAdd()}
                  className="flex-1 px-4 py-3 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200"
                />
                <Button
                  onClick={handleManualAdd}
                  disabled={!manualInput.trim()}
                  className="px-6 shrink-0"
                >
                  Add to List
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Saved Admissions Card */}
          {existingAdmissions.length > 0 && (
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-gray-500 p-3 rounded-lg shrink-0">
                    <CheckCircleIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold mb-2">Previously Saved Admissions</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {existingAdmissions.length} admission numbers already saved to this activity
                    </p>
                  </div>
                </div>

                <div className="max-h-32 overflow-y-auto border rounded-lg bg-gray-50">
                  {existingAdmissions.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 border-b last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-medium text-gray-700">
                          {item.admissionNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Saved previously • {item.scannedByName || 'Unknown User'}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Saved
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Go to <strong>View Attendance</strong> to map these admissions to students and mark attendance
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanned Admissions Card */}
          {/* Scanned Admissions Card */}
          {scannedAdmissions.length > 0 && (
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-blue-500 p-3 rounded-lg shrink-0">
                    <UsersIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold mb-2">Scanned Admissions</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {scannedAdmissions.length} admission numbers scanned - Save to activity or map & mark immediately
                    </p>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto border rounded-lg mb-4">
                  {scannedAdmissions.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono font-medium">
                          {item.admissionNumber}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Scanned at {new Date(item.scannedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRemoveAdmission(item.admissionNumber)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveScannedAdmissions}
                    disabled={scannedAdmissions.length === 0}
                    className="flex-1"
                  >
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    Save Scanned Admissions
                  </Button>
                  <Button
                    onClick={handleClearAll}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
