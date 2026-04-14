// src/types/mindscape.ts

import type { DropType } from './drop';

// --- View mode ---

export type MindscapeViewMode = 'circle' | 'timeline' | 'structure' | 'material';

// --- Framework graph (existing, enhanced) ---

export interface FrameworkGraphNode {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  structureType: string;
  nodeCount: number;
  edgeCount: number;
  dropCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SharedDropEdge {
  sourceId: string;
  targetId: string;
  sharedDropCount: number;
  sharedDropIds: string[];
}

export interface FrameworkGraphData {
  nodes: FrameworkGraphNode[];
  edges: SharedDropEdge[];
}

// --- Material graph (V4) ---

export interface MaterialGraphNode {
  id: string;
  label: string;
  contentType: DropType | 'framework';
}

export interface MaterialGraphEdge {
  dropId: string;
  frameworkId: string;
}

export interface MaterialGraphData {
  drops: MaterialGraphNode[];
  frameworks: MaterialGraphNode[];
  edges: MaterialGraphEdge[];
}

// --- Layout types ---

export interface LayoutZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  zones?: LayoutZone[];
}
