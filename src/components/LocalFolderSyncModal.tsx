import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FolderCheck,
  FolderSync,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Info,
  Layers,
  FileText,
  Sparkles,
  GitBranch,
  Trash2,
} from 'lucide-react';
import { LocalFolderConfig, Note } from '../types';
import { localFolderManager } from '../lib/localFolderManager';

interface LocalFolderSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSyncComplete?: (message: string) => void;
  onNotesUpdated?: (notes: Note[]) => void;
}

export const LocalFolderSyncModal: React.FC<LocalFolderSyncModalProps> = ({
  isOpen,
  onClose,
  notes,
  onSyncComplete,
  onNotesUpdated,
}) => {
  const [config, setConfig] = useState<LocalFolderConfig>({
    rootHandle: null,
    rootName: '',
    postsHandle: null,
    postsName: '',
    projectsHandle: null,
    projectsName: '',
    notesHandle: null,
    notesName: '',
    autoSyncToDisk: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<'folders' | 'actions'>('folders');

  useEffect(() => {
    if (isOpen) {
      localFolderManager.initialize().then((loadedConfig) => {
        setConfig(loadedConfig);
      });
      setActionMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFsSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const handlePickRoot = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const handle = await localFolderManager.pickRootDirectory();
      if (handle) {
        const updated = localFolderManager.getConfig();
        setConfig(updated);
        setActionMessage({
          text: `Connected root folder "${handle.name}". Subfolders "posts/", "projects/", and "notes/" will be synchronized automatically.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to select root folder', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickCategory = async (category: 'posts' | 'projects' | 'notes') => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const handle = await localFolderManager.pickCategoryDirectory(category);
      if (handle) {
        const updated = localFolderManager.getConfig();
        setConfig(updated);
        setActionMessage({
          text: `Mapped ${category} folder to "${handle.name}".`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || `Failed to select ${category} folder`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCategory = async (category: 'root' | 'posts' | 'projects' | 'notes') => {
    await localFolderManager.clearCategoryDirectory(category);
    setConfig(localFolderManager.getConfig());
    setActionMessage({ text: `Removed folder mapping for ${category}.`, type: 'info' });
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    localFolderManager.setAutoSync(enabled);
    setConfig(localFolderManager.getConfig());
    setActionMessage({
      text: enabled
        ? 'Auto-sync enabled: Edits and file renames will immediately save to local disk.'
        : 'Auto-sync disabled: Files will only save to local disk when manually triggered.',
      type: 'info',
    });
  };

  const handlePushAllToDisk = async () => {
    if (!localFolderManager.hasAnyFolderConfigured()) {
      setActionMessage({
        text: 'Please connect at least one folder before syncing to disk.',
        type: 'error',
      });
      return;
    }

    setIsLoading(true);
    setActionMessage(null);
    try {
      const { savedCount, deletedCount, errors } = await localFolderManager.syncAllNotes(notes);
      if (errors.length > 0) {
        setActionMessage({
          text: `Saved ${savedCount} item${savedCount === 1 ? '' : 's'}, cleaned ${deletedCount} deleted item${deletedCount === 1 ? '' : 's'}. (${errors.length} warnings)`,
          type: 'info',
        });
      } else {
        const msg = `Synced ${savedCount} item${savedCount === 1 ? '' : 's'} to local disk (${deletedCount} deleted items cleaned).`;
        setActionMessage({ text: msg, type: 'success' });
        onSyncComplete?.(msg);
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to sync items to disk', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanAndImportFromDisk = async () => {
    if (!localFolderManager.hasAnyFolderConfigured()) {
      setActionMessage({
        text: 'Please connect a root or category folder first.',
        type: 'error',
      });
      return;
    }

    setIsLoading(true);
    setActionMessage(null);
    try {
      const loaded = await localFolderManager.loadAllNotesFromLocalFolders();
      if (loaded.length === 0) {
        setActionMessage({ text: 'No markdown files found in the connected folder(s).', type: 'info' });
      } else {
        onNotesUpdated?.(loaded);
        const msg = `Loaded and synced ${loaded.length} file${loaded.length === 1 ? '' : 's'} from local disk.`;
        setActionMessage({ text: msg, type: 'success' });
        onSyncComplete?.(msg);
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to read files from disk', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const postsCount = notes.filter((n) => !n.deletedAt && n.type === 'post').length;
  const projectsCount = notes.filter((n) => !n.deletedAt && n.type === 'project').length;
  const notesCount = notes.filter((n) => !n.deletedAt && (!n.type || n.type === 'note')).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-black dark:text-white">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-black dark:text-white">
                Local Device & Blog Repo Sync
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Sync markdown files and assets with your local repository folders.
              </p>
            </div>
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

        {/* Action / Notification Banner */}
        {actionMessage && (
          <div
            className={`px-5 py-2.5 text-xs flex items-start gap-2 border-b ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/50'
                : actionMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900/50'
                : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : actionMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{actionMessage.text}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!isFsSupported && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Direct Folder Access Unavailable</p>
                <p className="mt-0.5 opacity-90">
                  Your browser does not support the File System Access API. Please use Google Chrome, Edge, or a desktop Chromium browser to enable direct local folder synchronization.
                </p>
              </div>
            </div>
          )}

          {/* Quick Explanation */}
          <div className="bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800/80 rounded p-3 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-1.5 font-medium text-black dark:text-white mb-1">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Mobile-to-Laptop Blog Workflow</span>
            </div>
            <p className="leading-relaxed">
              Create and edit posts, projects, and notes on the move (via Sync/Cloud). When you get home to your laptop, connected local folders will keep your local markdown repo cleanly updated for Git commits.
            </p>
          </div>

          {/* SECTION 1: UNIFIED ROOT / CONTENT FOLDER */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3.5 bg-white dark:bg-black">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-black dark:text-white shrink-0" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">
                    Blog Repository / Content Root
                  </h3>
                </div>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Select your blog's <code className="font-mono text-[11px] bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded">content</code> or project root folder. Posts and projects will route automatically to <code className="font-mono text-[11px]">posts/</code> and <code className="font-mono text-[11px]">projects/</code>.
                </p>

                {config.rootHandle && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Connected: {config.rootName}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {isFsSupported && (
                  <button
                    type="button"
                    onClick={handlePickRoot}
                    disabled={isLoading}
                    className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black rounded text-xs font-medium hover:opacity-85 disabled:opacity-50 transition-opacity"
                  >
                    {config.rootHandle ? 'Change Root' : 'Choose Root'}
                  </button>
                )}
                {config.rootHandle && (
                  <button
                    type="button"
                    onClick={() => handleClearCategory('root')}
                    className="text-[11px] text-neutral-400 hover:text-red-600 underline"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: DEDICATED CATEGORY FOLDERS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Category Folder Mappings
              </h3>
              <span className="text-[11px] text-neutral-400">
                Overrides or specific subfolders
              </span>
            </div>

            {/* Posts Folder */}
            <div className="border border-neutral-100 dark:border-neutral-900 rounded-lg p-3 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-black dark:text-white">📝 Posts Folder</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {postsCount} {postsCount === 1 ? 'post' : 'posts'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 truncate font-mono">
                  {config.postsHandle
                    ? `Mapped: ${config.postsName}`
                    : config.rootHandle
                    ? `Auto: ${config.rootName}/posts`
                    : 'Not mapped'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isFsSupported && (
                  <button
                    type="button"
                    onClick={() => handlePickCategory('posts')}
                    disabled={isLoading}
                    className="text-xs underline underline-offset-4 text-black dark:text-white hover:opacity-80"
                  >
                    {config.postsHandle ? 'Change' : 'Set Folder'}
                  </button>
                )}
                {config.postsHandle && (
                  <button
                    type="button"
                    onClick={() => handleClearCategory('posts')}
                    className="text-[11px] text-neutral-400 hover:text-red-500"
                    title="Clear override"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Projects Folder */}
            <div className="border border-neutral-100 dark:border-neutral-900 rounded-lg p-3 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-black dark:text-white">🚀 Projects Folder</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {projectsCount} {projectsCount === 1 ? 'project' : 'projects'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 truncate font-mono">
                  {config.projectsHandle
                    ? `Mapped: ${config.projectsName}`
                    : config.rootHandle
                    ? `Auto: ${config.rootName}/projects`
                    : 'Not mapped'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isFsSupported && (
                  <button
                    type="button"
                    onClick={() => handlePickCategory('projects')}
                    disabled={isLoading}
                    className="text-xs underline underline-offset-4 text-black dark:text-white hover:opacity-80"
                  >
                    {config.projectsHandle ? 'Change' : 'Set Folder'}
                  </button>
                )}
                {config.projectsHandle && (
                  <button
                    type="button"
                    onClick={() => handleClearCategory('projects')}
                    className="text-[11px] text-neutral-400 hover:text-red-500"
                    title="Clear override"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Notes Folder (Optional backup folder) */}
            <div className="border border-neutral-100 dark:border-neutral-900 rounded-lg p-3 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-black dark:text-white">📓 Notes Folder</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {notesCount} {notesCount === 1 ? 'note' : 'notes'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500 truncate font-mono">
                  {config.notesHandle
                    ? `Mapped: ${config.notesName}`
                    : config.rootHandle
                    ? `Auto: ${config.rootName}/notes`
                    : 'Not mapped'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isFsSupported && (
                  <button
                    type="button"
                    onClick={() => handlePickCategory('notes')}
                    disabled={isLoading}
                    className="text-xs underline underline-offset-4 text-black dark:text-white hover:opacity-80"
                  >
                    {config.notesHandle ? 'Change' : 'Set Folder'}
                  </button>
                )}
                {config.notesHandle && (
                  <button
                    type="button"
                    onClick={() => handleClearCategory('notes')}
                    className="text-[11px] text-neutral-400 hover:text-red-500"
                    title="Clear override"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: SYNC BEHAVIOR & ACTIONS */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Sync Options & Actions
            </h3>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-xs font-medium text-black dark:text-white">
                  Real-Time Local Auto-Save
                </span>
                <p className="text-[11px] text-neutral-500">
                  Automatically save edits, clean up old file names on rename, and remove trashed files from disk.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleAutoSync(!config.autoSyncToDisk)}
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  config.autoSyncToDisk ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              >
                <div
                  className={`bg-white dark:bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    config.autoSyncToDisk ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Two Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handlePushAllToDisk}
                disabled={isLoading || !localFolderManager.hasAnyFolderConfigured()}
                className="flex items-center justify-center gap-2 py-2 px-3 border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white rounded text-xs font-medium text-black dark:text-white transition-colors disabled:opacity-40"
              >
                <FolderSync className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sync All to Local Disk</span>
              </button>

              <button
                type="button"
                onClick={handleScanAndImportFromDisk}
                disabled={isLoading || !localFolderManager.hasAnyFolderConfigured()}
                className="flex items-center justify-center gap-2 py-2 px-3 border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white rounded text-xs font-medium text-black dark:text-white transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Scan & Pull from Disk</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/30 shrink-0">
          <span className="text-[11px] text-neutral-400">
            {localFolderManager.hasAnyFolderConfigured()
              ? 'Local folder sync active'
              : 'No local folder mapped'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded text-xs font-medium hover:opacity-85 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
