// src/components/AI/LoadingIndicator.tsx
import { useTranslation } from '../../i18n';

interface LoadingIndicatorProps {
  message?: string;
  progress?: number;
}

export function LoadingIndicator({
  message,
  progress,
}: LoadingIndicatorProps) {
  const { t } = useTranslation();
  const displayMessage = message || t('dialog.startingAI');
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="text-4xl mb-4">🤖</div>
      <h3 className="text-lg font-medium mb-2">{displayMessage}</h3>

      {progress !== undefined && (
        <div className="w-64 bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <p className="text-sm text-gray-600">{t('dialog.firstStartHint')}</p>
    </div>
  );
}
