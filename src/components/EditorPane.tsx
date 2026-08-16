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
  Trash2,
  Check,
  Eye,
  FileText,
  Edit3,
  ChevronLeft,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { Note, EditorMode } from '../types';
import { modSymbol } from '../lib/platform';
import { renderMarkdownToHtml, convertHtmlToMarkdown, applyFormatting } from '../lib/markdown';

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
  onDeleteNote,
  onRestoreNote,
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

      const html = renderMarkdownToHtml(note.content);
      // Avoid overwriting if user is actively typing in wysiwyg on the SAME note,
      // but ALWAYS force update innerHTML when switching to a different note.
      if (isDifferentNote || document.activeElement !== wysiwygRef.current) {
        wysiwygRef.current.innerHTML = html || '<p><br></p>';
      }
    }
  }, [note.id, note.content, mode]);

  const focusContent = useCallback(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      wysiwygRef.current.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        const targetNode = wysiwygRef.current.firstElementChild || wysiwygRef.current;
        range.selectNodeContents(targetNode);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else if (mode === 'markdown' && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [mode]);

  // Auto-focus paragraph text when a new note is opened/created
  const prevNoteIdRef = useRef<string>(note.id);
  useEffect(() => {
    const isBrandNewNote = Date.now() - note.createdAt < 3000 || (!note.title && !note.content);
    if (prevNoteIdRef.current !== note.id || isBrandNewNote) {
      prevNoteIdRef.current = note.id;
      if (isBrandNewNote) {
        const timer = setTimeout(() => {
          focusContent();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [note.id, note.createdAt, note.title, note.content, focusContent]);

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

  // Bottom dock selection toolbar state & keyboard offset tracking
  const [hasSelection, setHasSelection] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
        setKeyboardOffset(Math.max(0, offset));
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
    };
  }, []);

  const updateSelectionState = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setHasSelection(false);
      setIsMoreMenuOpen(false);
      return;
    }

    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const isInsideWysiwyg =
        wysiwygRef.current && wysiwygRef.current.contains(range.commonAncestorContainer);
      const isInsideTextarea =
        textareaRef.current &&
        textareaRef.current === document.activeElement &&
        textareaRef.current.selectionStart !== textareaRef.current.selectionEnd;

      if ((mode === 'wysiwyg' && isInsideWysiwyg) || (mode === 'markdown' && isInsideTextarea)) {
        const text = mode === 'wysiwyg' ? range.toString().trim() : 'selected';
        if (text.length > 0) {
          setHasSelection(true);
          return;
        }
      }
    }

    setHasSelection(false);
    setIsMoreMenuOpen(false);
  }, [mode]);

  useEffect(() => {
    const handleSelectionChange = () => {
      setTimeout(updateSelectionState, 10);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateSelectionState]);

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

  const [activeLineText, setActiveLineText] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const updateActiveLineText = useCallback(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current) {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        let node: Node | null = sel.anchorNode;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        while (node && node !== wysiwygRef.current) {
          const tag = (node as HTMLElement).tagName?.toUpperCase();
          if (['P', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'PRE', 'DIV', 'TR'].includes(tag)) {
            const clone = (node as HTMLElement).cloneNode(true) as HTMLElement;
            clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
            const text = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
            setActiveLineText(text);
            return;
          }
          node = node.parentNode;
        }
        setActiveLineText(sel.anchorNode.textContent?.trim() || '');
        return;
      }
    } else if (mode === 'markdown' && textareaRef.current) {
      const textarea = textareaRef.current;
      const pos = textarea.selectionStart;
      const lines = textarea.value.split('\n');
      let count = 0;
      for (const line of lines) {
        if (pos >= count && pos <= count + line.length + 1) {
          setActiveLineText(line.trim());
          return;
        }
        count += line.length + 1;
      }
    }
    setActiveLineText('');
  }, [mode]);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateActiveLineText();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateActiveLineText]);

  const handleQuickCopyLine = () => {
    if (!activeLineText) return;
    navigator.clipboard.writeText(activeLineText);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 1500);
  };

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

  // Unified WYSIWYG block formatting helper
  const applyWysiwygBlockFormat = (targetType: string) => {
    if (!wysiwygRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // Candidate block elements inside wysiwygRef.current
    const allNodes = Array.from(
      wysiwygRef.current.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre, div')
    ) as HTMLElement[];

    // Filter to nodes that intersect range or contain selection endpoints
    let selectedNodes = allNodes.filter((node) => {
      if (node.tagName === 'UL' || node.tagName === 'OL') return false;
      if (node.tagName === 'DIV' && node.querySelector('p, li, h1, h2, h3, blockquote, pre')) return false;

      try {
        return range.intersectsNode(node);
      } catch {
        return false;
      }
    });

    // Fallback if range.intersectsNode didn't catch anything (e.g. collapsed cursor in empty line)
    if (selectedNodes.length === 0 && sel.anchorNode) {
      let curr: Node | null = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentNode : sel.anchorNode;
      const block = (curr as HTMLElement)?.closest('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre, div');
      if (block) {
        selectedNodes = [block as HTMLElement];
      }
    }

    if (selectedNodes.length === 0) return;

    // Helper to determine format of a node
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

    // Extract cleaned content
    const items = selectedNodes.map((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
      let content = clone.innerHTML.trim();
      // Clean off any raw prefix like [ ], [/], [x], [X], •, -, * from HTML string
      content = content.replace(/^(\s*\[[\s\S]?\]|\s*[-*+•])\s*/i, '');
      if (!content) content = '<br>';
      return { node, content };
    });

    // Build new DOM element(s) based on finalFormat
    let newElements: HTMLElement[] = [];

    if (finalFormat === 'task') {
      const ul = document.createElement('ul');
      ul.className = 'contains-task-list';
      items.forEach(({ content }) => {
        const li = document.createElement('li');
        li.className = 'task-list-item';
        li.innerHTML = `<input type="checkbox" /> ${content}`;
        ul.appendChild(li);
      });
      newElements = [ul];
    } else if (finalFormat === 'bullet') {
      const ul = document.createElement('ul');
      items.forEach(({ content }) => {
        const li = document.createElement('li');
        li.innerHTML = content;
        ul.appendChild(li);
      });
      newElements = [ul];
    } else if (finalFormat === 'number') {
      const ol = document.createElement('ol');
      items.forEach(({ content }) => {
        const li = document.createElement('li');
        li.innerHTML = content;
        ol.appendChild(li);
      });
      newElements = [ol];
    } else if (finalFormat === 'heading') {
      newElements = items.map(({ content }) => {
        const h1 = document.createElement('h1');
        h1.innerHTML = content;
        return h1;
      });
    } else if (finalFormat === 'h2') {
      newElements = items.map(({ content }) => {
        const h2 = document.createElement('h2');
        h2.innerHTML = content;
        return h2;
      });
    } else if (finalFormat === 'quote') {
      newElements = items.map(({ content }) => {
        const bq = document.createElement('blockquote');
        bq.innerHTML = content;
        return bq;
      });
    } else if (finalFormat === 'code') {
      const pre = document.createElement('pre');
      pre.innerHTML = items.map((i) => i.content).join('<br>');
      newElements = [pre];
    } else {
      // paragraph
      newElements = items.map(({ content }) => {
        const p = document.createElement('p');
        p.innerHTML = content;
        return p;
      });
    }

    // Insert newElements at exact position and cleanup selectedNodes
    const firstNode = selectedNodes[0];
    const firstParentList = firstNode.tagName === 'LI' ? firstNode.parentElement : null;

    if (firstParentList && (firstParentList.tagName === 'UL' || firstParentList.tagName === 'OL')) {
      const allLis = Array.from(firstParentList.children) as HTMLElement[];
      const selectedLisInFirstList = selectedNodes.filter((n) => n.parentElement === firstParentList);

      const firstSelIdx = allLis.indexOf(selectedLisInFirstList[0]);
      const lastSelIdx = allLis.indexOf(selectedLisInFirstList[selectedLisInFirstList.length - 1]);

      const unselectedBefore = allLis.slice(0, firstSelIdx);
      const unselectedAfter = allLis.slice(lastSelIdx + 1);

      if (unselectedAfter.length > 0) {
        const trailingList = document.createElement(firstParentList.tagName) as HTMLElement;
        trailingList.className = firstParentList.className;
        unselectedAfter.forEach((li) => trailingList.appendChild(li));
        if (firstParentList.nextSibling) {
          firstParentList.parentNode?.insertBefore(trailingList, firstParentList.nextSibling);
        } else {
          firstParentList.parentNode?.appendChild(trailingList);
        }
      }

      if (unselectedBefore.length > 0) {
        // Insert newElements after firstParentList
        newElements.slice().reverse().forEach((el) => {
          if (firstParentList.nextSibling) {
            firstParentList.parentNode?.insertBefore(el, firstParentList.nextSibling);
          } else {
            firstParentList.parentNode?.appendChild(el);
          }
        });
      } else {
        // Insert newElements before firstParentList
        newElements.forEach((el) => {
          firstParentList.parentNode?.insertBefore(el, firstParentList);
        });
      }
    } else {
      // Top level block element
      const topLevelAnchor = firstNode;
      newElements.forEach((el) => {
        topLevelAnchor.parentNode?.insertBefore(el, topLevelAnchor);
      });
    }

    // Now remove all selectedNodes and cleanup empty parent lists
    const listsToCheck = new Set<HTMLElement>();
    selectedNodes.forEach((node) => {
      if (node.tagName === 'LI' && node.parentElement) {
        listsToCheck.add(node.parentElement as HTMLElement);
      }
      node.remove();
    });

    listsToCheck.forEach((list) => {
      if (list.children.length === 0) {
        list.remove();
      }
    });

    handleWysiwygInput();
    checkActiveFormats();
  };

  // Formatting actions
  const handleFormat = (
    type: 'bold' | 'italic' | 'heading' | 'h2' | 'code' | 'quote' | 'link' | 'bullet' | 'number' | 'task' | 'paragraph' | 'table' | 'hr'
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

  // Handle key presses inside WYSIWYG editor (Enter clearing styles, Backspace breaking away styles)
  const handleWysiwygKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!wysiwygRef.current) return;

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
      <div className="p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 w-full min-w-0 bg-neutral-50/50 dark:bg-neutral-950/50">
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
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Editor Mode Readout Toggle */}
            <button
              type="button"
              onClick={() => setMode(mode === 'wysiwyg' ? 'markdown' : 'wysiwyg')}
              title={`Switch to ${mode === 'wysiwyg' ? 'Markdown' : 'Rich Text'} mode`}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 transition-colors flex items-center space-x-1"
            >
              <span>{mode === 'wysiwyg' ? 'Rich Text' : 'Markdown'}</span>
            </button>

            {isSaved && (
              <span className="hidden sm:flex text-[11px] text-neutral-600 dark:text-neutral-300 items-center space-x-1 font-mono bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800">
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Saved</span>
              </span>
            )}

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

            {/* Three Dot Menu Button */}
            <button
              type="button"
              onClick={() => setIsSlideoutOpen(true)}
              title="More Actions & Options"
              className={`p-1.5 rounded-lg border transition-colors flex items-center space-x-1 ${
                isSlideoutOpen
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black border-neutral-900 dark:border-neutral-100'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white border-neutral-200 dark:border-neutral-800'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
              {note.tags.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          </div>
        </div>
      </div>



      {/* Content Area: Title + WYSIWYG or Raw Markdown */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto relative min-w-0 w-full flex flex-col">
        {/* Title inside the Editor Box */}
        <div className="mb-4 pb-2 border-b border-neutral-100 dark:border-neutral-900 shrink-0">
          <input
            type="text"
            placeholder="Title"
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
        </div>

        {/* Permanent Docked Editing Toolbar */}
        <div
          style={{
            bottom: `${keyboardOffset}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed inset-x-0 z-50 bg-neutral-900/95 dark:bg-neutral-800/95 text-white backdrop-blur-md border-t border-neutral-700/80 px-4 py-2 flex items-center justify-center shadow-2xl animate-in slide-in-from-bottom-2 duration-150 select-none"
        >
          <div className="flex items-center space-x-2 sm:space-x-3 max-w-xs sm:max-w-md w-full justify-around">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat('bold')}
              title={`Bold (${modSymbol}B)`}
              className={`p-2 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.bold ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat('italic')}
              title={`Italic (${modSymbol}I)`}
              className={`p-2 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.italic ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (mode === 'wysiwyg') {
                  document.execCommand('underline', false);
                  handleWysiwygInput();
                  checkActiveFormats();
                } else {
                  handleFormat('bold');
                }
              }}
              title="Underline"
              className={`p-2 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.underline ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Underline className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat('link')}
              title="Insert Link"
              className={`p-2 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                activeFormats.link ? 'text-blue-400 font-bold bg-neutral-700' : 'text-neutral-200'
              }`}
            >
              <Link className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-neutral-700 my-auto" />

            {/* Submenu Toggle (⋮) */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                title="More formatting options"
                className={`p-2 rounded-lg transition-colors hover:bg-neutral-700/80 ${
                  isMoreMenuOpen ||
                  activeFormats.heading ||
                  activeFormats.h2 ||
                  activeFormats.bullet ||
                  activeFormats.number ||
                  activeFormats.task ||
                  activeFormats.code ||
                  activeFormats.quote
                    ? 'bg-neutral-700 text-blue-400 font-bold'
                    : 'text-neutral-200'
                }`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Submenu opens UPWARD above the bottom bar */}
              {isMoreMenuOpen && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute right-0 bottom-full mb-2.5 w-52 bg-neutral-900 border border-neutral-700 rounded-xl p-1.5 shadow-2xl flex flex-col space-y-0.5 text-xs text-neutral-200 z-50 animate-in fade-in slide-in-from-bottom-2 duration-100 max-h-64 overflow-y-auto"
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('heading');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.heading ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <Heading1 className="w-4 h-4 text-neutral-400" />
                    <span>Heading 1</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('h2');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.h2 ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <Heading2 className="w-4 h-4 text-neutral-400" />
                    <span>Heading 2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('bullet');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.bullet ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <List className="w-4 h-4 text-neutral-400" />
                    <span>Bullet List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('number');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.number ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <ListOrdered className="w-4 h-4 text-neutral-400" />
                    <span>Numbered List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('task');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.task ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4 text-neutral-400" />
                    <span>Task List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('code');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.code ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <Code className="w-4 h-4 text-neutral-400" />
                    <span>Code Block</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('quote');
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeFormats.quote ? 'bg-neutral-800 text-blue-400 font-semibold' : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <Quote className="w-4 h-4 text-neutral-400" />
                    <span>Quote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('table');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2.5 px-3 py-2 text-neutral-200 hover:bg-neutral-800 rounded-lg text-left transition-colors"
                  >
                    <Table className="w-4 h-4 text-neutral-400" />
                    <span>Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleFormat('hr');
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex items-center space-x-2.5 px-3 py-2 text-neutral-200 hover:bg-neutral-800 rounded-lg text-left transition-colors"
                  >
                    <Minus className="w-4 h-4 text-neutral-400" />
                    <span>Horizontal Line</span>
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-neutral-700 my-auto" />

            {/* Quick Copy Line Button */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleQuickCopyLine}
              disabled={!activeLineText}
              title={
                activeLineText
                  ? `Quick copy line: "${activeLineText.slice(0, 30)}${activeLineText.length > 30 ? '...' : ''}"`
                  : 'Quick copy line (place cursor on a line with text)'
              }
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                activeLineText
                  ? 'text-neutral-100 hover:bg-neutral-700/80 cursor-pointer opacity-100'
                  : 'text-neutral-500 opacity-40 cursor-not-allowed'
              }`}
            >
              {copiedFeedback ? (
                <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in-50 duration-150" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

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

      {/* Slideout Drawer Window */}
      {isSlideoutOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsSlideoutOpen(false)}
            className="absolute inset-0 bg-black/20 dark:bg-black/50 z-30 transition-opacity backdrop-blur-[1px]"
          />

          {/* Slideout Drawer Panel */}
          <div className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl z-40 flex flex-col transform transition-transform duration-200 ease-in-out animate-in slide-in-from-right">
            {/* Header */}
            <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Note Options
              </span>
              <button
                onClick={() => setIsSlideoutOpen(false)}
                className="p-1 text-neutral-500 hover:text-black dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                title="Close Options"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-5 flex-1 overflow-y-auto">
              {/* Tags Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center space-x-1.5">
                    <TagIcon className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Tags ({note.tags.length})</span>
                  </span>
                </div>

                {/* Current Note Tags */}
                {note.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700/60"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => onRemoveTag(tag)}
                          className="ml-1 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-0.5 rounded"
                          title={`Remove #${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">No tags attached to this note</p>
                )}

                {/* Add Tag & Existing Tags Dropdown */}
                <div ref={tagDropdownRef} className="relative pt-1">
                  <div className="relative flex items-center">
                    <Plus className="w-3.5 h-3.5 absolute left-2.5 text-neutral-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Add tag or select existing..."
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
                      className="w-full pl-8 pr-8 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600 font-mono"
                    />
                    {tagInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setTagInput('');
                          setIsTagDropdownOpen(false);
                        }}
                        className="absolute right-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Menu of Existing Tags */}
                  {isTagDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1 text-xs animate-in fade-in slide-in-from-top-1 duration-100">
                      {availableExistingTags.length > 0 && (
                        <div className="p-1 space-y-0.5">
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                            Select Existing Tag
                          </div>
                          {availableExistingTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleAddTag(tag)}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between text-neutral-800 dark:text-neutral-200 font-mono transition-colors"
                            >
                              <span>{tag}</span>
                              <Plus className="w-3 h-3 text-neutral-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {cleanTypedTag && !note.tags.includes(cleanTypedTag) && (
                        <button
                          type="button"
                          onClick={() => handleAddTag(cleanTypedTag)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono font-bold flex items-center justify-between transition-colors mt-0.5"
                        >
                          <span>Add new tag "#{cleanTypedTag}"</span>
                          <Plus className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                      )}

                      {availableExistingTags.length === 0 && (!cleanTypedTag || note.tags.includes(cleanTypedTag)) && (
                        <div className="p-3 text-center text-xs text-neutral-400 dark:text-neutral-500 italic">
                          No existing tags to select. Type to create a new tag.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-neutral-200 dark:border-neutral-800" />

              {/* Trash / Restore Actions */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Actions
                </span>
                {note.deletedAt ? (
                  onRestoreNote && (
                    <button
                      type="button"
                      onClick={() => {
                        onRestoreNote();
                        setIsSlideoutOpen(false);
                      }}
                      className="w-full p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center justify-center space-x-2 text-xs font-bold"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Restore Note</span>
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
                      className="w-full p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center space-x-2 text-xs font-bold"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Move to Trash</span>
                    </button>
                  )
                )}
              </div>

              <hr className="border-neutral-200 dark:border-neutral-800" />

              {/* Note Metadata */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs space-y-2">
                <span className="font-semibold text-neutral-500 dark:text-neutral-400 block text-[10px] uppercase tracking-wider">
                  Note Info
                </span>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Created:</span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {new Date(note.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Last Edited:</span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Words:</span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {note.content.trim() ? note.content.trim().split(/\s+/).length : 0}
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Characters:</span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                    {note.content.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
