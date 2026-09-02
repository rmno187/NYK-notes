import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, StorageMode, Theme, EditorMode, NoteType, NoteImage, ImageFolderStrategy } from './types';
import {
  getIndexedDBNotes,
  saveIndexedDBNote,
  deleteIndexedDBNote,
  selectLocalDirectory,
  loadNotesFromDirectory,
  saveNoteToDirectory,
  deleteNoteFromDirectory,
} from './lib/storage';
import { syncManager } from './lib/vercelSync/syncManager';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { convertHtmlToMarkdown, parseMarkdownNote, formatBlogDate } from './lib/markdown';
import { saveNoteToLocalFolder, openLocalMarkdownFile } from './lib/localFileOperations';
import { isMac, modSymbol } from './lib/platform';
import { isNoteEmpty, slugify, syncNoteImagePathsOnRename } from './lib/noteUtils';
import { importNotesFromFiles } from './lib/importUtils';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { DirectorySelectorModal } from './components/DirectorySelectorModal';
import { SyncModal } from './components/SyncModal';
import { BackupModal } from './components/BackupModal';
import { ImportModal } from './components/ImportModal';
import { ShortcutsModal } from './components/ShortcutsModal';

const DEFAULT_WELCOME_NOTES: Note[] = [
  {
    id: 'welcome-note-1',
    title: 'Welcome to Offline Markdown Notes',
    content: `# Welcome to Offline Markdown Notes 🚀

A privacy-first, 100% offline markdown editor built for speed, security, and simplicity.

## Key Features ✨

- **Zero Connectivity**: No cloud servers, no telemetry, no tracking. Everything runs directly in your browser.
- **Local Directory Sync**: Save your notes as real \`.md\` files directly into a folder on your computer.
- **Encrypted Backup**: Export your entire notebook encrypted with **AES-256-GCM** and PBKDF2 password derivation.
- **Tag Organization**: Categorize notes easily using frontmatter or inline hashtags like #ideas, #projects, or #todo.
- **WYSIWYG & Markdown**: Seamlessly edit in visual WYSIWYG mode or toggle to raw Markdown view.
- **Keyboard Navigation**: Press \`Cmd + K\` or \`Ctrl + K\` anytime to launch the Command Palette!

---

## Quick Keyboard Shortcuts ⌨️

- \`Cmd + K\` : Open Command Palette
- \`Cmd + N\` : Create a new note
- \`Cmd + P\` : Toggle between WYSIWYG and Raw Markdown
- \`Cmd + Shift + D\` : Toggle Dark / Light mode
- \`Cmd + Shift + B\` : Encrypted Backup Modal
- \`?\` : Keyboard Shortcuts Cheat Sheet

Happy writing!
`,
    tags: ['welcome', 'guide'],
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    pinned: true,
  },
  {
    id: 'welcome-note-2',
    title: 'Markdown Cheat Sheet & Examples',
    content: `# Markdown Syntax Guide

## Typography
You can write **bold text**, *italic text*, ~~strikethrough~~, or \`inline code\`.

## Lists
### Task List
- [x] Create a new note
- [ ] Add tags with #hashtag
- [ ] Export encrypted backup file

### Unordered & Ordered
* Item Alpha
* Item Beta
1. First step
2. Second step

## Blockquote
> "Privacy is not something that I'm merely entitled to, it's an absolute prerequisite."

## Code Block
\`\`\`typescript
function calculateWordCount(text: string): number {
  return text.trim().split(/\\s+/).filter(Boolean).length;
}
\`\`\`
`,
    tags: ['markdown', 'cheatsheet'],
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 1800000,
    pinned: false,
  },
  {
    id: 'welcome-project-1',
    title: 'Thermhold',
    slug: 'thermhold',
    description: 'A portfolio tracker built around long-term market cycles.',
    status: 'Active',
    year: 2026,
    url: 'https://example.com/thermhold',
    github: 'https://github.com/rmno18/thermhold',
    type: 'project',
    order: 1,
    content: `# Thermhold

A portfolio tracker built around long-term market cycles.

- Market cycle valuation indicators
- Live wallet balance tracking
`,
    tags: ['portfolio', 'crypto'],
    createdAt: Date.now() - 10800000,
    updatedAt: Date.now() - 5400000,
    pinned: false,
  },
];

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>('indexeddb');
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [directoryName, setDirectoryName] = useState<string>('');

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const [editorMode, setEditorMode] = useState<EditorMode>('wysiwyg');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  // Modals
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Apply Theme Class & Save
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Initial Data Load & Sync Manager init
  useEffect(() => {
    const initApp = async () => {
      // 1. Check if Vercel Sync was previously active/configured
      const savedStorageMode = localStorage.getItem('active_storage_mode') as StorageMode | null;
      const isSyncReady = await syncManager.initialize();

      if (savedStorageMode === 'vercel' && isSyncReady) {
        setStorageMode('vercel');
        const vercelNotes = await syncManager.loadNotes();
        if (vercelNotes && vercelNotes.length > 0) {
          setNotes(vercelNotes);
          const activeList = vercelNotes.filter((n) => !n.deletedAt);
          setActiveNoteId(activeList.length > 0 ? activeList[0].id : vercelNotes[0].id);
          return;
        }
      }

      // 2. Otherwise load default IndexedDB
      try {
        const storedNotes = await getIndexedDBNotes();
        if (storedNotes && storedNotes.length > 0) {
          // Auto-cleanup items soft-deleted over 30 days ago
          const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
          const now = Date.now();
          const validNotes: Note[] = [];

          for (const note of storedNotes) {
            if (note.deletedAt && now - note.deletedAt > THIRTY_DAYS_MS) {
              await deleteIndexedDBNote(note.id);
            } else if (isNoteEmpty(note) && !note.deletedAt) {
              await deleteIndexedDBNote(note.id);
            } else {
              const cleanNote =
                note.content.trim().startsWith('<p>') && note.content.includes('</p>')
                  ? { ...note, content: convertHtmlToMarkdown(note.content) }
                  : note;
              validNotes.push(cleanNote);
            }
          }

          setNotes(validNotes);
          const activeList = validNotes.filter((n) => !n.deletedAt);
          if (activeList.length > 0) {
            setActiveNoteId(activeList[0].id);
          } else if (validNotes.length > 0) {
            setActiveNoteId(validNotes[0].id);
          }
        } else {
          // Initialize default onboarding notes
          for (const note of DEFAULT_WELCOME_NOTES) {
            await saveIndexedDBNote(note);
          }
          setNotes(DEFAULT_WELCOME_NOTES);
          setActiveNoteId(DEFAULT_WELCOME_NOTES[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial notes from IndexedDB:', err);
        setNotes(DEFAULT_WELCOME_NOTES);
        setActiveNoteId(DEFAULT_WELCOME_NOTES[0].id);
      }
    };

    initApp();
  }, []);

  // Listen to remote changes when in Vercel Sync mode
  useEffect(() => {
    if (storageMode !== 'vercel') return;

    const unsubscribe = syncManager.subscribeNotes((remoteNotes) => {
      setNotes(() => {
        return remoteNotes.filter((n) => !isNoteEmpty(n) || n.deletedAt);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [storageMode]);

  // Compute all unique tags across notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Compute all unique projects across notes and project-type notes
  const allProjects = useMemo(() => {
    const projectSet = new Set<string>();
    notes.forEach((n) => {
      if (n.deletedAt) return;
      if (n.type === 'project') {
        const identifier = (n.slug || (n.title ? slugify(n.title) : '') || '').trim();
        if (identifier) projectSet.add(identifier);
      }
      if (n.project) {
        projectSet.add(n.project.trim());
      }
    });
    return Array.from(projectSet).filter(Boolean).sort();
  }, [notes]);

  // Compute all unique authors across notes
  const allAuthors = useMemo(() => {
    const authorSet = new Set<string>();
    notes.forEach((n) => {
      if (n.author && !n.deletedAt) {
        authorSet.add(n.author.trim());
      }
    });
    return Array.from(authorSet).filter(Boolean).sort();
  }, [notes]);

  // Active Note Object
  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Handle Note Save to Active Storage Provider
  const persistNote = useCallback(
    async (updatedNote: Note) => {
      // Do not sync or persist empty notes unless it's a deletion tombstone
      if (isNoteEmpty(updatedNote) && !updatedNote.deletedAt) {
        return;
      }

      try {
        if (storageMode === 'vercel') {
          await syncManager.saveNote(updatedNote);
        } else if (storageMode === 'filesystem' && directoryHandle) {
          const fileName = await saveNoteToDirectory(directoryHandle, updatedNote);
          updatedNote.fileName = fileName;
        } else {
          await saveIndexedDBNote(updatedNote);
        }
      } catch (err) {
        console.error('Failed to persist note:', err);
      }
    },
    [storageMode, directoryHandle]
  );

  // Update Note Title
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, title: newTitle, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Note Content
  const handleContentChange = useCallback(
    (newContent: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, content: newContent, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Note Description (Blog mode)
  const handleDescriptionChange = useCallback(
    (newDescription: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, description: newDescription, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Note Author (Blog mode)
  const handleAuthorChange = useCallback(
    (newAuthor: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, author: newAuthor, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Note Project (Blog mode)
  const handleProjectChange = useCallback(
    (newProject: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, project: newProject, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Toggle Featured (Blog mode)
  const handleToggleFeatured = useCallback(() => {
    if (!activeNoteId) return;

    setNotes((prev) =>
      prev.map((note) => {
        if (note.id === activeNoteId) {
          const updated = { ...note, featured: !note.featured, updatedAt: Date.now() };
          persistNote(updated);
          return updated;
        }
        return note;
      })
    );
  }, [activeNoteId, persistNote]);

  // Update Project Slug (Project mode)
  const handleSlugChange = useCallback(
    (newSlug: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, slug: newSlug, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Project Status (Project mode)
  const handleStatusChange = useCallback(
    (newStatus: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, status: newStatus, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Project Year (Project mode)
  const handleYearChange = useCallback(
    (newYear: number | string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const parsedYear =
              typeof newYear === 'string' ? (newYear === '' ? undefined : parseInt(newYear, 10)) : newYear;
            const updated = { ...note, year: parsedYear, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Project URL (Project mode)
  const handleUrlChange = useCallback(
    (newUrl: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, url: newUrl, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Project GitHub (Project mode)
  const handleGithubChange = useCallback(
    (newGithub: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, github: newGithub, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Project Order (Project mode)
  const handleOrderChange = useCallback(
    (newOrder: number) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = { ...note, order: newOrder, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update Note Type (Convert between Note, Blog post, and Project)
  const handleTypeChange = useCallback(
    (newType: NoteType) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const isBlog = newType === 'post';
            const isProject = newType === 'project';

            const updated: Note = {
              ...note,
              type: newType,
              date: note.date || (isBlog ? formatBlogDate(note.createdAt) : undefined),
              description: note.description || (isBlog || isProject ? '' : undefined),
              author: note.author || (isBlog ? '' : undefined),
              project: note.project || (isBlog ? '' : undefined),
              featured: note.featured !== undefined ? note.featured : (isBlog ? false : undefined),
              slug: note.slug || (isProject ? (note.title ? slugify(note.title) : '') : undefined),
              status: note.status || (isProject ? 'Active' : undefined),
              year: note.year !== undefined ? note.year : (isProject ? new Date().getFullYear() : undefined),
              url: note.url || (isProject ? '' : undefined),
              github: note.github || (isProject ? '' : undefined),
              order: note.order !== undefined ? note.order : (isProject ? 1 : undefined),
              updatedAt: Date.now(),
            };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Add or update an image attached to the active note
  const handleAddImage = useCallback(
    (image: NoteImage) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const existingImages = note.images || [];
            const filtered = existingImages.filter((img) => img.id !== image.id);
            const updated: Note = {
              ...note,
              images: [...filtered, image],
              updatedAt: Date.now(),
            };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Remove an attached image from the active note
  const handleRemoveImage = useCallback(
    (imageId: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const existingImages = note.images || [];
            const updated: Note = {
              ...note,
              images: existingImages.filter((img) => img.id !== imageId),
              updatedAt: Date.now(),
            };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Update folder structure strategy for images
  const handleChangeImageFolderStrategy = useCallback(
    (strategy: ImageFolderStrategy) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated: Note = {
              ...note,
              imageFolderStrategy: strategy,
              updatedAt: Date.now(),
            };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Toggle Pinned
  const handleTogglePin = useCallback(
    (noteId?: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const targetId = noteId || activeNoteId;
      if (!targetId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === targetId) {
            const updated = { ...note, pinned: !note.pinned, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  const checkAndDeleteEmptyNote = useCallback(
    (noteId: string | null) => {
      if (!noteId) return;
      setNotes((prev) => {
        const target = prev.find((n) => n.id === noteId);
        if (target && isNoteEmpty(target) && !target.deletedAt) {
          if (storageMode === 'vercel') {
            syncManager.deleteNote(target.id).catch(() => {});
          } else if (storageMode === 'filesystem' && directoryHandle && target.fileName) {
            deleteNoteFromDirectory(directoryHandle, target.fileName).catch(() => {});
          } else {
            deleteIndexedDBNote(target.id).catch(() => {});
          }
          return prev.filter((n) => n.id !== noteId);
        }
        return prev;
      });
    },
    [storageMode, directoryHandle]
  );

  // Select Note
  const handleSelectNote = useCallback(
    (id: string) => {
      if (activeNoteId && activeNoteId !== id) {
        checkAndDeleteEmptyNote(activeNoteId);
      }
      setActiveNoteId(id);
      setMobileView('editor');
    },
    [activeNoteId, checkAndDeleteEmptyNote]
  );

  const handleBackToList = useCallback(() => {
    if (activeNoteId) {
      checkAndDeleteEmptyNote(activeNoteId);
    }
    setMobileView('list');
  }, [activeNoteId, checkAndDeleteEmptyNote]);

  // Create New Note, Blog Post, or Project
  const handleNewNote = useCallback(
    (
      initialParams?: string | { title?: string; content?: string },
      noteType?: NoteType
    ) => {
      let title = '';
      let content = '';

      if (typeof initialParams === 'string') {
        title = initialParams.trim();
      } else if (initialParams) {
        title = initialParams.title?.trim() || '';
        content = initialParams.content || '';
      }

      const type: NoteType = noteType || 'note';
      const isBlog = type === 'post';
      const isProject = type === 'project';

      const newNote: Note = {
        id: `note-${Date.now().toString(36)}`,
        title: title,
        content: content,
        tags: selectedTag ? [selectedTag] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
        type: type,
        date: isBlog ? formatBlogDate() : undefined,
        description: isBlog || isProject ? '' : undefined,
        author: isBlog ? '' : undefined,
        project: isBlog ? '' : undefined,
        featured: isBlog ? false : undefined,
        slug: isProject ? (title ? slugify(title) : '') : undefined,
        status: isProject ? 'Active' : undefined,
        year: isProject ? new Date().getFullYear() : undefined,
        url: isProject ? '' : undefined,
        github: isProject ? '' : undefined,
        order: isProject ? 1 : undefined,
      };

      setNotes((prev) => {
        // Purge any empty notes so spamming Alt+N never stacks empty notes
        const cleaned = prev.filter((n) => {
          const empty = isNoteEmpty(n) && !n.deletedAt;
          if (empty) {
            if (storageMode === 'vercel') {
              syncManager.deleteNote(n.id).catch(() => {});
            } else if (storageMode === 'filesystem' && directoryHandle && n.fileName) {
              deleteNoteFromDirectory(directoryHandle, n.fileName).catch(() => {});
            } else {
              deleteIndexedDBNote(n.id).catch(() => {});
            }
          }
          return !empty;
        });
        return [newNote, ...cleaned];
      });

      setActiveNoteId(newNote.id);
      setMobileView('editor');
      if (!isNoteEmpty(newNote)) {
        persistNote(newNote);
      }
    },
    [selectedTag, persistNote, storageMode, directoryHandle]
  );

  // Batch Delete Notes
  const handleBatchDeleteNotes = useCallback(
    async (noteIds: string[]) => {
      if (noteIds.length === 0) return;
      const idsSet = new Set(noteIds);

      const sample = notes.find((n) => idsSet.has(n.id));
      if (!sample) return;

      if (!sample.deletedAt) {
        const now = Date.now();
        const updatedNotes = notes.map((n) => {
          if (idsSet.has(n.id)) {
            const updated = { ...n, deletedAt: now };
            persistNote(updated);
            return updated;
          }
          return n;
        });
        setNotes(updatedNotes);

        if (activeNoteId && idsSet.has(activeNoteId)) {
          const remaining = updatedNotes.filter((n) => !n.deletedAt);
          setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
        }
      } else {
        setNotes((prev) => prev.filter((n) => !idsSet.has(n.id)));
        if (activeNoteId && idsSet.has(activeNoteId)) {
          const remaining = notes.filter((n) => !idsSet.has(n.id));
          setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
        }

        for (const noteId of noteIds) {
          const note = notes.find((n) => n.id === noteId);
          try {
            if (storageMode === 'vercel') {
              await syncManager.deleteNote(noteId);
            } else if (storageMode === 'filesystem' && directoryHandle && note?.fileName) {
              await deleteNoteFromDirectory(directoryHandle, note.fileName);
            } else {
              await deleteIndexedDBNote(noteId);
            }
          } catch (err) {
            console.error('Failed to permanently delete note:', err);
          }
        }
      }
    },
    [notes, activeNoteId, storageMode, directoryHandle, persistNote]
  );

  // Batch Toggle Pin Notes
  const handleBatchTogglePinNotes = useCallback(
    (noteIds: string[]) => {
      if (noteIds.length === 0) return;
      const idsSet = new Set(noteIds);

      const selectedNotes = notes.filter((n) => idsSet.has(n.id));
      const allPinned = selectedNotes.every((n) => n.pinned);
      const targetPinnedState = !allPinned;

      setNotes((prev) =>
        prev.map((n) => {
          if (idsSet.has(n.id)) {
            const updated = { ...n, pinned: targetPinnedState, updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return n;
        })
      );
    },
    [notes, persistNote]
  );

  // Batch Restore Notes
  const handleBatchRestoreNotes = useCallback(
    (noteIds: string[]) => {
      if (noteIds.length === 0) return;
      const idsSet = new Set(noteIds);

      setNotes((prev) =>
        prev.map((n) => {
          if (idsSet.has(n.id)) {
            const restored = { ...n };
            delete restored.deletedAt;
            persistNote(restored);
            return restored;
          }
          return n;
        })
      );
    },
    [notes, persistNote]
  );

  // Delete Note (Soft delete to Trash if active, or Permanent delete if in Trash)
  const handleDeleteNote = useCallback(
    async (noteId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      const noteToDelete = notes.find((n) => n.id === noteId);
      if (!noteToDelete) return;

      if (!noteToDelete.deletedAt) {
        // Soft delete: set deletedAt
        const updated = { ...noteToDelete, deletedAt: Date.now() };
        setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));

        if (activeNoteId === noteId) {
          const activeRemaining = notes.filter((n) => n.id !== noteId && !n.deletedAt);
          setActiveNoteId(activeRemaining.length > 0 ? activeRemaining[0].id : null);
        }
        persistNote(updated);
      } else {
        // Permanent delete
        setNotes((prev) => prev.filter((n) => n.id !== noteId));

        if (activeNoteId === noteId) {
          const remaining = notes.filter((n) => n.id !== noteId);
          setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
        }

        try {
          if (storageMode === 'vercel') {
            await syncManager.deleteNote(noteId);
          } else if (storageMode === 'filesystem' && directoryHandle && noteToDelete.fileName) {
            await deleteNoteFromDirectory(directoryHandle, noteToDelete.fileName);
          } else {
            await deleteIndexedDBNote(noteId);
          }
        } catch (err) {
          console.error('Failed to permanently delete note from storage:', err);
        }
      }
    },
    [notes, activeNoteId, storageMode, directoryHandle, persistNote]
  );

  // Restore Note from Trash
  const handleRestoreNote = useCallback(
    async (noteId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }

      const noteToRestore = notes.find((n) => n.id === noteId);
      if (!noteToRestore) return;

      const restored: Note = { ...noteToRestore };
      delete restored.deletedAt;

      setNotes((prev) => prev.map((n) => (n.id === noteId ? restored : n)));
      setActiveNoteId(noteId);
      persistNote(restored);
    },
    [notes, persistNote]
  );

  // Empty Trash Permanently
  const handleEmptyTrash = useCallback(async () => {
    const trashed = notes.filter((n) => n.deletedAt);
    for (const note of trashed) {
      try {
        if (storageMode === 'vercel') {
          await syncManager.deleteNote(note.id);
        } else if (storageMode === 'filesystem' && directoryHandle && note.fileName) {
          await deleteNoteFromDirectory(directoryHandle, note.fileName);
        } else {
          await deleteIndexedDBNote(note.id);
        }
      } catch (err) {
        console.error('Failed to permanently clear trashed note:', err);
      }
    }
    setNotes((prev) => prev.filter((n) => !n.deletedAt));
  }, [notes, storageMode, directoryHandle]);

  // Add Tag
  const handleAddTag = useCallback(
    (tag: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId && !note.tags.includes(tag)) {
            const updated = { ...note, tags: [...note.tags, tag], updatedAt: Date.now() };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Remove Tag
  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!activeNoteId) return;

      setNotes((prev) =>
        prev.map((note) => {
          if (note.id === activeNoteId) {
            const updated = {
              ...note,
              tags: note.tags.filter((t) => t !== tag),
              updatedAt: Date.now(),
            };
            persistNote(updated);
            return updated;
          }
          return note;
        })
      );
    },
    [activeNoteId, persistNote]
  );

  // Select Local Directory
  const handleSelectLocalDirectory = async () => {
    const handle = await selectLocalDirectory();
    setDirectoryHandle(handle);
    setDirectoryName(handle.name);
    setStorageMode('filesystem');
    localStorage.setItem('active_storage_mode', 'filesystem');

    const dirNotes = await loadNotesFromDirectory(handle);
    if (dirNotes && dirNotes.length > 0) {
      setNotes(dirNotes);
      setActiveNoteId(dirNotes[0].id);
    }
  };

  // Switch to IndexedDB
  const handleSwitchToIndexedDB = async () => {
    setStorageMode('indexeddb');
    localStorage.setItem('active_storage_mode', 'indexeddb');
    setDirectoryHandle(null);
    setDirectoryName('');

    const idbNotes = await getIndexedDBNotes();
    setNotes(idbNotes);
    if (idbNotes.length > 0) {
      setActiveNoteId(idbNotes[0].id);
    }
  };

  // Switch to Vercel Sync
  const handleSwitchToVercelSync = async () => {
    setStorageMode('vercel');
    localStorage.setItem('active_storage_mode', 'vercel');
    setDirectoryHandle(null);
    setDirectoryName('');

    let vercelNotes = await syncManager.loadNotes();
    if (!vercelNotes || vercelNotes.length === 0) {
      // Seed initial notes from current state or IndexedDB so user doesn't see a blank list
      const fallbackNotes = notes.length > 0 ? notes : await getIndexedDBNotes();
      if (fallbackNotes && fallbackNotes.length > 0) {
        for (const note of fallbackNotes) {
          await syncManager.saveNote(note);
        }
        vercelNotes = await syncManager.loadNotes();
      }
    }

    setNotes(vercelNotes);
    if (vercelNotes.length > 0) {
      const activeList = vercelNotes.filter((n) => !n.deletedAt);
      setActiveNoteId(activeList.length > 0 ? activeList[0].id : vercelNotes[0].id);
    } else {
      setActiveNoteId(null);
    }
  };

  // Import Raw Markdown Files & Attached Asset Folders / Zips
  const handleImportMarkdownFiles = async (files: FileList | File[]) => {
    try {
      const importedNotes = await importNotesFromFiles(files);
      if (importedNotes.length === 0) {
        showToast('No valid markdown documents found to import.');
        return;
      }

      for (const note of importedNotes) {
        await persistNote(note);
      }

      setNotes((prev) => [...importedNotes, ...prev]);
      setActiveNoteId(importedNotes[0].id);

      const totalImages = importedNotes.reduce((acc, n) => acc + (n.images?.length || 0), 0);
      if (totalImages > 0) {
        showToast(`Imported ${importedNotes.length} note${importedNotes.length === 1 ? '' : 's'} with ${totalImages} image${totalImages === 1 ? '' : 's'}`);
      } else {
        showToast(`Imported ${importedNotes.length} note${importedNotes.length === 1 ? '' : 's'}`);
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      showToast(`Import failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Rename Note File and Sync Asset Directory / Image Paths
  const handleRenameFileName = useCallback(
    async (newFileName: string) => {
      if (!activeNoteId) return;

      let savedNote: Note | null = null;

      setNotes((prev) => {
        const currentNote = prev.find((n) => n.id === activeNoteId);
        if (!currentNote) return prev;

        const oldFileName = currentNote.fileName;
        const updated = syncNoteImagePathsOnRename(currentNote, newFileName);
        savedNote = updated;

        // If in filesystem mode and oldFileName exists and changed, delete old file from disk
        if (
          storageMode === 'filesystem' &&
          directoryHandle &&
          oldFileName &&
          oldFileName !== updated.fileName
        ) {
          deleteNoteFromDirectory(directoryHandle, oldFileName).catch((err) =>
            console.warn('Could not remove old file on rename:', err)
          );
        }

        persistNote(updated);
        return prev.map((n) => (n.id === activeNoteId ? updated : n));
      });

      if (savedNote) {
        showToast(`Renamed to "${(savedNote as Note).fileName}"`);
      }
    },
    [activeNoteId, storageMode, directoryHandle, persistNote, showToast]
  );

  // Import Restored Encrypted Backup
  const handleImportRestoredNotes = async (restoredNotes: Note[]) => {
    for (const note of restoredNotes) {
      await persistNote(note);
    }

    setNotes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const filteredNew = restoredNotes.filter((n) => !existingIds.has(n.id));
      return [...filteredNew, ...prev];
    });

    if (restoredNotes.length > 0) {
      setActiveNoteId(restoredNotes[0].id);
      showToast(`Restored ${restoredNotes.length} note${restoredNotes.length === 1 ? '' : 's'}`);
    }
  };

  // Save Current Note as .md file to local folder
  const handleSaveCurrentNoteToLocalFolder = useCallback(async () => {
    if (!activeNote) return;
    try {
      const result = await saveNoteToLocalFolder(activeNote, directoryHandle);
      if (result.directoryHandle && !directoryHandle) {
        setDirectoryHandle(result.directoryHandle);
        setDirectoryName(result.folderName || result.directoryHandle.name);
      }
      if (activeNote.fileName !== result.fileName) {
        const updated = { ...activeNote, fileName: result.fileName };
        setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? updated : n)));
        persistNote(updated);
      }
      if (result.folderName) {
        showToast(`Saved "${result.fileName}" to "${result.folderName}"`);
      } else {
        showToast(`Saved "${result.fileName}"`);
      }
    } catch (err: any) {
      if (err && err.name !== 'AbortError' && !err.message?.includes('cancelled')) {
        showToast(`Save failed: ${err.message || 'Error'}`);
      }
    }
  }, [activeNote, directoryHandle, persistNote, showToast]);

  // Open .md note from local storage
  const handleOpenLocalMarkdownFile = useCallback(async () => {
    try {
      const opened = await openLocalMarkdownFile();
      if (!opened) return;

      const existingIndex = notes.findIndex(
        (n) =>
          n.fileName === opened.fileName ||
          (opened.note.title && n.title === opened.note.title && n.content === opened.note.content)
      );

      if (existingIndex !== -1) {
        const existing = notes[existingIndex];
        const updated: Note = {
          ...existing,
          ...opened.note,
          id: existing.id,
          updatedAt: Date.now(),
        };
        setNotes((prev) => prev.map((n) => (n.id === existing.id ? updated : n)));
        setActiveNoteId(existing.id);
        persistNote(updated);
        showToast(`Opened "${opened.fileName}"`);
      } else {
        setNotes((prev) => [opened.note, ...prev]);
        setActiveNoteId(opened.note.id);
        persistNote(opened.note);
        showToast(`Opened "${opened.fileName}"`);
      }
      setMobileView('editor');
    } catch (err: any) {
      if (err && err.name !== 'AbortError' && !err.message?.includes('cancelled')) {
        showToast(`Open failed: ${err.message || 'Error'}`);
      }
    }
  }, [notes, persistNote, showToast]);

  // Toggle Dark Mode
  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Toggle Editor Mode
  const handleToggleEditorMode = useCallback(() => {
    setEditorMode((prev) => (prev === 'wysiwyg' ? 'markdown' : 'wysiwyg'));
  }, []);

  // Keyboard Shortcuts Hook
  useKeyboardShortcuts({
    onNewNote: handleNewNote,
    onSaveLocalFile: handleSaveCurrentNoteToLocalFolder,
    onOpenLocalFile: () => setIsImportModalOpen(true),
    onToggleDarkMode: handleToggleTheme,
    onToggleViewMode: handleToggleEditorMode,
    onSaveNote: () => {
      if (activeNote) persistNote(activeNote);
    },
    onFocusSearch: () => {
      setIsSearchMode(true);
    },
    onOpenBackupModal: () => setIsBackupModalOpen(true),
    onOpenShortcutsModal: () => setIsShortcutsModalOpen(true),
    onCloseModals: () => {
      setSearchQuery('');
      setIsDirectoryModalOpen(false);
      setIsBackupModalOpen(false);
      setIsImportModalOpen(false);
      setIsShortcutsModalOpen(false);
    },
  });

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-white dark:bg-black text-black dark:text-white font-sans antialiased transition-colors duration-200">
      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={handleSelectNote}
          onNewNote={handleNewNote}
          onDeleteNote={handleDeleteNote}
          onRestoreNote={handleRestoreNote}
          onEmptyTrash={handleEmptyTrash}
          onTogglePin={handleTogglePin}
          onBatchDelete={handleBatchDeleteNotes}
          onBatchTogglePin={handleBatchTogglePinNotes}
          onBatchRestore={handleBatchRestoreNotes}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          allTags={allTags}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSearchMode={isSearchMode}
          onToggleSearchMode={() => setIsSearchMode((prev) => !prev)}
          storageMode={storageMode}
          onOpenSyncModal={() => setIsSyncModalOpen(true)}
          onOpenLocalFile={handleOpenLocalMarkdownFile}
          className={mobileView === 'editor' ? 'hidden md:flex w-full md:w-80' : 'flex w-full md:w-80'}
        />

        {/* Editor Pane (WYSIWYG or Markdown view toggle) */}
        <div className={mobileView === 'list' ? 'hidden md:flex flex-1 overflow-hidden' : 'flex flex-1 overflow-hidden w-full'}>
          {activeNote ? (
            <EditorPane
              note={activeNote}
              editorMode={editorMode}
              onChangeEditorMode={setEditorMode}
              onToggleEditorMode={handleToggleEditorMode}
              onBackToList={handleBackToList}
              onSaveToLocalFolder={handleSaveCurrentNoteToLocalFolder}
              onRenameFileName={handleRenameFileName}
              onOpenLocalFile={handleOpenLocalMarkdownFile}
              toastMessage={toastMessage}
              onChangeTitle={handleTitleChange}
              onChangeContent={handleContentChange}
              onChangeDescription={handleDescriptionChange}
              onChangeAuthor={handleAuthorChange}
              allAuthors={allAuthors}
              onChangeProject={handleProjectChange}
              allProjects={allProjects}
              onToggleFeatured={handleToggleFeatured}
              onChangeSlug={handleSlugChange}
              onChangeStatus={handleStatusChange}
              onChangeYear={handleYearChange}
              onChangeUrl={handleUrlChange}
              onChangeGithub={handleGithubChange}
              onChangeOrder={handleOrderChange}
              onChangeType={handleTypeChange}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              onChangeImageFolderStrategy={handleChangeImageFolderStrategy}
              onTogglePin={() => handleTogglePin(activeNote.id)}
              onDeleteNote={() => handleDeleteNote(activeNote.id)}
              onRestoreNote={() => handleRestoreNote(activeNote.id)}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              allTags={allTags}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              storageMode={storageMode}
              directoryName={directoryName}
              onOpenDirectoryModal={() => setIsDirectoryModalOpen(true)}
              onOpenSyncModal={() => setIsSyncModalOpen(true)}
              onOpenBackupModal={() => setIsBackupModalOpen(true)}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-black">
              <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">No Note Selected</h2>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                Select a note from the sidebar or press Option+N / Alt+N to start writing.
              </p>
              <button
                onClick={() => handleNewNote()}
                className="mt-4 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg text-xs font-semibold transition-colors"
              >
                + Create New Note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
      <DirectorySelectorModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        currentMode={storageMode}
        directoryName={directoryName}
        onSelectLocalDirectory={handleSelectLocalDirectory}
        onSwitchToIndexedDB={handleSwitchToIndexedDB}
        onSwitchToVercelSync={handleSwitchToVercelSync}
        onOpenSyncSettings={() => {
          setIsDirectoryModalOpen(false);
          setIsSyncModalOpen(true);
        }}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onConfigured={async () => {
          // When configured or credentials entered, switch to Vercel Sync
          await handleSwitchToVercelSync();
        }}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        notes={notes}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportMarkdownFiles={handleImportMarkdownFiles}
        onImportRestoredNotes={handleImportRestoredNotes}
      />

      <ShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />
    </div>
  );
}
