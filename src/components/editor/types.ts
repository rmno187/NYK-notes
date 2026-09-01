import { Note, EditorMode, StorageMode, Theme, NoteType, NoteImage, ImageFolderStrategy } from '../../types';

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
  image?: boolean;
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
  | 'image'
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
  // Blog Post & Shared Fields
  onChangeDescription?: (description: string) => void;
  onChangeAuthor?: (author: string) => void;
  onChangeProject?: (project: string) => void;
  allProjects?: string[];
  allAuthors?: string[];
  onToggleFeatured?: () => void;
  onChangeType?: (type: NoteType) => void;
  onChangeDate?: (date: string) => void;
  // Project specific handlers
  onChangeSlug?: (slug: string) => void;
  onChangeStatus?: (status: string) => void;
  onChangeYear?: (year: number | string) => void;
  onChangeUrl?: (url: string) => void;
  onChangeGithub?: (github: string) => void;
  onChangeOrder?: (order: number) => void;
  // Image assets management
  onAddImage?: (image: NoteImage) => void;
  onRemoveImage?: (imageId: string) => void;
  onChangeImageFolderStrategy?: (strategy: ImageFolderStrategy) => void;
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
