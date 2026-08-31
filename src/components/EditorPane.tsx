import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  MoreVertical,
  Heading1,
  Heading2,
  Code,
  Quote,
  CheckSquare,
  Link,
  Table,
  Minus,
  Tag as TagIcon,
  X,
  Pin,
  Undo,
  Redo,
  ArrowLeft,
  FolderDown,
  FolderOpen,
  FileText,
  Check,
} from 'lucide-react';
import { Note, EditorMode, StorageMode, Theme } from '../types';
import { modSymbol } from '../lib/platform';
import { renderMarkdownToHtml, convertHtmlToMarkdown, applyFormatting } from '../lib/markdown';
import { generateNoteFilename } from '../lib/localFileOperations';

interface EditorPaneProps {
  note: Note;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onTogglePin: () => void;
  onDeleteNote?: () => void;
  onRestoreNote?: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  allTags: string[];
  editorMode?: EditorMode;
  onChangeEditorMode?: (mode: EditorMode) => void;
  onToggleEditorMode?: () => void;
  onBackToList?: () => void;
  // Local File System / Folder Ops
  onSaveToLocalFolder?: () => Promise<void> | void;
  onOpenLocalFile?: () => Promise<void> | void;
  toastMessage?: string | null;
  // Blog Post Fields
  onChangeDescription?: (description: string) => void;
  onChangeAuthor?: (author: string) => void;
  onToggleFeatured?: () => void;
  onChangeType?: (type: 'note' | 'post') => void;
  onChangeDate?: (date: string) => void;
  // App Options & Settings
  theme?: Theme;
  onToggleTheme?: () => void;
  storageMode?: StorageMode;
  directoryName?: string;
  onOpenDirectoryModal?: () => void;
  onOpenSyncModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenShortcutsModal?: () => void;
}

function getCaretCharacterOffsetWithin(element: HTMLElement): number {
  let caretOffset = 0;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    try {
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    } catch {
      caretOffset = element.textContent?.length || 0;
    }
  }
  return caretOffset;
}

function setCaretCharacterOffsetWithin(element: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true);

  let currentOffset = 0;
  const nodeStack: Node[] = [element];
  let found = false;

  while (nodeStack.length > 0) {
    const node = nodeStack.pop()!;
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent?.length || 0;
      if (currentOffset + nodeLength >= offset) {
        range.setStart(node, Math.min(Math.max(0, offset - currentOffset), nodeLength));
        range.collapse(true);
        found = true;
        break;
      }
      currentOffset += nodeLength;
    } else {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        nodeStack.push(node.childNodes[i]);
      }
    }
  }

  if (!found) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

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
  onOpenLocalFile,
  toastMessage,
  onChangeDescription,
  onChangeAuthor,
  onToggleFeatured,
  onChangeType,
  theme,
  onToggleTheme,
  storageMode,
  directoryName,
  onOpenDirectoryModal,
  onOpenSyncModal,
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);
  const [tagInput, setTagInput] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);

  // Close slideout panel and tag dropdown when switching notes
  useEffect(() => {
    setIsSlideoutOpen(false);
    setTagInput('');
    setIsTagDropdownOpen(false);
  }, [note.id]);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setIsTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const prevNoteIdForHtmlRef = useRef<string>(note.id);

  // Sync note content to WYSIWYG innerHTML when note changes or mode switches
  useEffect(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      const isDifferentNote = prevNoteIdForHtmlRef.current !== note.id;
      prevNoteIdForHtmlRef.current = note.id;

      if (isUndoRedoActionRef.current) return;

      const html = renderMarkdownToHtml(note.content);
      // Avoid overwriting if user is actively typing in wysiwyg on the SAME note,
      // but ALWAYS force update innerHTML when switching to a different note.
      if (isDifferentNote || document.activeElement !== wysiwygRef.current) {
        wysiwygRef.current.innerHTML = html || '<p><br></p>';
      }
    }
  }, [note.id, note.content, mode]);

  // Auto-expand textarea height in Markdown mode so all content scrolls cleanly in the outer container
  useEffect(() => {
    if (mode === 'markdown' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(350, textareaRef.current.scrollHeight)}px`;
    }
  }, [note.content, mode]);

  const focusContent = useCallback(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.focus();
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
    } else if (mode === 'markdown' && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [mode]);

  // Auto-focus on the row below the title when a new note is created
  const prevActiveNoteIdRef = useRef<string>(note.id);
  useEffect(() => {
    const isNew = prevActiveNoteIdRef.current !== note.id;
    prevActiveNoteIdRef.current = note.id;
    if (isNew && (!note.title && !note.content)) {
      const timer = setTimeout(() => {
        focusContent();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [note.id, note.title, note.content, focusContent]);

  // Helper to strip leading text prefix from a DocumentFragment while preserving rich markup
  const stripLeadingPrefixFromFragment = useCallback((frag: DocumentFragment, prefixLength: number) => {
    let remaining = prefixLength;
    const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode() as Text | null;
    while (textNode && remaining > 0) {
      const val = textNode.nodeValue || '';
      if (val.length <= remaining) {
        remaining -= val.length;
        const next = walker.nextNode() as Text | null;
        textNode.remove();
        textNode = next;
      } else {
        textNode.nodeValue = val.substring(remaining);
        remaining = 0;
      }
    }
  }, []);

  // Helper to find block node and check if cursor is at start
  const getCaretBlockAndOffset = useCallback((container: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    let node: Node | null = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

    let blockNode: HTMLElement | null = null;
    while (node && node !== container) {
      const tag = (node as HTMLElement).tagName?.toUpperCase();
      if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI', 'P', 'DIV'].includes(tag)) {
        blockNode = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }

    let isAtStart = false;
    if (range.collapsed && blockNode) {
      try {
        const preRange = document.createRange();
        preRange.selectNodeContents(blockNode);
        preRange.setEnd(range.startContainer, range.startOffset);

        const frag = preRange.cloneContents();
        const temp = document.createElement('div');
        temp.appendChild(frag);
        temp.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());

        const textBefore = temp.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';
        if (textBefore === '') {
          isAtStart = true;
        }
      } catch {
        isAtStart = false;
      }
    }

    return { sel, range, blockNode, isAtStart };
  }, []);

  // Active formatting state for toolbar highlights
  const [activeFormats, setActiveFormats] = useState({
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
  });

  // Check active formatting at cursor selection
  const checkActiveFormats = useCallback(() => {
    if (mode !== 'wysiwyg' || !wysiwygRef.current) return;

    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isBullet = false;
    let isNumber = false;

    try {
      isBold = document.queryCommandState('bold');
      isItalic = document.queryCommandState('italic');
      isUnderline = document.queryCommandState('underline');
      isBullet = document.queryCommandState('insertUnorderedList');
      isNumber = document.queryCommandState('insertOrderedList');
    } catch {
      // ignore
    }

    let isHeading = false;
    let isH2 = false;
    let isQuote = false;
    let isCode = false;
    let isTask = false;
    let isLink = false;

    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let node: Node | null = sel.anchorNode;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

      while (node && node !== wysiwygRef.current) {
        const tag = (node as HTMLElement).tagName?.toUpperCase();
        if (tag === 'H1') isHeading = true;
        if (tag === 'H2') isH2 = true;
        if (tag === 'BLOCKQUOTE') isQuote = true;
        if (tag === 'PRE' || tag === 'CODE') isCode = true;
        if (tag === 'A') isLink = true;
        if (tag === 'U' || tag === 'INS') isUnderline = true;
        if (
          tag === 'LI' &&
          ((node as HTMLElement).classList.contains('task-list-item') ||
            (node as HTMLElement).querySelector('input[type="checkbox"]'))
        ) {
          isTask = true;
        }
        node = node.parentNode;
      }
    }

    setActiveFormats({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      heading: isHeading,
      h2: isH2,
      bullet: isBullet && !isTask,
      number: isNumber,
      task: isTask,
      quote: isQuote,
      code: isCode,
      link: isLink,
    });
  }, [mode]);

  // History stack for exact granular Undo/Redo (character-by-character and edit-by-edit)
  interface HistoryItem {
    content: string;
    html?: string;
    selStart: number;
    selEnd: number;
  }

  const historyRef = useRef<HistoryItem[]>([
    { content: note.content, selStart: 0, selEnd: 0, html: renderMarkdownToHtml(note.content) },
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
          html: renderMarkdownToHtml(note.content),
        },
      ];
      historyIdxRef.current = 0;
    }
  }, [note.id]);

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

  const handleUndo = useCallback(() => {
    if (historyIdxRef.current > 0) {
      isUndoRedoActionRef.current = true;
      historyIdxRef.current -= 1;
      const target = historyRef.current[historyIdxRef.current];
      onChangeContent(target.content);

      if (mode === 'wysiwyg' && wysiwygRef.current) {
        const htmlToSet = target.html || renderMarkdownToHtml(target.content) || '<p><br></p>';
        wysiwygRef.current.innerHTML = htmlToSet;
        wysiwygRef.current.focus();
        setCaretCharacterOffsetWithin(wysiwygRef.current, target.selStart);
        checkActiveFormats();
      } else if (mode === 'markdown' && textareaRef.current) {
        textareaRef.current.value = target.content;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(target.selStart, target.selEnd);
      }

      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 0);
    }
  }, [onChangeContent, mode, checkActiveFormats]);

  const handleRedo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      isUndoRedoActionRef.current = true;
      historyIdxRef.current += 1;
      const target = historyRef.current[historyIdxRef.current];
      onChangeContent(target.content);

      if (mode === 'wysiwyg' && wysiwygRef.current) {
        const htmlToSet = target.html || renderMarkdownToHtml(target.content) || '<p><br></p>';
        wysiwygRef.current.innerHTML = htmlToSet;
        wysiwygRef.current.focus();
        setCaretCharacterOffsetWithin(wysiwygRef.current, target.selStart);
        checkActiveFormats();
      } else if (mode === 'markdown' && textareaRef.current) {
        textareaRef.current.value = target.content;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(target.selStart, target.selEnd);
      }

      setTimeout(() => {
        isUndoRedoActionRef.current = false;
      }, 0);
    }
  }, [onChangeContent, mode, checkActiveFormats]);

  // Handle direct editing in WYSIWYG contentEditable div
  const handleWysiwygInput = useCallback(() => {
    if (!wysiwygRef.current) return;
    const html = wysiwygRef.current.innerHTML;
    const markdown = convertHtmlToMarkdown(html);
    const offset = getCaretCharacterOffsetWithin(wysiwygRef.current);
    pushHistory(markdown, offset, offset, html);
    onChangeContent(markdown);
  }, [onChangeContent, pushHistory]);

  // Handle interactive clicks inside WYSIWYG (e.g., checking/unchecking task checkboxes)
  const handleWysiwygClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        const cb = target as HTMLInputElement;
        const isCheckedAttr = cb.hasAttribute('checked');

        // Ensure checked state and attribute are in sync
        if (cb.checked !== isCheckedAttr) {
          if (cb.checked) {
            cb.setAttribute('checked', 'checked');
          } else {
            cb.removeAttribute('checked');
          }
        } else {
          // If browser contenteditable suppressed automatic toggle, toggle manually
          cb.checked = !cb.checked;
          if (cb.checked) {
            cb.setAttribute('checked', 'checked');
          } else {
            cb.removeAttribute('checked');
          }
        }

        if (wysiwygRef.current) {
          const html = wysiwygRef.current.innerHTML;
          const markdown = convertHtmlToMarkdown(html);
          onChangeContent(markdown);
        }
      }
    },
    [onChangeContent]
  );

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [savedTextareaSel, setSavedTextareaSel] = useState<{ start: number; end: number } | null>(null);

  // Track whether text is currently highlighted / selected for dynamic minimalist toolbar
  const [hasTextSelection, setHasTextSelection] = useState(false);

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

  // Sync selection changes to update active button styles and dynamic toolbar mode
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

  // Handle Paste in WYSIWYG editor to sanitize rich text, remove inline color/background styling,
  // and ensure seamless rendering in both light and dark mode.
  const handleWysiwygPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const rawHtml = clipboardData.getData('text/html');
      const plainText = clipboardData.getData('text/plain');

      let htmlToInsert = '';

      if (rawHtml) {
        // Convert incoming HTML to clean markdown to strip all inline colors, styles, classes, and fonts
        const markdown = convertHtmlToMarkdown(rawHtml);
        if (markdown && markdown.trim()) {
          htmlToInsert = renderMarkdownToHtml(markdown).trim();
        }
      }

      if (!htmlToInsert && plainText) {
        // Escape HTML entities in plain text
        const escaped = plainText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        if (escaped.includes('\n')) {
          const lines = escaped.split(/\r?\n/);
          htmlToInsert = lines
            .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br></p>'))
            .join('');
        } else {
          htmlToInsert = escaped;
        }
      }

      // Detect cursor context (inside LI, heading, paragraph, etc.)
      const sel = window.getSelection();
      let isInsideList = false;
      let isInsideHeading = false;
      if (sel && sel.anchorNode && wysiwygRef.current) {
        let n: Node | null = sel.anchorNode;
        if (n.nodeType === Node.TEXT_NODE) n = n.parentNode;
        while (n && n !== wysiwygRef.current) {
          const tag = (n as HTMLElement).tagName?.toUpperCase();
          if (tag === 'LI') isInsideList = true;
          if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) isInsideHeading = true;
          n = n.parentNode;
        }
      }

      // Check if htmlToInsert is wrapped in a single <p>...</p> block
      const trimmedHtml = htmlToInsert.trim();
      const isSingleParagraph =
        trimmedHtml.startsWith('<p>') &&
        trimmedHtml.endsWith('</p>') &&
        trimmedHtml.indexOf('<p>', 3) === -1 &&
        !trimmedHtml.includes('<ul>') &&
        !trimmedHtml.includes('<ol>') &&
        !trimmedHtml.includes('<h1>') &&
        !trimmedHtml.includes('<h2>') &&
        !trimmedHtml.includes('<h3>') &&
        !trimmedHtml.includes('<blockquote>') &&
        !trimmedHtml.includes('<pre>');

      if (isSingleParagraph || isInsideList || isInsideHeading) {
        if (isSingleParagraph) {
          htmlToInsert = trimmedHtml.slice(3, -4);
        } else if (isInsideList) {
          // In a list item, don't insert raw block <p> containers
          htmlToInsert = htmlToInsert
            .replace(/<p><br><\/p>/gi, '<br>')
            .replace(/<p>/gi, '')
            .replace(/<\/p>/gi, '<br>')
            .replace(/<br>$/, '');
        } else if (isInsideHeading) {
          // In a heading, strip block tags
          htmlToInsert = htmlToInsert
            .replace(/<\/?(?:p|div|h[1-6]|ul|ol|li|blockquote|pre)[^>]*>/gi, ' ')
            .trim();
        }
      }

      if (htmlToInsert) {
        // Use document.execCommand first to preserve undo stack and native cursor behavior
        const success = document.execCommand('insertHTML', false, htmlToInsert);
        if (!success) {
          // Range fallback
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const template = document.createElement('template');
            template.innerHTML = htmlToInsert;
            const fragment = template.content;
            const lastChild = fragment.lastChild;
            range.insertNode(fragment);
            if (lastChild) {
              range.setStartAfter(lastChild);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }
      }

      handleWysiwygInput();
      checkActiveFormats();
    },
    [handleWysiwygInput, checkActiveFormats]
  );

  // Unified WYSIWYG block formatting helper
  const applyWysiwygBlockFormat = (targetType: string) => {
    if (!wysiwygRef.current) return;

    // Ensure wysiwyg has focus
    wysiwygRef.current.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // Save caret offset before DOM mutations to guarantee exact restoration
    const savedCaretOffset = getCaretCharacterOffsetWithin(wysiwygRef.current);

    // Wrap any top-level bare text nodes in <p> to maintain valid block structure
    (Array.from(wysiwygRef.current.childNodes) as ChildNode[]).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        const p = document.createElement('p');
        p.textContent = child.textContent;
        child.replaceWith(p);
      }
    });

    // Collect all candidate block elements inside wysiwygRef.current
    const allBlocks = Array.from(
      wysiwygRef.current.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre')
    ) as HTMLElement[];

    // Filter to blocks that intersect the selection range
    let selectedNodes = allBlocks.filter((node) => {
      if (node.tagName === 'DIV') return false;
      try {
        return range.intersectsNode(node);
      } catch {
        return false;
      }
    });

    // Fallback: if intersectsNode returned nothing (e.g. collapsed cursor in empty block or start/end boundary)
    if (selectedNodes.length === 0 && sel.anchorNode) {
      let curr: Node | null = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentNode : sel.anchorNode;
      const block = (curr as HTMLElement)?.closest('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre');
      if (block && wysiwygRef.current.contains(block)) {
        selectedNodes = [block as HTMLElement];
      }
    }

    // If still empty, default to the first child or create a paragraph
    if (selectedNodes.length === 0) {
      if (wysiwygRef.current.firstElementChild) {
        selectedNodes = [wysiwygRef.current.firstElementChild as HTMLElement];
      } else {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        wysiwygRef.current.appendChild(p);
        selectedNodes = [p];
      }
    }

    // Helper to determine the current format of a block node
    const getNodeFormat = (node: HTMLElement) => {
      if (node.tagName === 'LI') {
        if (node.classList.contains('task-list-item') || node.querySelector('input[type="checkbox"]')) {
          return 'task';
        }
        if (node.parentElement?.tagName === 'OL') {
          return 'number';
        }
        return 'bullet';
      }
      if (node.tagName === 'H1') return 'heading';
      if (node.tagName === 'H2') return 'h2';
      if (node.tagName === 'BLOCKQUOTE') return 'quote';
      if (node.tagName === 'PRE') return 'code';
      return 'paragraph';
    };

    // Check if toggle off (all selected nodes already match targetType)
    const allMatch = selectedNodes.every((node) => getNodeFormat(node) === targetType);
    const finalFormat = allMatch ? 'paragraph' : targetType;

    // Helper to extract clean inner HTML content without list markers or raw prefixes
    const getCleanContent = (node: HTMLElement) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
      let content = clone.innerHTML.trim();
      content = content.replace(/^(\s*\[[\s\S]?\]|\s*[-*+•])\s*/i, '');
      if (!content) content = '<br>';
      return content;
    };

    const isTargetList = finalFormat === 'task' || finalFormat === 'bullet' || finalFormat === 'number';

    if (isTargetList) {
      // Group contiguous selected nodes and convert to list
      const groups: HTMLElement[][] = [];
      let currentGroup: HTMLElement[] = [];

      selectedNodes.forEach((node) => {
        if (currentGroup.length === 0) {
          currentGroup.push(node);
        } else {
          const prev = currentGroup[currentGroup.length - 1];
          if (prev.nextElementSibling === node || prev.parentElement === node.parentElement) {
            currentGroup.push(node);
          } else {
            groups.push(currentGroup);
            currentGroup = [node];
          }
        }
      });
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      groups.forEach((group) => {
        const first = group[0];
        const isOl = finalFormat === 'number';
        const listEl = document.createElement(isOl ? 'ol' : 'ul');
        if (finalFormat === 'task') {
          listEl.className = 'contains-task-list';
        }

        group.forEach((node) => {
          const content = getCleanContent(node);
          const li = document.createElement('li');
          if (finalFormat === 'task') {
            li.className = 'task-list-item';
            li.innerHTML = `<input type="checkbox" /> ${content}`;
          } else {
            li.innerHTML = content;
          }
          listEl.appendChild(li);
        });

        // Insert listEl in place of the group
        const parentList = first.tagName === 'LI' ? first.parentElement : null;
        if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
          parentList.replaceWith(listEl);
        } else {
          first.replaceWith(listEl);
          group.slice(1).forEach((node) => node.remove());
        }
      });
    } else {
      // Converting to top-level block (p, h1, h2, quote, code)
      selectedNodes.forEach((node) => {
        const content = getCleanContent(node);
        let newBlock: HTMLElement;

        switch (finalFormat) {
          case 'heading':
            newBlock = document.createElement('h1');
            newBlock.innerHTML = content;
            break;
          case 'h2':
            newBlock = document.createElement('h2');
            newBlock.innerHTML = content;
            break;
          case 'quote':
            newBlock = document.createElement('blockquote');
            newBlock.innerHTML = content;
            break;
          case 'code':
            newBlock = document.createElement('pre');
            newBlock.innerHTML = content;
            break;
          default:
            newBlock = document.createElement('p');
            newBlock.innerHTML = content;
            break;
        }

        if (node.tagName === 'LI' && node.parentElement) {
          const listParent = node.parentElement;
          const allLis = Array.from(listParent.children);
          const idx = allLis.indexOf(node);

          if (allLis.length === 1) {
            // Only item in list: replace entire list
            listParent.replaceWith(newBlock);
          } else if (idx === 0) {
            // First item: insert before list
            listParent.before(newBlock);
            node.remove();
          } else if (idx === allLis.length - 1) {
            // Last item: insert after list
            listParent.after(newBlock);
            node.remove();
          } else {
            // Middle item: split the list into two
            const secondList = document.createElement(listParent.tagName);
            secondList.className = listParent.className;
            allLis.slice(idx + 1).forEach((li) => secondList.appendChild(li));
            node.remove();
            listParent.after(newBlock);
            newBlock.after(secondList);
          }
        } else {
          // Standard top-level block: direct in-place replacement
          node.replaceWith(newBlock);
        }
      });
    }

    // Clean up any empty lists left behind
    wysiwygRef.current.querySelectorAll('ul, ol').forEach((list) => {
      if (list.children.length === 0) {
        list.remove();
      }
    });

    // Ensure wysiwyg is not completely empty
    if (!wysiwygRef.current.hasChildNodes() || wysiwygRef.current.innerHTML.trim() === '') {
      wysiwygRef.current.innerHTML = '<p><br></p>';
    }

    // Restore caret position and focus
    wysiwygRef.current.focus();
    setCaretCharacterOffsetWithin(wysiwygRef.current, savedCaretOffset);

    handleWysiwygInput();
    checkActiveFormats();
  };

  // Formatting actions
  const handleFormat = (
    type: 'bold' | 'italic' | 'underline' | 'heading' | 'h2' | 'code' | 'quote' | 'link' | 'bullet' | 'number' | 'task' | 'paragraph' | 'table' | 'hr'
  ) => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.focus();

      switch (type) {
        case 'bold':
          document.execCommand('bold', false);
          break;
        case 'italic':
          document.execCommand('italic', false);
          break;
        case 'underline':
          document.execCommand('underline', false);
          break;
        case 'paragraph':
        case 'heading':
        case 'h2':
        case 'quote':
        case 'code':
        case 'bullet':
        case 'number':
        case 'task':
          applyWysiwygBlockFormat(type);
          break;
        case 'link': {
          if (mode === 'wysiwyg') {
            if (activeFormats.link) {
              document.execCommand('unlink', false);
              handleWysiwygInput();
              checkActiveFormats();
            } else {
              const sel = window.getSelection();
              let text = '';
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0).cloneRange();
                setSavedRange(range);
                text = range.toString();
              } else {
                setSavedRange(null);
              }
              setLinkText(text);
              setLinkUrl('https://');
              setIsLinkModalOpen(true);
            }
          } else if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            setSavedTextareaSel({ start, end });
            const text = note.content.substring(start, end);
            setLinkText(text);
            setLinkUrl('https://');
            setIsLinkModalOpen(true);
          }
          break;
        }
        case 'table':
          document.execCommand(
            'insertHTML',
            false,
            '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table><p><br></p>'
          );
          break;
        case 'hr':
          document.execCommand('insertHTML', false, '<hr /><p><br></p>');
          break;
        default:
          break;
      }
      handleWysiwygInput();
      checkActiveFormats();
    } else if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const fmtType = type === 'h2' ? 'heading' : type;
      const formatted = applyFormatting(note.content, start, end, fmtType as any);
      onChangeContent(formatted.text);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(formatted.newStart, formatted.newEnd);
      }, 10);
    }
  };

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

  // Handle key presses inside WYSIWYG editor (Enter clearing styles, Backspace breaking away styles, Undo/Redo)
  const handleWysiwygKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!wysiwygRef.current) return;

    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    const keyLower = e.key.toLowerCase();

    if (isCmdOrCtrl && keyLower === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }

    if (isCmdOrCtrl && keyLower === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const info = getCaretBlockAndOffset(wysiwygRef.current);

      if (info && info.blockNode) {
        const { blockNode } = info;
        const tag = blockNode.tagName.toUpperCase();

        // If inside a list item (bullet, number, or task), indent/outdent list level
        if (tag === 'LI') {
          if (e.shiftKey) {
            document.execCommand('outdent', false);
          } else {
            document.execCommand('indent', false);
          }
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }

      // General paragraph/block indentation
      if (e.shiftKey) {
        // Shift + Tab: unindent leading spaces if present
        if (info && info.blockNode) {
          const text = info.blockNode.textContent || '';
          if (text.startsWith('\u00A0\u00A0') || text.startsWith('  ')) {
            info.blockNode.textContent = text.replace(/^(\u00A0\u00A0|  |\t|\u00A0)/, '');
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }
        }
      } else {
        // Tab: insert 2 non-breaking spaces at cursor
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const spaceNode = document.createTextNode('\u00A0\u00A0');
          range.insertNode(spaceNode);
          range.setStartAfter(spaceNode);
          range.setEndAfter(spaceNode);
          sel.removeAllRanges();
          sel.addRange(range);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      const info = getCaretBlockAndOffset(wysiwygRef.current);
      if (!info || !info.blockNode) return;
      const { blockNode } = info;
      const tag = blockNode.tagName.toUpperCase();

      // List Item (Bullet, Numbered, or Task)
      if (tag === 'LI') {
        e.preventDefault();

        const isTaskItem =
          blockNode.classList.contains('task-list-item') ||
          blockNode.querySelector('input[type="checkbox"]') !== null ||
          blockNode.closest('ul.contains-task-list') !== null;

        // Clone node and strip checkbox to check text
        const clone = blockNode.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
        const textContent = clone.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';

        if (textContent === '') {
          // Exit list mode when pressing Enter on an empty list item
          const parentList = blockNode.closest('ul, ol');
          blockNode.remove();

          const p = document.createElement('p');
          p.innerHTML = '<br>';

          if (parentList) {
            if (parentList.nextSibling) {
              parentList.parentNode?.insertBefore(p, parentList.nextSibling);
            } else {
              parentList.parentNode?.appendChild(p);
            }
            if (parentList.children.length === 0) {
              parentList.remove();
            }
          } else if (wysiwygRef.current) {
            wysiwygRef.current.appendChild(p);
          }

          const targetRange = document.createRange();
          targetRange.selectNodeContents(p);
          targetRange.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(targetRange);
          }
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        // Non-empty list item: split or insert new list item at exact cursor position
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);

        const preRange = document.createRange();
        preRange.selectNodeContents(blockNode);
        preRange.setEnd(range.startContainer, range.startOffset);
        const beforeFrag = preRange.cloneContents();

        const postRange = document.createRange();
        postRange.selectNodeContents(blockNode);
        postRange.setStart(range.endContainer, range.endOffset);
        const afterFrag = postRange.cloneContents();

        const beforeTemp = document.createElement('div');
        beforeTemp.appendChild(beforeFrag.cloneNode(true));
        beforeTemp.querySelectorAll('input[type="checkbox"]').forEach((c) => c.remove());
        const beforeText = beforeTemp.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';

        const afterTemp = document.createElement('div');
        afterTemp.appendChild(afterFrag.cloneNode(true));
        afterTemp.querySelectorAll('input[type="checkbox"]').forEach((c) => c.remove());
        const afterText = afterTemp.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';

        const newLi = document.createElement('li');
        if (isTaskItem) {
          newLi.className = 'task-list-item';
        }

        if (beforeText === '') {
          // Cursor at start of list item: insert empty item before current item
          if (isTaskItem) {
            newLi.innerHTML = '<input type="checkbox" />&nbsp;';
          } else {
            newLi.innerHTML = '<br>';
          }
          blockNode.parentNode?.insertBefore(newLi, blockNode);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        if (afterText === '') {
          // Cursor at end of list item: insert new item immediately after current item
          if (isTaskItem) {
            newLi.innerHTML = '<input type="checkbox" />&nbsp;';
          } else {
            newLi.innerHTML = '<br>';
          }

          if (blockNode.nextSibling) {
            blockNode.parentNode?.insertBefore(newLi, blockNode.nextSibling);
          } else {
            blockNode.parentNode?.appendChild(newLi);
          }

          const targetRange = document.createRange();
          targetRange.selectNodeContents(newLi);
          targetRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(targetRange);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        // Cursor in middle: cleanly split content between current item and new item
        blockNode.innerHTML = '';
        if (isTaskItem) {
          const keepCb = document.createElement('input');
          keepCb.type = 'checkbox';
          const origCb = (blockNode as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (origCb && origCb.checked) keepCb.checked = true;
          blockNode.appendChild(keepCb);
          blockNode.appendChild(document.createTextNode(' '));
        }
        const beforeNodes = Array.from(beforeFrag.childNodes).filter(
          (n) => !(n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'INPUT')
        );
        beforeNodes.forEach((node) => blockNode.appendChild(node));
        if (!blockNode.textContent?.trim() && !isTaskItem) {
          blockNode.innerHTML = '<br>';
        }

        if (isTaskItem) {
          const newCb = document.createElement('input');
          newCb.type = 'checkbox';
          newLi.appendChild(newCb);
          newLi.appendChild(document.createTextNode(' '));
        }
        const afterNodes = Array.from(afterFrag.childNodes).filter(
          (n) => !(n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'INPUT')
        );
        afterNodes.forEach((node) => newLi.appendChild(node));
        if (!newLi.textContent?.trim() && !isTaskItem) {
          newLi.appendChild(document.createElement('br'));
        }

        if (blockNode.nextSibling) {
          blockNode.parentNode?.insertBefore(newLi, blockNode.nextSibling);
        } else {
          blockNode.parentNode?.appendChild(newLi);
        }

        const targetRange = document.createRange();
        if (isTaskItem && newLi.childNodes.length > 2) {
          targetRange.setStart(newLi.childNodes[2], 0);
        } else {
          targetRange.selectNodeContents(newLi);
          targetRange.collapse(true);
        }
        sel.removeAllRanges();
        sel.addRange(targetRange);
        handleWysiwygInput();
        checkActiveFormats();
        return;
      }

      // Auto-list triggers in Paragraph or Div: "1. Testing|", "- Testing|", "* Testing|", "+ Testing|", "[ ] Testing|"
      const sel = window.getSelection();
      if (
        sel &&
        sel.rangeCount > 0 &&
        tag !== 'H1' &&
        tag !== 'H2' &&
        tag !== 'H3' &&
        tag !== 'BLOCKQUOTE' &&
        tag !== 'PRE' &&
        tag !== 'CODE'
      ) {
        const range = sel.getRangeAt(0);

        const preRange = document.createRange();
        preRange.selectNodeContents(blockNode);
        preRange.setEnd(range.startContainer, range.startOffset);
        const textBefore = preRange.toString();

        const postRange = document.createRange();
        postRange.selectNodeContents(blockNode);
        postRange.setStart(range.endContainer, range.endOffset);

        // 1) Numbered List Pattern: "1. Testing" or "1) Testing"
        const numMatch = textBefore.match(/^(\s*)(\d+)([.)])\s*(.*)$/);
        if (numMatch) {
          e.preventDefault();
          const fullPrefixMatch = textBefore.match(/^(\s*\d+[.)]\s*)/);
          const prefixLen = fullPrefixMatch ? fullPrefixMatch[0].length : 3;

          const beforeFrag = preRange.cloneContents();
          stripLeadingPrefixFromFragment(beforeFrag, prefixLen);

          const afterFrag = postRange.cloneContents();

          const ol = document.createElement('ol');
          const firstLi = document.createElement('li');
          firstLi.appendChild(beforeFrag);
          if (!firstLi.textContent?.trim() && firstLi.childNodes.length === 0) {
            firstLi.innerHTML = '<br>';
          }

          const secondLi = document.createElement('li');
          secondLi.appendChild(afterFrag);
          if (!secondLi.textContent?.trim() && secondLi.childNodes.length === 0) {
            secondLi.innerHTML = '<br>';
          }

          ol.appendChild(firstLi);
          ol.appendChild(secondLi);

          blockNode.parentNode?.replaceChild(ol, blockNode);

          const targetRange = document.createRange();
          targetRange.selectNodeContents(secondLi);
          targetRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(targetRange);

          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        // 2) Bullet List Pattern: "- Testing", "* Testing", "+ Testing", "• Testing"
        const bulletMatch = textBefore.match(/^(\s*)([-*+•])\s*(.*)$/);
        if (bulletMatch) {
          e.preventDefault();
          const fullPrefixMatch = textBefore.match(/^(\s*[-*+•]\s*)/);
          const prefixLen = fullPrefixMatch ? fullPrefixMatch[0].length : 2;

          const beforeFrag = preRange.cloneContents();
          stripLeadingPrefixFromFragment(beforeFrag, prefixLen);

          const afterFrag = postRange.cloneContents();

          const ul = document.createElement('ul');
          const firstLi = document.createElement('li');
          firstLi.appendChild(beforeFrag);
          if (!firstLi.textContent?.trim() && firstLi.childNodes.length === 0) {
            firstLi.innerHTML = '<br>';
          }

          const secondLi = document.createElement('li');
          secondLi.appendChild(afterFrag);
          if (!secondLi.textContent?.trim() && secondLi.childNodes.length === 0) {
            secondLi.innerHTML = '<br>';
          }

          ul.appendChild(firstLi);
          ul.appendChild(secondLi);

          blockNode.parentNode?.replaceChild(ul, blockNode);

          const targetRange = document.createRange();
          targetRange.selectNodeContents(secondLi);
          targetRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(targetRange);

          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        // 3) Task List Pattern: "[ ] Testing" or "- [ ] Testing"
        const taskMatch = textBefore.match(/^(\s*(?:\[[\s_]?\]|[-*+]\s*\[[\s_]?\])\s*)/i);
        if (taskMatch) {
          e.preventDefault();
          const prefixLen = taskMatch[0].length;

          const beforeFrag = preRange.cloneContents();
          stripLeadingPrefixFromFragment(beforeFrag, prefixLen);

          const afterFrag = postRange.cloneContents();

          const ul = document.createElement('ul');
          ul.className = 'contains-task-list';

          const firstLi = document.createElement('li');
          firstLi.className = 'task-list-item';
          const cb1 = document.createElement('input');
          cb1.type = 'checkbox';
          firstLi.appendChild(cb1);
          firstLi.appendChild(document.createTextNode(' '));
          firstLi.appendChild(beforeFrag);
          if (firstLi.childNodes.length <= 2 && !firstLi.textContent?.trim()) {
            firstLi.appendChild(document.createElement('br'));
          }

          const secondLi = document.createElement('li');
          secondLi.className = 'task-list-item';
          const cb2 = document.createElement('input');
          cb2.type = 'checkbox';
          secondLi.appendChild(cb2);
          secondLi.appendChild(document.createTextNode(' '));
          secondLi.appendChild(afterFrag);
          if (secondLi.childNodes.length <= 2 && !secondLi.textContent?.trim()) {
            secondLi.appendChild(document.createElement('br'));
          }

          ul.appendChild(firstLi);
          ul.appendChild(secondLi);

          blockNode.parentNode?.replaceChild(ul, blockNode);

          const targetRange = document.createRange();
          if (secondLi.childNodes.length > 2) {
            targetRange.setStart(secondLi.childNodes[2], 0);
          } else {
            targetRange.selectNodeContents(secondLi);
            targetRange.collapse(false);
          }
          sel.removeAllRanges();
          sel.addRange(targetRange);

          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }

      // Heading: Enter converts new line to <p> so user isn't stuck in heading style
      if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const text = blockNode.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';

          if (text === '') {
            e.preventDefault();
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            blockNode.parentNode?.replaceChild(p, blockNode);
            const r = document.createRange();
            r.selectNodeContents(p);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          const postRange = document.createRange();
          postRange.selectNodeContents(blockNode);
          postRange.setStart(range.endContainer, range.endOffset);
          const afterText = postRange.toString().replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '');

          if (afterText === '') {
            // Cursor at end of heading: create new paragraph after heading
            e.preventDefault();
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            if (blockNode.nextSibling) {
              blockNode.parentNode?.insertBefore(p, blockNode.nextSibling);
            } else {
              blockNode.parentNode?.appendChild(p);
            }
            const r = document.createRange();
            r.selectNodeContents(p);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }
        }
      }

      // Blockquote: Enter on empty line inside blockquote escapes quote
      if (tag === 'BLOCKQUOTE') {
        const text = blockNode.textContent?.trim() || '';
        if (text === '') {
          e.preventDefault();
          document.execCommand('formatBlock', false, '<p>');
          checkActiveFormats();
        }
      }

      // Code Block (PRE or CODE): Enter on empty block, empty line in code, or Ctrl/Cmd+Enter escapes code block to paragraph
      if (tag === 'PRE' || tag === 'CODE') {
        const text = blockNode.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';
        const sel = window.getSelection();
        let isAtEmptyLineInCode = false;

        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const preRange = document.createRange();
          preRange.selectNodeContents(blockNode);
          preRange.setEnd(range.startContainer, range.startOffset);
          const textBefore = preRange.toString();
          if (textBefore.endsWith('\n') || textBefore.endsWith('\r')) {
            isAtEmptyLineInCode = true;
          }
        }

        if (text === '' || isAtEmptyLineInCode || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          document.execCommand('formatBlock', false, '<p>');
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }
    }

    if (e.key === 'Backspace') {
      const info = getCaretBlockAndOffset(wysiwygRef.current);
      if (!info || !info.blockNode) return;
      const { blockNode, isAtStart } = info;
      const tag = blockNode.tagName.toUpperCase();

      if (isAtStart) {
        // Backspace at start of LI (e.g. "1. |Testing" or "- |Testing") converts back to standard paragraph
        if (tag === 'LI') {
          e.preventDefault();
          const parentList = blockNode.closest('ul, ol');
          if (!parentList) return;

          const clone = blockNode.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());

          const p = document.createElement('p');
          while (clone.firstChild) {
            p.appendChild(clone.firstChild);
          }
          if (!p.textContent?.trim() && p.childNodes.length === 0) {
            p.innerHTML = '<br>';
          }

          const allLis = Array.from(parentList.children) as HTMLElement[];
          const currIdx = allLis.indexOf(blockNode);

          const lisBefore = allLis.slice(0, currIdx);
          const lisAfter = allLis.slice(currIdx + 1);

          // Handle subsequent list items if any
          if (lisAfter.length > 0) {
            const trailingList = document.createElement(parentList.tagName) as HTMLElement;
            trailingList.className = parentList.className;
            lisAfter.forEach((li) => trailingList.appendChild(li));
            if (parentList.nextSibling) {
              parentList.parentNode?.insertBefore(trailingList, parentList.nextSibling);
            } else {
              parentList.parentNode?.appendChild(trailingList);
            }
          }

          // Insert paragraph
          if (lisBefore.length > 0) {
            if (parentList.nextSibling) {
              parentList.parentNode?.insertBefore(p, parentList.nextSibling);
            } else {
              parentList.parentNode?.appendChild(p);
            }
          } else {
            parentList.parentNode?.insertBefore(p, parentList);
          }

          blockNode.remove();
          if (lisBefore.length === 0) {
            parentList.remove();
          }

          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        // Backspace at start of heading, quote, or code converts to standard paragraph
        if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'CODE'].includes(tag)) {
          e.preventDefault();
          document.execCommand('formatBlock', false, '<p>');
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }

      // Backspace right after typed prefix like "1. |" or "- |" in paragraph
      if (tag === 'P' || tag === 'DIV') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          const preRange = document.createRange();
          preRange.selectNodeContents(blockNode);
          preRange.setEnd(range.startContainer, range.startOffset);
          const textBefore = preRange.toString();

          const prefixMatch = textBefore.match(/^(\s*(?:\d+[.)]|[-*+•])\s+)$/);
          if (prefixMatch) {
            e.preventDefault();
            preRange.deleteContents();
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }
        }
      }
    }
  };

  const handleKeyDownMarkdown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    const keyLower = e.key.toLowerCase();

    if (isCmdOrCtrl && keyLower === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return;
    }

    if (isCmdOrCtrl && keyLower === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    if (isCmdOrCtrl) {
      if (keyLower === 'b') {
        e.preventDefault();
        handleFormat('bold');
      } else if (keyLower === 'i') {
        e.preventDefault();
        handleFormat('italic');
      } else if (keyLower === 'h') {
        e.preventDefault();
        handleFormat('heading');
      }
    }

    // Markdown Enter handling for lists (1. Testing -> next line 2. , - Testing -> next line - )
    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
          const val = note.content;
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const currentLine = val.substring(lineStart, start);

          // Numbered list: "1. Testing" or "1. "
          const numMatch = currentLine.match(/^(\s*)(\d+)([.)])\s*(.*)$/);
          if (numMatch) {
            e.preventDefault();
            const indent = numMatch[1];
            const num = parseInt(numMatch[2], 10);
            const delimiter = numMatch[3];
            const itemContent = numMatch[4];

            if (!itemContent.trim()) {
              // Empty list item: exit list
              const updated = val.substring(0, lineStart) + indent + val.substring(start);
              onChangeContent(updated);
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = lineStart + indent.length;
              }, 0);
              return;
            } else {
              // Continue numbered list
              const nextPrefix = `\n${indent}${num + 1}${delimiter} `;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + nextPrefix.length;
              }, 0);
              return;
            }
          }

          // Bullet list: "- Testing" or "- "
          const bulletMatch = currentLine.match(/^(\s*)([-*+])\s*(.*)$/);
          if (bulletMatch) {
            e.preventDefault();
            const indent = bulletMatch[1];
            const bullet = bulletMatch[2];
            const itemContent = bulletMatch[3];

            if (!itemContent.trim()) {
              // Empty bullet: exit list
              const updated = val.substring(0, lineStart) + indent + val.substring(start);
              onChangeContent(updated);
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = lineStart + indent.length;
              }, 0);
              return;
            } else {
              // Continue bullet list
              const nextPrefix = `\n${indent}${bullet} `;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + nextPrefix.length;
              }, 0);
              return;
            }
          }
        }
      }
    }

    // Markdown Backspace handling to delete list formatting
    if (e.key === 'Backspace') {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
          const val = note.content;
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const lineBeforeCursor = val.substring(lineStart, start);

          // If cursor is right after marker: "1. |" or "- |"
          const markerMatch = lineBeforeCursor.match(/^(\s*(?:\d+[.)]|[-*+])\s+)$/);
          if (markerMatch) {
            e.preventDefault();
            const updated = val.substring(0, lineStart) + val.substring(start);
            onChangeContent(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = lineStart;
            }, 0);
            return;
          }
        }
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = note.content;

      if (start !== end) {
        // Multi-line selection or text block selection
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = val.indexOf('\n', end);
        const actualEnd = lineEnd === -1 ? val.length : lineEnd;
        const selectedText = val.substring(lineStart, actualEnd);
        const lines = selectedText.split('\n');

        let modifiedLines: string[];
        if (e.shiftKey) {
          modifiedLines = lines.map((line) => line.replace(/^(  |\t|\u00A0{2})/, ''));
        } else {
          modifiedLines = lines.map((line) => '  ' + line);
        }

        const newText = modifiedLines.join('\n');
        const updated = val.substring(0, lineStart) + newText + val.substring(actualEnd);
        onChangeContent(updated);

        setTimeout(() => {
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart + newText.length;
        }, 0);
      } else {
        // Single cursor position
        if (e.shiftKey) {
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const beforeCursor = val.substring(lineStart, start);
          if (beforeCursor.endsWith('  ')) {
            const updated = val.substring(0, start - 2) + val.substring(start);
            onChangeContent(updated);
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 2);
            }, 0);
          }
        } else {
          const updated = val.substring(0, start) + '  ' + val.substring(end);
          onChangeContent(updated);

          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          }, 0);
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-white dark:bg-black transition-colors duration-200 relative">
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
            {/* More Actions */}
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



      {/* Formatting Toolbar - Sticky at bottom on mobile, sticky under header on desktop */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="shrink-0 border-t md:border-t-0 md:border-b border-neutral-200 dark:border-neutral-800 px-3 sm:px-5 py-1.5 bg-neutral-50/95 dark:bg-neutral-950/95 md:bg-transparent backdrop-blur select-none order-2 md:order-1 sticky bottom-0 md:static z-20"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none min-h-[32px]">
          {hasTextSelection ? (
            /* Selection Toolbar: B, I, U, link, H1, H2, code block, quote */
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('bold')}
                title={`Bold (${modSymbol}B)`}
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.bold
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('italic')}
                title={`Italic (${modSymbol}I)`}
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.italic
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('underline')}
                title="Underline"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.underline
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Underline className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('link')}
                title="Insert Link"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.link
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Link className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('heading')}
                title="Heading 1"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.heading
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Heading1 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('h2')}
                title="Heading 2"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.h2
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('code')}
                title="Code Block"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.code
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Code className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('quote')}
                title="Quote"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.quote
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Quote className="w-4 h-4" />
              </button>
            </>
          ) : (
            /* Default Minimalist Toolbar: undo, redo | checkbox, table, line */
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUndo}
                title={`Undo (${modSymbol}Z)`}
                className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 shrink-0"
              >
                <Undo className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleRedo}
                title={`Redo (${modSymbol}Y)`}
                className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 shrink-0"
              >
                <Redo className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('task')}
                title="Checkbox / Task List"
                className={`p-1.5 rounded-md transition-colors shrink-0 ${
                  activeFormats.task
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('table')}
                title="Insert Table"
                className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 shrink-0"
              >
                <Table className="w-4 h-4" />
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleFormat('hr')}
                title="Horizontal Line"
                className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>


      {/* Content Area: Title + WYSIWYG or Raw Markdown */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative min-w-0 w-full flex flex-col order-1 md:order-2">
        {/* Title inside the Editor Box */}
        <div className="mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-900 shrink-0">
          <input
            type="text"
            placeholder={note.type === 'post' ? 'Post title' : 'Title'}
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

          {/* Subtitle / Description Field for Blog mode */}
          {note.type === 'post' && (
            <div className="mt-2.5">
              <input
                type="text"
                placeholder="Brief summary or subtitle..."
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
            onKeyDown={handleKeyDownMarkdown}
            onKeyUp={updateSelectionState}
            onMouseUp={updateSelectionState}
            onTouchEnd={updateSelectionState}
            onSelect={updateSelectionState}
            placeholder="Type raw markdown here..."
            className="w-full min-h-[350px] resize-none bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 font-mono text-sm leading-relaxed focus:outline-none overflow-hidden"
          />
        )}
      </div>

      {/* Link Insertion Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
                <Link className="w-4 h-4 text-blue-500" />
                <span>Insert Hyperlink</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyLink} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Link URL
                </label>
                <input
                  type="text"
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Display Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Link text"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-black dark:hover:bg-neutral-200 rounded-lg transition-colors shadow-xs"
                >
                  Insert Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slideout Drawer Window */}
      {isSlideoutOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsSlideoutOpen(false)}
            className="absolute inset-0 bg-black/20 dark:bg-black/50 z-30 transition-opacity backdrop-blur-[1px]"
          />

          {/* Minimal Slideout Drawer */}
<div className="absolute inset-y-0 right-0 w-80 sm:w-96 max-w-[92vw] bg-white dark:bg-black border-l border-neutral-200 dark:border-neutral-800 z-40 flex flex-col animate-in slide-in-from-right duration-200">

  {/* Header */}
  <div className="h-14 px-5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 shrink-0">
    <span className="text-sm font-medium tracking-wide text-black dark:text-white">
      Options
    </span>

    <button
      type="button"
      onClick={() => setIsSlideoutOpen(false)}
      className="p-1.5 text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
      title="Close"
    >
      <X className="w-4 h-4" />
    </button>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-y-auto px-5 py-6">

    {/* ============================================================ */}
    {/* TAGS */}
    {/* ============================================================ */}

    <section className="pb-7">

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium tracking-wide text-black dark:text-white">
          Tags
        </span>

        <span className="text-[11px] text-neutral-400 dark:text-neutral-600">
          {note.tags.length}
        </span>
      </div>

      {/* Current Tags */}
      {note.tags.length > 0 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-2 mb-4">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs text-black dark:text-white"
            >
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
        <p className="text-xs text-neutral-400 dark:text-neutral-600 mb-4">
          No tags
        </p>
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


    {/* ============================================================ */}
    {/* AUTHOR (BLOG POST ONLY) */}
    {/* ============================================================ */}
    {note.type === 'post' && (
      <section className="border-t border-neutral-200 dark:border-neutral-800 py-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium tracking-wide text-black dark:text-white">
            Author
          </span>
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

    {/* ============================================================ */}
    {/* FEATURED POST (BLOG POST ONLY) */}
    {/* ============================================================ */}
    {note.type === 'post' && (
      <section className="border-t border-neutral-200 dark:border-neutral-800 py-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium tracking-wide text-black dark:text-white block">
              Featured post
            </span>
            <span className="text-[11px] text-neutral-400 dark:text-neutral-600">
              Highlight in blog list
            </span>
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

    {/* ============================================================ */}
    {/* NOTE ACTIONS */}
    {/* ============================================================ */}

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
                setIsSlideoutOpen(false);
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
                setIsSlideoutOpen(false);
              }}
              className="group flex items-center justify-between py-2.5 text-left"
            >
              <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
                Delete
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-600">
                Move to trash
              </span>
            </button>
          )
        )}

        {onSaveToLocalFolder && (
          <button
            type="button"
            onClick={() => {
              onSaveToLocalFolder();
              setIsSlideoutOpen(false);
            }}
            className="group flex items-center justify-between py-2.5 text-left"
          >
            <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
              Save
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-600">
              Save to local device
            </span>
          </button>
        )}

      </div>
    </section>


    {/* ============================================================ */}
    {/* NOTE INFORMATION */}
    {/* ============================================================ */}

    <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">

      <div className="mb-3">
        <span className="text-xs font-medium tracking-wide text-black dark:text-white">
          Information
        </span>
      </div>

      <div className="space-y-2 text-xs">

        {note.type === 'post' && (
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500 dark:text-neutral-500">
              Date
            </span>

            <span className="text-black dark:text-white text-right">
              {note.date || new Date(note.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <span className="text-neutral-500 dark:text-neutral-500">
            Created
          </span>

          <span className="text-black dark:text-white text-right">
            {new Date(note.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-neutral-500 dark:text-neutral-500">
            Edited
          </span>

          <span className="text-black dark:text-white text-right">
            {new Date(note.updatedAt || note.createdAt).toLocaleDateString(
              undefined,
              {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }
            )}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-neutral-500 dark:text-neutral-500">
            Words
          </span>

          <span className="text-black dark:text-white">
            {note.content.trim()
              ? note.content.trim().split(/\s+/).length
              : 0}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-neutral-500 dark:text-neutral-500">
            Characters
          </span>

          <span className="text-black dark:text-white">
            {note.content.length}
          </span>
        </div>

      </div>
    </section>

    {/* ============================================================ */}
    {/* APP SETTINGS */}
    {/* ============================================================ */}

    <section className="border-t border-neutral-200 dark:border-neutral-800 py-5">

      <div className="mb-3">
        <span className="text-xs font-medium tracking-wide text-black dark:text-white">
          Settings
        </span>
      </div>

      <div className="flex flex-col">

        {/* Editor */}
        <button
          type="button"
          onClick={() =>
            setMode(mode === 'wysiwyg' ? 'markdown' : 'wysiwyg')
          }
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
              setIsSlideoutOpen(false);
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
              setIsSlideoutOpen(false);
            }}
            className="group flex items-center justify-between py-2.5 text-left"
          >
            <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
              Backup
            </span>

            <span className="text-xs text-neutral-400 dark:text-neutral-600">
              Export
            </span>
          </button>
        )}

        {/* Import */}
        {onOpenImportModal && (
          <button
            type="button"
            onClick={() => {
              onOpenImportModal();
              setIsSlideoutOpen(false);
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
              setIsSlideoutOpen(false);
            }}
            className="group flex items-center justify-between py-2.5 text-left"
          >
            <span className="text-sm text-black dark:text-white group-hover:underline underline-offset-4">
              Keyboard shortcuts
            </span>

            <span className="text-xs text-neutral-400 dark:text-neutral-600">
              ?
            </span>
          </button>
        )}

      </div>
    </section>

  </div>
</div>
        </>
      )}
    </div>
  );
};