// components/attendance-view.jsx
import React, { useState, useCallback } from "react";
import { ArrowLeftIcon, CheckCircleIcon, ClockIcon, DownloadIcon, UserPlusIcon, QrCodeIcon, UsersIcon } from "./icons";
import { studentsService } from "../lib/studentsService";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";

export default function AttendanceView({
  company: activity,
  onBack,
  userProfile,
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
  // Calculate present and total counts using participant attendance property
  const presentCount = activity.participants?.filter(p => p.attendance)?.length || 0;
  const totalStudents = activity.participants?.length || 0;
  const scannedAdmissions = activity.scannedAdmissions || [];
  
  // State for mapping functionality
  const [isMapping, setIsMapping] = useState(false);
  const [mappingResults, setMappingResults] = useState(null);
  const [showMappingResults, setShowMappingResults] = useState(false);

  // Handle export admission numbers
  const handleExportAdmissions = useCallback(() => {
    if (scannedAdmissions.length === 0) {
      alert("No scanned admission numbers to export");
      return;
    }

    // Create CSV content
    const csvHeader = "Admission Number,Scanned At,Scanned By\n";
    const csvRows = scannedAdmissions.map(admission => 
      `${admission.admissionNumber},${new Date(admission.scannedAt).toLocaleString()},${admission.scannedByName || admission.scannedBy}`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activity.companyName || 'Activity'}_admission_numbers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [scannedAdmissions, activity.companyName]);

  // Handle export participants as Excel/CSV
  const handleExportParticipants = useCallback(() => {
    if (!activity.participants || activity.participants.length === 0) {
      alert("No participants to export");
      return;
    }

    // Create CSV content with participant details
    const csvHeader = "Name,Roll Number,Admission Number,Department,Year,Attendance Status,Marked At,Marked By\n";
    const csvRows = activity.participants.map(participant => {
      const name = (participant.name || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
      const rollNumber = participant.rollNumber || '';
      const admissionNumber = participant.admissionNumber || '';
      const department = (participant.department || '').replace(/,/g, ';');
      const year = participant.year || '';
      const attendanceStatus = participant.attendance ? 'Present' : 'Absent';
      const markedAt = participant.attendanceMarkedAt ? new Date(participant.attendanceMarkedAt).toLocaleString() : '';
      const markedBy = participant.attendanceMarkedByName || participant.attendanceMarkedBy || '';
      
      return `"${name}","${rollNumber}","${admissionNumber}","${department}","${year}","${attendanceStatus}","${markedAt}","${markedBy}"`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activity.companyName || 'Activity'}_participants_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [activity.participants, activity.companyName]);

  // Handle mapping admission numbers to students
  const handleMapAdmissions = useCallback(async () => {
    if (scannedAdmissions.length === 0) {
      alert("No scanned admission numbers to map");
      return;
    }

    if (!userProfile || !userProfile.id) {
      alert("User profile not available. Please refresh and try again.");
      return;
    }

    try {
      setIsMapping(true);
      setMappingResults(null);

      // Extract admission numbers
      const admissionNumbers = scannedAdmissions.map(admission => admission.admissionNumber);
      
      // Search for students by admission numbers
      const searchResults = await studentsService.batchSearchByAdmissionNumbers(admissionNumbers);
      
      // Filter out students already in participants list
      const existingAdmissionNumbers = new Set(
        activity.participants?.map(p => p.admissionNumber) || []
      );
      
      const newStudentsToAdd = searchResults.found.filter(result => 
        !existingAdmissionNumbers.has(result.admissionNumber)
      );

      if (newStudentsToAdd.length === 0) {
        setMappingResults({
          ...searchResults,
          newStudentsToAdd: [],
          message: "No new students to add. All found students are already participants."
        });
        setShowMappingResults(true);
        return;
      }

      // Prepare participants data for adding to activity
      const participantsToAdd = newStudentsToAdd.map(result => ({
        admissionNumber: result.student.admissionNumber,
        name: result.student.name,
        rollNumber: result.student.rollNumber,
        department: result.student.department,
        year: result.student.year,
        attendance: true, // Auto-mark as present
        attendanceMarkedAt: new Date().toISOString(),
        attendanceMarkedBy: userProfile.id,
        attendanceMarkedByName: userProfile.name,
        addedFromScan: true,
        addedAt: new Date().toISOString()
      }));

      // Add participants to activity
      const addResult = await unifiedActivitiesService.addParticipants(
        activity.id,
        participantsToAdd,
        userProfile
      );

      setMappingResults({
        ...searchResults,
        newStudentsToAdd,
        addResult,
        participantsAdded: participantsToAdd,
        message: `Successfully added ${addResult.added} new participants and marked them as present.`
      });
      setShowMappingResults(true);

      // Trigger a refresh of the activity data
      if (window.location.reload) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }

    } catch (error) {
      console.error("Error mapping admissions:", error);
      alert(`Failed to map admission numbers: ${error.message}`);
    } finally {
      setIsMapping(false);
    }
  }, [scannedAdmissions, activity.participants, activity.id, userProfile]);

  // Close mapping results
  const closeMappingResults = useCallback(() => {
    setShowMappingResults(false);
    setMappingResults(null);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg sm:text-xl">Attendance Management</CardTitle>
              <CardDescription className="text-sm">
                {activity.companyName} • {scannedAdmissions.length} scanned admissions
              </CardDescription>
            </div>
            <Button onClick={onBack} variant="outline" className="h-8 sm:h-9 px-2 sm:px-3 self-start sm:self-auto">
              <ArrowLeftIcon className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scanned Admissions Section */}
          {scannedAdmissions.length > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                      <QrCodeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Scanned Admission Numbers</CardTitle>
                      <CardDescription>
                        {scannedAdmissions.length} admission numbers scanned for this activity
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleExportAdmissions}
                      variant="outline"
                      size="sm"
                      className="h-9"
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button
                      onClick={handleMapAdmissions}
                      disabled={isMapping}
                      size="sm"
                      className="h-9"
                    >
                      {isMapping ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                          Mapping...
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="w-4 h-4 mr-2" />
                          Map to Students
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-48 overflow-y-auto border rounded-lg bg-white dark:bg-gray-900">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Admission Number</TableHead>
                        <TableHead className="text-xs">Scanned At</TableHead>
                        <TableHead className="text-xs">Scanned By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scannedAdmissions.map((admission, index) => (
                        <TableRow key={`${admission.admissionNumber}-${index}`}>
                          <TableCell className="font-mono text-sm font-semibold">
                            {admission.admissionNumber}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                            {new Date(admission.scannedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                            {admission.scannedByName || admission.scannedBy}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mapping Results Modal */}
          {showMappingResults && mappingResults && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                      <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-green-800 dark:text-green-200">
                        Mapping Results
                      </CardTitle>
                      <CardDescription className="text-green-700 dark:text-green-300">
                        {mappingResults.message}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={closeMappingResults}
                    variant="ghost"
                    size="sm"
                    className="text-green-600 dark:text-green-400"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Scanned</div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {mappingResults.summary.total}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Found Students</div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {mappingResults.summary.found}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Not Found</div>
                    <div className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                      {mappingResults.summary.notFound}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Added as Participants</div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {mappingResults.addResult?.added || mappingResults.newStudentsToAdd.length}
                    </div>
                  </div>
                </div>
                
                {mappingResults.notFound.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      Admission Numbers Not Found ({mappingResults.notFound.length}):
                    </h4>
                    <div className="bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded border text-xs">
                      {mappingResults.notFound.map(item => item.admissionNumber).join(', ')}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Participants Section */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                    <UsersIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Registered Participants</CardTitle>
                    <CardDescription>
                      Students registered for this activity
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleExportParticipants}
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={!activity.participants || activity.participants.length === 0}
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    {presentCount} / {totalStudents} Present
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto -mx-2 sm:mx-0">
                <div className="px-2 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-20 sm:w-auto">ID</TableHead>
                        <TableHead className="text-xs min-w-0">Name</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">Department</TableHead>
                        <TableHead className="text-xs text-right w-20 sm:w-auto">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {activity.participants?.map((student) => {
                      // Use participant's attendance property directly
                      const isPresent = student.attendance;
                      const wasAddedFromScan = student.addedFromScan;
                      return (
                        <TableRow key={student.admissionNumber || student.id} className={wasAddedFromScan ? "bg-green-50 dark:bg-green-950/10" : ""}>
                          <TableCell className="font-mono text-xs p-2 sm:p-4 truncate">
                            <div className="flex items-center gap-1">
                              {student.admissionNumber || student.id}
                              {wasAddedFromScan && (
                                <Badge variant="outline" className="text-xs px-1 py-0 bg-green-100 text-green-700 border-green-300">
                                  Scanned
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4 truncate max-w-0">
                            {student.name}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 p-2 sm:p-4 hidden md:table-cell">
                            {student.department || "N/A"}
                          </TableCell>
                          <TableCell className="text-right p-1 sm:p-4">
                            {isPresent ? (
                              <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 sm:gap-2">
                                <Badge
                                  variant="success"
                                  className="text-xs px-1 py-0.5 sm:px-2.5 sm:py-0.5"
                                >
                                  <CheckCircleIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Present</span>
                                </Badge>
                                {student.attendanceMarkedAt && (
                                  <span className="text-xs text-gray-500 hidden sm:inline">
                                    {new Date(student.attendanceMarkedAt).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1 py-0.5 sm:px-2.5 sm:py-0.5"
                              >
                                <ClockIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1" />
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
              </div>

              {activity.participants?.length === 0 && (
                <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">
                  No participants registered for this activity.
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
