import React, { useRef, useState, useEffect, useCallback } from 'react';
import { MoreVertical, ArrowLeft, Check, Image as ImageIcon, Sparkles } from 'lucide-react';
import { EditorMode, NoteImage, ImageFolderStrategy } from '../types';
import { renderMarkdownToHtml } from '../lib/markdown';
import { cleanImageFilename, computeRelativeImagePath, readFileAsDataUrl } from '../lib/imageUtils';
import { ActiveFormats, HistoryItem, EditorPaneProps, FormatActionType } from './editor/types';
import { getCaretCharacterOffsetWithin, setCaretCharacterOffsetWithin } from './editor/editorUtils';
import { useWysiwygHandlers } from './editor/useWysiwygHandlers';
import { useMarkdownHandlers } from './editor/useMarkdownHandlers';
import { useKeyboardOffset } from './editor/useKeyboardOffset';
import { EditorToolbar } from './editor/EditorToolbar';
import { OptionsSlideout } from './editor/OptionsSlideout';
import { LinkModal } from './editor/LinkModal';
import { ImageModal } from './editor/ImageModal';

export const EditorPane: React.FC<EditorPaneProps> = ({
  note,
  onChangeTitle,
  onChangeContent,
  onTogglePin,
  onDeleteNote,
  onRestoreNote,
  onAddTag,
  onRemoveTag,
  allTags,
  editorMode: externalEditorMode,
  onChangeEditorMode,
  onToggleEditorMode,
  onBackToList,
  onSaveToLocalFolder,
  onChangeSaveDirectory,
  onRemoveSaveDirectory,
  onRenameFileName,
  toastMessage,
  onChangeDescription,
  onChangeAuthor,
  allAuthors,
  onChangeProject,
  allProjects,
  onToggleFeatured,
  onChangeSlug,
  onChangeStatus,
  onChangeYear,
  onChangeUrl,
  onChangeGithub,
  onChangeOrder,
  onChangeType,
  onAddImage,
  onRemoveImage,
  onChangeImageFolderStrategy,
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
  const [internalEditorMode, setInternalEditorMode] = useState<EditorMode>('wysiwyg');
  const mode = externalEditorMode || internalEditorMode;

  const setMode = (newMode: EditorMode) => {
    setInternalEditorMode(newMode);
    if (onChangeEditorMode) {
      onChangeEditorMode(newMode);
    } else if (onToggleEditorMode) {
      onToggleEditorMode();
    }
  };

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);

  // Link Insertion Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [savedTextareaSel, setSavedTextareaSel] = useState<{ start: number; end: number } | null>(null);

  // Image Modal State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Active formatting state for toolbar highlights
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
    heading: false,
    h2: false,
    bullet: false,
    number: false,
    task: false,
    quote: false,
    code: false,
    link: false,
    image: false,
  });

  // Track selection state for dynamic toolbar (selection mode vs standard mode)
  const [hasTextSelection, setHasTextSelection] = useState(false);

  // Close slideout panel when switching notes
  useEffect(() => {
    setIsSlideoutOpen(false);
  }, [note.id]);

  // History stack for exact granular Undo/Redo
  const historyRef = useRef<HistoryItem[]>([
    { content: note.content, selStart: 0, selEnd: 0, html: renderMarkdownToHtml(note.content, note.images) },
  ]);
  const historyIdxRef = useRef<number>(0);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const prevNoteIdForHistoryRef = useRef<string>(note.id);

  useEffect(() => {
    if (prevNoteIdForHistoryRef.current !== note.id) {
      prevNoteIdForHistoryRef.current = note.id;
      historyRef.current = [
        {
          content: note.content,
          selStart: 0,
          selEnd: 0,
          html: renderMarkdownToHtml(note.content, note.images),
        },
      ];
      historyIdxRef.current = 0;
    }
  }, [note.id, note.content, note.images]);

  const pushHistory = useCallback(
    (newContent: string, selStart?: number, selEnd?: number, customHtml?: string) => {
      if (isUndoRedoActionRef.current) return;
      const current = historyRef.current[historyIdxRef.current];
      if (current && current.content === newContent) return;

      let sStart = selStart;
      let sEnd = selEnd;
      if (sStart === undefined || sEnd === undefined) {
        if (mode === 'markdown' && textareaRef.current) {
          sStart = textareaRef.current.selectionStart;
          sEnd = textareaRef.current.selectionEnd;
        } else if (mode === 'wysiwyg' && wysiwygRef.current) {
          const offset = getCaretCharacterOffsetWithin(wysiwygRef.current);
          sStart = offset;
          sEnd = offset;
        } else {
          sStart = newContent.length;
          sEnd = newContent.length;
        }
      }

      const htmlToStore = customHtml || (wysiwygRef.current ? wysiwygRef.current.innerHTML : undefined);

      const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1);
      trimmed.push({
        content: newContent,
        selStart: sStart,
        selEnd: sEnd,
        html: htmlToStore,
      });
      if (trimmed.length > 500) trimmed.shift();
      historyRef.current = trimmed;
      historyIdxRef.current = trimmed.length - 1;
    },
    [mode]
  );

  const prevNoteIdForHtmlRef = useRef<string>(note.id);

  // Sync note content to WYSIWYG innerHTML when note changes or mode switches
  useEffect(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      const isDifferentNote = prevNoteIdForHtmlRef.current !== note.id;
      prevNoteIdForHtmlRef.current = note.id;

      if (isUndoRedoActionRef.current) return;

      const html = renderMarkdownToHtml(note.content, note.images);
      if (isDifferentNote || document.activeElement !== wysiwygRef.current) {
        wysiwygRef.current.innerHTML = html || '<p><br></p>';
      }
    }
  }, [note.id, note.content, note.images, mode]);

  // Auto-expand textarea height in Markdown mode
  useEffect(() => {
    if (mode === 'markdown' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(350, textareaRef.current.scrollHeight)}px`;
    }
  }, [note.content, mode]);

  const updateSelectionState = useCallback(() => {
    if (mode === 'wysiwyg') {
      if (!wysiwygRef.current) {
        setHasTextSelection(false);
        return;
      }
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const isInside =
          (sel.anchorNode && wysiwygRef.current.contains(sel.anchorNode)) ||
          (sel.focusNode && wysiwygRef.current.contains(sel.focusNode));
        const str = sel.toString();
        setHasTextSelection(Boolean(isInside && str && str.trim().length > 0));
      } else {
        setHasTextSelection(false);
      }
    } else if (mode === 'markdown') {
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const hasSel = typeof start === 'number' && typeof end === 'number' && end > start;
        setHasTextSelection(hasSel);
      } else {
        setHasTextSelection(false);
      }
    }
  }, [mode]);

  // Undo and Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      isUndoRedoActionRef.current = true;
      historyIdxRef.current -= 1;
      const target = historyRef.current[historyIdxRef.current];
      onChangeContent(target.content);

      if (mode === 'wysiwyg' && wysiwygRef.current) {
        const htmlToSet = target.html || renderMarkdownToHtml(target.content, note.images) || '<p><br></p>';
        wysiwygRef.current.innerHTML = htmlToSet;
        wysiwygRef.current.focus();
        setCaretCharacterOffsetWithin(wysiwygRef.current, target.selStart);
      } else if (mode === 'markdown' && textareaRef.current) {
        textareaRef.current.value = target.content;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(target.selStart, target.selEnd);
      }

      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 0);
    }
  }, [onChangeContent, mode, note.images]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      isUndoRedoActionRef.current = true;
      historyIdxRef.current += 1;
      const target = historyRef.current[historyIdxRef.current];
      onChangeContent(target.content);

      if (mode === 'wysiwyg' && wysiwygRef.current) {
        const htmlToSet = target.html || renderMarkdownToHtml(target.content, note.images) || '<p><br></p>';
        wysiwygRef.current.innerHTML = htmlToSet;
        wysiwygRef.current.focus();
        setCaretCharacterOffsetWithin(wysiwygRef.current, target.selStart);
      } else if (mode === 'markdown' && textareaRef.current) {
        textareaRef.current.value = target.content;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(target.selStart, target.selEnd);
      }

      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 0);
    }
  }, [onChangeContent, mode, note.images]);

  // Open Link modal helper
  const handleOpenLinkModal = useCallback(
    (initialText: string, selData: Range | { start: number; end: number } | null) => {
      setLinkText(initialText);
      setLinkUrl('https://');
      if (selData instanceof Range) {
        setSavedRange(selData);
        setSavedTextareaSel(null);
      } else if (selData) {
        setSavedTextareaSel(selData);
        setSavedRange(null);
      } else {
        setSavedRange(null);
        setSavedTextareaSel(null);
      }
      setIsLinkModalOpen(true);
    },
    []
  );

  // Open Image modal helper
  const handleOpenImageModal = useCallback(() => {
    setIsImageModalOpen(true);
  }, []);

  // Modular Hooks
  const {
    checkActiveFormats,
    handleWysiwygInput,
    handleWysiwygClick,
    handleWysiwygPaste,
    handleWysiwygFormatAction,
    handleWysiwygKeyDown,
  } = useWysiwygHandlers({
    wysiwygRef,
    onChangeContent,
    pushHistory,
    handleUndo,
    handleRedo,
    activeFormats,
    setActiveFormats,
    onOpenLinkModal: handleOpenLinkModal,
    onOpenImageModal: handleOpenImageModal,
  });

  const { handleMarkdownFormatAction, handleMarkdownKeyDown } = useMarkdownHandlers({
    textareaRef,
    content: note.content,
    onChangeContent,
    handleUndo,
    handleRedo,
    onOpenLinkModal: handleOpenLinkModal,
    onOpenImageModal: handleOpenImageModal,
  });

  const { isKeyboardOpen, bottomInset } = useKeyboardOffset();

  // Unified formatting trigger
  const handleFormat = (type: FormatActionType) => {
    if (type === 'image') {
      setIsImageModalOpen(true);
      return;
    }
    if (mode === 'wysiwyg') {
      handleWysiwygFormatAction(type);
    } else {
      handleMarkdownFormatAction(type);
    }
  };

  // Submit Link insertion
  const handleApplyLink = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUrl = linkUrl.trim() || 'https://';
    const finalDisplay = linkText.trim() || finalUrl;

    if (mode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.focus();
      if (savedRange) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
      }

      if (savedRange && !savedRange.collapsed) {
        document.execCommand('createLink', false, finalUrl);
      } else {
        document.execCommand(
          'insertHTML',
          false,
          `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${finalDisplay}</a>&nbsp;`
        );
      }
      handleWysiwygInput();
      checkActiveFormats();
    } else if (textareaRef.current && savedTextareaSel) {
      const { start, end } = savedTextareaSel;
      const mdLink = `[${finalDisplay}](${finalUrl})`;
      const newContent = note.content.substring(0, start) + mdLink + note.content.substring(end);
      onChangeContent(newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start + mdLink.length, start + mdLink.length);
        }
      }, 0);
    }

    setIsLinkModalOpen(false);
  };

  // Insert Image into Post (WYSIWYG or Markdown)
  const handleInsertImage = (image: NoteImage, snippet: string) => {
    if (onAddImage) {
      onAddImage(image);
    }

    if (mode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.focus();
      const relativeAttr = `data-relative-path="${image.relativePath || image.name}"`;
      const imgHtml = `<p><img src="${image.dataUrl}" ${relativeAttr} alt="${image.alt || image.name}" class="max-w-full h-auto rounded my-2 border border-neutral-200 dark:border-neutral-800 shadow-sm inline-block"></p><p><br></p>`;

      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && wysiwygRef.current.contains(sel.anchorNode)) {
        document.execCommand('insertHTML', false, imgHtml);
      } else {
        wysiwygRef.current.insertAdjacentHTML('beforeend', imgHtml);
      }
      handleWysiwygInput();
      checkActiveFormats();
    } else if (mode === 'markdown' && textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart ?? note.content.length;
      const end = textarea.selectionEnd ?? note.content.length;
      const before = note.content.substring(0, start);
      const after = note.content.substring(end);
      const separatorBefore = before.length > 0 && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      const separatorAfter = after.length > 0 && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
      const insertion = `${separatorBefore}${snippet}${separatorAfter}`;
      const newContent = before + insertion + after;
      onChangeContent(newContent);
      pushHistory(newContent, start + insertion.length, start + insertion.length);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(start + insertion.length, start + insertion.length);
        }
      }, 10);
    }
  };

  // Drag and drop image files directly into the editor pane
  const handleEditorDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  };

  const handleEditorDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleEditorDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const file = e.dataTransfer.files[0];
    if (!file.type.startsWith('image/')) return;

    e.preventDefault();
    setIsDraggingOver(false);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const cleaned = cleanImageFilename(file.name);
      const relativePath = computeRelativeImagePath(cleaned, note);
      const autoAlt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');

      const newImage: NoteImage = {
        id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleaned,
        dataUrl,
        relativePath,
        alt: autoAlt,
        size: file.size,
        mimeType: file.type,
        createdAt: Date.now(),
      };

      const snippet = `![${newImage.alt}](${newImage.relativePath})`;
      handleInsertImage(newImage, snippet);
    } catch (err) {
      console.error('Failed to handle dropped image:', err);
    }
  };

  // Sync selection changes to update active button styles
  useEffect(() => {
    const handleSelectionChange = () => {
      if (mode === 'wysiwyg') {
        checkActiveFormats();
      }
      updateSelectionState();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [mode, checkActiveFormats, updateSelectionState]);

  const focusContent = useCallback(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.focus({ preventScroll: true });
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        if (wysiwygRef.current.firstChild) {
          range.selectNodeContents(wysiwygRef.current.firstChild);
          range.collapse(true);
        } else {
          range.selectNodeContents(wysiwygRef.current);
          range.collapse(true);
        }
        sel.removeAllRanges();
        sel.addRange(range);
      }
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollTop = 0;
      }
    } else if (mode === 'markdown' && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollTop = 0;
      }
    }
  }, [mode]);

  // Auto-focus on new note
  const prevActiveNoteIdRef = useRef<string>(note.id);
  useEffect(() => {
    const isNew = prevActiveNoteIdRef.current !== note.id;
    prevActiveNoteIdRef.current = note.id;
    if (isNew && !note.title && !note.content) {
      const timer = setTimeout(() => {
        focusContent();
        if (contentScrollRef.current) {
          contentScrollRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (isNew && contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [note.id, note.title, note.content, focusContent]);

  return (
    <div
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      onDrop={handleEditorDrop}
      className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-white dark:bg-black transition-colors duration-200 relative"
    >
      {/* Visual Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-neutral-900/80 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none text-white border-2 border-dashed border-white m-4 rounded-2xl animate-fade-in">
          <ImageIcon className="w-12 h-12 mb-2 animate-bounce" />
          <p className="text-base font-semibold">Drop image to add to {note.type === 'project' ? 'Project' : note.type === 'post' ? 'Blog Post' : 'Note'}</p>
          <p className="text-xs text-neutral-300 mt-1">Image will be saved in your blog repository folder</p>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 sticky top-0 z-20 w-full min-w-0 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 min-w-0 w-full">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="md:hidden p-1.5 -ml-1 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors flex items-center shrink-0"
                title="Back to Notes"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="px-1 py-1 text-xs font-sans tracking-wide text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                  Back
                </span>
              </button>
            )}

            {/* Toast Notification Banner */}
            {toastMessage && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black rounded text-xs font-mono max-w-full truncate shadow-md animate-fade-in">
                <Check className="w-3 h-3 shrink-0" />
                <span className="truncate">{toastMessage}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsSlideoutOpen(true)}
              title="More Actions & Options"
              className={`p-1.5 transition-colors ${
                isSlideoutOpen
                  ? 'text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-400 dark:text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area: Title + WYSIWYG or Raw Markdown */}
      <div
        ref={contentScrollRef}
        className="flex-1 p-4 sm:p-6 overflow-y-auto relative min-w-0 w-full flex flex-col"
      >
        {/* Title */}
        <div className="mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-900 shrink-0">
          <input
            type="text"
            placeholder={note.type === 'post' ? 'Post title' : note.type === 'project' ? 'Project title' : 'Title'}
            value={note.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                focusContent();
              }
            }}
            className="w-full text-2xl sm:text-3xl font-extrabold bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-300 dark:placeholder-neutral-700 focus:outline-none tracking-tight"
          />

          {/* Subtitle / Description Field for Blog posts & Projects */}
          {(note.type === 'post' || note.type === 'project') && (
            <div className="mt-2.5">
              <input
                type="text"
                placeholder={note.type === 'project' ? 'Project description...' : 'Brief summary or subtitle...'}
                value={note.description || ''}
                onChange={(e) => onChangeDescription?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusContent();
                  }
                }}
                className="w-full text-base italic bg-transparent text-neutral-600 dark:text-neutral-400 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none tracking-tight font-sans"
              />
            </div>
          )}
        </div>

        {mode === 'wysiwyg' ? (
          <div
            ref={wysiwygRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleWysiwygInput}
            onClick={handleWysiwygClick}
            onKeyDown={handleWysiwygKeyDown}
            onKeyUp={updateSelectionState}
            onMouseUp={updateSelectionState}
            onTouchEnd={updateSelectionState}
            onSelect={updateSelectionState}
            onPaste={handleWysiwygPaste}
            className="editor-wysiwyg w-full min-h-[350px] outline-none text-neutral-900 dark:text-neutral-100"
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => {
              pushHistory(e.target.value, e.target.selectionStart, e.target.selectionEnd);
              onChangeContent(e.target.value);
            }}
            onKeyDown={handleMarkdownKeyDown}
            onKeyUp={updateSelectionState}
            onMouseUp={updateSelectionState}
            onTouchEnd={updateSelectionState}
            onSelect={updateSelectionState}
            placeholder="Type raw markdown here..."
            className="w-full min-h-[350px] resize-none bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 font-mono text-sm leading-relaxed focus:outline-none overflow-hidden"
          />
        )}
      </div>

      {/* Formatting Toolbar (Always docked cleanly at the bottom below content) */}
      <EditorToolbar
        hasTextSelection={hasTextSelection}
        activeFormats={activeFormats}
        onFormat={handleFormat}
        onUndo={handleUndo}
        onRedo={handleRedo}
        keyboardOffset={bottomInset}
        isKeyboardOpen={isKeyboardOpen}
      />

      {/* Link Insertion Modal */}
      <LinkModal
        isOpen={isLinkModalOpen}
        linkUrl={linkUrl}
        linkText={linkText}
        onChangeUrl={setLinkUrl}
        onChangeText={setLinkText}
        onClose={() => setIsLinkModalOpen(false)}
        onSubmit={handleApplyLink}
      />

      {/* Image Insertion & Management Modal */}
      <ImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        note={note}
        onInsertImage={handleInsertImage}
        onDeleteExistingImage={onRemoveImage}
      />

      {/* Slideout Drawer Window */}
      <OptionsSlideout
        isOpen={isSlideoutOpen}
        onClose={() => setIsSlideoutOpen(false)}
        note={note}
        allTags={allTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onChangeDescription={onChangeDescription}
        onChangeAuthor={onChangeAuthor}
        allAuthors={allAuthors}
        onChangeProject={onChangeProject}
        allProjects={allProjects}
        onToggleFeatured={onToggleFeatured}
        onChangeSlug={onChangeSlug}
        onChangeStatus={onChangeStatus}
        onChangeYear={onChangeYear}
        onChangeUrl={onChangeUrl}
        onChangeGithub={onChangeGithub}
        onChangeOrder={onChangeOrder}
        onChangeType={onChangeType}
        onTogglePin={onTogglePin}
        onDeleteNote={onDeleteNote}
        onRestoreNote={onRestoreNote}
        onSaveToLocalFolder={onSaveToLocalFolder}
        onChangeSaveDirectory={onChangeSaveDirectory}
        onRemoveSaveDirectory={onRemoveSaveDirectory}
        onRenameFileName={onRenameFileName}
        mode={mode}
        onSetMode={setMode}
        theme={theme}
        onToggleTheme={onToggleTheme}
        storageMode={storageMode}
        directoryName={directoryName}
        onOpenDirectoryModal={onOpenDirectoryModal}
        onOpenLocalFolderSyncModal={onOpenLocalFolderSyncModal}
        onOpenBackupModal={onOpenBackupModal}
        onOpenImportModal={onOpenImportModal}
        onOpenShortcutsModal={onOpenShortcutsModal}
      />
    </div>
  );
};
