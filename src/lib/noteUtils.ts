import { Note } from '../types';

/**
 * Robust check to determine if a note has any meaningful content or title.
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
