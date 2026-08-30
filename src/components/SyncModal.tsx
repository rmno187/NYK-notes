import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  LogOut,
  ArrowRight,
} from 'lucide-react';
import { syncManager } from '../lib/vercelSync/syncManager';
import { generateRecoveryPhrase } from '../lib/vercelSync/crypto';
import { VercelSyncConfig, SyncStatus } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: () => void;
  onSyncConfigured?: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onConfigured,
  onSyncConfigured,
}) => {
  const notifyConfigured = () => {
    if (onConfigured) onConfigured();
    if (onSyncConfigured) onSyncConfigured();
  };

  const [activeTab, setActiveTab] = useState<'status' | 'setup' | 'recovery'>('status');
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());
  const [config, setConfig] = useState<VercelSyncConfig | null>(syncManager.getConfig());

  // Setup form states
  const [setupMode, setSetupMode] = useState<'new' | 'existing'>('new');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = syncManager.subscribeStatus((newStatus) => {
      setStatus(newStatus);
      setConfig(syncManager.getConfig());
    });

    const isConfig = syncManager.isConfigured();
    if (!isConfig) {
      setActiveTab('setup');
      setGeneratedPhrase(generateRecoveryPhrase(12));
    } else {
      setActiveTab('status');
    }

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateNewSyncAccount = async () => {
    setIsSettingUp(true);
    setErrorMessage(null);
    try {
      const phraseToUse = generatedPhrase || generateRecoveryPhrase(12);
      await syncManager.setupWithPassphrase(phraseToUse);
      setActiveTab('recovery');
      notifyConfigured();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize encrypted sync');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleConnectExistingAccount = async () => {
    if (!passphraseInput.trim()) {
      setErrorMessage('Please enter your 12-word recovery phrase');
      return;
    }
    setIsSettingUp(true);
    setErrorMessage(null);
    try {
      await syncManager.setupWithPassphrase(passphraseInput.trim());
      setActiveTab('status');
      notifyConfigured();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect with recovery phrase');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Disconnect this device from Sync? Local notes will remain on your device.')) {
      await syncManager.disconnect();
      setActiveTab('setup');
      setGeneratedPhrase(generateRecoveryPhrase(12));
    }
  };

  const handleManualSyncNow = async () => {
    await syncManager.sync(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const isConfigured = syncManager.isConfigured();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
              <Lock className="w-4 h-4 text-black dark:text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-black dark:text-white">
                  Encrypted Sync
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  Zero-Knowledge E2EE
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                End-to-end encrypted note synchronization across all your devices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        {isConfigured && (
          <div className="px-6 border-b border-neutral-200 dark:border-neutral-800 flex gap-6 text-xs font-medium bg-neutral-50/50 dark:bg-neutral-900/30">
            <button
              onClick={() => { setActiveTab('status'); setErrorMessage(null); }}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'status'
                  ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Sync Status
            </button>

            <button
              onClick={() => { setActiveTab('recovery'); setErrorMessage(null); }}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'recovery'
                  ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Recovery Phrase
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB: STATUS */}
          {activeTab === 'status' && isConfigured && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Status:
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        status === 'synced'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                          : status === 'syncing'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status === 'synced' ? 'bg-emerald-500' : status === 'syncing' ? 'bg-amber-500 animate-pulse' : 'bg-neutral-400'
                      }`} />
                      {status === 'synced' ? 'Synced' : status === 'syncing' ? 'Syncing…' : status === 'offline' ? 'Offline' : 'Sync error'}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {config?.lastSyncedAt
                      ? `Last synced: ${new Date(config.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : 'Auto-sync active'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleManualSyncNow}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
              </div>

              {/* Vault Details */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Vault Information
                </h4>
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-900">
                    <span className="text-neutral-500">Vault ID</span>
                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{config?.vaultId || config?.accountId}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">Encryption</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> AES-256-GCM (Client-Only)
                    </span>
                  </div>
                </div>
              </div>

              {/* How to connect other devices note */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">Connecting other devices</span>
                <p className="text-[11px] leading-relaxed">
                  To sync with your phone or other computers, open the <strong>Recovery Phrase</strong> tab, copy your phrase, and select <em>Connect with Recovery Phrase</em> on the other device.
                </p>
              </div>

              {/* Disconnect Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Disconnect Sync
                </button>
              </div>
            </div>
          )}

          {/* TAB: SETUP / CONNECT */}
          {activeTab === 'setup' && (
            <div className="space-y-4">
              <div className="flex border-b border-neutral-200 dark:border-neutral-800 gap-4 text-xs font-medium">
                <button
                  onClick={() => setSetupMode('new')}
                  className={`pb-2.5 border-b-2 transition-colors ${
                    setupMode === 'new'
                      ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Create New Vault
                </button>
                <button
                  onClick={() => setSetupMode('existing')}
                  className={`pb-2.5 border-b-2 transition-colors ${
                    setupMode === 'existing'
                      ? 'border-black dark:border-white text-black dark:text-white font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  Connect with Recovery Phrase
                </button>
              </div>

              {setupMode === 'new' ? (
                <div className="space-y-4 pt-1">
                  <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-500" /> Master Recovery Phrase
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedPhrase)}
                        className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedKey ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <p className="font-mono text-xs p-3 rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 leading-relaxed break-words select-all text-neutral-800 dark:text-neutral-200">
                      {generatedPhrase}
                    </p>

                    <p className="text-[11px] text-neutral-500 leading-normal">
                      Save this 12-word recovery phrase. It derives your private encryption keys to decrypt your notes on any device.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateNewSyncAccount}
                    disabled={isSettingUp}
                    className="w-full py-2.5 text-xs font-medium rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSettingUp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Initializing Encryption…
                      </>
                    ) : (
                      <>
                        Confirm & Start Sync <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      Enter 12-Word Recovery Phrase
                    </label>
                    <textarea
                      rows={3}
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      placeholder="e.g. apple banana courage ..."
                      className="w-full p-2.5 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Paste the 12 words from your other device to connect to the same encrypted vault.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectExistingAccount}
                    disabled={isSettingUp}
                    className="w-full py-2.5 text-xs font-medium rounded-lg bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSettingUp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting & Decrypting…
                      </>
                    ) : (
                      <>
                        Connect & Decrypt Notes <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: RECOVERY PHRASE */}
          {activeTab === 'recovery' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex items-start gap-2.5 text-xs text-neutral-800 dark:text-neutral-200">
                <KeyRound className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Multi-Device Recovery Phrase</span>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Use this 12-word phrase to connect any phone, tablet, or computer to your notes.
                  </p>
                </div>
              </div>

              {generatedPhrase ? (
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      12-Word Phrase
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedPhrase)}
                      className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1 px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedKey ? 'Copied' : 'Copy Phrase'}
                    </button>
                  </div>

                  <p className="font-mono text-xs p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 leading-relaxed select-all text-neutral-800 dark:text-neutral-200">
                    {generatedPhrase}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 space-y-2">
                  <p>
                    Your vault is active. Keep your original 12-word recovery phrase in a safe place to add more devices.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
