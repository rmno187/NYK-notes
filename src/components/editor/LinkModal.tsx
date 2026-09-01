import React from 'react';
import { Link as LinkIcon, X } from 'lucide-react';

interface LinkModalProps {
  isOpen: boolean;
  linkUrl: string;
  linkText: string;
  onChangeUrl: (url: string) => void;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  linkUrl,
  linkText,
  onChangeUrl,
  onChangeText,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
            <LinkIcon className="w-4 h-4 text-blue-500" />
            <span>Insert Hyperlink</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Link URL
            </label>
            <input
              type="text"
              required
              value={linkUrl}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
              Display Text
            </label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="Link text"
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-black dark:hover:bg-neutral-200 rounded-lg transition-colors shadow-xs"
            >
              Insert Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
