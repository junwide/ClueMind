// src/hooks/useFramework.ts
import { useState, useCallback } from 'react';
import { KnowledgeFramework, FrameworkNode } from '../types/framework';

export function useFramework(initialFramework?: KnowledgeFramework) {
  const [framework, setFramework] = useState<KnowledgeFramework | null>(
    initialFramework || null
  );

  const confirmNode = useCallback((nodeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId && node.state === 'virtual'
          ? { ...node, state: 'confirmed' as FrameworkNode['state'] }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  const lockNode = useCallback((nodeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId && node.state === 'confirmed'
          ? { ...node, state: 'locked' as FrameworkNode['state'] }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  const unlockNode = useCallback((nodeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId && node.state === 'locked'
          ? { ...node, state: 'confirmed' as FrameworkNode['state'] }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.filter((node) => node.id !== nodeId);
      const updatedEdges = prev.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      return { ...prev, nodes: updatedNodes, edges: updatedEdges };
    });
  }, []);

  // Edge operations
  const confirmEdge = useCallback((edgeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedEdges = prev.edges.map((edge) =>
        edge.id === edgeId && edge.state === 'virtual'
          ? { ...edge, state: 'confirmed' as const }
          : edge
      );
      return { ...prev, edges: updatedEdges };
    });
  }, []);

  const lockEdge = useCallback((edgeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedEdges = prev.edges.map((edge) =>
        edge.id === edgeId && edge.state === 'confirmed'
          ? { ...edge, state: 'locked' as const }
          : edge
      );
      return { ...prev, edges: updatedEdges };
    });
  }, []);

  const unlockEdge = useCallback((edgeId: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedEdges = prev.edges.map((edge) =>
        edge.id === edgeId && edge.state === 'locked'
          ? { ...edge, state: 'confirmed' as const }
          : edge
      );
      return { ...prev, edges: updatedEdges };
    });
  }, []);

  const updateEdgeRelationship = useCallback((edgeId: string, relationship: string) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedEdges = prev.edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, relationship }
          : edge
      );
      return { ...prev, edges: updatedEdges };
    });
  }, []);

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, position }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<Pick<FrameworkNode, 'label' | 'content'>>) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, ...updates }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  const updateNodeMetadata = useCallback((nodeId: string, metadataUpdates: Partial<Pick<import('../types/framework').NodeMetadata, 'source' | 'reasoning' | 'aiExplanation'>>) => {
    setFramework((prev) => {
      if (!prev) return null;
      const updatedNodes = prev.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, metadata: { ...node.metadata, ...metadataUpdates } }
          : node
      );
      return { ...prev, nodes: updatedNodes };
    });
  }, []);

  return {
    framework,
    setFramework,
    confirmNode,
    lockNode,
    unlockNode,
    deleteNode,
    confirmEdge,
    lockEdge,
    unlockEdge,
    updateEdgeRelationship,
    updateNodePosition,
    updateNode,
    updateNodeMetadata,
  };
}
