// components/ConfirmDialog.jsx
import React from "react";
import { AlertCircleIcon, XIcon } from "./icons";

const ConfirmDialog = ({
  isOpen,
  onClose,
  onCancel, // Also accept onCancel for compatibility
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning", // 'warning', 'danger', 'info'
  Button,
}) => {
  if (!isOpen) return null;

  // Use onCancel if provided, otherwise use onClose
  const handleClose = onCancel || onClose;

  const typeStyles = {
    warning: {
      iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      confirmBtn: "bg-yellow-600 hover:bg-yellow-700 text-white",
    },
    danger: {
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      confirmBtn: "bg-red-600 hover:bg-red-700 text-white",
    },
    info: {
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      confirmBtn: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  const style = typeStyles[type] || typeStyles.warning;

  const handleConfirm = () => {
    if (typeof onConfirm === "function") {
      onConfirm();
    }
    if (typeof handleClose === "function") {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={() => typeof handleClose === "function" && handleClose()}
        />

        {/* Center the modal */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white dark:bg-gray-900 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 z-[10000]">
          <div className="sm:flex sm:items-start">
            <div
              className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${style.iconBg} sm:mx-0 sm:h-10 sm:w-10`}
            >
              <AlertCircleIcon className={`h-6 w-6 ${style.iconColor}`} />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
            <button
              onClick={() => typeof handleClose === "function" && handleClose()}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-[10001]"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
            {Button ? (
              <>
                <Button
                  onClick={handleConfirm}
                  className={`w-full sm:w-auto ${style.confirmBtn}`}
                >
                  {confirmText}
                </Button>
                <Button
                  onClick={() =>
                    typeof handleClose === "function" && handleClose()
                  }
                  variant="outline"
                  className="mt-3 sm:mt-0 w-full sm:w-auto"
                >
                  {cancelText}
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={handleConfirm}
                  className={`w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-md ${style.confirmBtn}`}
                >
                  {confirmText}
                </button>
                <button
                  onClick={() =>
                    typeof handleClose === "function" && handleClose()
                  }
                  className="mt-3 sm:mt-0 w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  {cancelText}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
