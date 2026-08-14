import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  Trash2,
  X,
  FileCode,
  Settings,
  CornerDownLeft,
  RotateCcw,
  ArchiveX,
} from 'lucide-react';
import { Note } from '../types';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: (initialTitle?: string) => void;
  onDeleteNote: (id: string, e: React.MouseEvent) => void;
  onRestoreNote: (id: string, e: React.MouseEvent) => void;
  onEmptyTrash: () => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  allTags: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSearchMode: boolean;
  onToggleSearchMode: () => void;
  showDates: boolean;
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
  selectedTag,
  onSelectTag,
  allTags,
  searchQuery,
  onSearchChange,
  isSearchMode,
  onToggleSearchMode,
  showDates,
  onOpenSettingsModal,
  className = '',
}) => {
  const [quickTitle, setQuickTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'notes' | 'trash'>('notes');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);

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
    if (quickTitle.trim()) {
      onNewNote(quickTitle.trim());
      setQuickTitle('');
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

  return (
    <aside
      className={`w-80 h-full flex flex-col bg-neutral-50 dark:bg-black border-r border-neutral-200 dark:border-neutral-800 shrink-0 select-none transition-colors duration-200 ${className}`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
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
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-2xs">
                <FileCode className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm tracking-tight leading-none">
                  Notes
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {/* Search Toggle Icon */}
              <button
                onClick={onToggleSearchMode}
                title="Search & Filter Notes"
                className="p-2 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-900 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Settings Icon */}
              <button
                onClick={onOpenSettingsModal}
                title="Open Settings"
                className="p-2 text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-200/80 dark:hover:bg-neutral-900 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tabs Row: Notes vs Trash */}
      <div className="flex items-center px-3 pt-2 pb-1 gap-1 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
            activeTab === 'notes'
              ? 'bg-neutral-200/80 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-bold'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-300/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono">
            {activeNotes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-colors flex items-center justify-center space-x-1.5 ${
            activeTab === 'trash'
              ? 'bg-neutral-200/80 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-bold'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Trash</span>
          {trashedNotes.length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-mono">
              {trashedNotes.length}
            </span>
          )}
        </button>
      </div>

      {/* SEARCH MODE VIEW */}
      {isSearchMode ? (
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-3 bg-neutral-100/50 dark:bg-neutral-900/30">
          {/* Active Search Input */}
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

          {/* Tags List Filter in Search Mode */}
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
        <div className="p-3 space-y-2">
          <form onSubmit={handleQuickSubmit} className="relative flex items-center">
            <Plus className="w-4 h-4 absolute left-3 text-neutral-400 pointer-events-none" />
            <input
              ref={quickInputRef}
              type="text"
              placeholder="Type to start a new note..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-black dark:focus:border-white shadow-2xs transition-all"
            />
            {quickTitle.trim() ? (
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
            const formattedDate = new Date(note.deletedAt || note.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const previewSnippet = note.content
              .replace(/#+\s/g, '')
              .replace(/[*_~`]/g, '')
              .trim()
              .slice(0, 70);

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`group relative p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white dark:bg-neutral-900 border-black dark:border-white text-black dark:text-white shadow-2xs'
                    : 'bg-transparent border-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-xs font-bold truncate pr-16">
                    {note.title || 'Untitled Note'}
                  </h3>

                  <div className="absolute right-2 top-2 flex items-center space-x-0.5 z-10">
                    {activeTab === 'trash' ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onRestoreNote(note.id, e);
                          }}
                          title="Restore Note"
                          className="p-1 text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteNote(note.id, e);
                          }}
                          title="Permanently Delete Note"
                          className="p-1 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onTogglePin(note.id, e);
                          }}
                          title={note.pinned ? 'Unpin note' : 'Pin note'}
                          className={`p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-opacity ${
                            note.pinned
                              ? 'text-black dark:text-white opacity-100'
                              : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-current' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteNote(note.id, e);
                          }}
                          title="Move to Trash"
                          className="p-1 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1 font-normal leading-normal">
                  {previewSnippet || <span className="italic text-neutral-400">Empty note...</span>}
                </p>

                {/* Footer line */}
                {(showDates || activeTab === 'trash' || (isSearchMode && note.tags.length > 0)) && (
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80">
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                      {activeTab === 'trash' ? `Deleted ${formattedDate}` : formattedDate}
                    </span>

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
            );
          })
        )}
      </div>
    </aside>
  );
};
