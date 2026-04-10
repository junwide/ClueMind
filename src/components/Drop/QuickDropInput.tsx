// src/components/Drop/QuickDropInput.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropStore } from '../../stores/dropStore';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../i18n';

interface QuickDropInputProps {
  isOpen: boolean;
  onClose: () => void;
}

type InputMode = 'text' | 'url' | 'image' | 'file' | 'voice';

const MODE_ICONS: Record<InputMode, string> = {
  text: '\u{1F4DD}',
  url: '\u{1F517}',
  image: '\u{1F5BC}',
  file: '\u{1F4C1}',
  voice: '\u{1F3A4}',
};

export function QuickDropInput({ isOpen, onClose }: QuickDropInputProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InputMode>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const { createTextDrop, createUrlDrop, createImageDrop, createFileDrop, createVoiceDrop } = useDropStore();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (mode === 'text') inputRef.current?.focus();
        else if (mode === 'url') urlRef.current?.focus();
      }, 100);
    }
  }, [isOpen, mode]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setTextInput('');
      setUrlInput('');
      setSelectedFile(null);
      setMode('text');
      setIsDragOver(false);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleFileSelect = useCallback(async (filterMode: 'image' | 'file' | 'voice') => {
    const filters = filterMode === 'image'
      ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
      : filterMode === 'voice'
        ? [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'webm'] }]
        : [{ name: 'All Files', extensions: ['*'] }];

    const result = await open({
      multiple: false,
      filters,
    });
    if (result) {
      setSelectedFile(result);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (mode === 'text' && textInput.trim()) {
        await createTextDrop(textInput.trim());
        onClose();
      } else if (mode === 'url' && urlInput.trim()) {
        await createUrlDrop(urlInput.trim());
        onClose();
      } else if (mode === 'image' && selectedFile) {
        await createImageDrop(selectedFile);
        onClose();
      } else if (mode === 'file' && selectedFile) {
        const ext = selectedFile.split('.').pop() || 'unknown';
        await createFileDrop(selectedFile, ext);
        onClose();
      } else if (mode === 'voice' && selectedFile) {
        await createVoiceDrop(selectedFile);
        onClose();
      }
    } catch (error) {
      console.error('Failed to create drop:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, textInput, urlInput, selectedFile, createTextDrop, createUrlDrop, createImageDrop, createFileDrop, createVoiceDrop, onClose, isSubmitting]);

  // Drag & drop handler
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    // Tauri provides path on File objects in drag events
    const path = (file as unknown as { path?: string }).path || file.name;

    setIsSubmitting(true);
    try {
      if (file.type.startsWith('image/')) {
        await createImageDrop(path);
      } else if (file.type.startsWith('audio/')) {
        await createVoiceDrop(path);
      } else {
        const ext = path.split('.').pop() || 'unknown';
        await createFileDrop(path, ext);
      }
      onClose();
    } catch (error) {
      console.error('Failed to create drop from drop:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [createImageDrop, createFileDrop, createVoiceDrop, onClose]);

  const canSubmit = !isSubmitting && (
    (mode === 'text' && textInput.trim()) ||
    (mode === 'url' && urlInput.trim()) ||
    ((mode === 'image' || mode === 'file' || mode === 'voice') && selectedFile)
  );

  if (!isOpen) return null;

  const modes: InputMode[] = ['text', 'url', 'image', 'file', 'voice'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{t('quickDrop.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-gray-200">
          {modes.map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelectedFile(null); }}
              className={`flex-1 px-2 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={t(`quickDrop.${m}`)}
            >
              <span className="mr-1">{MODE_ICONS[m]}</span>
              <span className="hidden sm:inline">{t(`quickDrop.${m}`)}</span>
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div
          className="p-4 min-h-[120px]"
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {isDragOver ? (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50">
              <p className="text-blue-600 font-medium">{t('quickDrop.dropHere')}</p>
            </div>
          ) : mode === 'text' ? (
            <textarea
              ref={inputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t('quickDrop.textPlaceholder')}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          ) : mode === 'url' ? (
            <input
              ref={urlRef}
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t('quickDrop.urlPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              {selectedFile ? (
                <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 truncate">{selectedFile.split('/').pop() || selectedFile.split('\\').pop()}</p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-xs text-green-500 hover:text-green-700 mt-1"
                  >
                    {t('quickDrop.changeFile')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleFileSelect(mode)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                  disabled={isSubmitting}
                >
                  {mode === 'image' ? t('quickDrop.selectImage') :
                   mode === 'voice' ? t('quickDrop.selectAudio') :
                   t('quickDrop.selectFile')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            {t('quickDrop.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t('quickDrop.saving') : t('quickDrop.drop')}
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-200">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> {t('quickDrop.escToClose')}
        </div>
      </div>
    </div>
  );
}
