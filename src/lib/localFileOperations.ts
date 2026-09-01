import JSZip from 'jszip';
import { Note, NoteImage } from '../types';
import { serializeNoteToMarkdown, parseMarkdownNote } from './markdown';
import { dataUrlToBlob } from './imageUtils';
import { getNoteBaseName } from './noteUtils';

/**
 * Generates a clean markdown filename from date stamp and title.
 * Format: YYYY-MM-DD-title.md or YYYY-MM-DD.md if no title exists.
 */
export function generateNoteFilename(note: Partial<Note>, fallbackTimestamp?: number): string {
  return `${getNoteBaseName(note, fallbackTimestamp)}.md`;
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
  method: 'folder' | 'picker' | 'download' | 'zip';
  savedImagesCount?: number;
  savedImagePaths?: string[];
}

/**
 * Writes attached images into the directory handle, creating subfolders as needed based on relative paths.
 */
export async function saveImagesToDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  images: NoteImage[]
): Promise<string[]> {
  const savedPaths: string[] = [];

  for (const image of images) {
    if (!image.dataUrl) continue;

    try {
      const blob = dataUrlToBlob(image.dataUrl);
      const cleanPath = (image.relativePath || image.name).replace(/^\.\//, '').replace(/^\//, '');
      const segments = cleanPath.split('/');
      const filename = segments.pop() || image.name;

      // Navigate or create intermediate directories
      let currentDir = dirHandle;
      for (const dirName of segments) {
        if (dirName && dirName !== '.') {
          currentDir = await currentDir.getDirectoryHandle(dirName, { create: true });
        }
      }

      // Write image file
      const fileHandle = await currentDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      savedPaths.push(image.relativePath || `./${cleanPath}`);
    } catch (imgErr) {
      console.warn(`Failed to save image ${image.name} to directory:`, imgErr);
    }
  }

  return savedPaths;
}

/**
 * Saves a note as a .md file directly into a chosen or existing local storage folder,
 * along with any attached image assets.
 */
export async function saveNoteToLocalFolder(
  note: Note,
  existingDirHandle?: FileSystemDirectoryHandle | null
): Promise<SaveResult> {
  const fileName = generateNoteFilename(note);
  const markdownContent = serializeNoteToMarkdown(note);
  const images = note.images || [];

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

      // 1. Write Markdown file
      const fileHandle = await existingDirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(markdownContent);
      await writable.close();

      // 2. Write all attached images if any exist
      let savedImagePaths: string[] = [];
      if (images.length > 0) {
        savedImagePaths = await saveImagesToDirectoryHandle(existingDirHandle, images);
      }

      return {
        fileName,
        folderName: existingDirHandle.name,
        directoryHandle: existingDirHandle,
        method: 'folder',
        savedImagesCount: savedImagePaths.length,
        savedImagePaths,
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

      // 1. Write Markdown file
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(markdownContent);
      await writable.close();

      // 2. Write all attached images
      let savedImagePaths: string[] = [];
      if (images.length > 0) {
        savedImagePaths = await saveImagesToDirectoryHandle(dirHandle, images);
      }

      return {
        fileName,
        folderName: dirHandle.name,
        directoryHandle: dirHandle,
        method: 'folder',
        savedImagesCount: savedImagePaths.length,
        savedImagePaths,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Folder selection was cancelled.');
      }
      // If directory picker fails, fallback to save file picker or zip download
      console.warn('showDirectoryPicker failed, falling back:', err);
    }
  }

  // If note has images, package as a zip with folder structure preserved
  if (images.length > 0) {
    await downloadNoteWithImagesZip(note, fileName, markdownContent);
    return {
      fileName,
      method: 'zip',
      savedImagesCount: images.length,
      savedImagePaths: images.map((i) => i.relativePath || i.name),
    };
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
 * Packages a note and all its attached images into a .zip archive and triggers a browser download.
 */
export async function downloadNoteWithImagesZip(
  note: Note,
  fileNameArg?: string,
  markdownContentArg?: string
): Promise<void> {
  const zip = new JSZip();
  const fileName = fileNameArg || generateNoteFilename(note);
  const markdownContent = markdownContentArg || serializeNoteToMarkdown(note);

  // Add the markdown file
  zip.file(fileName, markdownContent);

  // Add image files
  const images = note.images || [];
  for (const img of images) {
    if (!img.dataUrl) continue;
    const blob = dataUrlToBlob(img.dataUrl);
    const cleanPath = (img.relativePath || img.name).replace(/^\.\//, '').replace(/^\//, '');
    zip.file(cleanPath, blob);
  }

  const baseZipName = fileName.replace(/\.md$/, '') + '.zip';
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = baseZipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        project: parsed.project,
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
          project: parsed.project,
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
