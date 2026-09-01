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
 * Format: YYYY-MM-DD-title or preserves existing note.fileName base name if opened from disk.
 * e.g. "2026-02-01-my-post"
 */
export function getNoteBaseName(note: Partial<Note>, fallbackTimestamp?: number): string {
  if (note.fileName) {
    const withoutExt = note.fileName.replace(/\.(md|markdown|txt)$/i, '');
    if (withoutExt) return withoutExt;
  }

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

  const rawTitle = (note.slug || note.title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (rawTitle) {
    return `${dateStamp}-${rawTitle}`;
  }
  return dateStamp;
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
