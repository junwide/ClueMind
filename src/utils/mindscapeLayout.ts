// src/utils/mindscapeLayout.ts
import type { XYPosition } from '@xyflow/react';
import type { FrameworkGraphNode, SharedDropEdge, MindscapeViewMode, LayoutResult } from '../types/mindscape';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const MIN_RADIUS = 250;
const RADIUS_PER_NODE = 80;
const MAX_RADIUS = 600;

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

/**
 * Get layout for the given view mode. Returns LayoutResult with positions and optional zones.
 */
export function getLayoutForView(
  mode: MindscapeViewMode,
  nodes: FrameworkGraphNode[],
  _edges: SharedDropEdge[],
): LayoutResult {
  switch (mode) {
    case 'circle':
      return { positions: computeCircleLayout(nodes) };
    case 'timeline':
      return computeTimelineLayout(nodes);
    case 'structure':
      return computeStructureLayout(nodes);
    case 'material':
      // Material view uses separate data — this fallback returns empty
      return { positions: new Map() };
    default:
      return { positions: computeCircleLayout(nodes) };
  }
}

// --- Timeline layout (V2) ---

const LANE_HEIGHT = 200;
const MIN_X_SPAN = 400;
const X_PADDING = 100;
const LANE_LABELS = ['draft', 'building', 'confirmed', 'locked'] as const;

export function computeTimelineLayout(nodes: FrameworkGraphNode[]): LayoutResult {
  const positions = new Map<string, XYPosition>();

  if (nodes.length === 0) return { positions };

  // Parse timestamps and sort by createdAt
  const sorted = [...nodes].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const timestamps = sorted.map((n) => new Date(n.createdAt).getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);

  // Ensure minimum X span
  const tsSpan = maxTs - minTs < 1 ? MIN_X_SPAN * 1000 : maxTs - minTs;
  const xScale = MIN_X_SPAN / tsSpan;

  for (let i = 0; i < sorted.length; i++) {
    const node = sorted[i];
    const x = X_PADDING + (new Date(node.createdAt).getTime() - minTs) * xScale;
    const idx = LANE_LABELS.indexOf(node.lifecycle as typeof LANE_LABELS[number]);
    const laneIndex = idx >= 0 ? idx : 0;
    const y = 100 + laneIndex * LANE_HEIGHT;

    positions.set(node.id, { x, y });
  }

  return { positions };
}

// --- Structure layout (V3) ---

const GROUP_PADDING = 60;
const GROUP_GAP = 100;
const NODE_GAP_X = 340;
const NODE_GAP_Y = 220;

const STRUCTURE_COLORS: Record<string, string> = {
  pyramid: 'rgba(59, 130, 246, 0.12)',   // blue
  pillars: 'rgba(16, 185, 129, 0.12)',    // green
  custom: 'rgba(139, 92, 246, 0.12)',     // purple
};

const STRUCTURE_LABELS: Record<string, string> = {
  pyramid: 'Pyramid',
  pillars: 'Pillars',
  custom: 'Custom',
};

export function computeStructureLayout(nodes: FrameworkGraphNode[]): LayoutResult {
  const positions = new Map<string, XYPosition>();

  if (nodes.length === 0) return { positions, zones: [] };

  // Group by structureType
  const groups = new Map<string, FrameworkGraphNode[]>();
  for (const node of nodes) {
    const key = node.structureType || 'custom';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  const zones: LayoutResult['zones'] = [];
  let currentX = 100;

  for (const [type, groupNodes] of groups) {
    // Layout within group as a grid
    const cols = Math.max(1, Math.ceil(Math.sqrt(groupNodes.length)));
    let maxX = 0;
    let maxY = 0;

    for (let i = 0; i < groupNodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = currentX + GROUP_PADDING + col * NODE_GAP_X;
      const y = 100 + GROUP_PADDING + row * NODE_GAP_Y;
      positions.set(groupNodes[i].id, { x, y });
      maxX = Math.max(maxX, x + NODE_WIDTH);
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    }

    zones.push({
      id: `zone-${type}`,
      label: STRUCTURE_LABELS[type] || type,
      x: currentX,
      y: 100,
      width: maxX - currentX + GROUP_PADDING * 2,
      height: maxY - 100 + GROUP_PADDING * 2,
      color: STRUCTURE_COLORS[type] || STRUCTURE_COLORS.custom,
    });

    currentX = maxX + GROUP_PADDING + GROUP_GAP;
  }

  return { positions, zones };
}
