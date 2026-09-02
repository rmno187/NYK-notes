import { Note, NoteType, LocalFolderConfig } from '../types';
import { serializeNoteToMarkdown, parseMarkdownNote } from './markdown';
import { getNoteBaseName, slugify } from './noteUtils';
import { readFileAsDataUrl } from './imageUtils';
import { saveImagesToDirectoryHandle } from './localFileOperations';

const CONFIG_DB_NAME = 'OfflineNotesDB';
const CONFIG_STORE_NAME = 'config';

// Open or get IndexedDB for config
function openConfigDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        notesStore.createIndex('title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE_NAME)) {
        db.createObjectStore(CONFIG_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveHandleToIDB(key: string, value: any): Promise<void> {
  try {
    const db = await openConfigDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG_STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Failed to persist handle for ${key}:`, err);
  }
}

export async function getHandleFromIDB(key: string): Promise<any> {
  try {
    const db = await openConfigDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE_NAME, 'readonly');
      const store = tx.objectStore(CONFIG_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Failed to retrieve handle for ${key}:`, err);
    return null;
  }
}

export async function removeHandleFromIDB(key: string): Promise<void> {
  try {
    const db = await openConfigDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONFIG_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG_STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Failed to delete handle for ${key}:`, err);
  }
}

// In-memory state for local folders
class LocalFolderManager {
  private config: LocalFolderConfig = {
    rootHandle: null,
    rootName: '',
    postsHandle: null,
    postsName: '',
    projectsHandle: null,
    projectsName: '',
    notesHandle: null,
    notesName: '',
    autoSyncToDisk: true,
  };

  private initialized = false;
  private listeners: Set<(config: LocalFolderConfig) => void> = new Set();

  subscribe(callback: (config: LocalFolderConfig) => void): () => void {
    this.listeners.add(callback);
    callback(this.getConfig());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const current = this.getConfig();
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch (e) {
        console.error('Error in localFolderManager subscriber:', e);
      }
    });
  }

  async initialize(): Promise<LocalFolderConfig> {
    if (this.initialized) {
      this.notify();
      return this.config;
    }

    try {
      const rootHandle = await getHandleFromIDB('folder_root');
      const postsHandle = await getHandleFromIDB('folder_posts');
      const projectsHandle = await getHandleFromIDB('folder_projects');
      const notesHandle = await getHandleFromIDB('folder_notes');
      const autoSyncVal = localStorage.getItem('local_auto_sync_to_disk');

      this.config = {
        rootHandle: rootHandle || null,
        rootName: rootHandle?.name || '',
        postsHandle: postsHandle || null,
        postsName: postsHandle?.name || '',
        projectsHandle: projectsHandle || null,
        projectsName: projectsHandle?.name || '',
        notesHandle: notesHandle || null,
        notesName: notesHandle?.name || '',
        autoSyncToDisk: autoSyncVal !== null ? autoSyncVal === 'true' : true,
      };

      this.initialized = true;
      this.notify();
    } catch (err) {
      console.warn('Failed to load saved directory handles:', err);
    }

    return this.config;
  }

  getConfig(): LocalFolderConfig {
    return { ...this.config };
  }

  setAutoSync(enabled: boolean) {
    this.config.autoSyncToDisk = enabled;
    localStorage.setItem('local_auto_sync_to_disk', String(enabled));
    this.notify();
  }

  hasAnyFolderConfigured(): boolean {
    return Boolean(
      this.config.rootHandle ||
      this.config.postsHandle ||
      this.config.projectsHandle ||
      this.config.notesHandle
    );
  }

  // Request directory permission if needed
  async verifyPermission(handle: FileSystemDirectoryHandle, readwrite = true): Promise<boolean> {
    try {
      const mode = readwrite ? 'readwrite' : 'read';
      const options = { mode };
      if ((await (handle as any).queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await (handle as any).requestPermission(options)) === 'granted') {
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Error verifying directory permission:', err);
      return false;
    }
  }

  // Select Root Content / Repo directory
  async pickRootDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser.');
    }

    try {
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        id: 'blog-root-content-folder',
      });

      await this.verifyPermission(handle, true);

      this.config.rootHandle = handle;
      this.config.rootName = handle.name;
      await saveHandleToIDB('folder_root', handle);
      this.notify();

      return handle;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }

  // Select specific folder for Posts, Projects, or Notes
  async pickCategoryDirectory(
    category: 'posts' | 'projects' | 'notes'
  ): Promise<FileSystemDirectoryHandle | null> {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser.');
    }

    try {
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        id: `blog-${category}-folder`,
      });

      await this.verifyPermission(handle, true);

      if (category === 'posts') {
        this.config.postsHandle = handle;
        this.config.postsName = handle.name;
        await saveHandleToIDB('folder_posts', handle);
      } else if (category === 'projects') {
        this.config.projectsHandle = handle;
        this.config.projectsName = handle.name;
        await saveHandleToIDB('folder_projects', handle);
      } else if (category === 'notes') {
        this.config.notesHandle = handle;
        this.config.notesName = handle.name;
        await saveHandleToIDB('folder_notes', handle);
      }

      this.notify();
      return handle;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }

  // Clear a folder setting
  async clearCategoryDirectory(category: 'root' | 'posts' | 'projects' | 'notes') {
    if (category === 'root') {
      this.config.rootHandle = null;
      this.config.rootName = '';
      await removeHandleFromIDB('folder_root');
    } else if (category === 'posts') {
      this.config.postsHandle = null;
      this.config.postsName = '';
      await removeHandleFromIDB('folder_posts');
    } else if (category === 'projects') {
      this.config.projectsHandle = null;
      this.config.projectsName = '';
      await removeHandleFromIDB('folder_projects');
    } else if (category === 'notes') {
      this.config.notesHandle = null;
      this.config.notesName = '';
      await removeHandleFromIDB('folder_notes');
    }
    this.notify();
  }

  // Resolve which directory handle should be used for a given note
  async getDirectoryHandleForNote(note: Partial<Note>): Promise<{
    handle: FileSystemDirectoryHandle;
    folderName: string;
    category: 'posts' | 'projects' | 'notes' | 'root';
  } | null> {
    const type: NoteType = note.type || 'note';

    // 1. Check explicit category handle first
    if (type === 'post' && this.config.postsHandle) {
      const ok = await this.verifyPermission(this.config.postsHandle);
      if (ok) {
        return {
          handle: this.config.postsHandle,
          folderName: this.config.postsName || 'posts',
          category: 'posts',
        };
      }
    }

    if (type === 'project' && this.config.projectsHandle) {
      const ok = await this.verifyPermission(this.config.projectsHandle);
      if (ok) {
        return {
          handle: this.config.projectsHandle,
          folderName: this.config.projectsName || 'projects',
          category: 'projects',
        };
      }
    }

    if (type === 'note' && this.config.notesHandle) {
      const ok = await this.verifyPermission(this.config.notesHandle);
      if (ok) {
        return {
          handle: this.config.notesHandle,
          folderName: this.config.notesName || 'notes',
          category: 'notes',
        };
      }
    }

    // 2. Check if root handle is set. If so, locate or create the appropriate subfolder
    if (this.config.rootHandle) {
      const ok = await this.verifyPermission(this.config.rootHandle);
      if (ok) {
        let subfolderName = 'notes';
        if (type === 'post') subfolderName = 'posts';
        else if (type === 'project') subfolderName = 'projects';

        try {
          // Check if root already has a 'content' folder or is itself the content folder
          let targetParent = this.config.rootHandle;
          try {
            const contentSubDir = await this.config.rootHandle.getDirectoryHandle('content', { create: false });
            targetParent = contentSubDir;
          } catch {
            // Root is already content or flat repo
          }

          const subDirHandle = await targetParent.getDirectoryHandle(subfolderName, { create: true });
          return {
            handle: subDirHandle,
            folderName: `${this.config.rootName}/${subfolderName}`,
            category: type === 'post' ? 'posts' : type === 'project' ? 'projects' : 'notes',
          };
        } catch (err) {
          console.warn(`Could not create subfolder ${subfolderName} in root handle:`, err);
          return {
            handle: this.config.rootHandle,
            folderName: this.config.rootName || 'root',
            category: 'root',
          };
        }
      }
    }

    return null;
  }

  // Save a single note to its corresponding local folder
  async saveNoteToLocalFolder(
    note: Note,
    previousFileName?: string
  ): Promise<{
    fileName: string;
    folderName: string;
    category: string;
    savedImagePaths: string[];
  } | null> {
    const dest = await this.getDirectoryHandleForNote(note);
    if (!dest) return null;

    const { handle: dirHandle, folderName, category } = dest;

    // Generate accurate markdown filename based on current note title/slug
    const baseName = getNoteBaseName(note);
    const targetFileName = `${baseName}.md`;

    // Track and remove old file if name changed to prevent duplicate files on disk
    const oldFilesToDelete = new Set<string>();
    if (previousFileName && previousFileName !== targetFileName) {
      oldFilesToDelete.add(previousFileName);
    }
    if (note.fileName && note.fileName !== targetFileName) {
      oldFilesToDelete.add(note.fileName);
    }

    for (const oldFile of oldFilesToDelete) {
      try {
        await dirHandle.removeEntry(oldFile);
      } catch (e) {
        // Safe to ignore if didn't exist
      }
    }

    // Serialize and write file
    const markdownContent = serializeNoteToMarkdown(note);
    const fileHandle = await dirHandle.getFileHandle(targetFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(markdownContent);
    await writable.close();

    // Write attached images into asset folders if present
    let savedImagePaths: string[] = [];
    if (note.images && note.images.length > 0) {
      savedImagePaths = await saveImagesToDirectoryHandle(dirHandle, note.images);
    }

    return {
      fileName: targetFileName,
      folderName,
      category,
      savedImagePaths,
    };
  }

  // Delete a note from its local folder (e.g. when sent to trash or permanently deleted)
  async deleteNoteFromLocalFolder(note: Note, fileNameToDelete?: string): Promise<boolean> {
    const dest = await this.getDirectoryHandleForNote(note);
    if (!dest) return false;

    const { handle: dirHandle } = dest;
    const candidates = new Set<string>();
    if (fileNameToDelete) candidates.add(fileNameToDelete);
    if (note.fileName) candidates.add(note.fileName);

    const baseName = getNoteBaseName(note);
    candidates.add(`${baseName}.md`);
    if (note.title) {
      const slugTitle = slugify(note.title);
      if (slugTitle) {
        candidates.add(`${slugTitle}.md`);
        if (note.date) candidates.add(`${note.date}-${slugTitle}.md`);
      }
    }

    let deletedAny = false;

    // 1. Direct candidate removals
    for (const cand of candidates) {
      const cleanName = cand.endsWith('.md') ? cand : `${cand}.md`;
      try {
        await dirHandle.removeEntry(cleanName);
        deletedAny = true;
      } catch (e) {
        // Entry might not exist with this name
      }

      // Also try removing matching asset subfolder
      const assetSubDir = cleanName.replace(/\.md$/, '');
      try {
        await (dirHandle as any).removeEntry(assetSubDir, { recursive: true });
      } catch (e) {
        // Asset subfolder might not exist, safe to ignore
      }
    }

    // 2. Scan directory to catch any file matching note id or title
    try {
      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          try {
            const file: File = await entry.getFile();
            const text = await file.text();
            if (
              (note.id && text.includes(`id: "${note.id}"`)) ||
              (note.id && text.includes(`id: ${note.id}`)) ||
              (note.title && text.includes(`title: "${note.title}"`)) ||
              (note.title && text.includes(`title: '${note.title}'`))
            ) {
              await dirHandle.removeEntry(entry.name);
              deletedAny = true;

              const assetFolder = entry.name.replace(/\.(md|markdown)$/, '');
              try {
                await (dirHandle as any).removeEntry(assetFolder, { recursive: true });
              } catch (e) {}
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Error scanning directory for note deletion:', e);
    }

    return deletedAny;
  }

  // Sync all active notes into local folders and delete trashed notes from disk
  async syncAllNotes(notes: Note[]): Promise<{
    savedCount: number;
    deletedCount: number;
    errors: string[];
  }> {
    let savedCount = 0;
    let deletedCount = 0;
    const errors: string[] = [];

    for (const note of notes) {
      try {
        if (note.deletedAt) {
          const wasDeleted = await this.deleteNoteFromLocalFolder(note);
          if (wasDeleted) deletedCount++;
        } else {
          const res = await this.saveNoteToLocalFolder(note);
          if (res) savedCount++;
        }
      } catch (err: any) {
        errors.push(`Failed to sync "${note.title || 'Untitled'}": ${err.message || 'Unknown error'}`);
      }
    }

    return { savedCount, deletedCount, errors };
  }

  // Load all markdown files from all configured local folders
  async loadAllNotesFromLocalFolders(): Promise<Note[]> {
    const loadedNotes: Note[] = [];
    const seenFileNames = new Set<string>();

    const readFromFolder = async (
      dirHandle: FileSystemDirectoryHandle,
      defaultType?: NoteType
    ) => {
      const ok = await this.verifyPermission(dirHandle, false);
      if (!ok) return;

      const mdFiles: { name: string; handle: any }[] = [];
      const subDirs = new Map<string, any>();

      for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          mdFiles.push({ name: entry.name, handle: entry });
        } else if (entry.kind === 'directory') {
          subDirs.set(entry.name, entry);
        }
      }

      for (const { name: fileName, handle: fileHandle } of mdFiles) {
        if (seenFileNames.has(fileName)) continue;
        seenFileNames.add(fileName);

        try {
          const file: File = await fileHandle.getFile();
          const text = await file.text();
          const parsed = parseMarkdownNote(text, fileName);

          const inferredType: NoteType =
            parsed.type || defaultType || (fileName.includes('project') ? 'project' : 'note');

          const baseName = getNoteBaseName({
            fileName,
            title: parsed.title,
            date: parsed.date,
            createdAt: file.lastModified,
          });

          // Check for attached images in matching folder
          const images: any[] = [];
          if (subDirs.has(baseName)) {
            const subDirHandle = subDirs.get(baseName);
            for await (const subEntry of subDirHandle.values()) {
              if (subEntry.kind === 'file') {
                const ext = subEntry.name.split('.').pop()?.toLowerCase() || '';
                if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) {
                  try {
                    const imgFile = await subEntry.getFile();
                    const dataUrl = await readFileAsDataUrl(imgFile);
                    images.push({
                      id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                      name: subEntry.name,
                      dataUrl,
                      relativePath: `./${baseName}/${subEntry.name}`,
                      alt: subEntry.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
                      size: imgFile.size,
                      mimeType: imgFile.type,
                      createdAt: imgFile.lastModified,
                    });
                  } catch (e) {
                    console.warn(`Could not read image ${subEntry.name}:`, e);
                  }
                }
              }
            }
          }

          loadedNotes.push({
            id: `local-${fileName.replace(/\.md$/, '')}`,
            title: parsed.title,
            content: parsed.content,
            tags: parsed.tags || [],
            pinned: Boolean(parsed.pinned),
            type: inferredType,
            date: parsed.date,
            description: parsed.description,
            author: parsed.author,
            project: parsed.project,
            featured: parsed.featured,
            slug: parsed.slug || (inferredType === 'project' ? (parsed.title ? slugify(parsed.title) : '') : undefined),
            status: parsed.status,
            year: parsed.year,
            url: parsed.url,
            github: parsed.github,
            order: parsed.order,
            createdAt: file.lastModified || Date.now(),
            updatedAt: file.lastModified || Date.now(),
            fileName,
            localBackedUp: true,
            images: images.length > 0 ? images : undefined,
          });
        } catch (e) {
          console.warn(`Failed to parse file ${fileName}:`, e);
        }
      }
    };

    // 1. Read from dedicated category folders
    if (this.config.postsHandle) {
      await readFromFolder(this.config.postsHandle, 'post');
    }
    if (this.config.projectsHandle) {
      await readFromFolder(this.config.projectsHandle, 'project');
    }
    if (this.config.notesHandle) {
      await readFromFolder(this.config.notesHandle, 'note');
    }

    // 2. Read from root folder subdirectories
    if (this.config.rootHandle) {
      const ok = await this.verifyPermission(this.config.rootHandle, false);
      if (ok) {
        let rootOrContent = this.config.rootHandle;
        try {
          rootOrContent = await this.config.rootHandle.getDirectoryHandle('content', { create: false });
        } catch {}

        try {
          const postsSub = await rootOrContent.getDirectoryHandle('posts', { create: false });
          if (!this.config.postsHandle) await readFromFolder(postsSub, 'post');
        } catch {}

        try {
          const projectsSub = await rootOrContent.getDirectoryHandle('projects', { create: false });
          if (!this.config.projectsHandle) await readFromFolder(projectsSub, 'project');
        } catch {}

        try {
          const notesSub = await rootOrContent.getDirectoryHandle('notes', { create: false });
          if (!this.config.notesHandle) await readFromFolder(notesSub, 'note');
        } catch {}

        // Also check top-level markdown files in root
        await readFromFolder(rootOrContent);
      }
    }

    return loadedNotes;
  }
}

export const localFolderManager = new LocalFolderManager();
