// src/utils/mindscapeLayout.ts
import type { Node, XYPosition } from '@xyflow/react';
import type { FrameworkGraphNode } from '../types/mindscape';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const MIN_RADIUS = 250;
const RADIUS_PER_NODE = 80;
const MAX_RADIUS = 600;

export interface FrameworkNodeData extends FrameworkGraphNode {
  sharedDropCount: number;
  onNavigateToCanvas: (frameworkId: string) => void;
  [key: string]: unknown;
}

export type FrameworkNode = Node<FrameworkNodeData, 'frameworkGraphNode'>;

/**
 * Compute circular layout positions for framework graph nodes.
 * 1-2 nodes: centered row. 3+: circle layout.
 */
export function computeCircleLayout(
  nodes: FrameworkGraphNode[],
): Map<string, XYPosition> {
  const positions = new Map<string, XYPosition>();
  const n = nodes.length;

  if (n === 0) return positions;
  if (n === 1) {
    positions.set(nodes[0].id, { x: 400, y: 300 });
    return positions;
  }
  if (n === 2) {
    positions.set(nodes[0].id, { x: 300, y: 300 });
    positions.set(nodes[1].id, { x: 650, y: 300 });
    return positions;
  }

  // Circle layout
  const radius = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, MIN_RADIUS + (n - 3) * RADIUS_PER_NODE));
  const cx = 500;
  const cy = 400;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2; // Start from top
    positions.set(nodes[i].id, {
      x: cx + radius * Math.cos(angle) - NODE_WIDTH / 2,
      y: cy + radius * Math.sin(angle) - NODE_HEIGHT / 2,
    });
  }

  return positions;
}
