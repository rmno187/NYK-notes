import React, { useCallback } from 'react';
import { ActiveFormats, FormatActionType } from './types';
import { renderMarkdownToHtml, convertHtmlToMarkdown } from '../../lib/markdown';
import {
  getCaretCharacterOffsetWithin,
  setCaretCharacterOffsetWithin,
  getCaretBlockAndOffset,
  stripLeadingPrefixFromFragment,
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
}: UseWysiwygHandlersProps) {
  // Check active formatting at cursor selection
  const checkActiveFormats = useCallback(() => {
    if (!wysiwygRef.current) return;

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
  }, [wysiwygRef, setActiveFormats]);

  // Handle direct editing in WYSIWYG contentEditable div
  const handleWysiwygInput = useCallback(() => {
    if (!wysiwygRef.current) return;
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
        const isCheckedAttr = cb.hasAttribute('checked');

        // Ensure checked state and attribute are in sync
        if (cb.checked !== isCheckedAttr) {
          if (cb.checked) {
            cb.setAttribute('checked', 'checked');
          } else {
            cb.removeAttribute('checked');
          }
        } else {
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
    [wysiwygRef, onChangeContent]
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

  // Unified WYSIWYG block formatting helper
  const applyWysiwygBlockFormat = useCallback(
    (targetType: string) => {
      if (!wysiwygRef.current) return;

      wysiwygRef.current.focus();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      const savedCaretOffset = getCaretCharacterOffsetWithin(wysiwygRef.current);

      (Array.from(wysiwygRef.current.childNodes) as ChildNode[]).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
          const p = document.createElement('p');
          p.textContent = child.textContent;
          child.replaceWith(p);
        }
      });

      const allBlocks = Array.from(
        wysiwygRef.current.querySelectorAll('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre')
      ) as HTMLElement[];

      let selectedNodes = allBlocks.filter((node) => {
        if (node.tagName === 'DIV') return false;
        try {
          return range.intersectsNode(node);
        } catch {
          return false;
        }
      });

      if (selectedNodes.length === 0 && sel.anchorNode) {
        let curr: Node | null = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentNode : sel.anchorNode;
        const block = (curr as HTMLElement)?.closest('li, p, h1, h2, h3, h4, h5, h6, blockquote, pre');
        if (block && wysiwygRef.current.contains(block)) {
          selectedNodes = [block as HTMLElement];
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
        if (node.tagName === 'H1') return 'heading';
        if (node.tagName === 'H2') return 'h2';
        if (node.tagName === 'BLOCKQUOTE') return 'quote';
        if (node.tagName === 'PRE') return 'code';
        return 'paragraph';
      };

      const allMatch = selectedNodes.every((node) => getNodeFormat(node) === targetType);
      const finalFormat = allMatch ? 'paragraph' : targetType;

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
      setCaretCharacterOffsetWithin(wysiwygRef.current, savedCaretOffset);

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
    [wysiwygRef, activeFormats.link, applyWysiwygBlockFormat, handleWysiwygInput, checkActiveFormats, onOpenLinkModal]
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

      if (e.key === 'Enter') {
        const info = getCaretBlockAndOffset(wysiwygRef.current);
        if (!info || !info.blockNode) return;
        const { blockNode } = info;
        const tag = blockNode.tagName.toUpperCase();

        if (tag === 'LI') {
          e.preventDefault();

          const isTaskItem =
            blockNode.classList.contains('task-list-item') ||
            blockNode.querySelector('input[type="checkbox"]') !== null ||
            blockNode.closest('ul.contains-task-list') !== null;

          const clone = blockNode.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
          const textContent = clone.textContent?.replace(/[\r\n\s\u200B-\u200D\uFEFF]/g, '') || '';

          if (textContent === '') {
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

          // 1) Numbered List Pattern
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

          // 2) Bullet List Pattern
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

          // 3) Task List Pattern
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

        // Heading: Enter converts new line to <p>
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

        // Blockquote
        if (tag === 'BLOCKQUOTE') {
          const text = blockNode.textContent?.trim() || '';
          if (text === '') {
            e.preventDefault();
            document.execCommand('formatBlock', false, '<p>');
            checkActiveFormats();
          }
        }

        // Code Block
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

          if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'CODE'].includes(tag)) {
            e.preventDefault();
            document.execCommand('formatBlock', false, '<p>');
            handleWysiwygInput();
            checkActiveFormats();
            return;
          }
        }

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
