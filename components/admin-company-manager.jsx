// components/admin-company-manager.jsx
import React, { useState, useEffect } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { companiesService } from "../lib/companiesService";
import { 
  BuildingIcon, 
  CalendarIcon, 
  CheckCircleIcon, 
  RefreshIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  UsersIcon
} from "./icons";

export default function AdminCompanyManager({
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  userProfile
}) {
  const [activities, setActivities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState(new Set());
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError("");
      
      // Load all activities and companies
      const [activitiesData, companiesData] = await Promise.all([
        unifiedActivitiesService.getAllActivities(),
        companiesService.getAllCompanies().catch(() => []) // Don't fail if companies collection doesn't exist
      ]);
      
      setActivities(activitiesData);
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivitySelect = (activityId) => {
    const newSelected = new Set(selectedActivities);
    if (newSelected.has(activityId)) {
      newSelected.delete(activityId);
    } else {
      newSelected.add(activityId);
    }
    setSelectedActivities(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedActivities.size === activities.length) {
      setSelectedActivities(new Set());
    } else {
      setSelectedActivities(new Set(activities.map(a => a.id)));
    }
  };

  const handleCreateCompanyWithActivities = async () => {
    if (!newCompanyName.trim() || selectedActivities.size === 0) {
      setError("Please enter a company name and select activities");
      return;
    }

    try {
      setIsCreatingCompany(true);
      setError("");

      // Create the company
      const company = await companiesService.createCompany({
        name: newCompanyName.trim(),
        description: `Company with ${selectedActivities.size} activities`,
        createdBy: userProfile?.id || userProfile?.name
      });

      // Add selected activities to the company
      const selectedActivityList = activities.filter(a => selectedActivities.has(a.id));
      
      for (const activity of selectedActivityList) {
        // Update activity with company name
        await unifiedActivitiesService.updateActivity(activity.id, {
          company: newCompanyName.trim()
        });
        
        // Add activity to company
        await companiesService.addActivityToCompany(newCompanyName.trim(), activity.id);
      }

      // Reset form and reload data
      setNewCompanyName("");
      setSelectedActivities(new Set());
      await loadData();
      
      alert(`Successfully created company "${newCompanyName}" with ${selectedActivities.size} activities!`);
    } catch (error) {
      console.error("Error creating company:", error);
      setError("Failed to create company with activities");
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleAssignToExistingCompany = async (companyName) => {
    if (selectedActivities.size === 0) {
      setError("Please select activities first");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const selectedActivityList = activities.filter(a => selectedActivities.has(a.id));
      
      for (const activity of selectedActivityList) {
        // Update activity with company name
        await unifiedActivitiesService.updateActivity(activity.id, {
          company: companyName
        });
        
        // Add activity to company
        await companiesService.addActivityToCompany(companyName, activity.id);
      }

      // Reset selection and reload data
      setSelectedActivities(new Set());
      await loadData();
      
      alert(`Successfully assigned ${selectedActivityList.length} activities to "${companyName}"!`);
    } catch (error) {
      console.error("Error assigning activities:", error);
      setError("Failed to assign activities to company");
    } finally {
      setIsLoading(false);
    }
  };

  const ungroupedActivities = activities.filter(activity => !activity.company);
  const groupedActivities = activities.filter(activity => activity.company);

  // Check if user is admin
  if (!userProfile || userProfile.role !== "admin") {
    return (
      <div className="text-center py-12">
        <BuildingIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Only administrators can access the company management panel.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <BuildingIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Company Management</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Organize activities into companies
            </p>
          </div>
        </div>
        <Button
          onClick={loadData}
          disabled={isLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Activities</p>
                <p className="text-2xl font-bold">{activities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BuildingIcon className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Companies</p>
                <p className="text-2xl font-bold">{companies.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Grouped</p>
                <p className="text-2xl font-bold">{groupedActivities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ungrouped</p>
                <p className="text-2xl font-bold">{ungroupedActivities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Company Section */}
      {ungroupedActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              Create New Company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Company Name</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Enter company name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <Button
                onClick={handleCreateCompanyWithActivities}
                disabled={isCreatingCompany || !newCompanyName.trim() || selectedActivities.size === 0}
                className="whitespace-nowrap"
              >
                {isCreatingCompany ? "Creating..." : `Create with ${selectedActivities.size} activities`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Companies Section */}
      {companies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BuildingIcon className="h-5 w-5" />
              Existing Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((company) => (
                <div key={company.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h3 className="font-medium mb-2">{company.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {company.totalActivities || 0} activities
                  </p>
                  <Button
                    onClick={() => handleAssignToExistingCompany(company.name)}
                    disabled={selectedActivities.size === 0 || isLoading}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    Assign {selectedActivities.size} activities
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ungrouped Activities Section */}
      {ungroupedActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Ungrouped Activities ({ungroupedActivities.length})
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  size="sm"
                >
                  {selectedActivities.size === activities.length ? "Deselect All" : "Select All"}
                </Button>
                <Badge variant="outline">
                  {selectedActivities.size} selected
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ungroupedActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedActivities.has(activity.id)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  onClick={() => handleActivitySelect(activity.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{activity.activityName}</h4>
                    <input
                      type="checkbox"
                      checked={selectedActivities.has(activity.id)}
                      onChange={() => handleActivitySelect(activity.id)}
                      className="ml-2"
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {activity.activityType}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {new Date(activity.date).toLocaleDateString()}
                  </p>
                  <div className="mt-2">
                    <Badge className="text-xs">
                      {activity.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Ungrouped Activities */}
      {ungroupedActivities.length === 0 && activities.length > 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircleIcon className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              All Activities Grouped
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              All activities have been assigned to companies.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Activities */}
      {activities.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-12">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Activities Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Create some activities first to organize them into companies.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
