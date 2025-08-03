// app/page.js
"use client";

import React, { useState, useCallback, useEffect } from "react";
import Script from "next/script";
import {
  QrCodeIcon,
  UsersIcon,
  ActivityIcon,
  LogOutIcon,
  MenuIcon,
} from "../components/icons";
import { useAuth } from "../contexts/AuthContext";
import { logActivity, ACTIVITY_TYPES } from "../utils/activityLogger";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { studentsService } from "../lib/studentsService";
import {
  activityLogsService,
  ACTIVITY_LOG_TYPES,
} from "../lib/activityLogsService";
import { useToast } from "../hooks/useToast";
import Dashboard from "../components/dashboard";
import MarkAttendance from "../components/markAttendance";
import AttendanceView from "../components/attendance-view";
import ColumnMappingModal from "../components/ColMapModal";
import AddActivityModal from "../components/AddActivityModal";
import EditActivityModal from "../components/EditActivityModal";
import LoginForm from "../components/LoginForm";
import UserManagement from "../components/UserManagement";
import StudentManagement from "../components/StudentManagement";
import ActivityLogs from "../components/ActivityLogs";
import ToastContainer from "../components/ToastContainer";
import ConfirmDialog from "../components/ConfirmDialog";
import ProgressDialog from "../components/ProgressDialog";

// UI Component Primitives
const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm ${className}`}
  >
    {children}
  </div>
);
const CardHeader = ({ children, className = "" }) => (
  <div className={`p-6 flex flex-col space-y-1.5 ${className}`}>{children}</div>
);
const CardTitle = ({ children, className = "" }) => (
  <h3
    className={`text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white ${className}`}
  >
    {children}
  </h3>
);
const CardDescription = ({ children, className = "" }) => (
  <p className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
    {children}
  </p>
);
const CardContent = ({ children, className = "" }) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);
const CardFooter = ({ children, className = "" }) => (
  <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>
);
const Button = ({
  children,
  onClick,
  className = "",
  variant = "default",
  as: Component = "button",
  disabled,
  size,
  title,
  type,
}) => {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950";
  const variantClasses = {
    default:
      "bg-gray-900 text-white hover:bg-gray-900/90 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90",
    outline:
      "border border-gray-200 bg-transparent hover:bg-gray-100 hover:text-gray-900 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-50",
  };
  const sizeClasses = {
    icon: "h-10 w-10",
    sm: "h-8 px-3 py-1",
    default: "h-10 px-4 py-2",
  };
  const finalSizeClasses = sizeClasses[size] || sizeClasses["default"];
  return (
    <Component
      onClick={onClick}
      disabled={disabled}
      title={title}
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${finalSizeClasses} ${className}`}
    >
      {children}
    </Component>
  );
};
const Table = ({ children, className = "" }) => (
  <div className="relative w-full overflow-auto">
    <table className={`w-full caption-bottom text-sm ${className}`}>
      {children}
    </table>
  </div>
);
const TableHeader = ({ children, className = "" }) => (
  <thead className={`[&_tr]:border-b ${className}`}>{children}</thead>
);
const TableBody = ({ children, className = "" }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`}>
    {children}
  </tbody>
);
const TableRow = ({ children, className = "" }) => (
  <tr
    className={`border-b transition-colors hover:bg-gray-100/50 data-[state=selected]:bg-gray-100 dark:hover:bg-gray-800/50 dark:data-[state=selected]:bg-gray-800 ${className}`}
  >
    {children}
  </tr>
);
const TableHead = ({ children, className = "" }) => (
  <th
    className={`h-12 px-4 text-left align-middle font-medium text-gray-500 [&:has([role=checkbox])]:pr-0 dark:text-gray-400 ${className}`}
  >
    {children}
  </th>
);
const TableCell = ({ children, className = "" }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </td>
);
const Badge = ({ children, className = "", variant = "default" }) => {
  const variantClasses = {
    default:
      "border-transparent bg-gray-900 text-gray-50 hover:bg-gray-900/80 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/80",
    success:
      "border-transparent bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    secondary:
      "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-800/80",
  };
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

const uiComponents = {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
};

export default function Home() {
  const { user, userProfile, logout, loading } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } =
    useToast();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [dashboardTab, setDashboardTab] = useState("active"); // New state for dashboard tabs
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState(null);
  const [isScannerScriptLoaded, setIsScannerScriptLoaded] = useState(false);
  const [isXlsxScriptLoaded, setIsXlsxScriptLoaded] = useState(false);
  const [colMapModalData, setColMapModalData] = useState({
    isOpen: false,
    activityId: null,
    file: null,
    headers: [],
  });
  const [isAddActivityModalOpen, setAddActivityModalOpen] = useState(false);
  const [editActivityModal, setEditActivityModal] = useState({
    isOpen: false,
    activity: null,
  });

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    type: "warning",
  });
  const [progressDialog, setProgressDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    progress: null,
  });

  // Helper functions for dialogs
  const showConfirmDialog = (title, message, onConfirm, type = "warning") => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  const hideConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      title: "",
      message: "",
      onConfirm: null,
      type: "warning",
    });
  };

  const showProgressDialog = (title, message, progress = null) => {
    setProgressDialog({ isOpen: true, title, message, progress });
  };

  const hideProgressDialog = () => {
    setProgressDialog({
      isOpen: false,
      title: "",
      message: "",
      progress: null,
    });
  };

  const updateProgressDialog = (progress) => {
    setProgressDialog((prev) => ({ ...prev, progress }));
  };

  // Reset to dashboard when user logs in
  useEffect(() => {
    if (user && userProfile && !loading) {
      setCurrentPage("dashboard");
    }
  }, [user, userProfile, loading]);

  // Load activities from Firebase when user is authenticated
  useEffect(() => {
    const loadActivities = async () => {
      if (user && userProfile && !loading) {
        try {
          setIsLoadingActivities(true);
          setActivitiesError(null);
          
          // Use unified service to get all activities
          const unifiedActivities =
            await unifiedActivitiesService.getAllActivities();

          // Sort activities by date (newest first)
          const sortedActivities = unifiedActivities.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );

          setActivities(sortedActivities);
        } catch (error) {
          console.error("Error loading activities:", error);
          setActivitiesError(`Failed to load activities: ${error.message}`);
          showError("Failed to load activities");
          setActivities([]);
        } finally {
          setIsLoadingActivities(false);
        }
      }
    };

    loadActivities();
  }, [user, userProfile, loading]);

  // Reusable function to reload activities from Firestore
  const reloadActivities = useCallback(async () => {
    if (user && userProfile && !loading) {
      try {
        setIsLoadingActivities(true);
        setActivitiesError(null);
        
        const unifiedActivities =
          await unifiedActivitiesService.getAllActivities();
        const sortedActivities = unifiedActivities.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setActivities(sortedActivities);
        showSuccess("Activities refreshed successfully");
      } catch (error) {
        console.error("Error reloading activities:", error);
        setActivitiesError(`Failed to reload activities: ${error.message}`);
        showError("Failed to reload activities");
        setActivities([]);
      } finally {
        setIsLoadingActivities(false);
      }
    }
  }, [user, userProfile, loading, showSuccess, showError]);

  // All hooks must be called before any return or conditional logic
  const hasPermission = (requiredRole) => {
    if (userProfile?.role === "admin") return true;
    if (requiredRole === "placement_coordinator") {
      return userProfile?.role === "placement_coordinator";
    }
    return true;
  };

  const canMarkAttendance = (activity) => {
    if (userProfile?.role === "admin") return true;
    if (activity.createdBy === userProfile?.id) return true;
    return activity.allowedUsers?.some((u) => u.id === userProfile?.id);
  };

  const handleSelectActivity = (activity) => {
    // Check permissions before allowing access
    if (!canMarkAttendance(activity) && activity.status !== "Inactive") {
      showError(
        "You do not have permission to mark attendance for this activity."
      );
      return;
    }
    setSelectedActivity(activity);
    if (activity.status === "Inactive") {
      setCurrentPage("view");
    } else {
      setCurrentPage("scanner");
    }
  };

  // New handler specifically for viewing attendance (scanned admissions + participants)
  const handleViewAttendance = (activity) => {
    setSelectedActivity(activity);
    setCurrentPage("view"); // Always go to attendance view regardless of status
  };

  const handleEditActivity = (activity) => {
    // Only admins and placement coordinators can edit, and only their own activities
    if (
      userProfile?.role !== "admin" &&
      (userProfile?.role !== "placement_coordinator" ||
        (activity.createdById !== userProfile?.id &&
          activity.createdBy !== userProfile?.name))
    ) {
      showError("You do not have permission to edit this activity.");
      return;
    }
    setEditActivityModal({ isOpen: true, activity });
  };

  const handleUpdateActivity = async (updatedActivity, uploadedFile) => {
    // First, validate that all required fields are filled
    if (!updatedActivity.companyName.trim() || !updatedActivity.date) {
      showError("Please enter a company name and select a date.");
      return;
    }

    try {
      if (uploadedFile) {
        // Process the uploaded file for student data update
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = window.XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
            });
            const headers = json[0] || [];
            setColMapModalData({
              isOpen: true,
              activityId: updatedActivity.id,
              file: uploadedFile,
              headers: headers,
              updatedActivity: updatedActivity,
            });
          } catch (error) {
            showError(
              "Failed to read the Excel file. Please ensure it's a valid Excel file (.xlsx or .xls)."
            );
          }
        };
        reader.readAsArrayBuffer(uploadedFile);
      } else {
        // Update activity without student data change
        const updated = await unifiedActivitiesService.updateActivity(
          updatedActivity.id,
          updatedActivity,
          { id: userProfile?.id, name: userProfile?.name }
        );

        // Reload activities from Firestore instead of local state update
        await reloadActivities();

        // Log the activity update
        await activityLogsService.logActivity(
          userProfile?.id,
          userProfile?.name,
          userProfile?.email,
          ACTIVITY_LOG_TYPES.UPDATE_ACTIVITY,
          `Updated activity: ${updated.companyName} - ${updated.activityType}`,
          {
            activityId: updated.id,
            companyName: updated.companyName,
            activityType: updated.activityType,
          }
        );
      }
      setEditActivityModal({ isOpen: false, activity: null });
    } catch (error) {
      showError("Failed to update activity. Please try again.");
    }
  };

  const handleDeleteActivity = async (activity) => {
    if (!userProfile) {
      console.error("No user profile available for deletion");
      return;
    }

    try {
      // Delete the activity using unified service
      const result = await unifiedActivitiesService.deleteActivity(
        activity.id,
        userProfile
      );

      // Refresh activities list to get updated data
      const updatedActivities = await unifiedActivitiesService.getAllActivities();
      setActivities(updatedActivities);

      // Log the activity deletion
      await activityLogsService.logActivity(
        userProfile?.id,
        userProfile?.name,
        userProfile?.email,
        ACTIVITY_LOG_TYPES.DELETE_ACTIVITY,
        `Deleted activity: ${activity.companyName || activity.name} - ${
          activity.activityType || "Activity"
        }`,
        {
          activityId: activity.id,
          companyName: activity.companyName || activity.name,
          activityType: activity.activityType || "Activity",
          deletedParticipationRecords: result?.deletedParticipationRecords || 0,
        }
      );

      showSuccess(
        `Activity "${
          activity.companyName || activity.name
        }" deleted successfully.${
          result?.deletedParticipationRecords 
            ? ` ${result.deletedParticipationRecords} participation records were also removed.`
            : ""
        }`
      );

      // Close the edit modal if it's open
      setEditActivityModal({ isOpen: false, activity: null });
    } catch (error) {
      console.error("Error in handleDeleteActivity:", error);
      showError(`Failed to delete activity: ${error.message}`);
    }
  };

  const handleChangeActivityStatus = async (activity, newStatus) => {
    if (!userProfile) return;

    // Show confirmation dialog
    showConfirmDialog(
      "Change Activity Status",
      `Are you sure you want to change "${
        activity.companyName || activity.name
      }" status to "${newStatus}"?`,
      async () => {
        try {
          // Determine if this is a new system activity (has participants) or old system
          // Update activity status using unified service
          await unifiedActivitiesService.updateActivity(
            activity.id,
            { ...activity, status: newStatus },
            { id: userProfile?.id, name: userProfile?.name }
          );

          // Reload activities from Firestore to get the updated state
          await reloadActivities();

          // Log the status change
          await activityLogsService.logActivity(
            userProfile?.id,
            userProfile?.name,
            userProfile?.email,
            ACTIVITY_LOG_TYPES.CHANGE_ACTIVITY_STATUS,
            `Changed activity status: ${
              activity.companyName || activity.name
            } from "${activity.status}" to "${newStatus}"`,
            {
              activityId: activity.id,
              companyName: activity.companyName || activity.name,
              activityType: activity.activityType || "Activity",
              oldStatus: activity.status,
              newStatus: newStatus,
            }
          );

          showSuccess(
            `Activity status changed to "${newStatus}" successfully.`
          );
        } catch (error) {
          showError(`Failed to change activity status: ${error.message}`);
        }
        hideConfirmDialog();
      },
      "info"
    );
  };

  const handleBackToDashboard = () => {
    setCurrentPage("dashboard");
    setSelectedActivity(null);
  };

  const handleMarkAttendance = useCallback(
    async (activityId, studentId) => {
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) {
        showError("Activity not found.");
        return;
      }

      // Check permissions first
      if (!canMarkAttendance(activity)) {
        showError(
          "You do not have permission to mark attendance for this activity."
        );
        return;
      }

      try {
        // Check for temporary/incomplete activities
        if (
          activity.id?.startsWith("temp_") ||
          (activity.id?.startsWith("activity_") && activity.id.length > 20)
        ) {
          throw new Error(
            "This activity appears to be incompletely created. Please refresh the page and try again."
          );
        }

        // NEW WORKFLOW: Add scanned admission number to scannedAdmissions list
        const currentActivity = await unifiedActivitiesService.getActivityById(activity.id);
        const currentScannedAdmissions = currentActivity.scannedAdmissions || [];
        
        // Normalize the scanned student ID for consistent comparison
        const normalizedStudentId = String(studentId).trim().toUpperCase();
        
        // Check if already scanned
        const alreadyScanned = currentScannedAdmissions.some(
          item => String(item.admissionNumber).trim().toUpperCase() === normalizedStudentId
        );
        
        if (alreadyScanned) {
          showWarning(`Admission number ${studentId} has already been scanned.`);
          return;
        }

        // Add to scanned admissions
        const newScannedAdmission = {
          admissionNumber: studentId,
          scannedAt: new Date().toISOString(),
          scannedBy: userProfile?.id || "unknown",
          scannedByName: userProfile?.name || "Unknown User"
        };

        const updatedScannedAdmissions = [...currentScannedAdmissions, newScannedAdmission];

        // Update activity with new scanned admission
        await unifiedActivitiesService.updateActivity(
          activity.id,
          { scannedAdmissions: updatedScannedAdmissions },
          userProfile
        );

        // Reload activities to reflect changes
        await reloadActivities();

        showSuccess(`Admission number ${studentId} scanned successfully. Use "View Attendance" to map and mark students as present.`);
      } catch (error) {
        console.error("Error handling mark attendance:", error);
        showError(`Failed to scan admission number: ${error.message}`);
      }
    },
    [
      activities,
      userProfile,
      canMarkAttendance,
      reloadActivities,
      showError,
      showWarning,
      showSuccess,
    ]
  );

  const handleAddActivity = async (newActivity, uploadedFile) => {
    // Only admins and placement coordinators can create activities
    if (!hasPermission("placement_coordinator")) {
      showError("You do not have permission to create activities.");
      return;
    }
    // First, validate that all required fields are filled
    if (!newActivity.companyName.trim() || !newActivity.date) {
      showError("Please enter a company name and select a date.");
      return;
    }

    try {
      if (uploadedFile) {
        // Process the uploaded file for student data using the new unified system
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = window.XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
            });
            const headers = json[0] || [];

            // Clean the activity data before processing
            const cleanActivityData = {
              companyName: newActivity.companyName.trim(),
              activityType: newActivity.activityType,
              interviewRound: newActivity.interviewRound || 1,
              date: newActivity.date,
              time: newActivity.time || "",
              mode: newActivity.mode,
              location: newActivity.location.trim(),
              eligibleDepartments: newActivity.eligibleDepartments || [],
              spocName: newActivity.spocName.trim(),
              spocContact: newActivity.spocContact.trim(),
              status: newActivity.status || "Active",
              allowedUsers: newActivity.allowedUsers || [],
            };

            // Generate a temporary activity ID for the column mapping process
            const tempActivityId = `temp_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;

            setColMapModalData({
              isOpen: true,
              activityId: tempActivityId,
              file: uploadedFile,
              headers: headers,
              newActivity: cleanActivityData,
            });
          } catch (error) {
            showError(
              "Failed to process the Excel file or create activity. Please check the file format and try again."
            );
          }
        };
        reader.readAsArrayBuffer(uploadedFile);
      } else {
        // For activities without files, create directly using the old system
        const cleanActivityData = {
          companyName: newActivity.companyName.trim(),
          activityType: newActivity.activityType,
          interviewRound: newActivity.interviewRound || 1,
          date: newActivity.date,
          time: newActivity.time || "",
          mode: newActivity.mode,
          location: newActivity.location.trim(),
          eligibleDepartments: newActivity.eligibleDepartments || [],
          spocName: newActivity.spocName.trim(),
          spocContact: newActivity.spocContact.trim(),
          status: newActivity.status || "Active",
          allowedUsers: newActivity.allowedUsers || [],
        };

        // Create activity using unified service
        const createdActivity = await unifiedActivitiesService.createActivity(
          cleanActivityData,
          { id: userProfile?.id, name: userProfile?.name }
        );

        // Reload activities to get the updated list
        await reloadActivities();

        // Log the activity creation
        await activityLogsService.logActivity(
          userProfile?.id,
          userProfile?.name,
          userProfile?.email,
          ACTIVITY_LOG_TYPES.CREATE_ACTIVITY,
          `Created activity: ${createdActivity.companyName} - ${createdActivity.activityType}`,
          {
            activityId: createdActivity.id,
            companyName: createdActivity.companyName,
            activityType: createdActivity.activityType,
          }
        );
      }
    } catch (error) {
      showError("Failed to create activity. Please try again.");
    }
  };

  const handleFileUpload = (activityId, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = json[0] || [];
        setColMapModalData({ isOpen: true, activityId, file, headers });
      } catch (error) {
        showError("Failed to read the Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleColMapModalClose = () => {
    setColMapModalData({
      isOpen: false,
      activityId: null,
      file: null,
      headers: [],
      newActivity: null,
      updatedActivity: null,
    });
  };

  const handleColumnMappingSubmit = async (mapping) => {
    const { activityId, file, newActivity, updatedActivity } = colMapModalData;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet);

        // Extract participants with name and roll number
        const participants = json
          .map((row, index) => {
            // Skip empty rows
            if (!row || Object.keys(row).length === 0) return null;

            const studentName = String(row[mapping.name] || "").trim();
            const rollNumber = String(row[mapping.rollNumber] || "").trim();

            // Skip rows with empty essential data
            if (!studentName || !rollNumber) {
              return null;
            }

            return {
              name: studentName,
              rollNumber: rollNumber,
              sheetName: sheetName,
            };
          })
          .filter((participant) => participant !== null); // Remove null entries

        if (participants.length === 0) {
          showError(
            "No valid participants found in the Excel file. Please ensure you have Name and Roll Number columns with data."
          );
          return;
        }

        // Process participants using activity participation service to find admission numbers
        let activityDetails;

        if (newActivity) {
          // For new activities, we'll let the service generate the proper ID
          // Don't generate another temporary ID here
          activityDetails = {
            // Don't set an ID here - let the service create it properly
            name: newActivity.companyName,
            date: newActivity.date,
            ...newActivity, // Include all the activity data
          };
        } else {
          // For existing activities, provide minimal activity details for processing
          activityDetails = {
            id: activityId, // Use the Firestore document ID
            name: updatedActivity?.companyName || `Activity_${activityId}`,
            date:
              updatedActivity?.date || new Date().toISOString().split("T")[0],
          };
        }

        // Show processing message
        const processingMessage = `Processing ${participants.length} participants...\nSearching for student details in database.\nThis may take a few minutes for large files.\nPlease do not close this window.`;

        // Show progress dialog
        showProgressDialog(
          "Processing Participants",
          processingMessage,
          null // Indeterminate progress
        );

        // Extract roll numbers for batch search
        const rollNumbers = participants.map(p => p.rollNumber);
        
        // Use optimized batch search to find student details
        const searchResults = await studentsService.batchSearchByRollNumbers(rollNumbers);
        
        // Transform participants with found student data
        const participantsList = participants.map((participant) => {
          // Find matching student data from search results
          const foundStudent = searchResults.found.find(result => 
            result.rollNumber === participant.rollNumber
          );
          
          if (foundStudent && foundStudent.student) {
            // Use complete student data from database
            return {
              name: foundStudent.student.name || "N/A",
              rollNumber: foundStudent.student.rollNumber || "N/A",
              admissionNumber: foundStudent.student.admissionNumber || "N/A",
              department: foundStudent.student.department || "N/A",
              departmentCode: foundStudent.student.departmentCode || "N/A",
              year: foundStudent.student.year || "N/A",
              addedAt: new Date().toISOString(),
              addedBy: userProfile?.name || 'Unknown User',
              addedById: userProfile?.id || 'unknown',
              attendance: false, // Initialize attendance as false
              fromExcel: true, // Mark as added from Excel
            };
          } else {
            // Use data from Excel file if student not found in database
            return {
              name: participant.name || "N/A",
              rollNumber: participant.rollNumber || "N/A",
              admissionNumber: "N/A", // Will be empty for students not found in database
              department: "N/A",
              departmentCode: "N/A",
              year: "N/A",
              addedAt: new Date().toISOString(),
              addedBy: userProfile?.name || 'Unknown User',
              addedById: userProfile?.id || 'unknown',
              attendance: false,
              fromExcel: true,
              notFoundInDatabase: true, // Mark as not found in database
            };
          }
        }).filter(p => p.name && p.rollNumber); // Filter out incomplete records

        // Update progress message with search results
        const foundCount = searchResults.summary.found;
        const notFoundCount = searchResults.summary.notFound;
        updateProgressDialog(`Found ${foundCount} students in database, ${notFoundCount} not found. Adding participants...`);

        try {
          let savedActivity;

          if (newActivity) {
            // Create new activity with participant details
            savedActivity = await unifiedActivitiesService.createActivity(
              activityDetails,
              userProfile
            );

            // Add participants to the activity
            const result = await unifiedActivitiesService.addParticipants(
              savedActivity.id,
              participantsList,
              userProfile
            );

            // Show detailed success message
            hideProgressDialog();
            showSuccess(
              `✅ Successfully processed participants for ${activityDetails.companyName}:\n` +
              `• ${result.added} new students added\n` +
              `• ${result.updated} existing students updated\n` +
              `• ${result.duplicates} duplicates skipped\n` +
              `• ${searchResults.summary.notFound} students not found in database`
            );
          } else {
            // Update existing activity with new participant details
            if (!activityId || typeof activityId !== "string") {
              throw new Error(`Invalid activity ID for update: ${activityId}`);
            }

            const result = await unifiedActivitiesService.addParticipants(
              activityId,
              participantsList,
              userProfile
            );

            // Show detailed success message
            hideProgressDialog();
            showSuccess(
              `✅ Successfully processed participants:\n` +
              `• ${result.added} new students added\n` +
              `• ${result.updated} existing students updated\n` +
              `• ${result.duplicates} duplicates skipped\n` +
              `• ${searchResults.summary.notFound} students not found in database`
            );
          }

          // Update activities list
          if (newActivity) {
            // Remove any temporary activities and reload
            setActivities((prev) =>
              prev.filter((a) => !a.id.startsWith("temp_"))
            );
            await reloadActivities();
          } else {
            // Reload activities from Firestore instead of local state update
            await reloadActivities();
          }

        } catch (processingError) {
          hideProgressDialog();
          showError(
            `Failed to process participants: ${processingError.message}`
          );
        }

        handleColMapModalClose();
      } catch (error) {
        hideProgressDialog();
        showError("Failed to process the Excel file or update the database.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const DashboardWithUI = (props) => <Dashboard {...props} {...uiComponents} />;
  const MarkAttendanceWithUI = (props) => (
    <MarkAttendance {...props} {...uiComponents} />
  );
  const AttendanceViewWithUI = (props) => (
    <AttendanceView {...props} {...uiComponents} userProfile={userProfile} />
  );
  const ColumnMappingModalWithUI = (props) => (
    <ColumnMappingModal {...props} {...uiComponents} />
  );
  const AddActivityModalWithUI = (props) => (
    <AddActivityModal {...props} {...uiComponents} />
  );
  const EditActivityModalWithUI = (props) => (
    <EditActivityModal {...props} {...uiComponents} />
  );
  const UserManagementWithUI = (props) => (
    <UserManagement {...props} {...uiComponents} />
  );
  const StudentManagementWithUI = (props) => (
    <StudentManagement {...props} uiComponents={uiComponents} />
  );
  const ActivityLogsWithUI = (props) => (
    <ActivityLogs {...props} {...uiComponents} />
  );

  const handleLogout = async () => {
    try {
      await logActivity(
        userProfile?.id,
        userProfile?.name,
        userProfile?.email,
        ACTIVITY_TYPES.LOGOUT,
        "User logged out"
      );
      // Reset page state before logout
      setCurrentPage("dashboard");
      setSelectedActivity(null);
      await logout();
    } catch (error) {
      // Error is handled by Firebase auth system
    }
  };

  // Show loading screen while authentication is loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <div className="text-center">
          <QrCodeIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if user is not authenticated
  if (!user || !userProfile) {
    return <LoginForm {...uiComponents} />;
  }

  return (
    <>
      <Script
        src="https://unpkg.com/html5-qrcode"
        strategy="afterInteractive"
        onLoad={() => setIsScannerScriptLoaded(true)}
      />
      <Script
        src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"
        strategy="afterInteractive"
        onLoad={() => setIsXlsxScriptLoaded(true)}
      />
      <ColumnMappingModalWithUI
        isOpen={colMapModalData.isOpen}
        onClose={handleColMapModalClose}
        headers={colMapModalData.headers}
        onSubmit={handleColumnMappingSubmit}
      />
      <AddActivityModalWithUI
        isOpen={isAddActivityModalOpen}
        onClose={() => setAddActivityModalOpen(false)}
        onSubmit={handleAddActivity}
        onFileUpload={handleFileUpload}
        isXlsxScriptLoaded={isXlsxScriptLoaded}
      />
      <EditActivityModalWithUI
        isOpen={editActivityModal.isOpen}
        onClose={() => setEditActivityModal({ isOpen: false, activity: null })}
        onSubmit={handleUpdateActivity}
        onDelete={handleDeleteActivity}
        onFileUpload={handleFileUpload}
        activity={editActivityModal.activity}
        onShowConfirmDialog={showConfirmDialog}
      />
      <div className="bg-gray-50 dark:bg-black min-h-screen text-gray-800 dark:text-gray-200 font-sans">
        <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
          <nav className="container mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="/graduation-hat.svg"
                alt="Placerly Logo"
                className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
              />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Placerly
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant={currentPage === "dashboard" ? "default" : "outline"}
                  onClick={() => {
                    setCurrentPage("dashboard");
                    setDashboardTab("active"); // Reset to active tab
                    setSelectedActivity(null);
                  }}
                  size="sm"
                >
                  Dashboard
                </Button>
                {userProfile?.role === "admin" && (
                  <>
                    <Button
                      variant={currentPage === "users" ? "default" : "outline"}
                      onClick={() => {
                        setCurrentPage("users");
                        setSelectedActivity(null);
                      }}
                      size="sm"
                    >
                      <UsersIcon className="h-4 w-4 mr-2" />
                      Users
                    </Button>
                    <Button
                      variant={
                        currentPage === "students" ? "default" : "outline"
                      }
                      onClick={() => {
                        setCurrentPage("students");
                        setSelectedActivity(null);
                      }}
                      size="sm"
                    >
                      🎓 Students
                    </Button>
                    <Button
                      variant={currentPage === "logs" ? "default" : "outline"}
                      onClick={() => {
                        setCurrentPage("logs");
                        setSelectedActivity(null);
                      }}
                      size="sm"
                    >
                      <ActivityIcon className="h-4 w-4 mr-2" />
                      Logs
                    </Button>
                  </>
                )}
              </div>
              
              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <MenuIcon className="h-4 w-4" />
              </Button>
              
              {/* Desktop User Profile */}
              <div className="hidden sm:flex items-center gap-2 border-l pl-2 sm:pl-4">
                <div className="text-xs sm:text-sm">
                  <div className="font-medium truncate max-w-24 sm:max-w-none">{userProfile?.name}</div>
                  <div className="text-gray-500 capitalize">
                    {userProfile?.role?.replace("_", " ")}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOutIcon className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Mobile User Profile */}
              <div className="sm:hidden flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOutIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </nav>
          
          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-3 py-2">
              <div className="flex flex-col gap-2">
                <Button
                  variant={currentPage === "dashboard" ? "default" : "outline"}
                  onClick={() => {
                    setCurrentPage("dashboard");
                    setDashboardTab("active"); // Reset to active tab
                    setSelectedActivity(null);
                    setMobileMenuOpen(false);
                  }}
                  size="sm"
                  className="justify-start"
                >
                  Dashboard
                </Button>
                {userProfile?.role === "admin" && (
                  <>
                    <Button
                      variant={currentPage === "users" ? "default" : "outline"}
                      onClick={() => {
                        setCurrentPage("users");
                        setSelectedActivity(null);
                        setMobileMenuOpen(false);
                      }}
                      size="sm"
                      className="justify-start"
                    >
                      <UsersIcon className="h-4 w-4 mr-2" />
                      Users
                    </Button>
                    <Button
                      variant={
                        currentPage === "students" ? "default" : "outline"
                      }
                      onClick={() => {
                        setCurrentPage("students");
                        setSelectedActivity(null);
                        setMobileMenuOpen(false);
                      }}
                      size="sm"
                      className="justify-start"
                    >
                      🎓 Students
                    </Button>
                    <Button
                      variant={currentPage === "logs" ? "default" : "outline"}
                      onClick={() => {
                        setCurrentPage("logs");
                        setSelectedActivity(null);
                        setMobileMenuOpen(false);
                      }}
                      size="sm"
                      className="justify-start"
                    >
                      <ActivityIcon className="h-4 w-4 mr-2" />
                      Logs
                    </Button>
                  </>
                )}
                <div className="border-t pt-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400 px-3 py-1">
                    {userProfile?.name}
                  </div>
                  <div className="text-xs text-gray-500 px-3 pb-2 capitalize">
                    {userProfile?.role?.replace("_", " ")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>
        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          {currentPage === "dashboard" && (
            <DashboardWithUI
              activities={activities}
              dashboardTab={dashboardTab}
              setDashboardTab={setDashboardTab}
              onSelectActivity={handleSelectActivity}
              onViewAttendance={handleViewAttendance}
              onAddActivityClick={() =>
                hasPermission("placement_coordinator")
                  ? setAddActivityModalOpen(true)
                  : showError("Access denied")
              }
              onEditActivity={handleEditActivity}
              onDeleteActivity={handleDeleteActivity}
              onChangeActivityStatus={handleChangeActivityStatus}
              userProfile={userProfile}
              userRole={userProfile?.role}
              userId={userProfile?.id}
              isLoadingActivities={isLoadingActivities}
              activitiesError={activitiesError}
              onRefresh={reloadActivities}
            />
          )}
          {currentPage === "users" && userProfile?.role === "admin" && (
            <UserManagementWithUI />
          )}
          {currentPage === "students" && userProfile?.role === "admin" && (
            <StudentManagementWithUI />
          )}
          {currentPage === "logs" && userProfile?.role === "admin" && (
            <ActivityLogsWithUI />
          )}
          {currentPage === "scanner" && selectedActivity && (
            <MarkAttendanceWithUI
              activity={selectedActivity}
              userProfile={userProfile}
              onBack={handleBackToDashboard}
              onMarkAttendance={handleMarkAttendance}
              isScriptLoaded={isScannerScriptLoaded}
            />
          )}
          {currentPage === "view" && selectedActivity && (
            <AttendanceViewWithUI
              company={selectedActivity}
              onBack={handleBackToDashboard}
            />
          )}
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={hideConfirmDialog}
        Button={Button}
      />

      {/* Progress Dialog */}
      <ProgressDialog
        isOpen={progressDialog.isOpen}
        title={progressDialog.title}
        message={progressDialog.message}
        progress={progressDialog.progress}
        onCancel={hideProgressDialog}
        Button={Button}
      />
    </>
  );
}
