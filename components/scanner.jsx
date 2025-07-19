// components/scanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon } from "./icons";

export default function BarcodeScannerPage({
  company,
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
  Badge,
}) {
  const [lastScannedId, setLastScannedId] = useState(null);
  const readerId = "qr-reader";
  const scannerRef = useRef(null);
  const onMarkAttendanceRef = useRef(onMarkAttendance);

  useEffect(() => {
    onMarkAttendanceRef.current = onMarkAttendance;
  });

  useEffect(() => {
    // This async function handles the cleanup of the scanner instance.
    const cleanup = async () => {
      if (scannerRef.current) {
        try {
          // The clear method is async and should be awaited.
          await scannerRef.current.clear();
          console.log("Scanner cleared successfully.");
        } catch (error) {
          console.warn(
            "Error clearing scanner (it might have been already stopped):",
            error
          );
        }
        scannerRef.current = null;
      }
      // Also clear the placeholder div's content.
      const readerEl = document.getElementById(readerId);
      if (readerEl) readerEl.innerHTML = "";
    };

    // Perform an initial cleanup to remove any lingering instances.
    cleanup();

    if (isScriptLoaded) {
      // Use a small delay to ensure the DOM cleanup is complete before re-initializing.
      const timeoutId = setTimeout(() => {
        const readerEl = document.getElementById(readerId);
        if (readerEl) {
          scannerRef.current = new window.Html5QrcodeScanner(
            readerId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
          );
          scannerRef.current.render(
            (decodedText) => {
              onMarkAttendanceRef.current(company.id, decodedText);
              setLastScannedId(decodedText);
              setTimeout(() => setLastScannedId(null), 3000);
            },
            () => {} // onScanFailure - do nothing to allow continuous scanning.
          );
        }
      }, 100); // 100ms delay

      // Return a cleanup function that will be called when the component unmounts or dependencies change.
      return () => {
        clearTimeout(timeoutId);
        cleanup();
      };
    }

    // Fallback cleanup if the script isn't loaded yet.
    return () => {
      cleanup();
    };
  }, [isScriptLoaded, company.id]);

  // Calculate present and total counts to display
  const presentCount = attendance[company.id]?.length || 0;
  const totalStudents = company.students.length;

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
            // Using a key helps React to re-mount the div, ensuring a clean state.
            key={company.id + (isScriptLoaded ? "-active" : "-loading")}
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
            <Badge variant="secondary">
              {presentCount} / {totalStudents} Present
            </Badge>
          </div>
          <CardDescription>For: {company.name}</CardDescription>
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
                {company.students.map((student) => {
                  const record = attendance[company.id]?.find(
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
                            Present
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
