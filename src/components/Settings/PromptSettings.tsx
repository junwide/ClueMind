// src/components/Settings/PromptSettings.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';

interface PromptConfig {
  framework_prompt: string;
  refine_prompt: string;
}

const DEFAULT_FRAMEWORK_PROMPT = `You are a knowledge organization expert.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, just the raw JSON object.

Generate exactly 3 knowledge framework options based on the user's input.

JSON schema to return:
{
  "frameworks": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "structure_type": "pyramid" | "pillars" | "custom",
      "nodes": [{"id": "string", "label": "string", "content": "string", "level": 0, "state": "virtual"}],
      "edges": [{"id": "string", "source": "string", "target": "string", "relationship": "string"}]
    }
  ],
  "recommended_drops": []
}

Rules:
- Return ONLY the JSON object, nothing else
- Do not use \`\`\`json\`\`\` code blocks
- Do not add any text before or after the JSON
- All node states must be "virtual"`;

const DEFAULT_REFINE_PROMPT = `You are a knowledge organization expert.

IMPORTANT: You MUST respond with ONLY valid JSON. No explanations, no markdown, no code blocks, just the raw JSON object.

Modify the given framework based on the user's instruction.

Return the updated framework as JSON with the same structure:
{"frameworks": [{...}], "recommended_drops": []}

The frameworks array should contain exactly one framework.

Rules:
- Return ONLY the JSON object, nothing else
- Do not use \`\`\`json\`\`\` code blocks
- Do not add any text before or after the JSON`;

export function PromptSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<PromptConfig>({
    framework_prompt: DEFAULT_FRAMEWORK_PROMPT,
    refine_prompt: DEFAULT_REFINE_PROMPT,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load prompt config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await invoke<PromptConfig>('get_prompt_config');
        setConfig(result);
      } catch (err) {
        console.error('Failed to load prompt config:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await invoke('save_prompt_config', { config });
      setMessage({ type: 'success', text: t('prompt.configSaved') });
      setEditingField(null);
    } catch (err) {
      console.error('Failed to save prompt config:', err);
      setMessage({ type: 'error', text: t('prompt.saveFailed', { error: String(err) }) });
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleReset = useCallback((field: 'framework_prompt' | 'refine_prompt') => {
    const defaults = {
      framework_prompt: DEFAULT_FRAMEWORK_PROMPT,
      refine_prompt: DEFAULT_REFINE_PROMPT,
    };
    setConfig(prev => ({
      ...prev,
      [field]: defaults[field],
    }));
  }, []);

  if (loading) {
    return <div className="p-4">{t('prompt.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('prompt.configTitle')}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {t('prompt.configDescription')}
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Framework Prompt */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="font-medium text-sm">{t('prompt.frameworkPrompt')}</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleReset('framework_prompt')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {t('prompt.resetDefault')}
            </button>
            <button
              onClick={() => setEditingField(editingField === 'framework' ? null : 'framework')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {editingField === 'framework' ? t('prompt.collapse') : t('prompt.edit')}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          {t('prompt.frameworkPromptDescription')}
        </p>
        {editingField === 'framework' ? (
          <textarea
            value={config.framework_prompt}
            onChange={(e) => setConfig(prev => ({ ...prev, framework_prompt: e.target.value }))}
            className="w-full h-64 p-3 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('prompt.frameworkPlaceholder')}
          />
        ) : (
          <div className="text-xs text-gray-600 bg-white p-3 rounded border max-h-32 overflow-auto">
            {config.framework_prompt.slice(0, 300)}...
          </div>
        )}
      </div>

      {/* Refine Prompt */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="font-medium text-sm">{t('prompt.refinePrompt')}</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleReset('refine_prompt')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {t('prompt.resetDefault')}
            </button>
            <button
              onClick={() => setEditingField(editingField === 'refine' ? null : 'refine')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {editingField === 'refine' ? t('prompt.collapse') : t('prompt.edit')}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          {t('prompt.refinePromptDescription')}
        </p>
        {editingField === 'refine' ? (
          <textarea
            value={config.refine_prompt}
            onChange={(e) => setConfig(prev => ({ ...prev, refine_prompt: e.target.value }))}
            className="w-full h-48 p-3 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('prompt.refinePlaceholder')}
          />
        ) : (
          <div className="text-xs text-gray-600 bg-white p-3 rounded border max-h-32 overflow-auto">
            {config.refine_prompt.slice(0, 300)}...
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('prompt.loading') : t('prompt.saveConfig')}
        </button>
      </div>

      {/* Tips */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>{t('prompt.tips')}</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>{t('prompt.tip1')}</li>
          <li>{t('prompt.tip2')}</li>
          <li>{t('prompt.tip3')}</li>
        </ul>
      </div>
    </div>
  );
}
