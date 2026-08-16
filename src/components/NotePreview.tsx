import React from 'react';
import { convertHtmlToMarkdown } from '../lib/markdown';

interface NotePreviewProps {
  content: string;
}

function parseInlineTokens(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match pattern for inline code, links, bold, italic
  const combinedRegex = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*]+\*|_[^_]+_)/g;

  let lastIndex = 0;
  let match;
  const result: React.ReactNode[] = [];
  let keyIndex = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<span key={keyIndex++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const fullMatch = match[0];

    if (fullMatch.startsWith('`') && fullMatch.endsWith('`')) {
      // Inline Code
      const codeText = fullMatch.slice(1, -1);
      result.push(
        <code
          key={keyIndex++}
          className="font-mono text-xs bg-neutral-200/80 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 px-1 py-0.2 rounded border border-neutral-300/50 dark:border-neutral-700/50"
        >
          {codeText}
        </code>
      );
    } else if (fullMatch.startsWith('[') && fullMatch.includes('](')) {
      // Link
      const linkMatch = fullMatch.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const label = linkMatch[1];
        result.push(
          <span key={keyIndex++} className="text-blue-600 dark:text-blue-400 underline">
            {label}
          </span>
        );
      } else {
        result.push(<span key={keyIndex++}>{fullMatch}</span>);
      }
    } else if (
      (fullMatch.startsWith('**') && fullMatch.endsWith('**')) ||
      (fullMatch.startsWith('__') && fullMatch.endsWith('__'))
    ) {
      // Bold
      const boldText = fullMatch.slice(2, -2);
      result.push(
        <strong key={keyIndex++} className="font-bold text-current">
          {boldText}
        </strong>
      );
    } else if (
      (fullMatch.startsWith('*') && fullMatch.endsWith('*')) ||
      (fullMatch.startsWith('_') && fullMatch.endsWith('_'))
    ) {
      // Italic
      const italicText = fullMatch.slice(1, -1);
      result.push(
        <em key={keyIndex++} className="italic font-normal">
          {italicText}
        </em>
      );
    } else {
      result.push(<span key={keyIndex++}>{fullMatch}</span>);
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(<span key={keyIndex++}>{text.slice(lastIndex)}</span>);
  }

  return result;
}

function renderLine(line: string): React.ReactNode {
  const text = line.trim();
  if (!text) return null;

  // Checkboxes / Task list items (matches with or without bullet prefix, and any mark in brackets)
  const taskMatch = text.match(/^(?:[-*+•]|\d+\.)?\s*\[([\s\S]?)\]\s*(.*)$/);
  if (taskMatch) {
    const mark = taskMatch[1];
    const cleanText = taskMatch[2];
    const isChecked = ['x', 'X', 'v', 'V', '1', '✓', '☑'].includes(mark);

    return (
      <span className="inline-flex items-center space-x-1.5 align-middle">
        <input
          type="checkbox"
          checked={isChecked}
          readOnly
          tabIndex={-1}
          className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-white dark:black focus:ring-0 cursor-default pointer-events-none shrink-0 accent-black dark:accent-white"
        />
        <span className={isChecked ? 'line-through opacity-70' : ''}>
          {parseInlineTokens(cleanText)}
        </span>
      </span>
    );
  }

  // Headings
  if (/^#+\s+/.test(text)) {
    const cleanText = text.replace(/^#+\s+/, '');
    return (
      <span className="font-semibold text-current">
        {parseInlineTokens(cleanText)}
      </span>
    );
  }

  // Bullets
  if (/^(\*|-|\+)\s+/.test(text)) {
    const cleanText = text.replace(/^(\*|-|\+)\s+/, '');
    return (
      <span>
        <span className="text-current font-bold mr-1">•</span>
        {parseInlineTokens(cleanText)}
      </span>
    );
  }

  // Numbered lists
  const numMatch = text.match(/^(\d+\.)\s+(.+)$/);
  if (numMatch) {
    const numPrefix = numMatch[1];
    const cleanText = numMatch[2];
    return (
      <span>
        <span className="text-current font-mono mr-1 text-xs">{numPrefix}</span>
        {parseInlineTokens(cleanText)}
      </span>
    );
  }

  // Code blocks (e.g. ```js)
  if (text.startsWith('```')) {
    const cleanCode = text.replace(/^```[a-z]*/i, '').replace(/```$/, '').trim();
    if (!cleanCode) return null;
    return (
      <span className="font-mono text-xs bg-neutral-200/80 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-800 dark:text-neutral-200 block truncate">
        {cleanCode}
      </span>
    );
  }

  // Standard line
  return <span>{parseInlineTokens(text)}</span>;
}

export const NotePreview: React.FC<NotePreviewProps> = ({ content }) => {
  if (!content || !content.trim()) {
    return <span className="italic text-neutral-400 font-normal text-sm">Empty note...</span>;
  }

  // Convert HTML to standard markdown if it looks like HTML
  let markdown = content;
  if (/<[a-z][\s\S]*>/i.test(content)) {
    markdown = convertHtmlToMarkdown(content);
  }

  // Remove images ![alt](url) and HTML img tags
  markdown = markdown
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '')
    .replace(/<img[^>]*>/gi, '');

  // Split lines
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return <span className="italic text-current font-normal text-sm">Empty note...</span>;
  }

  const displayLines = lines.slice(0, 4);

  return (
    <div className="space-y-0.5 text-sm text-neutral-700 dark:text-neutral-300 font-normal leading-relaxed line-clamp-4">
      {displayLines.map((line, idx) => {
        const rendered = renderLine(line);
        if (!rendered) return null;
        return <div key={idx}>{rendered}</div>;
      })}
    </div>
  );
};
