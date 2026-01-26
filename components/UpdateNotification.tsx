import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface UpdateNotificationProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export default function UpdateNotification({ onUpdate, onDismiss }: UpdateNotificationProps) {
  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 animate-slide-down"
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0">
                <RefreshCw className="h-5 w-5 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm sm:text-base">
                  A new version of ProcureFlow is available!
                </p>
                <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
                  Update now to get the latest features and improvements.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onUpdate}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
              >
                Update Now
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-2 text-white hover:bg-blue-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
                aria-label="Dismiss notification"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
