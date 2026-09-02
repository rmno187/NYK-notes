import React, { useState, useRef } from 'react';
import { Note } from '../types';
import { decryptBackup } from '../lib/crypto';
import { X, AlertCircle, Check, FileText, Folder, Lock } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportMarkdownFiles: (files: FileList | File[]) => Promise<void> | void;
  onImportRestoredNotes: (restoredNotes: Note[]) => Promise<void> | void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportMarkdownFiles,
  onImportRestoredNotes,
}) => {
  const [activeTab, setActiveTab] = useState<'markdown' | 'backup'>('markdown');

  // Markdown import state (can be files or from folder)
  const [mdFiles, setMdFiles] = useState<File[]>([]);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [mdImporting, setMdImporting] = useState(false);
  const [mdSuccessMessage, setMdSuccessMessage] = useState<string | null>(null);
  const mdFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Backup import state
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const handleMdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      const validFiles = fileList.filter((f: File) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith('.md') ||
          name.endsWith('.markdown') ||
          name.endsWith('.txt') ||
          name.endsWith('.zip') ||
          name.endsWith('.png') ||
          name.endsWith('.jpg') ||
          name.endsWith('.jpeg') ||
          name.endsWith('.webp') ||
          name.endsWith('.gif') ||
          name.endsWith('.svg')
        );
      });

      const hasDoc = validFiles.some((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt') || n.endsWith('.zip');
      });

      if (!hasDoc) {
        setErrorMessage('No markdown (.md) or .zip files found in the selection.');
        return;
      }

      setMdFiles(validFiles);
      const mdCount = validFiles.filter((f) => !f.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)).length;
      setSourceName(validFiles.length === 1 ? validFiles[0].name : `${mdCount} document${mdCount === 1 ? '' : 's'} + assets`);
      setErrorMessage(null);
      setMdSuccessMessage(null);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files) as File[];
      const hasDoc = fileList.some((f: File) => {
        const name = f.name.toLowerCase();
        return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || name.endsWith('.zip');
      });

      if (!hasDoc) {
        setErrorMessage('No markdown (.md) or .zip files found in the selected folder.');
        return;
      }

      // Try to determine folder name from webkitRelativePath
      const firstFile = fileList[0];
      const firstRelative = (firstFile as any).webkitRelativePath;
      const folderName = firstRelative ? firstRelative.split('/')[0] : 'Folder';

      const mdCount = fileList.filter((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt') || n.endsWith('.zip');
      }).length;

      setMdFiles(fileList);
      setSourceName(`Folder: "${folderName}" (${mdCount} note${mdCount === 1 ? '' : 's'} + assets)`);
      setErrorMessage(null);
      setMdSuccessMessage(null);
    }
  };

  const handlePickDirectoryApi = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        const collectedFiles: File[] = [];

        // Helper to recursively collect files with relative paths
        const scanDir = async (handle: any, currentPath: string = '') => {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              Object.defineProperty(file, 'webkitRelativePath', {
                value: relativePath,
                writable: false,
              });
              collectedFiles.push(file);
            } else if (entry.kind === 'directory') {
              const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              await scanDir(entry, nextPath);
            }
          }
        };

        await scanDir(dirHandle, dirHandle.name);

        const hasDoc = collectedFiles.some((f) => {
          const n = f.name.toLowerCase();
          return n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt') || n.endsWith('.zip');
        });

        if (!hasDoc) {
          setErrorMessage(`No markdown files found in folder "${dirHandle.name}".`);
          return;
        }

        const mdCount = collectedFiles.filter((f) => {
          const n = f.name.toLowerCase();
          return n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt') || n.endsWith('.zip');
        }).length;

        setMdFiles(collectedFiles);
        setSourceName(`Folder: "${dirHandle.name}" (${mdCount} note${mdCount === 1 ? '' : 's'} + assets)`);
        setErrorMessage(null);
        setMdSuccessMessage(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setErrorMessage(err.message || 'Failed to select folder.');
        }
      }
    } else if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setErrorMessage(null);

    const items = e.dataTransfer.items;
    const files: File[] = [];

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            const name = file.name.toLowerCase();
            if (name.endsWith('.enc') || (name.endsWith('.json') && !name.endsWith('.md.json'))) {
              // Backup file dropped
              setActiveTab('backup');
              setBackupFile(file);
              return;
            }
            files.push(file);
          }
        }
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const name = file.name.toLowerCase();
        if (name.endsWith('.enc') || (name.endsWith('.json') && !name.endsWith('.md.json'))) {
          setActiveTab('backup');
          setBackupFile(file);
          return;
        }
        files.push(file);
      }
    }

    const hasValid = files.some((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || name.endsWith('.zip');
    });

    if (hasValid) {
      setMdFiles(files);
      const mdCount = files.filter((f) => {
        const n = f.name.toLowerCase();
        return n.endsWith('.md') || n.endsWith('.markdown') || n.endsWith('.txt') || n.endsWith('.zip');
      }).length;
      setSourceName(files.length === 1 ? files[0].name : `${mdCount} note${mdCount === 1 ? '' : 's'} + assets`);
    } else {
      setErrorMessage('Please drop .md files, a .zip archive, or an encrypted backup file.');
    }
  };

  const handleMdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMdSuccessMessage(null);

    if (!mdFiles || mdFiles.length === 0) {
      setErrorMessage('Please select one or more markdown files or a folder.');
      return;
    }

    setMdImporting(true);
    try {
      await onImportMarkdownFiles(mdFiles);
      setMdSuccessMessage(`Successfully imported ${mdFiles.length} note${mdFiles.length === 1 ? '' : 's'}.`);
      setMdFiles([]);
      setSourceName(null);
      if (mdFileInputRef.current) mdFileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import files.');
    } finally {
      setMdImporting(false);
    }
  };

  const handleBackupSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBackupFile(e.target.files[0]);
      setErrorMessage(null);
      setBackupSuccessMessage(null);
    }
  };

  const handleBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setBackupSuccessMessage(null);

    if (!backupFile) {
      setErrorMessage('Please select a backup file.');
      return;
    }

    setBackupImporting(true);

    try {
      const fileText = await backupFile.text();
      let parsed: any;
      try {
        parsed = JSON.parse(fileText);
      } catch {
        throw new Error('Invalid backup file format.');
      }

      // Check if it is unencrypted JSON backup
      if (parsed && Array.isArray(parsed.notes)) {
        await onImportRestoredNotes(parsed.notes);
        setBackupSuccessMessage(`Restored ${parsed.notes.length} note${parsed.notes.length === 1 ? '' : 's'}.`);
        setBackupFile(null);
        setBackupPassword('');
        if (backupFileInputRef.current) backupFileInputRef.current.value = '';
        setTimeout(() => {
          onClose();
        }, 700);
        return;
      }

      // If it is encrypted, require password
      if (!backupPassword) {
        setErrorMessage('Please enter the password to decrypt this backup.');
        setBackupImporting(false);
        return;
      }

      const decryptedData = await decryptBackup(parsed, backupPassword);
      if (decryptedData && Array.isArray(decryptedData.notes)) {
        await onImportRestoredNotes(decryptedData.notes);
        setBackupSuccessMessage(`Restored ${decryptedData.notes.length} note${decryptedData.notes.length === 1 ? '' : 's'}.`);
        setBackupFile(null);
        setBackupPassword('');
        if (backupFileInputRef.current) backupFileInputRef.current.value = '';
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        throw new Error('Invalid backup data structure.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Decryption failed. Incorrect password or corrupt file.');
    } finally {
      setBackupImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-black dark:text-white">
              Import & Open
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              Import individual Markdown files, a folder of notes, or restore an encrypted backup.
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

        {/* Tabs */}
        <div className="px-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('markdown');
                setErrorMessage(null);
              }}
              className={`py-3 text-xs font-medium border-b transition-colors ${
                activeTab === 'markdown'
                  ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Markdown (Files & Folders)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('backup');
                setErrorMessage(null);
              }}
              className={`py-3 text-xs font-medium border-b transition-colors ${
                activeTab === 'backup'
                  ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Encrypted Backup
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          {/* Error */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'markdown' ? (
            <form onSubmit={handleMdSubmit} className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`w-full p-6 border-2 border-dashed rounded-xl text-center transition-colors ${
                  isDragOver
                    ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-900'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                    <FileText className="w-5 h-5" />
                  </div>

                  {sourceName ? (
                    <div className="mt-1">
                      <span className="text-xs font-semibold text-black dark:text-white block">
                        {sourceName}
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                        Ready to import {mdFiles.length} note{mdFiles.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-medium text-black dark:text-white block">
                        Drag & drop markdown files here
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-500 mt-0.5 block">
                        Supports single .md files, multiple notes, or entire folders
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 mt-3">
                    <button
                      type="button"
                      onClick={() => mdFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white text-xs font-medium text-black dark:text-white transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Choose File(s)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePickDirectoryApi}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white text-xs font-medium text-black dark:text-white transition-colors flex items-center gap-1.5"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>Choose Folder</span>
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={mdFileInputRef}
                  onChange={handleMdSelect}
                  accept=".md,.markdown,.txt"
                  multiple
                  className="hidden"
                />

                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderSelect}
                  {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
                  className="hidden"
                />
              </div>

              {mdSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{mdSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={mdImporting || mdFiles.length === 0}
                className="w-full py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 text-xs font-semibold rounded-lg transition-colors"
              >
                {mdImporting ? 'Importing…' : `Import ${mdFiles.length > 0 ? `${mdFiles.length} ` : ''}Notes`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBackupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-black dark:text-white mb-1.5">
                  Backup file
                </label>

                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="w-full py-6 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white rounded-xl text-center transition-colors"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Lock className="w-5 h-5 text-neutral-500" />
                    <span className="text-xs font-medium text-black dark:text-white">
                      {backupFile ? backupFile.name : 'Choose a backup file (.enc or .json)'}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-500">
                      {backupFile
                        ? `${(backupFile.size / 1024).toFixed(1)} KB`
                        : 'AES-256 encrypted .enc or JSON backup'}
                    </span>
                  </div>
                </button>

                <input
                  type="file"
                  ref={backupFileInputRef}
                  onChange={handleBackupSelect}
                  accept=".enc,.json"
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-black dark:text-white mb-1.5">
                  Decryption Password
                </label>

                <input
                  type="password"
                  placeholder="Enter the backup password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>

              {backupSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{backupSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={backupImporting || !backupFile}
                className="w-full py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 text-xs font-semibold rounded-lg transition-colors"
              >
                {backupImporting ? 'Decrypting & Restoring…' : 'Restore Backup'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <span className="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-600 uppercase font-mono">
            Local Import & Restore
          </span>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-black dark:hover:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
