// components/scanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, QrCodeIcon, UsersIcon, CheckIcon, AlertCircleIcon } from "./icons";

export default function BarcodeScannerPage({
  company: activity,
  onBack,
  onMarkAttendance,
  isScriptLoaded,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Button,
  Badge,
}) {
  const [lastScannedId, setLastScannedId] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(""); // For showing scan success/duplicate messages
  const readerId = `qr-reader-${activity.id}`; // Make ID unique per activity
  const scannerRef = useRef(null);
  const timeoutRef = useRef(null);

  const onMarkAttendanceRef = useRef(onMarkAttendance);
  useEffect(() => {
    onMarkAttendanceRef.current = onMarkAttendance;
  });

  useEffect(() => {
    // Clear any existing timeout̀
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Function to completely clean up scanner and DOM
    const cleanupScanner = async () => {
      // Clear existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.clear();
        } catch (error) {
          // Silent cleanup - scanner may already be stopped
        }
        scannerRef.current = null;
      }

      // Clean up DOM element completely
      const readerEl = document.getElementById(readerId);
      if (readerEl) {
        readerEl.innerHTML = "";
        // Force stop any media streams
        const videos = readerEl.querySelectorAll("video");
        videos.forEach((video) => {
          if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          }
        });
      }
      setIsScanning(false);
    };

    // Initialize scanner with proper cleanup
    const initializeScanner = async () => {
      if (!isScriptLoaded || !window.Html5QrcodeScanner) {
        return;
      }

      const readerEl = document.getElementById(readerId);
      if (!readerEl) {
        return;
      }

      // Ensure complete cleanup before creating new instance
      await cleanupScanner();

      // Create new scanner instance
      try {
        setIsScanning(true);
        scannerRef.current = new window.Html5QrcodeScanner(
          readerId,
          {
            fps: 10,
            qrbox: { width: 280, height: 280 },
            rememberLastUsedCamera: false,
            supportedScanTypes: [window.Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          },
          false
        );

        const onScanSuccess = (decodedText, decodedResult) => {
          // Use Firestore document ID for activity reference
          onMarkAttendanceRef.current(activity.id, decodedText);
          setLastScannedId(decodedText);
          setScanFeedback(`Successfully marked attendance for ${decodedText}`);
          
          // Clear feedback after 3 seconds
          setTimeout(() => {
            setLastScannedId(null);
            setScanFeedback("");
          }, 3000);
        };

        const onScanFailure = (error) => {
          // Silent failure for scan attempts
        };

        scannerRef.current.render(onScanSuccess, onScanFailure);
      } catch (error) {
        setError(
          "Failed to initialize scanner. Please refresh the page and try again."
        );
        setIsScanning(false);
      }
    };

    // Initialize with delay to ensure cleanup is complete
    if (isScriptLoaded) {
      timeoutRef.current = setTimeout(initializeScanner, 300);
    }

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      cleanupScanner();
    };
  }, [isScriptLoaded, activity.id, readerId]);

  // Calculate present and total counts using participant attendance property
  const presentCount = activity.participants?.filter(p => p.attendance)?.length || 0;
  const totalStudents = activity.participants?.length || 0;

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="flex justify-between items-start p-2">
              <div className="flex-1 pr-4">
                <CardTitle className="text-xl font-semibold flex items-center gap-3 mb-2">
                  {isScanning ? (
                    <>
                      <div className="animate-pulse bg-white rounded-full w-3 h-3"></div>
                      Scanner Active
                    </>
                  ) : (
                    <>
                      <QrCodeIcon className="w-6 h-6" />
                      QR Code Scanner
                    </>
                  )}
                </CardTitle>
                <CardDescription className="text-primary-foreground/80 leading-relaxed">
                  {activity.activityName || activity.name} • {isScanning ? "Scanning in progress" : "Scan student ID QR codes to mark attendance"}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Section */}
        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-primary p-3 rounded-lg shrink-0">
                  <QrCodeIcon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold mb-2">Camera Scanner</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Position QR codes within the scanner frame for automatic attendance marking
                  </p>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-3 text-destructive">
                    <AlertCircleIcon className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="leading-relaxed">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scan Feedback */}
              {scanFeedback && (
                <div className="mb-6 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800">
                  <div className="flex items-start gap-3">
                    <CheckIcon className="h-5 w-5 shrink-0 mt-0.5 text-green-600" />
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
                    id={readerId}
                    key={activity.id + (isScriptLoaded ? "-active" : "-loading")}
                    className="rounded-md overflow-hidden"
                    style={{
                      minHeight: "300px",
                      minWidth: "300px",
                      maxWidth: "100%",
                      display: "block",
                    }}
                  >
                    {!isScriptLoaded && (
                      <div className="h-[300px] w-[300px] border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-muted">
                        <div className="text-center text-muted-foreground p-6">
                          <div className="bg-muted p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <QrCodeIcon className="w-8 h-8" />
                          </div>
                          <p className="font-medium mb-2 leading-relaxed">Loading Scanner...</p>
                          <p className="text-sm leading-relaxed">Please wait while the QR scanner initializes</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center gap-3 bg-background/80 backdrop-blur-sm px-6 py-3 rounded-full text-sm border">
                  <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`}></div>
                  <span className="text-foreground leading-relaxed">
                    {isScanning ? "Scanner ready • Good lighting recommended" : "Scanner will activate automatically"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List Section */}
        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="border-b">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-secondary p-3 rounded-lg shrink-0">
                    <UsersIcon className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg font-semibold mb-2">Attendance List</CardTitle>
                    <CardDescription className="leading-relaxed">
                      Live attendance tracking for {activity.activityName || activity.name}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {presentCount} / {totalStudents} Present
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background border-b">
                    <TableRow>
                      <TableHead className="text-xs w-24">Adm. No.</TableHead>
                      <TableHead className="text-xs min-w-0">Name</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell w-20">Roll No.</TableHead>
                      <TableHead className="text-xs text-right w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.participants?.map((student) => {
                      // Use admission number as primary identifier
                      const studentId = student.admissionNumber || student.id;
                      // Use participant's attendance property directly
                      const isPresent = student.attendance;
                      return (
                        <TableRow
                          key={studentId}
                          className={`transition-colors duration-300 ${
                            lastScannedId === studentId
                              ? "bg-green-100/50 dark:bg-green-900/20 animate-pulse"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <TableCell className="font-mono text-xs p-3 truncate">
                            {studentId}
                          </TableCell>
                          <TableCell className="text-sm p-3 truncate max-w-0 font-medium">
                            {student.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground p-3 hidden sm:table-cell">
                            {student.rollNumber || student.roll || "-"}
                          </TableCell>
                          <TableCell className="text-right p-3">
                            {isPresent ? (
                              <Badge
                                variant="default"
                                className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              >
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Present</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-xs px-2 py-1"
                              >
                                <ClockIcon className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">Absent</span>
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
