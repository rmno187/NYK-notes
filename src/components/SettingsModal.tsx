import React, { useRef } from 'react';
import {
  X,
  Settings,
  Moon,
  Sun,
  HardDrive,
  Database,
  Key,
  Download,
  HelpCircle,
  ChevronRight,
  Calendar,
  AlignLeft,
} from 'lucide-react';
import { StorageMode, Theme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  showDates: boolean;
  onToggleShowDates: () => void;
  noteListPreviewMode?: 'summary' | 'full';
  onToggleNoteListPreviewMode?: () => void;
  storageMode: StorageMode;
  directoryName?: string;
  onOpenDirectoryModal: () => void;
  onOpenBackupModal: () => void;
  onOpenShortcutsModal: () => void;
  onImportMarkdownFiles: (files: FileList) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  showDates,
  onToggleShowDates,
  noteListPreviewMode = 'summary',
  onToggleNoteListPreviewMode,
  storageMode,
  directoryName,
  onOpenDirectoryModal,
  onOpenBackupModal,
  onOpenShortcutsModal,
  onImportMarkdownFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportMarkdownFiles(e.target.files);
      e.target.value = '';
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-black rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white rounded-lg shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                Settings
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                Preferences, storage & backups
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Section: Appearance & Display */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-mono">
              Appearance & Display
            </h3>

            {/* Theme Toggle */}
            <div
              onClick={onToggleTheme}
              className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors gap-2"
            >
              <div className="flex items-center space-x-3 min-w-0">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-neutral-200 shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-neutral-800 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                    Theme Mode
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="py-1 px-2.5 sm:px-3 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs font-medium rounded-lg transition-colors shrink-0"
              >
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>

            {/* Show Dates Toggle */}
            <div
              onClick={onToggleShowDates}
              className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors gap-2"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Calendar className="w-4 h-4 text-neutral-800 dark:text-neutral-200 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                    Show Dates on Notes
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                    Display date stamps in the notes list
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`py-1 px-2.5 sm:px-3 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  showDates
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300'
                }`}
              >
                {showDates ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Note List Preview Mode Toggle */}
            <div
              onClick={onToggleNoteListPreviewMode}
              className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors gap-2"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <AlignLeft className="w-4 h-4 text-neutral-800 dark:text-neutral-200 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                    Note List View
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                    {noteListPreviewMode === 'full' ? 'Showing full note text' : 'Showing summary snippet'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`py-1 px-2.5 sm:px-3 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  noteListPreviewMode === 'full'
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300'
                }`}
              >
                {noteListPreviewMode === 'full' ? 'Full Note' : 'Summary'}
              </button>
            </div>
          </div>

          {/* Section: Storage */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-mono">
              Storage Location
            </h3>
            <div
              onClick={() => {
                onOpenDirectoryModal();
                onClose();
              }}
              className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-3">
                {storageMode === 'filesystem' ? (
                  <HardDrive className="w-4 h-4 text-neutral-900 dark:text-neutral-100 shrink-0" />
                ) : (
                  <Database className="w-4 h-4 text-neutral-900 dark:text-neutral-100 shrink-0" />
                )}
                <div className="truncate">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Storage Provider
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                    {storageMode === 'filesystem' && directoryName
                      ? `Disk Folder: ${directoryName}`
                      : 'Browser (IndexedDB)'}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
            </div>
          </div>

          {/* Section: Data & Backup */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-mono">
              Data & Backup
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onOpenBackupModal();
                  onClose();
                }}
                className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left flex flex-col justify-between transition-colors"
              >
                <Key className="w-4 h-4 text-neutral-800 dark:text-neutral-200 mb-2" />
                <div>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Encrypted Backup
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                    AES-256 export / import
                  </span>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-left flex flex-col justify-between transition-colors"
              >
                <Download className="w-4 h-4 text-neutral-800 dark:text-neutral-200 mb-2" />
                <div>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Import Markdown
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                    Import .md / .txt files
                  </span>
                </div>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".md,.markdown,.txt"
                multiple
                className="hidden"
              />
            </div>
          </div>

          {/* Section: Shortcuts */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-mono">
              Help
            </h3>
            <div
              onClick={() => {
                onOpenShortcutsModal();
                onClose();
              }}
              className="p-3 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
            >
              <div className="flex items-center space-x-3">
                <HelpCircle className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                <div>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Keyboard Shortcuts
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">
                    View cheatsheet (?)
                  </span>
                </div>
              </div>
              <kbd className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[10px] rounded font-mono">
                ?
              </kbd>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-50 dark:bg-black border-t border-neutral-200 dark:border-neutral-800 text-right shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-semibold rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
