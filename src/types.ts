export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  pinned?: boolean;
  fileName?: string; // name of file on disk if using File System Access API
  deletedAt?: number; // timestamp when soft-deleted to trash
  type?: 'note' | 'post';
  date?: string; // e.g. "August 25, 2026"
  description?: string; // Subtitle / summary
  author?: string;
  featured?: boolean;
}

export type StorageMode = 'filesystem' | 'indexeddb' | 'vercel';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'unconfigured';

export interface VercelSyncConfig {
  accountId: string;
  authSalt: string;      // Base64 salt used for PBKDF2
  deviceId: string;
  deviceName: string;
  lastSyncedAt: number;
  syncIntervalMs?: number;
  autoSync?: boolean;
}

export interface EncryptedNoteEnvelope {
  noteId: string;
  version: number;
  ciphertext: string;    // Base64 encoded AES-256-GCM ciphertext + tag
  iv: string;            // Base64 encoded 12-byte IV
  updatedAt: number;
  deleted: boolean;
}

export interface SyncPushPayload {
  changes: EncryptedNoteEnvelope[];
  deviceId: string;
}

export interface SyncPullResponse {
  notes: EncryptedNoteEnvelope[];
  serverTimestamp: number;
}

export type Theme = 'light' | 'dark' | 'system';

export type EditorMode = 'wysiwyg' | 'markdown';
export type ViewMode = EditorMode;

export type SortField = 'updatedAt' | 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface EncryptedBackupPayload {
  version: number;
  salt: string; // Hex or Base64 string
  iv: string;   // Hex or Base64 string
  ciphertext: string; // Base64 encoded encrypted string
  createdAt: string;
}

export interface BackupData {
  version: number;
  notes: Note[];
  exportedAt: string;
  app: string;
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: 'General' | 'Navigation' | 'Editing';
  combination: string;
}
