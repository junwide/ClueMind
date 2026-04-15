import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SyncConfig, SyncStatus } from '../types/sync';

interface SyncStore {
  config: SyncConfig | null;
  status: SyncStatus | null;
  syncing: boolean;
  error: string | null;

  fetchConfig: () => Promise<void>;
  saveConfig: (serverUrl: string | null, enabled: boolean, interval: number) => Promise<void>;
  fetchStatus: () => Promise<void>;
  triggerSync: () => Promise<void>;
  clearError: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  config: null,
  status: null,
  syncing: false,
  error: null,

  fetchConfig: async () => {
    try {
      const config = await invoke<SyncConfig>('get_sync_config');
      set({ config });
    } catch (e) {
      console.error('Failed to fetch sync config:', e);
    }
  },

  saveConfig: async (serverUrl, enabled, interval) => {
    try {
      set({ error: null });
      await invoke('save_sync_config', {
        serverUrl,
        enabled,
        autoSyncIntervalMinutes: interval,
      });
      set({
        config: { serverUrl, enabled, autoSyncIntervalMinutes: interval },
      });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  fetchStatus: async () => {
    try {
      const status = await invoke<SyncStatus>('get_sync_status');
      set({ status });
    } catch (e) {
      console.error('Failed to fetch sync status:', e);
    }
  },

  triggerSync: async () => {
    try {
      set({ syncing: true, error: null });
      const status = await invoke<SyncStatus>('sync_now');
      set({ status, syncing: false });
    } catch (e) {
      set({ syncing: false, error: String(e) });
    }
  },

  clearError: () => set({ error: null }),
}));
