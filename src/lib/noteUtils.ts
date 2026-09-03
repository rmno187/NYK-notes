import { Note } from '../types';

/**
 * Convert title or string to a clean URL-safe slug
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except hyphens and spaces
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Trim start and end hyphens
}

/**
 * Computes the canonical base name (without .md extension) for a note or post.
 * Format: Post's fileName (without .md) as the source of truth, or YYYY-MM-DD-title if not set.
 * e.g. "2026.02.01-my-amazing-project" or "2026-02-01-my-post"
 */
export function getNoteBaseName(note: Partial<Note>, fallbackTimestamp?: number): string {
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

  const cleanTitle = slugify(note.slug || note.title || '');
  if (cleanTitle) {
    if (note.type === 'project' && note.slug) {
      return note.slug;
    }
    return `${dateStamp}-${cleanTitle}`;
  }

  if (note.fileName) {
    const cleanFileName = note.fileName.split('/').pop()?.split('\\').pop() || note.fileName;
    const withoutExt = cleanFileName.replace(/\.(md|markdown|txt)$/i, '');
    if (withoutExt) return withoutExt;
  }

  return dateStamp;
}

/**
 * Renames a note's filename and synchronizes all attached images' relative paths
 * and any image references inside the note content.
 */
export function syncNoteImagePathsOnRename(note: Note, newFileName: string): Note {
  const cleanNewFileName = newFileName.trim().endsWith('.md')
    ? newFileName.trim()
    : `${newFileName.trim().replace(/\.(markdown|txt)$/i, '')}.md`;

  const oldBaseName = getNoteBaseName(note);
  const newBaseName = getNoteBaseName({ ...note, fileName: cleanNewFileName });

  let updatedContent = note.content;
  let updatedImages = note.images ? [...note.images] : [];

  if (oldBaseName && newBaseName && oldBaseName !== newBaseName) {
    // 1. Update attached images relative paths
    updatedImages = updatedImages.map((img) => {
      const oldPath = img.relativePath || `./${img.name}`;
      const imgFileName = img.name || oldPath.split('/').pop() || 'image.png';

      let newRelativePath = `./${newBaseName}/${imgFileName}`;
      if (oldPath.includes(oldBaseName)) {
        newRelativePath = oldPath.replace(oldBaseName, newBaseName);
      }
      return {
        ...img,
        relativePath: newRelativePath,
      };
    });

    // 2. Replace references in markdown content
    const escapedOld = oldBaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexWithDot = new RegExp(`(\\./)?${escapedOld}/`, 'g');
    updatedContent = updatedContent.replace(regexWithDot, `./${newBaseName}/`);
  }

  return {
    ...note,
    fileName: cleanNewFileName,
    images: updatedImages,
    content: updatedContent,
    updatedAt: Date.now(),
  };
}

/**
 * Returns true if the note is completely blank/empty.
 */
export function isNoteEmpty(note: Partial<Note> | null | undefined): boolean {
  if (!note) return true;

  const cleanTitle = (note.title || '').trim();
  const cleanDescription = (note.description || '').trim();

  // Strip HTML tags, whitespace, zero-width chars, and non-breaking spaces
  const cleanContent = (note.content || '')
    .replace(/&nbsp;/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<div\s*><\/div>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t\s\u200B-\u200D\uFEFF]/g, '')
    .trim();

  return cleanTitle === '' && cleanContent === '' && cleanDescription === '';
}

/**
 * Intelligently merges an existing notes list with incoming notes (e.g. from Vercel sync or local disk).
 * Handles matching by id, fileName, slug, or type+title, resolving conflicts by updatedAt timestamp,
 * and preserving local folder/backup status and image metadata.
 */
export function mergeNotes(existingNotes: Note[], incomingNotes: Note[]): Note[] {
  const result: Note[] = [...existingNotes];

  for (const incoming of incomingNotes) {
    if (isNoteEmpty(incoming) && !incoming.deletedAt) {
      continue;
    }

    // Find if there is a matching existing note
    const matchIndex = result.findIndex((existing) => {
      // 1. Exact ID match
      if (existing.id && incoming.id && existing.id === incoming.id) return true;

      // 2. Exact fileName match
      if (
        existing.fileName &&
        incoming.fileName &&
        existing.fileName.toLowerCase() === incoming.fileName.toLowerCase()
      ) {
        return true;
      }

      // 3. Project type match by slug
      if (
        existing.type === 'project' &&
        incoming.type === 'project' &&
        existing.slug &&
        incoming.slug &&
        slugify(existing.slug) === slugify(incoming.slug)
      ) {
        return true;
      }

      // 4. Same type, non-empty title, and same date (or neither has date)
      const exTitle = (existing.title || '').trim().toLowerCase();
      const inTitle = (incoming.title || '').trim().toLowerCase();
      if (
        exTitle &&
        inTitle &&
        exTitle === inTitle &&
        (existing.type || 'note') === (incoming.type || 'note')
      ) {
        if (!existing.date && !incoming.date) return true;
        if (existing.date && incoming.date && existing.date === incoming.date) return true;
      }

      return false;
    });

    if (matchIndex >= 0) {
      const existing = result[matchIndex];

      // Handle deletion status
      if (incoming.deletedAt && (!existing.deletedAt || incoming.deletedAt >= (existing.updatedAt || 0))) {
        result[matchIndex] = {
          ...existing,
          deletedAt: incoming.deletedAt,
          updatedAt: Math.max(existing.updatedAt || 0, incoming.updatedAt || 0),
        };
        continue;
      }

      if (existing.deletedAt && (!incoming.deletedAt || existing.deletedAt >= (incoming.updatedAt || 0))) {
        // Keep existing as deleted
        continue;
      }

      // Compare update timestamps
      const incomingIsNewer = (incoming.updatedAt || 0) > (existing.updatedAt || 0);
      const base = incomingIsNewer ? incoming : existing;
      const other = incomingIsNewer ? existing : incoming;

      // Prefer canonical permanent ID if existing had a canonical non-local ID
      const preferredId =
        existing.id && !existing.id.startsWith('local-')
          ? existing.id
          : incoming.id || existing.id;

      // Combine metadata gracefully
      result[matchIndex] = {
        ...base,
        id: preferredId,
        fileName: base.fileName || other.fileName,
        localFolderName: base.localFolderName || other.localFolderName,
        localBackedUp: Boolean(base.localBackedUp || other.localBackedUp),
        images: base.images && base.images.length > 0 ? base.images : other.images,
        tags: Array.from(new Set([...(base.tags || []), ...(other.tags || [])])),
        pinned: base.pinned ?? other.pinned,
        featured: base.featured ?? other.featured,
        type: base.type || other.type || 'note',
        date: base.date || other.date,
        author: base.author || other.author,
        project: base.project || other.project,
        slug: base.slug || other.slug,
        description: base.description || other.description,
        status: base.status || other.status,
        year: base.year || other.year,
        url: base.url || other.url,
        github: base.github || other.github,
        order: base.order ?? other.order,
        createdAt: Math.min(existing.createdAt || Date.now(), incoming.createdAt || Date.now()),
        updatedAt: Math.max(existing.updatedAt || 0, incoming.updatedAt || 0),
      };
    } else {
      // New incoming note
      result.push(incoming);
    }
  }

  return result;
}
