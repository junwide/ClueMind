// src/components/AI/DropSelector.tsx
import { useState } from 'react';
import { useTranslation } from '../../i18n';

interface Drop {
  id: string;
  content: string;
  created_at: string;
}

interface DropSelectorProps {
  drops: Drop[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  recommendations?: string[];
}

export function DropSelector({
  drops,
  selectedIds,
  onSelectionChange,
  recommendations = [],
}: DropSelectorProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDrops = drops.filter(drop =>
    drop.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleDrop = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredDrops.map(d => d.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{t('dialog.linkDrops')}</h3>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {t('dialog.selectAll')}
          </button>
          <button
            onClick={clearAll}
            className="text-sm text-gray-600 hover:text-gray-700"
          >
            {t('dialog.clearAll')}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('dialog.searchDrops')}
        className="w-full px-3 py-2 border rounded text-sm mb-3"
      />

      <div className="max-h-60 overflow-y-auto space-y-2">
        {filteredDrops.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            {t('dialog.noMatchingDrops')}
          </div>
        ) : (
          filteredDrops.map(drop => {
            const isSelected = selectedIds.includes(drop.id);
            const isRecommended = recommendations.includes(drop.id);

            return (
              <div
                key={drop.id}
                onClick={() => toggleDrop(drop.id)}
                className={`p-2 rounded cursor-pointer border flex items-start gap-2 ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300'
                    : isRecommended
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleDrop(drop.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 line-clamp-2">
                    {drop.content.slice(0, 100)}
                    {drop.content.length > 100 && '...'}
                  </div>
                  {isRecommended && (
                    <span className="text-xs text-yellow-600">{t('dialog.aiRecommended')}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-3 pt-3 border-t text-sm text-gray-600">
          {t('dialog.dropsSelectedCount', { count: String(selectedIds.length) })}
        </div>
      )}
    </div>
  );
}
