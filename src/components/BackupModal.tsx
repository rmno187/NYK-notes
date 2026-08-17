import React, { useState } from 'react';
import { Note } from '../types';
import { encryptBackup } from '../lib/crypto';
import { X, AlertCircle, Check } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  notes,
}) => {
  const [encrypted, setEncrypted] = useState(true);

  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setExportSuccess(false);

    if (encrypted) {
      if (!password) {
        setErrorMessage('Please enter an encryption password.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      if (password.length < 4) {
        setErrorMessage('Password must be at least 4 characters long.');
        return;
      }
    }

    setExporting(true);

    try {
      const backupData = {
        version: 1,
        notes,
        exportedAt: new Date().toISOString(),
        app: 'Offline Markdown Notes',
      };

      const dateStr = new Date().toISOString().slice(0, 10);

      if (encrypted) {
        const encryptedPayload = await encryptBackup(backupData, password);
        const jsonStr = JSON.stringify(encryptedPayload, null, 2);

        const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notes-backup-encrypted-${dateStr}.enc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notes-backup-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setExportSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate backup.');
    } finally {
      setExporting(false);
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
              Backup
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              Export a copy of all your notes.
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

        {/* Format Toggle Tabs */}
        <div className="px-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => {
                setEncrypted(true);
                setErrorMessage(null);
                setExportSuccess(false);
              }}
              className={`py-3 text-xs font-medium border-b transition-colors ${
                encrypted
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Encrypted
            </button>

            <button
              type="button"
              onClick={() => {
                setEncrypted(false);
                setErrorMessage(null);
                setExportSuccess(false);
              }}
              className={`py-3 text-xs font-medium border-b transition-colors ${
                !encrypted
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Plain
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

          <form onSubmit={handleExport} className="space-y-5">
            {encrypted ? (
              <>
                <div className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  Notes are encrypted client-side using AES-256-GCM before creating the backup file.
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-black dark:text-white mb-1.5">
                    Password
                  </label>

                  <input
                    type="password"
                    placeholder="Enter a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium text-black dark:text-white mb-1.5">
                    Confirm password
                  </label>

                  <input
                    type="password"
                    placeholder="Enter the password again"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                  />
                </div>
              </>
            ) : (
              <div className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                Exports all notes as an unencrypted, standard JSON backup file.
              </div>
            )}

            {/* Success */}
            {exportSuccess && (
              <div className="py-3 border-y border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-xs text-black dark:text-white">
                <Check className="w-4 h-4 shrink-0" />
                <span>Backup file created and downloaded.</span>
              </div>
            )}

            {/* Export Button */}
            <button
              type="submit"
              disabled={exporting}
              className="w-full py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-40 text-xs font-medium transition-colors"
            >
              {exporting
                ? 'Exporting…'
                : `Export ${notes.length} note${notes.length === 1 ? '' : 's'} (${encrypted ? '.enc' : '.json'})`}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-600">
            {encrypted ? 'CLIENT-SIDE ENCRYPTION' : 'LOCAL BACKUP'}
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
