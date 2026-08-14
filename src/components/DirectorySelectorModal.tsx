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
      className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-black rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white rounded-lg">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Storage Destination
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Choose where your markdown files are stored
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Option 1: Native Local Directory */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentMode === 'filesystem'
                ? 'bg-neutral-100/80 dark:bg-neutral-900 border-black dark:border-white shadow-2xs'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <FolderOpen className="w-5 h-5 text-neutral-900 dark:text-neutral-100 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
                    <span>Local Disk Directory</span>
                    {currentMode === 'filesystem' && (
                      <span className="px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black text-[10px] rounded font-mono font-medium">
                        Active
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Saves notes directly as standard <code className="font-mono text-neutral-900 dark:text-neutral-100">.md</code> files on your computer.
                  </p>
                  {currentMode === 'filesystem' && directoryName && (
                    <p className="text-xs font-mono font-medium text-neutral-800 dark:text-neutral-200 mt-2">
                      Folder: {directoryName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              {fsSupported ? (
                <button
                  onClick={handleChooseDirectory}
                  disabled={loading}
                  className="py-1.5 px-3 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-2xs"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{directoryName ? 'Change Directory' : 'Select Directory'}</span>
                </button>
              ) : (
                <div className="text-[11px] text-neutral-500 flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>File System API restricted in this browser frame.</span>
                </div>
              )}
            </div>
          </div>

          {/* Option 2: IndexedDB Browser Storage */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentMode === 'indexeddb'
                ? 'bg-neutral-100/80 dark:bg-neutral-900 border-black dark:border-white shadow-2xs'
                : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <Database className="w-5 h-5 text-neutral-900 dark:text-neutral-100 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
                    <span>Browser Storage (IndexedDB)</span>
                    {currentMode === 'indexeddb' && (
                      <span className="px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black text-[10px] rounded font-mono font-medium">
                        Active
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Fast client-side browser database storage.
                  </p>
                </div>
              </div>
            </div>

            {currentMode !== 'indexeddb' && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => {
                    onSwitchToIndexedDB();
                    onClose();
                  }}
                  className="py-1.5 px-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg text-xs font-medium transition-colors"
                >
                  Switch to IndexedDB
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-black border-t border-neutral-200 dark:border-neutral-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-semibold rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
