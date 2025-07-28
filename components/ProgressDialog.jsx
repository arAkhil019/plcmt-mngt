// components/ProgressDialog.jsx
import React from 'react';
import { RefreshIcon } from './icons';

const ProgressDialog = ({ 
  isOpen, 
  title = 'Processing...', 
  message = 'Please wait while we process your request.',
  progress = null, // { current: number, total: number }
  allowClose = false,
  onClose,
  Button 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50" />

        {/* Center the modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full sm:p-6 z-[10000]">
          <div className="text-center">
            {/* Spinning icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
              <RefreshIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 whitespace-pre-line">
              {message}
            </p>

            {/* Progress bar */}
            {progress && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{progress.current} of {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {Math.round((progress.current / progress.total) * 100)}% complete
                </div>
              </div>
            )}

            {allowClose && onClose && (
              Button ? (
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressDialog;
