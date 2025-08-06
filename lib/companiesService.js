// lib/companiesService.js
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

const COMPANIES_COLLECTION = "companies";

export const companiesService = {
  /**
   * Create a new company
   */
  async createCompany(companyData) {
    try {
      const company = {
        name: companyData.name.trim(),
        description: companyData.description || "",
        website: companyData.website || "",
        industry: companyData.industry || "",
        location: companyData.location || "",
        activityIds: [], // Array of activity IDs under this company
        totalActivities: 0,
        activeActivities: 0,
        completedActivities: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: companyData.createdBy || null,
        isActive: true,
      };

      const docRef = await addDoc(collection(db, COMPANIES_COLLECTION), company);
      
      return {
        id: docRef.id,
        ...company,
      };
    } catch (error) {
      console.error("Error creating company:", error);
      throw new Error("Failed to create company");
    }
  },

  /**
   * Get all companies with basic info (for dashboard loading)
   */
  async getAllCompanies() {
    try {
      // Use a simpler query to avoid index requirements
      const q = query(
        collection(db, COMPANIES_COLLECTION),
        orderBy("name", "asc")
      );

      const snapshot = await getDocs(q);
      const companies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter active companies in memory to avoid composite index requirement
      return companies.filter(company => company.isActive !== false);
    } catch (error) {
      console.error("Error fetching companies:", error);
      throw new Error("Failed to fetch companies");
    }
  },

  /**
   * Get company by ID with full details
   */
  async getCompanyById(companyId) {
    try {
      const docRef = doc(db, COMPANIES_COLLECTION, companyId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Company not found");
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      };
    } catch (error) {
      console.error("Error fetching company:", error);
      throw new Error("Failed to fetch company");
    }
  },

  /**
   * Get company by name
   */
  async getCompanyByName(companyName) {
    try {
      const q = query(
        collection(db, COMPANIES_COLLECTION),
        where("name", "==", companyName.trim()),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const company = {
        id: doc.id,
        ...doc.data(),
      };

      // Check if company is active in memory
      if (company.isActive === false) {
        return null;
      }

      return company;
    } catch (error) {
      console.error("Error fetching company by name:", error);
      throw new Error("Failed to fetch company");
    }
  },

  /**
   * Update company details
   */
  async updateCompany(companyId, updates, updatedBy = null) {
    try {
      const docRef = doc(db, COMPANIES_COLLECTION, companyId);
      
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (updatedBy) {
        updateData.updatedBy = updatedBy;
      }

      await updateDoc(docRef, updateData);
      
      // Return updated company
      return await this.getCompanyById(companyId);
    } catch (error) {
      console.error("Error updating company:", error);
      throw new Error("Failed to update company");
    }
  },

  /**
   * Add activity to company
   */
  async addActivityToCompany(companyName, activityId) {
    try {
      // First check if company exists, if not create it
      let company = await this.getCompanyByName(companyName);
      
      if (!company) {
        company = await this.createCompany({
          name: companyName,
          description: `Activities for ${companyName}`,
        });
      }

      // Add activity ID to company's activityIds array
      const docRef = doc(db, COMPANIES_COLLECTION, company.id);
      await updateDoc(docRef, {
        activityIds: arrayUnion(activityId),
        totalActivities: increment(1),
        activeActivities: increment(1),
        updatedAt: new Date().toISOString(),
      });

      return company;
    } catch (error) {
      console.error("Error adding activity to company:", error);
      throw new Error("Failed to add activity to company");
    }
  },

  /**
   * Remove activity from company
   */
  async removeActivityFromCompany(companyName, activityId) {
    try {
      const company = await this.getCompanyByName(companyName);
      if (!company) {
        console.warn(`Company ${companyName} not found`);
        return;
      }

      const docRef = doc(db, COMPANIES_COLLECTION, company.id);
      await updateDoc(docRef, {
        activityIds: arrayRemove(activityId),
        totalActivities: increment(-1),
        activeActivities: increment(-1),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error removing activity from company:", error);
      throw new Error("Failed to remove activity from company");
    }
  },

  /**
   * Update activity status in company (for active count)
   * NOTE: This function is deprecated - the new recalibration system should be used instead
   */
  async updateActivityStatusInCompany(companyName, activityId, newStatus, oldStatus) {
    try {
      // Skip this function as we now use the comprehensive recalibration system
      return;
      
      const company = await this.getCompanyByName(companyName);
      if (!company) {
        return;
      }

      const docRef = doc(db, COMPANIES_COLLECTION, company.id);
      
      // Update active count based on status change
      let activeChange = 0;
      
      // Proper logic: count "Active" status as active
      if (oldStatus === "Active" && newStatus !== "Active") {
        activeChange = -1; // Becoming inactive
      } else if (oldStatus !== "Active" && newStatus === "Active") {
        activeChange = 1; // Becoming active
      }

      if (activeChange !== 0) {
        await updateDoc(docRef, {
          activeActivities: increment(activeChange),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error updating activity status in company:", error);
      // Don't throw error here as it's not critical
    }
  },

  /**
   * Get companies with activity counts for dashboard
   */
  async getCompaniesWithCounts() {
    try {
      const companies = await this.getAllCompanies();
      
      return companies.map(company => ({
        id: company.id,
        name: company.name,
        description: company.description,
        totalActivities: company.totalActivities || 0,
        activeActivities: company.activeActivities || 0,
        completedActivities: company.completedActivities || 0,
        industry: company.industry,
        location: company.location,
        website: company.website,
        updatedAt: company.updatedAt,
      }));
    } catch (error) {
      console.error("Error fetching companies with counts:", error);
      throw new Error("Failed to fetch companies");
    }
  },

  /**
   * Search companies by name
   */
  async searchCompanies(searchTerm) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return await this.getAllCompanies();
      }

      const companies = await this.getAllCompanies();
      const searchLower = searchTerm.toLowerCase().trim();
      
      return companies.filter(company =>
        company.name.toLowerCase().includes(searchLower) ||
        (company.description && company.description.toLowerCase().includes(searchLower)) ||
        (company.industry && company.industry.toLowerCase().includes(searchLower))
      );
    } catch (error) {
      console.error("Error searching companies:", error);
      throw new Error("Failed to search companies");
    }
  },

  /**
   * Get company names for autocomplete
   */
  async getCompanyNames() {
    try {
      const companies = await this.getAllCompanies();
      return companies.map(company => company.name).sort();
    } catch (error) {
      console.error("Error fetching company names:", error);
      throw new Error("Failed to fetch company names");
    }
  },

  /**
   * Delete/deactivate company
   */
  async deleteCompany(companyId) {
    try {
      const docRef = doc(db, COMPANIES_COLLECTION, companyId);
      
      // Soft delete - mark as inactive
      await updateDoc(docRef, {
        isActive: false,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error deleting company:", error);
      throw new Error("Failed to delete company");
    }
  },

  /**
   * Get activity statistics for a company
   */
  async getCompanyActivityStats(companyId) {
    try {
      const company = await this.getCompanyById(companyId);
      
      return {
        totalActivities: company.totalActivities || 0,
        activeActivities: company.activeActivities || 0,
        activityIds: company.activityIds || [],
      };
    } catch (error) {
      console.error("Error fetching company activity stats:", error);
      throw new Error("Failed to fetch company statistics");
    }
  },

  /**
   * Get activities for a specific company
   */
  async getCompanyActivities(companyId) {
    try {
      const company = await this.getCompanyById(companyId);
      if (!company || !company.activityIds || company.activityIds.length === 0) {
        return [];
      }

      // Import activities service here to avoid circular dependency
      const { unifiedActivitiesService } = await import("./unifiedActivitiesService");
      
      // Get activities by their IDs
      const activities = await Promise.all(
        company.activityIds.map(async (activityId) => {
          try {
            return await unifiedActivitiesService.getActivityById(activityId);
          } catch (error) {
            console.warn(`Activity ${activityId} not found`);
            return null;
          }
        })
      );

      // Filter out null activities (deleted activities)
      return activities.filter(activity => activity !== null);
    } catch (error) {
      console.error("Error getting company activities:", error);
      throw new Error("Failed to fetch company activities");
    }
  },

  /**
   * Recalibrate company data by counting actual activities
   * This ensures company statistics are accurate
   */
  async recalibrateCompanyData(companyId) {
    try {
      const company = await this.getCompanyById(companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      // Import activities service to avoid circular dependency
      const { unifiedActivitiesService } = await import("./unifiedActivitiesService");
      
      // Get all activities that belong to this company
      const allActivities = await unifiedActivitiesService.getAllActivities();
      const companyActivities = allActivities.filter(activity => 
        activity.company === company.name || 
        activity.companyName === company.name
      );

      // Count active activities (status === "Active")
      const activeActivities = companyActivities.filter(activity => 
        activity.status === "Active"
      );

      // Count completed activities
      const completedActivities = companyActivities.filter(activity => 
        activity.status === "Completed"
      );

      // Get actual activity IDs
      const actualActivityIds = companyActivities.map(activity => activity.id);

      // Update company with recalibrated data
      const docRef = doc(db, COMPANIES_COLLECTION, companyId);
      await updateDoc(docRef, {
        activityIds: actualActivityIds,
        totalActivities: companyActivities.length,
        activeActivities: activeActivities.length,
        completedActivities: completedActivities.length,
        updatedAt: new Date().toISOString(),
        lastRecalibratedAt: new Date().toISOString(),
      });

      
      return {
        companyId,
        companyName: company.name,
        totalActivities: companyActivities.length,
        activeActivities: activeActivities.length,
        completedActivities: completedActivities.length,
        activityIds: actualActivityIds,
      };
    } catch (error) {
      console.error("Error recalibrating company data:", error);
      throw new Error(`Failed to recalibrate company data: ${error.message}`);
    }
  },

  /**
   * Recalibrate all companies by iterating through all activities
   * This is useful after bulk operations or data migrations
   */
  async recalibrateAllCompanies() {
    try {
      // Import activities service to avoid circular dependency
      const { unifiedActivitiesService } = await import("./unifiedActivitiesService");
      
      // Get all activities and companies
      const [allActivities, allCompanies] = await Promise.all([
        unifiedActivitiesService.getAllActivities(),
        this.getAllCompanies()
      ]);

      const results = [];

      for (const company of allCompanies) {
        try {
          // Find activities for this company
          const companyActivities = allActivities.filter(activity => 
            activity.company === company.name || 
            activity.companyName === company.name
          );

          // Count active activities (status === "Active")
          const activeActivities = companyActivities.filter(activity => 
            activity.status === "Active"
          );

          // Count completed activities
          const completedActivities = companyActivities.filter(activity => 
            activity.status === "Completed"
          );

          // Get actual activity IDs
          const actualActivityIds = companyActivities.map(activity => activity.id);

          // Update company with recalibrated data
          const docRef = doc(db, COMPANIES_COLLECTION, company.id);
          await updateDoc(docRef, {
            activityIds: actualActivityIds,
            totalActivities: companyActivities.length,
            activeActivities: activeActivities.length,
            completedActivities: completedActivities.length,
            updatedAt: new Date().toISOString(),
            lastRecalibratedAt: new Date().toISOString(),
          });

          const result = {
            companyId: company.id,
            companyName: company.name,
            totalActivities: companyActivities.length,
            activeActivities: activeActivities.length,
            completedActivities: completedActivities.length,
            activityIds: actualActivityIds,
          };

          results.push(result);
          
        } catch (error) {
          console.error(`❌ Error recalibrating company ${company.name}:`, error);
          results.push({
            companyId: company.id,
            companyName: company.name,
            error: error.message,
          });
        }
      }
      
      return {
        success: true,
        totalCompanies: allCompanies.length,
        recalibrated: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error).length,
        results,
      };
    } catch (error) {
      console.error("Error recalibrating all companies:", error);
      throw new Error(`Failed to recalibrate all companies: ${error.message}`);
    }
  },

  /**
   * Trigger recalibration when activity changes occur
   * This should be called whenever activities are updated, deleted, or status changed
   */
  async handleActivityChange(activityData, changeType = 'update') {
    try {
      // Determine which company this activity belongs to
      const companyName = activityData.company || activityData.companyName;
      
      if (!companyName) {
        console.warn("Activity has no company name, skipping recalibration");
        return;
      }

      // Find the company
      const company = await this.getCompanyByName(companyName);
      
      if (!company) {
        console.warn(`Company ${companyName} not found, skipping recalibration`);
        return;
      }

      // Recalibrate this specific company
      await this.recalibrateCompanyData(company.id);
      
    } catch (error) {
      console.error("Error handling activity change:", error);
      // Don't throw error here as it's not critical for the main operation
    }
  }
};
