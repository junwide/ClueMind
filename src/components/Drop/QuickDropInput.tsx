// src/components/Drop/QuickDropInput.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropStore } from '../../stores/dropStore';

interface QuickDropInputProps {
  isOpen: boolean;
  onClose: () => void;
}

type InputMode = 'text' | 'url';

export function QuickDropInput({ isOpen, onClose }: QuickDropInputProps) {
  const [mode, setMode] = useState<InputMode>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const { createTextDrop, createUrlDrop } = useDropStore();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (mode === 'text') {
          inputRef.current?.focus();
        } else {
          urlRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, mode]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setTextInput('');
      setUrlInput('');
      setMode('text');
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      }
    } catch (error) {
      console.error('Failed to create drop:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, textInput, urlInput, createTextDrop, createUrlDrop, onClose, isSubmitting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Quick Drop</h2>
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
          <button
            onClick={() => setMode('text')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'text'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setMode('url')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'url'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            URL
          </button>
        </div>

        {/* Input Area */}
        <div className="p-4">
          {mode === 'text' ? (
            <textarea
              ref={inputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type or paste your text here..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          ) : (
            <input
              ref={urlRef}
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (mode === 'text' && !textInput.trim()) ||
              (mode === 'url' && !urlInput.trim())
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Drop'}
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-200">
          Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
