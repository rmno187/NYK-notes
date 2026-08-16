import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Moon,
  Sun,
  HardDrive,
  Key,
  HelpCircle,
  Eye,
  FileText,
} from 'lucide-react';
import { Note } from '../types';
import { isMac, modSymbol, altSymbol } from '../lib/platform';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onToggleTheme: () => void;
  onToggleViewMode: () => void;
  onOpenDirectoryModal: () => void;
  onOpenBackupModal: () => void;
  onOpenShortcutsModal: () => void;
}

interface ActionItem {
  id: string;
  type: 'action';
  title: string;
  shortcut?: string;
  icon: React.ReactNode;
  handler: () => void;
}

interface NoteItem {
  id: string;
  type: 'note';
  title: string;
  snippet: string;
  tags: string[];
  noteId: string;
}

type PaletteItem = ActionItem | NoteItem;

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  notes,
  onSelectNote,
  onNewNote,
  onToggleTheme,
  onToggleViewMode,
  onOpenDirectoryModal,
  onOpenBackupModal,
  onOpenShortcutsModal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions: ActionItem[] = [
    {
      id: 'act-new',
      type: 'action',
      title: 'Create New Note',
      shortcut: `${altSymbol}${isMac ? '' : '+'}N`,
      icon: <Plus className="w-4 h-4" />,
      handler: () => {
        onNewNote();
        onClose();
      },
    },
    {
      id: 'act-view',
      type: 'action',
      title: 'Toggle Editor View (WYSIWYG / Markdown)',
      shortcut: `${modSymbol}${isMac ? '' : '+'}E`,
      icon: <Eye className="w-4 h-4" />,
      handler: () => {
        onToggleViewMode();
        onClose();
      },
    },
    {
      id: 'act-theme',
      type: 'action',
      title: 'Toggle Dark / Light Mode',
      shortcut: `${modSymbol}${isMac ? '⇧' : '+Shift+'}D`,
      icon: <Sun className="w-4 h-4" />,
      handler: () => {
        onToggleTheme();
        onClose();
      },
    },
    {
      id: 'act-dir',
      type: 'action',
      title: 'Choose Local Directory Storage',
      icon: <HardDrive className="w-4 h-4" />,
      handler: () => {
        onOpenDirectoryModal();
        onClose();
      },
    },
    {
      id: 'act-backup',
      type: 'action',
      title: 'Encrypted Backup Export / Import',
      shortcut: `${modSymbol}${isMac ? '⇧' : '+Shift+'}B`,
      icon: <Key className="w-4 h-4" />,
      handler: () => {
        onOpenBackupModal();
        onClose();
      },
    },
    {
      id: 'act-help',
      type: 'action',
      title: 'Keyboard Shortcuts Cheat Sheet',
      shortcut: '⇧?',
      icon: <HelpCircle className="w-4 h-4" />,
      handler: () => {
        onOpenShortcutsModal();
        onClose();
      },
    },
  ];

  const noteItems: NoteItem[] = notes.map((n) => ({
    id: `note-${n.id}`,
    type: 'note',
    title: n.title || 'Untitled Note',
    snippet: n.content.slice(0, 60).replace(/[*#_~]/g, ''),
    tags: n.tags,
    noteId: n.id,
  }));

  const filteredActions = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  const filteredNotes = noteItems.filter(
    (n) =>
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      n.snippet.toLowerCase().includes(query.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const allItems: PaletteItem[] = [...filteredActions, ...filteredNotes];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allItems[selectedIndex];
      if (selected) {
        if (selected.type === 'action') {
          selected.handler();
        } else {
          onSelectNote(selected.noteId);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-black rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-neutral-400 ml-1 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-[10px] font-mono text-neutral-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">No matching commands or notes</div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;

              if (item.type === 'action') {
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      item.handler();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>

                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-[10px] font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectNote(item.noteId);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 rounded-lg cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-semibold">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{item.title}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[9px] rounded font-mono"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {item.snippet && (
                    <p className="text-[11px] text-neutral-400 truncate mt-1 pl-5">
                      {item.snippet}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-2.5 bg-neutral-50 dark:bg-black border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Command Palette</span>
        </div>
      </div>
    </div>
  );
};
