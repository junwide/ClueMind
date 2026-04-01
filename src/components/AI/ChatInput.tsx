// src/components/AI/ChatInput.tsx
import { useState } from 'react';
import { GuidedForm, GuidedInput } from './GuidedForm';
import { useTranslation } from '../../i18n';

export type UserInput =
  | { type: 'text'; content: string }
  | { type: 'guided'; data: GuidedInput };

interface ChatInputProps {
  mode: 'text' | 'guided';
  onModeChange: (mode: 'text' | 'guided') => void;
  onSubmit: (input: UserInput) => void;
  isLoading: boolean;
}

export function ChatInput({ mode, onModeChange, onSubmit, isLoading }: ChatInputProps) {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState('');
  const [guidedData, setGuidedData] = useState<GuidedInput>({
    topic: '',
    goal: '',
    constraints: [],
    structure: 'pyramid',
  });

  const handleSubmit = () => {
    if (mode === 'text') {
      if (!textContent.trim()) return;
      onSubmit({ type: 'text', content: textContent });
      setTextContent('');
    } else {
      if (!guidedData.topic.trim()) return;
      onSubmit({ type: 'guided', data: guidedData });
      setGuidedData({ topic: '', goal: '', constraints: [], structure: 'pyramid' });
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => onModeChange('text')}
          className={`px-3 py-1 text-sm rounded ${
            mode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('chat.freeInput')}
        </button>
        <button
          onClick={() => onModeChange('guided')}
          className={`px-3 py-1 text-sm rounded ${
            mode === 'guided'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('chat.guided')}
        </button>
      </div>

      {mode === 'text' ? (
        <div className="space-y-3">
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="w-full p-3 border rounded-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
      ) : (
        <GuidedForm
          data={guidedData}
          onChange={setGuidedData}
          disabled={isLoading}
        />
      )}

      <div className="flex justify-end mt-3">
        <button
          onClick={handleSubmit}
          disabled={isLoading || (mode === 'text' ? !textContent.trim() : !guidedData.topic.trim())}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? t('chat.processing') : t('chat.send')}
        </button>
      </div>
    </div>
  );
}
