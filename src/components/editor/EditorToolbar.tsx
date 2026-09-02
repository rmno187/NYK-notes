import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Code,
  Quote,
  CheckSquare,
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
  hasTextSelection,
  activeFormats,
  onFormat,
  onUndo,
  onRedo,
}) => {
  // Prevent blur on touch / mouse down to keep keyboard open during formatting
  const handleActionStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onMouseDown={handleActionStart}
      onTouchStart={handleActionStart}
      className="shrink-0 w-full border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur-xs px-3 py-1.5 z-20 flex justify-center items-center select-none"
    >
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-1 py-0.5 max-w-full">
        {hasTextSelection ? (
          /* Selection Toolbar: B, I, U, link, image, H1, H2, code block, quote */
          <>
            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('bold')}
              title={`Bold (${modSymbol}B)`}
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.bold
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('italic')}
              title={`Italic (${modSymbol}I)`}
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.italic
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('underline')}
              title="Underline"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.underline
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Underline className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('link')}
              title="Insert Link"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.link
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('image')}
              title="Insert Image"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.image
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('heading')}
              title="Heading 1"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.heading
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Heading1 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('h2')}
              title="Heading 2"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.h2
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('code')}
              title="Code Block"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.code
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Code className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('quote')}
              title="Quote"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.quote
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <Quote className="w-4 h-4" />
            </button>
          </>
        ) : (
          /* Default Minimalist Toolbar: undo, redo | checkbox, image, table, line */
          <>
            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={onUndo}
              title={`Undo (${modSymbol}Z)`}
              className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 shrink-0"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={onRedo}
              title={`Redo (${modSymbol}Y)`}
              className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 shrink-0"
            >
              <Redo className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('task')}
              title="Checkbox / Task List"
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeFormats.task
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('image')}
              title="Insert Image"
              className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 shrink-0"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('table')}
              title="Insert Table"
              className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 shrink-0"
            >
              <Table className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('hr')}
              title="Horizontal Line"
              className="p-1.5 rounded-md transition-colors text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70 shrink-0"
            >
              <Minus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
