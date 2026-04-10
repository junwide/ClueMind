import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Drop } from '../types/drop';

export interface SearchResult {
  id: string;
  contentType: string;
  preview: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

interface DropStore {
  drops: Drop[];
  loading: boolean;
  error: string | null;

  fetchDrops: () => Promise<void>;
  createTextDrop: (text: string) => Promise<Drop>;
  createUrlDrop: (url: string, title?: string) => Promise<Drop>;
  createImageDrop: (path: string, ocrText?: string) => Promise<Drop>;
  createFileDrop: (path: string, fileType: string) => Promise<Drop>;
  createVoiceDrop: (path: string, transcription?: string) => Promise<Drop>;
  deleteDrop: (id: string) => Promise<void>;
  updateDrop: (drop: Drop) => Promise<Drop>;
  searchDrops: (query: string, limit?: number, offset?: number) => Promise<PaginatedResult<SearchResult>>;
  fetchDropsPaginated: (status?: string, limit?: number, offset?: number) => Promise<PaginatedResult<SearchResult>>;
  clearError: () => void;
}

export const useDropStore = create<DropStore>((set) => ({
  drops: [],
  loading: false,
  error: null,

  fetchDrops: async () => {
    set({ loading: true, error: null });
    try {
      const result = await invoke<Drop[]>('list_drops');
      set({ drops: result, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch drops';
      set({ error: msg, loading: false });
    }
  },

  createTextDrop: async (text: string) => {
    try {
      const drop = await invoke<Drop>('create_text_drop', { text });
      set(prev => ({ drops: [drop, ...prev.drops] }));
      return drop;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create text drop';
      set({ error: msg });
      throw err;
    }
  },

  createUrlDrop: async (url: string, title?: string) => {
    try {
      const drop = await invoke<Drop>('create_url_drop', { url, title });
      set(prev => ({ drops: [drop, ...prev.drops] }));
      return drop;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create URL drop';
      set({ error: msg });
      throw err;
    }
  },

  createImageDrop: async (path: string, ocrText?: string) => {
    try {
      const drop = await invoke<Drop>('create_image_drop', { path, ocrText });
      set(prev => ({ drops: [drop, ...prev.drops] }));
      return drop;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create image drop';
      set({ error: msg });
      throw err;
    }
  },

  createFileDrop: async (path: string, fileType: string) => {
    try {
      const drop = await invoke<Drop>('create_file_drop', { path, fileType });
      set(prev => ({ drops: [drop, ...prev.drops] }));
      return drop;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create file drop';
      set({ error: msg });
      throw err;
    }
  },

  createVoiceDrop: async (path: string, transcription?: string) => {
    try {
      const drop = await invoke<Drop>('create_voice_drop', { path, transcription });
      set(prev => ({ drops: [drop, ...prev.drops] }));
      return drop;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create voice drop';
      set({ error: msg });
      throw err;
    }
  },

  deleteDrop: async (id: string) => {
    try {
      await invoke('delete_drop', { id });
      set(prev => ({ drops: prev.drops.filter(d => d.id !== id) }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete drop';
      set({ error: msg });
      throw err;
    }
  },

  updateDrop: async (drop: Drop) => {
    try {
      const updated = await invoke<Drop>('update_drop', { drop });
      set(prev => ({
        drops: prev.drops.map(d => d.id === updated.id ? updated : d),
      }));
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update drop';
      set({ error: msg });
      throw err;
    }
  },

  searchDrops: async (query: string, limit?: number, offset?: number) => {
    try {
      return await invoke<PaginatedResult<SearchResult>>('search_drops', {
        query,
        limit: limit ?? 50,
        offset: offset ?? 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to search drops';
      set({ error: msg });
      throw err;
    }
  },

  fetchDropsPaginated: async (status?: string, limit?: number, offset?: number) => {
    try {
      return await invoke<PaginatedResult<SearchResult>>('list_drops_paginated', {
        status: status ?? null,
        limit: limit ?? 50,
        offset: offset ?? 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch paginated drops';
      set({ error: msg });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

// Initialize drops on first import
let initialized = false;
if (!initialized) {
  initialized = true;
  useDropStore.getState().fetchDrops();
}
