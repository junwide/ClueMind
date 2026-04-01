// src/stores/frameworkStore.ts
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { KnowledgeFramework, FrameworkNode } from '../types/framework';

interface FrameworkStore {
  framework: KnowledgeFramework | null;
  /** Whether the framework was restored from a previous session */
  restoredFromSession: boolean;

  setFramework: (fw: KnowledgeFramework | null) => void;
  clearFramework: () => void;
  markRestored: () => void;

  // Node operations
  confirmNode: (nodeId: string) => void;
  lockNode: (nodeId: string) => void;
  unlockNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, updates: Partial<Pick<FrameworkNode, 'label' | 'content'>>) => void;
  updateNodeMetadata: (nodeId: string, metadataUpdates: Partial<Pick<import('../types/framework').NodeMetadata, 'source' | 'reasoning' | 'aiExplanation'>>) => void;

  // Edge operations
  confirmEdge: (edgeId: string) => void;
  lockEdge: (edgeId: string) => void;
  unlockEdge: (edgeId: string) => void;
  updateEdgeRelationship: (edgeId: string, relationship: string) => void;

  // Persistence
  autoSave: () => Promise<void>;
}

export const useFrameworkStore = create<FrameworkStore>((set, get) => ({
  framework: null,
  restoredFromSession: false,

  setFramework: (fw) => set({ framework: fw, restoredFromSession: false }),
  clearFramework: () => set({ framework: null, restoredFromSession: false }),
  markRestored: () => set({ restoredFromSession: true }),

  // Node operations
  confirmNode: (nodeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.map((n) =>
            n.id === nodeId && n.state === 'virtual'
              ? { ...n, state: 'confirmed' as const }
              : n
          ),
        },
      };
    });
  },
  lockNode: (nodeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.map((n) =>
            n.id === nodeId && n.state === 'confirmed'
              ? { ...n, state: 'locked' as const }
              : n
          ),
        },
      };
    });
  },
  unlockNode: (nodeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.map((n) =>
            n.id === nodeId && n.state === 'locked'
              ? { ...n, state: 'confirmed' as const }
              : n
          ),
        },
      };
    });
  },
  deleteNode: (nodeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.filter((n) => n.id !== nodeId),
          edges: s.framework.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          ),
        },
      };
    });
  },
  updateNodePosition: (nodeId, position) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.map((n) =>
            n.id === nodeId ? { ...n, position } : n
          ),
        },
      };
    });
  },
  updateNode: (nodeId, updates) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.map((n) =>
            n.id === nodeId ? { ...n, ...updates } : n
          ),
        },
      };
    });
  },
  updateNodeMetadata: (nodeId, metadataUpdates) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          nodes: s.framework.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, metadata: { ...n.metadata, ...metadataUpdates } }
              : n
          ),
        },
      };
    });
  },

  // Edge operations
  confirmEdge: (edgeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          edges: s.framework.edges.map((e) =>
            e.id === edgeId && e.state === 'virtual'
              ? { ...e, state: 'confirmed' as const }
              : e
          ),
        },
      };
    });
  },
  lockEdge: (edgeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          edges: s.framework.edges.map((e) =>
            e.id === edgeId && e.state === 'confirmed'
              ? { ...e, state: 'locked' as const }
              : e
          ),
        },
      };
    });
  },
  unlockEdge: (edgeId) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          edges: s.framework.edges.map((e) =>
            e.id === edgeId && e.state === 'locked'
              ? { ...e, state: 'confirmed' as const }
              : e
          ),
        },
      };
    });
  },
  updateEdgeRelationship: (edgeId, relationship) => {
    set((s) => {
      if (!s.framework) return s;
      return {
        framework: {
          ...s.framework,
          edges: s.framework.edges.map((e) =>
            e.id === edgeId ? { ...e, relationship } : e
          ),
        },
      };
    });
  },

  // Persistence
  autoSave: async () => {
    const { framework } = get();
    if (!framework) return;
    try {
      await invoke('save_framework', { framework });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  },
}));
