// components/CacheLoader.jsx
import React, { useEffect, useState } from 'react';
import { studentsService } from '../lib/studentsService';

export default function CacheLoader({ children, onCacheReady }) {
  const [cacheStatus, setCacheStatus] = useState({
    isLoading: false,
    loaded: false,
    error: null,
    stats: null
  });

  useEffect(() => {
    const initializeCache = async () => {
      setCacheStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        // Initializing student cache
        
        // Try to preload the cache
        const result = await studentsService.preloadStudentsCache();
        
        if (result) {
          const stats = studentsService.getStudentsCacheStats();
          setCacheStatus({
            isLoading: false,
            loaded: true,
            error: null,
            stats
          });
          
          // Student cache initialized successfully
          
          if (onCacheReady) {
            onCacheReady(stats);
          }
        } else {
          throw new Error("Cache preload returned false");
        }
        
      } catch (error) {
        console.error("Failed to initialize student cache:", error);
        setCacheStatus({
          isLoading: false,
          loaded: false,
          error: error.message,
          stats: null
        });
      }
    };

    // Initialize cache on component mount
    initializeCache();

    // Set up periodic cache refresh (every 10 minutes)
    const refreshInterval = setInterval(async () => {
      try {
        const stats = studentsService.getStudentsCacheStats();
        if (stats.needsRefresh) {
          // Refreshing student cache
          await studentsService.refreshStudentsCache();
          const newStats = studentsService.getStudentsCacheStats();
          setCacheStatus(prev => ({ ...prev, stats: newStats }));
          // Cache refreshed
        }
      } catch (error) {
        console.error("Error during cache refresh:", error);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => {
      clearInterval(refreshInterval);
    };
  }, [onCacheReady]);

  // If there's a critical error, we can still render the children
  // The cache will fallback to direct database access
  return (
    <>
      {children}
      {/* Optional: Add a cache status indicator */}
      {process.env.NODE_ENV === 'development' && (
        <CacheStatusIndicator status={cacheStatus} />
      )}
    </>
  );
}

// Development-only cache status indicator
function CacheStatusIndicator({ status }) {
  if (!status.stats) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded max-w-xs z-50"
      style={{ fontSize: '10px' }}
    >
      <div className="font-bold mb-1">Student Cache Status</div>
      <div>Students: {status.stats.totalStudents}</div>
      <div>Departments: {status.stats.departmentsLoaded}</div>
      <div>Age: {status.stats.cacheAge ? Math.floor(status.stats.cacheAge / 1000) + 's' : 'N/A'}</div>
      <div>Status: {status.isLoading ? 'Loading...' : status.loaded ? '✅ Ready' : '❌ Error'}</div>
      {status.error && <div className="text-red-300">Error: {status.error}</div>}
    </div>
  );
}
