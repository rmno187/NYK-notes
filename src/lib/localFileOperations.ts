import { Note } from '../types';
import { serializeNoteToMarkdown, parseMarkdownNote } from './markdown';

/**
 * Generates a clean markdown filename from date stamp and title.
 * Format: YYYY-MM-DD-title.md or YYYY-MM-DD.md if no title exists.
 */
export function generateNoteFilename(note: Partial<Note>, fallbackTimestamp?: number): string {
  let noteDate: Date;

  if (note.date) {
    const parsedDate = new Date(note.date);
    if (!isNaN(parsedDate.getTime())) {
      noteDate = parsedDate;
    } else if (note.createdAt) {
      noteDate = new Date(note.createdAt);
    } else {
      noteDate = new Date();
    }
  } else if (note.createdAt) {
    noteDate = new Date(note.createdAt);
  } else if (fallbackTimestamp) {
    noteDate = new Date(fallbackTimestamp);
  } else {
    noteDate = new Date();
  }

  const year = noteDate.getFullYear();
  const month = String(noteDate.getMonth() + 1).padStart(2, '0');
  const day = String(noteDate.getDate()).padStart(2, '0');
  const dateStamp = `${year}-${month}-${day}`;

  const cleanTitle = (note.title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')     // Remove characters that aren't letters, numbers, spaces, hyphens, underscores
    .replace(/[\s_]+/g, '-')       // Replace whitespace and underscores with hyphens
    .replace(/^-+|-+$/g, '');      // Trim hyphens from start and end

  if (cleanTitle) {
    return `${dateStamp}-${cleanTitle}.md`;
  }
  return `${dateStamp}.md`;
}

/**
 * Checks if File System Access API directory picker is available.
 */
export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Checks if File System Access API save file picker is available.
 */
export function isSaveFilePickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Checks if File System Access API open file picker is available.
 */
export function isOpenFilePickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export interface SaveResult {
  fileName: string;
  folderName?: string;
  directoryHandle?: FileSystemDirectoryHandle;
  method: 'folder' | 'picker' | 'download';
}

/**
 * Saves a note as a .md file directly into a chosen or existing local storage folder.
 * If dirHandle is provided, saves directly into it.
 * Otherwise, prompts the user to select the folder they want the file to live in.
 */
export async function saveNoteToLocalFolder(
  note: Note,
  existingDirHandle?: FileSystemDirectoryHandle | null
): Promise<SaveResult> {
  const fileName = generateNoteFilename(note);
  const markdownContent = serializeNoteToMarkdown(note);

  // If we already have a valid directory handle, use it
  if (existingDirHandle) {
    try {
      const options = { mode: 'readwrite' };
      if ((await (existingDirHandle as any).queryPermission(options)) !== 'granted') {
        const perm = await (existingDirHandle as any).requestPermission(options);
        if (perm !== 'granted') {
          throw new Error('Permission to write to directory was denied.');
        }
      }

      const fileHandle = await existingDirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(markdownContent);
      await writable.close();

      return {
        fileName,
        folderName: existingDirHandle.name,
        directoryHandle: existingDirHandle,
        method: 'folder',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Save was cancelled.');
      }
      console.warn('Could not write to existing directory handle, prompting user:', err);
    }
  }

  // If directory picker is supported, prompt user to select a folder on disk
  if (isDirectoryPickerSupported()) {
    try {
      const dirHandle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        id: 'markdown-notes-folder',
      });

      const options = { mode: 'readwrite' };
      if ((await (dirHandle as any).queryPermission?.(options)) !== 'granted') {
        await (dirHandle as any).requestPermission?.(options);
      }

      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(markdownContent);
      await writable.close();

      return {
        fileName,
        folderName: dirHandle.name,
        directoryHandle: dirHandle,
        method: 'folder',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Folder selection was cancelled.');
      }
      // If directory picker fails, fallback to save file picker or download
      console.warn('showDirectoryPicker failed, falling back to showSaveFilePicker:', err);
    }
  }

  // If Save File Picker is supported (lets user choose destination folder in native save dialog)
  if (isSaveFilePickerSupported()) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'Markdown File',
            accept: {
              'text/markdown': ['.md', '.markdown'],
              'text/plain': ['.txt'],
            },
          },
        ],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(markdownContent);
      await writable.close();

      return {
        fileName: fileHandle.name || fileName,
        method: 'picker',
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Save was cancelled.');
      }
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }

  // Fallback: Trigger browser download of .md file
  downloadMarkdownFile(fileName, markdownContent);
  return {
    fileName,
    method: 'download',
  };
}

/**
 * Triggers a native browser file download of markdown content
 */
export function downloadMarkdownFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens a .md file from local storage using File System Access API or file picker input fallback.
 * Parses frontmatter metadata, title, content, date, tags, and returns a fully formed Note.
 */
export async function openLocalMarkdownFile(): Promise<{ note: Note; fileName: string } | null> {
  // Option 1: Modern File System Access API
  if (isOpenFilePickerSupported()) {
    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown', '.mdown', '.mkdn'],
              'text/plain': ['.txt', '.md'],
            },
          },
        ],
        multiple: false,
      });

      if (!fileHandle) return null;

      const file: File = await fileHandle.getFile();
      const rawText = await file.text();
      const parsed = parseMarkdownNote(rawText, file.name);

      const openedNote: Note = {
        id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title: parsed.title,
        content: parsed.content,
        tags: parsed.tags || [],
        pinned: Boolean(parsed.pinned),
        type: parsed.type || 'note',
        date: parsed.date,
        description: parsed.description,
        author: parsed.author,
        featured: parsed.featured,
        createdAt: file.lastModified || Date.now(),
        updatedAt: file.lastModified || Date.now(),
        fileName: file.name,
      };

      return { note: openedNote, fileName: file.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null;
      }
      console.warn('showOpenFilePicker failed, falling back to input[type=file]:', err);
    }
  }

  // Option 2: Fallback using hidden file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mkdn,.txt,text/markdown,text/plain';

    input.onchange = async () => {
      if (!input.files || input.files.length === 0) {
        resolve(null);
        return;
      }

      const file = input.files[0];
      try {
        const rawText = await file.text();
        const parsed = parseMarkdownNote(rawText, file.name);

        const openedNote: Note = {
          id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          title: parsed.title,
          content: parsed.content,
          tags: parsed.tags || [],
          pinned: Boolean(parsed.pinned),
          type: parsed.type || 'note',
          date: parsed.date,
          description: parsed.description,
          author: parsed.author,
          featured: parsed.featured,
          createdAt: file.lastModified || Date.now(),
          updatedAt: file.lastModified || Date.now(),
          fileName: file.name,
        };

        resolve({ note: openedNote, fileName: file.name });
      } catch (e) {
        console.error('Failed to read selected local file:', e);
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);

    // Trigger file selection dialog
    input.click();
  });
}
