// src/components/Settings/PromptSettings.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';

interface PromptConfig {
  framework_prompt: string;
  refine_prompt: string;
}

const DEFAULT_FRAMEWORK_PROMPT = `你是一位知识架构伙伴。你的任务是基于用户提供的素材，帮助构建有价值的知识框架。

请按以下两步完成：

第一步：思考分析（用自然语言）
- 分析素材中的核心主题、关键观点和重要信息
- 发现素材之间的关联、矛盾或互补关系
- 用伙伴语气说明你准备如何组织这个框架以及为什么选择这种结构
- 用中文思考和分析

第二步：输出框架（纯 JSON）
在思考分析之后，直接输出 JSON 格式的框架数据。

JSON schema:
{
  "frameworks": [{
    "id": "string",
    "title": "string",
    "description": "string",
    "structure_type": "pyramid" | "pillars" | "custom",
    "nodes": [{"id": "string", "label": "string", "content": "string", "level": 0, "state": "virtual", "source": "string", "reasoning": "string"}],
    "edges": [{"id": "string", "source": "string", "target": "string", "relationship": "string"}]
  }],
  "recommended_drops": []
}

规则：
- 先输出思考分析，再输出 JSON，两者之间空一行
- JSON 部分不要用 \`\`\`json\`\`\` 代码块包裹
- 所有节点 state 必须是 "virtual"
- 每个 node 必须有 source 和 reasoning 字段：
  - source: 写明信息的具体来源（URL/文章标题/引用），不要只写 [1][2]
  - reasoning: 用 1-2 句话解释这个节点为什么重要，与其他节点如何关联
- 框架标题要精炼有洞察力，不要用"XX框架"、"XX总结"之类的泛称
- 节点层级要有逻辑：level 0 是核心主题，level 1 是支撑维度，level 2+ 是具体论据`;

const DEFAULT_REFINE_PROMPT = `你是一位知识架构伙伴，正在和用户一起优化知识框架。你们像朋友一样讨论，不是审问。

回复模式有两种，根据情况选择：

1. 讨论型（大多数情况）：
   - 用户在分享想法、讨论思路、回答你的观察时
   - 只用自然语言回复，不输出 JSON
   - 给出你的分析和见解
   - 提出具体的、有洞察力的观察（不是提问）
   - 示例："我注意到素材 X 和 Y 之间存在一个有趣的张力..." 而非 "你觉得 X 和 Y 有什么关系？"
   - 如果用户的内容不需要框架变更，就不要输出 JSON

2. 执行型（用户明确要求修改，或你发现框架有明显需要改进的地方）：
   - 先用自然语言说明你的思考和理由
   - 再输出更新后的 JSON 框架
   - 只在确实需要修改框架时才输出 JSON

讨论风格：
- 用伙伴语气，像朋友聊天，不要用"请问"、"您"等敬语
- 给出具体的观察而非泛泛的问题
- 重点关注：素材间的矛盾/互补、框架中的薄弱环节、遗漏的重要维度
- 每次回复控制在 3-5 个要点，不要过于冗长

JSON schema（仅在执行型回复中使用）:
{"frameworks": [{"id", "title", "description", "structure_type", "nodes": [{"id", "label", "content", "level", "state", "source", "reasoning"}], "edges": [{"id", "source", "target", "relationship", "state"}]}], "recommended_drops": []}

规则：
- 自然语言和 JSON 之间空一行
- JSON 不要用代码块包裹
- 保留已有节点的 source 和 reasoning，除非用户明确要求修改
- 关键状态保护规则：
  - state="locked" 的节点必须原样保留，不能修改或删除
  - state="confirmed" 的节点应保留，除非用户明确要求改动
  - 新增节点 state 必须是 "virtual"
  - 保留输入中边的 state 字段
- 新增节点时，与已有的 confirmed/locked 节点建立合理关联`;

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
