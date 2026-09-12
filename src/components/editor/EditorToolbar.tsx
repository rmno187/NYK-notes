import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  RemoveFormatting,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Table,
  Minus,
  Undo,
  Redo,
} from 'lucide-react';
import { ActiveFormats, FormatActionType } from './types';
import { modSymbol } from '../../lib/platform';

interface EditorToolbarProps {
  hasTextSelection: boolean;
  activeFormats: ActiveFormats;
  onFormat: (type: FormatActionType) => void;
  onUndo: () => void;
  onRedo: () => void;
  keyboardOffset?: number;
  isKeyboardOpen?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeFormats,
  onFormat,
  onUndo,
  onRedo,
}) => {
  // Prevent blur on touch / mouse down to keep keyboard open during formatting
  const handleActionStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const buttonClass = (isActive: boolean = false) =>
    `p-1.5 rounded-md transition-colors shrink-0 ${
      isActive
        ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
        : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
    }`;

  return (
    <div
      id="editor-toolbar-container"
      onMouseDown={handleActionStart}
      onTouchStart={handleActionStart}
      className="shrink-0 w-full border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur-xs px-3 py-1.5 z-20 flex justify-center items-center select-none"
    >
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-1 py-0.5 max-w-full">
        {/* History: Undo / Redo */}
        <button
          type="button"
          id="toolbar-undo-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={onUndo}
          title={`Undo (${modSymbol}Z)`}
          className={buttonClass(false)}
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-redo-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={onRedo}
          title={`Redo (${modSymbol}Y)`}
          className={buttonClass(false)}
        >
          <Redo className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

        {/* Text Styling: Bold, Italic, Underline, Strikethrough, Clear Formatting */}
        <button
          type="button"
          id="toolbar-bold-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('bold')}
          title={`Bold (${modSymbol}B)`}
          className={buttonClass(activeFormats.bold)}
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-italic-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('italic')}
          title={`Italic (${modSymbol}I)`}
          className={buttonClass(activeFormats.italic)}
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-underline-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('underline')}
          title={`Underline (${modSymbol}U)`}
          className={buttonClass(activeFormats.underline)}
        >
          <Underline className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-strikethrough-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('strike')}
          title={`Strikethrough (${modSymbol}Shift+X)`}
          className={buttonClass(activeFormats.strike)}
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-clear-formatting-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('clear')}
          title={`Clear Formatting (${modSymbol}\\)`}
          className={buttonClass(false)}
        >
          <RemoveFormatting className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

        {/* Headings */}
        <button
          type="button"
          id="toolbar-h1-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('heading')}
          title="Heading 1"
          className={buttonClass(activeFormats.heading)}
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-h2-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('h2')}
          title="Heading 2"
          className={buttonClass(activeFormats.h2)}
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

        {/* Lists: Bulleted, Numbered, Task */}
        <button
          type="button"
          id="toolbar-bullet-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('bullet')}
          title="Bulleted List"
          className={buttonClass(activeFormats.bullet)}
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-number-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('number')}
          title="Numbered List"
          className={buttonClass(activeFormats.number)}
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-task-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('task')}
          title="Checkbox / Task List"
          className={buttonClass(activeFormats.task)}
        >
          <CheckSquare className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

        {/* Blocks: Quote, Code */}
        <button
          type="button"
          id="toolbar-quote-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('quote')}
          title="Quote"
          className={buttonClass(activeFormats.quote)}
        >
          <Quote className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-code-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('code')}
          title="Code Block"
          className={buttonClass(activeFormats.code)}
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

        {/* Inserts: Link, Image, Table, Horizontal Rule */}
        <button
          type="button"
          id="toolbar-link-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('link')}
          title={`Insert Link (${modSymbol}K)`}
          className={buttonClass(activeFormats.link)}
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-image-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('image')}
          title="Insert Image"
          className={buttonClass(Boolean(activeFormats.image))}
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-table-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('table')}
          title="Insert Table"
          className={buttonClass(false)}
        >
          <Table className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="toolbar-hr-btn"
          onMouseDown={handleActionStart}
          onTouchStart={handleActionStart}
          onClick={() => onFormat('hr')}
          title="Horizontal Line"
          className={buttonClass(false)}
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
