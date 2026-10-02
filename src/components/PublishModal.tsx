import React, { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
  Upload,
  Check,
  Copy,
  Terminal,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FolderGit2,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { Note, GitPublishConfig, GitPublishMode } from '../types';
import {
  getStoredGitPublishConfig,
  saveStoredGitPublishConfig,
  publishToGitHub,
  publishViaLocalServer,
  generateTerminalCommands,
  formatCommitMessage,
  getRepoFilePath,
  PublishResult,
} from '../lib/gitPublisher';
import { localFolderManager } from '../lib/localFolderManager';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  onPublishSuccess?: (result: PublishResult) => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  note,
  onPublishSuccess,
}) => {
  const [config, setConfig] = useState<GitPublishConfig>(getStoredGitPublishConfig());
  const [activeTab, setActiveTab] = useState<GitPublishMode>('github');
  const [commitMessage, setCommitMessage] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredGitPublishConfig();
      setConfig(stored);
      setActiveTab(stored.mode || 'github');
      setCommitMessage(formatCommitMessage(stored.commitMessageTemplate, note));
      setPublishResult(null);
      setErrorMessage(null);
      setCopiedCommand(false);

      // Auto-detect local repo path if empty and localFolderManager has root
      if (!stored.localRepoPath) {
        const lfConfig = localFolderManager.getConfig();
        if (lfConfig.rootName) {
          setConfig((prev) => ({ ...prev, localRepoPath: lfConfig.rootName || '' }));
        }
      }
    }
  }, [isOpen, note]);

  if (!isOpen) return null;

  const { fileName, fullPath } = getRepoFilePath(note, config.githubFolderPath);
  const { commandString, steps } = generateTerminalCommands(note, config);
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
        mode: 'github',
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

  const handlePublishLocal = async () => {
    setIsPublishing(true);
    setErrorMessage(null);
    setPublishResult(null);

    try {
      const res = await publishViaLocalServer(note, config, commitMessage);
      setPublishResult(res);
      handleUpdateConfig({
        mode: 'local',
        lastPublishedAt: Date.now(),
        lastCommitSha: res.commitSha,
      });
      onPublishSuccess?.(res);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Failed to run git publish on local server. Ensure your dev server is running and the repo path is valid.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyCommand = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(commandString);
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                Publish Blog Post
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  Git
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Push your post live to GitHub or trigger your blog's automated build.
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
              File: {fileName}
            </span>
          </div>
          <div className="text-right shrink-0 text-neutral-500 text-[11px]">
            <span>{wordCount} words</span>
            <span className="mx-1">•</span>
            <span>{note.date || 'Today'}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-950 px-5 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('github');
              handleUpdateConfig({ mode: 'github' });
            }}
            className={`pb-2.5 px-3 font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'github'
                ? 'border-black dark:border-white text-neutral-900 dark:text-neutral-100 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            GitHub (1-Click Push)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('local');
              handleUpdateConfig({ mode: 'local' });
            }}
            className={`pb-2.5 px-3 font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'local'
                ? 'border-black dark:border-white text-neutral-900 dark:text-neutral-100 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            Local Machine Git
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('copy');
              handleUpdateConfig({ mode: 'copy' });
            }}
            className={`pb-2.5 px-3 font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'copy'
                ? 'border-black dark:border-white text-neutral-900 dark:text-neutral-100 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Terminal Commands
          </button>
        </div>

        {/* Scrollable Content */}
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
                    Commit: <span className="bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">{publishResult.commitSha.slice(0, 7)}</span>
                  </p>
                )}
                {publishResult.commitUrl && (
                  <a
                    href={publishResult.commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 underline font-medium hover:opacity-80 pt-0.5"
                  >
                    View commit on GitHub <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {publishResult.fileUrl && (
                  <div>
                    <a
                      href={publishResult.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 underline font-medium hover:opacity-80"
                    >
                      View file on GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: GITHUB DIRECT PUBLISH */}
          {activeTab === 'github' && (
            <div className="space-y-3.5">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <p>
                  Publishes directly to your GitHub repository using the GitHub REST API. Your blog host (Vercel, Netlify, GitHub Pages, etc.) will automatically detect the commit and trigger a build!
                </p>
              </div>

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
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=OfflineNotes+Blog+Publisher"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-neutral-500 hover:text-black dark:hover:text-white underline inline-flex items-center gap-0.5"
                  >
                    Generate token <ExternalLink className="w-2.5 h-2.5" />
                  </a>
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
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Stored securely in your browser's local storage. Needs <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">repo</code> or <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">contents:write</code> scope.
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

              {/* Action Button */}
              <button
                type="button"
                onClick={handlePublishGitHub}
                disabled={isPublishing || !config.githubRepo || !config.githubToken}
                className="w-full py-2.5 px-4 bg-black text-white dark:bg-white dark:text-black font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
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
          )}

          {/* TAB 2: LOCAL SERVER GIT */}
          {activeTab === 'local' && (
            <div className="space-y-3.5">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <p>
                  When running this app locally on your machine (<code className="font-mono">npm run dev</code>), the backend server can run <code className="font-mono">git add</code>, <code className="font-mono">git commit</code>, and <code className="font-mono">git push</code> directly in your local blog repository folder!
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100 flex items-center justify-between">
                  <span>Local Blog Repository Path</span>
                  <span className="text-[10px] text-neutral-500 font-normal">Absolute or relative to dev server</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. /Users/myname/Sites/my-blog or ../my-blog"
                  value={config.localRepoPath}
                  onChange={(e) => handleUpdateConfig({ localRepoPath: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  Branch
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={config.localBranch}
                  onChange={(e) => handleUpdateConfig({ localBranch: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

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

              {/* Logs */}
              {publishResult?.logs && publishResult.logs.length > 0 && (
                <div className="p-3 bg-neutral-900 text-neutral-200 rounded-lg font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                  {publishResult.logs.map((log, i) => (
                    <div key={i} className="leading-tight">
                      {log}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handlePublishLocal}
                disabled={isPublishing}
                className="w-full py-2.5 px-4 bg-black text-white dark:bg-white dark:text-black font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Git Commands...</span>
                  </>
                ) : (
                  <>
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>Run Git Publish on Local Machine</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: TERMINAL COMMANDS (ZERO SETUP COPY) */}
          {activeTab === 'copy' && (
            <div className="space-y-3.5">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                <p>
                  Prefer your terminal? Click to copy the exact one-liner command ready to paste into your terminal:
                </p>
              </div>

              <div className="relative group">
                <div className="p-3.5 bg-neutral-950 text-neutral-100 font-mono text-xs rounded-lg overflow-x-auto border border-neutral-800 flex items-center justify-between">
                  <code className="text-[12px]">{commandString}</code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  {copiedCommand ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Command to Clipboard</span>
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
                <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Workflow Breakdown:
                </h4>
                <div className="space-y-1.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                  {steps.map((st, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-500 flex items-center justify-center text-[10px]">
                        {i + 1}
                      </span>
                      <span>{st}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
              <span>Ready to publish</span>
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
