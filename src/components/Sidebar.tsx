import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  Trash2,
  X,
  Settings,
  CornerDownLeft,
  RotateCcw,
  ArchiveX,
  Check,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { Note } from '../types';
import { MarkdownLogo } from './MarkdownLogo';
import { NotePreview } from './NotePreview';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: (initialParams?: string | { title?: string; content?: string }) => void;
  onDeleteNote: (id: string, e?: React.MouseEvent) => void;
  onRestoreNote: (id: string, e?: React.MouseEvent) => void;
  onEmptyTrash: () => void;
  onTogglePin: (id: string, e?: React.MouseEvent) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchTogglePin?: (ids: string[]) => void;
  onBatchRestore?: (ids: string[]) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  allTags: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSearchMode: boolean;
  onToggleSearchMode: () => void;
  showDates: boolean;
  noteListPreviewMode?: 'summary' | 'full';
  onOpenSettingsModal: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  onRestoreNote,
  onEmptyTrash,
  onTogglePin,
  onBatchDelete,
  onBatchTogglePin,
  onBatchRestore,
  selectedTag,
  onSelectTag,
  allTags,
  searchQuery,
  onSearchChange,
  isSearchMode,
  onToggleSearchMode,
  showDates,
  noteListPreviewMode = 'summary',
  onOpenSettingsModal,
  className = '',
}) => {
  const [quickText, setQuickText] = useState('');
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes');
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Long press timer tracking
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  // Clear selections when changing tabs
  useEffect(() => {
    setSelectedNoteIds([]);
  }, [activeTab]);

  // Close folder dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when search mode opens
  useEffect(() => {
    if (isSearchMode) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchMode]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickText.trim();
    if (text) {
      onNewNote({ content: `<p>${text}</p><p><br></p>` });
      setQuickText('');
    } else {
      onNewNote();
    }
  };

  const activeNotes = notes.filter((n) => !n.deletedAt);
  const trashedNotes = notes.filter((n) => Boolean(n.deletedAt));

  const currentNotesList = activeTab === 'notes' ? activeNotes : trashedNotes;

  const filteredNotes = currentNotesList.filter((note) => {
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = !selectedTag || note.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (activeTab === 'notes') {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    } else {
      return (b.deletedAt || 0) - (a.deletedAt || 0);
    }
  });

  // Long press & selection handlers
  const handlePressStart = useCallback((id: string) => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setSelectedNoteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, 450);
  }, []);

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
      // In selection mode: toggle selection
      setSelectedNoteIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      // Normal mode: select note
      onSelectNote(id);
    }
  };

  const handleContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNoteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Check if all currently selected notes are pinned
  const selectedNotes = sortedNotes.filter((n) => selectedNoteIds.includes(n.id));
  const allSelectedPinned =
    selectedNotes.length > 0 && selectedNotes.every((n) => n.pinned);

  // Helper to extract clean plain text from HTML/markdown content
  const getCleanSnippet = (content: string) => {
    if (!content) return '';
    return content
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/#+\s/g, '')
      .replace(/[*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return (
    <aside
      className={`w-80 h-full flex flex-col bg-neutral-50 dark:bg-black border-r border-neutral-200 dark:border-neutral-800 shrink-0 select-none transition-colors duration-200 ${className}`}
    >
      {/* Top Context Action Bar when multi-selection is active */}
      {selectedNoteIds.length > 0 ? (
        <div className="p-3 bg-neutral-900 text-white dark:bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shadow-md transition-all shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedNoteIds([])}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              title="Cancel Selection"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold font-mono">
              {selectedNoteIds.length} Selected
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                if (selectedNoteIds.length === sortedNotes.length) {
                  setSelectedNoteIds([]);
                } else {
                  setSelectedNoteIds(sortedNotes.map((n) => n.id));
                }
              }}
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-medium transition-colors flex items-center"
              title="Toggle Select All"
            >
              <CheckSquare className="w-3.5 h-3.5 inline mr-1" />
              <span>{selectedNoteIds.length === sortedNotes.length ? 'None' : 'All'}</span>
            </button>

            {activeTab === 'notes' ? (
              <>
                <button
                  onClick={() => {
                    onBatchTogglePin?.(selectedNoteIds);
                  }}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title={allSelectedPinned ? 'Unpin Selected' : 'Pin Selected'}
                >
                  <Pin className={`w-3.5 h-3.5 ${allSelectedPinned ? 'fill-current text-blue-400' : ''}`} />
                  <span className="hidden sm:inline">{allSelectedPinned ? 'Unpin' : 'Pin'}</span>
                </button>

                <button
                  onClick={() => {
                    onBatchDelete?.(selectedNoteIds);
                    setSelectedNoteIds([]);
                  }}
                  className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title="Delete Selected Notes"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onBatchRestore?.(selectedNoteIds);
                    setSelectedNoteIds([]);
                  }}
                  className="p-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title="Restore Selected Notes"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restore</span>
                </button>

                <button
                  onClick={() => {
                    onBatchDelete?.(selectedNoteIds);
                    setSelectedNoteIds([]);
                  }}
                  className="p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded transition-colors flex items-center space-x-1 text-xs"
                  title="Delete Permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Standard Header with Gmail-style Folder Dropdown Selector */
        <div className="p-3 sm:p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 relative">
          {isSearchMode ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-black text-white dark:bg-white dark:text-black rounded-md">
                  <Search className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  Search Notes
                </span>
              </div>
              <button
                onClick={onToggleSearchMode}
                className="p-1.5 text-neutral-500 hover:text-black dark:hover:text-white rounded-lg bg-neutral-200/80 dark:bg-neutral-900 transition-colors flex items-center space-x-1 text-xs font-medium"
                title="Close Search"
              >
                <X className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          ) : (
            <>
              {/* Folder Selector Dropdown Button (Gmail Style) */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200/60 dark:hover:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-all text-xs font-bold"
                >
                  <div className="w-5 h-5 rounded bg-black text-white dark:bg-white dark:text-black flex items-center justify-center p-0.5">
                    <MarkdownLogo className="w-3.5 h-3.5" />
                  </div>
                  <span>{activeTab === 'notes' ? 'Notes' : 'Trash'}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 font-mono text-neutral-600 dark:text-neutral-300">
                    {activeTab === 'notes' ? activeNotes.length : trashedNotes.length}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isFolderDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isFolderDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                    <button
                      onClick={() => {
                        setActiveTab('notes');
                        setIsFolderDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors ${
                        activeTab === 'notes' ? 'font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/40' : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-neutral-500" />
                        <span>Notes</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800">
                        {activeNotes.length}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('trash');
                        setIsFolderDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors ${
                        activeTab === 'trash' ? 'font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-800/40' : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Trash2 className="w-4 h-4 text-neutral-500" />
                        <span>Trash</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-red-600 dark:text-red-400">
                        {trashedNotes.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons: Search & Settings */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={onToggleSearchMode}
                  title="Search & Filter Notes"
                  className="p-1.5 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-900 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  onClick={onOpenSettingsModal}
                  title="Open Settings"
                  className="p-1.5 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-900 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SEARCH MODE VIEW */}
      {isSearchMode ? (
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-100/50 dark:bg-neutral-900/30 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by title, text, or #tag..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-black dark:focus:border-white shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Filter by Tag
                </span>
                {selectedTag && (
                  <button
                    onClick={() => onSelectTag(null)}
                    className="text-[10px] text-neutral-500 hover:text-black dark:hover:text-white underline font-medium"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                <button
                  onClick={() => onSelectTag(null)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    selectedTag === null
                      ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                      : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200'
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onSelectTag(tag === selectedTag ? null : tag)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      selectedTag === tag
                        ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* NORMAL VIEW: Immediate Note Creator */
        <div className="p-3 space-y-2 shrink-0">
          <form onSubmit={handleQuickSubmit} className="relative flex items-center">
            <Plus className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
            <input
              ref={quickInputRef}
              type="text"
              placeholder="Type to start a new note..."
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-black dark:focus:border-white shadow-2xs transition-all"
            />
            {quickText.trim() ? (
              <button
                type="submit"
                title="Create Note"
                className="absolute right-2 p-1 bg-black text-white dark:bg-white dark:text-black rounded hover:opacity-80 transition-opacity"
              >
                <CornerDownLeft className="w-3 h-3" />
              </button>
            ) : (
              <span className="absolute right-2.5 text-[10px] text-neutral-400 font-mono pointer-events-none">
                ↵
              </span>
            )}
          </form>
        </div>
      )}

      {/* Notes / Trash List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                  {isSearchMode ? 'No matching notes found' : 'No notes yet'}
                </p>
              </>
            )}
          </div>
        ) : (
          sortedNotes.map((note) => {
            const isActive = note.id === activeNoteId;
            const isSelected = selectedNoteIds.includes(note.id);
            const noteTitle = note.title ? note.title.trim() : '';
            const cleanSnippet = getCleanSnippet(note.content);

            const formattedDate = new Date(note.createdAt || note.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={note.id}
                onMouseDown={() => handlePressStart(note.id)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={() => handlePressStart(note.id)}
                onTouchEnd={handlePressEnd}
                onContextMenu={(e) => handleContextMenu(note.id, e)}
                onClick={() => handleNoteClick(note.id)}
                className={`group relative p-2.5 rounded-lg border cursor-pointer transition-all flex items-start space-x-2.5 ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 text-blue-950 dark:text-blue-100 shadow-2xs'
                    : isActive
                    ? 'bg-white dark:bg-neutral-900 border-black dark:border-white text-black dark:text-white shadow-2xs'
                    : 'bg-transparent border-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900/60'
                }`}
              >
                {/* Checkbox indicator in selection mode */}
                {selectedNoteIds.length > 0 && (
                  <div className="shrink-0 pt-0.5">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-neutral-400 dark:border-neutral-600 bg-white dark:bg-neutral-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    {/* Render Title if present */}
                    {noteTitle ? (
                      <h3 className="text-xs font-bold truncate flex-1 min-w-0">
                        {noteTitle}
                      </h3>
                    ) : (
                      /* If NO title, display rendered preview directly as paragraph text */
                      <div className="flex-1 min-w-0">
                        <NotePreview
                          content={note.content}
                          isFullMode={noteListPreviewMode === 'full'}
                        />
                      </div>
                    )}

                    {/* Static Pin Icon indicator if note is pinned */}
                    {note.pinned && activeTab === 'notes' && (
                      <Pin className="w-3 h-3 text-neutral-500 dark:text-neutral-400 fill-current shrink-0 ml-1" />
                    )}
                  </div>

                  {/* Show snippet on second line if note HAS a title */}
                  {noteTitle && (
                    <div className="mt-1">
                      <NotePreview
                        content={note.content}
                        isFullMode={noteListPreviewMode === 'full'}
                      />
                    </div>
                  )}

                  {/* Footer line with date / tags ONLY for notes tab (NOT for trash list) */}
                  {activeTab === 'notes' && (showDates || (isSearchMode && note.tags.length > 0)) && (
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80">
                      {showDates ? (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                          {formattedDate}
                        </span>
                      ) : <span />}

                      {isSearchMode && note.tags.length > 0 && (
                        <div className="flex items-center space-x-1 overflow-hidden max-w-[130px]">
                          {note.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[9px] font-mono px-1.5 py-0.2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded truncate"
                            >
                              #{t}
                            </span>
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
