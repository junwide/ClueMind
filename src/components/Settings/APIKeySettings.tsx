// src/components/Settings/APIKeySettings.tsx
import { useState } from 'react';
import { useAPIKeys, KeyStatus } from '../../hooks/useAPIKeys';

interface Provider {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
}

const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-3.5-turbo'], defaultModel: 'gpt-4' },
  { id: 'claude', name: 'Claude (Anthropic)', models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'], defaultModel: 'claude-3-opus-20240229' },
  { id: 'glm', name: 'GLM (智谱)', models: ['glm-4', 'glm-3-turbo'], defaultModel: 'glm-4' },
  { id: 'minimax', name: 'Minimax', models: ['abab6.5-chat', 'abab5.5-chat'], defaultModel: 'abab6.5-chat' },
];

export function APIKeySettings() {
  const { statuses, saveKey, deleteKey: deleteStoredKey, loading } = useAPIKeys();
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (providerId: string) => {
    if (!inputKey.trim()) return;

    setSaving(true);
    try {
      await saveKey(providerId, inputKey);
      setEditingProvider(null);
      setInputKey('');
    } catch (err) {
      console.error('Failed to save key:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (providerId: string) => {
    if (window.confirm('确定要删除此 API Key 吗？')) {
      await deleteStoredKey(providerId);
    }
  };

  const getStatusBadge = (status: KeyStatus) => {
    switch (status) {
      case 'saved':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">已配置</span>;
      case 'missing':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">未配置</span>;
      case 'invalid':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">无效</span>;
    }
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">API Key 配置</h2>
      <p className="text-gray-600 text-sm">
        API Key 将安全存储在系统密钥链中
      </p>

      <div className="space-y-3">
        {PROVIDERS.map(provider => (
          <div
            key={provider.id}
            className="p-4 border rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{provider.name}</div>
              <div className="text-sm text-gray-500">
                默认模型: {provider.defaultModel}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(statuses[provider.id] || 'missing')}

              {editingProvider === provider.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="输入 API Key"
                    className="px-3 py-1 border rounded text-sm w-48"
                  />
                  <button
                    onClick={() => handleSave(provider.id)}
                    disabled={saving || !inputKey.trim()}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setEditingProvider(null);
                      setInputKey('');
                    }}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingProvider(provider.id)}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                  >
                    {statuses[provider.id] === 'saved' ? '更新' : '配置'}
                  </button>
                  {statuses[provider.id] === 'saved' && (
                    <button
                      onClick={() => handleDelete(provider.id)}
                      className="px-3 py-1 text-red-600 hover:text-red-700 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
