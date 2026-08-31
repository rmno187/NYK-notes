import React from 'react';
import { X, Command } from 'lucide-react';
import { KeyboardShortcut } from '../types';
import { formatShortcut } from '../lib/platform';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts: KeyboardShortcut[] = [
    { combination: 'Alt/Option + N', description: 'New Note', key: 'n', category: 'General' },
    { combination: 'Ctrl/Cmd + S', description: 'Save .md to local folder', key: 's', category: 'General' },
    { combination: 'Ctrl/Cmd + O', description: 'Import / Open .md', key: 'o', category: 'General' },
    { combination: 'Ctrl/Cmd + F', description: 'Search', key: 'f', category: 'General' },
    { combination: 'Ctrl/Cmd + Shift + D', description: 'Dark/Light', key: 'd', category: 'General' },
    { combination: 'Ctrl/Cmd + Shift + B', description: 'Encrypted Backup', key: 'b', category: 'General' },

    { combination: 'Ctrl/Cmd + E', description: 'Editor/Markdown', key: 'e', category: 'Navigation' },
    { combination: 'Esc', description: 'Close/Clear', key: 'Escape', category: 'Navigation' },
    { combination: 'Shift + ?', description: 'Shortcuts', key: '?', category: 'Navigation' },

    { combination: 'Ctrl/Cmd + Z', description: 'Undo', key: 'z', category: 'Editing' },
    { combination: 'Ctrl/Cmd + Shift + Z', description: 'Redo', key: 'z', category: 'Editing' },
    { combination: 'Ctrl/Cmd + B', description: 'Bold', key: 'b', category: 'Editing' },
    { combination: 'Ctrl/Cmd + I', description: 'Italic', key: 'i', category: 'Editing' },
    { combination: 'Tab / Shift+Tab', description: 'Indent/Outdent', key: 'Tab', category: 'Editing' },
  ];

  const categories = ['General', 'Navigation', 'Editing'] as const;

  return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-black dark:text-white">
            Keyboard shortcuts
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            A quick reference for working with your notes.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Shortcuts */}
      <div className="px-5 py-5 max-h-[65vh] overflow-y-auto">
        <div className="space-y-7">
          {categories.map((category) => {
            const categoryShortcuts = shortcuts.filter(
              (s) => s.category === category
            );

            return (
              <section key={category}>
                {/* Category */}
                <div className="mb-2.5 flex items-center gap-3">
                  <h3 className="text-[10px] font-medium tracking-[0.12em] text-neutral-400 dark:text-neutral-600">
                    {category}
                  </h3>

                  <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                </div>

                {/* Shortcut list */}
                <div>
                  {categoryShortcuts.map((s, i) => (
                    <div
                      key={i}
                      className="min-h-10 py-2 flex items-center justify-between gap-6 border-b border-neutral-100 dark:border-neutral-900 last:border-0"
                    >
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">
                        {s.description}
                      </span>

                      <kbd className="shrink-0 text-[11px] font-mono text-black dark:text-white whitespace-nowrap">
                        {formatShortcut(s.combination)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-500 hover:text-black dark:hover:text-white underline underline-offset-4 decoration-neutral-300 dark:decoration-neutral-700 hover:decoration-black dark:hover:decoration-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);
};
