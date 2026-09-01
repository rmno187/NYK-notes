import React, { useCallback } from 'react';
import { FormatActionType } from './types';
import { applyFormatting } from '../../lib/markdown';

interface UseMarkdownHandlersProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  content: string;
  onChangeContent: (content: string) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  onOpenLinkModal: (initialText: string, sel: { start: number; end: number }) => void;
}

export function useMarkdownHandlers({
  textareaRef,
  content,
  onChangeContent,
  handleUndo,
  handleRedo,
  onOpenLinkModal,
}: UseMarkdownHandlersProps) {
  const handleMarkdownFormatAction = useCallback(
    (type: FormatActionType) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (type === 'link') {
        const text = content.substring(start, end);
        onOpenLinkModal(text, { start, end });
        return;
      }

      const fmtType = type === 'h2' ? 'heading' : type;
      const formatted = applyFormatting(content, start, end, fmtType as any);
      onChangeContent(formatted.text);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(formatted.newStart, formatted.newEnd);
        }
      }, 10);
    },
    [textareaRef, content, onChangeContent, onOpenLinkModal]
  );

  const handleMarkdownKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

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
          handleMarkdownFormatAction('bold');
          return;
        } else if (keyLower === 'i') {
          e.preventDefault();
          handleMarkdownFormatAction('italic');
          return;
        } else if (keyLower === 'h') {
          e.preventDefault();
          handleMarkdownFormatAction('heading');
          return;
        }
      }

      // Markdown Enter handling for lists (1. Testing -> next line 2. , - Testing -> next line - )
      if (e.key === 'Enter' && !e.shiftKey) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
          const val = content;
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
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart + indent.length;
                }
              }, 0);
              return;
            } else {
              // Continue numbered list
              const nextPrefix = `\n${indent}${num + 1}${delimiter} `;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + nextPrefix.length;
                }
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
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart + indent.length;
                }
              }, 0);
              return;
            } else {
              // Continue bullet list
              const nextPrefix = `\n${indent}${bullet} `;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + nextPrefix.length;
                }
              }, 0);
              return;
            }
          }
        }
      }

      // Markdown Backspace handling to delete list formatting
      if (e.key === 'Backspace') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
          const val = content;
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const lineBeforeCursor = val.substring(lineStart, start);

          // If cursor is right after marker: "1. |" or "- |"
          const markerMatch = lineBeforeCursor.match(/^(\s*(?:\d+[.)]|[-*+])\s+)$/);
          if (markerMatch) {
            e.preventDefault();
            const updated = val.substring(0, lineStart) + val.substring(start);
            onChangeContent(updated);
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
              }
            }, 0);
            return;
          }
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = content;

        if (start !== end) {
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
            if (textareaRef.current) {
              textareaRef.current.selectionStart = lineStart;
              textareaRef.current.selectionEnd = lineStart + newText.length;
            }
          }, 0);
        } else {
          if (e.shiftKey) {
            const lineStart = val.lastIndexOf('\n', start - 1) + 1;
            const beforeCursor = val.substring(lineStart, start);
            if (beforeCursor.endsWith('  ')) {
              const updated = val.substring(0, start - 2) + val.substring(start);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = Math.max(lineStart, start - 2);
                }
              }, 0);
            }
          } else {
            const updated = val.substring(0, start) + '  ' + val.substring(end);
            onChangeContent(updated);

            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
              }
            }, 0);
          }
        }
      }
    },
    [textareaRef, content, onChangeContent, handleUndo, handleRedo, handleMarkdownFormatAction]
  );

  return {
    handleMarkdownFormatAction,
    handleMarkdownKeyDown,
  };
}
