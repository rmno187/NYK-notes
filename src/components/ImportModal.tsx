import React, { useState, useRef } from 'react';
import { Note } from '../types';
import { decryptBackup } from '../lib/crypto';
import { X, AlertCircle, Check } from 'lucide-react';

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

  // Markdown import state
  const [mdFiles, setMdFiles] = useState<FileList | null>(null);
  const [mdImporting, setMdImporting] = useState(false);
  const [mdSuccessMessage, setMdSuccessMessage] = useState<string | null>(null);
  const mdFileInputRef = useRef<HTMLInputElement>(null);

  // Backup import state
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [backupImporting, setBackupImporting] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMdSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMdFiles(e.target.files);
      setErrorMessage(null);
      setMdSuccessMessage(null);
    }
  };

  const handleMdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setMdSuccessMessage(null);

    if (!mdFiles || mdFiles.length === 0) {
      setErrorMessage('Please select one or more markdown files.');
      return;
    }

    setMdImporting(true);
    try {
      await onImportMarkdownFiles(mdFiles);
      setMdSuccessMessage(`Imported ${mdFiles.length} file${mdFiles.length === 1 ? '' : 's'}.`);
      setMdFiles(null);
      if (mdFileInputRef.current) mdFileInputRef.current.value = '';
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
        className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-black dark:text-white">
              Import
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              Import markdown files or restore a backup.
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
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Markdown files
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('backup');
                setErrorMessage(null);
              }}
              className={`py-3 text-xs font-medium border-b transition-colors ${
                activeTab === 'backup'
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Encrypted backup
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          {/* Error */}
          {errorMessage && (
            <div className="mb-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'markdown' ? (
            <form onSubmit={handleMdSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-black dark:text-white mb-1.5">
                  Select files
                </label>

                <button
                  type="button"
                  onClick={() => mdFileInputRef.current?.click()}
                  className="w-full py-6 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white text-center transition-colors"
                >
                  <span className="block text-xs font-medium text-black dark:text-white">
                    {mdFiles && mdFiles.length > 0
                      ? `${mdFiles.length} file${mdFiles.length === 1 ? '' : 's'} selected`
                      : 'Choose markdown files'}
                  </span>

                  <span className="block mt-1 text-[10px] text-neutral-500 dark:text-neutral-500">
                    .md, .markdown, or .txt
                  </span>
                </button>

                <input
                  type="file"
                  ref={mdFileInputRef}
                  onChange={handleMdSelect}
                  accept=".md,.markdown,.txt"
                  multiple
                  className="hidden"
                />
              </div>

              {mdSuccessMessage && (
                <div className="py-3 border-y border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs text-black dark:text-white">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{mdSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={mdImporting || !mdFiles || mdFiles.length === 0}
                className="w-full py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 text-xs font-medium transition-colors"
              >
                {mdImporting ? 'Importing…' : 'Import files'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBackupSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-black dark:text-white mb-1.5">
                  Backup file
                </label>

                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="w-full py-6 border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white text-center transition-colors"
                >
                  <span className="block text-xs font-medium text-black dark:text-white">
                    {backupFile ? backupFile.name : 'Choose a backup file'}
                  </span>

                  <span className="block mt-1 text-[10px] text-neutral-500 dark:text-neutral-500">
                    {backupFile
                      ? `${(backupFile.size / 1024).toFixed(1)} KB`
                      : '.enc or .json'}
                  </span>
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
                  Password
                </label>

                <input
                  type="password"
                  placeholder="Enter the backup password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>

              {backupSuccessMessage && (
                <div className="py-3 border-y border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs text-black dark:text-white">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{backupSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={backupImporting || !backupFile}
                className="w-full py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 text-xs font-medium transition-colors"
              >
                {backupImporting ? 'Decrypting…' : 'Restore backup'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-600">
            LOCAL IMPORT
          </span>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-black dark:hover:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
