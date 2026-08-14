import React, { useState, useRef } from 'react';
import { Key, Lock, Unlock, Download, Upload, ShieldCheck, AlertCircle, Check, X } from 'lucide-react';
import { Note } from '../types';
import { encryptBackup, decryptBackup } from '../lib/crypto';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onImportRestoredNotes: (restoredNotes: Note[]) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  notes,
  onImportRestoredNotes,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Export State
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setExportSuccess(false);

    if (!exportPassword) {
      setErrorMessage('Please enter an encryption password.');
      return;
    }

    if (exportPassword !== exportConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (exportPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }

    setExporting(true);

    try {
      const backupData = {
        version: 1,
        notes,
        exportedAt: new Date().toISOString(),
        app: 'Offline Markdown Notes',
      };

      const encryptedPayload = await encryptBackup(backupData, exportPassword);
      const jsonStr = JSON.stringify(encryptedPayload, null, 2);

      const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `notes-backup-encrypted-${dateStr}.enc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setExportPassword('');
      setExportConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to encrypt backup.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
      setErrorMessage(null);
      setImportSuccessMessage(null);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setImportSuccessMessage(null);

    if (!importFile) {
      setErrorMessage('Please select a backup file (.enc).');
      return;
    }

    if (!importPassword) {
      setErrorMessage('Please enter the password to decrypt the file.');
      return;
    }

    setImporting(true);

    try {
      const fileText = await importFile.text();
      const encryptedPayload = JSON.parse(fileText);

      const decryptedData = await decryptBackup(encryptedPayload, importPassword);

      if (decryptedData && Array.isArray(decryptedData.notes)) {
        onImportRestoredNotes(decryptedData.notes);
        setImportSuccessMessage(
          `Successfully restored ${decryptedData.notes.length} note(s)!`
        );
        setImportFile(null);
        setImportPassword('');
      } else {
        throw new Error('Invalid backup file format');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Decryption failed. Incorrect password or corrupt file.');
    } finally {
      setImporting(false);
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
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Encrypted Backup
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                AES-256-GCM encrypted import & export
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

        {/* Tab Selection */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black">
          <button
            onClick={() => {
              setActiveTab('export');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-black text-black dark:border-white dark:text-white bg-white dark:bg-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Export Encrypted Backup</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('import');
              setErrorMessage(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-black text-black dark:border-white dark:text-white bg-white dark:bg-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Unlock className="w-4 h-4" />
            <span>Import & Decrypt</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {errorMessage && (
            <div className="mb-4 p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'export' ? (
            <form onSubmit={handleExport} className="space-y-4">
              <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                  <span>Strong Encryption Guarantee</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Your notes will be encrypted using <strong>AES-256-GCM</strong> directly in your browser. Without your password, nobody can read your files.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Set Encryption Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={exportConfirmPassword}
                  onChange={(e) => setExportConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>

              {exportSuccess && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 flex items-center space-x-2 font-medium">
                  <Check className="w-4 h-4" />
                  <span>Encrypted backup file generated and downloaded!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={exporting}
                className="w-full py-2.5 px-4 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{exporting ? 'Encrypting...' : `Export ${notes.length} Note(s) (.enc)`}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Select Encrypted Backup File (.enc)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white rounded-xl bg-neutral-50/50 dark:bg-neutral-900 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-6 h-6 text-neutral-400 mx-auto mb-1" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block">
                    {importFile ? importFile.name : 'Click or drop .enc file here'}
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Encrypted backup archive'}
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportFileSelect}
                  accept=".enc,.json"
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Decryption Password
                </label>
                <input
                  type="password"
                  placeholder="Enter backup password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                />
              </div>

              {importSuccessMessage && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 flex items-center space-x-2 font-medium">
                  <Check className="w-4 h-4" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={importing || !importFile}
                className="w-full py-2.5 px-4 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                <span>{importing ? 'Decrypting...' : 'Decrypt & Restore Notes'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-50 dark:bg-black border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>Client-Side Cryptography</span>
          <button onClick={onClose} className="text-neutral-600 dark:text-neutral-300 hover:underline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
