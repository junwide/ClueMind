// src/types/mindscape.ts

export interface FrameworkGraphNode {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
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
