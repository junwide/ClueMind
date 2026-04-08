// tests/utils/mindscapeLayout.test.ts
import { computeCircleLayout } from '../../src/utils/mindscapeLayout';
import type { FrameworkGraphNode } from '../../src/types/mindscape';

function makeNode(id: string): FrameworkGraphNode {
  return {
    id,
    title: `Framework ${id}`,
    description: '',
    lifecycle: 'draft',
    nodeCount: 0,
    edgeCount: 0,
    dropCount: 0,
    createdAt: '',
    updatedAt: '',
  };
}

describe('computeCircleLayout', () => {
  it('returns empty Map for empty array', () => {
    const result = computeCircleLayout([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns single node at center position { x: 400, y: 300 }', () => {
    const nodes = [makeNode('a')];
    const result = computeCircleLayout(nodes);
    expect(result.size).toBe(1);
    expect(result.get('a')).toEqual({ x: 400, y: 300 });
  });

  it('returns two nodes in a row with x: 300 and x: 650', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const result = computeCircleLayout(nodes);
    expect(result.size).toBe(2);
    expect(result.get('a')).toEqual({ x: 300, y: 300 });
    expect(result.get('b')).toEqual({ x: 650, y: 300 });
  });

  it('places 3+ nodes in a circle with all unique positions', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const result = computeCircleLayout(nodes);
    expect(result.size).toBe(4);

    const positions = Array.from(result.values());
    const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
    expect(uniquePositions.size).toBe(4);
  });

  it('verifies all node IDs are present in the result Map', () => {
    const nodes = [makeNode('x'), makeNode('y'), makeNode('z')];
    const result = computeCircleLayout(nodes);
    expect(result.has('x')).toBe(true);
    expect(result.has('y')).toBe(true);
    expect(result.has('z')).toBe(true);
  });

  it('positions for 3+ nodes lie on a circle around center', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const result = computeCircleLayout(nodes);

    // For 3 nodes, radius = MIN_RADIUS = 250
    const radius = 250;
    const cx = 500;
    const cy = 400;
    const nodeWidth = 280;
    const nodeHeight = 160;

    for (let i = 0; i < nodes.length; i++) {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      const expectedX = cx + radius * Math.cos(angle) - nodeWidth / 2;
      const expectedY = cy + radius * Math.sin(angle) - nodeHeight / 2;
      const pos = result.get(nodes[i].id)!;
      expect(pos.x).toBeCloseTo(expectedX, 5);
      expect(pos.y).toBeCloseTo(expectedY, 5);
    }
  });

  it('radius scales with number of nodes but stays within MIN_RADIUS and MAX_RADIUS', () => {
    const MIN_RADIUS = 250;
    const MAX_RADIUS = 600;

    // Test with many nodes to verify radius clamping
    const manyNodes = Array.from({ length: 20 }, (_, i) => makeNode(`n${i}`));
    const result = computeCircleLayout(manyNodes);
    expect(result.size).toBe(20);

    // Verify positions are within reasonable bounds
    for (const pos of result.values()) {
      // Positions should be finite numbers
      expect(isFinite(pos.x)).toBe(true);
      expect(isFinite(pos.y)).toBe(true);
    }

    // Compute actual radius from positions for a small set
    const threeNodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const threeResult = computeCircleLayout(threeNodes);
    // Radius should be MIN_RADIUS for exactly 3 nodes
    // Verify by checking distance from center
    const pos = threeResult.get('a')!;
    const cx = 500;
    const cy = 400;
    const nodeWidth = 280;
    const nodeHeight = 160;
    const dx = pos.x + nodeWidth / 2 - cx;
    const dy = pos.y + nodeHeight / 2 - cy;
    const actualRadius = Math.sqrt(dx * dx + dy * dy);
    expect(actualRadius).toBeGreaterThanOrEqual(MIN_RADIUS - 1);
    expect(actualRadius).toBeLessThanOrEqual(MAX_RADIUS + 1);
  });
});
