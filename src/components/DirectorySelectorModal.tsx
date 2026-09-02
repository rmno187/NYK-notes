import React, { useState } from 'react';
import { FolderOpen, Database, Lock, ShieldCheck, X, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { StorageMode } from '../types';
import { isFileSystemAccessSupported } from '../lib/storage';
import { syncManager } from '../lib/vercelSync/syncManager';

interface DirectorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: StorageMode;
  directoryName?: string;
  onSelectLocalDirectory: () => Promise<void>;
  onSwitchToIndexedDB: () => void;
  onSwitchToVercelSync: () => void;
  onOpenSyncSettings: () => void;
  onOpenLocalFolderSyncModal?: () => void;
}

export const DirectorySelectorModal: React.FC<DirectorySelectorModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  directoryName,
  onSelectLocalDirectory,
  onSwitchToIndexedDB,
  onSwitchToVercelSync,
  onOpenSyncSettings,
  onOpenLocalFolderSyncModal,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const fsSupported = isFileSystemAccessSupported();
  const isVercelConfigured = syncManager.isConfigured();

  const handleChooseDirectory = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSelectLocalDirectory();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to select directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVercelSync = () => {
    if (!isVercelConfigured) {
      onOpenSyncSettings();
    } else {
      onSwitchToVercelSync();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-black dark:text-white">
              Storage Provider
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              Choose where your notes are stored and synchronized.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-2">
          {/* Error */}
          {error && (
            <div className="my-2 p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Local Storage Options */}
          <div className="pt-3 pb-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
              Local
            </h3>
          </div>

          {/* 1. Local · Browser */}
          <div className="py-4 border-b border-neutral-100 dark:border-neutral-900">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-3 min-w-0">
                <Database className="w-4 h-4 mt-0.5 shrink-0 text-black dark:text-white" />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-black dark:text-white">
                      Browser
                    </h4>
                    {currentMode === 'indexeddb' && (
                      <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 max-w-md">
                    Stored locally in this browser.
                  </p>
                </div>
              </div>

              {currentMode !== 'indexeddb' && (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchToIndexedDB();
                    onClose();
                  }}
                  className="shrink-0 text-xs font-medium text-black dark:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white transition-colors"
                >
                  Switch
                </button>
              )}
            </div>
          </div>

          {/* 2. Local · Folder */}
          <div className="py-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-3 min-w-0">
                <FolderOpen className="w-4 h-4 mt-0.5 shrink-0 text-black dark:text-white" />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-black dark:text-white">
                      Folder
                    </h4>
                    {currentMode === 'filesystem' && (
                      <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 max-w-md">
                    Stored as Markdown files in a folder on this device.
                  </p>

                  {currentMode === 'filesystem' && directoryName && (
                    <p className="mt-1.5 text-xs text-neutral-800 dark:text-neutral-200 font-mono truncate">
                      {directoryName}
                    </p>
                  )}
                </div>
              </div>

              {fsSupported && (
                <button
                  type="button"
                  onClick={handleChooseDirectory}
                  disabled={loading}
                  className="shrink-0 text-xs font-medium text-black dark:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Selecting…' : directoryName && currentMode === 'filesystem' ? 'Change' : 'Choose'}
                </button>
              )}
            </div>

            {!fsSupported && (
              <div className="mt-2.5 ml-7 flex items-start gap-1.5 text-[11px] text-neutral-500">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>File System access is not supported in this browser.</span>
              </div>
            )}
          </div>

          {/* 2b. Blog Repo & Content Folders (Posts / Projects / Notes) */}
          {onOpenLocalFolderSyncModal && (
            <div className="py-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center font-mono text-xs font-bold text-black dark:text-white">
                    //
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-black dark:text-white">
                        Blog Repository & Content Folders
                      </h4>
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 max-w-md">
                      Map dedicated folders for <code className="font-mono text-[11px]">posts/</code>, <code className="font-mono text-[11px]">projects/</code>, and <code className="font-mono text-[11px]">notes/</code> for direct Git workflow sync.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLocalFolderSyncModal();
                  }}
                  className="shrink-0 text-xs font-medium text-black dark:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white transition-colors"
                >
                  Configure
                </button>
              </div>
            </div>
          )}

          {/* Section: Vercel Storage Option */}
          <div className="pt-4 pb-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-600">
              Vercel
            </h3>
          </div>

          {/* 3. Vercel · Sync */}
          <div className="py-4">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-5 h-5 mt-0.5 shrink-0 rounded flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <Lock className="w-3 h-3 text-black dark:text-white" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-black dark:text-white">
                      Sync
                    </h4>
                    {currentMode === 'vercel' && (
                      <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
                        Current
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                      <ShieldCheck className="w-2.5 h-2.5" /> E2EE
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 max-w-md">
                    End-to-end encrypted across your devices.
                  </p>

                  <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                    Encrypted on this device before sync. The server cannot read note contents.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {currentMode !== 'vercel' ? (
                  <button
                    type="button"
                    onClick={handleSelectVercelSync}
                    className="text-xs font-medium text-black dark:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white transition-colors"
                  >
                    {isVercelConfigured ? 'Switch' : 'Configure'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSyncSettings();
                    }}
                    className="text-xs text-neutral-500 hover:text-black dark:hover:text-white underline underline-offset-4"
                  >
                    Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
