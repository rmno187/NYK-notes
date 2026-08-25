// Local working cache for Vercel · Sync (IndexedDB)
// Keeps a local copy of decrypted working notes and metadata so Vercel Sync is fully offline-first.

import { Note, VercelSyncConfig, EncryptedNoteEnvelope } from '../../types';

const DB_NAME = 'VercelSyncLocalCacheDB';
const DB_VERSION = 1;

interface SyncMeta {
  key: string;
  value: any;
}

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Store for working notes (offline cache)
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        notesStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // Store for sync configuration & credentials (MEK raw key, auth salt, device ID)
      if (!db.objectStoreNames.contains('sync_config')) {
        db.createObjectStore('sync_config', { keyPath: 'key' });
      }

      // Store for offline pending push queue
      if (!db.objectStoreNames.contains('pending_push')) {
        db.createObjectStore('pending_push', { keyPath: 'noteId' });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(new Error('Failed to open VercelSyncLocalCacheDB'));
    };
  });
}

// 1. Working Notes Cache
export async function getVercelCacheNotes(): Promise<Note[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readonly');
    const store = tx.objectStore('notes');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVercelCacheNote(note: Note): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    const request = store.put(note);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulkSaveVercelCacheNotes(notes: Note[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    for (const note of notes) {
      store.put(note);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteVercelCacheNote(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 2. Sync Credentials & Config Persistence
export async function getSyncConfigItem<T>(key: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_config', 'readonly');
    const store = tx.objectStore('sync_config');
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result ? (request.result.value as T) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function setSyncConfigItem<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_config', 'readwrite');
    const store = tx.objectStore('sync_config');
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearVercelSyncLocalData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['notes', 'sync_config', 'pending_push'], 'readwrite');
    tx.objectStore('notes').clear();
    tx.objectStore('sync_config').clear();
    tx.objectStore('pending_push').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 3. Offline Pending Changes Queue
export async function queuePendingPush(envelope: EncryptedNoteEnvelope): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_push', 'readwrite');
    const store = tx.objectStore('pending_push');
    const request = store.put(envelope);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingPushQueue(): Promise<EncryptedNoteEnvelope[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_push', 'readonly');
    const store = tx.objectStore('pending_push');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingPush(noteId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_push', 'readwrite');
    const store = tx.objectStore('pending_push');
    const request = store.delete(noteId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
