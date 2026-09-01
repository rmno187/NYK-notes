import { Note, NoteImage, ImageFolderStrategy } from '../types';
import { slugify, getNoteBaseName } from './noteUtils';

/**
 * Cleans an image filename into a web-safe lowercase filename.
 * e.g. "My Screenshot 2026-09-01.PNG" -> "my-screenshot-2026-09-01.png"
 */
export function cleanImageFilename(originalName: string): string {
  if (!originalName) return `image-${Date.now()}.png`;

  const lastDotIndex = originalName.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? originalName.slice(lastDotIndex).toLowerCase() : '.png';
  const rawBase = lastDotIndex !== -1 ? originalName.slice(0, lastDotIndex) : originalName;

  const cleanBase = slugify(rawBase) || `image-${Date.now().toString(36)}`;
  return `${cleanBase}${ext}`;
}

/**
 * Computes the relative path for an image in a note or post.
 * Defaults to the matching post subfolder (e.g. `./2026-02-01-post/image.png`)
 * matching the markdown file:
 *   2026-02-01-post.md
 *   2026-02-01-post/
 *     image.png
 */
export function computeRelativeImagePath(
  filename: string,
  note: Partial<Note>,
  strategy?: ImageFolderStrategy
): string {
  const cleanName = cleanImageFilename(filename);

  if (strategy === 'same-folder') {
    return `./${cleanName}`;
  }

  if (strategy === 'images-folder') {
    return `./images/${cleanName}`;
  }

  // Default: Matching post subfolder named after the post/note base name (e.g. 2026-02-01-post)
  const folderName = getNoteBaseName(note);
  if (folderName) {
    return `./${folderName}/${cleanName}`;
  }

  return `./${cleanName}`;
}

/**
 * Converts a Base64 data URL to a binary Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    if (arr.length < 2) {
      return new Blob([dataUrl], { type: 'text/plain' });
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    console.error('Failed to convert dataUrl to Blob:', err);
    return new Blob([], { type: 'application/octet-stream' });
  }
}

/**
 * Formats byte size into human readable string (e.g. "142 KB", "1.2 MB")
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const num = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${num} ${sizes[i]}`;
}

/**
 * Reads a browser File object as a Base64 Data URL string
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64 string'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
