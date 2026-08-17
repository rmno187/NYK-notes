import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  Trash2,
  RotateCcw,
  ArchiveX,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { Note } from '../types';
import { NotePreview } from './NotePreview';
import { modKey } from '../lib/platform';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: (
    initialParams?: string | { title?: string; content?: string }
  ) => void;
  onDeleteNote: (id: string, e?: React.MouseEvent) => void;
  onRestoreNote: (id: string, e?: React.MouseEvent) => void;
  onEmptyTrash: () => void;
  onTogglePin: (id: string, e?: React.MouseEvent) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchTogglePin?: (ids: string[]) => void;
  onBatchRestore?: (ids: string[]) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettingsModal?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onEmptyTrash,
  onBatchDelete,
  onBatchTogglePin,
  onBatchRestore,
  searchQuery,
  onSearchChange,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes');
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const longPressTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLongPressRef = useRef(false);

  // Clear selections when changing tabs
  useEffect(() => {
    setSelectedNoteIds([]);
  }, [activeTab]);

  // Close folder dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsFolderDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeNotes = notes.filter((n) => !n.deletedAt);
  const trashedNotes = notes.filter((n) => Boolean(n.deletedAt));

  const currentNotesList =
    activeTab === 'notes' ? activeNotes : trashedNotes;

  // --------------------------------------------------
  // Search
  // --------------------------------------------------

  const filteredNotes = currentNotesList.filter((note) => {
    const query = searchQuery.toLowerCase();

    return (
      !searchQuery ||
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  // --------------------------------------------------
  // Sort notes
  // --------------------------------------------------

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (activeTab === 'notes') {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return timeB - timeA;
    }

    return (b.deletedAt || 0) - (a.deletedAt || 0);
  });

  // --------------------------------------------------
  // Long press / multi-selection
  // --------------------------------------------------

  const pressStartRef = useRef({ x: 0, y: 0 });

  const handlePressStart = useCallback(
    (
      id: string,
      e: React.MouseEvent | React.TouchEvent
    ) => {
      isLongPressRef.current = false;

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }

      const point =
        'touches' in e ? e.touches[0] : e;

      pressStartRef.current = {
        x: point.clientX,
        y: point.clientY,
      };

      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;

        setSelectedNoteIds((prev) =>
          prev.includes(id) ? prev : [...prev, id]
        );
      }, 500);
    },
    []
  );

  const handlePressMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!longPressTimerRef.current) return;

      const point =
        'touches' in e ? e.touches[0] : e;

      const dx =
        point.clientX - pressStartRef.current.x;

      const dy =
        point.clientY - pressStartRef.current.y;

      // Cancel long press when the user starts scrolling/moving.
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    },
    []
  );

  const handlePressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleNoteClick = (id: string) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    if (selectedNoteIds.length > 0) {
      setSelectedNoteIds((prev) =>
        prev.includes(id)
          ? prev.filter((i) => i !== id)
          : [...prev, id]
      );
    } else {
      onSelectNote(id);
    }
  };

  const handleContextMenu = (
    id: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev : [...prev, id]
    );
  };

  // --------------------------------------------------
  // Selection state
  // --------------------------------------------------

  const selectedNotes = sortedNotes.filter((n) =>
    selectedNoteIds.includes(n.id)
  );

  const allSelectedPinned =
    selectedNotes.length > 0 &&
    selectedNotes.every((n) => n.pinned);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <aside
      className={`w-80 h-full flex flex-col bg-neutral-50 dark:bg-black border-r border-neutral-200 dark:border-neutral-800 shrink-0 select-none transition-colors duration-200 ${className}`}
    >
      {/* ==================================================
          TOP BAR
          ================================================== */}

      {selectedNoteIds.length > 0 ? (
        /* MULTI-SELECTION TOOLBAR */
        <div className="px-3 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10 bg-neutral-50 dark:bg-black border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setSelectedNoteIds([])}
            className="px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors text-xs font-medium"
            title="Cancel Selection"
          >
            {selectedNoteIds.length} Selected
          </button>

          <div className="flex items-center space-x-1">
            {/* SELECT ALL */}
            <button
              onClick={() => {
                if (
                  selectedNoteIds.length ===
                  sortedNotes.length
                ) {
                  setSelectedNoteIds([]);
                } else {
                  setSelectedNoteIds(
                    sortedNotes.map((n) => n.id)
                  );
                }
              }}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-medium transition-colors flex items-center"
              title="Toggle Select All"
            >
              <CheckSquare className="w-3.5 h-3.5 inline mr-1" />

              <span>
                {selectedNoteIds.length ===
                sortedNotes.length
                  ? 'None'
                  : 'All'}
              </span>
            </button>

            {activeTab === 'notes' ? (
              <>
                {/* PIN */}
                <button
                  onClick={() => {
                    onBatchTogglePin?.(selectedNoteIds);
                  }}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title={
                    allSelectedPinned
                      ? 'Unpin Selected'
                      : 'Pin Selected'
                  }
                >
                  <Pin
                    className={`w-3.5 h-3.5 ${
                      allSelectedPinned
                        ? 'fill-current'
                        : ''
                    }`}
                  />

                  <span className="hidden sm:inline">
                    {allSelectedPinned
                      ? 'Unpin'
                      : 'Pin'}
                  </span>
                </button>

                {/* DELETE */}
                <button
                  onClick={() => {
                    onBatchDelete?.(selectedNoteIds);
                    setSelectedNoteIds([]);
                  }}
                  className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title="Delete Selected Notes"
                >
                  <Trash2 className="w-3.5 h-3.5" />

                  <span className="hidden sm:inline">
                    Delete
                  </span>
                </button>
              </>
            ) : (
              <>
                {/* RESTORE */}
                <button
                  onClick={() => {
                    onBatchRestore?.(selectedNoteIds);
                    setSelectedNoteIds([]);
                  }}
                  className="p-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title="Restore Selected Notes"
                >
                  <RotateCcw className="w-3.5 h-3.5" />

                  <span className="hidden sm:inline">
                    Restore
                  </span>
                </button>

                {/* PERMANENT DELETE */}
                <button
                  onClick={() => {
                    onBatchDelete?.(selectedNoteIds);
                    setSelectedNoteIds([]);
                  }}
                  className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title="Delete Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />

                  <span className="hidden sm:inline">
                    Delete
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================
           PRIMARY NAVIGATION & SEARCH HEADER
           ================================================== */
        <div className="p-2.5 sm:p-3 shrink-0 sticky top-0 z-10 border-b border-transparent bg-neutral-50/95 dark:bg-black/95 backdrop-blur flex flex-col gap-2.5">
          {/* ROW 1: FOLDER SELECTOR + NEW NOTE BUTTON */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* INBOX / FOLDER SELECTOR WITH LOGO */}
            <div ref={dropdownRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
                className="flex items-center space-x-1.5 p-1 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors text-xs font-semibold text-neutral-900 dark:text-neutral-100 text-left"
                title="Switch Folder / Category"
              >
                {/* LOGO BADGE */}
                <div className="w-5 h-5 rounded overflow-hidden shrink-0">
                  <img
                    src="/logo.svg"
                    alt=""
                    className="w-full h-full object-contain"
                  />
                </div>

                <span className="truncate font-sans font-bold text-xs">
                  {activeTab === 'notes'
                    ? `Notes (${activeNotes.length})`
                    : `Trash (${trashedNotes.length})`}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${
                    isFolderDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* DROPDOWN MENU */}
              {isFolderDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 py-1.5 z-50 text-xs">
                  {/* NOTES */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('notes');
                      setIsFolderDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors ${
                      activeTab === 'notes'
                        ? 'font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/40'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Notes</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                      {activeNotes.length}
                    </span>
                  </button>

                  {/* TRASH */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('trash');
                      setIsFolderDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors ${
                      activeTab === 'trash'
                        ? 'font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/40'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Trash</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-red-600 dark:text-red-400">
                      {trashedNotes.length}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* NEW NOTE BUTTON ON SAME ROW */}
            <button
              type="button"
              onClick={() => onNewNote()}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-sans font-semibold tracking-wide text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
              title={`Create New Note (${modKey}+N)`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-current">
                New note
              </span>
            </button>
          </div>

          {/* ROW 2: SEARCH BAR + SETTINGS BUTTON */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-1 min-w-[90px]">
              <Search className="w-3.5 h-3.5 absolute left-1 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />

              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onSearchChange('');
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="
                  w-full
                  pl-5 pr-5 py-1
                  bg-transparent
                  border-0
                  border-b border-neutral-300 dark:border-neutral-700
                  rounded-none
                  text-xs
                  text-neutral-900 dark:text-neutral-100
                  placeholder-neutral-400
                  font-mono
                  focus:outline-none
                  focus:border-black dark:focus:border-white
                  transition-colors
                "
                title={`Search (${modKey}+F)`}
              />

              {/* CLEAR SEARCH */}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors text-sm px-1"
                  title="Clear Search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          NOTES / TRASH LIST
          ================================================== */}

      <div className="flex-1 overflow-y-auto px-2">
        {/* TRASH INFO */}

        {activeTab === 'trash' && (
          <div className="mb-2 p-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs">
            <div className="flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              <span>Trash Bin</span>

              {trashedNotes.length > 0 && (
                <button
                  onClick={onEmptyTrash}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-medium transition-colors"
                >
                  Empty Trash
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Deleted items permanently expire after 30 days.
            </p>
          </div>
        )}

        {/* EMPTY STATE */}

        {sortedNotes.length === 0 ? (
          <div className="py-12 text-center px-4">
            {activeTab === 'trash' ? (
              <>
                <ArchiveX className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />

                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Trash is empty
                </p>
              </>
            ) : (
              <>
                <FileText className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />

                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {searchQuery
                    ? 'No matching notes found'
                    : 'No notes yet'}
                </p>
              </>
            )}
          </div>
        ) : (
          /* ==================================================
             NOTE LIST
             ================================================== */

          sortedNotes.map((note) => {
            const isActive =
              note.id === activeNoteId;

            const isSelected =
              selectedNoteIds.includes(note.id);

            const noteTitle = note.title
              ? note.title.trim()
              : '';

            const formattedDate = new Date(
              note.updatedAt || note.createdAt
            ).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={note.id}
                onMouseDown={(e) =>
                  handlePressStart(note.id, e)
                }
                onMouseMove={handlePressMove}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={(e) =>
                  handlePressStart(note.id, e)
                }
                onTouchMove={handlePressMove}
                onTouchEnd={handlePressEnd}
                onContextMenu={(e) =>
                  handleContextMenu(note.id, e)
                }
                onClick={() =>
                  handleNoteClick(note.id)
                }
                className={`group relative py-4 pr-2.5 cursor-pointer transition-all flex items-start space-x-2.5 ${
                  isSelected
                    ? 'pl-2.5 bg-black text-white dark:bg-white dark:text-black'
                    : isActive
                    ? 'pl-1.5 border-l-4 border-l-black dark:border-l-white text-black dark:text-white'
                    : 'pl-2.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  {/* TITLE / UNTITLED PREVIEW */}

                  <div className="flex items-start justify-between gap-1">
                    {noteTitle ? (
                      <h3 className="font-bold truncate flex-1 min-w-0">
                        {noteTitle}
                      </h3>
                    ) : (
                      <div className="mt-1 text-sm flex-1 min-w-0">
                        <NotePreview
                          content={note.content}
                        />
                      </div>
                    )}

                    {/* PIN */}

                    {note.pinned &&
                      activeTab === 'notes' && (
                        <Pin className="w-3 h-3 text-current fill-current shrink-0 ml-1" />
                      )}
                  </div>

                  {/* PREVIEW FOR TITLED NOTES */}

                  {noteTitle && (
                    <div className="mt-1 text-sm">
                      <NotePreview
                        content={note.content}
                      />
                    </div>
                  )}

                  {/* FOOTER */}

                  {activeTab === 'notes' && (
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                        {formattedDate}
                      </span>

                        {note.tags.length > 0 && (
                          <div className="flex items-center space-x-1 overflow-hidden max-w-[160px]">
                            {note.tags
                              .slice(0, 3)
                              .map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSearchChange(t);
                                  }}
                                  className={`text-xs font-mono px-1.5 py-0.5 rounded-md truncate border transition-colors ${
                                    isSelected
                                      ? 'bg-white/10 text-current border-white/20 hover:bg-white/20 dark:bg-black/10 dark:border-black/20'
                                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                  }`}
                                  title={`Search for #${t}`}
                                >
                                  {t}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};