import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Link, X, Check, Trash2, HardDrive, Folder } from 'lucide-react';
import { Note, NoteImage } from '../../types';
import { cleanImageFilename, computeRelativeImagePath, formatFileSize, readFileAsDataUrl } from '../../lib/imageUtils';
import { getNoteBaseName } from '../../lib/noteUtils';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  onInsertImage: (image: NoteImage, markdownSnippet: string) => void;
  onDeleteExistingImage?: (imageId: string) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  note,
  onInsertImage,
  onDeleteExistingImage,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'library'>('upload');
  const [dragActive, setDragActive] = useState(false);

  // Upload Tab State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [customFilename, setCustomFilename] = useState<string>('');
  const [altText, setAltText] = useState<string>('');

  // URL Tab State
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [externalAlt, setExternalAlt] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewDataUrl('');
      setCustomFilename('');
      setAltText('');
      setExternalUrl('');
      setExternalAlt('');
    }
  }, [isOpen, note.id]);

  if (!isOpen) return null;

  const baseFolderName = getNoteBaseName(note);

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, SVG, WebP, GIF, AVIF).');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedFile(file);
      setPreviewDataUrl(dataUrl);
      const cleaned = cleanImageFilename(file.name);
      setCustomFilename(cleaned);
      const autoAlt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setAltText(autoAlt);
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // Compute final relative path based on clean filename and post folder
  const finalFilename = cleanImageFilename(customFilename || selectedFile?.name || 'image.png');
  const computedRelativePath = computeRelativeImagePath(finalFilename, note);

  const handleInsertUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewDataUrl) return;

    const newImage: NoteImage = {
      id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: finalFilename,
      dataUrl: previewDataUrl,
      relativePath: computedRelativePath,
      alt: altText.trim() || finalFilename.replace(/\.[^/.]+$/, ''),
      size: selectedFile?.size || Math.round(previewDataUrl.length * 0.75),
      mimeType: selectedFile?.type || 'image/png',
      createdAt: Date.now(),
    };

    const snippet = `![${newImage.alt}](${newImage.relativePath})`;
    onInsertImage(newImage, snippet);
    onClose();
  };

  const handleInsertUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalUrl.trim()) return;

    const url = externalUrl.trim();
    const alt = externalAlt.trim() || 'Image';
    const fakeImage: NoteImage = {
      id: `url-${Date.now().toString(36)}`,
      name: url.split('/').pop()?.split('?')[0] || 'web-image',
      dataUrl: url,
      relativePath: url,
      alt,
      createdAt: Date.now(),
    };

    const snippet = `![${alt}](${url})`;
    onInsertImage(fakeImage, snippet);
    onClose();
  };

  const handleInsertFromLibrary = (img: NoteImage) => {
    const snippet = `![${img.alt || img.name}](${img.relativePath})`;
    onInsertImage(img, snippet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Insert Image into {note.type === 'project' ? 'Project' : note.type === 'post' ? 'Blog Post' : 'Note'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Saved in <span className="font-mono text-neutral-700 dark:text-neutral-300">./{baseFolderName}/</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 px-5 pt-2 bg-neutral-50/50 dark:bg-neutral-950/50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'upload'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'url'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Web URL</span>
          </button>
          {note.images && note.images.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'library'
                  ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Post Media ({note.images.length})</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm">
          {activeTab === 'upload' && (
            <form onSubmit={handleInsertUpload} className="space-y-4">
              {/* File Dropzone */}
              {!previewDataUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center space-y-2.5 ${
                    dragActive
                      ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800/80 scale-[0.99]'
                      : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50 dark:bg-neutral-900/50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-200/80 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Click to choose an image or drag & drop here
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                      PNG, JPG, WebP, SVG, GIF, AVIF up to 25MB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                /* Selected File Preview Box */
                <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 bg-neutral-50 dark:bg-neutral-950 flex items-start gap-3">
                  <div className="w-24 h-20 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden flex items-center justify-center shrink-0 border border-neutral-300/60 dark:border-neutral-700">
                    <img
                      src={previewDataUrl}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate block">
                        {finalFilename}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewDataUrl('');
                        }}
                        className="text-xs text-red-500 hover:underline shrink-0 ml-2"
                      >
                        Change
                      </button>
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 space-x-2">
                      <span>{selectedFile ? formatFileSize(selectedFile.size) : ''}</span>
                      <span>•</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 truncate">
                        {computedRelativePath}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Options when an image is selected */}
              {previewDataUrl && (
                <div className="space-y-3 pt-1 animate-fade-in">
                  {/* Filename Input */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      File Name
                    </label>
                    <input
                      type="text"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                      placeholder="e.g. hero-banner.png"
                    />
                  </div>

                  {/* Alt Text / Caption */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      Alt Text / Image Caption (Optional)
                    </label>
                    <input
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                      placeholder="e.g. Cover image for the blog post"
                    />
                  </div>

                  {/* Destination Location Info Box */}
                  <div className="p-3 rounded-lg bg-neutral-100/60 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                      <span>Post File:</span>
                      <span className="font-mono text-neutral-900 dark:text-neutral-100 font-medium">
                        {baseFolderName}.md
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                      <span>Image Folder:</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                        ./{baseFolderName}/
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                      <span>Markdown syntax:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[260px]">
                        ![{altText || finalFilename}]({computedRelativePath})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!previewDataUrl}
                  className="px-4 py-1.5 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Insert into Post</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleInsertUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Image Web URL
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100 font-mono"
                  placeholder="https://example.com/image.png"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Alt Text / Caption
                </label>
                <input
                  type="text"
                  value={externalAlt}
                  onChange={(e) => setExternalAlt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-hidden focus:border-neutral-900 dark:focus:border-white text-neutral-900 dark:text-neutral-100"
                  placeholder="e.g. External diagram screenshot"
                />
              </div>

              {externalUrl && (
                <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center min-h-[100px] max-h-[180px] overflow-hidden">
                  <img
                    src={externalUrl}
                    alt="URL preview"
                    className="max-h-[160px] object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!externalUrl.trim()}
                  className="px-4 py-1.5 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-40"
                >
                  Insert Image URL
                </button>
              </div>
            </form>
          )}

          {activeTab === 'library' && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Images already associated with this post. Click <strong className="text-neutral-800 dark:text-neutral-200">Insert</strong> to add markdown reference at current cursor position.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {(note.images || []).map((img) => (
                  <div
                    key={img.id}
                    className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-between space-y-2 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden shrink-0 flex items-center justify-center border border-neutral-300/60 dark:border-neutral-700">
                        <img src={img.dataUrl} alt={img.alt || img.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {img.name}
                        </p>
                        <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate">
                          {img.relativePath}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {formatFileSize(img.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
                      {onDeleteExistingImage ? (
                        <button
                          type="button"
                          onClick={() => onDeleteExistingImage(img.id)}
                          className="text-[11px] text-red-500 hover:text-red-600 flex items-center space-x-1"
                          title="Remove image from post"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      ) : <span />}
                      <button
                        type="button"
                        onClick={() => handleInsertFromLibrary(img)}
                        className="px-2.5 py-1 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded hover:bg-neutral-800 dark:hover:bg-neutral-100"
                      >
                        Insert
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

