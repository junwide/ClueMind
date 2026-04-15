// src/components/Settings/SyncSettings.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';
import type { SyncConfig, SyncStatus } from '../../types/sync';

export function SyncSettings() {
  const { t } = useTranslation();
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [interval, setSyncInterval] = useState(30);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);

  // Load existing config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await invoke<SyncConfig>('get_sync_config');
        if (config.serverUrl) setServerUrl(config.serverUrl);
        setEnabled(config.enabled);
        setSyncInterval(config.autoSyncIntervalMinutes);

        // Check if token exists
        const existingToken = await invoke<string | null>('get_sync_token');
        if (existingToken) setToken('••••••••'); // Mask existing token
      } catch (err) {
        console.error('Failed to load sync config:', err);
      }
    };
    loadConfig();
  }, []);

  // Fetch sync status
  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<SyncStatus>('get_sync_status');
      setStatus(s);
    } catch {
      // Not configured yet
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<string>('test_server_connection', {
        serverUrl,
        token: token === '••••••••' ? '' : token,
      });
      setTestResult({ type: 'success', text: result });
    } catch (err) {
      setTestResult({ type: 'error', text: String(err) });
    } finally {
      setTesting(false);
    }
  }, [serverUrl, token]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await invoke('save_sync_config', {
        serverUrl: serverUrl || null,
        enabled,
        autoSyncIntervalMinutes: interval,
      });
      if (token && token !== '••••••••') {
        await invoke('save_sync_token', { token });
      }
      // Trigger engine hot-reload
      try { await invoke('rebuild_sync_engine'); } catch { /* non-critical */ }
      setSaveMessage({ type: 'success', text: t('sync.saveSuccess') });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: String(err) });
    } finally {
      setSaving(false);
    }
  }, [serverUrl, token, enabled, interval, t]);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await invoke<SyncStatus>('sync_now');
      setStatus(result);
    } catch (err) {
      setSaveMessage({ type: 'error', text: String(err) });
    } finally {
      setSyncing(false);
    }
  }, []);

  const lastSyncLabel = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString()
    : t('sync.neverSynced');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">{t('sync.title')}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          {t('sync.enableSync')}
        </label>
      </div>

      <p className="text-xs text-gray-500">{t('sync.description')}</p>

      {/* Server URL */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t('sync.serverUrl')}
        </label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder={t('sync.serverUrlPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Auth Token */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t('sync.authToken')}
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={t('sync.authTokenPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTestConnection}
          disabled={testing || !serverUrl || !token}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? t('sync.testing') : t('sync.testConnection')}
        </button>
        {testResult && (
          <span className={`text-xs ${testResult.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {testResult.text}
          </span>
        )}
      </div>

      {/* Sync Interval */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {t('sync.syncInterval')}
        </label>
        <select
          value={interval}
          onChange={(e) => setSyncInterval(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
        >
          <option value={5}>5 {t('sync.minutes')}</option>
          <option value={15}>15 {t('sync.minutes')}</option>
          <option value={30}>30 {t('sync.minutes')}</option>
          <option value={60}>60 {t('sync.minutes')}</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '...' : t('sync.save')}
        </button>
        <button
          onClick={handleSyncNow}
          disabled={syncing || !enabled}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          {syncing ? t('sync.syncing') : t('sync.syncNow')}
        </button>
        {saveMessage && (
          <span className={`text-xs ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {saveMessage.text}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="text-xs text-gray-500 pt-1">
        {t('sync.lastSynced')}: {lastSyncLabel}
      </div>
    </div>
  );
}
