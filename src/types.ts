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
}

export type StorageMode = 'filesystem' | 'indexeddb';

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
