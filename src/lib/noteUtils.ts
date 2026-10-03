import { Note } from '../types';

/**
 * Normalizes a single tag string:
 * Trims whitespace, removes leading '#' if present, and converts to lowercase.
 */
export function normalizeTag(tag: string | null | undefined): string {
  if (!tag || typeof tag !== 'string') return '';
  return tag.trim().replace(/^#/, '').toLowerCase();
}

/**
 * Normalizes an array of tags:
 * Trims whitespace, removes leading '#', converts to lowercase,
 * filters empty values, and deduplicates (e.g. 'Test', 'test', 'tEst' -> ['test']).
 */
export function normalizeTags(tags?: (string | null | undefined)[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tags) {
    if (!t) continue;
    const clean = normalizeTag(t);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

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
  if (cleanTitle !== '') return false;

  const cleanDescription = (note.description || '').trim();
  if (cleanDescription !== '') return false;

  if (note.images && note.images.length > 0) return false;

  const rawContent = note.content || '';
  if (!rawContent) return true;

  // Fast check: if length is substantial (>150 chars), it is guaranteed not to be just empty whitespace or empty tags
  if (rawContent.length > 150) return false;

  // For short strings, check if only empty HTML tags or whitespace
  const cleanContent = rawContent
    .replace(/&nbsp;/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<div\s*><\/div>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t\s\u200B-\u200D\uFEFF]/g, '')
    .trim();

  return cleanContent === '';
}

/**
 * Returns true if two note objects represent the same underlying note/post.
 * Handles matching by id, local- prefix, fileName, slug, or matching title.
 */
export function areNotesDuplicate(a: Note, b: Note): boolean {
  if (!a || !b) return false;

  // 1. Exact ID match
  if (a.id && b.id && a.id === b.id) return true;

  // 2. Local ID prefix match (e.g. "local-my-post" vs "my-post")
  const aCleanId = (a.id || '').replace(/^local-/, '');
  const bCleanId = (b.id || '').replace(/^local-/, '');
  if (aCleanId && bCleanId && aCleanId === bCleanId) return true;

  // 3. Exact fileName match
  if (
    a.fileName &&
    b.fileName &&
    a.fileName.trim().toLowerCase() === b.fileName.trim().toLowerCase()
  ) {
    return true;
  }

  // 4. FileName matches other note's slug or title
  if (a.fileName && (b.slug || b.title)) {
    const aBase = slugify(a.fileName.replace(/\.(md|markdown|txt)$/i, ''));
    const bTarget = slugify(b.slug || b.title);
    if (aBase && bTarget && aBase === bTarget) return true;
  }
  if (b.fileName && (a.slug || a.title)) {
    const bBase = slugify(b.fileName.replace(/\.(md|markdown|txt)$/i, ''));
    const aTarget = slugify(a.slug || a.title);
    if (bBase && aTarget && bBase === aTarget) return true;
  }

  // 5. Slug match for posts and projects
  if (
    a.slug &&
    b.slug &&
    slugify(a.slug) === slugify(b.slug) &&
    (a.type || 'note') === (b.type || 'note')
  ) {
    return true;
  }

  // 6. Same type and non-empty title match
  const aTitle = (a.title || '').trim().toLowerCase();
  const bTitle = (b.title || '').trim().toLowerCase();
  const aType = a.type || 'note';
  const bType = b.type || 'note';

  if (aTitle && bTitle && aTitle === bTitle && aTitle !== 'untitled') {
    // For blog posts or projects: titles are unique post/project identifiers
    if (aType === 'post' || bType === 'post' || aType === 'project' || bType === 'project') {
      return true;
    }
    // For regular notes: check if same title and matching or missing dates
    if (a.date && b.date) {
      if (a.date === b.date) return true;
      const parsedA = Date.parse(a.date);
      const parsedB = Date.parse(b.date);
      if (!isNaN(parsedA) && !isNaN(parsedB) && parsedA === parsedB) return true;
    } else {
      return true;
    }
  }

  return false;
}

/**
 * Merges two duplicate note representations together, keeping the latest updates and all metadata.
 */
export function mergeTwoNotes(existing: Note, incoming: Note): Note {
  // Handle deletion status
  if (incoming.deletedAt && (!existing.deletedAt || incoming.deletedAt >= (existing.updatedAt || 0))) {
    return {
      ...existing,
      deletedAt: incoming.deletedAt,
      updatedAt: Math.max(existing.updatedAt || 0, incoming.updatedAt || 0),
    };
  }

  if (existing.deletedAt && (!incoming.deletedAt || existing.deletedAt >= (incoming.updatedAt || 0))) {
    return existing;
  }

  const incomingIsNewer = (incoming.updatedAt || 0) > (existing.updatedAt || 0);
  const base = incomingIsNewer ? incoming : existing;
  const other = incomingIsNewer ? existing : incoming;

  // Prefer canonical permanent ID if existing had a canonical non-local ID
  const preferredId =
    existing.id && !existing.id.startsWith('local-')
      ? existing.id
      : incoming.id && !incoming.id.startsWith('local-')
      ? incoming.id
      : existing.id || incoming.id;

  // Deduplicate attached images
  const allImages = [...(base.images || []), ...(other.images || [])];
  const uniqueImages: typeof allImages = [];
  const seenImageKeys = new Set<string>();
  for (const img of allImages) {
    const key = img.name || img.relativePath || img.id;
    if (!seenImageKeys.has(key)) {
      seenImageKeys.add(key);
      uniqueImages.push(img);
    }
  }

  return {
    ...base,
    id: preferredId,
    title: base.title || other.title,
    content: base.content || other.content,
    fileName: base.fileName || other.fileName,
    localFolderName: base.localFolderName || other.localFolderName,
    localBackedUp: Boolean(base.localBackedUp || other.localBackedUp),
    images: uniqueImages.length > 0 ? uniqueImages : undefined,
    tags: normalizeTags([...(base.tags || []), ...(other.tags || [])]),
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
}

/**
 * Deduplicates an array of notes, removing identical entries and merging their metadata.
 */
export function deduplicateNotes(notes: Note[]): Note[] {
  const result: Note[] = [];

  for (const note of notes) {
    if (isNoteEmpty(note) && !note.deletedAt) {
      continue;
    }

    const matchIndex = result.findIndex((existing) => areNotesDuplicate(existing, note));
    if (matchIndex >= 0) {
      result[matchIndex] = mergeTwoNotes(result[matchIndex], note);
    } else {
      result.push({
        ...note,
        tags: normalizeTags(note.tags),
      });
    }
  }

  return result;
}

/**
 * Helper to get the canonical creation timestamp of a blog post or note for sorting.
 * Guaranteed to return most recent created post first.
 */
export function getBlogCreatedTime(note: Note): number {
  let dateTs = 0;
  if (note.date) {
    const parsed = Date.parse(note.date);
    if (!isNaN(parsed) && parsed > 0) {
      dateTs = parsed;
    }
  }

  const createdTs = note.createdAt || 0;

  if (dateTs > 0 && createdTs > 0) {
    const dateDay = new Date(dateTs).toISOString().slice(0, 10);
    const createdDay = new Date(createdTs).toISOString().slice(0, 10);
    if (dateDay === createdDay) {
      return createdTs;
    }
    // Explicit user-chosen date on a different day: preserve that day plus intraday creation time
    const intraday = createdTs % 86400000;
    return dateTs + intraday;
  }

  return dateTs || createdTs || note.updatedAt || 0;
}

/**
 * Intelligently merges an existing notes list with incoming notes (e.g. from Vercel sync or local disk).
 * Handles matching by id, fileName, slug, or type+title, resolving conflicts by updatedAt timestamp,
 * and preserving local folder/backup status and image metadata.
 */
export function mergeNotes(existingNotes: Note[], incomingNotes: Note[]): Note[] {
  const deduplicatedExisting = deduplicateNotes(existingNotes);
  const result: Note[] = [...deduplicatedExisting];

  for (const incoming of incomingNotes) {
    if (isNoteEmpty(incoming) && !incoming.deletedAt) {
      continue;
    }

    const matchIndex = result.findIndex((existing) => areNotesDuplicate(existing, incoming));
    if (matchIndex >= 0) {
      result[matchIndex] = mergeTwoNotes(result[matchIndex], incoming);
    } else {
      result.push({
        ...incoming,
        tags: normalizeTags(incoming.tags),
      });
    }
  }

  return deduplicateNotes(result);
}

