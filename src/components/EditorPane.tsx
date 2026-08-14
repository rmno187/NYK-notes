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
  List,
  ListOrdered,
  CheckSquare,
  Link,
  Table,
  Minus,
  Tag as TagIcon,
  Plus,
  X,
  Pin,
  Check,
  Eye,
  FileText,
  Edit3,
  ChevronLeft,
} from 'lucide-react';
import { Note, EditorMode } from '../types';
import { renderMarkdownToHtml, convertHtmlToMarkdown, applyFormatting } from '../lib/markdown';

interface EditorPaneProps {
  note: Note;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onTogglePin: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  allTags: string[];
  isSaved?: boolean;
  editorMode?: EditorMode;
  onChangeEditorMode?: (mode: EditorMode) => void;
  onToggleEditorMode?: () => void;
  onBackToList?: () => void;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  note,
  onChangeTitle,
  onChangeContent,
  onTogglePin,
  onAddTag,
  onRemoveTag,
  allTags,
  isSaved,
  editorMode: externalEditorMode,
  onChangeEditorMode,
  onToggleEditorMode,
  onBackToList,
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
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  // Sync note content to WYSIWYG innerHTML when note changes or mode switches
  useEffect(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      const html = renderMarkdownToHtml(note.content);
      // Avoid overwriting if user is actively typing in wysiwyg
      if (document.activeElement !== wysiwygRef.current) {
        wysiwygRef.current.innerHTML = html;
      }
    }
  }, [note.id, note.content, mode]);

  // Handle direct editing in WYSIWYG contentEditable div
  const handleWysiwygInput = useCallback(() => {
    if (!wysiwygRef.current) return;
    const html = wysiwygRef.current.innerHTML;
    const markdown = convertHtmlToMarkdown(html);
    onChangeContent(markdown);
  }, [onChangeContent]);

  // Handle interactive clicks inside WYSIWYG (e.g., checking/unchecking task checkboxes)
  const handleWysiwygClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        setTimeout(() => {
          if (wysiwygRef.current) {
            const html = wysiwygRef.current.innerHTML;
            const markdown = convertHtmlToMarkdown(html);
            onChangeContent(markdown);
          }
        }, 10);
      }
    },
    [onChangeContent]
  );

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [savedTextareaSel, setSavedTextareaSel] = useState<{ start: number; end: number } | null>(null);

  // Floating selection toolbar state
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const updateFloatingToolbar = useCallback(() => {
    if (mode !== 'wysiwyg') {
      setFloatingToolbarPos(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !wysiwygRef.current) {
      setFloatingToolbarPos(null);
      setIsMoreMenuOpen(false);
      return;
    }

    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (wysiwygRef.current.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const parentElem = wysiwygRef.current.parentElement;
        const containerRect = parentElem
          ? parentElem.getBoundingClientRect()
          : wysiwygRef.current.getBoundingClientRect();

        if (rect.width > 0) {
          let top = rect.top - containerRect.top - 48; // Position above text
          let left = rect.left - containerRect.left + rect.width / 2;

          if (top < 10) top = rect.bottom - containerRect.top + 8; // Flip below if near top
          if (left < 110) left = 110;
          if (containerRect.width > 220 && left > containerRect.width - 110) {
            left = containerRect.width - 110;
          }

          setFloatingToolbarPos({ top, left });
          return;
        }
      }
    }
    setFloatingToolbarPos(null);
    setIsMoreMenuOpen(false);
  }, [mode]);

  useEffect(() => {
    const handleSelection = () => {
      setTimeout(updateFloatingToolbar, 10);
    };
    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [updateFloatingToolbar]);

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
      if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI', 'P'].includes(tag)) {
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
    let isBullet = false;
    let isNumber = false;

    try {
      isBold = document.queryCommandState('bold');
      isItalic = document.queryCommandState('italic');
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

  // Sync selection changes to update active button styles
  useEffect(() => {
    if (mode !== 'wysiwyg') return;

    const handleSelectionChange = () => {
      checkActiveFormats();
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [mode, checkActiveFormats]);

  // Formatting actions
  const handleFormat = (
    type: 'bold' | 'italic' | 'heading' | 'h2' | 'code' | 'quote' | 'link' | 'bullet' | 'number' | 'task' | 'table' | 'hr'
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
        case 'heading':
          if (activeFormats.heading) {
            document.execCommand('formatBlock', false, '<p>');
          } else {
            document.execCommand('formatBlock', false, '<h1>');
          }
          break;
        case 'h2':
          if (activeFormats.h2) {
            document.execCommand('formatBlock', false, '<p>');
          } else {
            document.execCommand('formatBlock', false, '<h2>');
          }
          break;
        case 'quote':
          if (activeFormats.quote) {
            document.execCommand('formatBlock', false, '<p>');
          } else {
            document.execCommand('formatBlock', false, '<blockquote>');
          }
          break;
        case 'bullet':
          document.execCommand('insertUnorderedList', false);
          break;
        case 'number':
          document.execCommand('insertOrderedList', false);
          break;
        case 'code':
          if (activeFormats.code) {
            document.execCommand('formatBlock', false, '<p>');
          } else {
            document.execCommand('formatBlock', false, '<pre>');
          }
          break;
        case 'task': {
          if (activeFormats.task) {
            const sel = window.getSelection();
            if (sel && sel.anchorNode) {
              let node: Node | null = sel.anchorNode;
              if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
              const taskList = (node as HTMLElement)?.closest('li');
              if (taskList) {
                const clone = taskList.cloneNode(true) as HTMLElement;
                clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
                const text = clone.textContent || '';
                const p = document.createElement('p');
                p.textContent = text;
                if (!p.textContent) p.innerHTML = '<br>';
                const parentList = taskList.closest('ul');
                taskList.parentNode?.replaceChild(p, taskList);
                if (parentList && parentList.children.length === 0) {
                  parentList.remove();
                }
              }
            }
          } else {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const fragment = range.cloneContents();
              const temp = document.createElement('div');
              temp.appendChild(fragment);

              const blockElems = temp.querySelectorAll('p, div, li, h1, h2, h3, blockquote, pre');
              let lines: string[] = [];

              if (blockElems.length > 0) {
                blockElems.forEach((b) => {
                  const clone = b.cloneNode(true) as HTMLElement;
                  clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
                  const t = clone.textContent?.trim();
                  if (t) lines.push(t);
                });
              }

              if (lines.length === 0) {
                const html = temp.innerHTML;
                lines = html
                  .split(/<br\s*\/?>|\r?\n/i)
                  .map((line) => {
                    const dummy = document.createElement('div');
                    dummy.innerHTML = line;
                    return dummy.textContent?.trim() || '';
                  })
                  .filter((l) => l.length > 0);
              }

              if (lines.length === 0) {
                const fullText = temp.textContent?.trim();
                if (fullText) lines = [fullText];
              }

              if (lines.length > 0) {
                const itemsHtml = lines
                  .map((line) => `<li class="task-list-item"><input type="checkbox" /> ${line}</li>`)
                  .join('');
                const htmlToInsert = `<ul class="contains-task-list">${itemsHtml}</ul><p><br></p>`;
                document.execCommand('insertHTML', false, htmlToInsert);
              } else {
                document.execCommand(
                  'insertHTML',
                  false,
                  '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" /> Task item</li></ul><p><br></p>'
                );
              }
            }
          }
          break;
        }
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

  // Handle key presses inside WYSIWYG editor (Enter clearing styles, Backspace breaking away styles)
  const handleWysiwygKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!wysiwygRef.current) return;

    if (e.key === 'Enter') {
      const info = getCaretBlockAndOffset(wysiwygRef.current);
      if (!info || !info.blockNode) return;
      const { blockNode } = info;
      const tag = blockNode.tagName.toUpperCase();

      // Check if inside task item
      const isTaskItem =
        tag === 'LI' &&
        (blockNode.classList.contains('task-list-item') ||
          blockNode.querySelector('input[type="checkbox"]') !== null ||
          blockNode.closest('ul.contains-task-list') !== null);

      if (isTaskItem) {
        // Clone node and strip checkbox to check text
        const clone = blockNode.cloneNode(true) as HTMLElement;
        const checkbox = clone.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.remove();
        const textContent = clone.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';

        if (textContent === '') {
          // Exit task list mode on Enter on empty tickbox
          e.preventDefault();
          const parentList = blockNode.closest('ul');
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
        } else {
          // Create new tickbox on Enter
          e.preventDefault();
          const newLi = document.createElement('li');
          newLi.className = 'task-list-item';
          newLi.innerHTML = '<input type="checkbox" />&nbsp;';

          if (blockNode.nextSibling) {
            blockNode.parentNode?.insertBefore(newLi, blockNode.nextSibling);
          } else {
            blockNode.parentNode?.appendChild(newLi);
          }

          const range = document.createRange();
          range.selectNodeContents(newLi);
          range.collapse(false);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }

      // Standard List Item (bullet or number)
      if (tag === 'LI') {
        const text = blockNode.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';
        if (text === '') {
          e.preventDefault();
          const parentList = blockNode.closest('ul, ol');
          blockNode.remove();
          if (parentList && parentList.children.length === 0) {
            parentList.remove();
          }
          document.execCommand('insertHTML', false, '<p><br></p>');
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }

      // Heading: Enter converts new line to <p> so user isn't stuck in heading style
      if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
        setTimeout(() => {
          const currentSel = window.getSelection();
          if (currentSel && currentSel.anchorNode) {
            let curr: Node | null = currentSel.anchorNode;
            if (curr.nodeType === Node.TEXT_NODE) curr = curr.parentNode;
            if (curr && (curr as HTMLElement).tagName?.toUpperCase() === tag) {
              document.execCommand('formatBlock', false, '<p>');
              checkActiveFormats();
            }
          }
        }, 0);
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

      // Code Block (PRE or CODE): Enter on empty block or Ctrl/Cmd+Enter escapes code block to paragraph
      if (tag === 'PRE' || tag === 'CODE') {
        const text = blockNode.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';
        if (text === '' || e.ctrlKey || e.metaKey) {
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
        // Backspace at start of LI (bullet/number/task) converts to standard paragraph
        if (tag === 'LI') {
          e.preventDefault();
          const clone = blockNode.cloneNode(true) as HTMLElement;
          const checkbox = clone.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.remove();
          const text = clone.textContent || '';

          const parentList = blockNode.closest('ul, ol');
          const p = document.createElement('p');
          p.textContent = text;
          if (!p.textContent) p.innerHTML = '<br>';

          blockNode.parentNode?.replaceChild(p, blockNode);
          if (parentList && parentList.children.length === 0) {
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
    }
  };

  const handleKeyDownMarkdown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (isCmdOrCtrl) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleFormat('bold');
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleFormat('italic');
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleFormat('heading');
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = note.content;

      const updated = val.substring(0, start) + '  ' + val.substring(end);
      onChangeContent(updated);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagInput.trim().replace(/^#/, '').toLowerCase();
    if (cleanTag && !note.tags.includes(cleanTag)) {
      onAddTag(cleanTag);
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 overflow-hidden bg-white dark:bg-black transition-colors duration-200">
      {/* Top Header Bar: Title, Mode Toggle, Pin, Save status */}
      <div className="p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-2.5 shrink-0 w-full min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0 w-full">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="md:hidden p-1.5 -ml-1 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center space-x-1 text-xs font-semibold shrink-0"
                title="Back to Notes"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden xs:inline">Notes</span>
              </button>
            )}
            <input
              type="text"
              placeholder="Note Title..."
              value={note.title}
              onChange={(e) => onChangeTitle(e.target.value)}
              className="flex-1 min-w-0 text-lg sm:text-2xl font-bold bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none tracking-tight truncate"
            />
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {isSaved && (
              <span className="hidden sm:flex text-[11px] text-neutral-600 dark:text-neutral-300 items-center space-x-1 font-mono bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800">
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Saved</span>
              </span>
            )}

            {/* Single Markdown Mode Toggle Button */}
            <button
              type="button"
              onClick={onToggleEditorMode || (() => setMode(mode === 'wysiwyg' ? 'markdown' : 'wysiwyg'))}
              className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 text-xs font-semibold ${
                mode === 'markdown'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black border-neutral-900 dark:border-neutral-100 shadow-2xs'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-black dark:hover:text-white'
              }`}
              title={mode === 'markdown' ? 'Raw Markdown View Active (Click for WYSIWYG)' : 'Click to Toggle Raw Markdown View'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Markdown</span>
            </button>

            {/* Pin Note */}
            <button
              onClick={onTogglePin}
              title={note.pinned ? 'Unpin note' : 'Pin note'}
              className={`p-1.5 rounded-lg border transition-colors ${
                note.pinned
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black border-neutral-900 dark:border-neutral-100'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <Pin className={`w-4 h-4 ${note.pinned ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tags Row */}
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5 min-w-0 w-full">
          <div className="flex items-center text-xs text-neutral-400 dark:text-neutral-500 mr-1">
            <TagIcon className="w-3.5 h-3.5 mr-1" />
            <span>Tags:</span>
          </div>

          {note.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800"
            >
              #{tag}
              <button
                onClick={() => onRemoveTag(tag)}
                className="ml-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {showTagInput ? (
            <form onSubmit={handleAddTagSubmit} className="inline-flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="tag_name..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onBlur={() => {
                  if (!newTagInput) setShowTagInput(false);
                }}
                className="w-24 px-2 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-900 border border-neutral-400 dark:border-neutral-600 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 transition-colors"
            >
              <Plus className="w-3 h-3 mr-0.5" />
              <span>Add Tag</span>
            </button>
          )}
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="px-2 py-1.5 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center space-x-1 overflow-x-auto min-w-0 w-full shrink-0 select-none"
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('bold')}
          title="Bold (⌘B)"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.bold
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('italic')}
          title="Italic (⌘I)"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.italic
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('heading')}
          title="Heading 1 (⌘H)"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.heading
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('h2')}
          title="Heading 2"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.h2
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-800 mx-1 shrink-0" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('bullet')}
          title="Bullet List"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.bullet
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('number')}
          title="Numbered List"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.number
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('task')}
          title="Task List"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.task
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-800 mx-1 shrink-0" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('code')}
          title="Code Block"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.code
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('quote')}
          title="Blockquote"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.quote
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('link')}
          title="Insert Link"
          className={`p-1.5 rounded transition-colors shrink-0 ${
            activeFormats.link
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-bold shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800'
          }`}
        >
          <Link className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-800 mx-1 shrink-0" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('table')}
          title="Insert Table"
          className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors shrink-0"
        >
          <Table className="w-4 h-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleFormat('hr')}
          title="Horizontal Rule"
          className="p-1.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors shrink-0"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area: WYSIWYG or Raw Markdown */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative min-w-0 w-full">
        {/* Floating Selection Toolbar */}
        {floatingToolbarPos && mode === 'wysiwyg' && (
          <div
            style={{
              top: `${floatingToolbarPos.top}px`,
              left: `${floatingToolbarPos.left}px`,
              transform: 'translateX(-50%)',
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-30 flex items-center bg-neutral-900/95 dark:bg-neutral-800/95 text-white backdrop-blur-md rounded-xl p-1 shadow-2xl border border-neutral-700/80 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat('bold')}
              title="Bold (⌘B)"
              className={`p-1.5 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.bold ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat('italic')}
              title="Italic (⌘I)"
              className={`p-1.5 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.italic ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                document.execCommand('underline', false);
                handleWysiwygInput();
                checkActiveFormats();
              }}
              title="Underline"
              className="p-1.5 rounded-lg transition-colors hover:bg-neutral-700/80 text-neutral-200"
            >
              <Underline className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat('link')}
              title="Insert Link"
              className={`p-1.5 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.link ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Link className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-neutral-700 mx-1" />

            {/* More Menu Toggle (⋮) */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                title="More formatting options"
                className={`p-1.5 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                  isMoreMenuOpen ? 'bg-neutral-700 text-white' : 'text-neutral-200'
                }`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMoreMenuOpen && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute right-0 top-full mt-1.5 w-44 bg-neutral-900 border border-neutral-700 rounded-xl p-1 shadow-2xl flex flex-col space-y-0.5 text-xs text-neutral-200 z-40 animate-in fade-in zoom-in-95"
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('heading');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <Heading1 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Heading 1</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('h2');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <Heading2 className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Heading 2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('bullet');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <List className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Bullet List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('number');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Numbered List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('task');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Task List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('code');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <Code className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Code Block</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('quote');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 px-2.5 py-1.5 hover:bg-neutral-800 rounded-lg text-left"
                  >
                    <Quote className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Quote</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'wysiwyg' ? (
          <div
            ref={wysiwygRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleWysiwygInput}
            onClick={handleWysiwygClick}
            onKeyDown={handleWysiwygKeyDown}
            className="editor-wysiwyg w-full min-h-full outline-none text-neutral-900 dark:text-neutral-100"
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => onChangeContent(e.target.value)}
            onKeyDown={handleKeyDownMarkdown}
            placeholder="Type raw markdown here..."
            className="w-full h-full resize-none bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 font-mono text-sm leading-relaxed focus:outline-none"
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
    </div>
  );
};
