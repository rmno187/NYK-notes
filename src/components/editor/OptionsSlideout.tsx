import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Note, EditorMode, StorageMode, Theme } from '../../types';

interface OptionsSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  allTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onChangeAuthor?: (author: string) => void;
  onToggleFeatured?: () => void;
  onChangeType?: (type: 'note' | 'post') => void;
  onTogglePin?: () => void;
  onDeleteNote?: () => void;
  onRestoreNote?: () => void;
  onSaveToLocalFolder?: () => Promise<void> | void;
  mode: EditorMode;
  onSetMode: (mode: EditorMode) => void;
  theme?: Theme;
  onToggleTheme?: () => void;
  storageMode?: StorageMode;
  directoryName?: string;
  onOpenDirectoryModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

export const OptionsSlideout: React.FC<OptionsSlideoutProps> = ({
  isOpen,
  onClose,
  note,
  allTags,
  onAddTag,
  onRemoveTag,
  onChangeAuthor,
  onToggleFeatured,
  onChangeType,
  onTogglePin,
  onDeleteNote,
  onRestoreNote,
  onSaveToLocalFolder,
  mode,
  onSetMode,
  theme,
  onToggleTheme,
  storageMode,
  directoryName,
  onOpenDirectoryModal,
  onOpenBackupModal,
  onOpenImportModal,
  onOpenShortcutsModal,
}) => {
  const [tagInput, setTagInput] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTagInput('');
    setIsTagDropdownOpen(false);
  }, [note.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const cleanTypedTag = tagInput.trim().replace(/^#/, '').toLowerCase();
  const availableExistingTags = allTags.filter((t) => {
    if (note.tags.includes(t)) return false;
    if (!cleanTypedTag) return true;
    return t.toLowerCase().includes(cleanTypedTag);
  });

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '').toLowerCase();
    if (clean && !note.tags.includes(clean)) {
      onAddTag(clean);
    }
    setTagInput('');
    setIsTagDropdownOpen(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/20 dark:bg-black/50 z-30 transition-opacity backdrop-blur-[1px]"
      />

      {/* Minimal Slideout Drawer */}
      <div className="absolute inset-y-0 right-0 w-80 sm:w-96 max-w-[92vw] bg-white dark:bg-black border-l border-neutral-200 dark:border-neutral-800 z-40 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <span className="text-sm font-medium tracking-wide text-black dark:text-white">Options</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {/* TAGS */}
          <section className="pb-7">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">Tags</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-600">{note.tags.length}</span>
            </div>

            {/* Current Tags */}
            {note.tags.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-2 mb-4">
                {note.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs text-black dark:text-white">
                    <span className="underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-700">
                      {tag}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      className="text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                      title={`Remove #${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 dark:text-neutral-600 mb-4">No tags</p>
            )}

            {/* Add Tag */}
            <div ref={tagDropdownRef} className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setIsTagDropdownOpen(true);
                  }}
                  onFocus={() => setIsTagDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (cleanTypedTag) {
                        handleAddTag(cleanTypedTag);
                      }
                    } else if (e.key === 'Escape') {
                      setIsTagDropdownOpen(false);
                    }
                  }}
                  className="w-full font-mono bg-transparent border-b border-neutral-300 dark:border-neutral-700 py-2 pr-7 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                />

                {tagInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setTagInput('');
                      setIsTagDropdownOpen(false);
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Tag Dropdown */}
              {isTagDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 max-h-48 overflow-y-auto">
                  {availableExistingTags.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-2 text-[10px] tracking-widest text-neutral-400 dark:text-neutral-600">
                        EXISTING
                      </div>
                      {availableExistingTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleAddTag(tag)}
                          className="w-full px-3 py-2 text-left text-xs text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {cleanTypedTag && !note.tags.includes(cleanTypedTag) && (
                    <button
                      type="button"
                      onClick={() => handleAddTag(cleanTypedTag)}
                      className="w-full px-3 py-2.5 text-left text-xs text-black dark:text-white border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                    >
                      Add <span className="underline underline-offset-2">#{cleanTypedTag}</span>
                    </button>
                  )}

                  {availableExistingTags.length === 0 &&
                    (!cleanTypedTag || note.tags.includes(cleanTypedTag)) && (
                      <div className="px-3 py-3 text-xs text-neutral-400 dark:text-neutral-600">
                        Type a tag to create one.
                      </div>
                    )}
                </div>
              )}
            </div>
          </section>

          {/* AUTHOR (BLOG POST ONLY) */}
          {note.type === 'post' && (
            <section className="border-t border-neutral-200 dark:border-neutral-800 py-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium tracking-wide text-black dark:text-white">Author</span>
              </div>
              <input
                type="text"
                placeholder="Author name (optional)"
                value={note.author || ''}
                onChange={(e) => onChangeAuthor?.(e.target.value)}
                className="w-full font-mono bg-transparent border-b border-neutral-300 dark:border-neutral-700 py-2 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
              />
            </section>
          )}

          {/* FEATURED POST (BLOG POST ONLY) */}
          {note.type === 'post' && (
            <section className="border-t border-neutral-200 dark:border-neutral-800 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium tracking-wide text-black dark:text-white block">
                    Featured post
                  </span>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-600">Highlight in blog list</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleFeatured}
                  className={`px-3 py-1 text-xs font-mono border transition-colors ${
                    note.featured
                      ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                      : 'bg-transparent text-neutral-500 border-neutral-300 dark:border-neutral-700 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {note.featured ? 'Featured' : 'Standard'}
                </button>
              </div>
            </section>
          )}

          {/* NOTE ACTIONS */}
          <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">
                {note.type === 'post' ? 'Blog post' : 'Note'}
              </span>

              {onChangeType && (
                <button
                  type="button"
                  onClick={() => onChangeType(note.type === 'post' ? 'note' : 'post')}
                  className="text-[11px] text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-2 transition-colors"
                >
                  {note.type === 'post' ? 'Convert to note' : 'Convert to blog post'}
                </button>
              )}
            </div>

            <div className="flex flex-col">
              {onTogglePin && (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    {note.pinned ? 'Unpin' : 'Pin'}
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600">
                    {note.pinned ? 'Unpin from top' : 'Pin to top'}
                  </span>
                </button>
              )}

              {note.deletedAt ? (
                onRestoreNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreNote();
                      onClose();
                    }}
                    className="group flex items-center justify-between py-2.5 text-left"
                  >
                    <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                      Restore
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-600">
                      Restore {note.type === 'post' ? 'post' : 'note'}
                    </span>
                  </button>
                )
              ) : (
                onDeleteNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteNote();
                      onClose();
                    }}
                    className="group flex items-center justify-between py-2.5 text-left"
                  >
                    <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                      Delete
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-600">Move to trash</span>
                  </button>
                )
              )}

              {onSaveToLocalFolder && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveToLocalFolder();
                    onClose();
                  }}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Save
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600">Save to local device</span>
                </button>
              )}
            </div>
          </section>

          {/* NOTE INFORMATION */}
          <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">
            <div className="mb-3">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">Information</span>
            </div>

            <div className="space-y-2 text-xs">
              {note.type === 'post' && (
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-500 dark:text-neutral-500">Date</span>
                  <span className="text-black dark:text-white text-right">
                    {note.date ||
                      new Date(note.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                  </span>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500 dark:text-neutral-500">Created</span>
                <span className="text-black dark:text-white text-right">
                  {new Date(note.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500 dark:text-neutral-500">Edited</span>
                <span className="text-black dark:text-white text-right">
                  {new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500 dark:text-neutral-500">Words</span>
                <span className="text-black dark:text-white">
                  {note.content.trim() ? note.content.trim().split(/\s+/).length : 0}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500 dark:text-neutral-500">Characters</span>
                <span className="text-black dark:text-white">{note.content.length}</span>
              </div>
            </div>
          </section>

          {/* APP SETTINGS */}
          <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">
            <div className="mb-3">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">Settings</span>
            </div>

            <div className="flex flex-col">
              {/* Editor */}
              <button
                type="button"
                onClick={() => onSetMode(mode === 'wysiwyg' ? 'markdown' : 'wysiwyg')}
                className="group flex items-center justify-between py-2.5 text-left"
              >
                <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                  Editor
                </span>
                <span className="text-xs text-neutral-400 dark:text-neutral-600">
                  {mode === 'wysiwyg' ? 'Rich text' : 'Markdown'}
                </span>
              </button>

              {/* Theme */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Theme
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600">
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                </button>
              )}

              {/* Storage */}
              {onOpenDirectoryModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenDirectoryModal();
                    onClose();
                  }}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Storage
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600 max-w-[150px] truncate">
                    {storageMode === 'vercel'
                      ? 'Vercel · Sync'
                      : storageMode === 'filesystem' && directoryName
                      ? directoryName
                      : 'Browser'}
                  </span>
                </button>
              )}

              {/* Backup */}
              {onOpenBackupModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenBackupModal();
                    onClose();
                  }}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Backup
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600">Export</span>
                </button>
              )}

              {/* Import */}
              {onOpenImportModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenImportModal();
                    onClose();
                  }}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Import
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600">
                    Files / Folder / Backup
                  </span>
                </button>
              )}

              {/* Shortcuts */}
              {onOpenShortcutsModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenShortcutsModal();
                    onClose();
                  }}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Keyboard shortcuts
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600">?</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
};
