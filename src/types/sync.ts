export interface SyncConfig {
  serverUrl: string | null;
  enabled: boolean;
  autoSyncIntervalMinutes: number;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  isSyncing: boolean;
  lastError: string | null;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
}
