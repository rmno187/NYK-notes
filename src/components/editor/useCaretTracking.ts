import React, { useState, useEffect, useCallback } from 'react';
import { EditorMode } from '../../types';

interface UseCaretTrackingProps {
  mode: EditorMode;
  wysiwygRef: React.RefObject<HTMLDivElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  contentScrollRef: React.RefObject<HTMLDivElement>;
}

export function useCaretTracking({
  mode,
  wysiwygRef,
  textareaRef,
  contentScrollRef,
}: UseCaretTrackingProps) {
  const [caretPosition, setCaretPosition] = useState<{ top: number; bottom: number; left?: number } | null>(null);

  const updateCaretPosition = useCallback(() => {
    // Only track cursor proximity for mobile screen widths
    if (typeof window === 'undefined' || window.innerWidth >= 768) {
      if (caretPosition !== null) {
        setCaretPosition(null);
      }
      return;
    }

    if (mode === 'wysiwyg' && wysiwygRef.current) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setCaretPosition(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const isInside =
        (sel.anchorNode && wysiwygRef.current.contains(sel.anchorNode)) ||
        (sel.focusNode && wysiwygRef.current.contains(sel.focusNode));

      if (!isInside) {
        setCaretPosition(null);
        return;
      }

      let rect = range.getBoundingClientRect();

      // If rect has zero width/height (collapsed cursor on empty line), fallback to anchorNode parent
      if ((rect.width === 0 && rect.height === 0) || (rect.top === 0 && rect.bottom === 0)) {
        let node: Node | null = sel.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentNode;
        if (node && (node as HTMLElement).getBoundingClientRect) {
          rect = (node as HTMLElement).getBoundingClientRect();
        }
      }

      if (rect && (rect.top > 0 || rect.bottom > 0)) {
        setCaretPosition({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
        });
      }
    } else if (mode === 'markdown' && textareaRef.current) {
      if (document.activeElement === textareaRef.current) {
        const textarea = textareaRef.current;
        const rect = textarea.getBoundingClientRect();
        const start = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, start);
        const lineCount = textBefore.split('\n').length;
        const lineHeight = 22;
        const calculatedTop = rect.top + (lineCount - 1) * lineHeight - (contentScrollRef.current?.scrollTop || 0);

        setCaretPosition({
          top: calculatedTop,
          bottom: calculatedTop + lineHeight,
        });
      } else {
        setCaretPosition(null);
      }
    }
  }, [mode, wysiwygRef, textareaRef, contentScrollRef, caretPosition]);

  useEffect(() => {
    const handleSelectionOrScroll = () => {
      updateCaretPosition();
    };

    document.addEventListener('selectionchange', handleSelectionOrScroll);
    window.addEventListener('resize', handleSelectionOrScroll);

    const scrollEl = contentScrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', handleSelectionOrScroll, { passive: true });
    }

    return () => {
      document.removeEventListener('selectionchange', handleSelectionOrScroll);
      window.removeEventListener('resize', handleSelectionOrScroll);
      if (scrollEl) {
        scrollEl.removeEventListener('scroll', handleSelectionOrScroll);
      }
    };
  }, [updateCaretPosition, contentScrollRef]);

  return {
    caretPosition,
    updateCaretPosition,
  };
}
