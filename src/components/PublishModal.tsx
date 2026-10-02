import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Check,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Note, GitPublishConfig } from '../types';
import {
  getStoredGitPublishConfig,
  saveStoredGitPublishConfig,
  publishToGitHub,
  formatCommitMessage,
  getRepoFilePath,
  PublishResult,
} from '../lib/gitPublisher';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  onPublishSuccess?: (result: PublishResult) => void;
}

const GitHubIcon = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={`text-black dark:text-white ${className}`}
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 0.5C5.65 0.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.17c-3.2.7-3.88-1.35-3.88-1.35-.53-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.77.11 3.06.73.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
    />
  </svg>
);

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  note,
  onPublishSuccess,
}) => {
  const [config, setConfig] = useState<GitPublishConfig>(getStoredGitPublishConfig());
  const [commitMessage, setCommitMessage] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredGitPublishConfig();
      setConfig(stored);
      setCommitMessage(formatCommitMessage(stored.commitMessageTemplate, note));
      setPublishResult(null);
      setErrorMessage(null);
    }
  }, [isOpen, note]);

  if (!isOpen) return null;

  const { fileName, fullPath } = getRepoFilePath(note, config.githubFolderPath);
  const wordCount = (note.content || '').trim().split(/\s+/).filter(Boolean).length;

  const handleUpdateConfig = (updates: Partial<GitPublishConfig>) => {
    const updated = saveStoredGitPublishConfig(updates);
    setConfig(updated);
  };

  const handlePublishGitHub = async () => {
    setIsPublishing(true);
    setErrorMessage(null);
    setPublishResult(null);

    try {
      const res = await publishToGitHub(note, config, commitMessage);
      setPublishResult(res);
      handleUpdateConfig({
        lastPublishedAt: Date.now(),
        lastCommitSha: res.commitSha,
        lastCommitUrl: res.commitUrl,
      });
      onPublishSuccess?.(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish to GitHub');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-2.5">
            <GitHubIcon className="w-6 h-6 shrink-0" />

            <div>
              <h2 className="text-sm font-semibold tracking-wide text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                Publish Blog Post
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Push directly to your blog's GitHub repository.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-black dark:hover:text-white transition-colors rounded-md"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Post Summary Card */}
        <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/30 dark:bg-neutral-900/10 flex items-center justify-between text-xs">
          <div className="min-w-0 pr-2">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
              {note.title || 'Untitled Post'}
            </span>
            <span className="text-neutral-500 font-mono text-[11px] truncate block">
              Path: {fullPath}
            </span>
          </div>
          <div className="text-right shrink-0 text-neutral-500 text-[11px]">
            <span>{wordCount} words</span>
            <span className="mx-1">•</span>
            <span>{note.date || 'Today'}</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1">
                <p className="font-semibold">Publish Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {publishResult && publishResult.success && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-sm">Post published successfully!</p>
                {publishResult.commitSha && (
                  <p className="font-mono text-[11px]">
                    Commit:{' '}
                    <span className="bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">
                      {publishResult.commitSha.slice(0, 7)}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-3 pt-0.5">
                  {publishResult.commitUrl && (
                    <a
                      href={publishResult.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 underline font-medium hover:opacity-80"
                    >
                      View commit on GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {publishResult.fileUrl && (
                    <a
                      href={publishResult.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 underline font-medium hover:opacity-80"
                    >
                      View file on GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* GitHub Repo */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
              <span>GitHub Repository</span>
              <span className="text-[10px] text-neutral-500 font-normal">owner/repo</span>
            </label>
            <input
              type="text"
              placeholder="e.g. username/my-blog"
              value={config.githubRepo}
              onChange={(e) => handleUpdateConfig({ githubRepo: e.target.value })}
              className="w-full text-xs font-mono px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Branch */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                Branch
              </label>
              <input
                type="text"
                placeholder="main"
                value={config.githubBranch}
                onChange={(e) => handleUpdateConfig({ githubBranch: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>

            {/* Path in repo */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                Directory in Repo
              </label>
              <input
                type="text"
                placeholder="content/posts"
                value={config.githubFolderPath}
                onChange={(e) => handleUpdateConfig({ githubFolderPath: e.target.value })}
                className="w-full text-xs font-mono px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
          </div>

          {/* GitHub Token */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                <span>Personal Access Token</span>
              </label>
            </div>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxx or github_pat_xxxxxxxxxxxx"
                value={config.githubToken}
                onChange={(e) => handleUpdateConfig({ githubToken: e.target.value })}
                className="w-full text-xs font-mono pr-9 pl-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Stored securely in your browser's local storage. Needs{' '}
              <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
                repo
              </code>{' '}
              or{' '}
              <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">
                contents:write
              </code>{' '}
              scope.
            </p>
          </div>

          {/* Commit Message */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
              Commit Message
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>

          {/* Images Toggle */}
          {note.images && note.images.length > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
              <div>
                <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  Upload Attached Images ({note.images.length})
                </span>
                <p className="text-[11px] text-neutral-500">
                  Push embedded image files to the repo alongside the markdown post.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleUpdateConfig({ includeImages: !config.includeImages })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                  config.includeImages ? 'bg-black dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              >
                <div
                  className={`bg-white dark:bg-black w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    config.includeImages ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handlePublishGitHub}
            disabled={isPublishing || !config.githubRepo || !config.githubToken}
            className="w-full py-2.5 px-4 bg-black text-white dark:bg-white dark:text-black font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 shadow-xs"
          >
            {isPublishing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Committing & Pushing to GitHub...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Publish Post to GitHub</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between text-xs text-neutral-500">
          <div>
            {config.lastPublishedAt ? (
              <span>
                Last published:{' '}
                {new Date(config.lastPublishedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            ) : (
              <span>Direct GitHub publishing</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};