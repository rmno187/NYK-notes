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
      className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-black rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white rounded-lg">
              <Command className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Speed up your markdown workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {categories.map((category) => {
            const categoryShortcuts = shortcuts.filter((s) => s.category === category);
            return (
              <div key={category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-mono">
                  {category}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {categoryShortcuts.map((s, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
                    >
                      <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                        {s.description}
                      </span>
                      <kbd className="px-2 py-0.5 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-700 rounded text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 shadow-2xs">
                        {formatShortcut(s.combination)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-neutral-50 dark:bg-black border-t border-neutral-200 dark:border-neutral-800 text-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-semibold rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
