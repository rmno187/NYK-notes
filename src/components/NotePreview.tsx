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
          className="font-mono text-[10px] bg-neutral-200/80 dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 px-1 py-0.2 rounded border border-neutral-300/50 dark:border-neutral-700/50"
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
          <span key={keyIndex++} className="text-blue-600 dark:text-blue-400 underline font-medium">
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
        <strong key={keyIndex++} className="font-bold text-neutral-900 dark:text-neutral-100">
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

  // Checkboxes
  if (/^(\*|-)\s+\[x\]\s+/i.test(text) || /^\[x\]\s+/i.test(text)) {
    const cleanText = text.replace(/^(\*|-)\s+\[x\]\s+/i, '').replace(/^\[x\]\s+/i, '');
    return (
      <span className="inline-flex items-baseline space-x-1">
        <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 mr-1">☑</span>
        <span className="line-through opacity-75">{parseInlineTokens(cleanText)}</span>
      </span>
    );
  }

  if (/^(\*|-)\s+\[\s?\]\s+/i.test(text) || /^\[\s?\]\s+/i.test(text)) {
    const cleanText = text.replace(/^(\*|-)\s+\[\s?\]\s+/i, '').replace(/^\[\s?\]\s+/i, '');
    return (
      <span className="inline-flex items-baseline space-x-1">
        <span className="text-neutral-400 dark:text-neutral-500 font-bold shrink-0 mr-1">☐</span>
        <span>{parseInlineTokens(cleanText)}</span>
      </span>
    );
  }

  // Headings
  if (/^#+\s+/.test(text)) {
    const cleanText = text.replace(/^#+\s+/, '');
    return (
      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
        {parseInlineTokens(cleanText)}
      </span>
    );
  }

  // Bullets
  if (/^(\*|-|\+)\s+/.test(text)) {
    const cleanText = text.replace(/^(\*|-|\+)\s+/, '');
    return (
      <span>
        <span className="text-neutral-400 dark:text-neutral-500 font-bold mr-1">•</span>
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
        <span className="text-neutral-400 dark:text-neutral-500 font-mono mr-1 text-[10px]">{numPrefix}</span>
        {parseInlineTokens(cleanText)}
      </span>
    );
  }

  // Code blocks (e.g. ```js)
  if (text.startsWith('```')) {
    const cleanCode = text.replace(/^```[a-z]*/i, '').replace(/```$/, '').trim();
    if (!cleanCode) return null;
    return (
      <span className="font-mono text-[10px] bg-neutral-200/80 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-800 dark:text-neutral-200 block truncate">
        {cleanCode}
      </span>
    );
  }

  // Standard line
  return <span>{parseInlineTokens(text)}</span>;
}

export const NotePreview: React.FC<NotePreviewProps> = ({ content }) => {
  if (!content || !content.trim()) {
    return <span className="italic text-neutral-400 font-normal">Empty note...</span>;
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
    return <span className="italic text-neutral-400 font-normal">Empty note...</span>;
  }

  const displayLines = lines.slice(0, 4);

  return (
    <div className="space-y-0.5 text-xs text-neutral-700 dark:text-neutral-300 font-normal leading-relaxed line-clamp-4">
      {displayLines.map((line, idx) => {
        const rendered = renderLine(line);
        if (!rendered) return null;
        return <div key={idx}>{rendered}</div>;
      })}
    </div>
  );
};
