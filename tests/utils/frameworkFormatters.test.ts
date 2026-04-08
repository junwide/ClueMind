// tests/utils/frameworkFormatters.test.ts
import { formatProposalSummary } from '../../src/utils/frameworkFormatters';
import type { KnowledgeFramework, FrameworkNode, FrameworkEdge } from '../../src/types/framework';

function makeNode(overrides: Partial<FrameworkNode> = {}): FrameworkNode {
  return {
    id: 'n1',
    label: 'Root',
    content: 'Root content',
    level: 0,
    state: 'virtual',
    metadata: { createdBy: 'ai' },
    ...overrides,
  };
}

function makeEdge(overrides: Partial<FrameworkEdge> = {}): FrameworkEdge {
  return {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    relationship: 'contains',
    state: 'virtual',
    ...overrides,
  };
}

function makeFramework(overrides: Partial<KnowledgeFramework> = {}): KnowledgeFramework {
  return {
    id: 'fw-1',
    title: 'Test',
    description: '',
    structureType: 'pyramid',
    nodes: [],
    edges: [],
    createdFromDrops: [],
    lifecycle: 'draft',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('formatProposalSummary', () => {
  it('shows "建议修改" header', () => {
    const current = makeFramework();
    const proposed = makeFramework();
    const result = formatProposalSummary(current, proposed);
    expect(result).toContain('建议修改');
  });

  it('shows core nodes (level <= 1) with truncated content', () => {
    const current = makeFramework();
    const proposed = makeFramework({
      nodes: [
        makeNode({ id: 'n1', label: 'Root', content: 'Root content here', level: 0 }),
        makeNode({ id: 'n2', label: 'Child', content: 'Child content here', level: 1 }),
        makeNode({ id: 'n3', label: 'Deep', content: 'Deep content here', level: 2 }),
      ],
    });
    const result = formatProposalSummary(current, proposed);
    expect(result).toContain('"Root"');
    expect(result).toContain('"Child"');
    expect(result).toContain('Root content here');
    expect(result).toContain('Child content here');
    // Level 2 node should NOT appear in core nodes
    expect(result).not.toContain('"Deep"');
  });

  it('truncates long content to 50 characters', () => {
    const longContent = 'A'.repeat(100);
    const current = makeFramework();
    const proposed = makeFramework({
      nodes: [makeNode({ id: 'n1', label: 'Long', content: longContent, level: 0 })],
    });
    const result = formatProposalSummary(current, proposed);
    // The displayed content should be truncated (50 chars + "...")
    expect(result).toContain('AAAA');
    expect(result).toContain('...');
    // Should not contain the full 100-char string
    expect(result).not.toContain(longContent);
  });

  it('shows edge relationships with node labels', () => {
    const current = makeFramework();
    const proposed = makeFramework({
      nodes: [
        makeNode({ id: 'n1', label: 'Parent' }),
        makeNode({ id: 'n2', label: 'Child' }),
      ],
      edges: [makeEdge({ source: 'n1', target: 'n2', relationship: 'contains' })],
    });
    const result = formatProposalSummary(current, proposed);
    expect(result).toContain('"Parent"');
    expect(result).toContain('"Child"');
    expect(result).toContain('contains');
    expect(result).toContain('→');
  });

  it('shows diff summary when nodes are added', () => {
    const current = makeFramework({
      nodes: [makeNode({ id: 'n1', label: 'Old' })],
    });
    const proposed = makeFramework({
      nodes: [
        makeNode({ id: 'n1', label: 'Old' }),
        makeNode({ id: 'n2', label: 'New' }),
      ],
    });
    const result = formatProposalSummary(current, proposed);
    expect(result).toContain('新增');
    expect(result).toContain('1 个节点');
  });

  it('shows diff summary when nodes are removed', () => {
    const current = makeFramework({
      nodes: [
        makeNode({ id: 'n1', label: 'Keep' }),
        makeNode({ id: 'n2', label: 'Remove' }),
      ],
    });
    const proposed = makeFramework({
      nodes: [makeNode({ id: 'n1', label: 'Keep' })],
    });
    const result = formatProposalSummary(current, proposed);
    expect(result).toContain('移除');
    expect(result).toContain('1 个节点');
  });

  it('shows title change when title differs', () => {
    const current = makeFramework({ title: 'Old Title' });
    const proposed = makeFramework({ title: 'New Title' });
    const result = formatProposalSummary(current, proposed);
    expect(result).toContain('Old Title');
    expect(result).toContain('New Title');
    expect(result).toContain('标题');
  });

  it('does not show title change when titles match', () => {
    const current = makeFramework({ title: 'Same Title' });
    const proposed = makeFramework({ title: 'Same Title' });
    const result = formatProposalSummary(current, proposed);
    expect(result).not.toContain('标题');
  });

  it('handles empty framework (no nodes, no edges)', () => {
    const current = makeFramework();
    const proposed = makeFramework();
    const result = formatProposalSummary(current, proposed);
    // Should still have the header
    expect(result).toContain('建议修改');
    // But no core nodes or edge details sections
    expect(result).not.toContain('核心节点');
    expect(result).not.toContain('关联逻辑');
  });
});
