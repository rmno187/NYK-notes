import React, { useState } from 'react';
import { HardDrive, Database, FolderOpen, AlertCircle, X, Info } from 'lucide-react';
import { StorageMode } from '../types';
import { isFileSystemAccessSupported } from '../lib/storage';

interface DirectorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: StorageMode;
  directoryName?: string;
  onSelectLocalDirectory: () => Promise<void>;
  onSwitchToIndexedDB: () => void;
}

export const DirectorySelectorModal: React.FC<DirectorySelectorModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  directoryName,
  onSelectLocalDirectory,
  onSwitchToIndexedDB,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const fsSupported = isFileSystemAccessSupported();

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

  return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-black dark:text-white">
            Storage
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            Choose where your notes are stored.
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
      <div className="px-5">

        {/* Error */}
        {error && (
          <div className="py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Local filesystem */}
        <div className="py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3 min-w-0">
              <FolderOpen className="w-4 h-4 mt-0.5 shrink-0 text-black dark:text-white" />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-black dark:text-white">
                    Local files
                  </h3>

                  {currentMode === 'filesystem' && (
                    <span className="text-[10px] tracking-wide uppercase text-neutral-500 dark:text-neutral-500">
                      Current
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500 max-w-md">
                  Store notes directly on your computer as standard{' '}
                  <code className="text-neutral-700 dark:text-neutral-300">
                    .md
                  </code>{' '}
                  files.
                </p>

                {currentMode === 'filesystem' && directoryName && (
                  <p className="mt-2 text-xs text-black dark:text-white truncate">
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
                {loading
                  ? 'Selecting…'
                  : directoryName
                    ? 'Change'
                    : 'Choose'}
              </button>
            )}
          </div>

          {!fsSupported && (
            <div className="mt-3 ml-7 flex items-start gap-2 text-[11px] text-neutral-500 dark:text-neutral-500">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                File system access isn't available in this browser.
              </span>
            </div>
          )}
        </div>

        {/* IndexedDB */}
        <div className="py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3 min-w-0">
              <Database className="w-4 h-4 mt-0.5 shrink-0 text-black dark:text-white" />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-black dark:text-white">
                    Browser storage
                  </h3>

                  {currentMode === 'indexeddb' && (
                    <span className="text-[10px] tracking-wide uppercase text-neutral-500 dark:text-neutral-500">
                      Current
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-500 max-w-md">
                  Store notes locally in the browser using IndexedDB.
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

      </div>
    </div>
  </div>
);
};
