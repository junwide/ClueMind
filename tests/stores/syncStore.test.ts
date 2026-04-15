// tests/stores/syncStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri before importing the store
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { useSyncStore } from '../../src/stores/syncStore';

describe('syncStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useSyncStore.setState({
      config: null,
      status: null,
      syncing: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useSyncStore.getState();
    expect(state.config).toBeNull();
    expect(state.status).toBeNull();
    expect(state.syncing).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchConfig updates state with server config', async () => {
    const mockConfig = {
      serverUrl: 'http://localhost:3817',
      enabled: true,
      autoSyncIntervalMinutes: 15,
    };
    mockInvoke.mockResolvedValue(mockConfig);

    await useSyncStore.getState().fetchConfig();

    expect(mockInvoke).toHaveBeenCalledWith('get_sync_config');
    expect(useSyncStore.getState().config).toEqual(mockConfig);
  });

  it('fetchConfig handles errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    await useSyncStore.getState().fetchConfig();

    // Should not throw, state remains unchanged
    expect(useSyncStore.getState().config).toBeNull();
  });

  it('saveConfig calls invoke and updates state', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await useSyncStore.getState().saveConfig('http://localhost:3817', true, 15);

    expect(mockInvoke).toHaveBeenCalledWith('save_sync_config', {
      serverUrl: 'http://localhost:3817',
      enabled: true,
      autoSyncIntervalMinutes: 15,
    });
    expect(useSyncStore.getState().config).toEqual({
      serverUrl: 'http://localhost:3817',
      enabled: true,
      autoSyncIntervalMinutes: 15,
    });
  });

  it('saveConfig sets error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Save failed'));

    await useSyncStore.getState().saveConfig('http://localhost:3817', true, 15);

    expect(useSyncStore.getState().error).toBe('Error: Save failed');
  });

  it('fetchStatus updates state', async () => {
    const mockStatus = {
      lastSyncAt: '2026-01-01T00:00:00Z',
      isSyncing: false,
      lastError: null,
      pushedCount: 5,
      pulledCount: 3,
      conflictCount: 0,
    };
    mockInvoke.mockResolvedValue(mockStatus);

    await useSyncStore.getState().fetchStatus();

    expect(mockInvoke).toHaveBeenCalledWith('get_sync_status');
    expect(useSyncStore.getState().status).toEqual(mockStatus);
  });

  it('triggerSync sets syncing and calls sync_now', async () => {
    const mockStatus = {
      lastSyncAt: '2026-04-14T00:00:00Z',
      isSyncing: false,
      lastError: null,
      pushedCount: 1,
      pulledCount: 2,
      conflictCount: 0,
    };
    mockInvoke.mockResolvedValue(mockStatus);

    await useSyncStore.getState().triggerSync();

    expect(mockInvoke).toHaveBeenCalledWith('sync_now');
    expect(useSyncStore.getState().syncing).toBe(false);
    expect(useSyncStore.getState().status).toEqual(mockStatus);
  });

  it('triggerSync sets error on failure', async () => {
    mockInvoke.mockRejectedValue(new Error('Sync failed'));

    await useSyncStore.getState().triggerSync();

    expect(useSyncStore.getState().syncing).toBe(false);
    expect(useSyncStore.getState().error).toBe('Error: Sync failed');
  });

  it('clearError resets error to null', () => {
    useSyncStore.setState({ error: 'some error' });
    useSyncStore.getState().clearError();
    expect(useSyncStore.getState().error).toBeNull();
  });
});
