export interface KnowledgeFramework {
  id: string;
  title: string;
  description: string;
  structureType: 'pyramid' | 'pillars' | 'custom';
  nodes: FrameworkNode[];
  edges: FrameworkEdge[];
  createdFromDrops: string[];
  lifecycle: 'draft' | 'building' | 'confirmed' | 'locked';
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkNode {
  id: string;
  label: string;
  content: string;
  level: number;
  state: 'virtual' | 'confirmed' | 'locked';
  position?: Position;
  metadata: NodeMetadata;
}

export interface FrameworkEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  state: 'virtual' | 'confirmed';
}

export interface Position {
  x: number;
  y: number;
}

export interface NodeMetadata {
  createdBy: string;
  confidence?: number;
}
