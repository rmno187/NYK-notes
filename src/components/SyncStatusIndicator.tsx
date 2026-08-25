import React, { useState, useEffect } from 'react';
import { RefreshCw, ShieldCheck, WifiOff, AlertCircle, Lock } from 'lucide-react';
import { syncManager } from '../lib/vercelSync/syncManager';
import { SyncStatus } from '../types';

interface SyncStatusIndicatorProps {
  onOpenSyncModal: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ onOpenSyncModal }) => {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());
  const [lastSyncedAt, setLastSyncedAt] = useState<number | undefined>(syncManager.getConfig()?.lastSyncedAt);

  useEffect(() => {
    const unsubscribe = syncManager.subscribeStatus((newStatus, timestamp) => {
      setStatus(newStatus);
      setLastSyncedAt(timestamp);
    });
    return () => unsubscribe();
  }, []);

  if (status === 'unconfigured') {
    return (
      <button
        type="button"
        onClick={onOpenSyncModal}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
        title="Vercel Sync is not yet configured on this device. Click to set up."
      >
        <Lock className="w-3.5 h-3.5" />
        <span>Setup Sync</span>
      </button>
    );
  }

  const getStatusDisplay = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />,
          label: 'Syncing…',
          title: 'Synchronizing encrypted changes with Vercel…',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
        };
      case 'offline':
        return {
          icon: <WifiOff className="w-3 h-3 text-neutral-500" />,
          label: 'Offline',
          title: 'Offline. Local changes queued and will sync when network returns.',
          color: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3 h-3 text-rose-500" />,
          label: 'Sync Error',
          title: 'Sync error occurred. Click to inspect or re-authenticate.',
          color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50',
        };
      case 'synced':
      default:
        return {
          icon: <ShieldCheck className="w-3 h-3 text-emerald-500" />,
          label: 'Synced',
          title: lastSyncedAt
            ? `Synced end-to-end (${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
            : 'Synced end-to-end',
          color: 'text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800',
        };
    }
  };

  const display = getStatusDisplay();

  return (
    <button
      type="button"
      onClick={onOpenSyncModal}
      title={display.title}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${display.color} hover:opacity-90 transition-all`}
    >
      {display.icon}
      <span>{display.label}</span>
    </button>
  );
};
