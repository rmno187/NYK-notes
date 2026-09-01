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
  keyboardOffset = 0,
  isKeyboardOpen = false,
}) => {
  // Compute dynamic bottom positioning on mobile so toolbar sticks precisely to keyboard
  const getMobileToolbarStyle = (): React.CSSProperties => {
    // If keyboard is active or offset detected on mobile
    if (keyboardOffset > 0 || isKeyboardOpen) {
      return {
        bottom: `${keyboardOffset + 8}px`,
      };
    }

    return {
      bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
    };
  };

  // Prevent blur on touch / mouse down to keep keyboard open during formatting
  const handleActionStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onMouseDown={handleActionStart}
      onTouchStart={handleActionStart}
      className={`fixed left-0 right-0 z-30 flex justify-center px-3 sm:px-4 w-full md:static md:pointer-events-auto md:w-auto md:px-5 md:py-1.5 md:border-b md:border-neutral-200 md:dark:border-neutral-800 md:bg-transparent select-none order-2 md:order-1 transition-[bottom] duration-100 ease-out pointer-events-none`}
      style={getMobileToolbarStyle()}
    >
      <div className="pointer-events-auto flex items-center gap-1 overflow-x-auto scrollbar-none px-2.5 py-1 bg-neutral-900/95 dark:bg-neutral-900/95 md:bg-transparent text-neutral-100 md:text-inherit rounded-full md:rounded-none shadow-2xl md:shadow-none border border-neutral-700/70 dark:border-neutral-700/70 md:border-none backdrop-blur-md max-w-full">
        {hasTextSelection ? (
          /* Selection Toolbar: B, I, U, link, H1, H2, code block, quote */
          <>
            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('bold')}
              title={`Bold (${modSymbol}B)`}
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.bold
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
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
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.italic
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
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
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.underline
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
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
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.link
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-neutral-700/60 md:bg-neutral-200 md:dark:bg-neutral-800 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('heading')}
              title="Heading 1"
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.heading
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
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
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.h2
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
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
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.code
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
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
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.quote
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
              }`}
            >
              <Quote className="w-4 h-4" />
            </button>
          </>
        ) : (
          /* Default Minimalist Toolbar: undo, redo | checkbox, table, line */
          <>
            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={onUndo}
              title={`Undo (${modSymbol}Z)`}
              className="p-1.5 rounded-full md:rounded-md transition-colors text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60 shrink-0"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={onRedo}
              title={`Redo (${modSymbol}Y)`}
              className="p-1.5 rounded-full md:rounded-md transition-colors text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60 shrink-0"
            >
              <Redo className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-neutral-700/60 md:bg-neutral-200 md:dark:bg-neutral-800 mx-1 shrink-0" />

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('task')}
              title="Checkbox / Task List"
              className={`p-1.5 rounded-full md:rounded-md transition-colors shrink-0 ${
                activeFormats.task
                  ? 'bg-blue-600 text-white md:bg-neutral-200 md:dark:bg-neutral-800 md:text-blue-600 md:dark:text-blue-400 font-bold'
                  : 'text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('table')}
              title="Insert Table"
              className="p-1.5 rounded-full md:rounded-md transition-colors text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60 shrink-0"
            >
              <Table className="w-4 h-4" />
            </button>

            <button
              type="button"
              onMouseDown={handleActionStart}
              onTouchStart={handleActionStart}
              onClick={() => onFormat('hr')}
              title="Horizontal Line"
              className="p-1.5 rounded-full md:rounded-md transition-colors text-neutral-300 md:text-neutral-600 md:dark:text-neutral-400 hover:text-white md:hover:text-neutral-900 md:dark:hover:text-neutral-100 hover:bg-neutral-800/80 md:hover:bg-neutral-100 md:dark:hover:bg-neutral-800/60 shrink-0"
            >
              <Minus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
