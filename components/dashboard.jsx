// components/dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { companiesService } from "../lib/companiesService";
// Import all necessary icons
import {
  UsersIcon,
  QrCodeIcon,
  CheckCircleIcon,
  CalendarIcon,
  MapPinIcon,
  EditIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  RefreshIcon,
  BuildingIcon,
  ChevronDownIcon,
} from "./icons";

export default function Dashboard({
  activities,
  dashboardTab = "active",
  setDashboardTab,
  onSelectActivity,
  onViewAttendance,
  onAddActivityClick,
  onEditActivity,
  onDeleteActivity,
  onChangeActivityStatus,
  isLoadingActivities,
  activitiesError,
  onRefresh,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  userProfile,
  // Optional callback to expose the debounced refresh function to parent
  onDashboardRefresh,
  // New callback to expose state control functions to parent
  onStateRefReady,
  // Navigation props
  pendingNavigation,
  onNavigationComplete,
}) {
  // State management
  const [viewMode, setViewMode] = useState("companies"); // "companies" or "activities"
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyActivities, setCompanyActivities] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingCompanyActivities, setIsLoadingCompanyActivities] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  
  // Recent activities state
  const [showRecentOnly, setShowRecentOnly] = useState(true); // Default to showing recent activities
  const [recentActivitiesLimit] = useState(10); // Number of recent activities to show
  
  // Debouncing and optimization states
  const refreshTimeoutRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Define data loading functions first
  const loadCompanies = useCallback(async () => {
    try {
      setIsLoadingCompanies(true);
      setCompaniesError("");
      
      // Load companies in their default order
      const companiesData = await companiesService.getCompaniesWithCounts();
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error loading companies:", error);
      setCompaniesError("Failed to load companies");
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  const loadCompanyActivities = useCallback(async (companyId, loadRecent = showRecentOnly) => {
    try {
      setIsLoadingCompanyActivities(true);
      const activities = await companiesService.getCompanyActivities(companyId);
      
      if (loadRecent) {
        // Sort by updatedAt descending and take only recent activities
        const sortedActivities = activities.slice().sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });
        // Take only the most recent activities
        const recentActivities = sortedActivities.slice(0, recentActivitiesLimit);
        setCompanyActivities(recentActivities);
      } else {
        // Show all activities in their default order
        setCompanyActivities(activities);
      }
    } catch (error) {
      console.error("Error loading company activities:", error);
      setCompanyActivities([]);
    } finally {
      setIsLoadingCompanyActivities(false);
    }
  }, [showRecentOnly, recentActivitiesLimit]);

  // Load companies on component mount - use empty dependency array to prevent infinite loops
  useEffect(() => {
    loadCompanies();
  }, []); // Empty dependency array to prevent infinite loops

  // Handle pending navigation from parent component
  useEffect(() => {
    if (pendingNavigation && companies.length > 0) {
      const { targetCompany, targetActivityId, targetView } = pendingNavigation;
      
      if (targetView === "activities" && targetCompany) {
        // Find the company by name
        const company = companies.find(c => c.name === targetCompany);
        if (company) {
          console.log(`🎯 [DASHBOARD] Executing pending navigation to ${targetCompany} activities`);
          setSelectedCompany(company);
          setViewMode("activities");
          loadCompanyActivities(company.id, showRecentOnly).then(() => {
            // Scroll to the target activity if specified
            if (targetActivityId) {
              setTimeout(() => {
                const activityElement = document.getElementById(`activity-${targetActivityId}`);
                if (activityElement) {
                  activityElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 200);
            }
          });
          
          // Notify parent that navigation is complete
          if (onNavigationComplete) {
            onNavigationComplete();
          }
        } else {
          console.warn(`🚨 [DASHBOARD] Company "${targetCompany}" not found for pending navigation`);
        }
      }
    }
  }, [pendingNavigation, companies, onNavigationComplete]);

  // Optimized debounced refresh function with better state management
  const debouncedRefresh = useCallback((delay = 500) => {
    // Clear any existing timeout to prevent multiple refreshes
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    const newTimeout = setTimeout(() => {
      // Prevent multiple concurrent refreshes
      if (!isRefreshing) {
        setIsRefreshing(true);
        
        const refreshPromises = [loadCompanies()];
        
        if (selectedCompany && viewMode === "activities") {
          refreshPromises.push(loadCompanyActivities(selectedCompany.id, showRecentOnly));
        }
        
        Promise.all(refreshPromises)
          .then(() => {
            // Refresh completed successfully
          })
          .catch((error) => {
            console.error("Error during debounced refresh:", error);
          })
          .finally(() => {
            setIsRefreshing(false);
          });
      }
    }, delay);
    
    refreshTimeoutRef.current = newTimeout;
  }, [selectedCompany, isRefreshing, viewMode, showRecentOnly]); // Remove function dependencies to prevent loops

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const handleCompanySelect = useCallback(async (company) => {
    try {
      setSelectedCompany(company);
      setViewMode("activities");
      await loadCompanyActivities(company.id, showRecentOnly);
    } catch (error) {
      console.error('Error selecting company:', error);
    }
  }, [loadCompanyActivities, showRecentOnly]);

  const handleBackToCompanies = () => {
    setViewMode("companies");
    setSelectedCompany(null);
    setCompanyActivities([]);
  };

  // Toggle between recent and all activities
  const handleToggleRecentActivities = useCallback(async () => {
    const newShowRecentOnly = !showRecentOnly;
    setShowRecentOnly(newShowRecentOnly);
    
    // Reload activities with the new mode if we're currently viewing activities
    if (selectedCompany && viewMode === "activities") {
      await loadCompanyActivities(selectedCompany.id, newShowRecentOnly);
    }
  }, [showRecentOnly, selectedCompany, viewMode, loadCompanyActivities]);

  // State control functions to be exposed to parent component
  const stateControlFunctions = useCallback(() => ({
    navigateToCompanyActivities: async (companyName, activityId) => {
      try {
        // Find the company by name
        const company = companies.find(c => c.name === companyName);
        if (company) {
          // Set the company and switch to activities view
          setSelectedCompany(company);
          setViewMode("activities");
          await loadCompanyActivities(company.id, showRecentOnly);
          
          // Optional: Scroll to the specific activity if needed
          if (activityId) {
            setTimeout(() => {
              const activityElement = document.getElementById(`activity-${activityId}`);
              if (activityElement) {
                activityElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
        } else {
          // Fallback: load companies first if not found
          await loadCompanies();
          const updatedCompany = companies.find(c => c.name === companyName);
          if (updatedCompany) {
            setSelectedCompany(updatedCompany);
            setViewMode("activities");
            await loadCompanyActivities(updatedCompany.id);
          }
        }
      } catch (error) {
        console.error('Error navigating to company activities:', error);
        // Fallback to companies view
        setViewMode("companies");
      }
    },
    setDashboardViewMode: setViewMode,
    setDashboardSelectedCompany: setSelectedCompany,
    loadDashboardCompanies: loadCompanies,
    loadDashboardCompanyActivities: loadCompanyActivities
  }), [companies]); // Only include companies dependency to prevent function loops

  // Expose state control functions to parent
  useEffect(() => {
    if (onStateRefReady) {
      onStateRefReady(stateControlFunctions());
    }
  }, [onStateRefReady, stateControlFunctions]);

  const statusStyles = {
    Active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "In Progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
    Completed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    Cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  // Check if user can manage activities (admin, cpc, or creator)
  const canManageActivity = (activity) => {
    if (!userProfile) return false;
    return (
      userProfile.role === "admin" ||
      userProfile.role === "cpc" ||
      activity.createdById === userProfile.id ||
      activity.createdBy === userProfile.name
    );
  };

  // Optimistic update for activity status changes with better state management
  const updateActivityStatusOptimistically = useCallback((activityId, newStatus) => {
    // Update in companyActivities if we're viewing activities
    if (viewMode === "activities" && companyActivities.length > 0) {
      setCompanyActivities(prev => 
        prev.map(activity => 
          activity.id === activityId 
            ? { ...activity, status: newStatus, updatedAt: new Date().toISOString() }
            : activity
        )
      );
    }
    
    // Also optimistically update the company counts in the companies list
    // This helps with immediate visual feedback when user goes back to companies view
    setCompanies(prev => prev.map(company => {
      // Find the activity in this company and update counts
      // This is a simplified update - the real counts will be updated by backend recalibration
      const updatedCompany = { ...company };
      
      // Note: We can't perfectly calculate the new counts without knowing the old status
      // But we can at least trigger a visual change. The real counts will come from backend.
      if (newStatus === "Active" && company.activeActivities !== undefined) {
        // Increment active count (approximation)
        updatedCompany.activeActivities = Math.max(0, (company.activeActivities || 0));
      } else if (newStatus === "Completed" && company.completedActivities !== undefined) {
        // Increment completed count (approximation)
        updatedCompany.completedActivities = Math.max(0, (company.completedActivities || 0));
      }
      
      return updatedCompany;
    }));
  }, [viewMode, companyActivities]);

  // Enhanced activity status change handler with single controlled refresh
  const handleActivityStatusChange = useCallback(async (activity, newStatus) => {
    // Prevent multiple simultaneous status changes
    if (isRefreshing) {
      return;
    }
    
    try {
      // Immediate optimistic update - update local state only
      updateActivityStatusOptimistically(activity.id, newStatus);
      
      // Set refreshing state to prevent multiple operations
      setIsRefreshing(true);
      
      // Call the parent's status change handler
      if (onChangeActivityStatus) {
        await onChangeActivityStatus(activity, newStatus);
      }
      
      // After the backend processes the change, do a single controlled refresh
      // Use a timeout to allow backend recalibration to complete, then refresh
      setTimeout(async () => {
        try {
          // Refresh data - but preserve current view state
          const currentView = viewMode;
          const currentCompany = selectedCompany;
          
          await loadCompanies();
          
          // Only refresh company activities if we're still in the same view
          if (currentView === "activities" && currentCompany) {
            await loadCompanyActivities(currentCompany.id);
          }
          
        } catch (refreshError) {
          console.error("Error during post-backend refresh:", refreshError);
        } finally {
          setIsRefreshing(false);
        }
      }, 2500); // 2.5 second delay for backend processing
      
    } catch (error) {
      console.error("Error changing activity status:", error);
      setIsRefreshing(false);
      
      // On error, do a quick refresh to revert optimistic changes
      setTimeout(async () => {
        try {
          if (viewMode === "activities" && selectedCompany) {
            await loadCompanyActivities(selectedCompany.id);
          }
          await loadCompanies();
        } catch (recoveryError) {
          console.error("Error during recovery refresh:", recoveryError);
        }
      }, 500);
    }
  }, [updateActivityStatusOptimistically, onChangeActivityStatus, viewMode, selectedCompany, loadCompanyActivities, loadCompanies, isRefreshing]);

  // Expose debounced refresh to parent component
  useEffect(() => {
    if (onDashboardRefresh && typeof onDashboardRefresh === 'function') {
      onDashboardRefresh(debouncedRefresh);
    }
  }, [onDashboardRefresh, debouncedRefresh]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/graduation-hat.svg"
            alt="Placerly Logo"
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Placerly</h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              {viewMode === "companies" 
                ? "Manage companies and their placement activities" 
                : `Activities for ${selectedCompany?.name || 'Selected Company'}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {viewMode === "activities" && (
            <Button onClick={handleBackToCompanies} variant="outline" className="w-full sm:w-auto">
              ← Back to Companies
            </Button>
          )}
          <Button onClick={onAddActivityClick} className="w-full sm:w-auto whitespace-nowrap">
            + Add Activity
          </Button>
        </div>
      </div>

      {/* View Mode: Companies */}
      {viewMode === "companies" && (
        <>
          {/* Companies Header */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">Companies</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span>Total: {companies.length} companies</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => debouncedRefresh(0)} // Immediate refresh when manually triggered
                disabled={isLoadingCompanies || isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshIcon className={`h-4 w-4 ${(isLoadingCompanies || isRefreshing) ? 'animate-spin' : ''}`} />
                {(isLoadingCompanies || isRefreshing) ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Companies Error State */}
          {companiesError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">Error Loading Companies</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{companiesError}</p>
              <Button onClick={loadCompanies} variant="outline" size="sm" className="mt-3">
                Try Again
              </Button>
            </div>
          )}

          {/* Companies Loading State */}
          {isLoadingCompanies && !companiesError && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">Loading companies...</p>
              </div>
            </div>
          )}

          {/* Companies Grid */}
          {!isLoadingCompanies && !companiesError && companies.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {companies.map((company) => (
                <Card 
                  key={company.id} 
                  className="hover:shadow-lg transition-all duration-200 group flex flex-col h-full border-gray-200 dark:border-gray-700"
                >
                  <CardHeader className="pb-2 sm:pb-3 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                        <BuildingIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold truncate">
                          {company.name}
                        </CardTitle>
                        {company.industry && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {company.industry}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {company.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {company.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {company.totalActivities || 0} Activities
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {company.activeActivities || 0} Active
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircleIcon className="h-4 w-4 text-purple-500" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {company.completedActivities || 0} Completed
                          </span>
                        </div>
                        {company.location && (
                          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <MapPinIcon className="h-4 w-4" />
                            <span className="truncate">{company.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompanySelect(company);
                        }}
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs"
                      >
                        View Activities ({company.totalActivities || 0})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Companies State */}
          {!isLoadingCompanies && !companiesError && companies.length === 0 && (
            <div className="text-center py-12">
              <BuildingIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No companies found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Companies will appear here once activities are organized.
              </p>
              <Button onClick={onAddActivityClick}>
                + Add Activity
              </Button>
            </div>
          )}
        </>
      )}

      {/* View Mode: Activities */}
      {viewMode === "activities" && selectedCompany && (
        <>
          {/* Activities Header */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">{selectedCompany.name} Activities</h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <span>
                  {showRecentOnly ? `Recent: ${companyActivities.length}/${recentActivitiesLimit}` : `Total: ${companyActivities.length}`} activities
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={handleToggleRecentActivities}
                disabled={isLoadingCompanyActivities || isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {showRecentOnly ? 'Show All' : 'Show Recent'}
              </Button>
              <Button
                onClick={() => debouncedRefresh(0)} // Immediate refresh when manually triggered
                disabled={isLoadingCompanyActivities || isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshIcon className={`h-4 w-4 ${(isLoadingCompanyActivities || isRefreshing) ? 'animate-spin' : ''}`} />
                {(isLoadingCompanyActivities || isRefreshing) ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Activities Loading State */}
          {isLoadingCompanyActivities && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <RefreshIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">Loading activities...</p>
              </div>
            </div>
          )}

          {/* Activities Grid */}
          {!isLoadingCompanyActivities && companyActivities.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {companyActivities.map((activity) => {
                const totalStudents = activity.totalParticipants || 0;
                const presentCount = activity.totalPresent || 0;

                return (
                  <Card 
                    key={activity.id} 
                    id={`activity-${activity.id}`}
                    className="hover:shadow-lg transition-all duration-200 cursor-pointer group flex flex-col h-full border-gray-200 dark:border-gray-700"
                  >
                    <CardHeader className="pb-2 sm:pb-3 flex-shrink-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm sm:text-base truncate text-gray-600 dark:text-gray-400">
                              {activity.activityType}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm font-medium truncate">
                              {activity.activityName}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={`text-xs sm:text-sm whitespace-nowrap ${statusStyles[activity.status] || statusStyles.Inactive}`}>
                          {activity.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-1 sm:gap-2 text-sm">
                          <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {new Date(activity.date).toLocaleDateString()}
                          </span>
                          {activity.time && (
                            <span className="text-gray-500 dark:text-gray-400">
                              • {activity.time}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 text-sm">
                          <MapPinIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {activity.mode === "Online" ? "Online" : activity.location || "TBD"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 text-sm">
                          <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            {presentCount}/{totalStudents} Present
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 sm:mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        {/* Primary Actions Row - Full Width */}
                        <div className="flex gap-2 mb-3">
                          {onViewAttendance && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewAttendance(activity);
                              }}
                              size="sm"
                              variant="default"
                              className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2.5 h-auto bg-blue-600 hover:bg-blue-700 text-white min-h-[38px]"
                            >
                              <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                              <span className="font-medium">View</span>
                            </Button>
                          )}

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectActivity(activity);
                            }}
                            size="sm"
                            variant="default"
                            className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2.5 h-auto bg-green-600 hover:bg-green-700 text-white min-h-[38px]"
                          >
                            <QrCodeIcon className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">Scan</span>
                          </Button>
                        </div>

                        {/* Secondary Actions - Edit + Dropdown */}
                        {canManageActivity(activity) && (
                          <div className="flex gap-2">
                            {/* Status Toggle Button - Medium */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = activity.status === "Active" ? "Inactive" : "Active";
                                handleActivityStatusChange(activity, newStatus);
                              }}
                              size="sm"
                              variant="outline"
                              className={`flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2.5 h-auto border-2 min-h-[36px] ${
                                activity.status === "Active" 
                                  ? "border-orange-300 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-900/20" 
                                  : "border-green-300 text-green-600 hover:text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
                              }`}
                              title={activity.status === "Active" ? "Pause Activity" : "Activate Activity"}
                            >
                              {activity.status === "Active" ? (
                                <PauseIcon className="h-4 w-4 flex-shrink-0" />
                              ) : (
                                <PlayIcon className="h-4 w-4 flex-shrink-0" />
                              )}
                              <span className="font-medium">
                                {activity.status === "Active" ? "Pause" : "Start"}
                              </span>
                            </Button>

                            {/* Edit Button - Larger */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditActivity(activity);
                              }}
                              size="sm"
                              variant="outline"
                              className="flex-[2] flex items-center justify-center gap-1.5 text-sm px-3 py-2.5 h-auto border-2 border-blue-300 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20 min-h-[36px]"
                            >
                              <EditIcon className="h-4 w-4 flex-shrink-0" />
                              <span className="font-medium">Edit</span>
                            </Button>

                            {/* Actions Dropdown - Click Triggered */}
                            <div className="relative">
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dropdownId = `dropdown-${activity.id}`;
                                  const dropdown = document.getElementById(dropdownId);
                                  if (dropdown) {
                                    dropdown.classList.toggle('hidden');
                                  }
                                }}
                                size="sm"
                                variant="outline"
                                className="px-2 py-2.5 h-auto border-2 border-gray-300 text-gray-600 hover:text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 min-h-[36px]"
                              >
                                <ChevronDownIcon className="h-4 w-4" />
                              </Button>
                              
                              {/* Dropdown Menu - Click Triggered */}
                              <div 
                                id={`dropdown-${activity.id}`}
                                className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 hidden"
                              >
                                <div className="py-1">
                                  {activity.status !== "Completed" && activity.status !== "Cancelled" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleActivityStatusChange(activity, "Completed");
                                        document.getElementById(`dropdown-${activity.id}`).classList.add('hidden');
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 text-left"
                                    >
                                      <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                                      Mark Complete
                                    </button>
                                  )}
                                  
                                  <hr className="my-1 border-gray-200 dark:border-gray-600" />
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteActivity(activity);
                                      document.getElementById(`dropdown-${activity.id}`).classList.add('hidden');
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 text-left"
                                  >
                                    <TrashIcon className="h-4 w-4 flex-shrink-0" />
                                    Delete Activity
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* No Activities State */}
          {!isLoadingCompanyActivities && companyActivities.length === 0 && (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No activities found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No activities found for {selectedCompany.name}. Create your first activity for this company.
              </p>
              <Button onClick={onAddActivityClick}>
                + Add Activity
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
