// src/utils/materialLayout.ts
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type {
  MaterialGraphNode,
  MaterialGraphEdge,
} from '../types/mindscape';
import type { DropType } from '../types/drop';

const DROP_NODE_RADIUS = 25;
const FW_NODE_RADIUS = 50;
const SIMULATION_TICKS = 300;

interface SimNode {
  id: string;
  x: number;
  y: number;
  radius: number;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
}

/**
 * Compute force-directed layout for the material graph.
 * Drops are smaller nodes, frameworks are larger.
 * Only drops matching the filter are included.
 */
export function computeMaterialLayout(
  drops: MaterialGraphNode[],
  frameworks: MaterialGraphNode[],
  edges: MaterialGraphEdge[],
  filter: DropType[],
): { positions: Map<string, { x: number; y: number }> } {
  const positions = new Map<string, { x: number; y: number }>();

  if (drops.length === 0 && frameworks.length === 0) return { positions };

  // Filter drops by content type
  const filteredDropIds = new Set(
    drops.filter((d) => filter.includes(d.contentType as DropType)).map((d) => d.id)
  );

  // Build nodes
  const simNodes: SimNode[] = [];

  for (const fw of frameworks) {
    simNodes.push({ id: fw.id, x: 0, y: 0, radius: FW_NODE_RADIUS });
  }

  for (const drop of drops) {
    if (filteredDropIds.has(drop.id)) {
      simNodes.push({ id: drop.id, x: 0, y: 0, radius: DROP_NODE_RADIUS });
    }
  }

  if (simNodes.length === 0) return { positions };

  // Randomize initial positions to help simulation converge
  for (const node of simNodes) {
    node.x = (Math.random() - 0.5) * 400;
    node.y = (Math.random() - 0.5) * 400;
  }

  // Build links — only for filtered drops
  const nodeIdSet = new Set(simNodes.map((n) => n.id));
  const simLinks: SimLink[] = edges
    .filter((e) => filteredDropIds.has(e.dropId) && nodeIdSet.has(e.frameworkId))
    .map((e) => ({ source: e.dropId, target: e.frameworkId }));

  // Run simulation synchronously
  const simulation = forceSimulation<SimNode>(simNodes)
    .force('link', forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(150))
    .force('charge', forceManyBody().strength(-300))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 20))
    .stop();

  simulation.tick(SIMULATION_TICKS);

  // Extract positions
  for (const node of simNodes) {
    if (isFinite(node.x) && isFinite(node.y)) {
      positions.set(node.id, { x: node.x, y: node.y });
    }
  }

  return { positions };
}
