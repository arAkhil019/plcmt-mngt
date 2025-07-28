// components/dashboard.jsx
import React from "react";
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
} from "./icons";

export default function Dashboard({
  activities,
  dashboardTab = "active", // Add default value
  setDashboardTab,
  onSelectActivity,
  onViewAttendance, // Add new prop for viewing attendance
  onAddActivityClick,
  onEditActivity,
  onDeleteActivity,
  onChangeActivityStatus,
  onAdmissionScan, // Add new prop for admission scanning
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  userProfile, // Add userProfile to props
}) {
  const statusStyles = {
    Active:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "In Progress":
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  };

  // Check if user can manage activities (admin or creator)
  const canManageActivity = (activity) => {
    if (!userProfile) return false;
    return (
      userProfile.role === "admin" ||
      activity.createdById === userProfile.id ||
      activity.createdBy === userProfile.name
    );
  };

  // Get status change options based on current status
  const getStatusChangeOptions = (currentStatus) => {
    switch (currentStatus) {
      case "Inactive":
        return [
          {
            value: "Active",
            label: "Activate",
            shortLabel: "Start",
            icon: PlayIcon,
            color: "green",
          },
          {
            value: "In Progress",
            label: "Mark In Progress",
            shortLabel: "Progress",
            icon: RefreshIcon,
            color: "blue",
          },
        ];
      case "In Progress":
        return [
          {
            value: "Active",
            label: "Activate",
            shortLabel: "Start",
            icon: PlayIcon,
            color: "green",
          },
          {
            value: "Inactive",
            label: "Deactivate",
            shortLabel: "Pause",
            icon: PauseIcon,
            color: "gray",
          },
        ];
      case "Active":
        return [
          {
            value: "In Progress",
            label: "Mark In Progress",
            shortLabel: "Progress",
            icon: RefreshIcon,
            color: "blue",
          },
          {
            value: "Inactive",
            label: "Deactivate",
            shortLabel: "Pause",
            icon: PauseIcon,
            color: "gray",
          },
        ];
      default:
        return [];
    }
  };

  // Filter activities based on the selected tab
  const getFilteredActivities = () => {
    if (!activities || activities.length === 0) return [];
    
    if (dashboardTab === "active") {
      return activities.filter(
        (activity) => activity.status === "Active" || activity.status === "In Progress"
      );
    } else if (dashboardTab === "inactive") {
      return activities.filter((activity) => activity.status === "Inactive");
    }
    return activities; // fallback to all activities
  };

  const filteredActivities = getFilteredActivities();

  // Get counts for tab badges
  const activeCount = activities.filter(
    (activity) => activity.status === "Active" || activity.status === "In Progress"
  ).length;
  const inactiveCount = activities.filter(
    (activity) => activity.status === "Inactive"
  ).length;

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
              Manage all placement activities and track attendance.
            </p>
          </div>
        </div>
        <Button onClick={onAddActivityClick} className="w-full sm:w-auto whitespace-nowrap">
          + Add Activity
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Button
            variant={dashboardTab === "active" ? "default" : "outline"}
            onClick={() => setDashboardTab && setDashboardTab("active")}
            className="w-full sm:w-auto justify-start sm:justify-center"
          >
            <div className="flex items-center gap-2">
              <PlayIcon className="h-4 w-4" />
              <span>Active & In Progress</span>
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-2 py-0.5 text-xs">
                  {activeCount}
                </Badge>
              )}
            </div>
          </Button>
          
          <Button
            variant={dashboardTab === "inactive" ? "default" : "outline"}
            onClick={() => setDashboardTab && setDashboardTab("inactive")}
            className="w-full sm:w-auto justify-start sm:justify-center"
          >
            <div className="flex items-center gap-2">
              <PauseIcon className="h-4 w-4" />
              <span>Inactive</span>
              {inactiveCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-2 py-0.5 text-xs">
                  {inactiveCount}
                </Badge>
              )}
            </div>
          </Button>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Total: {activities.length} activities</span>
          {dashboardTab === "active" && (
            <span>Showing: {filteredActivities.length} active</span>
          )}
          {dashboardTab === "inactive" && (
            <span>Showing: {filteredActivities.length} inactive</span>
          )}
        </div>
      </div>

      {/* Activities Grid */}
      <div>
        {filteredActivities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredActivities.map((activity) => {
              // Calculate present count using participant attendance property
              const presentCount =
                activity.participants?.filter((p) => p.attendance)?.length || 0;
              const totalStudents = activity.participants?.length || 0;

              return (
                <Card key={activity.id} className="flex flex-col h-full">
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg lg:text-xl leading-tight">
                            {activity.activityType === "Interview Round"
                              ? `${activity.activityType} ${activity.interviewRound}`
                              : activity.activityType}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`${
                            statusStyles[activity.status] ||
                            statusStyles["Inactive"]
                          } border-none text-xs px-2 py-1 shrink-0`}
                        >
                          {activity.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                        {activity.companyName}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-grow space-y-2 sm:space-y-3 pt-0 pb-2">
                    <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <CalendarIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="truncate">
                          {new Date(activity.date).toLocaleDateString()}
                          {activity.time && (
                            <span className="ml-1 text-gray-500">• {activity.time}</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <MapPinIcon className="h-3 w-3 mr-2 flex-shrink-0" />
                        <span className="truncate">
                          {activity.location || activity.mode}
                        </span>
                      </div>
                      
                      {/* Participant Stats - Compact for mobile */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center text-gray-500 dark:text-gray-400">
                          <UsersIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{totalStudents} Total</span>
                        </div>
                        <div className="flex items-center text-green-600 dark:text-green-400">
                          <CheckCircleIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{presentCount} Present</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Departments - Compact display */}
                    {activity.eligibleDepartments?.length > 0 && (
                      <div className="pt-1">
                        <div className="flex flex-wrap gap-1">
                          {activity.eligibleDepartments.slice(0, 2).map((d, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs px-1.5 py-0.5"
                            >
                              {d.name}
                            </Badge>
                          ))}
                          {activity.eligibleDepartments.length > 2 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                              +{activity.eligibleDepartments.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* SPOC Info - Hide on mobile if space is tight */}
                    {activity.spocName && (
                      <div className="pt-1 border-t border-gray-100 dark:border-gray-800 hidden sm:block">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          SPOC: {activity.spocName}
                        </p>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="flex flex-col gap-1.5 sm:gap-2 pt-2">
                    {/* Primary Action Button - Full Width */}
                    <Button
                      onClick={() => onSelectActivity(activity)}
                      className="w-full h-9 sm:h-10 px-3 text-sm sm:text-base font-medium"
                      variant={
                        activity.status === "Inactive" ? "outline" : "default"
                      }
                    >
                      {activity.status === "Inactive" ? (
                        <>
                          <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          View Attendance
                        </>
                      ) : (
                        <>
                          <QrCodeIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                          Mark Attendance
                        </>
                      )}
                    </Button>
                    
                    {/* View Attendance Button - Available for all activities */}
                    <Button
                      onClick={() => onViewAttendance && onViewAttendance(activity)}
                      variant="outline"
                      className="w-full h-8 sm:h-9 px-3 text-xs sm:text-sm font-medium border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      View Attendance
                    </Button>
                    
                    {/* Secondary Actions Row - Responsive icon buttons */}
                    {canManageActivity(activity) && (
                      <div className="flex gap-1 sm:gap-1.5 w-full">
                        {/* Admission Scanner for Active Activities */}
                        {activity.status === "Active" && onAdmissionScan && (
                          <Button
                            onClick={() => onAdmissionScan(activity)}
                            variant="outline"
                            className="flex-1 min-w-0 h-7 sm:h-8 md:h-9 px-1 sm:px-2 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 flex items-center justify-center"
                            title="Admission Scanner"
                          >
                            <QrCodeIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                          </Button>
                        )}

                        {/* Edit Button for Active Activities */}
                        {activity.status === "Active" && onEditActivity && (
                          <Button
                            onClick={() => onEditActivity(activity)}
                            variant="outline"
                            className="flex-1 min-w-0 h-7 sm:h-8 md:h-9 px-1 sm:px-2 text-xs flex items-center justify-center"
                            title="Edit Activity"
                          >
                            <EditIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                          </Button>
                        )}

                        {/* Status Change Buttons for Non-Active */}
                        {activity.status !== "Active" &&
                          onChangeActivityStatus &&
                          getStatusChangeOptions(activity.status).map((option) => (
                            <Button
                              key={option.value}
                              onClick={() =>
                                onChangeActivityStatus(activity, option.value)
                              }
                              variant="outline"
                              className={`flex-1 min-w-0 h-7 sm:h-8 md:h-9 px-1 sm:px-2 text-xs flex items-center justify-center ${
                                option.color === "green"
                                  ? "hover:bg-green-50 hover:text-green-700 border-green-200 text-green-600"
                                  : option.color === "blue"
                                  ? "hover:bg-blue-50 hover:text-blue-700 border-blue-200 text-blue-600"
                                  : "hover:bg-gray-50 hover:text-gray-700"
                              }`}
                              title={option.label}
                            >
                              <option.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                            </Button>
                          ))}

                        {/* Delete Button */}
                        {(activity.status === "Inactive" ||
                          activity.status === "In Progress") &&
                          onDeleteActivity && (
                            <Button
                              onClick={() => onDeleteActivity(activity)}
                              variant="outline"
                              className="flex-1 min-w-0 h-7 sm:h-8 md:h-9 px-1 sm:px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 flex items-center justify-center"
                              title="Delete Activity"
                            >
                              <TrashIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                            </Button>
                          )}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              {dashboardTab === "active" ? (
                <PlayIcon className="h-12 w-12 text-gray-400" />
              ) : (
                <PauseIcon className="h-12 w-12 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {activities.length === 0 
                ? "No activities yet"
                : dashboardTab === "active" 
                  ? "No active activities"
                  : "No inactive activities"
              }
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {activities.length === 0 
                ? "Get started by creating your first placement activity."
                : dashboardTab === "active"
                  ? "All your activities are currently inactive. Activate an activity to get started."
                  : "No activities have been deactivated yet."
              }
            </p>
            {activities.length === 0 && (
              <Button onClick={onAddActivityClick}>+ Add Activity</Button>
            )}
            {activities.length > 0 && dashboardTab === "active" && (
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={onAddActivityClick}>+ Add Activity</Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDashboardTab && setDashboardTab("inactive")}
                >
                  View Inactive Activities
                </Button>
              </div>
            )}
            {activities.length > 0 && dashboardTab === "inactive" && (
              <Button 
                variant="outline" 
                onClick={() => setDashboardTab && setDashboardTab("active")}
              >
                View Active Activities
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
