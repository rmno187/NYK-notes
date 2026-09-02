export type NoteType = 'note' | 'post' | 'project';
export type ProjectStatus = 'Active' | 'Development' | 'Ended';
export type ImageFolderStrategy = 'same-folder' | 'post-folder' | 'images-folder';

export interface NoteImage {
  id: string;
  name: string; // e.g. "cover.png"
  dataUrl: string; // Base64 data URL e.g. "data:image/png;base64,..." or remote URL
  relativePath: string; // e.g. "./cover.png" or "./post-slug/cover.png" or "./images/cover.png"
  alt?: string;
  size?: number; // bytes
  mimeType?: string;
  createdAt?: number;
}

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
  type?: NoteType;
  date?: string; // e.g. "August 25, 2026"
  description?: string; // Subtitle / summary
  author?: string;
  project?: string;
  featured?: boolean;
  // Project specific fields
  slug?: string;
  status?: ProjectStatus | string;
  year?: number | string;
  url?: string;
  github?: string;
  order?: number;
  // Image assets
  images?: NoteImage[];
  imageFolderStrategy?: ImageFolderStrategy;
  // Local Disk Backup / Git Sync state
  localBackedUp?: boolean;
  localSyncedAt?: number;
  localFolderCategory?: 'posts' | 'projects' | 'notes' | 'root' | string;
  localFolderName?: string;
}

export interface LocalFolderConfig {
  rootHandle?: FileSystemDirectoryHandle | null;
  rootName?: string;
  postsHandle?: FileSystemDirectoryHandle | null;
  postsName?: string;
  projectsHandle?: FileSystemDirectoryHandle | null;
  projectsName?: string;
  notesHandle?: FileSystemDirectoryHandle | null;
  notesName?: string;
  autoSyncToDisk?: boolean;
}

export type StorageMode = 'filesystem' | 'indexeddb' | 'vercel';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'unconfigured';

export interface VercelSyncConfig {
  vaultId: string;
  accountId: string;     // alias for vaultId for backward compatibility
  authSalt: string;      // Base64 salt used for PBKDF2
  deviceId: string;
  deviceName: string;
  lastSyncedAt: number;
  syncIntervalMs?: number;
  autoSync?: boolean;
}

export interface EncryptedNoteEnvelope {
  noteId: string;
  vaultId?: string;
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
