// lib/studentsCache.js
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase.js";
import { admissionNumberParser } from "./admissionNumberParser.js";

class StudentsCache {
  constructor() {
    this.cache = new Map(); // admissionNumber -> student data
    this.rollNumberCache = new Map(); // rollNumber -> student data
    this.departmentCollections = new Map(); // collectionName -> Set of students
    this.lastRefresh = null;
    this.refreshInterval = 5 * 60 * 1000; // 5 minutes
    this.isLoading = false;
    this.loadingPromise = null;
    this.departmentStats = new Map(); // Track department stats for optimization
  }

  // Check if cache needs refresh
  needsRefresh() {
    if (!this.lastRefresh) return true;
    return Date.now() - this.lastRefresh > this.refreshInterval;
  }

  // Get department stats to know which collections to load
  async getDepartmentStats() {
    if (this.departmentStats.size > 0 && !this.needsRefresh()) {
      return Array.from(this.departmentStats.values());
    }

    try {
      // Use single where clause to avoid composite index requirement
      const statsQuery = query(
        collection(db, 'stats'),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(statsQuery);
      this.departmentStats.clear();

      const departments = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Filter totalStudents > 0 in JavaScript instead of Firestore
        if ((data.totalStudents || 0) > 0) {
          const dept = {
            id: doc.id,
            name: data.name,
            collectionName: data.collectionName,
            totalStudents: data.totalStudents || 0,
            activeStudents: data.activeStudents || 0
          };
          this.departmentStats.set(doc.id, dept);
          departments.push(dept);
        }
      });

      return departments;
    } catch (error) {
      console.error("Error fetching department stats:", error);
      return [];
    }
  }

  // Load all students from a specific department collection
  async loadDepartmentCollection(collectionName) {
    if (this.departmentCollections.has(collectionName)) {
      return this.departmentCollections.get(collectionName);
    }

    try {
      console.log(`Loading students from ${collectionName}...`);
      const q = query(
        collection(db, collectionName),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const students = new Set();

      snapshot.forEach((doc) => {
        const studentData = doc.data();
        const parseResult = admissionNumberParser.parseAdmissionNumber(studentData.admissionNumber);
        
        const student = {
          id: doc.id,
          name: studentData.name || "N/A",
          rollNumber: studentData.rollNumber || "N/A",
          admissionNumber: studentData.admissionNumber || "N/A",
          department: studentData.department || parseResult?.departmentInfo?.fullName || "N/A",
          departmentCode: studentData.departmentCode || parseResult?.sectionCode || "N/A",
          year: studentData.year || "N/A",
          isActive: studentData.isActive,
          collectionName: collectionName,
          createdAt: studentData.createdAt?.toDate?.()?.toISOString() || studentData.createdAt,
          updatedAt: studentData.updatedAt?.toDate?.()?.toISOString() || studentData.updatedAt
        };

        // Add to main caches
        this.cache.set(student.admissionNumber, student);
        if (student.rollNumber && student.rollNumber !== "N/A") {
          this.rollNumberCache.set(student.rollNumber, student);
        }
        
        students.add(student);
      });

      this.departmentCollections.set(collectionName, students);
      console.log(`Loaded ${students.size} students from ${collectionName}`);
      return students;
      
    } catch (error) {
      console.error(`Error loading collection ${collectionName}:`, error);
      return new Set();
    }
  }

  // Smart loading: Load only the collections needed for specific admission numbers
  async smartLoadForAdmissionNumbers(admissionNumbers) {
    const collectionsToLoad = new Set();
    
    // Determine which collections we need based on admission number patterns
    for (const admissionNumber of admissionNumbers) {
      const targetCollection = admissionNumberParser.getTargetCollection(admissionNumber);
      if (targetCollection && !this.departmentCollections.has(targetCollection)) {
        collectionsToLoad.add(targetCollection);
      }
    }

    // Load the required collections in parallel
    if (collectionsToLoad.size > 0) {
      console.log(`Smart loading ${collectionsToLoad.size} collections:`, Array.from(collectionsToLoad));
      await Promise.all(
        Array.from(collectionsToLoad).map(collection => this.loadDepartmentCollection(collection))
      );
    }
  }

  // Load all students from all active departments
  async loadAllStudents(forceRefresh = false) {
    if (this.isLoading && this.loadingPromise) {
      return this.loadingPromise;
    }

    if (!forceRefresh && !this.needsRefresh() && this.cache.size > 0) {
      return {
        totalStudents: this.cache.size,
        departments: this.departmentCollections.size,
        cached: true
      };
    }

    this.isLoading = true;
    
    this.loadingPromise = this._performFullLoad();
    
    try {
      const result = await this.loadingPromise;
      this.lastRefresh = Date.now();
      return result;
    } finally {
      this.isLoading = false;
      this.loadingPromise = null;
    }
  }

  async _performFullLoad() {
    try {
      // Starting full student cache refresh
      
      // Clear existing cache
      this.cache.clear();
      this.rollNumberCache.clear();
      this.departmentCollections.clear();

      // Get active departments
      const departments = await this.getDepartmentStats();
      
      if (departments.length === 0) {
        console.warn("No active departments found");
        return { totalStudents: 0, departments: 0 };
      }

      // Load all department collections in parallel
      const loadPromises = departments.map(dept => 
        this.loadDepartmentCollection(dept.collectionName)
      );

      await Promise.all(loadPromises);

      const totalStudents = this.cache.size;
      // Cache refresh complete: ${totalStudents} students from ${departments.length} departments
      
      return {
        totalStudents,
        departments: departments.length,
        cached: false
      };
      
    } catch (error) {
      console.error("Error during full cache load:", error);
      throw error;
    }
  }

  // Optimized search by admission number (uses cache)
  async searchByAdmissionNumber(admissionNumber) {
    try {
      // First check if we have this student in cache
      if (this.cache.has(admissionNumber)) {
        const student = this.cache.get(admissionNumber);
        return {
          found: true,
          student,
          department: student.department,
          collectionName: student.collectionName,
          fromCache: true
        };
      }

      // If not in cache, try smart loading for this specific admission number
      await this.smartLoadForAdmissionNumbers([admissionNumber]);
      
      // Check cache again after smart loading
      if (this.cache.has(admissionNumber)) {
        const student = this.cache.get(admissionNumber);
        return {
          found: true,
          student,
          department: student.department,
          collectionName: student.collectionName,
          fromCache: false,
          smartLoaded: true
        };
      }

      // If still not found, student doesn't exist
      return {
        found: false,
        error: `Student with admission number ${admissionNumber} not found`,
        fromCache: true
      };
      
    } catch (error) {
      console.error(`Error searching for admission number ${admissionNumber}:`, error);
      return {
        found: false,
        error: `Search failed: ${error.message}`,
        fromCache: false
      };
    }
  }

  // Optimized search by roll number (uses cache)
  async searchByRollNumber(rollNumber) {
    try {
      // First check if we have this student in cache
      if (this.rollNumberCache.has(rollNumber)) {
        const student = this.rollNumberCache.get(rollNumber);
        return {
          found: true,
          student,
          department: student.department,
          collectionName: student.collectionName,
          fromCache: true
        };
      }

      // If not in cache, we need to load more data
      // For roll numbers, we can't predict the collection, so load all if needed
      if (this.cache.size === 0 || this.needsRefresh()) {
        await this.loadAllStudents();
        
        // Check cache again after loading
        if (this.rollNumberCache.has(rollNumber)) {
          const student = this.rollNumberCache.get(rollNumber);
          return {
            found: true,
            student,
            department: student.department,
            collectionName: student.collectionName,
            fromCache: false
          };
        }
      }

      return {
        found: false,
        error: `Student with roll number ${rollNumber} not found`,
        fromCache: true
      };
      
    } catch (error) {
      console.error(`Error searching for roll number ${rollNumber}:`, error);
      return {
        found: false,
        error: `Search failed: ${error.message}`,
        fromCache: false
      };
    }
  }

  // Optimized batch search (uses cache)
  async batchSearchByAdmissionNumbers(admissionNumbers) {
    try {
      const results = {
        found: [],
        notFound: [],
        errors: []
      };

      // First, try smart loading for all the admission numbers
      await this.smartLoadForAdmissionNumbers(admissionNumbers);

      // Process each admission number
      for (const admissionNumber of admissionNumbers) {
        try {
          if (this.cache.has(admissionNumber)) {
            const student = this.cache.get(admissionNumber);
            results.found.push({
              admissionNumber,
              student,
              department: student.department,
              collectionName: student.collectionName,
              fromCache: true
            });
          } else {
            results.notFound.push({
              admissionNumber,
              error: `Student not found`,
              fromCache: true
            });
          }
        } catch (error) {
          results.errors.push({
            admissionNumber,
            error: error.message,
            fromCache: false
          });
        }
      }

      return {
        summary: {
          total: admissionNumbers.length,
          found: results.found.length,
          notFound: results.notFound.length,
          errors: results.errors.length,
          fromCache: true
        },
        ...results
      };
      
    } catch (error) {
      console.error("Error in cached batch search:", error);
      throw new Error("Failed to perform cached batch search");
    }
  }

  // Get cache statistics
  getCacheStats() {
    return {
      totalStudents: this.cache.size,
      totalByRollNumber: this.rollNumberCache.size,
      departmentsLoaded: this.departmentCollections.size,
      lastRefresh: this.lastRefresh,
      needsRefresh: this.needsRefresh(),
      isLoading: this.isLoading,
      cacheAge: this.lastRefresh ? Date.now() - this.lastRefresh : null
    };
  }

  // Force refresh the cache
  async forceRefresh() {
    return this.loadAllStudents(true);
  }

  // Clear the cache
  clearCache() {
    this.cache.clear();
    this.rollNumberCache.clear();
    this.departmentCollections.clear();
    this.departmentStats.clear();
    this.lastRefresh = null;
    // Student cache cleared
  }

  // Preload cache for better performance
  async preloadCache() {
    try {
      // Preloading student cache
      await this.loadAllStudents();
      // Student cache preloaded successfully
      return true;
    } catch (error) {
      console.error("Error preloading cache:", error);
      return false;
    }
  }
}

// Create a singleton instance
export const studentsCache = new StudentsCache();

// Export the class for testing or multiple instances if needed
export { StudentsCache };
