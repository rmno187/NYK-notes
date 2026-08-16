import { useEffect } from 'react';

export interface ShortcutHandlers {
  onNewNote?: () => void;
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
      const keyLower = e.key.toLowerCase();
      const editing = isEditingText(e);

      // Alt/Option + N -> New Note (avoids browser Ctrl/Cmd+N window collision)
      if (e.altKey && keyLower === 'n') {
        e.preventDefault();
        handlers.onNewNote?.();
        return;
      }

      // Ctrl/Cmd + F -> Search
      if (isCmdOrCtrl && keyLower === 'f') {
        e.preventDefault();
        handlers.onFocusSearch?.();
        return;
      }

      // Ctrl/Cmd + Shift + D -> Dark/Light
      if (isCmdOrCtrl && e.shiftKey && keyLower === 'd') {
        e.preventDefault();
        handlers.onToggleDarkMode?.();
        return;
      }

      // Ctrl/Cmd + Shift + B -> Encrypted Backup
      if (isCmdOrCtrl && e.shiftKey && keyLower === 'b') {
        e.preventDefault();
        handlers.onOpenBackupModal?.();
        return;
      }

      // Ctrl/Cmd + E -> Editor/Markdown
      if (isCmdOrCtrl && keyLower === 'e') {
        e.preventDefault();
        handlers.onToggleViewMode?.();
        return;
      }

      // Shift + ? -> Shortcuts (only when not editing text)
      if (!editing && e.shiftKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        handlers.onOpenShortcutsModal?.();
        return;
      }

      // Esc -> Close/Clear
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
  const tagName = target.tagName ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target.closest && target.closest('[contenteditable="true"]')) {
    return true;
  }
  return false;
}
