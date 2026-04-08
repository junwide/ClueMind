// src/hooks/useAPIKeys.ts
import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../i18n';

export type KeyStatus = 'saved' | 'missing' | 'invalid' | 'testing';

export interface ProviderConfig {
  model: string;
  models?: string[];  // Multiple models
  base_url: string | null;
}

interface UseAPIKeys {
  keys: Record<string, string>;
  configs: Record<string, ProviderConfig>;
  statuses: Record<string, KeyStatus>;
  saveKey: (provider: string, key: string) => Promise<void>;
  deleteKey: (provider: string) => Promise<void>;
  saveConfig: (provider: string, config: ProviderConfig) => Promise<void>;
  testKey: (provider: string) => Promise<{ success: boolean; message: string }>;
  refreshStatus: (provider: string) => Promise<void>;
  loading: boolean;
}

const PROVIDERS = ['openai', 'claude', 'glm', 'minimax'] as const;

const DEFAULT_CONFIGS: Record<string, ProviderConfig> = {
  openai: { model: 'gpt-4o', models: ['gpt-4o'], base_url: null },
  claude: { model: 'claude-3-5-sonnet-20241022', models: ['claude-3-5-sonnet-20241022'], base_url: null },
  glm: { model: 'glm-4-plus', models: ['glm-4-plus'], base_url: null },
  minimax: { model: 'abab6.5s-chat', models: ['abab6.5s-chat'], base_url: null },
};

export function useAPIKeys(): UseAPIKeys {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>(DEFAULT_CONFIGS);
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({});
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async (provider: string) => {
    try {
      const key = await invoke<string | null>('get_api_key', { provider });
      if (key) {
        setKeys(prev => ({ ...prev, [provider]: key }));
        setStatuses(prev => ({ ...prev, [provider]: 'saved' }));
      } else {
        setStatuses(prev => ({ ...prev, [provider]: 'missing' }));
      }

      // Load provider config
      const config = await invoke<ProviderConfig | null>('get_provider_config', { provider });
      if (config) {
        setConfigs(prev => ({ ...prev, [provider]: config }));
      }
    } catch {
      setStatuses(prev => ({ ...prev, [provider]: 'missing' }));
    }
  }, []);

  const saveKey = useCallback(async (provider: string, key: string) => {
    await invoke('save_api_key', { provider, key });
    setKeys(prev => ({ ...prev, [provider]: key }));
    setStatuses(prev => ({ ...prev, [provider]: 'saved' }));
  }, []);

  const deleteKey = useCallback(async (provider: string) => {
    await invoke('delete_api_key', { provider });
    setKeys(prev => {
      const newKeys = { ...prev };
      delete newKeys[provider];
      return newKeys;
    });
    setStatuses(prev => ({ ...prev, [provider]: 'missing' }));
  }, []);

  const saveConfig = useCallback(async (provider: string, config: ProviderConfig) => {
    await invoke('save_provider_config', { provider, config });
    setConfigs(prev => ({ ...prev, [provider]: config }));
  }, []);

  const testKey = useCallback(async (provider: string): Promise<{ success: boolean; message: string }> => {
    const key = keys[provider];
    const config = configs[provider];

    if (!key) {
      return { success: false, message: t('settings.testApiKey') };
    }

    setStatuses(prev => ({ ...prev, [provider]: 'testing' }));

    try {
      const result = await invoke<string>('test_api_key', {
        provider,
        apiKey: key,
        model: config.model,
        baseUrl: config.base_url || null,
      });
      setStatuses(prev => ({ ...prev, [provider]: 'saved' }));
      return { success: true, message: result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setStatuses(prev => ({ ...prev, [provider]: 'invalid' }));
      return { success: false, message: errorMessage };
    }
  }, [keys, configs, t]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all(PROVIDERS.map(refreshStatus));
      setLoading(false);
    };
    loadAll();
  }, [refreshStatus]);

  return {
    keys,
    configs,
    statuses,
    saveKey,
    deleteKey,
    saveConfig,
    testKey,
    refreshStatus,
    loading,
  };
}
