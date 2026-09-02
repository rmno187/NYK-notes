import { Note, NoteImage, StorageMode } from '../types';
import { parseMarkdownNote, serializeNoteToMarkdown } from './markdown';
import { getNoteBaseName } from './noteUtils';
import { readFileAsDataUrl } from './imageUtils';
import { saveImagesToDirectoryHandle } from './localFileOperations';

const DB_NAME = 'OfflineNotesDB';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const CONFIG_STORE = 'config';

// Open IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        notesStore.createIndex('title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB Helper Functions
export async function getIndexedDBNotes(): Promise<Note[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readonly');
    const store = tx.objectStore(NOTES_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveIndexedDBNote(note: Note): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readwrite');
    const store = tx.objectStore(NOTES_STORE);
    const request = store.put(note);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteIndexedDBNote(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readwrite');
    const store = tx.objectStore(NOTES_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearIndexedDBNotes(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readwrite');
    const store = tx.objectStore(NOTES_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Config Storage (e.g. storing directory handle or setting)
export async function saveConfig(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE, 'readwrite');
    const store = tx.objectStore(CONFIG_STORE);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getConfig(key: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE, 'readonly');
    const store = tx.objectStore(CONFIG_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Global FileSystemDirectoryHandle reference in memory
let activeDirectoryHandle: FileSystemDirectoryHandle | null = null;

export function getActiveDirectoryHandle(): FileSystemDirectoryHandle | null {
  return activeDirectoryHandle;
}

export function setActiveDirectoryHandle(handle: FileSystemDirectoryHandle | null) {
  activeDirectoryHandle = handle;
}

/**
 * Check if File System Access API is supported in current browser
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Prompt user to select a local directory for notes storage
 */
export async function selectLocalDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser environment.');
  }

  try {
    const directoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      id: 'markdown-notes-folder',
    });

    activeDirectoryHandle = directoryHandle;
    await saveConfig('directoryHandle', directoryHandle);
    return directoryHandle;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Directory selection was cancelled.');
    }
    throw new Error(err.message || 'Failed to select directory.');
  }
}

/**
 * Load all .md files and their corresponding asset folders from selected local directory
 */
export async function loadNotesFromDirectory(dirHandle: FileSystemDirectoryHandle): Promise<Note[]> {
  const notes: Note[] = [];

  // Verify permission
  const options = { mode: 'readwrite' };
  if ((await (dirHandle as any).queryPermission(options)) !== 'granted') {
    if ((await (dirHandle as any).requestPermission(options)) !== 'granted') {
      throw new Error('Permission to access directory was denied.');
    }
  }

  // Collect markdown files and subdirectories
  const mdEntries: { name: string; handle: any }[] = [];
  const dirEntries = new Map<string, any>();

  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
      mdEntries.push({ name: entry.name, handle: entry });
    } else if (entry.kind === 'directory') {
      dirEntries.set(entry.name, entry);
    }
  }

  for (const { name: fileName, handle: mdHandle } of mdEntries) {
    try {
      const file = await mdHandle.getFile();
      const rawContent = await file.text();
      const parsed = parseMarkdownNote(rawContent, fileName);

      // Derive base name from current fileName as the source of truth
      const baseName = getNoteBaseName({
        fileName,
        title: parsed.title,
        date: parsed.date,
        createdAt: file.lastModified,
      });

      const attachedImages: NoteImage[] = [];

      // Look for asset folder matching this post's baseName
      if (dirEntries.has(baseName)) {
        const subDirHandle = dirEntries.get(baseName);
        for await (const subEntry of subDirHandle.values()) {
          if (subEntry.kind === 'file') {
            const ext = subEntry.name.split('.').pop()?.toLowerCase() || '';
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'].includes(ext)) {
              try {
                const imgFile = await subEntry.getFile();
                const dataUrl = await readFileAsDataUrl(imgFile);
                attachedImages.push({
                  id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                  name: subEntry.name,
                  dataUrl,
                  relativePath: `./${baseName}/${subEntry.name}`,
                  alt: subEntry.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
                  size: imgFile.size,
                  mimeType: imgFile.type,
                  createdAt: imgFile.lastModified || Date.now(),
                });
              } catch (e) {
                console.warn(`Failed to read image ${subEntry.name}:`, e);
              }
            }
          }
        }
      }

      notes.push({
        id: fileName,
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags,
        pinned: parsed.pinned,
        createdAt: file.lastModified,
        updatedAt: file.lastModified,
        fileName: fileName,
        type: parsed.type,
        date: parsed.date,
        description: parsed.description,
        author: parsed.author,
        project: parsed.project,
        featured: parsed.featured,
        images: attachedImages.length > 0 ? attachedImages : undefined,
      });
    } catch (e) {
      console.error(`Error reading file ${fileName}:`, e);
    }
  }

  return notes;
}

/**
 * Save note to disk file inside selected local directory and save any attached images into its asset folder
 */
export async function saveNoteToDirectory(dirHandle: FileSystemDirectoryHandle, note: Note): Promise<string> {
  const options = { mode: 'readwrite' };
  if ((await (dirHandle as any).queryPermission(options)) !== 'granted') {
    await (dirHandle as any).requestPermission(options);
  }

  // Generate safe filename from title or existing fileName
  let fileName = note.fileName;
  if (!fileName) {
    const safeTitle = note.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    fileName = `${safeTitle || 'note'}-${Date.now().toString(36)}.md`;
  }

  const serializedContent = serializeNoteToMarkdown(note);

  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(serializedContent);
  await writable.close();

  // Save attached images to asset directory
  if (note.images && note.images.length > 0) {
    await saveImagesToDirectoryHandle(dirHandle, note.images);
  }

  return fileName;
}

/**
 * Delete note file from selected local directory
 */
export async function deleteNoteFromDirectory(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  const options = { mode: 'readwrite' };
  if ((await (dirHandle as any).queryPermission(options)) !== 'granted') {
    await (dirHandle as any).requestPermission(options);
  }

  try {
    await dirHandle.removeEntry(fileName);
  } catch (err) {
    console.warn(`Could not remove file ${fileName} from directory:`, err);
  }
}
