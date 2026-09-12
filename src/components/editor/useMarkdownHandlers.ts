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
  onOpenImageModal?: () => void;
}

export function useMarkdownHandlers({
  textareaRef,
  content,
  onChangeContent,
  handleUndo,
  handleRedo,
  onOpenLinkModal,
  onOpenImageModal,
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

      if (type === 'image') {
        if (onOpenImageModal) {
          onOpenImageModal();
        }
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
    [textareaRef, content, onChangeContent, onOpenLinkModal, onOpenImageModal]
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
        } else if (e.shiftKey && (keyLower === 'x' || keyLower === 's')) {
          e.preventDefault();
          handleMarkdownFormatAction('strike');
          return;
        } else if (e.key === '\\') {
          e.preventDefault();
          handleMarkdownFormatAction('clear');
          return;
        }
      }

      // Markdown Enter and Shift+Enter handling for lists (Task list, Numbered list, Bullet list)
      if (e.key === 'Enter') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
          const val = content;
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const currentLine = val.substring(lineStart, start);

          // 1. Task list: "- [ ] Testing", "* [x] Testing", "[ ] Testing"
          const taskMatch = currentLine.match(/^(\s*(?:[-*+•]\s*)?\[([ x_]?)\]\s*)(.*)$/i);
          if (taskMatch) {
            e.preventDefault();
            const prefix = taskMatch[1];
            const itemContent = taskMatch[3];

            if (e.shiftKey) {
              // Shift+Enter: continue text on a new line within the same list item
              const indent = ' '.repeat(prefix.length);
              const nextPrefix = `\n${indent}`;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + nextPrefix.length;
                }
              }, 0);
              return;
            }

            if (!itemContent.trim()) {
              // Empty task item: exit list
              const updated = val.substring(0, lineStart) + val.substring(start);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
                }
              }, 0);
              return;
            } else {
              // Continue task list with empty checkbox
              const isBulletPrefix = /^(\s*[-*+•]\s*)/.test(prefix);
              const indent = prefix.match(/^\s*/)?.[0] || '';
              const nextPrefix = isBulletPrefix ? `\n${indent}- [ ] ` : `\n${indent}[ ] `;
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

          // 2. Numbered list: "1. Testing", "1) Testing"
          const numMatch = currentLine.match(/^(\s*)(\d+)([.)]\s*)(.*)$/);
          if (numMatch) {
            e.preventDefault();
            const indent = numMatch[1];
            const num = parseInt(numMatch[2], 10);
            const delimiter = numMatch[3];
            const itemContent = numMatch[4];

            if (e.shiftKey) {
              // Shift+Enter: continue text on a new line within the same list item
              const prefixLen = indent.length + numMatch[2].length + delimiter.length;
              const nextPrefix = `\n${' '.repeat(prefixLen)}`;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + nextPrefix.length;
                }
              }, 0);
              return;
            }

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
              const nextPrefix = `\n${indent}${num + 1}${delimiter.trimEnd()} `;
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

          // 3. Bullet list: "- Testing", "* Testing", "+ Testing", "• Testing"
          const bulletMatch = currentLine.match(/^(\s*)([-*+•])\s*(.*)$/);
          if (bulletMatch) {
            e.preventDefault();
            const indent = bulletMatch[1];
            const bullet = bulletMatch[2];
            const itemContent = bulletMatch[3];

            if (e.shiftKey) {
              // Shift+Enter: continue text on a new line within the same list item
              const prefixLen = indent.length + bullet.length + 1;
              const nextPrefix = `\n${' '.repeat(prefixLen)}`;
              const updated = val.substring(0, start) + nextPrefix + val.substring(end);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + nextPrefix.length;
                }
              }, 0);
              return;
            }

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

          // 4. Continued list item line (indented following an existing list item above)
          const contMatch = currentLine.match(/^(\s{2,})(.*)$/);
          if (contMatch) {
            let pos = lineStart - 1;
            let parentInfo: { type: 'task' | 'number' | 'bullet'; nextPrefix: string } | null = null;
            while (pos > 0) {
              const prevLineStart = val.lastIndexOf('\n', pos - 1) + 1;
              const prevLine = val.substring(prevLineStart, pos);
              if (!prevLine.trim()) break;

              const pTask = prevLine.match(/^(\s*(?:[-*+•]\s*)?\[([ x_]?)\]\s*)/i);
              if (pTask) {
                const pIndent = pTask[1].match(/^\s*/)?.[0] || '';
                parentInfo = { type: 'task', nextPrefix: `\n${pIndent}- [ ] ` };
                break;
              }
              const pNum = prevLine.match(/^(\s*)(\d+)([.)]\s*)/);
              if (pNum) {
                const pIndent = pNum[1];
                const pNext = parseInt(pNum[2], 10) + 1;
                parentInfo = { type: 'number', nextPrefix: `\n${pIndent}${pNext}. ` };
                break;
              }
              const pBullet = prevLine.match(/^(\s*)([-*+•])\s*/);
              if (pBullet) {
                const pIndent = pBullet[1];
                const pB = pBullet[2];
                parentInfo = { type: 'bullet', nextPrefix: `\n${pIndent}${pB} ` };
                break;
              }
              pos = prevLineStart - 1;
            }

            if (parentInfo) {
              e.preventDefault();
              if (e.shiftKey) {
                // Continue with another indented line within the same list item
                const nextPrefix = `\n${contMatch[1]}`;
                const updated = val.substring(0, start) + nextPrefix + val.substring(end);
                onChangeContent(updated);
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + nextPrefix.length;
                  }
                }, 0);
                return;
              } else {
                // Enter: create the new list item of the parent's type
                const lineContent = contMatch[2];
                if (!lineContent.trim()) {
                  // Empty continuation line: exit list
                  const updated = val.substring(0, lineStart) + val.substring(start);
                  onChangeContent(updated);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
                    }
                  }, 0);
                  return;
                } else {
                  const updated = val.substring(0, start) + parentInfo.nextPrefix + val.substring(end);
                  onChangeContent(updated);
                  setTimeout(() => {
                    if (textareaRef.current) {
                      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + parentInfo.nextPrefix.length;
                    }
                  }, 0);
                  return;
                }
              }
            }
          }

          if (e.shiftKey) return;

          // 4. Blockquote: "> Testing", "> "
          const quoteMatch = currentLine.match(/^(\s*>+\s*)(.*)$/);
          if (quoteMatch) {
            e.preventDefault();
            const prefix = quoteMatch[1];
            const itemContent = quoteMatch[2];

            if (!itemContent.trim()) {
              // Empty blockquote: exit/cancel blockquote
              const updated = val.substring(0, lineStart) + val.substring(start);
              onChangeContent(updated);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lineStart;
                }
              }, 0);
              return;
            } else {
              // Continue blockquote
              const nextPrefix = `\n${prefix}`;
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

          // 5. Heading: "# ", "## ", etc.
          const headingMatch = currentLine.match(/^(\s*#{1,6}\s*)(.*)$/);
          if (headingMatch) {
            const headingContent = headingMatch[2];
            if (!headingContent.trim()) {
              // Empty heading: exit/cancel heading
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
      }

      // Markdown Backspace handling to delete list/blockquote/heading formatting
      if (e.key === 'Backspace') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) {
          const val = content;
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const lineBeforeCursor = val.substring(lineStart, start);

          // If cursor is right after marker: "1. |", "- |", "> |", "# |", "- [ ] |"
          const markerMatch = lineBeforeCursor.match(/^(\s*(?:\[[ x_]?\]|(?:[-*+•]\s*\[[ x_]?\])|\d+[.)]|[-*+•]|>+|#{1,6})\s+)$/i);
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
