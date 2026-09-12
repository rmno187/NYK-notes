import type React from 'react';

export function getCaretCharacterOffsetWithin(element: HTMLElement): number {
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

export function setCaretCharacterOffsetWithin(element: HTMLElement, offset: number) {
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

export function stripLeadingPrefixFromFragment(frag: DocumentFragment, prefixLength: number) {
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
}

export interface CaretBlockInfo {
  sel: Selection;
  range: Range;
  blockNode: HTMLElement | null;
  isAtStart: boolean;
}

export function getCaretBlockAndOffset(container: HTMLElement): CaretBlockInfo | null {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  let node: Node | null = sel.anchorNode;

  let blockNode: HTMLElement | null = null;

  // 1. Search upwards for an explicit block container
  let curr: Node | null = node;
  while (curr && curr !== container) {
    if (curr.nodeType === Node.ELEMENT_NODE) {
      const tag = (curr as HTMLElement).tagName?.toUpperCase();
      if (['H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'LI', 'P', 'DIV', 'UL', 'OL'].includes(tag)) {
        blockNode = curr as HTMLElement;
        break;
      }
    }
    curr = curr.parentNode;
  }

  // 2. If no block ancestor found, find the direct top-level child of container
  if (!blockNode && container.contains(node)) {
    let topChild: Node | null = node;
    while (topChild && topChild.parentNode !== container) {
      topChild = topChild.parentNode;
    }
    if (topChild && topChild.nodeType === Node.ELEMENT_NODE) {
      blockNode = topChild as HTMLElement;
    } else if (topChild && topChild.nodeType === Node.TEXT_NODE) {
      // Wrap top-level text node in a <p> element so it has a valid block context
      const p = document.createElement('p');
      container.replaceChild(p, topChild);
      p.appendChild(topChild);
      blockNode = p;
    }
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
}

/**
 * Inline markdown patterns to match inside active text node:
 * - Bold + Italic: ***text*** or ___text___
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Strikethrough: ~~text~~
 * - Inline Code: `text`
 * - Highlight: ==text==
 * - Link: [text](url)
 * - Image: ![alt](url)
 */
interface InlineRule {
  name: string;
  regex: RegExp;
  createElement: (match: RegExpExecArray) => HTMLElement;
}

const INLINE_RULES: InlineRule[] = [
  // Bold + Italic: ***text*** or ___text___
  {
    name: 'boldItalic',
    regex: /(?:^|[^\\])(?:\*\*\*([^*\n]+?)\*\*\*|___([^_\n]+?)___)$/,
    createElement: (m) => {
      const content = m[1] || m[2];
      const strong = document.createElement('strong');
      const em = document.createElement('em');
      em.textContent = content;
      strong.appendChild(em);
      return strong;
    },
  },
  // Bold: **text** or __text__
  {
    name: 'bold',
    regex: /(?:^|[^\\])(?:\*\*([^*\n]+?)\*\*|__([^_\n]+?)__)$/,
    createElement: (m) => {
      const content = m[1] || m[2];
      const strong = document.createElement('strong');
      strong.textContent = content;
      return strong;
    },
  },
  // Italic: *text* or _text_ (excluding double/triple stars and internal punctuation)
  {
    name: 'italic',
    regex: /(?:^|[^\w\\])(?:\*([^*\s\n](?:[^*\n]*?[^*\s\n])?)\*|_([^_\s\n](?:[^_\n]*?[^_\s\n])?)_)$/,
    createElement: (m) => {
      const content = m[1] || m[2];
      const em = document.createElement('em');
      em.textContent = content;
      return em;
    },
  },
  // Strikethrough: ~~text~~
  {
    name: 'strikethrough',
    regex: /(?:^|[^\\])~~([^~\n]+?)~~$/,
    createElement: (m) => {
      const content = m[1];
      const s = document.createElement('s');
      s.textContent = content;
      return s;
    },
  },
  // Highlight: ==text==
  {
    name: 'highlight',
    regex: /(?:^|[^\\])==([^=\n]+?)==$/,
    createElement: (m) => {
      const content = m[1];
      const mark = document.createElement('mark');
      mark.className = 'bg-amber-100 dark:bg-amber-900/40 px-1 rounded';
      mark.textContent = content;
      return mark;
    },
  },
  // Inline code: `text`
  {
    name: 'code',
    regex: /(?:^|[^\\])`([^`\n]+?)`$/,
    createElement: (m) => {
      const content = m[1];
      const code = document.createElement('code');
      code.className = 'px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-sm font-mono';
      code.textContent = content;
      return code;
    },
  },
  // Image: ![alt](url)
  {
    name: 'image',
    regex: /(?:^|[^\\])!\[([^\]\n]*?)\]\(((?:https?:\/\/|\/|\.\/|data:image\/)[^\s)]+?)\)$/,
    createElement: (m) => {
      const alt = m[1];
      const src = m[2];
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.className =
        'max-w-full h-auto rounded my-2 border border-neutral-200 dark:border-neutral-800 shadow-sm inline-block';
      return img;
    },
  },
  // Link: [text](url)
  {
    name: 'link',
    regex: /(?:^|[^\\])\[([^\]\n]+?)\]\(((?:https?:\/\/|\/|\.\/)[^\s)]+?)\)$/,
    createElement: (m) => {
      const text = m[1];
      const href = m[2];
      const a = document.createElement('a');
      a.href = href;
      a.className = 'text-blue-600 dark:text-blue-400 underline';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = text;
      return a;
    },
  },
];

/**
 * Checks and auto-formats inline markdown in the active text node at the cursor.
 * Returns true if an inline markdown conversion was performed.
 */
export function applyInlineMarkdownFormatting(wysiwygElement: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;

  const node = sel.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE) return false;

  // Don't format inside <pre> or <code> or existing <a>
  const parentEl = node.parentElement;
  if (!parentEl) return false;
  if (parentEl.closest('pre') || parentEl.closest('code') || parentEl.closest('a')) {
    return false;
  }

  const textVal = node.nodeValue || '';
  const caretOffset = sel.anchorOffset;
  const textBeforeCaret = textVal.slice(0, caretOffset);
  const textAfterCaret = textVal.slice(caretOffset);

  for (const rule of INLINE_RULES) {
    const match = rule.regex.exec(textBeforeCaret);
    if (match) {
      const fullMatch = match[0];
      // If regex matched a leading non-backslash char (like a space or letter), adjust start index
      const leadingOffset = fullMatch.length - (match[1] !== undefined ? fullMatch.slice(fullMatch.indexOf(match[1] || match[2])).length + (fullMatch.startsWith('*') || fullMatch.startsWith('_') || fullMatch.startsWith('~') || fullMatch.startsWith('`') || fullMatch.startsWith('=') || fullMatch.startsWith('[') || fullMatch.startsWith('!') ? 0 : 1) : 0);
      
      const matchStartInText = textBeforeCaret.length - fullMatch.length + (fullMatch.length > 0 && !/^[*_~`=\[!]/i.test(fullMatch) ? 1 : 0);
      const matchEndInText = caretOffset;

      const beforeText = textVal.slice(0, matchStartInText);
      const afterText = textAfterCaret;

      const formattedElement = rule.createElement(match);

      const parent = node.parentNode;
      if (!parent) return false;

      // Create new trailing text node with non-breaking space or regular space
      const trailingNode = document.createTextNode(afterText || '\u00A0');

      if (beforeText) {
        node.nodeValue = beforeText;
        parent.insertBefore(formattedElement, node.nextSibling);
        parent.insertBefore(trailingNode, formattedElement.nextSibling);
      } else {
        parent.insertBefore(formattedElement, node);
        parent.insertBefore(trailingNode, formattedElement.nextSibling);
        (node as ChildNode).remove();
      }

      // Position caret at start of trailing node
      const newRange = document.createRange();
      newRange.setStart(trailingNode, trailingNode.nodeValue === '\u00A0' ? 1 : 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      return true;
    }
  }

  return false;
}

/**
 * Wraps selected text with markdown delimiter pairs e.g. *text*, **text**, `text`, etc.
 */
export function wrapSelectedTextWithDelimiters(
  wysiwyg: HTMLElement,
  prefix: string,
  suffix: string
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return false;

  const selectedText = range.toString();
  if (!selectedText) return false;

  range.deleteContents();
  const textNode = document.createTextNode(`${prefix}${selectedText}${suffix}`);
  range.insertNode(textNode);

  // Restore selection around wrapped text
  const newRange = document.createRange();
  newRange.setStart(textNode, prefix.length);
  newRange.setEnd(textNode, prefix.length + selectedText.length);
  sel.removeAllRanges();
  sel.addRange(newRange);

  return true;
}

/**
 * Parses markdown table header syntax e.g. "| Col 1 | Col 2 | Col 3 |" into a structured HTML <table>
 */
export function createMarkdownTableFromHeader(headerText: string): HTMLElement | null {
  const trimmed = headerText.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  const rawCols = trimmed
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  if (rawCols.length === 0) return null;

  const table = document.createElement('table');
  table.className = 'w-full my-4 border-collapse border border-neutral-300 dark:border-neutral-700';

  const thead = document.createElement('thead');
  thead.className = 'bg-neutral-100 dark:bg-neutral-800';
  const headerRow = document.createElement('tr');

  rawCols.forEach((colText) => {
    const th = document.createElement('th');
    th.className = 'border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 font-semibold text-left';
    th.textContent = colText || 'Header';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const bodyRow = document.createElement('tr');
  rawCols.forEach(() => {
    const td = document.createElement('td');
    td.className = 'border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-left';
    td.innerHTML = '<br>';
    bodyRow.appendChild(td);
  });
  tbody.appendChild(bodyRow);
  table.appendChild(tbody);

  return table;
}

/**
 * Handles Tab and Enter keyboard navigation inside HTML tables
 */
export function handleTableNavigation(
  e: React.KeyboardEvent<HTMLDivElement>,
  wysiwyg: HTMLElement
): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return false;

  let curr: Node | null = sel.anchorNode;
  if (curr.nodeType === Node.TEXT_NODE) curr = curr.parentNode;
  const currentCell = (curr as HTMLElement)?.closest('td, th') as HTMLElement | null;
  if (!currentCell) return false;

  const currentTable = currentCell.closest('table');
  if (!currentTable || !wysiwyg.contains(currentTable)) return false;

  const allCells = Array.from(currentTable.querySelectorAll('th, td')) as HTMLElement[];
  const currentIndex = allCells.indexOf(currentCell);

  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      // Move to previous cell
      const prevIndex = Math.max(0, currentIndex - 1);
      const targetCell = allCells[prevIndex];
      const range = document.createRange();
      range.selectNodeContents(targetCell);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // Move to next cell or add a new row if at the last cell
      if (currentIndex === allCells.length - 1) {
        const tbody = currentTable.querySelector('tbody') || currentTable;
        const colCount = (currentTable.querySelector('tr')?.children.length) || 2;
        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
          const td = document.createElement('td');
          td.className = 'border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-left';
          td.innerHTML = '<br>';
          newRow.appendChild(td);
        }
        tbody.appendChild(newRow);

        const firstTd = newRow.querySelector('td') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(firstTd);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        const nextCell = allCells[currentIndex + 1];
        const range = document.createRange();
        range.selectNodeContents(nextCell);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    return true;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const currentRow = currentCell.closest('tr');
    if (!currentRow) return false;

    const currentCellIndexInRow = Array.from(currentRow.children).indexOf(currentCell);
    const nextRow = currentRow.nextElementSibling as HTMLElement | null;

    if (nextRow) {
      const targetCell = nextRow.children[currentCellIndexInRow] as HTMLElement | undefined;
      if (targetCell) {
        const range = document.createRange();
        range.selectNodeContents(targetCell);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
    } else {
      // Add new row below
      const tbody = currentTable.querySelector('tbody') || currentTable;
      const colCount = currentRow.children.length;
      const newRow = document.createElement('tr');
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement('td');
        td.className = 'border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-left';
        td.innerHTML = '<br>';
        newRow.appendChild(td);
      }
      tbody.appendChild(newRow);

      const targetCell = newRow.children[currentCellIndexInRow] as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(targetCell);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    }
  }

  return false;
}
