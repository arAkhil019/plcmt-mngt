// components/attendance-view.jsx
import React, { useState, useEffect, useCallback } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { studentsService } from "../lib/studentsService";
import { cacheUtils } from "../lib/cacheUtils";
import { activityLogsService } from "../lib/activityLogsService.js";
import {
  ArrowLeftIcon,
  UsersIcon,
  UserCheckIcon,
  DownloadIcon,
  SearchIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  FileTextIcon,
  EditIcon,
  SaveIcon,
  XIcon,
} from "./icons";

export default function AttendanceView({
  company: activity,
  userProfile,
  onBack,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
}) {
  const [activeTab, setActiveTab] = useState("participants");
  const [scannedAdmissions, setScannedAdmissions] = useState([]);
  const [mappingResults, setMappingResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Check if user has permission to manage attendance
  const canManageAttendance = () => {
    if (userProfile?.role === "admin") return true;
    if (userProfile?.role === "cpc") return true;
    if (activity.createdBy === userProfile?.id) return true;
    if (activity.createdById === userProfile?.id) return true;
    return activity.allowedUsers?.some((u) => u.id === userProfile?.id);
  };

  // Load activity data on mount
  useEffect(() => {
    const loadActivityData = async () => {
      if (!activity?.id) return;

      try {
        const currentActivity = await unifiedActivitiesService.getActivityById(
          activity.id
        );
        setScannedAdmissions(currentActivity.scannedAdmissions || []);
        setParticipants(currentActivity.participants || []);
      } catch (error) {
        console.error("Error loading activity data:", error);
      }
    };

    loadActivityData();
  }, [activity?.id]);

  // Handle mapping scanned admissions to student details and marking them as present
  const handleMapAndMarkAttendance = async () => {
    if (scannedAdmissions.length === 0) return;

    setIsLoading(true);
    try {
      const admissionNumbers = scannedAdmissions.map((item) =>
        String(item.admissionNumber).trim()
      );

      // Step 1: Check which admission numbers already exist in participants list
      const existingParticipantsMap = new Map();
      participants.forEach((p, index) => {
        if (p.admissionNumber) {
          // Convert to string and trim for consistent comparison
          const normalizedAdmissionNumber = String(p.admissionNumber).trim();
          existingParticipantsMap.set(normalizedAdmissionNumber, p);
        }
      });

      const alreadyInList = [];
      const needToSearch = [];

      admissionNumbers.forEach((admissionNumber) => {
        const normalizedAdmissionNumber = String(admissionNumber).trim();

        if (existingParticipantsMap.has(normalizedAdmissionNumber)) {
          const existingParticipant = existingParticipantsMap.get(
            normalizedAdmissionNumber
          );
          alreadyInList.push({
            admissionNumber: normalizedAdmissionNumber,
            participant: existingParticipant,
            wasAlreadyPresent: existingParticipant.attendance,
          });
        } else {
          needToSearch.push(normalizedAdmissionNumber);
        }
      });

      // Step 2: Search database for admission numbers not in the current participants list
      // Use optimized cache-aware search for better performance
      let searchResults = { found: [], notFound: [], errors: [] };
      if (needToSearch.length > 0) {
        console.log(`Searching for ${needToSearch.length} students using optimized search...`);
        
        // Use cache optimization to determine best search method
        const optimization = await cacheUtils.optimizeSearchMethod(needToSearch);
        console.log(`Using ${optimization.method} search method: ${optimization.reason}`);
        
        // Perform the optimized search with performance monitoring
        const searchOperation = () => studentsService.batchSearchByAdmissionNumbers(
          needToSearch,
          optimization.options
        );
        
        const { result, performance } = await cacheUtils.monitorCachePerformance(
          searchOperation,
          needToSearch
        );
        
        if (result) {
          searchResults = result;
          console.log(`Search completed in ${performance?.duration}ms for ${needToSearch.length} students`);
        } else {
          throw new Error("Search operation failed");
        }
      }

      // Step 3: Prepare attendance updates for existing and new participants
      const attendanceUpdates = [];
      const newParticipantsToAdd = [];

      // Process existing participants found in the current list
      alreadyInList.forEach((item) => {
        // Always try to mark as present, regardless of current status
        // The service will handle whether to update or not
        attendanceUpdates.push({
          admissionNumber: item.admissionNumber,
          attendance: true,
        });
      });

      // Process new participants found in database search
      searchResults.found.forEach((item) => {
        const participantData = {
          admissionNumber: item.student.admissionNumber || "N/A",
          name: item.student.name || "N/A",
          rollNumber: item.student.rollNumber || "N/A",
          department: item.student.department || "N/A",
          departmentCode: item.student.departmentCode || "N/A",
          year: item.student.year || "N/A",
          attendance: true,
          addedViaScanning: true,
        };

        newParticipantsToAdd.push(participantData);
      });

      // Process admission numbers not found in database - create participants with N/A values
      searchResults.notFound.forEach((item) => {
        const participantData = {
          admissionNumber: item.admissionNumber || "N/A",
          name: "N/A",
          rollNumber: "N/A",
          department: "N/A",
          departmentCode: "N/A",
          year: "N/A",
          attendance: true,
          addedViaScanning: true,
          notFoundInDatabase: true, // Flag to indicate this was not found in database
        };

        newParticipantsToAdd.push(participantData);
      });

      // Step 4a: Mark attendance for existing participants (if any)
      if (attendanceUpdates.length > 0) {
        await unifiedActivitiesService.markAttendanceForParticipants(
          activity.id,
          attendanceUpdates,
          {
            id: userProfile?.id || "unknown",
            name: userProfile?.name || "Unknown User",
            email: userProfile?.email || "unknown@email.com",
          }
        );
      }

      // Step 4b: Add new participants to the activity (if any)
      if (newParticipantsToAdd.length > 0) {
        const addResult = await unifiedActivitiesService.addParticipants(
          activity.id,
          newParticipantsToAdd,
          {
            id: userProfile?.id || "unknown",
            name: userProfile?.name || "Unknown User",
            email: userProfile?.email || "unknown@email.com",
          }
        );
      }

      // Step 4c: Refresh participants data only if we made changes
      if (attendanceUpdates.length > 0 || newParticipantsToAdd.length > 0) {
        const updatedActivity = await unifiedActivitiesService.getActivityById(
          activity.id
        );
        setParticipants(updatedActivity.participants || []);
      }

      // Step 5: Set mapping results for display
      setMappingResults({
        found: searchResults.found.length,
        notFound: searchResults.notFound.length,
        alreadyInList: alreadyInList.length,
        alreadyPresent: alreadyInList.filter((item) => item.wasAlreadyPresent)
          .length,
        markedPresent: attendanceUpdates.length + newParticipantsToAdd.length,
        total: admissionNumbers.length,
        notFoundNumbers: searchResults.notFound.map(
          (item) => item.admissionNumber
        ),
        createdFromNotFound: searchResults.notFound.length, // New field to track created participants
      });
    } catch (error) {
      console.error("Error mapping and marking attendance:", error);
    }
    setIsLoading(false);
  };

  // Handle editing participant details
  const handleEditParticipant = (participant, index) => {
    setEditingParticipant(index);
    setEditForm({
      name: participant.name || "",
      admissionNumber: participant.admissionNumber || "",
      rollNumber: participant.rollNumber || "",
      department: participant.department || "",
      year: participant.year || "",
    });
  };

  const handleSaveEdit = async () => {
    if (editingParticipant === null) return;

    try {
      const updatedParticipants = [...participants];
      updatedParticipants[editingParticipant] = {
        ...updatedParticipants[editingParticipant],
        name: editForm.name || "N/A",
        admissionNumber: editForm.admissionNumber || "N/A",
        rollNumber: editForm.rollNumber || "N/A",
        department: editForm.department || "N/A",
        year: editForm.year || "N/A",
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: userProfile?.name || "Unknown User",
        lastUpdatedById: userProfile?.id || "unknown",
      };

      // Update the activity with modified participants
      await unifiedActivitiesService.updateActivity(
        activity.id,
        { participants: updatedParticipants },
        { id: userProfile?.id, name: userProfile?.name }
      );

      setParticipants(updatedParticipants);
      setEditingParticipant(null);
      setEditForm({});
    } catch (error) {
      console.error("Error updating participant:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingParticipant(null);
    setEditForm({});
  };

  // Export functions
  const handleExportScannedAdmissions = () => {
    if (scannedAdmissions.length === 0) return;

    const csvContent = [
      ["Admission Number", "Scanned At", "Scanned By"],
      ...scannedAdmissions.map((item) => [
        item.admissionNumber,
        new Date(item.scannedAt).toLocaleString(),
        item.scannedByName || "Unknown",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanned-admissions-${activity.name || "activity"}-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportParticipants = () => {
    if (participants.length === 0) return;

    const csvContent = [
      [
        "Admission Number",
        "Name",
        "Roll Number",
        "Department",
        "Attendance",
        "Marked At",
        "Marked By",
      ],
      ...participants.map((participant) => [
        participant.admissionNumber || "",
        participant.name || "",
        participant.rollNumber || "",
        participant.department || "",
        participant.attendance ? "Present" : "Absent",
        participant.attendanceMarkedAt
          ? new Date(participant.attendanceMarkedAt).toLocaleString()
          : "",
        participant.attendanceMarkedByName || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-${activity.name || "activity"}-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle individual attendance toggling
  const handleToggleAttendance = async (participant, participantIndex) => {
    if (!canManageAttendance()) {
      alert("You don't have permission to manage attendance for this activity.");
      return;
    }

    try {
      setIsLoading(true);
      
      // Toggle attendance status
      const newAttendanceStatus = !participant.attendance;
      
      // Call the individual markAttendance function with enhanced logging
      await unifiedActivitiesService.markAttendance(
        activity.id,
        participant.admissionNumber,
        newAttendanceStatus,
        {
          id: userProfile?.id || 'unknown',
          name: userProfile?.name || 'Unknown User',
          email: userProfile?.email || 'unknown@email.com'
        }
      );

      // Refresh participants data
      await loadParticipants();
      
      // Show success message
      const statusText = newAttendanceStatus ? "present" : "absent";
      alert(`Successfully marked ${participant.name || participant.admissionNumber} as ${statusText}`);
      
    } catch (error) {
      console.error("Error toggling attendance:", error);
      alert(`Failed to update attendance: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const presentCount = participants.filter((p) => p.attendance).length;
  const totalParticipants = participants.length;

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <Card className="shadow-lg">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="flex justify-between items-start p-2">
              <div className="flex-1 pr-4">
                <CardTitle className="text-xl font-semibold flex items-center gap-3 mb-2">
                  <UserCheckIcon className="w-6 h-6" />
                  View Attendance
                </CardTitle>
                <CardDescription className="text-primary-foreground/80 leading-relaxed">
                  {activity.activityName || activity.name} •
                  {scannedAdmissions.length > 0 &&
                    ` ${scannedAdmissions.length} scanned admissions`}
                  {presentCount > 0 &&
                    ` • ${presentCount}/${totalParticipants} present`}
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

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          {canManageAttendance() && (
            <button
              onClick={() => setActiveTab("admissions")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === "admissions"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileTextIcon className="w-4 h-4 inline mr-2" />
              Scanned Admissions ({scannedAdmissions.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab("participants")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "participants"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheckIcon className="w-4 h-4 inline mr-2" />
            Participants ({participants.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "admissions" && canManageAttendance() && (
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg">Scanned Admissions</CardTitle>
                <CardDescription>
                  Admission numbers collected from QR scanning - map and mark as
                  present directly
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleExportScannedAdmissions}
                  variant="outline"
                  size="sm"
                  disabled={scannedAdmissions.length === 0}
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  onClick={handleMapAndMarkAttendance}
                  disabled={scannedAdmissions.length === 0 || isLoading}
                  size="sm"
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  {isLoading ? "Processing..." : "Map & Mark Present"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {scannedAdmissions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  No Scanned Admissions
                </p>
                <p>Go to Mark Attendance to scan admission numbers</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-32">Admission No.</TableHead>
                      <TableHead>Scanned At</TableHead>
                      <TableHead>Scanned By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedAdmissions.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono font-medium">
                          {item.admissionNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(item.scannedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.scannedByName || "Unknown"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "participants" && (
        <div className="space-y-6">
          {mappingResults && canManageAttendance() && (
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Latest Mapping Results
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircleIcon className="w-8 h-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-800">
                        {mappingResults.markedPresent || 0}
                      </div>
                      <div className="text-sm text-green-600">
                        Marked Present
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <UsersIcon className="w-8 h-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-800">
                        {mappingResults.alreadyInList || 0}
                      </div>
                      <div className="text-sm text-blue-600">
                        Already in List
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                    <XCircleIcon className="w-8 h-8 text-yellow-600" />
                    <div>
                      <div className="text-2xl font-bold text-yellow-800">
                        {mappingResults.notFound || 0}
                      </div>
                      <div className="text-sm text-yellow-600">Created with N/A</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <ClockIcon className="w-8 h-8 text-gray-600" />
                    <div>
                      <div className="text-2xl font-bold text-gray-800">
                        {mappingResults.total || 0}
                      </div>
                      <div className="text-sm text-gray-600">
                        Total Processed
                      </div>
                    </div>
                  </div>
                </div>

                {mappingResults.alreadyPresent > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>{mappingResults.alreadyPresent}</strong> students
                      were already marked present
                    </p>
                  </div>
                )}

                {mappingResults.notFound > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      Admission numbers not found in database - Created as participants with N/A details:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {mappingResults.notFoundNumbers.map((num, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-yellow-700 border-yellow-300"
                        >
                          {num}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-yellow-700 mt-2">
                      These participants have been added to the activity with their admission numbers. 
                      You can edit their details manually if needed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-lg">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">
                    Activity Participants
                  </CardTitle>
                  <CardDescription>
                    All participants and their attendance status for this
                    activity
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {presentCount} / {totalParticipants} Present
                  </Badge>
                  <Button
                    onClick={handleExportParticipants}
                    variant="outline"
                    size="sm"
                    disabled={participants.length === 0}
                  >
                    <DownloadIcon className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {participants.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <UserCheckIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Participants</p>
                  <p>Participants will appear here once attendance is marked</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-32">Admission No.</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Roll No.</TableHead>
                        <TableHead className="w-32">Department</TableHead>
                        <TableHead className="w-20">Year</TableHead>
                        <TableHead className="w-24 text-center">
                          Status
                        </TableHead>
                        <TableHead className="w-40">Marked At</TableHead>
                        {canManageAttendance() && (
                          <TableHead className="w-24 text-center">
                            Actions
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map((participant, index) => (
                        <TableRow 
                          key={index}
                          className={participant.notFoundInDatabase ? "bg-gray-50/50" : ""}
                        >
                          <TableCell className="font-mono font-medium">
                            {editingParticipant === index ? (
                              <input
                                type="text"
                                value={editForm.admissionNumber}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    admissionNumber: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Admission Number"
                              />
                            ) : (
                              participant.admissionNumber || "N/A"
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {editingParticipant === index ? (
                              <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    name: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Student Name"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                {participant.name || "N/A"}
                                {participant.notFoundInDatabase && (
                                  <Badge variant="outline" className="text-xs text-gray-600 border-gray-300 bg-gray-50">
                                    Manual Entry
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingParticipant === index ? (
                              <input
                                type="text"
                                value={editForm.rollNumber}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    rollNumber: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Roll Number"
                              />
                            ) : (
                              participant.rollNumber || "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingParticipant === index ? (
                              <input
                                type="text"
                                value={editForm.department}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    department: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Department"
                              />
                            ) : (
                              participant.department || "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingParticipant === index ? (
                              <input
                                type="text"
                                value={editForm.year}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    year: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Year"
                              />
                            ) : (
                              participant.year || "N/A"
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {canManageAttendance() ? (
                              <button
                                onClick={() => handleToggleAttendance(participant, index)}
                                disabled={isLoading}
                                className="cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Click to mark as ${participant.attendance ? 'absent' : 'present'}`}
                              >
                                {participant.attendance ? (
                                  <Badge
                                    variant="default"
                                    className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                                  >
                                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                                    Present
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600"
                                  >
                                    <ClockIcon className="h-4 w-4 mr-1" />
                                    Absent
                                  </Badge>
                                )}
                              </button>
                            ) : (
                              participant.attendance ? (
                                <Badge
                                  variant="default"
                                  className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                >
                                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                                  Present
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-2 py-1"
                                >
                                  <ClockIcon className="h-4 w-4 mr-1" />
                                  Absent
                                </Badge>
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {participant.attendanceMarkedAt
                              ? new Date(
                                  participant.attendanceMarkedAt
                                ).toLocaleString()
                              : "N/A"}
                          </TableCell>
                          {canManageAttendance() && (
                            <TableCell>
                              {editingParticipant === index ? (
                                <div className="flex gap-2">
                                  <Button
                                    onClick={handleSaveEdit}
                                    size="sm"
                                    variant="outline"
                                    className="h-10 w-10 p-0 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                                    title="Save changes"
                                  >
                                    <SaveIcon className="h-5 w-5" />
                                  </Button>
                                  <Button
                                    onClick={handleCancelEdit}
                                    size="sm"
                                    variant="outline"
                                    className="h-10 w-10 p-0 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                    title="Cancel editing"
                                  >
                                    <XIcon className="h-5 w-5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() =>
                                    handleEditParticipant(participant, index)
                                  }
                                  size="sm"
                                  variant="outline"
                                  className="h-10 w-10 p-0 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                                  title="Edit participant"
                                >
                                  <EditIcon className="h-5 w-5" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
