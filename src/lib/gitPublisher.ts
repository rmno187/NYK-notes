import { Note, GitPublishConfig } from '../types';
import { serializeNoteToMarkdown } from './markdown';
import { generateNoteFilename } from './localFileOperations';

const STORAGE_KEY = 'blog_git_publish_config_v1';

export const DEFAULT_GIT_PUBLISH_CONFIG: GitPublishConfig = {
  githubRepo: '',
  githubBranch: 'main',
  githubFolderPath: 'content/posts',
  githubToken: '',
  commitMessageTemplate: 'Publish: {title}',
  includeImages: true,
};

export function getStoredGitPublishConfig(): GitPublishConfig {
  if (typeof window === 'undefined') return DEFAULT_GIT_PUBLISH_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GIT_PUBLISH_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_GIT_PUBLISH_CONFIG, ...parsed };
  } catch {
    return DEFAULT_GIT_PUBLISH_CONFIG;
  }
}

export function saveStoredGitPublishConfig(config: Partial<GitPublishConfig>): GitPublishConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_GIT_PUBLISH_CONFIG, ...config };
  try {
    const current = getStoredGitPublishConfig();
    const merged = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.error('Failed to save git publish config:', err);
    return { ...DEFAULT_GIT_PUBLISH_CONFIG, ...config };
  }
}

/**
 * Encodes string to UTF-8 Base64 safe for GitHub API
 */
export function stringToBase64(str: string): string {
  try {
    // UTF-8 multibyte characters safe encoding
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

export interface PublishResult {
  success: boolean;
  commitSha?: string;
  commitUrl?: string;
  fileUrl?: string;
  filePath?: string;
  logs?: string[];
  error?: string;
}

/**
 * Format commit message from template
 */
export function formatCommitMessage(template: string, note: Note): string {
  const title = (note.title || 'Untitled Post').trim();
  const date = note.date || new Date(note.createdAt).toLocaleDateString();
  return (template || 'Publish: {title}')
    .replace(/\{title\}/g, title)
    .replace(/\{date\}/g, date)
    .replace(/\{id\}/g, note.id);
}

/**
 * Computes destination filename and relative path in repo
 */
export function getRepoFilePath(note: Note, folderPath: string): { fileName: string; fullPath: string } {
  const fileName = note.fileName || generateNoteFilename(note);
  const cleanFolder = (folderPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const fullPath = cleanFolder ? `${cleanFolder}/${fileName}` : fileName;
  return { fileName, fullPath };
}

/**
 * Publish directly to GitHub via REST API
 */
export async function publishToGitHub(
  note: Note,
  config: GitPublishConfig,
  customCommitMessage?: string
): Promise<PublishResult> {
  const token = config.githubToken?.trim();
  const repoRaw = config.githubRepo?.trim();
  const branch = config.githubBranch?.trim() || 'main';

  if (!token) {
    throw new Error('GitHub Personal Access Token is required. Please enter your token in the setup.');
  }

  if (!repoRaw || !repoRaw.includes('/')) {
    throw new Error('Please enter a valid repository in format "owner/repo" (e.g. username/my-blog).');
  }

  const [owner, repo] = repoRaw.split('/').map((s) => s.trim());
  const { fileName, fullPath } = getRepoFilePath(note, config.githubFolderPath);
  const markdownContent = serializeNoteToMarkdown(note);
  const commitMessage =
    customCommitMessage?.trim() || formatCommitMessage(config.commitMessageTemplate, note);

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Step 1: Check if file already exists to get its SHA (required by GitHub API for updates)
  let existingSha: string | undefined = undefined;
  try {
    const checkRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(fullPath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`,
      { headers }
    );

    if (checkRes.ok) {
      const checkData = await checkRes.json();
      existingSha = checkData.sha;
    } else if (checkRes.status === 401 || checkRes.status === 403) {
      const errData = await checkRes.json().catch(() => ({}));
      throw new Error(`GitHub Authentication failed: ${errData.message || 'Check your token permissions (contents: write)'}`);
    }
  } catch (err: any) {
    if (err.message?.includes('Authentication failed')) throw err;
    // If not found (404), existingSha remains undefined, which creates a new file.
  }

  // Step 2: Upload images if any are attached and configured
  const imageUploadResults: string[] = [];
  if (config.includeImages && note.images && note.images.length > 0) {
    for (const img of note.images) {
      if (!img.dataUrl || !img.dataUrl.startsWith('data:')) continue;
      try {
        const base64Data = img.dataUrl.split(',')[1];
        if (!base64Data) continue;

        const cleanRel = (img.relativePath || img.name).replace(/^\.\//, '').replace(/^\//, '');
        const imageDestPath = config.githubFolderPath
          ? `${config.githubFolderPath.replace(/\/+$/, '')}/${cleanRel}`
          : cleanRel;

        // Check if image exists
        let imgSha: string | undefined = undefined;
        const imgCheck = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(imageDestPath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`,
          { headers }
        );
        if (imgCheck.ok) {
          const imgData = await imgCheck.json();
          imgSha = imgData.sha;
        }

        const imgPutRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(imageDestPath).replace(/%2F/g, '/')}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              message: `Add image asset: ${img.name} for post "${note.title || 'untitled'}"`,
              content: base64Data,
              branch,
              ...(imgSha ? { sha: imgSha } : {}),
            }),
          }
        );

        if (imgPutRes.ok) {
          imageUploadResults.push(imageDestPath);
        }
      } catch (imgErr) {
        console.warn('Failed to upload image to GitHub:', imgErr);
      }
    }
  }

  // Step 3: Commit & Push the Markdown Post
  const putPayload: any = {
    message: commitMessage,
    content: stringToBase64(markdownContent),
    branch,
  };
  if (existingSha) {
    putPayload.sha = existingSha;
  }

  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(fullPath).replace(/%2F/g, '/')}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(putPayload),
    }
  );

  if (!putRes.ok) {
    const errorData = await putRes.json().catch(() => ({ message: putRes.statusText }));
    throw new Error(
      `GitHub API error (${putRes.status}): ${errorData.message || 'Could not commit file'}`
    );
  }

  const putData = await putRes.json();
  const commitSha = putData.commit?.sha || putData.content?.sha;
  const commitUrl = putData.commit?.html_url || `https://github.com/${owner}/${repo}/commit/${commitSha}`;
  const fileUrl = putData.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${fullPath}`;

  // Update stored last published
  saveStoredGitPublishConfig({
    lastPublishedAt: Date.now(),
    lastCommitSha: commitSha,
    lastCommitUrl: commitUrl,
    lastPublishedFileName: fileName,
  });

  return {
    success: true,
    commitSha,
    commitUrl,
    fileUrl,
    filePath: fullPath,
    logs: [
      `Connected to GitHub repository: ${owner}/${repo}`,
      existingSha ? `Updated existing post at ${fullPath}` : `Created new post at ${fullPath}`,
      imageUploadResults.length > 0 ? `Uploaded ${imageUploadResults.length} image asset(s)` : '',
      `Committed to branch "${branch}" with SHA ${commitSha?.slice(0, 7)}`,
      `Commit URL: ${commitUrl}`,
    ].filter(Boolean),
  };
}
