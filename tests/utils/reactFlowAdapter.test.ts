// tests/utils/reactFlowAdapter.test.ts
import { frameworkNodeToReactFlow, frameworkEdgeToReactFlow } from '../../src/utils/reactFlowAdapter';
import type { FrameworkNode, FrameworkEdge } from '../../src/types/framework';

function makeFrameworkNode(overrides: Partial<FrameworkNode> = {}): FrameworkNode {
  return {
    id: 'node-1',
    label: 'Test Node',
    content: 'Test content',
    level: 0,
    state: 'virtual',
    metadata: { createdBy: 'ai' },
    ...overrides,
  };
}

function makeFrameworkEdge(overrides: Partial<FrameworkEdge> = {}): FrameworkEdge {
  return {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    relationship: 'contains',
    state: 'virtual',
    ...overrides,
  };
}

describe('frameworkNodeToReactFlow', () => {
  it('converts id correctly', () => {
    const node = makeFrameworkNode({ id: 'my-node' });
    const result = frameworkNodeToReactFlow(node);
    expect(result.id).toBe('my-node');
  });

  it('sets type to "frameworkNode"', () => {
    const node = makeFrameworkNode();
    const result = frameworkNodeToReactFlow(node);
    expect(result.type).toBe('frameworkNode');
  });

  it('uses node position when provided', () => {
    const node = makeFrameworkNode({ position: { x: 100, y: 200 } });
    const result = frameworkNodeToReactFlow(node);
    expect(result.position).toEqual({ x: 100, y: 200 });
  });

  it('defaults position to { x: 0, y: 0 } when not provided', () => {
    const node = makeFrameworkNode();
    // position is undefined by default
    const result = frameworkNodeToReactFlow(node);
    expect(result.position).toEqual({ x: 0, y: 0 });
  });

  it('maps data fields correctly', () => {
    const node = makeFrameworkNode({
      label: 'My Label',
      content: 'My Content',
      level: 2,
      state: 'confirmed',
      metadata: { createdBy: 'user', confidence: 0.9 },
    });
    const result = frameworkNodeToReactFlow(node);
    expect(result.data.label).toBe('My Label');
    expect(result.data.content).toBe('My Content');
    expect(result.data.level).toBe(2);
    expect(result.data.state).toBe('confirmed');
    expect(result.data.metadata).toEqual({ createdBy: 'user', confidence: 0.9 });
  });
});

describe('frameworkEdgeToReactFlow', () => {
  it('converts id correctly', () => {
    const edge = makeFrameworkEdge({ id: 'my-edge' });
    const result = frameworkEdgeToReactFlow(edge);
    expect(result.id).toBe('my-edge');
  });

  it('sets source and target correctly', () => {
    const edge = makeFrameworkEdge({ source: 'a', target: 'b' });
    const result = frameworkEdgeToReactFlow(edge);
    expect(result.source).toBe('a');
    expect(result.target).toBe('b');
  });

  it('sets type to "frameworkEdge"', () => {
    const edge = makeFrameworkEdge();
    const result = frameworkEdgeToReactFlow(edge);
    expect(result.type).toBe('frameworkEdge');
  });

  it('sets label to relationship value', () => {
    const edge = makeFrameworkEdge({ relationship: 'depends_on' });
    const result = frameworkEdgeToReactFlow(edge);
    expect(result.label).toBe('depends_on');
  });

  it('maps data with state and relationship', () => {
    const edge = makeFrameworkEdge({ state: 'confirmed', relationship: 'references' });
    const result = frameworkEdgeToReactFlow(edge);
    expect(result.data.state).toBe('confirmed');
    expect(result.data.relationship).toBe('references');
  });
});
