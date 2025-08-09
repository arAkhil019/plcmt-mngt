// components/admin-company-manager.jsx
import React, { useState, useEffect, useCallback } from "react";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { companiesService } from "../lib/companiesService";
import CompanyManagementModal from "./CompanyManagementModal";

export default function AdminCompanyManager({
  BuildingIcon,
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
  const [selectedActivitiesForGrouping, setSelectedActivitiesForGrouping] = useState(new Set());
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [error, setError] = useState("");
  
  // Company management modal state
  const [showCompanyManagement, setShowCompanyManagement] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  
  // Company activities management state
  const [showCompanyActivities, setShowCompanyActivities] = useState(false);
  const [managingCompany, setManagingCompany] = useState(null);
  const [companyActivities, setCompanyActivities] = useState([]);
  const [availableActivities, setAvailableActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  
  // Activity grouping state (merged into main interface)
  const [newCompanyNameForGrouping, setNewCompanyNameForGrouping] = useState("");
  
  // Lazy loading state for companies
  const [hasMoreCompanies, setHasMoreCompanies] = useState(true);
  const [loadingMoreCompanies, setLoadingMoreCompanies] = useState(false);
  const [lastCompanyDoc, setLastCompanyDoc] = useState(null);

  const loadCompanies = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMoreCompanies(true);
      } else {
        setIsLoading(true);
      }
      setError("");

      const result = await companiesService.getCompaniesWithLazyLoading(
        loadMore ? lastCompanyDoc : null,
        15
      );

      if (loadMore) {
        setCompanies(prev => [...prev, ...result.companies]);
      } else {
        setCompanies(result.companies);
      }

      setHasMoreCompanies(result.hasMore);
      setLastCompanyDoc(result.lastDoc);
    } catch (error) {
      console.error("Error loading companies:", error);
      if (!loadMore) {
        setError("Failed to load companies");
      }
    } finally {
      if (loadMore) {
        setLoadingMoreCompanies(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []); // Remove lastCompanyDoc dependency to prevent infinite loops

  useEffect(() => {
    loadData();
  }, []); // Load data on component mount

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
      
      // Filter to only show independent companies (not subsidiaries)
      const independentCompanies = companiesData.filter(company => 
        !company.parentCompany && !company.parentCompanyId
      );
      
      setCompanies(independentCompanies);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMoreCompanies = () => {
    loadCompanies(true);
  };

  const handleCreateCompanyWithActivities = async () => {
    if (!newCompanyName.trim() || selectedActivitiesForGrouping.size === 0) {
      setError("Please enter a company name and select activities");
      return;
    }

    try {
      setIsCreatingCompany(true);
      setError("");

      // Create the company
      const company = await companiesService.createCompany({
        name: newCompanyName.trim(),
        description: `Company with ${selectedActivitiesForGrouping.size} activities`,
        createdBy: userProfile?.id || userProfile?.name
      });

      // Add selected activities to the company
      const selectedActivityList = activities.filter(a => selectedActivitiesForGrouping.has(a.id));
      
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
      setSelectedActivitiesForGrouping(new Set());
      await loadData();
      
      alert(`Successfully created company "${newCompanyName}" with ${selectedActivitiesForGrouping.size} activities!`);
    } catch (error) {
      console.error("Error creating company:", error);
      setError("Failed to create company with activities");
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm("Are you sure you want to delete this company? This action cannot be undone.")) {
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      // Delete the company using the service
      await companiesService.deleteCompany(companyId, userProfile.id);
      
      // Reload data to reflect changes
      await loadData();
      
      alert("Company deleted successfully!");
    } catch (error) {
      console.error("Error deleting company:", error);
      setError("Failed to delete company: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setShowCompanyManagement(true);
  };

  const handleAddCompany = () => {
    setEditingCompany(null);
    setShowCompanyManagement(true);
  };

  const handleCompanyManagementClose = () => {
    setShowCompanyManagement(false);
    setEditingCompany(null);
  };

  const handleCompanySave = async (companyData) => {
    try {
      if (editingCompany) {
        // Update existing company
        await companiesService.updateCompany(editingCompany.id, companyData, userProfile.id);
      } else {
        // Create new company
        const companyWithCreator = {
          ...companyData,
          createdBy: userProfile?.id || userProfile?.name
        };
        await companiesService.createCompany(companyWithCreator);
      }
      
      await loadData(); // Reload companies after save
      setShowCompanyManagement(false);
      setEditingCompany(null);
    } catch (error) {
      throw error; // Let the modal handle the error display
    }
  };

  const handleCompanyDelete = async (companyId) => {
    await companiesService.deleteCompany(companyId, userProfile.id);
    await loadData(); // Reload companies after deletion
    setShowCompanyManagement(false);
    setEditingCompany(null);
  };

  const handleDeleteCompanyDirect = async (companyId) => {
    try {
      await companiesService.deleteCompany(companyId, userProfile.id);
      await loadData(); // Reload both companies and activities
    } catch (error) {
      console.error("Error deleting company:", error);
      setError("Failed to delete company");
    }
  };

  // Company activities management functions
  const handleManageCompanyActivities = async (company) => {
    try {
      setIsLoadingActivities(true);
      setManagingCompany(company);
      setShowCompanyActivities(true);
      
      // Load company activities and all available activities
      const [companyActivitiesData, allActivitiesData] = await Promise.all([
        companiesService.getCompanyActivities(company.id),
        unifiedActivitiesService.getAllActivities()
      ]);
      
      setCompanyActivities(companyActivitiesData);
      
      // Filter out activities already assigned to ANY company (only show unassigned activities)
      const availableActivitiesData = allActivitiesData.filter(activity => 
        !activity.company
      );
      setAvailableActivities(availableActivitiesData);
    } catch (error) {
      console.error("Error loading company activities:", error);
      setError("Failed to load company activities");
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleAddActivityToCompany = async (activityId) => {
    try {
      // Update activity with company name
      await unifiedActivitiesService.updateActivity(activityId, {
        company: managingCompany.name
      });
      
      // Add activity to company
      await companiesService.addActivityToCompany(managingCompany.name, activityId);
      
      // Reload activities for this company
      await handleManageCompanyActivities(managingCompany);
    } catch (error) {
      console.error("Error adding activity to company:", error);
      setError("Failed to add activity to company");
    }
  };

  const handleRemoveActivityFromCompany = async (activityId) => {
    try {
      // Remove company from activity
      await unifiedActivitiesService.updateActivity(activityId, {
        company: null
      });
      
      // Remove activity from company
      await companiesService.removeActivityFromCompany(managingCompany.name, activityId);
      
      // Reload activities for this company
      await handleManageCompanyActivities(managingCompany);
    } catch (error) {
      console.error("Error removing activity from company:", error);
      setError("Failed to remove activity from company");
    }
  };

  const handleCloseCompanyActivities = () => {
    setShowCompanyActivities(false);
    setManagingCompany(null);
    setCompanyActivities([]);
    setAvailableActivities([]);
  };

  const ungroupedActivities = activities.filter(activity => !activity.company);
  const groupedActivities = activities.filter(activity => activity.company);

  // Check if user is admin or cpc
  if (!userProfile || (userProfile.role !== "admin" && userProfile.role !== "cpc")) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <BuildingIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Restricted</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Only administrators and CPCs can access company management.
            </p>
          </CardContent>
        </Card>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Company Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage companies, activities, and their relationships
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleAddCompany}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Add Company
          </Button>
          
          <Button
            onClick={() => loadData()}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Companies Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="group hover:shadow-lg transition-all duration-300 border-0 border-l-4 border-l-blue-500 bg-white dark:bg-gray-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 h-full flex items-center">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-xl flex items-center justify-center transition-all duration-300">
                    <BuildingIcon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 leading-tight">
                    Total Companies
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                    {companies.length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 border-0 border-l-4 border-l-green-500 bg-white dark:bg-gray-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 h-full flex items-center">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-xl flex items-center justify-center transition-all duration-300">
                    <CalendarIcon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1 leading-tight">
                    Total Activities
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                    {companies.reduce((sum, company) => sum + (company.totalActivities || 0), 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-all duration-300 border-0 border-l-4 border-l-orange-500 bg-white dark:bg-gray-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6 h-full flex items-center">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 rounded-xl flex items-center justify-center transition-all duration-300">
                    <CheckCircleIcon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1 leading-tight">
                    Ungrouped Activities
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                    {ungroupedActivities.length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies Loading State */}
      {isLoading && companies.length === 0 && !error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 dark:text-gray-400">Loading companies...</p>
          </div>
        </div>
      )}

      {/* Companies Grid */}
      {!isLoading && companies.length > 0 && (
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

                  {company.website && (
                    <div className="text-sm">
                      <a 
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      >
                        {company.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="space-y-3">
                    {/* First row - Activities management */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageCompanyActivities(company);
                      }}
                      variant="outline"
                      size="default"
                      className="w-full text-sm py-2.5 h-auto"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Manage Activities ({company.totalActivities || 0})
                    </Button>
                    
                    {/* Second row - Edit and Delete */}
                    <div className="flex gap-3">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCompany(company);
                        }}
                        variant="outline"
                        size="default"
                        className="flex-1 text-sm py-2.5 h-auto"
                      >
                        <EditIcon className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(company.id);
                        }}
                        variant="outline"
                        size="default"
                        className="px-4 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 h-auto"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More Companies Button */}
      {!isLoading && companies.length > 0 && hasMoreCompanies && (
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
                <ChevronDownIcon className="h-4 w-4" />
                Load More Companies
              </>
            )}
          </Button>
        </div>
      )}

      {/* No Companies */}
      {!isLoading && companies.length === 0 && !error && (
        <Card>
          <CardContent className="text-center py-12">
            <BuildingIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Companies Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Get started by creating your first company.
            </p>
            <Button onClick={handleAddCompany}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ungrouped Activities Section */}
      {activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Ungrouped Activities ({ungroupedActivities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ungroupedActivities.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select activities to group them into a new company:
                </p>
                
                {/* Create Company Form */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New company name..."
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <Button
                    onClick={handleCreateCompanyWithActivities}
                    disabled={!newCompanyName.trim() || selectedActivitiesForGrouping.size === 0 || isCreatingCompany}
                    className="flex items-center gap-2"
                  >
                    {isCreatingCompany ? (
                      <>
                        <RefreshIcon className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create Company ({selectedActivitiesForGrouping.size})
                      </>
                    )}
                  </Button>
                </div>

                {/* Ungrouped Activities List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ungroupedActivities.map((activity) => (
                    <Card
                      key={activity.id}
                      className={`cursor-pointer transition-all ${
                        selectedActivitiesForGrouping.has(activity.id)
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => {
                        const newSelection = new Set(selectedActivitiesForGrouping);
                        if (newSelection.has(activity.id)) {
                          newSelection.delete(activity.id);
                        } else {
                          newSelection.add(activity.id);
                        }
                        setSelectedActivitiesForGrouping(newSelection);
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedActivitiesForGrouping.has(activity.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {selectedActivitiesForGrouping.has(activity.id) && (
                              <CheckIcon className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{activity.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {activity.type || 'Activity'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                All activities have been assigned to companies.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Company Activities Management Modal */}
      {showCompanyActivities && managingCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Manage Activities - {managingCompany.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Add or remove activities from this company
                  </p>
                </div>
                <Button
                  onClick={handleCloseCompanyActivities}
                  variant="outline"
                  size="sm"
                >
                  ✕
                </Button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {isLoadingActivities ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">Loading activities...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Company's Current Activities */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      Assigned Activities ({companyActivities.length})
                    </h3>
                    {companyActivities.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {companyActivities.map((activity) => (
                          <Card key={activity.id} className="p-4 border-l-4 border-l-green-500">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-3">
                                  <CalendarIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-base mb-2 text-gray-900 dark:text-white">
                                      {activity.title || activity.activityName || 'Untitled Activity'}
                                    </h4>
                                    {activity.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                                        {activity.description}
                                      </p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium text-gray-500 dark:text-gray-400">Type:</span>
                                        <p className="text-gray-900 dark:text-white">
                                          {activity.type || activity.activityType || 'General Activity'}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-500 dark:text-gray-400">Date:</span>
                                        <p className="text-gray-900 dark:text-white">
                                          {activity.date || activity.activityDate 
                                            ? new Date(activity.date || activity.activityDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                              })
                                            : 'No date set'
                                          }
                                        </p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-500 dark:text-gray-400">Status:</span>
                                        <div className="mt-1">
                                          <Badge 
                                            className={`text-xs ${
                                              (activity.status || 'active').toLowerCase() === 'completed' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : (activity.status || 'active').toLowerCase() === 'active'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                            }`}
                                          >
                                            {activity.status || 'Active'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    {(activity.startTime || activity.endTime) && (
                                      <div className="mt-3 flex gap-4 text-sm">
                                        {activity.startTime && (
                                          <div>
                                            <span className="font-medium text-gray-500 dark:text-gray-400">Start Time:</span>
                                            <span className="ml-1 text-gray-900 dark:text-white">{activity.startTime}</span>
                                          </div>
                                        )}
                                        {activity.endTime && (
                                          <div>
                                            <span className="font-medium text-gray-500 dark:text-gray-400">End Time:</span>
                                            <span className="ml-1 text-gray-900 dark:text-white">{activity.endTime}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {activity.location && (
                                      <div className="mt-2 flex items-center gap-1 text-sm">
                                        <MapPinIcon className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-600 dark:text-gray-300">{activity.location}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  onClick={() => handleRemoveActivityFromCompany(activity.id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  <TrashIcon className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-8">
                        <div className="text-center">
                          <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No Activities Assigned
                          </h4>
                          <p className="text-gray-500 dark:text-gray-400">
                            This company doesn't have any activities assigned yet. Add some from the available activities below.
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Unassigned Activities to Add */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <PlusIcon className="h-5 w-5 text-blue-500" />
                      Unassigned Activities ({availableActivities.length})
                    </h3>
                    {availableActivities.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {availableActivities.map((activity) => (
                          <Card key={activity.id} className="p-4 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-3">
                                  <CalendarIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-base mb-2 text-gray-900 dark:text-white">
                                      {activity.title || activity.activityName || 'Untitled Activity'}
                                    </h4>
                                    {activity.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                                        {activity.description}
                                      </p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium text-gray-500 dark:text-gray-400">Type:</span>
                                        <p className="text-gray-900 dark:text-white">
                                          {activity.type || activity.activityType || 'General Activity'}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-500 dark:text-gray-400">Date:</span>
                                        <p className="text-gray-900 dark:text-white">
                                          {activity.date || activity.activityDate 
                                            ? new Date(activity.date || activity.activityDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                              })
                                            : 'No date set'
                                          }
                                        </p>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-500 dark:text-gray-400">Status:</span>
                                        <div className="mt-1">
                                          <Badge 
                                            className={`text-xs ${
                                              (activity.status || 'active').toLowerCase() === 'completed' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : (activity.status || 'active').toLowerCase() === 'active'
                                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                            }`}
                                          >
                                            {activity.status || 'Active'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                    {(activity.startTime || activity.endTime) && (
                                      <div className="mt-3 flex gap-4 text-sm">
                                        {activity.startTime && (
                                          <div>
                                            <span className="font-medium text-gray-500 dark:text-gray-400">Start Time:</span>
                                            <span className="ml-1 text-gray-900 dark:text-white">{activity.startTime}</span>
                                          </div>
                                        )}
                                        {activity.endTime && (
                                          <div>
                                            <span className="font-medium text-gray-500 dark:text-gray-400">End Time:</span>
                                            <span className="ml-1 text-gray-900 dark:text-white">{activity.endTime}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {activity.location && (
                                      <div className="mt-2 flex items-center gap-1 text-sm">
                                        <MapPinIcon className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-600 dark:text-gray-300">{activity.location}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <Button
                                  onClick={() => handleAddActivityToCompany(activity.id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                >
                                  <PlusIcon className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="p-8">
                        <div className="text-center">
                          <CheckCircleIcon className="h-12 w-12 mx-auto mb-4 text-green-500" />
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No Unassigned Activities
                          </h4>
                          <p className="text-gray-500 dark:text-gray-400">
                            All activities are currently assigned to companies. Create new activities to add them to this company.
                          </p>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Company Management Modal */}
      {showCompanyManagement && (
        <CompanyManagementModal
          isOpen={showCompanyManagement}
          onClose={handleCompanyManagementClose}
          onSave={handleCompanySave}
          onDelete={handleCompanyDelete}
          company={editingCompany}
          userProfile={userProfile}
          Card={Card}
          CardHeader={CardHeader}
          CardTitle={CardTitle}
          CardContent={CardContent}
          Button={Button}
        />
      )}
    </div>
  );
}
