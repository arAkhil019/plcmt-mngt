// app/page.js
"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Script from "next/script";
import Image from "next/image";
import {
  QrCodeIcon,
  UsersIcon,
  ActivityIcon,
  LogOutIcon,
  MenuIcon,
  BuildingIcon,
  ChartIcon,
  CalendarIcon,
  CheckCircleIcon,
  UserIcon,
  PlusIcon,
  RefreshIcon,
  EditIcon,
  TrashIcon,
  MapPinIcon,
  ChevronDownIcon,
  CheckIcon,
  GraduationCapIcon,
  InfoIcon,
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
import PublicLanding from "../components/PublicLanding";
import UserManagement from "../components/UserManagement";
import StudentManagement from "../components/StudentManagement";
import ActivityLogsAdmin from "../components/ActivityLogsAdmin";
import AdminCompanyManager from "../components/admin-company-manager";
import AdminEmailManager from "../components/AdminEmailManager";
import AdminStudentInfoManager from "../components/AdminStudentInfoManager";
import ToastContainer from "../components/ToastContainer";
import ConfirmDialog from "../components/ConfirmDialog";
import ProgressDialog from "../components/ProgressDialog";
import PasswordSetupModal from "../components/PasswordSetupModal";

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

// Select Components
const Select = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);

  const handleSelect = (newValue) => {
    setSelectedValue(newValue);
    setIsOpen(false);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <div className="relative">
      {React.Children.map(children, child => 
        React.cloneElement(child, { 
          isOpen, 
          setIsOpen, 
          selectedValue, 
          onSelect: handleSelect 
        })
      )}
    </div>
  );
};

const SelectTrigger = ({ children, className = "", isOpen, setIsOpen }) => (
  <button
    onClick={() => setIsOpen(!isOpen)}
    className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 dark:focus:ring-gray-800 ${className}`}
  >
    {children}
    <svg
      className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>
);

const SelectValue = ({ placeholder = "Select...", selectedValue }) => (
  <span className="text-sm">
    {selectedValue || placeholder}
  </span>
);

const SelectContent = ({ children, isOpen, onSelect }) => {
  if (!isOpen) return null;
  
  return (
    <div className="absolute top-full left-0 z-50 w-full min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md animate-in fade-in-0 zoom-in-95 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50">
      {React.Children.map(children, child =>
        React.cloneElement(child, { onSelect })
      )}
    </div>
  );
};

const SelectItem = ({ children, value, onSelect }) => (
  <div
    onClick={() => onSelect(value)}
    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
  >
    {children}
  </div>
);

export default function Home() {
  const { user, userProfile, logout, loading } = useAuth();
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } =
    useToast();
  
  // Memoize UI components to prevent infinite re-renders
  const uiComponents = useMemo(() => ({
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
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  }), []);
  
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [dashboardTab, setDashboardTab] = useState("active"); // New state for dashboard tabs
  const [navigationStack, setNavigationStack] = useState([]); // Track navigation history for smart back navigation
  const [selectedCompany, setSelectedCompany] = useState(null); // Track current company context for back navigation
  const [dashboardStateRef, setDashboardStateRef] = useState(null); // Reference to dashboard state control functions
  const [pendingDashboardNavigation, setPendingDashboardNavigation] = useState(null); // Pending navigation for when dashboard mounts
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

  // Password setup dialog state
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  // Public landing login toggle
  const [showLogin, setShowLogin] = useState(false);

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

  // Single source of truth for navigation items (DRY for desktop + mobile)
  const navItems = useMemo(() => {
    const items = [
      {
        id: "dashboard",
        label: "Dashboard",
  icon: (props) => <ChartIcon {...props} className={`h-4 w-4 mr-2 ${props?.className || ''}`} />,
        roles: ["admin", "cpc", "placement_coordinator"],
      },
      {
        id: "users",
        label: "Users",
        icon: (props) => <UsersIcon {...props} className={`h-4 w-4 mr-2 ${props?.className || ''}`} />,
        roles: ["admin"],
      },
      {
        id: "students",
  label: "Students",
  icon: (props) => <GraduationCapIcon {...props} className={`h-4 w-4 mr-2 ${props?.className || ''}`} />,
        roles: ["admin"],
      },
      {
        id: "student-info",
        label: "Student Info",
        icon: (props) => <InfoIcon {...props} className={`h-4 w-4 mr-2 ${props?.className || ''}`} />,
        roles: ["admin", "cpc"],
      },
      {
        id: "logs",
        label: "Logs",
        icon: (props) => <ActivityIcon {...props} className={`h-4 w-4 mr-2 ${props?.className || ''}`} />,
        roles: ["admin"],
      },
      {
        id: "companies",
        label: "Companies",
        icon: (props) => <BuildingIcon {...props} className={`h-4 w-4 mr-2 ${props?.className || ''}`} />,
        roles: ["admin", "cpc"],
      },
    ];

    const role = userProfile?.role;
    return items.filter((it) => it.roles.includes(role));
  }, [userProfile?.role]);

  const handleNavClick = useCallback((id) => {
    setCurrentPage(id);
    setSelectedActivity(null);
    if (id === "dashboard") setDashboardTab("active");
    setMobileMenuOpen(false);
  }, [setCurrentPage, setSelectedActivity, setDashboardTab]);

  const handlePasswordSetupComplete = () => {
    setShowPasswordSetup(false);
    showSuccess('Password authentication set up successfully! You can now use email/password to login.');
  };

  // Reset to dashboard when user logs in
  useEffect(() => {
    if (user && userProfile && !loading) {
      setCurrentPage("dashboard");
      // Check if user needs to set up password (first-time login or credential mismatch)
      if (userProfile.isFirstLogin && !userProfile.hasPasswordAuth) {
        setShowPasswordSetup(true);
      } else if (userProfile.hasPasswordAuth && userProfile.isFirstLogin) {
        // This indicates a credential mismatch - Firestore shows password auth is set up
        // but user is still flagged as first login, suggesting credential linking failed
        setShowPasswordSetup(true);
      }
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
  }, [user, userProfile, loading]);

  // All hooks must be called before any return or conditional logic
  const hasPermission = (requiredRole) => {
    if (userProfile?.role === "admin" || userProfile?.role === "cpc") return true;
    if (requiredRole === "placement_coordinator") {
      return userProfile?.role === "placement_coordinator" || userProfile?.role === "cpc";
    }
    return true;
  };

  const canMarkAttendance = useCallback((activity) => {
    if (userProfile?.role === "admin" || userProfile?.role === "cpc") return true;
    if (activity.createdBy === userProfile?.id) return true;
    return activity.allowedUsers?.some((u) => u.id === userProfile?.id);
  }, [userProfile]);

  const handleSelectActivity = (activity) => {
    handleSelectActivityWithNavigation(activity);
  };

  // New handler specifically for viewing attendance (scanned admissions + participants)
  const handleViewAttendance = (activity) => {
    handleSelectActivityWithNavigation(activity, "view");
  };

  const handleEditActivity = (activity) => {
    // Only admins, CPCs, and placement coordinators can edit, and only their own activities (except admin/cpc)
    if (
      userProfile?.role !== "admin" &&
      userProfile?.role !== "cpc" &&
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
    if (!updatedActivity.company?.trim() || !updatedActivity.activityName?.trim() || !updatedActivity.date) {
      showError("Please enter a company name, activity name, and select a date.");
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
        // Update activity with company management
        const updated = await unifiedActivitiesService.updateActivityWithCompanyManagement(
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
          `Updated activity: ${updated.activityName} (${updated.company}) - ${updated.activityType}`,
          {
            activityName: updated.activityName,
            company: updated.company,
          }
        );

        setEditActivityModal({ isOpen: false, activity: null });
      }
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
      // Delete the activity using unified service with company management
      const result = await unifiedActivitiesService.deleteActivityWithCompanyManagement(
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
        `Deleted activity: ${activity.activityName || activity.name} (${activity.company || 'Unknown Company'}) - ${
          activity.activityType || "Activity"
        }`,
        {
          activityId: activity.id,
          activityName: activity.activityName || activity.name,
          company: activity.company,
          activityType: activity.activityType || "Activity",
          deletedParticipationRecords: result?.deletedParticipationRecords || 0,
        }
      );

      showSuccess(
        `Activity "${
          activity.activityName || activity.name
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
        activity.activityName || activity.name
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

          // Note: Don't call reloadActivities() here as it causes multiple refreshes
          // The dashboard component will handle its own optimized refresh
          // The unifiedActivitiesService.updateActivity already triggers company recalibration

          // Log the status change with detailed lifecycle information
          await activityLogsService.logActivityLifecycle(
            userProfile?.id,
            userProfile?.name,
            userProfile?.email,
            {
              activityId: activity.id,
              activityName: activity.activityName || activity.name,
              companyId: activity.id,
              companyName: activity.company,
              actionType: 'status_change',
              previousStatus: activity.status,
              newStatus: newStatus,
              changedFields: ['status'],
              previousValues: { status: activity.status },
              newValues: { status: newStatus },
              approvalRequired: false,
              reason: `Manual status change from ${activity.status} to ${newStatus}`
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
    setSelectedCompany(null);
    setNavigationStack([]);
  };

  // Smart navigation that keeps users in the activity context when appropriate
  const handleSmartBack = useCallback((fromPage, options = {}) => {
    const { forceBackToDashboard = false, activityUpdated = false } = options;
    
    // If activity was significantly updated (status change, etc), go back to dashboard
    if (forceBackToDashboard || activityUpdated) {
      handleBackToDashboard();
      return;
    }
    
    // Smart navigation based on current page
    switch (fromPage) {
      case "scanner":
        // From scanner, go to view attendance of the same activity
        if (selectedActivity) {
          setCurrentPage("view");
        } else {
          handleBackToCompanyActivities();
        }
        break;
        
      case "view":
        // From view, go back to company activities page
        handleBackToCompanyActivities();
        break;
        
      default:
        // Default behavior - go to dashboard
        handleBackToDashboard();
        break;
    }
  }, [selectedActivity]);

  // Navigate back to company activities page
  const handleBackToCompanyActivities = useCallback(() => {
    if (selectedActivity) {
      // Get the company and activity ID before clearing state
      const activityCompany = selectedActivity.company;
      const activityId = selectedActivity.id;
      
      // Set pending navigation state that the Dashboard will pick up when it mounts
      setPendingDashboardNavigation({
        targetCompany: activityCompany,
        targetActivityId: activityId,
        targetView: "activities"
      });
      
      // Clear selected activity and navigation stack
      setSelectedActivity(null);
      setNavigationStack([]);
      
      // Set the page to dashboard
      setCurrentPage("dashboard");
    } else {
      // Fallback to normal dashboard if no company context
      handleBackToDashboard();
    }
  }, [selectedActivity, dashboardStateRef]);

  // Enhanced activity selection with navigation tracking
  const handleSelectActivityWithNavigation = useCallback((activity, targetPage = null) => {
    // Check permissions before allowing access
    if (!canMarkAttendance(activity) && activity.status !== "Inactive") {
      showError(
        "You do not have permission to mark attendance for this activity."
      );
      return;
    }
    
    setSelectedActivity(activity);
    
    // Store company context for back navigation
    setSelectedCompany(activity.company);
    
    // Determine target page
    const newPage = targetPage || (activity.status === "Inactive" ? "view" : "scanner");
    setCurrentPage(newPage);
    
    // Track navigation history
    setNavigationStack(prev => [...prev, { page: newPage, activityId: activity.id, company: activity.company, timestamp: Date.now() }]);
  }, [canMarkAttendance]);

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
          
          // Try to lookup student details for better logging
          let studentDetails = null;
          try {
            const studentLookup = await studentsService.searchByAdmissionNumber(studentId);
            if (studentLookup.found) {
              studentDetails = studentLookup.student;
            }
          } catch (error) {
            console.warn("Could not lookup student details for duplicate scan:", error);
          }
          
          // Log duplicate scan attempt with enhanced details
          await activityLogsService.logAdmissionScanning(
            userProfile?.id || 'unknown',
            userProfile?.name || 'Unknown User',
            userProfile?.email || 'unknown@email.com',
            {
              admissionNumber: studentId,
              studentName: studentDetails?.name || 'Unknown',
              studentDepartment: studentDetails?.department || 'Unknown',
              studentYear: studentDetails?.year || 'Unknown',
              companyId: activity.id,
              companyName: activity.company,
              activityId: activity.id,
              activityName: activity.activityName,
              scanMethod: 'qr',
              scanResult: 'duplicate',
              previouslyScanned: true,
              scanDuration: null,
              updateType: 'scannedAdmissions', // Which field would have been updated
              totalScannedCount: currentScannedAdmissions.length, // Current count (no change)
              attemptedBy: userProfile?.name || 'Unknown User',
              attemptedAt: new Date().toISOString()
            }
          );
          
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

        // Try to lookup student details for better logging
        let studentDetails = null;
        try {
          const studentLookup = await studentsService.searchByAdmissionNumber(studentId);
          if (studentLookup.found) {
            studentDetails = studentLookup.student;
          }
        } catch (error) {
          console.warn("Could not lookup student details:", error);
        }

        // Log successful admission scanning with enhanced details
        await activityLogsService.logAdmissionScanning(
          userProfile?.id || 'unknown',
          userProfile?.name || 'Unknown User',
          userProfile?.email || 'unknown@email.com',
          {
            admissionNumber: studentId,
            studentName: studentDetails?.name || 'Unknown',
            studentDepartment: studentDetails?.department || 'Unknown',
            studentYear: studentDetails?.year || 'Unknown',
            companyId: activity.id,
            companyName: activity.company,
            activityId: activity.id,
            activityName: activity.activityName,
            scanMethod: 'qr',
            scanResult: 'success',
            previouslyScanned: false,
            scanDuration: null,
            updateType: 'scannedAdmissions', // Which field was updated
            totalScannedCount: updatedScannedAdmissions.length, // Total count after this scan
            scannedBy: userProfile?.name || 'Unknown User',
            scannedAt: new Date().toISOString()
          }
        );

        // Update local activity state instead of reloading all activities for minor updates
        const updatedActivity = { ...activity, scannedAdmissions: updatedScannedAdmissions };
        setSelectedActivity(updatedActivity);
        
        // Update the activity in the local activities array
        setActivities(prevActivities => 
          prevActivities.map(a => 
            a.id === activity.id 
              ? { ...a, scannedAdmissions: updatedScannedAdmissions }
              : a
          )
        );

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
    if (!newActivity.company?.trim() || !newActivity.activityName?.trim() || !newActivity.date) {
      showError("Please enter a company name, activity name, and select a date.");
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
              company: newActivity.company.trim(),
              activityName: newActivity.activityName.trim(),
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
            // This is safe since it only runs on user interaction, not during render
            const tempActivityId = `temp_activity_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

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
          company: newActivity.company.trim(),
          activityName: newActivity.activityName.trim(),
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

        // Log the activity creation with detailed lifecycle information
        await activityLogsService.logActivityLifecycle(
          userProfile?.id,
          userProfile?.name,
          userProfile?.email,
          {
            activityId: createdActivity.id,
            activityName: createdActivity.activityName,
            companyId: createdActivity.id, // In this system, activity ID serves as company reference
            companyName: createdActivity.company,
            actionType: 'create',
            newStatus: createdActivity.status || 'Active',
            changedFields: ['activityName', 'company', 'activityType', 'date', 'time', 'venue', 'status'],
            newValues: {
              activityName: createdActivity.activityName,
              company: createdActivity.company,
              activityType: createdActivity.activityType,
              date: createdActivity.date,
              time: createdActivity.time,
              venue: createdActivity.venue,
              status: createdActivity.status || 'Active'
            },
            approvalRequired: false,
            reason: 'New activity creation'
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
            name: newActivity.activityName,
            date: newActivity.date,
            ...newActivity, // Include all the activity data
          };
        } else {
          // For existing activities, provide minimal activity details for processing
          activityDetails = {
            id: activityId, // Use the Firestore document ID
            name: updatedActivity?.activityName || `Activity_${activityId}`,
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
              `✅ Successfully processed participants for ${activityDetails.activityName} (${activityDetails.company}):\n` +
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

  const DashboardWithUI = useCallback((props) => 
    <Dashboard {...props} {...uiComponents} />, [uiComponents]);
    
  const MarkAttendanceWithUI = useCallback((props) => (
    <MarkAttendance {...props} {...uiComponents} />
  ), [uiComponents]);
  
  const AttendanceViewWithUI = useCallback((props) => (
    <AttendanceView {...props} {...uiComponents} userProfile={userProfile} />
  ), [uiComponents, userProfile]);
  const ColumnMappingModalWithUI = useCallback((props) => (
    <ColumnMappingModal {...props} {...uiComponents} />
  ), [uiComponents]);
  
  const AddActivityModalWithUI = useCallback((props) => (
    <AddActivityModal {...props} {...uiComponents} />
  ), [uiComponents]);
  
  const EditActivityModalWithUI = useCallback((props) => (
    <EditActivityModal {...props} {...uiComponents} />
  ), [uiComponents]);
  
  const UserManagementWithUI = useCallback((props) => (
    <UserManagement {...props} {...uiComponents} />
  ), [uiComponents]);
  
  const StudentManagementWithUI = useCallback((props) => (
    <StudentManagement {...props} uiComponents={uiComponents} />
  ), [uiComponents]);
  
  const ActivityLogsWithUI = useCallback((props) => (
    <ActivityLogsAdmin {...props} />
  ), []);

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

  // Public landing page for unauthenticated users
  if (!user || !userProfile) {
    return showLogin ? (
      <LoginForm {...uiComponents} />
    ) : (
      <PublicLanding onLoginClick={() => setShowLogin(true)} />
    );
  }

  // Restrict logged-in access to PC/CPC/Admin only
  const allowedRoles = new Set(["admin", "cpc", "placement_coordinator"]);
  if (user && userProfile && !allowedRoles.has(userProfile?.role)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
        <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
          <nav className="container mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/globe.svg" alt="Placerly Logo" width={24} height={24} className="h-5 w-5 sm:h-6 sm:w-6 object-contain" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Placerly</h1>
            </div>
            <button className="h-9 px-3 rounded-md border border-gray-200 dark:border-gray-800 text-sm" onClick={handleLogout}>Logout</button>
          </nav>
        </header>
        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
          <div className="max-w-xl w-full text-center bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Login is restricted to Placement Coordinators (PC), Central Placement Coordinators (CPC), and Admins.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              You can continue browsing the public placement calendar without logging in.
            </p>
            <div className="mt-4">
              <a href="/" className="text-sm px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800">Go to Public Landing</a>
            </div>
          </div>
        </main>
      </div>
    );
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
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-gray-900 text-white text-sm px-3 py-1 rounded">Skip to content</a>
        <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
          <nav className="container mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between" aria-label="Main">
            <div className="flex items-center gap-2">
              <Image
                src="/graduation-hat.svg"
                alt="Placerly Logo"
                width={24}
                height={24}
                className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
              />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Placerly
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden lg:flex items-center gap-2 whitespace-nowrap overflow-x-auto">
                {navItems.map((item) => {
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "outline"}
                      onClick={() => handleNavClick(item.id)}
                      size="sm"
                      aria-current={isActive ? "page" : undefined}
                    >
                      {Icon ? <Icon /> : null}
                      {item.label}
                    </Button>
                  );
                })}
              </div>
              
              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle menu"
              >
                <MenuIcon className="h-4 w-4" />
              </Button>
              
              {/* Desktop User Profile */}
              <div className="hidden lg:flex items-center gap-2 border-l pl-2 sm:pl-4">
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
              <div className="lg:hidden flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOutIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </nav>
          
          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 px-3 py-2">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => {
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "outline"}
                      onClick={() => handleNavClick(item.id)}
                      size="sm"
                      className="justify-start"
                      aria-current={isActive ? "page" : undefined}
                    >
                      {Icon ? <Icon /> : null}
                      {item.label}
                    </Button>
                  );
                })}
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
        <main id="main-content" className="container mx-auto p-4 sm:p-6 lg:p-8">
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
              onStateRefReady={setDashboardStateRef}
              pendingNavigation={pendingDashboardNavigation}
              onNavigationComplete={() => setPendingDashboardNavigation(null)}
            />
          )}
          {currentPage === "users" && userProfile?.role === "admin" && (
            <UserManagementWithUI isXlsxScriptLoaded={isXlsxScriptLoaded} />
          )}
          {currentPage === "students" && userProfile?.role === "admin" && (
            <StudentManagementWithUI />
          )}
          {currentPage === "student-info" && userProfile?.role === "admin" && (
            <AdminStudentInfoManager
              Card={Card}
              CardHeader={CardHeader}
              CardTitle={CardTitle}
              CardDescription={CardDescription}
              CardContent={CardContent}
              Button={Button}
              Badge={Badge}
              userProfile={userProfile}
            />
          )}
          {currentPage === "companies" && (userProfile?.role === "admin" || userProfile?.role === "cpc") && (
            <AdminCompanyManager
              BuildingIcon={BuildingIcon}
              CalendarIcon={CalendarIcon}
              CheckCircleIcon={CheckCircleIcon}
              UserIcon={UserIcon}
              PlusIcon={PlusIcon}
              RefreshIcon={RefreshIcon}
              EditIcon={EditIcon}
              TrashIcon={TrashIcon}
              MapPinIcon={MapPinIcon}
              ChevronDownIcon={ChevronDownIcon}
              CheckIcon={CheckIcon}
              Card={Card}
              CardHeader={CardHeader}
              CardTitle={CardTitle}
              CardDescription={CardDescription}
              CardContent={CardContent}
              Button={Button}
              Badge={Badge}
              userProfile={userProfile}
            />
          )}
          {currentPage === "logs" && userProfile?.role === "admin" && (
            <ActivityLogsWithUI />
          )}
          {currentPage === "email-manager" && userProfile?.role === "admin" && (
            <AdminEmailManager 
              Card={Card}
              CardHeader={CardHeader}
              CardTitle={CardTitle}
              CardDescription={CardDescription}
              CardContent={CardContent}
              Button={Button}
            />
          )}
          {currentPage === "scanner" && selectedActivity && (
            <MarkAttendanceWithUI
              activity={selectedActivity}
              userProfile={userProfile}
              onBack={() => handleSmartBack("scanner")}
              onMarkAttendance={handleMarkAttendance}
              isScriptLoaded={isScannerScriptLoaded}
            />
          )}
          {currentPage === "view" && selectedActivity && (
            <AttendanceViewWithUI
              company={selectedActivity}
              onBack={() => handleSmartBack("view")}
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

      {/* Password Setup Modal */}
      <PasswordSetupModal
        Button={Button}
        isOpen={showPasswordSetup}
        onComplete={handlePasswordSetupComplete}
        userEmail={user?.email}
        showReset={userProfile?.hasPasswordAuth && userProfile?.isFirstLogin}
      />
    </>
  );
}
