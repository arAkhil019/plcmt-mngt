// components/scanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon } from "./icons";

export default function BarcodeScannerPage({
    company: activity,
    onBack,
    attendance,
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
    Badge
}) {
    const [lastScannedId, setLastScannedId] = useState(null);
    const readerId = `qr-reader-${activity.id}`;  // Make ID unique per activity
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
                    console.warn("Error clearing scanner:", error);
                }
                scannerRef.current = null;
            }
            
            // Clean up DOM element completely
            const readerEl = document.getElementById(readerId);
            if (readerEl) {
                readerEl.innerHTML = "";
                // Force stop any media streams
                const videos = readerEl.querySelectorAll('video');
                videos.forEach(video => {
                    if (video.srcObject) {
                        const tracks = video.srcObject.getTracks();
                        tracks.forEach(track => track.stop());
                    }
                });
            }
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
                scannerRef.current = new window.Html5QrcodeScanner(
                    readerId,
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        rememberLastUsedCamera: false,
                        supportedScanTypes: [window.Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                    },
                    false
                );

                const onScanSuccess = (decodedText, decodedResult) => {
                    onMarkAttendanceRef.current(activity.id, decodedText);
                    setLastScannedId(decodedText);
                    setTimeout(() => setLastScannedId(null), 3000);
                };

                const onScanFailure = (error) => {
                    // Silent failure for scan attempts
                };

                scannerRef.current.render(onScanSuccess, onScanFailure);
            } catch (error) {
                console.error("Error initializing scanner:", error);
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

    // Calculate present and total counts
    const presentCount = attendance[activity.id]?.length || 0;
    const totalStudents = activity.students?.length || 0;

    return (
        <div className="w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Scan QR Code</CardTitle>
                        <Button onClick={onBack} variant="outline" className="h-9 px-3">
                            <ArrowLeftIcon className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                    </div>
                    <CardDescription>
                        Point the camera at a student's ID QR code.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div
                        id={readerId}
                        key={activity.id + (isScriptLoaded ? "-active" : "-loading")}
                        className="w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 min-h-[300px]"
                    >
                        {!isScriptLoaded && (
                            <p className="text-center p-4 text-gray-500">
                                Loading Scanner...
                            </p>
                        )}
                    </div>
                    {lastScannedId && (
                        <div className="mt-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm font-medium text-center">
                            Successfully marked attendance for {lastScannedId}.
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Attendance List</CardTitle>
                        <Badge variant="secondary">{presentCount} / {totalStudents} Present</Badge>
                    </div>
                    <CardDescription>For: {activity.companyName}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-h-[400px] overflow-y-auto pr-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activity.students?.map((student) => {
                                    const record = attendance[activity.id]?.find(
                                        (att) => att.studentId === student.id
                                    );
                                    return (
                                        <TableRow
                                            key={student.id}
                                            className={
                                                lastScannedId === student.id
                                                    ? "bg-green-100/50 dark:bg-green-900/20"
                                                    : ""
                                            }
                                        >
                                            <TableCell className="font-mono text-xs">
                                                {student.id}
                                            </TableCell>
                                            <TableCell>{student.name}</TableCell>
                                            <TableCell className="text-right">
                                                {record ? (
                                                    <Badge
                                                        variant="success"
                                                        className="flex items-center gap-1.5"
                                                    >
                                                        <CheckCircleIcon className="h-3.5 w-3.5" />
                                                        Attended
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="flex items-center gap-1.5"
                                                    >
                                                        <ClockIcon className="h-3.5 w-3.5" />
                                                        Absent
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
    );
}
