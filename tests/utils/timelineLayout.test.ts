// tests/utils/timelineLayout.test.ts
import { computeTimelineLayout, computeStructureLayout } from '../../src/utils/mindscapeLayout';
import type { FrameworkGraphNode } from '../../src/types/mindscape';

function makeNode(id: string, overrides: Partial<FrameworkGraphNode> = {}): FrameworkGraphNode {
  return {
    id,
    title: `Framework ${id}`,
    description: '',
    lifecycle: 'draft',
    structureType: 'custom',
    nodeCount: 0,
    edgeCount: 0,
    dropCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- Timeline Layout ---

describe('computeTimelineLayout', () => {
  it('returns empty Map for empty array', () => {
    const result = computeTimelineLayout([]);
    expect(result.positions.size).toBe(0);
  });

  it('places a single node at a finite position', () => {
    const result = computeTimelineLayout([makeNode('a')]);
    expect(result.positions.size).toBe(1);
    const pos = result.positions.get('a')!;
    expect(isFinite(pos.x)).toBe(true);
    expect(isFinite(pos.y)).toBe(true);
  });

  it('assigns different Y positions for different lifecycles', () => {
    const nodes = [
      makeNode('a', { lifecycle: 'draft', createdAt: '2024-01-01T00:00:00Z' }),
      makeNode('b', { lifecycle: 'confirmed', createdAt: '2024-01-01T00:00:00Z' }),
    ];
    const result = computeTimelineLayout(nodes);
    const posA = result.positions.get('a')!;
    const posB = result.positions.get('b')!;
    expect(posA.y).not.toBe(posB.y);
  });

  it('orders nodes by createdAt along X axis', () => {
    const nodes = [
      makeNode('late', { createdAt: '2024-06-01T00:00:00Z' }),
      makeNode('early', { createdAt: '2024-01-01T00:00:00Z' }),
    ];
    const result = computeTimelineLayout(nodes);
    const early = result.positions.get('early')!;
    const late = result.positions.get('late')!;
    expect(late.x).toBeGreaterThan(early.x);
  });

  it('handles nodes with the same createdAt (minimum X span)', () => {
    const nodes = [
      makeNode('a', { createdAt: '2024-01-01T00:00:00Z' }),
      makeNode('b', { createdAt: '2024-01-01T00:00:00Z' }),
    ];
    const result = computeTimelineLayout(nodes);
    // Both should have finite positions even with identical timestamps
    expect(result.positions.size).toBe(2);
    for (const pos of result.positions.values()) {
      expect(isFinite(pos.x)).toBe(true);
      expect(isFinite(pos.y)).toBe(true);
    }
  });
});

// --- Structure Layout ---

describe('computeStructureLayout', () => {
  it('returns empty Map for empty array', () => {
    const result = computeStructureLayout([]);
    expect(result.positions.size).toBe(0);
    expect(result.zones).toEqual([]);
  });

  it('groups nodes by structureType', () => {
    const nodes = [
      makeNode('a', { structureType: 'pyramid' }),
      makeNode('b', { structureType: 'pillars' }),
      makeNode('c', { structureType: 'pyramid' }),
    ];
    const result = computeStructureLayout(nodes);
    // Should have 2 zones: pyramid and pillars
    expect(result.zones!.length).toBe(2);
    const pyramidZone = result.zones!.find((z) => z.id === 'zone-pyramid')!;
    expect(pyramidZone).toBeDefined();
    expect(pyramidZone.label).toBe('Pyramid');
  });

  it('assigns unique positions to all nodes', () => {
    const nodes = [
      makeNode('a', { structureType: 'pyramid' }),
      makeNode('b', { structureType: 'pyramid' }),
      makeNode('c', { structureType: 'custom' }),
    ];
    const result = computeStructureLayout(nodes);
    const positionStrings = new Set(
      Array.from(result.positions.values()).map((p) => `${p.x},${p.y}`)
    );
    expect(positionStrings.size).toBe(3);
  });

  it('zones do not overlap horizontally', () => {
    const nodes = [
      makeNode('a', { structureType: 'pyramid' }),
      makeNode('b', { structureType: 'pillars' }),
      makeNode('c', { structureType: 'custom' }),
    ];
    const result = computeStructureLayout(nodes);
    const zones = result.zones!;
    // Verify zones are arranged left-to-right without overlap
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].x).toBeGreaterThan(zones[i - 1].x + zones[i - 1].width - 100);
    }
  });
});
