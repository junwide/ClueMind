import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  MindscapeViewMode,
  FrameworkGraphData,
  MaterialGraphData,
} from '../types/mindscape';
import type { DropType } from '../types/drop';

interface MindscapeStore {
  // Data
  graphData: FrameworkGraphData | null;
  materialData: MaterialGraphData | null;
  loading: boolean;
  error: string | null;

  // View state
  viewMode: MindscapeViewMode;
  selectedFrameworkId: string | null;
  materialFilter: DropType[];

  // Viewport persistence per view
  viewports: Partial<Record<MindscapeViewMode, { x: number; y: number; zoom: number }>>;

  // Actions
  fetchGraphData: () => Promise<void>;
  fetchMaterialData: () => Promise<void>;
  setViewMode: (mode: MindscapeViewMode) => void;
  selectFramework: (id: string | null) => void;
  setViewport: (mode: MindscapeViewMode, viewport: { x: number; y: number; zoom: number }) => void;
  setMaterialFilter: (filter: DropType[]) => void;
  clearError: () => void;
}

export const useMindscapeStore = create<MindscapeStore>((set) => ({
  graphData: null,
  materialData: null,
  loading: false,
  error: null,

  viewMode: 'circle',
  selectedFrameworkId: null,
  materialFilter: ['text', 'url', 'image', 'file', 'voice'],
  viewports: {},

  fetchGraphData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<FrameworkGraphData>('list_framework_graph');
      set({ graphData: data, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchMaterialData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<MaterialGraphData>('list_material_graph');
      set({ materialData: data, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setViewMode: (mode) => {
    set({ viewMode: mode, selectedFrameworkId: null });
  },

  selectFramework: (id) => {
    set({ selectedFrameworkId: id });
  },

  setViewport: (mode, viewport) => {
    set((state) => ({
      viewports: { ...state.viewports, [mode]: viewport },
    }));
  },

  setMaterialFilter: (filter) => {
    set({ materialFilter: filter });
  },

  clearError: () => set({ error: null }),
}));
