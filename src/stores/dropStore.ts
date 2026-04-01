import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Drop } from '../types/drop';

interface DropStore {
  drops: Drop[];
  loading: boolean;
  error: string | null;

  fetchDrops: () => Promise<void>;
  createTextDrop: (text: string) => Promise<Drop>;
  createUrlDrop: (url: string, title?: string) => Promise<Drop>;
  createImageDrop: (path: string, ocrText?: string) => Promise<Drop>;
  deleteDrop: (id: string) => Promise<void>;
  updateDrop: (drop: Drop) => Promise<Drop>;
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

  clearError: () => set({ error: null }),
}));

// Initialize drops on first import
let initialized = false;
if (!initialized) {
  initialized = true;
  useDropStore.getState().fetchDrops();
}
