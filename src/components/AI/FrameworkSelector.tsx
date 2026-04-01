// src/components/AI/FrameworkSelector.tsx
import { FrameworkProposal } from '../../types/ai';
import { useTranslation } from '../../i18n';

interface FrameworkSelectorProps {
  proposals: FrameworkProposal[];
  onSelect: (frameworkId: string) => void;
  onPreview: (frameworkId: string) => void;
}

export function FrameworkSelector({
  proposals,
  onSelect,
  onPreview,
}: FrameworkSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
      {proposals.map((proposal) => (
        <div
          key={proposal.id}
          className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
        >
          <h4 className="font-medium mb-2">{proposal.title}</h4>
          <p className="text-sm text-gray-600 mb-4">
            {t('dialog.nodesCount', { count: String(proposal.nodes.length) })}
          </p>

          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => onPreview(proposal.id)}
            >
              {t('dialog.preview')}
            </button>
            <button
              className="flex-1 px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
              onClick={() => onSelect(proposal.id)}
            >
              {t('dialog.select')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
