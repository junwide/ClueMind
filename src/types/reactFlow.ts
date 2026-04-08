// src/types/reactFlow.ts
// Typed data interfaces for React Flow nodes and edges.
// These are ONLY the `data` portion of nodes/edges (not the full Node/Edge object).
// Usage: NodeProps<Node<CanvasNodeData>>

import type { Node, Edge } from '@xyflow/react';

// --- Canvas node data (CustomNode) ---

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  content: string;
  level: number;
  state: 'virtual' | 'confirmed' | 'locked';
  metadata?: {
    createdBy?: string;
    confidence?: number;
    aiExplanation?: string;
    source?: string;
    reasoning?: string;
  };
}

// --- Canvas edge data (CustomEdge) ---

export interface CanvasEdgeData extends Record<string, unknown> {
  state: 'virtual' | 'confirmed' | 'locked';
  relationship: string;
}

// --- Mindscape node data (FrameworkNode) ---

export interface MindscapeNodeData extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  lifecycle: 'draft' | 'building' | 'confirmed' | 'locked';
  nodeCount: number;
  dropCount: number;
  edgeCount: number;
  sharedDropCount: number;
  onClick?: (id: string) => void;
}

// --- Mindscape edge data (SharedDropEdge) ---

export interface MindscapeEdgeData extends Record<string, unknown> {
  sharedDropCount: number;
}

// Convenience full types for NodeProps<EdgeProps generics
export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdgeType = Edge<CanvasEdgeData>;
export type MindscapeNode = Node<MindscapeNodeData>;
export type MindscapeEdgeType = Edge<MindscapeEdgeData>;

// --- AI response types (replacing `as any` casts) ---

export interface AIFrameworkResponse {
  id: string;
  title: string;
  description?: string;
  structure_type: string;
  nodes: Array<{
    id: string;
    label: string;
    content: string;
    level: number;
    state: string;
    source?: string;
    reasoning?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship: string;
    state?: string;
  }>;
}

export interface GenerateResponse {
  frameworks: AIFrameworkResponse[];
  recommended_drops: string[];
  raw_text?: string;
}

// --- Backend metadata for conversation persistence ---

export interface BackendMessageMetadata {
  pendingFrameworkData?: string;
  [key: string]: unknown;
}
