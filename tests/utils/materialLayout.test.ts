// tests/utils/materialLayout.test.ts
import { computeMaterialLayout } from '../../src/utils/materialLayout';
import type { MaterialGraphNode, MaterialGraphEdge } from '../../src/types/mindscape';

const ALL_TYPES = ['text', 'url', 'image', 'file', 'voice'];

function makeDropNode(id: string, contentType: string = 'text'): MaterialGraphNode {
  return { id, label: `Drop ${id}`, contentType: contentType as MaterialGraphNode['contentType'] };
}

function makeFwNode(id: string): MaterialGraphNode {
  return { id, label: `FW ${id}`, contentType: 'framework' };
}

describe('computeMaterialLayout', () => {
  it('returns empty positions for empty input', () => {
    const result = computeMaterialLayout([], [], [], ALL_TYPES as any);
    expect(result.positions.size).toBe(0);
  });

  it('produces finite positions for drop-framework pairs', () => {
    const drops = [makeDropNode('d1')];
    const frameworks = [makeFwNode('fw1')];
    const edges: MaterialGraphEdge[] = [{ dropId: 'd1', frameworkId: 'fw1' }];

    const result = computeMaterialLayout(drops, frameworks, edges, ALL_TYPES as any);
    expect(result.positions.size).toBe(2);
    for (const pos of result.positions.values()) {
      expect(isFinite(pos.x)).toBe(true);
      expect(isFinite(pos.y)).toBe(true);
    }
  });

  it('filters drops by content type', () => {
    const drops = [
      makeDropNode('d1', 'text'),
      makeDropNode('d2', 'image'),
    ];
    const frameworks = [makeFwNode('fw1')];
    const edges: MaterialGraphEdge[] = [
      { dropId: 'd1', frameworkId: 'fw1' },
      { dropId: 'd2', frameworkId: 'fw1' },
    ];

    // Filter to only 'text' drops
    const result = computeMaterialLayout(drops, frameworks, edges, ['text'] as any);
    expect(result.positions.has('d1')).toBe(true);
    expect(result.positions.has('d2')).toBe(false);
    // Framework should still be present since it's connected to d1
    expect(result.positions.has('fw1')).toBe(true);
  });

  it('handles multiple drops and frameworks', () => {
    const drops = [makeDropNode('d1'), makeDropNode('d2'), makeDropNode('d3')];
    const frameworks = [makeFwNode('fw1'), makeFwNode('fw2')];
    const edges: MaterialGraphEdge[] = [
      { dropId: 'd1', frameworkId: 'fw1' },
      { dropId: 'd2', frameworkId: 'fw1' },
      { dropId: 'd3', frameworkId: 'fw2' },
    ];

    const result = computeMaterialLayout(drops, frameworks, edges, ALL_TYPES as any);
    expect(result.positions.size).toBe(5);
  });
});
