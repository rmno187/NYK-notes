import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { syncManager } from '../lib/vercelSync/syncManager';
import { SyncStatus } from '../types';

interface SyncStatusIndicatorProps {
  onOpenSyncModal: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ onOpenSyncModal }) => {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

  useEffect(() => {
    const unsubscribe = syncManager.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  // Only display something if there is an error
  if (status !== 'error') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpenSyncModal}
      title="Sync error occurred. Click to inspect or reconnect."
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/70 transition-all shadow-xs shrink-0"
    >
      <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
      <span>Sync Error</span>
    </button>
  );
};

