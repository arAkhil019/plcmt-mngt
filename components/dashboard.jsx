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
} from "./icons";

export default function Dashboard({
  activities,
  onSelectActivity,
  onAddActivityClick,
  onEditActivity,
  attendance,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
}) {
  const statusStyles = {
    Active:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "In Progress":
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Placement Activities
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage all placement activities and track attendance.
          </p>
        </div>
        <Button onClick={onAddActivityClick} className="w-full sm:w-auto">
          + Add Activity
        </Button>
      </div>

      {/* Activities Grid */}
      <div>
        {activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity) => {
              // Calculate present count for the current activity
              const presentCount = attendance[activity.id]?.length || 0;
              const totalStudents = activity.students?.length || 0;

              return (
                <Card key={activity.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {activity.activityType === "Interview Round"
                            ? `${activity.activityType} ${activity.interviewRound}`
                            : activity.activityType}
                        </CardTitle>
                        <CardDescription className="text-lg font-medium">
                          {activity.companyName}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${
                          statusStyles[activity.status] || statusStyles["Inactive"]
                        } border-none`}
                      >
                        {activity.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-3">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <CalendarIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{new Date(activity.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <MapPinIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{activity.location} ({activity.mode})</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <UsersIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{totalStudents} Students Registered</span>
                    </div>
                    <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                      <CheckCircleIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>{presentCount} Students Present</span>
                    </div>
                    {activity.eligibleDepartments?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Eligible:</p>
                        <div className="flex flex-wrap gap-1">
                          {activity.eligibleDepartments.map((d, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {d.name} ({d.year})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {activity.spocName && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          SPOC: {activity.spocName}
                          {activity.spocContact && ` (${activity.spocContact})`}
                        </p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => onSelectActivity(activity)}
                      className="w-full h-10 px-4"
                      variant={activity.status === "Inactive" ? "outline" : "default"}
                    >
                      {activity.status === "Inactive" ? (
                        <>
                          <UsersIcon className="h-4 w-4 mr-2" />
                          View Attendance
                        </>
                      ) : (
                        <>
                          <QrCodeIcon className="h-4 w-4 mr-2" />
                          Mark Attendance
                        </>
                      )}
                    </Button>
                    
                    {/* Edit button only for Active status */}
                    {activity.status === 'Active' && onEditActivity && (
                      <Button
                        onClick={() => onEditActivity(activity)}
                        variant="outline"
                        className="w-full h-10 px-4"
                      >
                        <EditIcon className="h-4 w-4 mr-2" />
                        Edit Activity
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <CalendarIcon className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No activities yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Get started by creating your first placement activity.
            </p>
            <Button onClick={onAddActivityClick}>
              + Add Activity
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
