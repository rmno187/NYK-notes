import React, { useCallback } from 'react';
import { ActiveFormats, FormatActionType } from './types';
import { renderMarkdownToHtml, convertHtmlToMarkdown } from '../../lib/markdown';
import {
  getCaretCharacterOffsetWithin,
  setCaretCharacterOffsetWithin,
  getCaretBlockAndOffset,
  stripLeadingPrefixFromFragment,
  applyInlineMarkdownFormatting,
  wrapSelectedTextWithDelimiters,
  createMarkdownTableFromHeader,
  handleTableNavigation,
} from './editorUtils';

interface UseWysiwygHandlersProps {
  wysiwygRef: React.RefObject<HTMLDivElement>;
  onChangeContent: (content: string) => void;
  pushHistory: (newContent: string, selStart?: number, selEnd?: number, customHtml?: string) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  activeFormats: ActiveFormats;
  setActiveFormats: React.Dispatch<React.SetStateAction<ActiveFormats>>;
  onOpenLinkModal: (initialText: string, range: Range | null) => void;
  onOpenImageModal?: () => void;
}

export function useWysiwygHandlers({
  wysiwygRef,
  onChangeContent,
  pushHistory,
  handleUndo,
  handleRedo,
  activeFormats,
  setActiveFormats,
  onOpenLinkModal,
  onOpenImageModal,
}: UseWysiwygHandlersProps) {
  // Check active formatting at cursor selection
  const checkActiveFormats = useCallback(() => {
    if (!wysiwygRef.current) return;

    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isStrike = false;
    let isBullet = false;
    let isNumber = false;

    try {
      isBold = document.queryCommandState('bold');
      isItalic = document.queryCommandState('italic');
      isUnderline = document.queryCommandState('underline');
      isStrike = document.queryCommandState('strikeThrough');
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
        if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') isStrike = true;
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
      strike: isStrike,
      heading: isHeading,
      h2: isH2,
      bullet: isBullet && !isTask,
      number: isNumber,
      task: isTask,
      quote: isQuote,
      code: isCode,
      link: isLink,
    });
  }, [wysiwygRef, setActiveFormats]);

  // Handle direct editing in WYSIWYG contentEditable div
  const handleWysiwygInput = useCallback(() => {
    if (!wysiwygRef.current) return;
    // Synchronize the 'checked' attribute on all checkbox inputs with their current .checked state
    wysiwygRef.current.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      const cb = input as HTMLInputElement;
      if (cb.checked) {
        cb.setAttribute('checked', 'checked');
      } else {
        cb.removeAttribute('checked');
      }
    });
    const html = wysiwygRef.current.innerHTML;
    const markdown = convertHtmlToMarkdown(html);
    const offset = getCaretCharacterOffsetWithin(wysiwygRef.current);
    pushHistory(markdown, offset, offset, html);
    onChangeContent(markdown);
  }, [wysiwygRef, onChangeContent, pushHistory]);

  // Handle interactive clicks inside WYSIWYG (e.g., checking/unchecking task checkboxes)
  const handleWysiwygClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        const cb = target as HTMLInputElement;
        // In contenteditable, clicking a checkbox fires the click event.
        // Sync the checked attribute immediately with cb.checked
        if (cb.checked) {
          cb.setAttribute('checked', 'checked');
        } else {
          cb.removeAttribute('checked');
        }

        if (wysiwygRef.current) {
          wysiwygRef.current.querySelectorAll('input[type="checkbox"]').forEach((input) => {
            const el = input as HTMLInputElement;
            if (el.checked) {
              el.setAttribute('checked', 'checked');
            } else {
              el.removeAttribute('checked');
            }
          });
          const html = wysiwygRef.current.innerHTML;
          const markdown = convertHtmlToMarkdown(html);
          onChangeContent(markdown);
          checkActiveFormats();
        }
      }
    },
    [wysiwygRef, onChangeContent, checkActiveFormats]
  );

  // Handle Paste in WYSIWYG editor
  const handleWysiwygPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const rawHtml = clipboardData.getData('text/html');
      const plainText = clipboardData.getData('text/plain');

      let htmlToInsert = '';

      if (rawHtml) {
        const markdown = convertHtmlToMarkdown(rawHtml);
        if (markdown && markdown.trim()) {
          htmlToInsert = renderMarkdownToHtml(markdown).trim();
        }
      }

      if (!htmlToInsert && plainText) {
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
          htmlToInsert = htmlToInsert
            .replace(/<p><br><\/p>/gi, '<br>')
            .replace(/<p>/gi, '')
            .replace(/<\/p>/gi, '<br>')
            .replace(/<br>$/, '');
        } else if (isInsideHeading) {
          htmlToInsert = htmlToInsert
            .replace(/<\/?(?:p|div|h[1-6]|ul|ol|li|blockquote|pre)[^>]*>/gi, ' ')
            .trim();
        }
      }

      if (htmlToInsert) {
        const success = document.execCommand('insertHTML', false, htmlToInsert);
        if (!success) {
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
    [wysiwygRef, handleWysiwygInput, checkActiveFormats]
  );

  // Unified WYSIWYG block formatting engine - Single Source of Truth for all styling
  const applyWysiwygBlockFormat = useCallback(
    (
      targetType: string,
      options?: {
        nodes?: HTMLElement[];
        mode?: 'toggle' | 'apply';
        caretPlacement?: 'start' | 'end' | 'preserve';
        checked?: boolean;
      }
    ) => {
      if (!wysiwygRef.current) return;
      wysiwygRef.current.focus();

      const sel = window.getSelection();
      const mode = options?.mode || 'toggle';
      const caretPlacement = options?.caretPlacement || 'preserve';
      const savedCaretOffset = getCaretCharacterOffsetWithin(wysiwygRef.current);

      // Convert loose text nodes in root into paragraphs
      (Array.from(wysiwygRef.current.childNodes) as ChildNode[]).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
          const p = document.createElement('p');
          p.textContent = child.textContent;
          child.replaceWith(p);
        }
      });

      let selectedNodes: HTMLElement[] = [];
      if (options?.nodes && options.nodes.length > 0) {
        selectedNodes = options.nodes;
      } else {
        const allBlocks = Array.from(
          wysiwygRef.current.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre')
        ) as HTMLElement[];

        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          selectedNodes = allBlocks.filter((node) => {
            if (node.tagName === 'DIV') return false;
            try {
              return range.intersectsNode(node);
            } catch {
              return false;
            }
          });

          if (selectedNodes.length === 0 && sel.anchorNode) {
            let curr: Node | null =
              sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentNode : sel.anchorNode;
            const block = (curr as HTMLElement)?.closest('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre');
            if (block && wysiwygRef.current.contains(block)) {
              selectedNodes = [block as HTMLElement];
            }
          }
        }
      }

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
        const tag = node.tagName.toLowerCase();
        if (tag === 'h1') return 'heading';
        if (tag === 'h2') return 'h2';
        if (tag === 'h3') return 'h3';
        if (tag === 'h4') return 'h4';
        if (tag === 'h5') return 'h5';
        if (tag === 'h6') return 'h6';
        if (tag === 'blockquote') return 'quote';
        if (tag === 'pre') return 'code';
        return 'paragraph';
      };

      const normalizedTarget = targetType === 'h1' ? 'heading' : targetType;
      const allMatch = selectedNodes.every((node) => getNodeFormat(node) === normalizedTarget);
      const finalFormat = mode === 'toggle' && allMatch ? 'paragraph' : normalizedTarget;

      const getCleanContent = (node: HTMLElement) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
        let content = clone.innerHTML.trim();
        content = content.replace(/^(\s*(?:[-*+•]\s*)?\[[ x_]?\]|\s*[-*+•])\s*/i, '');
        if (!content) content = '<br>';
        return content;
      };

      const isTargetList = finalFormat === 'task' || finalFormat === 'bullet' || finalFormat === 'number';
      let lastCreatedNode: HTMLElement | null = null;

      if (isTargetList) {
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
            const textVal = node.textContent || '';
            const isInitiallyChecked =
              options?.checked !== undefined
                ? options.checked
                : /^\s*(?:[-*+•]\s*)?\[x\]/i.test(textVal) ||
                  Boolean((node.querySelector('input[type="checkbox"]') as HTMLInputElement)?.checked);

            const li = document.createElement('li');
            if (finalFormat === 'task') {
              li.className = 'task-list-item';
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.setAttribute('contenteditable', 'false');
              if (isInitiallyChecked) {
                cb.checked = true;
                cb.setAttribute('checked', 'checked');
              }
              li.appendChild(cb);
              li.appendChild(document.createTextNode(' '));
              if (content === '<br>') {
                li.appendChild(document.createElement('br'));
              } else {
                const temp = document.createElement('span');
                temp.innerHTML = content;
                while (temp.firstChild) {
                  li.appendChild(temp.firstChild);
                }
              }
            } else {
              li.innerHTML = content;
            }
            listEl.appendChild(li);
            lastCreatedNode = li;
          });

          const parentList = first.tagName === 'LI' ? first.parentElement : null;
          if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
            parentList.replaceWith(listEl);
          } else {
            first.replaceWith(listEl);
            group.slice(1).forEach((node) => node.remove());
          }
        });
      } else {
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
            case 'h3':
              newBlock = document.createElement('h3');
              newBlock.innerHTML = content;
              break;
            case 'h4':
              newBlock = document.createElement('h4');
              newBlock.innerHTML = content;
              break;
            case 'h5':
              newBlock = document.createElement('h5');
              newBlock.innerHTML = content;
              break;
            case 'h6':
              newBlock = document.createElement('h6');
              newBlock.innerHTML = content;
              break;
            case 'quote':
              newBlock = document.createElement('blockquote');
              newBlock.innerHTML = `<p>${content}</p>`;
              break;
            case 'code':
              newBlock = document.createElement('pre');
              newBlock.innerHTML = `<code>${content === '<br>' ? '' : content}</code>`;
              break;
            default:
              newBlock = document.createElement('p');
              newBlock.innerHTML = content;
              break;
          }
          lastCreatedNode = newBlock;

          if (node.tagName === 'LI' && node.parentElement) {
            const listParent = node.parentElement;
            const allLis = Array.from(listParent.children);
            const idx = allLis.indexOf(node);

            if (allLis.length === 1) {
              listParent.replaceWith(newBlock);
            } else if (idx === 0) {
              listParent.before(newBlock);
              node.remove();
            } else if (idx === allLis.length - 1) {
              listParent.after(newBlock);
              node.remove();
            } else {
              const secondList = document.createElement(listParent.tagName);
              secondList.className = listParent.className;
              allLis.slice(idx + 1).forEach((li) => secondList.appendChild(li));
              node.remove();
              listParent.after(newBlock);
              newBlock.after(secondList);
            }
          } else {
            node.replaceWith(newBlock);
          }
        });
      }

      wysiwygRef.current.querySelectorAll('ul, ol').forEach((list) => {
        if (list.children.length === 0) {
          list.remove();
        }
      });

      if (!wysiwygRef.current.hasChildNodes() || wysiwygRef.current.innerHTML.trim() === '') {
        wysiwygRef.current.innerHTML = '<p><br></p>';
      }

      wysiwygRef.current.focus();

      if (caretPlacement === 'start' && lastCreatedNode) {
        const targetRange = document.createRange();
        if (finalFormat === 'task' && (lastCreatedNode as HTMLElement).childNodes.length > 2) {
          targetRange.setStart((lastCreatedNode as HTMLElement).childNodes[2], 0);
        } else if (finalFormat === 'quote') {
          const innerP = (lastCreatedNode as HTMLElement).querySelector('p') || lastCreatedNode;
          targetRange.selectNodeContents(innerP);
          targetRange.collapse(true);
        } else if (finalFormat === 'code') {
          const innerCode = (lastCreatedNode as HTMLElement).querySelector('code') || lastCreatedNode;
          targetRange.selectNodeContents(innerCode);
          targetRange.collapse(true);
        } else {
          targetRange.selectNodeContents(lastCreatedNode);
          targetRange.collapse(true);
        }
        const s = window.getSelection();
        if (s) {
          s.removeAllRanges();
          s.addRange(targetRange);
        }
      } else {
        setCaretCharacterOffsetWithin(wysiwygRef.current, savedCaretOffset);
      }

      handleWysiwygInput();
      checkActiveFormats();
    },
    [wysiwygRef, handleWysiwygInput, checkActiveFormats]
  );

  const handleWysiwygFormatAction = useCallback(
    (type: FormatActionType) => {
      if (!wysiwygRef.current) return;
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
        case 'strike':
          document.execCommand('strikeThrough', false);
          break;
        case 'clear': {
          document.execCommand('removeFormat', false);
          document.execCommand('unlink', false);
          if (document.queryCommandState('strikeThrough')) {
            document.execCommand('strikeThrough', false);
          }
          const sel = window.getSelection();
          if (sel && sel.anchorNode) {
            let node: Node | null = sel.anchorNode;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
            while (node && node !== wysiwygRef.current) {
              const tag = (node as HTMLElement).tagName?.toUpperCase();
              if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'].includes(tag)) {
                document.execCommand('formatBlock', false, '<p>');
                break;
              }
              node = node.parentNode;
            }
          }
          break;
        }
        case 'paragraph':
        case 'heading':
        case 'h2':
        case 'quote':
        case 'code':
        case 'bullet':
        case 'number':
        case 'task':
          applyWysiwygBlockFormat(type, { mode: 'toggle' });
          break;
        case 'link': {
          if (activeFormats.link) {
            document.execCommand('unlink', false);
            handleWysiwygInput();
            checkActiveFormats();
          } else {
            const sel = window.getSelection();
            let text = '';
            let rangeToSave: Range | null = null;
            if (sel && sel.rangeCount > 0) {
              rangeToSave = sel.getRangeAt(0).cloneRange();
              text = rangeToSave.toString();
            }
            onOpenLinkModal(text, rangeToSave);
          }
          break;
        }
        case 'image': {
          if (onOpenImageModal) {
            onOpenImageModal();
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
    },
    [wysiwygRef, activeFormats.link, applyWysiwygBlockFormat, handleWysiwygInput, checkActiveFormats, onOpenLinkModal, onOpenImageModal]
  );

  // Handle key presses inside WYSIWYG editor
  const handleWysiwygKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
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

      // Formatting shortcuts: Cmd+B, Cmd+I, Cmd+U, Cmd+K, Cmd+Shift+X (strikethrough), Cmd+Shift+C (code), Cmd+Shift+H (highlight)
      if (isCmdOrCtrl) {
        if (keyLower === 'b') {
          e.preventDefault();
          document.execCommand('bold', false);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
        if (keyLower === 'i') {
          e.preventDefault();
          document.execCommand('italic', false);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
        if (keyLower === 'u') {
          e.preventDefault();
          document.execCommand('underline', false);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
        if (keyLower === 'k') {
          e.preventDefault();
          const sel = window.getSelection();
          let text = '';
          let rangeToSave: Range | null = null;
          if (sel && sel.rangeCount > 0) {
            rangeToSave = sel.getRangeAt(0).cloneRange();
            text = rangeToSave.toString();
          }
          onOpenLinkModal(text, rangeToSave);
          return;
        }
        if (e.shiftKey && (keyLower === 'x' || keyLower === 's')) {
          e.preventDefault();
          document.execCommand('strikeThrough', false);
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
        if (e.shiftKey && keyLower === 'c') {
          e.preventDefault();
          applyWysiwygBlockFormat('code', { mode: 'toggle' });
          return;
        }
        if (e.shiftKey && keyLower === 'h') {
          e.preventDefault();
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) {
            wrapSelectedTextWithDelimiters(wysiwygRef.current, '==', '==');
            applyInlineMarkdownFormatting(wysiwygRef.current);
            handleWysiwygInput();
            checkActiveFormats();
          }
          return;
        }
        if (e.key === '\\') {
          e.preventDefault();
          handleWysiwygFormatAction('clear');
          return;
        }
      }

      // Handle table navigation (Tab, Shift+Tab, Enter in table cells)
      if (handleTableNavigation(e, wysiwygRef.current)) {
        handleWysiwygInput();
        checkActiveFormats();
        return;
      }

      // Selection auto-wrapping with Markdown delimiter pairs: *, _, `, ~, [, (, ", ', =
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && !e.metaKey && !e.ctrlKey && !e.altKey) {
        let wrapped = false;
        if (e.key === '*') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '*', '*');
        } else if (e.key === '_') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '_', '_');
        } else if (e.key === '`') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '`', '`');
        } else if (e.key === '~') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '~~', '~~');
        } else if (e.key === '[') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '[', ']');
        } else if (e.key === '(') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '(', ')');
        } else if (e.key === '"') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '"', '"');
        } else if (e.key === "'") {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, "'", "'");
        } else if (e.key === '=') {
          wrapped = wrapSelectedTextWithDelimiters(wysiwygRef.current, '==', '==');
        }

        if (wrapped) {
          e.preventDefault();
          handleWysiwygInput();
          checkActiveFormats();
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const info = getCaretBlockAndOffset(wysiwygRef.current);

        if (info && info.blockNode) {
          const { blockNode } = info;
          const tag = blockNode.tagName.toUpperCase();

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

        if (e.shiftKey) {
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

      // Markdown shortcut on Space (e.g., "# ", "## ", "> ", "- ", "1. ", "[] ", "``` ", "--- ")
      if (e.key === ' ') {
        const info = getCaretBlockAndOffset(wysiwygRef.current);
        if (info && info.blockNode) {
          const { blockNode } = info;
          const tag = blockNode.tagName.toUpperCase();

          if (tag === 'P' || tag === 'DIV') {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
              const range = sel.getRangeAt(0);
              const preRange = document.createRange();
              preRange.selectNodeContents(blockNode);
              preRange.setEnd(range.startContainer, range.startOffset);
              const textBefore = preRange.toString().replace(/\u00A0/g, ' ');

              // 1. Horizontal Rule on Space
              if (/^(\s*(?:---|---|\*\*\*|___))$/.test(textBefore)) {
                e.preventDefault();
                const hr = document.createElement('hr');
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                blockNode.parentNode?.insertBefore(hr, blockNode);
                blockNode.parentNode?.insertBefore(p, blockNode);
                blockNode.remove();
                const r = document.createRange();
                r.selectNodeContents(p);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
                handleWysiwygInput();
                checkActiveFormats();
                return;
              }

              // 2. Fenced Code Block on Space: ``` or ```lang
              const codeMatch = textBefore.match(/^(\s*`{3}([a-zA-Z0-9_-]*))$/);
              if (codeMatch) {
                e.preventDefault();
                const lang = codeMatch[2] || '';
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                if (lang) {
                  code.className = `language-${lang}`;
                  code.setAttribute('data-language', lang);
                }
                code.innerHTML = '<br>';
                pre.appendChild(code);
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                blockNode.parentNode?.insertBefore(pre, blockNode);
                blockNode.parentNode?.insertBefore(p, blockNode);
                blockNode.remove();
                const r = document.createRange();
                r.selectNodeContents(code);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
                handleWysiwygInput();
                checkActiveFormats();
                return;
              }

              let matchedFormat: string | null = null;
              let isTaskChecked = false;

              const taskSpaceMatch = textBefore.match(/^(\s*(?:[-*+•]\s*)?\[([ x_]?)\])$/i);
              if (taskSpaceMatch) {
                matchedFormat = 'task';
                isTaskChecked = taskSpaceMatch[2]?.toLowerCase() === 'x';
              } else if (/^(\s*#{1,6})$/.test(textBefore)) {
                const level = textBefore.trim().length;
                matchedFormat = `h${level}`;
              } else if (/^(\s*>+)$/.test(textBefore)) {
                matchedFormat = 'quote';
              } else if (/^(\s*\d+[.)])$/.test(textBefore)) {
                matchedFormat = 'number';
              } else if (/^(\s*[-*+•])$/.test(textBefore)) {
                matchedFormat = 'bullet';
              }

              if (matchedFormat) {
                e.preventDefault();
                preRange.deleteContents();
                applyWysiwygBlockFormat(matchedFormat, {
                  nodes: [blockNode],
                  mode: 'apply',
                  checked: isTaskChecked,
                  caretPlacement: 'start',
                });
                return;
              }
            }
          }
        }

        // Trigger inline markdown parsing after space
        setTimeout(() => {
          if (wysiwygRef.current) {
            const formatted = applyInlineMarkdownFormatting(wysiwygRef.current);
            if (formatted) {
              handleWysiwygInput();
              checkActiveFormats();
            }
          }
        }, 0);
      }

      // Check for inline markdown completion triggers on closing characters or punctuation
      if (['*', '_', '`', '~', '=', ')', ']', ',', '.', ';', '!', '?'].includes(e.key)) {
        setTimeout(() => {
          if (wysiwygRef.current) {
            const formatted = applyInlineMarkdownFormatting(wysiwygRef.current);
            if (formatted) {
              handleWysiwygInput();
              checkActiveFormats();
            }
          }
        }, 0);
      }

      if (e.key === 'Enter') {
        const info = getCaretBlockAndOffset(wysiwygRef.current);
        if (!info || !info.blockNode) return;
        const { blockNode } = info;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);

        // 1. List Item Handling (UL / OL / Task lists)
        const targetLi = blockNode.tagName.toUpperCase() === 'LI' ? blockNode : blockNode.closest('li');
        if (targetLi) {
          e.preventDefault();

          // Shift+Enter in list item: continue text on a new line within the same list item
          if (e.shiftKey) {
            range.deleteContents();
            const br = document.createElement('br');
            range.insertNode(br);

            // In contenteditable, if br is at the end of targetLi, ensure there is a trailing br so caret can be placed
            let next = br.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && next.textContent === '') {
              next = next.nextSibling;
            }
            if (!next) {
              const placeholderBr = document.createElement('br');
              br.parentNode?.appendChild(placeholderBr);
            }

            const newRange = document.createRange();
            newRange.setStartAfter(br);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          const isTaskItem =
            targetLi.classList.contains('task-list-item') ||
            targetLi.querySelector('input[type="checkbox"]') !== null ||
            targetLi.closest('ul.contains-task-list') !== null;

          const clone = targetLi.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
          const textContent = clone.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';

          // If list item is empty (e.g. Enter pressed twice in list): CANCEL/EXIT LIST
          if (textContent === '') {
            const parentList = targetLi.closest('ul, ol');
            const p = document.createElement('p');
            p.innerHTML = '<br>';

            if (parentList) {
              const allLis = Array.from(parentList.children) as HTMLElement[];
              const currIdx = allLis.indexOf(targetLi);
              const lisBefore = allLis.slice(0, currIdx);
              const lisAfter = allLis.slice(currIdx + 1);

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

              if (parentList.nextSibling) {
                parentList.parentNode?.insertBefore(p, parentList.nextSibling);
              } else {
                parentList.parentNode?.appendChild(p);
              }

              targetLi.remove();

              if (lisBefore.length === 0) {
                parentList.remove();
              }
            } else if (wysiwygRef.current) {
              targetLi.parentNode?.replaceChild(p, targetLi);
            }

            const targetRange = document.createRange();
            targetRange.selectNodeContents(p);
            targetRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(targetRange);

            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          // Non-empty list item: split or continue
          const preRange = document.createRange();
          preRange.selectNodeContents(targetLi);
          preRange.setEnd(range.startContainer, range.startOffset);
          const beforeFrag = preRange.cloneContents();

          const postRange = document.createRange();
          postRange.selectNodeContents(targetLi);
          postRange.setStart(range.endContainer, range.endOffset);
          const afterFrag = postRange.cloneContents();

          const beforeTemp = document.createElement('div');
          beforeTemp.appendChild(beforeFrag.cloneNode(true));
          beforeTemp.querySelectorAll('input[type="checkbox"]').forEach((c) => c.remove());
          const beforeText = beforeTemp.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';

          const afterTemp = document.createElement('div');
          afterTemp.appendChild(afterFrag.cloneNode(true));
          afterTemp.querySelectorAll('input[type="checkbox"]').forEach((c) => c.remove());
          const afterText = afterTemp.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';

          const newLi = document.createElement('li');
          if (isTaskItem) {
            newLi.className = 'task-list-item';
          }

          if (beforeText === '') {
            if (isTaskItem) {
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.setAttribute('contenteditable', 'false');
              newLi.appendChild(cb);
              newLi.appendChild(document.createTextNode(' '));
              newLi.appendChild(document.createElement('br'));
            } else {
              newLi.innerHTML = '<br>';
            }
            targetLi.parentNode?.insertBefore(newLi, targetLi);
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          if (afterText === '') {
            if (isTaskItem) {
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.setAttribute('contenteditable', 'false');
              newLi.appendChild(cb);
              newLi.appendChild(document.createTextNode(' '));
              newLi.appendChild(document.createElement('br'));
            } else {
              newLi.innerHTML = '<br>';
            }

            if (targetLi.nextSibling) {
              targetLi.parentNode?.insertBefore(newLi, targetLi.nextSibling);
            } else {
              targetLi.parentNode?.appendChild(newLi);
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

          // Splitting item in the middle
          targetLi.innerHTML = '';
          if (isTaskItem) {
            const keepCb = document.createElement('input');
            keepCb.type = 'checkbox';
            keepCb.setAttribute('contenteditable', 'false');
            const origCb = (clone as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (origCb && (origCb.checked || origCb.hasAttribute('checked'))) {
              keepCb.checked = true;
              keepCb.setAttribute('checked', 'checked');
            }
            targetLi.appendChild(keepCb);
            targetLi.appendChild(document.createTextNode(' '));
          }
          const beforeNodes = Array.from(beforeFrag.childNodes).filter(
            (n) => !(n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'INPUT')
          );
          beforeNodes.forEach((node) => targetLi.appendChild(node));
          if (!targetLi.textContent?.trim() && !isTaskItem) {
            targetLi.innerHTML = '<br>';
          }

          if (isTaskItem) {
            const newCb = document.createElement('input');
            newCb.type = 'checkbox';
            newCb.setAttribute('contenteditable', 'false');
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

          if (targetLi.nextSibling) {
            targetLi.parentNode?.insertBefore(newLi, targetLi.nextSibling);
          } else {
            targetLi.parentNode?.appendChild(newLi);
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

        // 2. Blockquote Handling
        const targetBq = blockNode.tagName.toUpperCase() === 'BLOCKQUOTE' ? blockNode : blockNode.closest('blockquote');
        if (targetBq) {
          e.preventDefault();
          const totalBqText = targetBq.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';
          const innerBlock = blockNode !== targetBq ? blockNode : null;
          const innerText = innerBlock
            ? innerBlock.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || ''
            : totalBqText;

          // If line is empty or whole blockquote is empty: EXIT/CANCEL BLOCKQUOTE
          if (innerText === '' || totalBqText === '') {
            const p = document.createElement('p');
            p.innerHTML = '<br>';

            if (innerBlock && innerBlock !== targetBq) {
              innerBlock.remove();
            }

            const remainingText = targetBq.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';
            if (remainingText === '') {
              targetBq.parentNode?.replaceChild(p, targetBq);
            } else {
              if (targetBq.nextSibling) {
                targetBq.parentNode?.insertBefore(p, targetBq.nextSibling);
              } else {
                targetBq.parentNode?.appendChild(p);
              }
            }

            const targetRange = document.createRange();
            targetRange.selectNodeContents(p);
            targetRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(targetRange);

            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          // Non-empty line in blockquote
          const activeBlock = innerBlock || targetBq;
          const postRange = document.createRange();
          postRange.selectNodeContents(activeBlock);
          postRange.setStart(range.endContainer, range.endOffset);
          const afterText = postRange.toString().replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '');

          const newP = document.createElement('p');
          if (afterText === '') {
            newP.innerHTML = '<br>';
          } else {
            newP.appendChild(postRange.extractContents());
            if (!newP.textContent?.trim()) newP.innerHTML = '<br>';
          }

          if (innerBlock) {
            if (innerBlock.nextSibling) {
              innerBlock.parentNode?.insertBefore(newP, innerBlock.nextSibling);
            } else {
              targetBq.appendChild(newP);
            }
          } else {
            targetBq.appendChild(newP);
          }

          const targetRange = document.createRange();
          targetRange.selectNodeContents(newP);
          targetRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(targetRange);

          handleWysiwygInput();
          checkActiveFormats();
          return;
        }

        // 3. Heading Handling (H1-H6)
        const headingBlock = blockNode.closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null;
        if (headingBlock) {
          e.preventDefault();
          const text = headingBlock.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';

          if (text === '') {
            // Empty heading -> convert to standard paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            headingBlock.parentNode?.replaceChild(p, headingBlock);
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
          postRange.selectNodeContents(headingBlock);
          postRange.setStart(range.endContainer, range.endOffset);
          const afterText = postRange.toString().replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '');

          const p = document.createElement('p');
          if (afterText === '') {
            p.innerHTML = '<br>';
          } else {
            p.appendChild(postRange.extractContents());
          }

          if (headingBlock.nextSibling) {
            headingBlock.parentNode?.insertBefore(p, headingBlock.nextSibling);
          } else {
            headingBlock.parentNode?.appendChild(p);
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

        // 4. Code Block Handling
        const preBlock = blockNode.closest('pre') as HTMLElement | null;
        if (preBlock) {
          e.preventDefault();
          const text = preBlock.textContent?.replace(/[\r\n\s\u00A0\u200B-\u200D\uFEFF]/g, '') || '';
          const preRange = document.createRange();
          preRange.selectNodeContents(preBlock);
          preRange.setEnd(range.startContainer, range.startOffset);
          const textBefore = preRange.toString();
          const isAtEmptyLineInCode = textBefore.endsWith('\n\n') || textBefore.endsWith('\r\n\r\n');

          if (text === '' || isAtEmptyLineInCode || e.shiftKey || e.ctrlKey || e.metaKey) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            if (preBlock.nextSibling) {
              preBlock.parentNode?.insertBefore(p, preBlock.nextSibling);
            } else {
              preBlock.parentNode?.appendChild(p);
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

          // Insert literal newline in code block
          const codeEl = preBlock.querySelector('code') || preBlock;
          const newlineNode = document.createTextNode('\n');
          range.deleteContents();
          range.insertNode(newlineNode);
          range.setStartAfter(newlineNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          handleWysiwygInput();
          return;
        }

        // 5. In-Paragraph Markdown Pattern conversions on Enter
        const tag = blockNode.tagName.toUpperCase();
        if (tag === 'P' || tag === 'DIV') {
          const preRange = document.createRange();
          preRange.selectNodeContents(blockNode);
          preRange.setEnd(range.startContainer, range.startOffset);
          const textBefore = preRange.toString().replace(/\u00A0/g, ' ');

          // Horizontal rule on Enter
          if (/^(\s*(?:---|---|\*\*\*|___))\s*$/.test(textBefore)) {
            e.preventDefault();
            const hr = document.createElement('hr');
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            blockNode.parentNode?.insertBefore(hr, blockNode);
            blockNode.parentNode?.insertBefore(p, blockNode);
            blockNode.remove();
            const r = document.createRange();
            r.selectNodeContents(p);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          // Markdown Table on Enter
          if (/^\s*\|.+?\|\s*$/.test(textBefore)) {
            const table = createMarkdownTableFromHeader(textBefore);
            if (table) {
              e.preventDefault();
              const p = document.createElement('p');
              p.innerHTML = '<br>';
              blockNode.parentNode?.insertBefore(table, blockNode);
              blockNode.parentNode?.insertBefore(p, blockNode);
              blockNode.remove();
              const firstTd = table.querySelector('tbody td') as HTMLElement;
              const r = document.createRange();
              if (firstTd) {
                r.selectNodeContents(firstTd);
              } else {
                r.selectNodeContents(p);
              }
              r.collapse(true);
              sel.removeAllRanges();
              sel.addRange(r);
              handleWysiwygInput();
              checkActiveFormats();
              return;
            }
          }

          // Fenced Code block on Enter
          const codeEnterMatch = textBefore.match(/^(\s*`{3}([a-zA-Z0-9_-]*))\s*$/);
          if (codeEnterMatch) {
            e.preventDefault();
            const lang = codeEnterMatch[2] || '';
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            if (lang) {
              code.className = `language-${lang}`;
              code.setAttribute('data-language', lang);
            }
            code.innerHTML = '<br>';
            pre.appendChild(code);
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            blockNode.parentNode?.insertBefore(pre, blockNode);
            blockNode.parentNode?.insertBefore(p, blockNode);
            blockNode.remove();
            const r = document.createRange();
            r.selectNodeContents(code);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }

          let matchedFormat: string | null = null;
          let prefixMatch: RegExpMatchArray | null = null;

          // Check if paragraph started with markdown list marker
          const taskMatch = textBefore.match(/^(\s*(?:[-*+•]\s*)?\[([ x_]?)\]\s*)(.*)$/i);
          const numMatch = textBefore.match(/^(\s*\d+[.)-]\s*)(.*)$/);
          const bulletMatch = textBefore.match(/^(\s*[-*+•]\s*)(.*)$/);

          if (taskMatch) {
            matchedFormat = 'task';
            prefixMatch = taskMatch;
          } else if (numMatch) {
            matchedFormat = 'number';
            prefixMatch = numMatch;
          } else if (bulletMatch) {
            matchedFormat = 'bullet';
            prefixMatch = bulletMatch;
          }

          if (matchedFormat && prefixMatch) {
            e.preventDefault();
            const prefixLen = prefixMatch[1].length;
            const itemText = prefixMatch[prefixMatch.length - 1];
            const isInitialChecked = matchedFormat === 'task' && prefixMatch[2]?.toLowerCase() === 'x';

            // Strip the prefix from preRange
            stripLeadingPrefixFromFragment(preRange.cloneContents(), prefixLen);
            const firstChild = blockNode.firstChild;
            if (firstChild && firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent) {
              firstChild.textContent = firstChild.textContent.replace(
                /^(\s*(?:(?:[-*+•]\s*)?\[[ x_]?\]|\d+[.)-]|[-*+•])\s*)/i,
                ''
              );
            }

            applyWysiwygBlockFormat(matchedFormat, {
              nodes: [blockNode],
              mode: 'apply',
              checked: isInitialChecked,
              caretPlacement: 'end',
            });

            // If user typed item text before pressing enter, create the subsequent item
            if (itemText.trim()) {
              const currentInfo = getCaretBlockAndOffset(wysiwygRef.current);
              const currentLi = currentInfo?.blockNode?.closest('li');
              if (currentLi && currentLi.parentElement) {
                const nextLi = document.createElement('li');
                if (matchedFormat === 'task') {
                  nextLi.className = 'task-list-item';
                  const cb = document.createElement('input');
                  cb.type = 'checkbox';
                  cb.setAttribute('contenteditable', 'false');
                  nextLi.appendChild(cb);
                  nextLi.appendChild(document.createTextNode(' '));
                  nextLi.appendChild(document.createElement('br'));
                } else {
                  nextLi.innerHTML = '<br>';
                }
                currentLi.after(nextLi);

                const targetRange = document.createRange();
                targetRange.selectNodeContents(nextLi);
                targetRange.collapse(false);
                const s = window.getSelection();
                if (s) {
                  s.removeAllRanges();
                  s.addRange(targetRange);
                }
                handleWysiwygInput();
                checkActiveFormats();
              }
            }
            return;
          }
        }
      }

      if (e.key === 'Backspace') {
        const info = getCaretBlockAndOffset(wysiwygRef.current);
        if (!info || !info.blockNode) return;
        const { blockNode, isAtStart } = info;

        const targetLi = blockNode.tagName.toUpperCase() === 'LI' ? blockNode : blockNode.closest('li');
        if (targetLi && isAtStart) {
          e.preventDefault();
          const parentList = targetLi.closest('ul, ol');
          if (!parentList) return;

          const clone = targetLi.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());

          const p = document.createElement('p');
          while (clone.firstChild) {
            p.appendChild(clone.firstChild);
          }
          if (!p.textContent?.trim() && p.childNodes.length === 0) {
            p.innerHTML = '<br>';
          }

          const allLis = Array.from(parentList.children) as HTMLElement[];
          const currIdx = allLis.indexOf(targetLi);

          const lisBefore = allLis.slice(0, currIdx);
          const lisAfter = allLis.slice(currIdx + 1);

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

          if (lisBefore.length > 0) {
            if (parentList.nextSibling) {
              parentList.parentNode?.insertBefore(p, parentList.nextSibling);
            } else {
              parentList.parentNode?.appendChild(p);
            }
          } else {
            parentList.parentNode?.insertBefore(p, parentList);
          }

          targetLi.remove();
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

        const targetBq = blockNode.closest('blockquote');
        const targetHeading = blockNode.closest('h1, h2, h3, h4, h5, h6');
        const targetPre = blockNode.closest('pre');

        if (isAtStart && (targetBq || targetHeading || targetPre)) {
          e.preventDefault();
          const blockToReplace = targetHeading || targetBq || targetPre;
          if (blockToReplace) {
            const p = document.createElement('p');
            while (blockToReplace.firstChild) {
              p.appendChild(blockToReplace.firstChild);
            }
            if (!p.textContent?.trim() && p.childNodes.length === 0) {
              p.innerHTML = '<br>';
            }
            blockToReplace.parentNode?.replaceChild(p, blockToReplace);
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
        }

        const tag = blockNode.tagName.toUpperCase();
        if (tag === 'P' || tag === 'DIV') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const preRange = document.createRange();
            preRange.selectNodeContents(blockNode);
            preRange.setEnd(range.startContainer, range.startOffset);
            const textBefore = preRange.toString();

            const prefixMatch = textBefore.match(/^(\s*(?:\d+[.)]|[-*+•]|>+|#{1,6})\s+)$/);
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
    },
    [
      wysiwygRef,
      handleUndo,
      handleRedo,
      handleWysiwygInput,
      checkActiveFormats,
    ]
  );

  return {
    checkActiveFormats,
    handleWysiwygInput,
    handleWysiwygClick,
    handleWysiwygPaste,
    applyWysiwygBlockFormat,
    handleWysiwygFormatAction,
    handleWysiwygKeyDown,
  };
}
