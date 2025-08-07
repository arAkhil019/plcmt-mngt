// components/dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { companiesService } from "../lib/companiesService";
import CompanyManagementModal from "./CompanyManagementModal";
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
  PlusIcon,
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
}) {
  // State management
  const [viewMode, setViewMode] = useState("companies"); // "companies" or "activities"
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyActivities, setCompanyActivities] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingCompanyActivities, setIsLoadingCompanyActivities] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  
  // Company management state
  const [showCompanyManagement, setShowCompanyManagement] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  
  // Lazy loading state
  const [lastCompanyDoc, setLastCompanyDoc] = useState(null);
  const [hasMoreCompanies, setHasMoreCompanies] = useState(true);
  const [loadingMoreCompanies, setLoadingMoreCompanies] = useState(false);
  
  // Debouncing and optimization states
  const refreshTimeoutRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Define data loading functions first
  const loadCompanies = useCallback(async (loadMore = false) => {
    try {
      if (!loadMore) {
        setIsLoadingCompanies(true);
        setCompaniesError("");
      } else {
        setLoadingMoreCompanies(true);
      }
      
      // Use lazy loading for initial load and load more
      const result = await companiesService.getCompaniesWithLazyLoading(
        10, // Load 10 companies at a time
        loadMore ? lastCompanyDoc : null
      );
      
      if (loadMore) {
        setCompanies(prev => [...prev, ...result.companies]);
      } else {
        setCompanies(result.companies);
      }
      
      setLastCompanyDoc(result.lastVisible);
      setHasMoreCompanies(result.hasMore);
    } catch (error) {
      console.error("Error loading companies:", error);
      if (!loadMore) {
        setCompaniesError("Failed to load companies");
      }
    } finally {
      if (loadMore) {
        setLoadingMoreCompanies(false);
      } else {
        setIsLoadingCompanies(false);
      }
    }
  }, []); // Remove lastCompanyDoc dependency to prevent infinite loop

  const loadCompanyActivities = useCallback(async (companyId) => {
    try {
      setIsLoadingCompanyActivities(true);
      const activities = await companiesService.getCompanyActivities(companyId);
      setCompanyActivities(activities);
    } catch (error) {
      console.error("Error loading company activities:", error);
      setCompanyActivities([]);
    } finally {
      setIsLoadingCompanyActivities(false);
    }
  }, []);

  // Load companies on component mount
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

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
          refreshPromises.push(loadCompanyActivities(selectedCompany.id));
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
  }, [selectedCompany, isRefreshing, viewMode, loadCompanyActivities]); // Remove loadCompanies to prevent loops

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
      await loadCompanyActivities(company.id);
    } catch (error) {
      console.error('Error selecting company:', error);
    }
  }, [loadCompanyActivities]);

  const handleBackToCompanies = () => {
    setViewMode("companies");
    setSelectedCompany(null);
    setCompanyActivities([]);
  };

  // Company management functions
  const handleAddCompany = () => {
    setEditingCompany(null);
    setShowCompanyManagement(true);
  };

  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setShowCompanyManagement(true);
  };

  const handleDeleteCompany = async (companyId) => {
    if (!userProfile || (userProfile.role !== "admin" && userProfile.role !== "cpc")) {
      alert("Only administrators can delete companies");
      return;
    }

    if (window.confirm("Are you sure you want to delete this company? This action cannot be undone.")) {
      try {
        await companiesService.deleteCompany(companyId, userProfile.id);
        await loadCompanies(); // Refresh the companies list
      } catch (error) {
        console.error("Error deleting company:", error);
        alert("Failed to delete company. Please try again.");
      }
    }
  };

  const handleCompanyManagementClose = () => {
    setShowCompanyManagement(false);
    setEditingCompany(null);
  };

  const handleCompanyManagementSuccess = async () => {
    await loadCompanies(); // Refresh the companies list
    handleCompanyManagementClose();
  };

  const handleLoadMoreCompanies = () => {
    if (hasMoreCompanies && !loadingMoreCompanies) {
      loadCompanies(true);
    }
  };

  // State control functions to be exposed to parent component
  const stateControlFunctions = useCallback(() => ({
    navigateToCompanyActivities: async (companyName, activityId) => {
      try {
        // Get current companies state to avoid dependency issues
        setViewMode("activities");
        
        // Find the company by name from current state
        const findAndSelectCompany = (currentCompanies) => {
          const company = currentCompanies.find(c => c.name === companyName);
          if (company) {
            setSelectedCompany(company);
            loadCompanyActivities(company.id);
            
            // Optional: Scroll to the specific activity if needed
            if (activityId) {
              setTimeout(() => {
                const activityElement = document.getElementById(`activity-${activityId}`);
                if (activityElement) {
                  activityElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }
            return true;
          }
          return false;
        };
        
        // Try with current companies first
        setCompanies(currentCompanies => {
          if (findAndSelectCompany(currentCompanies)) {
            return currentCompanies;
          }
          
          // If not found, reload companies
          loadCompanies().then(() => {
            setCompanies(updatedCompanies => {
              findAndSelectCompany(updatedCompanies);
              return updatedCompanies;
            });
          });
          
          return currentCompanies;
        });
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
  }), [loadCompanies, loadCompanyActivities]);

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

  // Check if user can manage activities (admin or creator)
  const canManageActivity = (activity) => {
    if (!userProfile) return false;
    return (
      (userProfile.role === "admin" || userProfile.role === "cpc") ||
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
  }, [updateActivityStatusOptimistically, onChangeActivityStatus, viewMode, selectedCompany, loadCompanyActivities, isRefreshing]); // Remove loadCompanies to prevent loops

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
              {userProfile && (userProfile.role === "admin" || userProfile.role === "cpc") && (
                <Button
                  onClick={handleAddCompany}
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Company
                </Button>
              )}
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
                      <div className="flex gap-2">
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompanySelect(company);
                          }}
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-xs"
                        >
                          View Activities ({company.totalActivities || 0})
                        </Button>
                        {userProfile && (userProfile.role === "admin" || userProfile.role === "cpc") && (
                          <div className="flex gap-1">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCompany(company);
                              }}
                              variant="outline"
                              size="sm"
                              className="p-2"
                            >
                              <EditIcon className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCompany(company.id);
                              }}
                              variant="outline"
                              size="sm"
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                            >
                              <TrashIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Load More Companies Button */}
          {!isLoadingCompanies && !companiesError && companies.length > 0 && hasMoreCompanies && (
            <div className="text-center pt-6">
              <Button
                onClick={handleLoadMoreCompanies}
                disabled={loadingMoreCompanies}
                variant="outline"
                className="flex items-center gap-2"
              >
                {loadingMoreCompanies ? (
                  <>
                    <RefreshIcon className="h-4 w-4 animate-spin" />
                    Loading more companies...
                  </>
                ) : (
                  <>
                    Load More Companies
                  </>
                )}
              </Button>
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
                <span>Total: {companyActivities.length} activities</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
                        <div className="flex flex-wrap gap-1 sm:gap-2 justify-end">
                          {onViewAttendance && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewAttendance(activity);
                              }}
                              size="sm"
                              variant="outline"
                              className="flex items-center gap-1 text-xs px-2 py-1"
                            >
                              <CheckCircleIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                          )}

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectActivity(activity);
                            }}
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-1 text-xs px-2 py-1"
                          >
                            <QrCodeIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">Scan</span>
                          </Button>

                          {canManageActivity(activity) && (
                            <>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newStatus = activity.status === "Active" ? "Inactive" : "Active";
                                  handleActivityStatusChange(activity, newStatus);
                                }}
                                size="sm"
                                variant="outline"
                                className={`flex items-center gap-1 text-xs px-2 py-1 ${
                                  activity.status === "Active" 
                                    ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20" 
                                    : "text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                                }`}
                                title={activity.status === "Active" ? "Pause Activity" : "Activate Activity"}
                              >
                                {activity.status === "Active" ? (
                                  <PauseIcon className="h-3 w-3" />
                                ) : (
                                  <PlayIcon className="h-3 w-3" />
                                )}
                                <span className="hidden sm:inline">
                                  {activity.status === "Active" ? "Pause" : "Start"}
                                </span>
                              </Button>

                              {activity.status !== "Completed" && activity.status !== "Cancelled" && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActivityStatusChange(activity, "Completed");
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center gap-1 text-xs px-2 py-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-900/20"
                                  title="Mark as Completed"
                                >
                                  <CheckCircleIcon className="h-3 w-3" />
                                  <span className="hidden sm:inline">Complete</span>
                                </Button>
                              )}

                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditActivity(activity);
                                }}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1 text-xs px-2 py-1"
                              >
                                <EditIcon className="h-3 w-3" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>

                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteActivity(activity);
                                }}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1 text-xs px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                              >
                                <TrashIcon className="h-3 w-3" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            </>
                          )}
                        </div>
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

      {/* Company Management Modal */}
      {showCompanyManagement && (
        <CompanyManagementModal
          isOpen={showCompanyManagement}
          onClose={handleCompanyManagementClose}
          onSuccess={handleCompanyManagementSuccess}
          company={editingCompany}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}
