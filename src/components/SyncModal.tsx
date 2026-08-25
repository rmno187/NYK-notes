import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  ChevronRight,
  LogOut,
  ArrowRight,
  Info
} from 'lucide-react';
import { syncManager } from '../lib/vercelSync/syncManager';
import { generateRecoveryPhrase } from '../lib/vercelSync/crypto';
import { VercelSyncConfig, SyncStatus } from '../types';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncConfigured?: () => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSyncConfigured,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'setup' | 'pair' | 'recovery' | 'security'>('status');
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());
  const [config, setConfig] = useState<VercelSyncConfig | null>(syncManager.getConfig());

  // Setup form states
  const [setupMode, setSetupMode] = useState<'new' | 'existing'>('new');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Pairing states
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false);
  const [inputPairingCode, setInputPairingCode] = useState('');
  const [isConnectingPair, setIsConnectingPair] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);

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
      if (onSyncConfigured) onSyncConfigured();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize encrypted sync');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleConnectExistingAccount = async () => {
    if (!passphraseInput.trim()) {
      setErrorMessage('Please enter your recovery phrase or passphrase');
      return;
    }
    setIsSettingUp(true);
    setErrorMessage(null);
    try {
      await syncManager.setupWithPassphrase(passphraseInput.trim());
      setActiveTab('status');
      if (onSyncConfigured) onSyncConfigured();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to connect to sync account');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Disconnect this device from Vercel Sync? Local working cache will be cleared.')) {
      await syncManager.disconnect();
      setActiveTab('setup');
      setGeneratedPhrase(generateRecoveryPhrase(12));
    }
  };

  const handleManualSyncNow = async () => {
    await syncManager.sync();
  };

  // Start Device Pairing (Device A)
  const handleStartDevicePairing = async () => {
    setIsGeneratingPairing(true);
    setErrorMessage(null);
    try {
      const creds = await syncManager.getPairingCredentials();
      if (!creds) throw new Error('Sync is not configured on this device');

      const res = await fetch('/api/sync/pair/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiatorPublicKey: 'ephemeral_pub_' + Math.random().toString(36).substring(2, 10) }),
      });
      const data = await res.json();
      setPairingCode(data.code);

      // Pre-seed transfer credentials directly into pairing session
      await fetch('/api/sync/pair/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: data.code,
          encryptedCredentials: JSON.stringify(creds),
        }),
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not create pairing code');
    } finally {
      setIsGeneratingPairing(false);
    }
  };

  // Connect via Pairing Code (Device B)
  const handleConnectPairingCode = async () => {
    if (!inputPairingCode.trim() || inputPairingCode.trim().length !== 6) {
      setErrorMessage('Please enter a valid 6-digit pairing code');
      return;
    }

    setIsConnectingPair(true);
    setErrorMessage(null);
    try {
      const pollRes = await fetch(`/api/sync/pair/poll?code=${encodeURIComponent(inputPairingCode.trim())}`);
      if (!pollRes.ok) {
        throw new Error('Invalid or expired pairing code. Please generate a new code on your primary device.');
      }
      const pollData = await pollRes.json();
      if (!pollData.encryptedCredentials) {
        throw new Error('Pairing session not ready. Please try again.');
      }

      const creds = JSON.parse(pollData.encryptedCredentials);
      await syncManager.setupWithPairedCredentials(
        creds.accountId,
        creds.authKeyHex,
        creds.authSalt,
        creds.rawEncryptionKey
      );

      setPairingSuccess(true);
      setTimeout(() => {
        setPairingSuccess(false);
        setActiveTab('status');
        if (onSyncConfigured) onSyncConfigured();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Device pairing failed');
    } finally {
      setIsConnectingPair(false);
    }
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
        className="w-full max-w-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-lg overflow-hidden flex flex-col"
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
                  Vercel · Sync
                </h2>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  Zero-Knowledge E2EE
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                End-to-end encrypted across your devices.
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
        <div className="px-6 border-b border-neutral-200 dark:border-neutral-800 flex gap-4 text-xs font-medium bg-neutral-50/50 dark:bg-neutral-900/30">
          {isConfigured && (
            <button
              onClick={() => { setActiveTab('status'); setErrorMessage(null); }}
              className={`py-2.5 border-b-2 transition-colors ${
                activeTab === 'status'
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Sync Status
            </button>
          )}

          <button
            onClick={() => { setActiveTab(isConfigured ? 'pair' : 'setup'); setErrorMessage(null); }}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'setup' || activeTab === 'pair'
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            {isConfigured ? 'Pair Devices' : 'Setup & Connect'}
          </button>

          {isConfigured && (
            <button
              onClick={() => { setActiveTab('recovery'); setErrorMessage(null); }}
              className={`py-2.5 border-b-2 transition-colors ${
                activeTab === 'recovery'
                  ? 'border-black dark:border-white text-black dark:text-white'
                  : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              Recovery Phrase
            </button>
          )}

          <button
            onClick={() => { setActiveTab('security'); setErrorMessage(null); }}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            Security Model
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB: STATUS */}
          {activeTab === 'status' && isConfigured && (
            <div className="space-y-5">
              <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Sync State:
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
                  className="px-3 py-1.5 text-xs font-medium rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
                  Sync Now
                </button>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Device Information
                </h4>
                <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-900">
                    <span className="text-neutral-500">Account ID</span>
                    <span className="font-mono text-neutral-800 dark:text-neutral-200">{config?.accountId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-900">
                    <span className="text-neutral-500">Device ID</span>
                    <span className="font-mono text-neutral-800 dark:text-neutral-200">{config?.deviceId}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-neutral-500">Encryption Layer</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> AES-256-GCM (Client-Only)
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('pair')}
                  className="text-xs text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1.5 font-medium underline underline-offset-4"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Add or Pair Another Device
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1"
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
                  className={`pb-2 border-b-2 ${
                    setupMode === 'new'
                      ? 'border-black dark:border-white text-black dark:text-white'
                      : 'border-transparent text-neutral-500'
                  }`}
                >
                  Create New Sync Account
                </button>
                <button
                  onClick={() => setSetupMode('existing')}
                  className={`pb-2 border-b-2 ${
                    setupMode === 'existing'
                      ? 'border-black dark:border-white text-black dark:text-white'
                      : 'border-transparent text-neutral-500'
                  }`}
                >
                  Connect with Recovery Phrase
                </button>
              </div>

              {setupMode === 'new' ? (
                <div className="space-y-4 pt-1">
                  <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" /> Generated Recovery Phrase
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedPhrase)}
                        className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedKey ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    <p className="font-mono text-xs p-2.5 rounded bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 leading-relaxed break-words select-all text-neutral-800 dark:text-neutral-200">
                      {generatedPhrase}
                    </p>

                    <p className="text-[11px] text-neutral-500 leading-normal">
                      Write this phrase down or store it in your password manager. Your Master Encryption Key is derived client-side from this phrase and is never sent to Vercel.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateNewSyncAccount}
                    disabled={isSettingUp}
                    className="w-full py-2.5 text-xs font-medium rounded-md bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSettingUp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Initializing Encryption…
                      </>
                    ) : (
                      <>
                        Confirm & Initialize Vercel Sync <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      Enter Recovery Phrase or Passphrase
                    </label>
                    <textarea
                      rows={3}
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      placeholder="e.g. apple banana courage ... or your custom master passphrase"
                      className="w-full p-2.5 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                    />
                    <p className="text-[11px] text-neutral-500">
                      Keys will be derived client-side to decrypt your notes.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectExistingAccount}
                    disabled={isSettingUp}
                    className="w-full py-2.5 text-xs font-medium rounded-md bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSettingUp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Deriving Keys & Syncing…
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

          {/* TAB: PAIR DEVICES */}
          {activeTab === 'pair' && (
            <div className="space-y-5">
              {isConfigured ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-3">
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> Add a New Device (This is Device A)
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Generate a secure 6-digit pairing code on this trusted device. Open Notes on your second device and enter the code below.
                    </p>

                    {pairingCode ? (
                      <div className="p-4 rounded-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                        <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                          Single-Use Pairing Code
                        </span>
                        <div className="font-mono text-3xl font-bold tracking-widest text-black dark:text-white">
                          {pairingCode.slice(0, 3)} {pairingCode.slice(3)}
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Valid for 5 minutes. The Master Encryption Key is transferred directly between devices via an encrypted ephemeral channel.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartDevicePairing}
                        disabled={isGeneratingPairing}
                        className="py-2 px-3 text-xs font-medium rounded bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity flex items-center gap-1.5"
                      >
                        {isGeneratingPairing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5" />
                        )}
                        Generate Pairing Code
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-3">
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> Pair with Existing Device (This is Device B)
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      On your existing trusted phone or computer, go to <strong>Storage → Vercel Sync → Pair Devices</strong> and generate a 6-digit code.
                    </p>

                    <div className="space-y-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={inputPairingCode}
                        onChange={(e) => setInputPairingCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full p-2.5 text-center font-mono text-xl tracking-widest rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                      />

                      <button
                        type="button"
                        onClick={handleConnectPairingCode}
                        disabled={isConnectingPair || inputPairingCode.length !== 6}
                        className="w-full py-2.5 text-xs font-medium rounded-md bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isConnectingPair ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Establishing Encrypted Pair…
                          </>
                        ) : pairingSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Device Paired Successfully!
                          </>
                        ) : (
                          <>
                            Pair & Sync This Device <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: RECOVERY PHRASE */}
          {activeTab === 'recovery' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <span className="font-semibold">Zero-Knowledge Recovery Guarantee</span>
                  <p className="text-[11px] leading-relaxed">
                    If you lose all your trusted devices and your recovery phrase, your encrypted notes cannot be recovered by the server. Keep this phrase safe.
                  </p>
                </div>
              </div>

              {generatedPhrase && (
                <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Master Recovery Phrase
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedPhrase)}
                      className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1"
                    >
                      {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <p className="font-mono text-xs p-3 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 leading-relaxed select-all">
                    {generatedPhrase}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: SECURITY MODEL */}
          {activeTab === 'security' && (
            <div className="space-y-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-2 text-neutral-900 dark:text-neutral-100">
                <h4 className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> The Device Owns the Keys. Vercel Stores Encrypted Data.
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Every note is encrypted with AES-256-GCM in your browser before leaving your computer or phone. The Vercel server only receives opaque ciphertexts and cannot read note titles, content, tags, or dates.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
                  <span><strong>Client-Side Encryption:</strong> AES-256-GCM with unique 96-bit IVs and 128-bit authentication tags.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
                  <span><strong>Key Derivation:</strong> PBKDF2-SHA256 (600,000 iterations) + HKDF expansion for strict separation between authentication proofs and decryption keys.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
                  <span><strong>Zero-Knowledge Relay:</strong> Vercel acts purely as an untrusted sync relay and cannot decrypt stored records.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500 mt-0.5" />
                  <span><strong>Device-to-Device Pairing:</strong> Ephemeral ECDH key exchanges securely pair secondary devices without exposing master keys to the server.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
