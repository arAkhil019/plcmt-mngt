// components/Toast.jsx
import React, { useState, useEffect } from 'react';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon, TrashIcon } from './icons';

const Toast = ({ id, type = 'info', title, message, duration = 5000, onClose }) => {
  useEffect(() => {
    if (duration > 0 && typeof onClose === 'function') {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const typeStyles = {
    success: {
      container: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      title: 'text-green-800 dark:text-green-200',
      message: 'text-green-700 dark:text-green-300',
      IconComponent: CheckCircleIcon
    },
    error: {
      container: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-800 dark:text-red-200',
      message: 'text-red-700 dark:text-red-300',
      IconComponent: AlertCircleIcon
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-800 dark:text-yellow-200',
      message: 'text-yellow-700 dark:text-yellow-300',
      IconComponent: AlertCircleIcon
    },
    info: {
      container: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      message: 'text-blue-700 dark:text-blue-300',
      IconComponent: InfoIcon
    }
  };

  const style = typeStyles[type] || typeStyles.info;
  const IconComponent = style.IconComponent;

  return (
    <div className={`min-w-80 max-w-md w-auto ${style.container} border rounded-lg shadow-lg p-4 animate-in slide-in-from-right-5 duration-300`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <IconComponent className={`h-5 w-5 ${style.icon}`} />
        </div>
        <div className="ml-3 flex-1 min-w-0">
          {title && (
            <p className={`text-sm font-medium ${style.title} break-words`}>
              {title}
            </p>
          )}
          <p className={`text-sm ${style.message} ${title ? 'mt-1' : ''} break-words whitespace-pre-wrap`}>
            {message}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            className={`inline-flex ${style.icon} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded-md p-1`}
            onClick={() => typeof onClose === 'function' && onClose(id)}
          >
            <span className="sr-only">Close</span>
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
