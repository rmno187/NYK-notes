import JSZip from 'jszip';
import { Note, NoteImage } from '../types';
import { parseMarkdownNote } from './markdown';
import { readFileAsDataUrl } from './imageUtils';
import { getNoteBaseName } from './noteUtils';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']);

function isImageFilename(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    default:
      return 'image/png';
  }
}

/**
 * Parses a ZIP file containing Markdown posts and associated asset folders.
 * e.g.
 *   2026.02.01-my-amazing-project.md
 *   2026.02.01-my-amazing-project/
 *     image-1.jpg
 */
export async function parseZipArchiveToNotes(zipFile: File | Blob): Promise<Note[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);
  const notes: Note[] = [];

  // Group files by path
  const mdEntries: { path: string; file: JSZip.JSZipObject }[] = [];
  const imageEntries: { path: string; file: JSZip.JSZipObject }[] = [];

  loadedZip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    const lower = relativePath.toLowerCase();
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) {
      mdEntries.push({ path: relativePath, file: zipEntry });
    } else if (isImageFilename(relativePath)) {
      imageEntries.push({ path: relativePath, file: zipEntry });
    }
  });

  for (const { path: mdPath, file: mdZipObject } of mdEntries) {
    const rawContent = await mdZipObject.async('text');
    const fileName = mdPath.split('/').pop() || 'note.md';
    const parsed = parseMarkdownNote(rawContent, fileName);

    const postBaseName = getNoteBaseName({
      fileName,
      title: parsed.title,
      date: parsed.date,
    });

    const attachedImages: NoteImage[] = [];

    // Find all images belonging to this post's asset folder
    for (const { path: imgPath, file: imgZipObject } of imageEntries) {
      const imgFileName = imgPath.split('/').pop() || 'image.png';
      const cleanImgPath = imgPath.replace(/^\.\//, '');

      // Check if image is inside the folder named after the post's filename base name
      const isInMatchingFolder =
        cleanImgPath.includes(`/${postBaseName}/`) ||
        cleanImgPath.startsWith(`${postBaseName}/`) ||
        cleanImgPath === `${postBaseName}/${imgFileName}`;

      // Or check if the markdown content directly references this relative path
      const isReferencedInContent =
        rawContent.includes(cleanImgPath) ||
        rawContent.includes(`./${cleanImgPath}`) ||
        rawContent.includes(imgFileName);

      if (isInMatchingFolder || isReferencedInContent) {
        try {
          const mimeType = getMimeType(imgFileName);
          const base64Data = await imgZipObject.async('base64');
          const dataUrl = `data:${mimeType};base64,${base64Data}`;

          attachedImages.push({
            id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: imgFileName,
            dataUrl,
            relativePath: `./${postBaseName}/${imgFileName}`,
            alt: imgFileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
            mimeType,
            createdAt: Date.now(),
          });
        } catch (e) {
          console.warn('Failed to read image from zip:', imgPath, e);
        }
      }
    }

    notes.push({
      id: `imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: parsed.title,
      content: parsed.content,
      tags: parsed.tags,
      pinned: parsed.pinned,
      type: parsed.type,
      date: parsed.date,
      description: parsed.description,
      author: parsed.author,
      project: parsed.project,
      featured: parsed.featured,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fileName: fileName,
      images: attachedImages.length > 0 ? attachedImages : undefined,
    });
  }

  return notes;
}

/**
 * Imports markdown notes and attaches images from a collection of File objects.
 * Accurately pairs each markdown post (e.g. 2026.02.01-my-amazing-project.md)
 * with images in its associated folder (e.g. 2026.02.01-my-amazing-project/image-1.jpg).
 */
export async function importNotesFromFiles(files: FileList | File[]): Promise<Note[]> {
  const fileArray = Array.from(files);
  const notes: Note[] = [];

  // Check if any zip files are present
  const zipFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith('.zip'));
  if (zipFiles.length > 0) {
    for (const zf of zipFiles) {
      const extracted = await parseZipArchiveToNotes(zf);
      notes.push(...extracted);
    }
  }

  const mdFiles: File[] = [];
  const imageFiles: File[] = [];

  for (const f of fileArray) {
    const name = f.name.toLowerCase();
    if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
      mdFiles.push(f);
    } else if (isImageFilename(f.name)) {
      imageFiles.push(f);
    }
  }

  for (const mdFile of mdFiles) {
    const text = await mdFile.text();
    const fileName = mdFile.name;
    const parsed = parseMarkdownNote(text, fileName);

    // Source of truth: derive the asset directory from the post's filename
    const postBaseName = getNoteBaseName({
      fileName,
      title: parsed.title,
      date: parsed.date,
      createdAt: mdFile.lastModified,
    });

    const attachedImages: NoteImage[] = [];

    // Find any images matching this post's asset folder
    for (const imgFile of imageFiles) {
      const webkitPath = (imgFile as any).webkitRelativePath || imgFile.name;
      const cleanPath = webkitPath.replace(/^\.\//, '');

      const isMatchingAssetFolder =
        cleanPath.includes(`/${postBaseName}/`) ||
        cleanPath.startsWith(`${postBaseName}/`) ||
        cleanPath === `${postBaseName}/${imgFile.name}`;

      const isReferencedInContent =
        text.includes(cleanPath) ||
        text.includes(`./${cleanPath}`) ||
        text.includes(imgFile.name);

      if (isMatchingAssetFolder || isReferencedInContent) {
        try {
          const dataUrl = await readFileAsDataUrl(imgFile);
          attachedImages.push({
            id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: imgFile.name,
            dataUrl,
            relativePath: `./${postBaseName}/${imgFile.name}`,
            alt: imgFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
            size: imgFile.size,
            mimeType: imgFile.type,
            createdAt: imgFile.lastModified || Date.now(),
          });
        } catch (imgErr) {
          console.warn(`Failed to read image ${imgFile.name}:`, imgErr);
        }
      }
    }

    notes.push({
      id: `imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title: parsed.title,
      content: parsed.content,
      tags: parsed.tags,
      pinned: parsed.pinned,
      type: parsed.type,
      date: parsed.date,
      description: parsed.description,
      author: parsed.author,
      project: parsed.project,
      featured: parsed.featured,
      createdAt: mdFile.lastModified || Date.now(),
      updatedAt: mdFile.lastModified || Date.now(),
      fileName: fileName,
      images: attachedImages.length > 0 ? attachedImages : undefined,
    });
  }

  return notes;
}
