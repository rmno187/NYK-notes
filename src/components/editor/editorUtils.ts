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
}
