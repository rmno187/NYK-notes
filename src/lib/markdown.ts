import { Marked } from 'marked';
import TurndownService from 'turndown';

const marked = new Marked({
  gfm: true,
  breaks: true,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Add rule for task lists checkbox inputs
turndown.addRule('taskListInputs', {
  filter: (node) => {
    return node.nodeName === 'INPUT' && (node as HTMLInputElement).type === 'checkbox';
  },
  replacement: (_content, node) => {
    return (node as HTMLInputElement).checked ? '[x] ' : '[ ] ';
  },
});

// Add rule for GFM tables conversion in Turndown
turndown.addRule('tables', {
  filter: 'table',
  replacement: (_content, node) => {
    const table = node as HTMLTableElement;
    const rows = Array.from(table.rows);
    if (rows.length === 0) return '';

    const lines: string[] = [];
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.cells).map(
        (cell) => cell.textContent?.trim().replace(/\|/g, '\\|') || ''
      );
      lines.push('| ' + cells.join(' | ') + ' |');
      if (rowIndex === 0) {
        lines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
      }
    });

    return '\n\n' + lines.join('\n') + '\n\n';
  },
});

/**
 * Converts HTML string back to Markdown
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    return turndown.turndown(html);
  } catch (err) {
    console.error('Turndown error:', err);
    return html;
  }
}

/**
 * Helper to parse comma/array formatted tags
 */
function parseTagsValue(value: string): string[] {
  if (!value) return [];
  const cleanVal = value.replace(/^\[|\]$/g, '').trim();
  if (!cleanVal) return [];
  return cleanVal
    .split(',')
    .map((t) => t.trim().replace(/^['"]|['"]$/g, '').replace(/^#/, ''))
    .filter(Boolean);
}

/**
 * Parses frontmatter metadata from markdown string
 * e.g.
 * ---
 * title: ""
 * tags: []
 * pinned: false
 * ---
 * Content goes here...
 */
export function parseMarkdownNote(rawContent: string, defaultFileName?: string) {
  let title = '';
  let hasExplicitTitle = false;
  let tags: string[] = [];
  let pinned = false;
  let content = (rawContent || '').replace(/^\uFEFF/, ''); // Strip UTF-8 BOM if present

  // 1. Check for YAML Frontmatter delimited by --- or +++
  const frontmatterMatch = content.match(/^\s*(?:---|---)\r?\n([\s\S]*?)\r?\n(?:---|---)[ \t]*\r?\n?([\s\S]*)$/);

  if (frontmatterMatch) {
    const yamlStr = frontmatterMatch[1];
    content = frontmatterMatch[2];

    const lines = yamlStr.split('\n');
    lines.forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();

        if (key === 'title') {
          hasExplicitTitle = true;
          title = value.replace(/^['"]|['"]$/g, '');
        } else if (key === 'pinned') {
          pinned = value.toLowerCase() === 'true';
        } else if (key === 'tags') {
          tags = parseTagsValue(value);
        }
      }
    });
  } else {
    // 2. Check if file starts with undelimited YAML/metadata headers at top
    // e.g.:
    // title: ""
    // tags: []
    // pinned: false
    const lines = content.split('\n');
    let headerLineCount = 0;
    let foundHeaders = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (foundHeaders) {
          headerLineCount = i + 1;
          break;
        }
        continue;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        if (['title', 'tags', 'pinned', 'created', 'updated', 'date', 'id'].includes(key)) {
          foundHeaders = true;
          headerLineCount = i + 1;
          if (key === 'title') {
            hasExplicitTitle = true;
            title = value.replace(/^['"]|['"]$/g, '');
          } else if (key === 'pinned') {
            pinned = value.toLowerCase() === 'true';
          } else if (key === 'tags') {
            tags = parseTagsValue(value);
          }
          continue;
        }
      }
      break;
    }

    if (foundHeaders && headerLineCount > 0) {
      content = lines.slice(headerLineCount).join('\n');
    }
  }

  // Clean leading blank lines that were after frontmatter
  content = content.replace(/^\r?\n+/, '');

  // 3. Fallback title extraction if no explicit title was found in frontmatter/metadata:
  if (!hasExplicitTitle) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    } else if (defaultFileName) {
      const cleanName = defaultFileName.replace(/\.(md|markdown|txt)$/i, '').trim();
      // If filename is a generated ID like "note-msuwvu9y", "note-123", "untitled-x", leave title blank
      const isGeneratedId = /^(note|untitled)(-[a-z0-9]+)?$/i.test(cleanName);
      if (!isGeneratedId) {
        title = cleanName;
      }
    }
  }

  // Clean legacy raw HTML content strings if necessary
  if (content.trim().startsWith('<p>') && content.includes('</p>')) {
    content = convertHtmlToMarkdown(content);
  }

  // Extract inline #hashtags from content (e.g., #project #todo)
  const inlineTags = extractHashtags(content);
  const combinedTags = Array.from(new Set([...tags, ...inlineTags]));

  return {
    title,
    tags: combinedTags,
    pinned,
    content,
  };
}

/**
 * Serialize note into Markdown with clean YAML Frontmatter
 */
export function serializeNoteToMarkdown(title: string, tags: string[], pinned: boolean, content: string): string {
  const frontmatterLines = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `pinned: ${pinned}`,
    '---',
    '',
  ];

  return frontmatterLines.join('\n') + content;
}

/**
 * Extracts hashtag words like #work #idea from markdown text
 */
export function extractHashtags(text: string): string[] {
  // Regex to match #tag (alphanumeric and dashes, not preceded by word char or # header)
  const matches = text.match(/(?:^|\s)#([a-zA-Z0-9_-]+)(?=\s|$)/g);
  if (!matches) return [];

  return Array.from(
    new Set(
      matches
        .map((m) => m.trim().replace(/^#/, ''))
        .filter((tag) => !/^\d+$/.test(tag)) // Ignore pure numbers like #123
    )
  );
}

/**
 * Renders Markdown string to sanitized HTML string
 */
export function renderMarkdownToHtml(markdownContent: string): string {
  if (!markdownContent) return '';
  let cleanMarkdown = markdownContent;
  if (cleanMarkdown.trim().startsWith('<p>') && cleanMarkdown.includes('</p>')) {
    cleanMarkdown = convertHtmlToMarkdown(cleanMarkdown);
  }
  try {
    const rawHtml = marked.parse(cleanMarkdown) as string;
    // Remove disabled attribute from checkbox inputs so they can be clicked/toggled
    return rawHtml
      .replace(/<input([^>]*)\sdisabled=""([^>]*)>/gi, '<input$1$2>')
      .replace(/<input([^>]*)\sdisabled([^>]*)>/gi, '<input$1$2>');
  } catch (err) {
    return `<p class="text-red-500">Error rendering Markdown</p>`;
  }
}

/**
 * Calculate Word, Character, and Reading Time statistics
 */
export function getMarkdownStats(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const characters = text.length;
  const lines = text ? text.split('\n').length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    words,
    characters,
    lines,
    readingTimeMinutes,
  };
}

/**
 * Formatting helpers for markdown editor toolbar
 */
export function applyFormatting(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  type: 'bold' | 'italic' | 'heading' | 'h2' | 'paragraph' | 'code' | 'quote' | 'link' | 'bullet' | 'number' | 'task' | 'table' | 'hr'
): { text: string; newStart: number; newEnd: number } {
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd) || 'text';
  const after = text.slice(selectionEnd);

  let prefix = '';
  let suffix = '';
  let newText = '';
  let cursorOffsetStart = selectionStart;
  let cursorOffsetEnd = selectionEnd;

  switch (type) {
    case 'bold':
      prefix = '**';
      suffix = '**';
      newText = before + prefix + selected + suffix + after;
      cursorOffsetStart = selectionStart + 2;
      cursorOffsetEnd = selectionEnd + 2;
      break;
    case 'italic':
      prefix = '*';
      suffix = '*';
      newText = before + prefix + selected + suffix + after;
      cursorOffsetStart = selectionStart + 1;
      cursorOffsetEnd = selectionEnd + 1;
      break;
    case 'code':
      if (selected.includes('\n')) {
        prefix = '```\n';
        suffix = '\n```';
      } else {
        prefix = '`';
        suffix = '`';
      }
      newText = before + prefix + selected + suffix + after;
      cursorOffsetStart = selectionStart + prefix.length;
      cursorOffsetEnd = selectionEnd + prefix.length;
      break;
    case 'paragraph':
    case 'heading':
    case 'h2':
    case 'quote':
    case 'bullet':
    case 'number':
    case 'task': {
      // Find full lines covered by selection
      const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
      let lineEnd = text.indexOf('\n', selectionEnd);
      if (lineEnd === -1) lineEnd = text.length;

      const preBlock = text.slice(0, lineStart);
      const targetLines = text.slice(lineStart, lineEnd).split('\n');
      const postBlock = text.slice(lineEnd);

      // Clean prefix regex for tasks, bullets, numbers, quotes, headings
      const prefixRegex = /^\s*(?:-\s*\[[\s\S]?\]\s*|\[[\s\S]?\]\s*|[-*+•]\s*|\d+\.\s*|>\s*|#{1,6}\s*)/;

      // Check if all lines already match target prefix
      const isAlreadyTask = targetLines.every((l) => /^\s*(?:-\s*\[[\s\S]?\]|\[[\s\S]?\])/.test(l));
      const isAlreadyBullet = targetLines.every((l) => /^\s*[-*+•]\s+(?!\[[\s\S]?\])/.test(l));
      const isAlreadyNumber = targetLines.every((l) => /^\s*\d+\.\s+/.test(l));
      const isAlreadyHeading = targetLines.every((l) => /^\s*#\s+/.test(l));
      const isAlreadyH2 = targetLines.every((l) => /^\s*##\s+/.test(l));
      const isAlreadyQuote = targetLines.every((l) => /^\s*>\s+/.test(l));

      let isToggleOff = false;
      if (type === 'task' && isAlreadyTask) isToggleOff = true;
      if (type === 'bullet' && isAlreadyBullet) isToggleOff = true;
      if (type === 'number' && isAlreadyNumber) isToggleOff = true;
      if (type === 'heading' && isAlreadyHeading) isToggleOff = true;
      if (type === 'h2' && isAlreadyH2) isToggleOff = true;
      if (type === 'quote' && isAlreadyQuote) isToggleOff = true;
      if (type === 'paragraph') isToggleOff = true;

      const formattedLines = targetLines.map((line, idx) => {
        const cleanContent = line.replace(prefixRegex, '');
        if (isToggleOff) {
          return cleanContent;
        }
        switch (type) {
          case 'task':
            return `- [ ] ${cleanContent}`;
          case 'bullet':
            return `- ${cleanContent}`;
          case 'number':
            return `${idx + 1}. ${cleanContent}`;
          case 'heading':
            return `# ${cleanContent}`;
          case 'h2':
            return `## ${cleanContent}`;
          case 'quote':
            return `> ${cleanContent}`;
          default:
            return cleanContent;
        }
      });

      const joined = formattedLines.join('\n');
      newText = preBlock + joined + postBlock;
      cursorOffsetStart = lineStart;
      cursorOffsetEnd = lineStart + joined.length;
      break;
    }
    case 'link':
      newText = before + `[${selected}](url)` + after;
      cursorOffsetStart = selectionStart + selected.length + 3;
      cursorOffsetEnd = cursorOffsetStart + 3;
      break;
    case 'table':
      const tableTmpl = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Item 1   | Item 2   |\n`;
      newText = before + tableTmpl + after;
      cursorOffsetStart = selectionStart + tableTmpl.length;
      cursorOffsetEnd = cursorOffsetStart;
      break;
    case 'hr':
      const hrTmpl = `\n---\n`;
      newText = before + hrTmpl + after;
      cursorOffsetStart = selectionStart + hrTmpl.length;
      cursorOffsetEnd = cursorOffsetStart;
      break;
    default:
      return { text, newStart: selectionStart, newEnd: selectionEnd };
  }

  return { text: newText, newStart: cursorOffsetStart, newEnd: cursorOffsetEnd };
}
