import { Note, EditorMode, StorageMode, Theme } from '../../types';

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  heading: boolean;
  h2: boolean;
  bullet: boolean;
  number: boolean;
  task: boolean;
  quote: boolean;
  code: boolean;
  link: boolean;
}

export type FormatActionType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'heading'
  | 'h2'
  | 'code'
  | 'quote'
  | 'link'
  | 'bullet'
  | 'number'
  | 'task'
  | 'paragraph'
  | 'table'
  | 'hr';

export interface HistoryItem {
  content: string;
  html?: string;
  selStart: number;
  selEnd: number;
}

export interface EditorPaneProps {
  note: Note;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onTogglePin: () => void;
  onDeleteNote?: () => void;
  onRestoreNote?: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  allTags: string[];
  editorMode?: EditorMode;
  onChangeEditorMode?: (mode: EditorMode) => void;
  onToggleEditorMode?: () => void;
  onBackToList?: () => void;
  // Local File System / Folder Ops
  onSaveToLocalFolder?: () => Promise<void> | void;
  onOpenLocalFile?: () => Promise<void> | void;
  toastMessage?: string | null;
  // Blog Post Fields
  onChangeDescription?: (description: string) => void;
  onChangeAuthor?: (author: string) => void;
  onToggleFeatured?: () => void;
  onChangeType?: (type: 'note' | 'post') => void;
  onChangeDate?: (date: string) => void;
  // App Options & Settings
  theme?: Theme;
  onToggleTheme?: () => void;
  storageMode?: StorageMode;
  directoryName?: string;
  onOpenDirectoryModal?: () => void;
  onOpenSyncModal?: () => void;
  onOpenBackupModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenShortcutsModal?: () => void;
}
