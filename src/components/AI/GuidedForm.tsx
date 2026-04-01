// src/components/AI/GuidedForm.tsx
import { useState } from 'react';
import { useTranslation } from '../../i18n';

export interface GuidedInput {
  topic: string;
  goal: string;
  constraints: string[];
  structure: 'pyramid' | 'pillars' | 'custom';
}

interface GuidedFormProps {
  data: GuidedInput;
  onChange: (data: GuidedInput) => void;
  disabled: boolean;
}

export function GuidedForm({ data, onChange, disabled }: GuidedFormProps) {
  const { t } = useTranslation();
  const [newConstraint, setNewConstraint] = useState('');

  const addConstraint = () => {
    if (newConstraint.trim()) {
      onChange({ ...data, constraints: [...data.constraints, newConstraint.trim()] });
      setNewConstraint('');
    }
  };

  const removeConstraint = (index: number) => {
    onChange({
      ...data,
      constraints: data.constraints.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('guided.topic')}
        </label>
        <input
          type="text"
          value={data.topic}
          onChange={(e) => onChange({ ...data, topic: e.target.value })}
          placeholder={t('guided.topicPlaceholder')}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('guided.goal')}
        </label>
        <input
          type="text"
          value={data.goal}
          onChange={(e) => onChange({ ...data, goal: e.target.value })}
          placeholder={t('guided.goalPlaceholder')}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('guided.constraints')}
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newConstraint}
            onChange={(e) => setNewConstraint(e.target.value)}
            placeholder={t('guided.addConstraint')}
            className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={disabled}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addConstraint())}
          />
          <button
            onClick={addConstraint}
            disabled={disabled || !newConstraint.trim()}
            className="px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {t('guided.add')}
          </button>
        </div>
        {data.constraints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.constraints.map((c, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm flex items-center gap-1"
              >
                {c}
                <button
                  onClick={() => removeConstraint(i)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('guided.structureType')}
        </label>
        <select
          value={data.structure}
          onChange={(e) => onChange({ ...data, structure: e.target.value as GuidedInput['structure'] })}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        >
          <option value="pyramid">{t('guided.pyramid')}</option>
          <option value="pillars">{t('guided.pillars')}</option>
          <option value="custom">{t('guided.custom')}</option>
        </select>
      </div>
    </div>
  );
}
