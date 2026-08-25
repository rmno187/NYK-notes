// Client Sync Manager for Vercel · Sync
// Handles background synchronisation, zero-knowledge encryption/decryption,
// offline queues, conflict resolution, and status notifications.

import { Note, SyncStatus, EncryptedNoteEnvelope, VercelSyncConfig } from '../../types';
import {
  deriveSyncKeys,
  importRawEncryptionKey,
  encryptNote,
  decryptNote,
  DerivedKeys,
} from './crypto';
import {
  getVercelCacheNotes,
  saveVercelCacheNote,
  bulkSaveVercelCacheNotes,
  deleteVercelCacheNote,
  getSyncConfigItem,
  setSyncConfigItem,
  clearVercelSyncLocalData,
  queuePendingPush,
  getPendingPushQueue,
  removePendingPush,
} from './cache';

export type SyncStatusListener = (status: SyncStatus, lastSyncedAt?: number) => void;
export type SyncNotesListener = (updatedNotes: Note[]) => void;

class VercelSyncManager {
  private encryptionKey: CryptoKey | null = null;
  private authKeyHex: string | null = null;
  private config: VercelSyncConfig | null = null;
  private status: SyncStatus = 'unconfigured';
  private syncTimer: number | null = null;
  private isSyncing = false;

  private statusListeners = new Set<SyncStatusListener>();
  private notesListeners = new Set<SyncNotesListener>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.isConfigured()) {
          this.sync();
        }
      });
      window.addEventListener('offline', () => {
        this.setStatus('offline');
      });
    }
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.config?.lastSyncedAt);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeNotes(listener: SyncNotesListener): () => void {
    this.notesListeners.add(listener);
    return () => {
      this.notesListeners.delete(listener);
    };
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.statusListeners.forEach((l) => l(this.status, this.config?.lastSyncedAt));
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getConfig(): VercelSyncConfig | null {
    return this.config;
  }

  public isConfigured(): boolean {
    return Boolean(this.config && this.authKeyHex && this.encryptionKey);
  }

  // Initialize from locally stored credentials on app startup
  public async initialize(): Promise<boolean> {
    try {
      const config = await getSyncConfigItem<VercelSyncConfig>('sync_config');
      const authKeyHex = await getSyncConfigItem<string>('auth_key_hex');
      const rawMEK = await getSyncConfigItem<string>('encryption_key_raw');

      if (config && authKeyHex && rawMEK) {
        this.config = config;
        this.authKeyHex = authKeyHex;
        this.encryptionKey = await importRawEncryptionKey(rawMEK);
        this.setStatus(navigator.onLine ? 'synced' : 'offline');

        this.startAutoSync();
        return true;
      } else {
        this.setStatus('unconfigured');
        return false;
      }
    } catch (err) {
      console.error('Failed to initialize VercelSyncManager:', err);
      this.setStatus('unconfigured');
      return false;
    }
  }

  // Setup/Login to a Sync Account using Passphrase or Recovery Phrase
  public async setupWithPassphrase(
    passphrase: string,
    existingSaltBase64?: string,
    existingAccountId?: string
  ): Promise<{ accountId: string; recoveryPhrase: string; isNewAccount: boolean }> {
    this.setStatus('syncing');

    // 1. Derive Keys Zero-Knowledge
    const derived = await deriveSyncKeys(passphrase, existingSaltBase64);
    this.encryptionKey = derived.encryptionKey;
    this.authKeyHex = derived.authKeyHex;

    // 2. Authenticate or Register with Vercel API
    const response = await fetch('/api/sync/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authKeyHex: derived.authKeyHex,
        authSalt: derived.authSalt,
        accountId: existingAccountId,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Sync authentication failed' }));
      this.setStatus('error');
      throw new Error(err.error || 'Sync authentication failed');
    }

    const resData = await response.json();
    const accountId = resData.accountId;
    const isNewAccount = resData.isNew;

    // 3. Save to isolated local sync storage
    const deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
    const deviceName =
      (typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile')
        ? 'Mobile Device'
        : 'Desktop Browser') + ` (${deviceId.slice(-4)})`;

    const config: VercelSyncConfig = {
      accountId,
      authSalt: derived.authSalt,
      deviceId,
      deviceName,
      lastSyncedAt: 0,
      autoSync: true,
    };

    await setSyncConfigItem('sync_config', config);
    await setSyncConfigItem('auth_key_hex', derived.authKeyHex);
    await setSyncConfigItem('encryption_key_raw', derived.encryptionKeyRaw);

    this.config = config;
    this.setStatus('synced');
    this.startAutoSync();

    // Trigger initial full sync pull
    await this.sync();

    return {
      accountId,
      recoveryPhrase: passphrase,
      isNewAccount,
    };
  }

  // Pair from another device using direct shared credentials
  public async setupWithPairedCredentials(
    accountId: string,
    authKeyHex: string,
    authSalt: string,
    rawEncryptionKey: string
  ): Promise<void> {
    this.setStatus('syncing');
    this.authKeyHex = authKeyHex;
    this.encryptionKey = await importRawEncryptionKey(rawEncryptionKey);

    const deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
    const config: VercelSyncConfig = {
      accountId,
      authSalt,
      deviceId,
      deviceName: 'Paired Device (' + deviceId.slice(-4) + ')',
      lastSyncedAt: 0,
      autoSync: true,
    };

    await setSyncConfigItem('sync_config', config);
    await setSyncConfigItem('auth_key_hex', authKeyHex);
    await setSyncConfigItem('encryption_key_raw', rawEncryptionKey);

    this.config = config;
    this.setStatus('synced');
    this.startAutoSync();

    await this.sync();
  }

  // Disconnect / Clear Vercel Sync
  public async disconnect(): Promise<void> {
    this.stopAutoSync();
    this.encryptionKey = null;
    this.authKeyHex = null;
    this.config = null;
    await clearVercelSyncLocalData();
    this.setStatus('unconfigured');
  }

  // Get raw credentials for device pairing
  public async getPairingCredentials(): Promise<{
    accountId: string;
    authKeyHex: string;
    authSalt: string;
    rawEncryptionKey: string;
  } | null> {
    if (!this.config || !this.authKeyHex) return null;
    const rawMEK = await getSyncConfigItem<string>('encryption_key_raw');
    if (!rawMEK) return null;

    return {
      accountId: this.config.accountId,
      authKeyHex: this.authKeyHex,
      authSalt: this.config.authSalt,
      rawEncryptionKey: rawMEK,
    };
  }

  // Load active notes from isolated working cache
  public async loadNotes(): Promise<Note[]> {
    return getVercelCacheNotes();
  }

  // Save note locally, encrypt, and push/queue for sync
  public async saveNote(note: Note): Promise<void> {
    // 1. Update local cache immediately for instant zero-lag response
    await saveVercelCacheNote(note);

    if (!this.encryptionKey || !this.authKeyHex) {
      return;
    }

    try {
      // 2. Encrypt note with AES-256-GCM
      const envelope = await encryptNote(note, this.encryptionKey);

      if (!navigator.onLine) {
        // Queue for when network returns
        await queuePendingPush(envelope);
        this.setStatus('offline');
        return;
      }

      // 3. Push to Vercel API
      this.pushSingleChange(envelope);
    } catch (err) {
      console.error('Failed to encrypt note for sync:', err);
    }
  }

  // Delete note locally and send tombstone
  public async deleteNote(id: string): Promise<void> {
    const existing = (await getVercelCacheNotes()).find((n) => n.id === id);
    await deleteVercelCacheNote(id);

    if (!this.encryptionKey || !this.authKeyHex) return;

    const tombstoneNote: Note = existing
      ? { ...existing, deletedAt: Date.now() }
      : {
          id,
          title: '',
          content: '',
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        };

    const envelope = await encryptNote(tombstoneNote, this.encryptionKey);
    if (!navigator.onLine) {
      await queuePendingPush(envelope);
    } else {
      this.pushSingleChange(envelope);
    }
  }

  private async pushSingleChange(envelope: EncryptedNoteEnvelope) {
    if (!this.config || !this.authKeyHex) return;

    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authKeyHex}`,
        },
        body: JSON.stringify({
          accountId: this.config.accountId,
          deviceId: this.config.deviceId,
          changes: [envelope],
        }),
      });

      if (!response.ok) {
        await queuePendingPush(envelope);
        this.setStatus('error');
      } else {
        await removePendingPush(envelope.noteId);
      }
    } catch (err) {
      await queuePendingPush(envelope);
      this.setStatus('offline');
    }
  }

  // Full 2-Way Sync Operation (Push pending changes, Pull remote changes)
  public async sync(): Promise<void> {
    if (this.isSyncing || !this.isConfigured() || !this.config || !this.authKeyHex || !this.encryptionKey) {
      return;
    }

    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      // 1. Push any queued offline changes
      const pendingEnvelopes = await getPendingPushQueue();
      if (pendingEnvelopes.length > 0) {
        const pushRes = await fetch('/api/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authKeyHex}`,
          },
          body: JSON.stringify({
            accountId: this.config.accountId,
            deviceId: this.config.deviceId,
            changes: pendingEnvelopes,
          }),
        });

        if (pushRes.ok) {
          for (const env of pendingEnvelopes) {
            await removePendingPush(env.noteId);
          }
        }
      }

      // 2. Pull remote changes
      const pullUrl = `/api/sync/pull?accountId=${encodeURIComponent(
        this.config.accountId
      )}&since=${encodeURIComponent(this.config.lastSyncedAt || 0)}`;

      const pullRes = await fetch(pullUrl, {
        headers: {
          'Authorization': `Bearer ${this.authKeyHex}`,
        },
      });

      if (!pullRes.ok) {
        throw new Error(`Sync pull failed with status ${pullRes.status}`);
      }

      const pullData = await pullRes.json();
      const remoteEnvelopes: EncryptedNoteEnvelope[] = pullData.notes || [];
      const serverTimestamp: number = pullData.serverTimestamp || Date.now();

      if (remoteEnvelopes.length > 0) {
        const localNotes = await getVercelCacheNotes();
        const localMap = new Map(localNotes.map((n) => [n.id, n]));
        let hasChanges = false;

        for (const envelope of remoteEnvelopes) {
          const local = localMap.get(envelope.noteId);

          // Conflict check: if local has a newer update time, keep local and will sync later
          if (local && local.updatedAt > envelope.updatedAt) {
            continue;
          }

          // Decrypt incoming remote note (Zero-Knowledge)
          const decrypted = await decryptNote(envelope, this.encryptionKey);
          if (decrypted) {
            if (decrypted.deletedAt || envelope.deleted) {
              await saveVercelCacheNote(decrypted); // keep in trash
            } else {
              await saveVercelCacheNote(decrypted);
            }
            localMap.set(decrypted.id, decrypted);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          const allWorking = Array.from(localMap.values());
          this.notesListeners.forEach((l) => l(allWorking));
        }
      }

      // Update sync watermark
      this.config.lastSyncedAt = serverTimestamp;
      await setSyncConfigItem('sync_config', this.config);
      this.setStatus('synced');
    } catch (err) {
      console.error('Vercel sync cycle error:', err);
      this.setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      this.isSyncing = false;
    }
  }

  // Periodic Auto-Sync Timer
  private startAutoSync() {
    this.stopAutoSync();
    // Auto-sync every 30 seconds or when window gains focus
    this.syncTimer = window.setInterval(() => {
      if (this.isConfigured() && navigator.onLine) {
        this.sync();
      }
    }, 30_000);

    window.addEventListener('focus', this.onWindowFocus);
  }

  private onWindowFocus = () => {
    if (this.isConfigured() && navigator.onLine) {
      this.sync();
    }
  };

  private stopAutoSync() {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
  }
}

export const syncManager = new VercelSyncManager();
