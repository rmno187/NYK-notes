import React, { useRef, useState, useEffect } from 'react';
import { X, Check, FolderOpen } from 'lucide-react';
import { Note, EditorMode, StorageMode, Theme, NoteType } from '../../types';
import { slugify, getNoteBaseName } from '../../lib/noteUtils';

interface OptionsSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  allTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onChangeAuthor?: (author: string) => void;
  allAuthors?: string[];
  onChangeProject?: (project: string) => void;
  allProjects?: string[];
  onToggleFeatured?: () => void;
  onChangeType?: (type: NoteType) => void;
  onChangeSlug?: (slug: string) => void;
  onChangeStatus?: (status: string) => void;
  onChangeYear?: (year: number | string) => void;
  onChangeUrl?: (url: string) => void;
  onChangeGithub?: (github: string) => void;
  onChangeOrder?: (order: number) => void;
  onTogglePin?: () => void;
  onDeleteNote?: () => void;
  onRestoreNote?: () => void;
  onSaveToLocalFolder?: () => Promise<void> | void;
  onChangeSaveDirectory?: () => Promise<void> | void;
  onRemoveSaveDirectory?: () => Promise<void> | void;
  onRenameFileName?: (newFileName: string) => void;
  mode: EditorMode;
  onSetMode: (mode: EditorMode) => void;
  theme?: Theme;
  onToggleTheme?: () => void;
  storageMode?: StorageMode;
  directoryName?: string;
  onOpenDirectoryModal?: () => void;
  onOpenLocalFolderSyncModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

const PROJECT_STATUSES = ['Active', 'Development', 'Ended'];

export const OptionsSlideout: React.FC<OptionsSlideoutProps> = ({
  isOpen,
  onClose,
  note,
  allTags,
  onAddTag,
  onRemoveTag,
  onChangeAuthor,
  allAuthors = [],
  onChangeProject,
  allProjects = [],
  onToggleFeatured,
  onChangeType,
  onChangeSlug,
  onChangeStatus,
  onChangeYear,
  onChangeUrl,
  onChangeGithub,
  onChangeOrder,
  onTogglePin,
  onDeleteNote,
  onRestoreNote,
  onSaveToLocalFolder,
  onChangeSaveDirectory,
  onRemoveSaveDirectory,
  onRenameFileName,
  mode,
  onSetMode,
  theme,
  onToggleTheme,
  storageMode,
  directoryName,
  onOpenDirectoryModal,
  onOpenLocalFolderSyncModal,
  onOpenBackupModal,
  onOpenImportModal,
  onOpenShortcutsModal,
}) => {
  // Filename State
  const [isEditingFileName, setIsEditingFileName] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  // Tags State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Author State
  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const [authorInput, setAuthorInput] = useState('');
  const [isAuthorDropdownOpen, setIsAuthorDropdownOpen] = useState(false);
  const authorDropdownRef = useRef<HTMLDivElement>(null);
  const authorInputRef = useRef<HTMLInputElement>(null);

  // Project Tag State (for Blog posts)
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectInput, setProjectInput] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Project fields state (when Note is a Project)
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const slugInputRef = useRef<HTMLInputElement>(null);

  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const [isEditingYear, setIsEditingYear] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const yearInputRef = useRef<HTMLInputElement>(null);

  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [isEditingGithub, setIsEditingGithub] = useState(false);
  const [githubInput, setGithubInput] = useState('');
  const githubInputRef = useRef<HTMLInputElement>(null);

  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [orderInput, setOrderInput] = useState('');
  const orderInputRef = useRef<HTMLInputElement>(null);

  // Reset states on note change
  useEffect(() => {
    setIsAddingTag(false);
    setTagInput('');
    setIsTagDropdownOpen(false);

    setIsAddingAuthor(false);
    setAuthorInput('');
    setIsAuthorDropdownOpen(false);

    setIsAddingProject(false);
    setProjectInput('');
    setIsProjectDropdownOpen(false);

    setIsEditingSlug(false);
    setSlugInput('');

    setIsEditingStatus(false);
    setStatusDropdownOpen(false);

    setIsEditingYear(false);
    setYearInput('');

    setIsEditingUrl(false);
    setUrlInput('');

    setIsEditingGithub(false);
    setGithubInput('');

    setIsEditingOrder(false);
    setOrderInput('');

    setIsEditingFileName(false);
    setFileNameInput('');
  }, [note.id]);

  useEffect(() => {
    if (isEditingFileName && fileNameInputRef.current) fileNameInputRef.current.focus();
  }, [isEditingFileName]);

  useEffect(() => {
    if (isAddingTag && tagInputRef.current) tagInputRef.current.focus();
  }, [isAddingTag]);

  useEffect(() => {
    if (isAddingAuthor && authorInputRef.current) authorInputRef.current.focus();
  }, [isAddingAuthor]);

  useEffect(() => {
    if (isAddingProject && projectInputRef.current) projectInputRef.current.focus();
  }, [isAddingProject]);

  useEffect(() => {
    if (isEditingSlug && slugInputRef.current) slugInputRef.current.focus();
  }, [isEditingSlug]);

  useEffect(() => {
    if (isEditingYear && yearInputRef.current) yearInputRef.current.focus();
  }, [isEditingYear]);

  useEffect(() => {
    if (isEditingUrl && urlInputRef.current) urlInputRef.current.focus();
  }, [isEditingUrl]);

  useEffect(() => {
    if (isEditingGithub && githubInputRef.current) githubInputRef.current.focus();
  }, [isEditingGithub]);

  useEffect(() => {
    if (isEditingOrder && orderInputRef.current) orderInputRef.current.focus();
  }, [isEditingOrder]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(target)) {
        setIsTagDropdownOpen(false);
        setIsAddingTag(false);
        setTagInput('');
      }
      if (authorDropdownRef.current && !authorDropdownRef.current.contains(target)) {
        setIsAuthorDropdownOpen(false);
        setIsAddingAuthor(false);
        setAuthorInput('');
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setIsProjectDropdownOpen(false);
        setIsAddingProject(false);
        setProjectInput('');
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusDropdownOpen(false);
        setIsEditingStatus(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Tags filter
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
    setIsAddingTag(false);
    setIsTagDropdownOpen(false);
  };

  // Author filter & handling
  const cleanTypedAuthor = authorInput.trim();
  const availableExistingAuthors = allAuthors.filter((a) => {
    if (note.author && a.toLowerCase() === note.author.toLowerCase()) return false;
    if (!cleanTypedAuthor) return true;
    return a.toLowerCase().includes(cleanTypedAuthor.toLowerCase());
  });

  const handleSetAuthor = (authorToSet: string) => {
    const clean = authorToSet.trim();
    onChangeAuthor?.(clean);
    setAuthorInput('');
    setIsAddingAuthor(false);
    setIsAuthorDropdownOpen(false);
  };

  // Project filter & handling for Blog posts
  const cleanTypedProject = projectInput.trim();
  const availableExistingProjects = allProjects.filter((p) => {
    if (note.project && p.toLowerCase() === note.project.toLowerCase()) return false;
    if (!cleanTypedProject) return true;
    return p.toLowerCase().includes(cleanTypedProject.toLowerCase());
  });

  const handleSetProject = (projectToSet: string) => {
    const clean = projectToSet.trim();
    onChangeProject?.(clean);
    setProjectInput('');
    setIsAddingProject(false);
    setIsProjectDropdownOpen(false);
  };

  const handleSaveSlug = () => {
    const clean = slugInput.trim() ? slugify(slugInput.trim()) : slugify(note.title || '');
    onChangeSlug?.(clean);
    setIsEditingSlug(false);
    setSlugInput('');
  };

  const handleSaveStatus = (st: string) => {
    onChangeStatus?.(st);
    setIsEditingStatus(false);
    setStatusDropdownOpen(false);
  };

  const handleSaveYear = () => {
    const parsed = parseInt(yearInput.trim(), 10);
    if (!isNaN(parsed)) {
      onChangeYear?.(parsed);
    } else if (yearInput.trim() === '') {
      onChangeYear?.('');
    }
    setIsEditingYear(false);
    setYearInput('');
  };

  const handleSaveUrl = () => {
    onChangeUrl?.(urlInput.trim());
    setIsEditingUrl(false);
    setUrlInput('');
  };

  const handleSaveGithub = () => {
    onChangeGithub?.(githubInput.trim());
    setIsEditingGithub(false);
    setGithubInput('');
  };

  const handleSaveOrder = () => {
    const parsed = parseInt(orderInput.trim(), 10);
    onChangeOrder?.(isNaN(parsed) ? 1 : parsed);
    setIsEditingOrder(false);
    setOrderInput('');
  };

  const handleSaveFileName = () => {
    let clean = fileNameInput.trim();
    if (clean) {
      if (!clean.endsWith('.md')) {
        clean = `${clean.replace(/\.(markdown|txt)$/i, '')}.md`;
      }
      onRenameFileName?.(clean);
    }
    setIsEditingFileName(false);
    setFileNameInput('');
  };

  const currentBaseName = getNoteBaseName(note);
  const currentFileName = note.fileName || `${currentBaseName}.md`;

  const noteTypeLabel =
    note.type === 'project' ? 'Project' : note.type === 'post' ? 'Blog post' : 'Note';

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
          {/* TAGS SECTION */}
          <section className="pb-5">
            <div className="flex items-center justify-between mb-3 min-h-[26px]">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">Tags</span>

              {/* Add tag trigger / Inline input */}
              <div ref={tagDropdownRef} className="relative">
                {!isAddingTag ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTag(true);
                      setIsTagDropdownOpen(true);
                    }}
                    className="text-xs text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white transition-colors"
                  >
                    Add tag
                  </button>
                ) : (
                  <div className="relative flex items-center">
                    <input
                      ref={tagInputRef}
                      type="text"
                      placeholder="Tag name..."
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
                          setIsAddingTag(false);
                          setIsTagDropdownOpen(false);
                          setTagInput('');
                        }
                      }}
                      className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-28 sm:w-36 text-right transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTag(false);
                        setIsTagDropdownOpen(false);
                        setTagInput('');
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Tag Dropdown */}
                {isAddingTag && isTagDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 max-h-48 overflow-y-auto">
                    {availableExistingTags.length > 0 && (
                      <div className="py-1">
                        <div className="px-3 py-1.5 text-[10px] tracking-widest text-neutral-400 dark:text-neutral-600">
                          EXISTING
                        </div>
                        {availableExistingTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTag(tag)}
                            className="w-full px-3 py-1.5 text-left text-xs text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
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
                        className="w-full px-3 py-2 text-left text-xs text-black dark:text-white border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                      >
                        Add <span className="underline underline-offset-2">#{cleanTypedTag}</span>
                      </button>
                    )}

                    {availableExistingTags.length === 0 &&
                      (!cleanTypedTag || note.tags.includes(cleanTypedTag)) && (
                        <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">
                          Type a tag to create one
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Tags */}
            {note.tags.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-2">
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
              <p className="text-xs text-neutral-400 dark:text-neutral-600">No tags</p>
            )}
          </section>

          {/* NOTE / BLOG POST / PROJECT SECTION */}
          <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">
                {noteTypeLabel}
              </span>

              {onChangeType && (
                <div className="flex items-center gap-2">
                  {note.type !== 'note' && (
                    <button
                      type="button"
                      onClick={() => onChangeType('note')}
                      className="text-[11px] text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-2 transition-colors"
                    >
                      Convert to note
                    </button>
                  )}
                  {note.type !== 'post' && (
                    <button
                      type="button"
                      onClick={() => onChangeType('post')}
                      className="text-[11px] text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-2 transition-colors"
                    >
                      Convert to post
                    </button>
                  )}
                  {note.type !== 'project' && (
                    <button
                      type="button"
                      onClick={() => onChangeType('project')}
                      className="text-[11px] text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-2 transition-colors"
                    >
                      Convert to project
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col">
              {/* BLOG POST FIELDS */}
              {note.type === 'post' && (
                <>
                  {/* AUTHOR */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">Author</span>

                    <div ref={authorDropdownRef} className="relative">
                      {!isAddingAuthor ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthorInput(note.author || '');
                            setIsAddingAuthor(true);
                            setIsAuthorDropdownOpen(true);
                          }}
                          className={`text-xs transition-colors hover:underline underline-offset-2 flex items-center gap-1.5 ${
                            note.author
                              ? 'text-black dark:text-white font-medium'
                              : 'text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          {note.author || 'Add author'}
                        </button>
                      ) : (
                        <div className="relative flex items-center">
                          <input
                            ref={authorInputRef}
                            type="text"
                            placeholder="Author name..."
                            value={authorInput}
                            onChange={(e) => {
                              setAuthorInput(e.target.value);
                              setIsAuthorDropdownOpen(true);
                            }}
                            onFocus={() => setIsAuthorDropdownOpen(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSetAuthor(cleanTypedAuthor);
                              } else if (e.key === 'Escape') {
                                setIsAddingAuthor(false);
                                setIsAuthorDropdownOpen(false);
                                setAuthorInput('');
                              }
                            }}
                            className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-28 sm:w-36 text-right transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingAuthor(false);
                              setIsAuthorDropdownOpen(false);
                              setAuthorInput('');
                            }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Author Dropdown */}
                      {isAddingAuthor && isAuthorDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 max-h-48 overflow-y-auto">
                          {availableExistingAuthors.length > 0 && (
                            <div className="py-1">
                              <div className="px-3 py-1.5 text-[10px] tracking-widest text-neutral-400 dark:text-neutral-600">
                                EXISTING
                              </div>
                              {availableExistingAuthors.map((auth) => (
                                <button
                                  key={auth}
                                  type="button"
                                  onClick={() => handleSetAuthor(auth)}
                                  className="w-full px-3 py-1.5 text-left text-xs text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                                >
                                  {auth}
                                </button>
                              ))}
                            </div>
                          )}

                          {cleanTypedAuthor &&
                            (!note.author || cleanTypedAuthor.toLowerCase() !== note.author.toLowerCase()) && (
                              <button
                                type="button"
                                onClick={() => handleSetAuthor(cleanTypedAuthor)}
                                className="w-full px-3 py-2 text-left text-xs text-black dark:text-white border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                              >
                                Set author to <span className="underline underline-offset-2 font-medium">"{cleanTypedAuthor}"</span>
                              </button>
                            )}

                          {note.author && (
                            <button
                              type="button"
                              onClick={() => handleSetAuthor('')}
                              className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 transition-colors"
                            >
                              Remove author
                            </button>
                          )}

                          {availableExistingAuthors.length === 0 &&
                            !note.author &&
                            !cleanTypedAuthor && (
                              <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">
                                Type an author name
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PROJECT TAG */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">Project</span>

                    <div ref={projectDropdownRef} className="relative">
                      {!isAddingProject ? (
                        <button
                          type="button"
                          onClick={() => {
                            setProjectInput(note.project || '');
                            setIsAddingProject(true);
                            setIsProjectDropdownOpen(true);
                          }}
                          className={`text-xs transition-colors hover:underline underline-offset-2 flex items-center gap-1.5 ${
                            note.project
                              ? 'text-black dark:text-white font-medium'
                              : 'text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          {note.project || 'Add project'}
                        </button>
                      ) : (
                        <div className="relative flex items-center">
                          <input
                            ref={projectInputRef}
                            type="text"
                            placeholder="Project name/slug..."
                            value={projectInput}
                            onChange={(e) => {
                              setProjectInput(e.target.value);
                              setIsProjectDropdownOpen(true);
                            }}
                            onFocus={() => setIsProjectDropdownOpen(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSetProject(cleanTypedProject);
                              } else if (e.key === 'Escape') {
                                setIsAddingProject(false);
                                setIsProjectDropdownOpen(false);
                                setProjectInput('');
                              }
                            }}
                            className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-28 sm:w-36 text-right transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingProject(false);
                              setIsProjectDropdownOpen(false);
                              setProjectInput('');
                            }}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Project Dropdown */}
                      {isAddingProject && isProjectDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 max-h-48 overflow-y-auto">
                          {availableExistingProjects.length > 0 && (
                            <div className="py-1">
                              <div className="px-3 py-1.5 text-[10px] tracking-widest text-neutral-400 dark:text-neutral-600">
                                EXISTING PROJECTS
                              </div>
                              {availableExistingProjects.map((proj) => (
                                <button
                                  key={proj}
                                  type="button"
                                  onClick={() => handleSetProject(proj)}
                                  className="w-full px-3 py-1.5 text-left text-xs text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                                >
                                  {proj}
                                </button>
                              ))}
                            </div>
                          )}

                          {cleanTypedProject &&
                            (!note.project || cleanTypedProject.toLowerCase() !== note.project.toLowerCase()) && (
                              <button
                                type="button"
                                onClick={() => handleSetProject(cleanTypedProject)}
                                className="w-full px-3 py-2 text-left text-xs text-black dark:text-white border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                              >
                                Set project to <span className="underline underline-offset-2 font-medium">"{cleanTypedProject}"</span>
                              </button>
                            )}

                          {note.project && (
                            <button
                              type="button"
                              onClick={() => handleSetProject('')}
                              className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 transition-colors"
                            >
                              Remove project
                            </button>
                          )}

                          {availableExistingProjects.length === 0 &&
                            !note.project &&
                            !cleanTypedProject && (
                              <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-600">
                                Type a project identifier
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FEATURED */}
                  {onToggleFeatured && (
                    <button
                      type="button"
                      onClick={onToggleFeatured}
                      className="group flex items-center justify-between py-2.5 text-left"
                    >
                      <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                        Featured
                      </span>
                      <span
                        className={`text-xs transition-colors ${
                          note.featured
                            ? 'text-black dark:text-white font-medium underline underline-offset-2'
                            : 'text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {note.featured ? 'Featured' : 'Standard'}
                      </span>
                    </button>
                  )}
                </>
              )}

              {/* PROJECT TYPE FIELDS */}
              {note.type === 'project' && (
                <>
                  {/* SLUG */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">Slug</span>

                    {!isEditingSlug ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSlugInput(note.slug || slugify(note.title || ''));
                          setIsEditingSlug(true);
                        }}
                        className="text-xs text-black dark:text-white font-mono hover:underline underline-offset-2"
                      >
                        {note.slug || slugify(note.title || '') || 'Set slug'}
                      </button>
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          ref={slugInputRef}
                          type="text"
                          placeholder="project-slug..."
                          value={slugInput}
                          onChange={(e) => setSlugInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSlug();
                            } else if (e.key === 'Escape') {
                              setIsEditingSlug(false);
                              setSlugInput('');
                            }
                          }}
                          className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-28 sm:w-36 text-right transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingSlug(false);
                            setSlugInput('');
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* STATUS */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">Status</span>

                    <div ref={statusDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setStatusDropdownOpen((prev) => !prev)}
                        className="text-xs text-black dark:text-white font-medium hover:underline underline-offset-2"
                      >
                        {note.status || 'Active'}
                      </button>

                      {statusDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 py-1">
                          {PROJECT_STATUSES.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleSaveStatus(st)}
                              className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                                (note.status || 'Active') === st
                                  ? 'text-black dark:text-white font-semibold bg-neutral-100 dark:bg-neutral-900'
                                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-950'
                              }`}
                            >
                              <span>{st}</span>
                              {(note.status || 'Active') === st && <Check className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* YEAR */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">Year</span>

                    {!isEditingYear ? (
                      <button
                        type="button"
                        onClick={() => {
                          setYearInput(note.year !== undefined ? String(note.year) : String(new Date().getFullYear()));
                          setIsEditingYear(true);
                        }}
                        className="text-xs text-black dark:text-white font-mono hover:underline underline-offset-2"
                      >
                        {note.year !== undefined ? note.year : new Date().getFullYear()}
                      </button>
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          ref={yearInputRef}
                          type="number"
                          placeholder="2026"
                          value={yearInput}
                          onChange={(e) => setYearInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveYear();
                            } else if (e.key === 'Escape') {
                              setIsEditingYear(false);
                              setYearInput('');
                            }
                          }}
                          className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-20 text-right transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingYear(false);
                            setYearInput('');
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* URL */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">URL</span>

                    {!isEditingUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          setUrlInput(note.url || '');
                          setIsEditingUrl(true);
                        }}
                        className={`text-xs transition-colors hover:underline underline-offset-2 max-w-[160px] truncate ${
                          note.url
                            ? 'text-black dark:text-white font-mono'
                            : 'text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {note.url || 'Add URL'}
                      </button>
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          ref={urlInputRef}
                          type="url"
                          placeholder="https://..."
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveUrl();
                            } else if (e.key === 'Escape') {
                              setIsEditingUrl(false);
                              setUrlInput('');
                            }
                          }}
                          className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-32 sm:w-44 text-right transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingUrl(false);
                            setUrlInput('');
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* GITHUB */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">GitHub</span>

                    {!isEditingGithub ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGithubInput(note.github || '');
                          setIsEditingGithub(true);
                        }}
                        className={`text-xs transition-colors hover:underline underline-offset-2 max-w-[160px] truncate ${
                          note.github
                            ? 'text-black dark:text-white font-mono'
                            : 'text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {note.github || 'Add GitHub'}
                      </button>
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          ref={githubInputRef}
                          type="url"
                          placeholder="https://github.com/..."
                          value={githubInput}
                          onChange={(e) => setGithubInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveGithub();
                            } else if (e.key === 'Escape') {
                              setIsEditingGithub(false);
                              setGithubInput('');
                            }
                          }}
                          className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-32 sm:w-44 text-right transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingGithub(false);
                            setGithubInput('');
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ORDER */}
                  <div className="group flex items-center justify-between py-2.5 min-h-[38px]">
                    <span className="text-sm text-black dark:text-white">Order</span>

                    {!isEditingOrder ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderInput(note.order !== undefined ? String(note.order) : '1');
                          setIsEditingOrder(true);
                        }}
                        className="text-xs text-black dark:text-white font-mono hover:underline underline-offset-2"
                      >
                        {note.order !== undefined ? note.order : 1}
                      </button>
                    ) : (
                      <div className="relative flex items-center">
                        <input
                          ref={orderInputRef}
                          type="number"
                          placeholder="1"
                          value={orderInput}
                          onChange={(e) => setOrderInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveOrder();
                            } else if (e.key === 'Escape') {
                              setIsEditingOrder(false);
                              setOrderInput('');
                            }
                          }}
                          className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-5 text-xs text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-16 text-right transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingOrder(false);
                            setOrderInput('');
                          }}
                          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black dark:hover:text-white"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* PIN (NOTES ONLY - HIDDEN FOR BLOG POSTS AND PROJECTS) */}
              {note.type !== 'post' && note.type !== 'project' && onTogglePin && (
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
                      Restore {noteTypeLabel.toLowerCase()}
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
                <div className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSaveToLocalFolder();
                        onClose();
                      }}
                      className="group flex items-center gap-1.5 text-left shrink-0"
                      title={
                        note.localFolderName || directoryName
                          ? `Save note to folder "${note.localFolderName || directoryName}"`
                          : 'Save note to local device'
                      }
                    >
                      <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                        Save
                      </span>
                    </button>

                    {(note.localFolderName || directoryName) ? (
                      <div className="flex items-center gap-2 max-w-[210px]">
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenLocalFolderSyncModal) {
                              onOpenLocalFolderSyncModal();
                              onClose();
                            } else if (onChangeSaveDirectory) {
                              onChangeSaveDirectory();
                            } else if (onOpenDirectoryModal) {
                              onOpenDirectoryModal();
                              onClose();
                            }
                          }}
                          className="flex items-center gap-1 text-xs font-mono text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-2 truncate"
                          title={`Save folder: ${note.localFolderName || directoryName}. Click to change.`}
                        >
                          <FolderOpen className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                          <span className="truncate">{note.localFolderName || directoryName}</span>
                        </button>
                        {onRemoveSaveDirectory && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSaveDirectory();
                            }}
                            className="text-[11px] text-neutral-400 hover:text-red-600 dark:hover:text-red-400 underline underline-offset-2 shrink-0 transition-colors"
                            title="Remove save location folder"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenLocalFolderSyncModal) {
                            onOpenLocalFolderSyncModal();
                            onClose();
                          } else {
                            onSaveToLocalFolder();
                            onClose();
                          }
                        }}
                        className="text-xs text-neutral-400 dark:text-neutral-600 hover:text-black dark:hover:text-white"
                      >
                        Save to local device
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* NOTE INFORMATION */}
          <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">
            <div className="mb-3">
              <span className="text-xs font-medium tracking-wide text-black dark:text-white">Information</span>
            </div>

            <div className="space-y-2 text-xs">
              {/* File Name with rename support */}
              <div className="flex items-center justify-between gap-2 min-h-[26px]">
                <span className="text-neutral-500 dark:text-neutral-500 shrink-0">File</span>
                {!isEditingFileName ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-black dark:text-white font-mono text-[11px] truncate max-w-[190px]" title={currentFileName}>
                      {currentFileName}
                    </span>
                    {onRenameFileName && (
                      <button
                        type="button"
                        onClick={() => {
                          setFileNameInput(currentFileName);
                          setIsEditingFileName(true);
                        }}
                        className="text-[10px] text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-2 shrink-0"
                        title="Rename file and sync assets"
                      >
                        Rename
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative flex items-center">
                    <input
                      ref={fileNameInputRef}
                      type="text"
                      placeholder="filename.md"
                      value={fileNameInput}
                      onChange={(e) => setFileNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveFileName();
                        } else if (e.key === 'Escape') {
                          setIsEditingFileName(false);
                          setFileNameInput('');
                        }
                      }}
                      className="font-mono bg-transparent border-b border-black dark:border-white py-0.5 pr-10 text-[11px] text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none w-44 text-right transition-colors"
                    />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSaveFileName}
                        className="text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                        title="Save rename"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingFileName(false);
                          setFileNameInput('');
                        }}
                        className="text-neutral-400 hover:text-black dark:hover:text-white"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

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

              {/* Blog Repo & Folder Sync */}
              {onOpenLocalFolderSyncModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenLocalFolderSyncModal();
                    onClose();
                  }}
                  className="group flex items-center justify-between py-2.5 text-left"
                >
                  <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                    Blog Sync (Local)
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-600 max-w-[150px] truncate">
                    posts / projects / notes
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
