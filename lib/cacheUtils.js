// lib/cacheUtils.js
import { studentsService } from "./studentsService.js";

/**
 * Cache management utilities for optimizing student data access
 */
export const cacheUtils = {
  
  // Preload cache for specific admission number patterns
  async preloadForActivityBatch(admissionNumbers) {
    try {
      // Preloading cache for admission numbers
      
      // Use the smart loading feature to only load necessary collections
      const result = await studentsService.batchSearchByAdmissionNumbers(
        admissionNumbers.slice(0, 10), // Sample first 10 to trigger smart loading
        { useCache: true }
      );
      
      console.log(`Preload completed. Found ${result.summary.found} students.`);
      return result;
    } catch (error) {
      console.error("Error preloading cache for activity batch:", error);
      return null;
    }
  },

  // Get cache performance metrics
  getCachePerformance() {
    const stats = studentsService.getStudentsCacheStats();
    
    return {
      efficiency: stats.totalStudents > 0 ? (stats.totalStudents / (stats.departmentsLoaded || 1)) : 0,
      isHealthy: stats.totalStudents > 0 && !stats.needsRefresh,
      ageInMinutes: stats.cacheAge ? Math.floor(stats.cacheAge / 1000 / 60) : 0,
      recommendation: this._getCacheRecommendation(stats)
    };
  },

  // Get cache recommendations based on current state
  _getCacheRecommendation(stats) {
    if (!stats.totalStudents) return "Cache not loaded - performance may be slow";
    if (stats.needsRefresh) return "Cache needs refresh for optimal performance";
    if (stats.cacheAge > 10 * 60 * 1000) return "Cache is aging - consider refresh";
    return "Cache is optimal";
  },

  // Warm up cache with common search patterns
  async warmupCache() {
    try {
      // Warming up student cache
      
      // Force a full cache load
      await studentsService.preloadStudentsCache();
      
      const stats = studentsService.getStudentsCacheStats();
      // Cache warmup complete
      
      return stats;
    } catch (error) {
      console.error("Error warming up cache:", error);
      return null;
    }
  },

  // Optimize search method selection based on batch size and cache state
  async optimizeSearchMethod(admissionNumbers, options = {}) {
    const stats = studentsService.getStudentsCacheStats();
    const batchSize = admissionNumbers.length;
    
    // Decision matrix for search method
    let recommendedMethod = 'direct';
    let reason = 'Small batch size';
    
    if (batchSize >= 50) {
      recommendedMethod = 'cached';
      reason = 'Large batch - cache is more efficient';
    } else if (batchSize >= 20 && stats.totalStudents > 1000) {
      recommendedMethod = 'cached';
      reason = 'Medium batch with loaded cache';
    } else if (stats.needsRefresh) {
      recommendedMethod = 'direct';
      reason = 'Cache needs refresh';
    }
    
    const searchOptions = {
      ...options,
      useCache: recommendedMethod === 'cached',
      forceDirect: recommendedMethod === 'direct'
    };
    
    console.log(`Search optimization: ${recommendedMethod} (${reason}) for ${batchSize} students`);
    
    return {
      method: recommendedMethod,
      reason,
      options: searchOptions
    };
  },

  // Monitor and log cache hit rates
  async monitorCachePerformance(operation, studentIds) {
    const startTime = Date.now();
    const initialStats = studentsService.getStudentsCacheStats();
    
    try {
      const result = await operation();
      const endTime = Date.now();
      const finalStats = studentsService.getStudentsCacheStats();
      
      const performance = {
        duration: endTime - startTime,
        studentCount: studentIds.length,
        cacheHits: finalStats.totalStudents - initialStats.totalStudents,
        efficiency: studentIds.length > 0 ? (endTime - startTime) / studentIds.length : 0
      };
      
      // Cache performance tracking
      return { result, performance };
      
    } catch (error) {
      console.error('Cache operation failed:', error);
      return { result: null, performance: null, error };
    }
  },

  // Intelligent cache refresh strategy
  async intelligentRefresh() {
    const stats = studentsService.getStudentsCacheStats();
    
    // Only refresh if needed
    if (!stats.needsRefresh && stats.totalStudents > 0) {
      // Cache refresh not needed
      return stats;
    }
    
    try {
      // Starting intelligent cache refresh
      const result = await studentsService.refreshStudentsCache();
      const newStats = studentsService.getStudentsCacheStats();
      
      // Cache refresh completed
      return newStats;
    } catch (error) {
      console.error("Error during intelligent refresh:", error);
      return stats;
    }
  },

  // Batch operation optimizer
  async optimizedBatchOperation(admissionNumbers, operation, options = {}) {
    const { 
      batchSize = 50,
      useCache = null,
      progressCallback = null 
    } = options;
    
    // Automatically determine if we should use cache
    const optimization = await this.optimizeSearchMethod(admissionNumbers, { useCache });
    
    const results = [];
    const errors = [];
    
    // Process in chunks
    for (let i = 0; i < admissionNumbers.length; i += batchSize) {
      const chunk = admissionNumbers.slice(i, i + batchSize);
      
      try {
        if (progressCallback) {
          progressCallback({
            current: i,
            total: admissionNumbers.length,
            chunk: chunk.length
          });
        }
        
        const chunkResult = await operation(chunk, optimization.options);
        results.push(chunkResult);
        
        // Small delay between chunks to prevent overwhelming
        if (i + batchSize < admissionNumbers.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
      } catch (error) {
        console.error(`Error processing chunk ${i}-${i + batchSize}:`, error);
        errors.push({ chunk: i, error: error.message });
      }
    }
    
    return {
      results,
      errors,
      optimization,
      summary: {
        totalProcessed: admissionNumbers.length,
        chunks: Math.ceil(admissionNumbers.length / batchSize),
        errors: errors.length
      }
    };
  }
};

// Export cache events for external monitoring
export const CACHE_EVENTS = {
  LOADED: 'cache_loaded',
  REFRESHED: 'cache_refreshed',
  ERROR: 'cache_error',
  SEARCH_PERFORMED: 'cache_search'
};

// Cache event emitter for monitoring
class CacheEventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in cache event listener for ${event}:`, error);
        }
      });
    }
  }

  off(event, listener) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== listener);
    }
  }
}

export const cacheEvents = new CacheEventEmitter();
