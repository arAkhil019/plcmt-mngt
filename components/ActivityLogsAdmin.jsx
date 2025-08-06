'use client';

import React, { useState, useEffect } from 'react';
import { activityLogsService } from '../lib/activityLogsService';

const ACTIVITY_LOG_CATEGORIES = {
  AUTHENTICATION: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET'],
  ACTIVITY_MANAGEMENT: ['CREATE_ACTIVITY', 'EDIT_ACTIVITY', 'DELETE_ACTIVITY', 'CHANGE_ACTIVITY_STATUS'],
  ATTENDANCE_SCANNING: ['SCAN_ADMISSION_NUMBER', 'BULK_SCAN_ADMISSIONS', 'REMOVE_SCANNED_ADMISSION', 'COMPLETE_SCANNING_SESSION'],
  COMPANY_MANAGEMENT: ['CREATE_COMPANY', 'EDIT_COMPANY', 'DELETE_COMPANY'],
  USER_MANAGEMENT: ['CREATE_USER', 'EDIT_USER', 'DELETE_USER', 'APPROVE_USER'],
  SYSTEM: ['ERROR_OCCURRED', 'SYSTEM_BACKUP', 'DATA_EXPORT'],
  OTHER: []
};

const ActivityLogsAdmin = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    category: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
    limit: 100
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(25);

  // View modes
  const [viewMode, setViewMode] = useState('table'); // 'table', 'timeline', 'statistics'
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load recent logs and statistics
      const [recentLogs, stats] = await Promise.all([
        activityLogsService.getRecentActivitySummary(200),
        activityLogsService.getActivityStatistics(7)
      ]);

      setLogs(recentLogs.logs || []);
      setStatistics(stats);
      setError(null);
    } catch (err) {
      console.error('Error loading activity logs:', err);
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    try {
      let result = logs;

      // Apply filters
      if (filters.category && filters.category !== '') {
        const categoryActions = ACTIVITY_LOG_CATEGORIES[filters.category];
        result = result.filter(log => categoryActions.includes(log.action));
      }

      if (filters.action && filters.action !== '') {
        result = result.filter(log => log.action === filters.action);
      }

      if (filters.userId && filters.userId !== '') {
        result = result.filter(log => 
          log.userId.includes(filters.userId) || 
          log.userName?.toLowerCase().includes(filters.userId.toLowerCase()) ||
          log.userEmail?.toLowerCase().includes(filters.userId.toLowerCase())
        );
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        result = result.filter(log => new Date(log.timestamp) >= startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        result = result.filter(log => new Date(log.timestamp) <= endDate);
      }

      // Sort by timestamp (newest first)
      result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setFilteredLogs(result);
      setCurrentPage(1); // Reset to first page when filters change
    } catch (err) {
      console.error('Error applying filters:', err);
    }
  };

  const loadMoreLogs = async () => {
    try {
      setLoading(true);
      const moreLogs = await activityLogsService.getLogsWithFilters({
        ...filters,
        limit: filters.limit + 50
      });
      setLogs(moreLogs);
    } catch (err) {
      console.error('Error loading more logs:', err);
      setError('Failed to load more logs');
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      const exportData = filteredLogs.map(log => ({
        timestamp: log.timestamp,
        user: `${log.userName} (${log.userEmail})`,
        action: log.action,
        description: log.description,
        category: getCategoryByAction(log.action),
        metadata: JSON.stringify(log.metadata || {})
      }));

      const csv = convertToCSV(exportData);
      downloadCSV(csv, `activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      console.error('Error exporting logs:', err);
      alert('Failed to export logs');
    }
  };

  const getCategoryByAction = (action) => {
    for (const [category, actions] of Object.entries(ACTIVITY_LOG_CATEGORIES)) {
      if (actions.includes(action)) {
        return category;
      }
    }
    return 'OTHER';
  };

  const convertToCSV = (data) => {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          `"${String(row[header]).replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');
    
    return csvContent;
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionColor = (action) => {
    if (action.includes('LOGIN')) return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    if (action.includes('LOGOUT')) return 'text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    if (action.includes('DELETE')) return 'text-rose-700 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
    if (action.includes('CREATE')) return 'text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    if (action.includes('EDIT')) return 'text-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
    if (action.includes('SCAN')) return 'text-violet-700 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800';
    return 'text-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
  };

  // Pagination logic
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity Logs Administration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor and analyze system activity</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={loadInitialData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* View Mode Selector */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {['table', 'timeline', 'statistics'].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              viewMode === mode
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {Object.keys(ACTIVITY_LOG_CATEGORIES).map(category => (
                <option key={category} value={category}>
                  {category.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
              placeholder="Search by name or email"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
          <button
            onClick={() => setFilters({
              category: '',
              action: '',
              userId: '',
              startDate: '',
              endDate: '',
              limit: 100
            })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'statistics' && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Total Activities</h3>
            <p className="text-3xl font-bold text-blue-600">{statistics.totalActivities}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Last 7 days</p>
          </div>

          <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Unique Users</h3>
            <p className="text-3xl font-bold text-green-600">{statistics.uniqueUsers}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active users</p>
          </div>

          <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Active Sessions</h3>
            <p className="text-3xl font-bold text-purple-600">{statistics.recentSessions}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Unique sessions</p>
          </div>

          <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Top Action</h3>
            {Object.keys(statistics.actionBreakdown).length > 0 && (
              <>
                <p className="text-xl font-bold text-orange-600">
                  {Object.keys(statistics.actionBreakdown).reduce((a, b) => 
                    statistics.actionBreakdown[a] > statistics.actionBreakdown[b] ? a : b
                  ).replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.max(...Object.values(statistics.actionBreakdown))} occurrences
                </p>
              </>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity by Category</h3>
            <div className="space-y-2">
              {Object.entries(statistics.categoryBreakdown).map(([category, count]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{category.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(statistics.categoryBreakdown))) * 100}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Activity */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Activity</h3>
            <div className="space-y-2">
              {Object.entries(statistics.dailyActivity)
                .sort(([a], [b]) => new Date(b) - new Date(a))
                .slice(0, 7)
                .map(([date, count]) => (
                <div key={date} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{date}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(statistics.dailyActivity))) * 100}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                {currentLogs.map((log, index) => (
                  <React.Fragment key={log.id || index}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.userName}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{log.userEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {getCategoryByAction(log.action).replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-md truncate">
                        {log.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                        >
                          {expandedLog === log.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                          <div className="space-y-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">Metadata:</h4>
                            <pre className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-700 overflow-auto max-h-40">
                              {JSON.stringify(log.metadata || {}, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white dark:bg-gray-950 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing <span className="font-medium">{indexOfFirstLog + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(indexOfLastLog, filteredLogs.length)}</span> of{' '}
                    <span className="font-medium">{filteredLogs.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600'
                              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="space-y-6">
            {currentLogs.map((log, index) => (
              <div key={log.id || index} className="flex">
                <div className="flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full mt-2 ${
                    log.action.includes('LOGIN') ? 'bg-green-400' :
                    log.action.includes('LOGOUT') ? 'bg-orange-400' :
                    log.action.includes('SCAN') ? 'bg-purple-400' :
                    log.action.includes('CREATE') ? 'bg-blue-400' :
                    log.action.includes('DELETE') ? 'bg-red-400' : 'bg-gray-400'
                  }`}></div>
                  {index < currentLogs.length - 1 && (
                    <div className="w-0.5 h-16 bg-gray-200 dark:bg-gray-700 ml-1.5 mt-1"></div>
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {log.userName} - {log.action.replace(/_/g, ' ')}
                    </h3>
                    <time className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(log.timestamp)}
                    </time>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{log.description}</p>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Category: {getCategoryByAction(log.action).replace(/_/g, ' ')}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="ml-2">• Additional data available</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for timeline */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <nav className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>
      )}

      {filteredLogs.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">No activity logs found</div>
          <p className="text-gray-400 dark:text-gray-500 mt-2">Try adjusting your filters or check back later</p>
        </div>
      )}

      {filteredLogs.length >= filters.limit && (
        <div className="text-center py-4">
          <button
            onClick={loadMoreLogs}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More Logs'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogsAdmin;
