import type { Node, Edge } from '@xyflow/react';
import type { FrameworkNode, FrameworkEdge } from '../types/framework';

export function frameworkNodeToReactFlow(node: FrameworkNode): Node {
  return {
    id: node.id,
    type: 'frameworkNode',
    position: node.position || { x: 0, y: 0 },
    data: {
      label: node.label,
      content: node.content,
      level: node.level,
      state: node.state,
      metadata: node.metadata,
    },
  };
}

export function frameworkEdgeToReactFlow(edge: FrameworkEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'frameworkEdge',
    label: edge.relationship,
    data: {
      state: edge.state,
      relationship: edge.relationship,
    },
  };
}
