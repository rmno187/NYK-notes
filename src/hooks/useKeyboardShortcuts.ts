import { useEffect } from 'react';

export interface ShortcutHandlers {
  onNewNote?: () => void;
  onOpenCommandPalette?: () => void;
  onToggleDarkMode?: () => void;
  onToggleViewMode?: () => void;
  onSaveNote?: () => void;
  onFocusSearch?: () => void;
  onOpenBackupModal?: () => void;
  onOpenShortcutsModal?: () => void;
  onCloseModals?: () => void;
  onDeleteNote?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K -> Command Palette
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onOpenCommandPalette?.();
        return;
      }

      // Cmd/Ctrl + N -> New Note
      if (isCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handlers.onNewNote?.();
        return;
      }

      // Cmd/Ctrl + Shift + D -> Toggle Dark Mode
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onToggleDarkMode?.();
        return;
      }

      // Cmd/Ctrl + P or Cmd/Ctrl + E -> Toggle View Mode (Split/Edit/Preview)
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'e')) {
        // Only prevent default if not inside input or if explicit view shortcut
        if (!isEditingText(e) || isCmdOrCtrl) {
          e.preventDefault();
          handlers.onToggleViewMode?.();
          return;
        }
      }

      // Cmd/Ctrl + S -> Save note
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlers.onSaveNote?.();
        return;
      }

      // Cmd/Ctrl + F -> Focus search
      if (isCmdOrCtrl && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        handlers.onFocusSearch?.();
        return;
      }

      // Cmd/Ctrl + Shift + B -> Backup Modal
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handlers.onOpenBackupModal?.();
        return;
      }

      // ? or Cmd+/ -> Keyboard Shortcuts Cheat Sheet
      if ((e.key === '?' && !isEditingText(e)) || (isCmdOrCtrl && e.key === '/')) {
        e.preventDefault();
        handlers.onOpenShortcutsModal?.();
        return;
      }

      // Escape -> Close modals
      if (e.key === 'Escape') {
        handlers.onCloseModals?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

function isEditingText(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  if (!target) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}
