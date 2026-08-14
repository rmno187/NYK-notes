import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, StorageMode, Theme, EditorMode } from './types';
import {
  getIndexedDBNotes,
  saveIndexedDBNote,
  deleteIndexedDBNote,
  selectLocalDirectory,
  loadNotesFromDirectory,
  saveNoteToDirectory,
  deleteNoteFromDirectory,
} from './lib/storage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Sidebar } from './components/Sidebar';
import { EditorPane } from './components/EditorPane';
import { CommandPalette } from './components/CommandPalette';
import { DirectorySelectorModal } from './components/DirectorySelectorModal';
import { BackupModal } from './components/BackupModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { SettingsModal } from './components/SettingsModal';

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
  const [showDates, setShowDates] = useState<boolean>(
    () => localStorage.getItem('notes_show_dates') === 'true'
  );
  
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isSavedIndicator, setIsSavedIndicator] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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

  // Initial Data Load (IndexedDB or Local Directory)
  useEffect(() => {
    const initApp = async () => {
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
            } else {
              validNotes.push(note);
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

  // Compute all unique tags across notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Active Note Object
  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  // Handle Note Save to Active Storage Provider
  const persistNote = useCallback(
    async (updatedNote: Note) => {
      try {
        if (storageMode === 'filesystem' && directoryHandle) {
          const fileName = await saveNoteToDirectory(directoryHandle, updatedNote);
          updatedNote.fileName = fileName;
        } else {
          await saveIndexedDBNote(updatedNote);
        }

        setIsSavedIndicator(true);
        setTimeout(() => setIsSavedIndicator(false), 1500);
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

  // Select Note
  const handleSelectNote = useCallback((id: string) => {
    setActiveNoteId(id);
    setMobileView('editor');
  }, []);

  // Create New Note
  const handleNewNote = useCallback(
    (initialParams?: string | { title?: string; content?: string }) => {
      let title = '';
      let content = '';

      if (typeof initialParams === 'string') {
        title = initialParams.trim();
      } else if (initialParams) {
        title = initialParams.title?.trim() || '';
        content = initialParams.content || '';
      }

      const newNote: Note = {
        id: `note-${Date.now().toString(36)}`,
        title: title,
        content: content,
        tags: selectedTag ? [selectedTag] : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
      };

      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      setMobileView('editor');
      persistNote(newNote);
    },
    [selectedTag, persistNote]
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
            if (storageMode === 'filesystem' && directoryHandle && note?.fileName) {
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
          if (storageMode === 'filesystem' && directoryHandle && noteToDelete.fileName) {
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
        if (storageMode === 'filesystem' && directoryHandle && note.fileName) {
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

    const dirNotes = await loadNotesFromDirectory(handle);
    if (dirNotes && dirNotes.length > 0) {
      setNotes(dirNotes);
      setActiveNoteId(dirNotes[0].id);
    }
  };

  // Switch to IndexedDB
  const handleSwitchToIndexedDB = async () => {
    setStorageMode('indexeddb');
    setDirectoryHandle(null);
    setDirectoryName('');

    const idbNotes = await getIndexedDBNotes();
    setNotes(idbNotes);
    if (idbNotes.length > 0) {
      setActiveNoteId(idbNotes[0].id);
    }
  };

  // Import Raw Markdown Files
  const handleImportMarkdownFiles = async (files: FileList) => {
    const newNotes: Note[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const text = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');

      const importedNote: Note = {
        id: `imported-${Date.now().toString(36)}-${i}`,
        title: title || 'Imported Note',
        content: text,
        tags: ['imported'],
        createdAt: file.lastModified || Date.now(),
        updatedAt: file.lastModified || Date.now(),
        pinned: false,
      };

      newNotes.push(importedNote);
      await persistNote(importedNote);
    }

    setNotes((prev) => [...newNotes, ...prev]);
    if (newNotes.length > 0) {
      setActiveNoteId(newNotes[0].id);
    }
  };

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
    }
  };

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
    onOpenCommandPalette: () => setIsCommandPaletteOpen(true),
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
      setIsCommandPaletteOpen(false);
      setIsDirectoryModalOpen(false);
      setIsBackupModalOpen(false);
      setIsShortcutsModalOpen(false);
      setIsSettingsModalOpen(false);
    },
  });

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-black text-black dark:text-white font-sans antialiased transition-colors duration-200">
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
          showDates={showDates}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
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
              onBackToList={() => setMobileView('list')}
              onChangeTitle={handleTitleChange}
              onChangeContent={handleContentChange}
              onTogglePin={() => handleTogglePin(activeNote.id)}
              onDeleteNote={() => handleDeleteNote(activeNote.id)}
              onRestoreNote={() => handleRestoreNote(activeNote.id)}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              allTags={allTags}
              isSaved={isSavedIndicator}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-black">
              <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">No Note Selected</h2>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                Select a note from the sidebar or click "New Note" (⌘N) to start writing.
              </p>
              <button
                onClick={handleNewNote}
                className="mt-4 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg text-xs font-semibold transition-colors"
              >
                + Create New Note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        notes={notes}
        onSelectNote={handleSelectNote}
        onNewNote={handleNewNote}
        onToggleTheme={handleToggleTheme}
        onToggleViewMode={handleToggleEditorMode}
        onOpenDirectoryModal={() => setIsDirectoryModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        showDates={showDates}
        onToggleShowDates={() => {
          setShowDates((prev) => {
            const next = !prev;
            localStorage.setItem('notes_show_dates', String(next));
            return next;
          });
        }}
        storageMode={storageMode}
        directoryName={directoryName}
        onOpenDirectoryModal={() => setIsDirectoryModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onImportMarkdownFiles={handleImportMarkdownFiles}
      />

      <DirectorySelectorModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        currentMode={storageMode}
        directoryName={directoryName}
        onSelectLocalDirectory={handleSelectLocalDirectory}
        onSwitchToIndexedDB={handleSwitchToIndexedDB}
      />

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        notes={notes}
        onImportRestoredNotes={handleImportRestoredNotes}
      />

      <ShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />
    </div>
  );
}
