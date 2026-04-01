import type { FrameworkProposal } from '../types/ai';

interface FrameworkDescription {
  thinkingPattern: string;
  organizingLogic: string;
}

const structureDescriptions: Record<string, { thinking: string; logic: string }> = {
  pyramid: {
    thinking: '自顶向下演绎 - 从核心观点逐层展开支撑论据',
    logic: '层次化组织 - 上层节点是下层节点的总结或前提',
  },
  pillars: {
    thinking: '并行支撑 - 多个独立维度共同支撑核心主题',
    logic: '并列式组织 - 各支柱相互独立，共同构成完整体系',
  },
  hierarchy: {
    thinking: '层级递进 - 按照从宏观到微观的逻辑分层展开',
    logic: '树状结构 - 每个分支独立展开，层级关系明确',
  },
  mindmap: {
    thinking: '发散联想 - 以中心主题向外辐射关联概念',
    logic: '放射状组织 - 中心到边缘的网状连接',
  },
  flow: {
    thinking: '流程驱动 - 按照时间或因果顺序串联步骤',
    logic: '线性/分支流程 - 步骤间有明确的先后或依赖关系',
  },
  custom: {
    thinking: '灵活关联 - 根据内容特点建立有机联系',
    logic: '网络化组织 - 节点间关系多样化，适应复杂知识结构',
  },
};

function describeNodeHierarchy(
  nodes: FrameworkProposal['nodes'],
  edges: FrameworkProposal['edges'],
): string {
  // Group nodes by level
  const levelCounts: Record<number, number> = {};
  for (const n of nodes) {
    levelCounts[n.level] = (levelCounts[n.level] || 0) + 1;
  }

  const levels = Object.entries(levelCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, count]) => `${count}个`)
    .join(' → ');

  const rootNode = nodes.find(n => n.level === 0);
  const rootLabel = rootNode ? `"${rootNode.label}"` : '';

  // Count unique relationship types
  const relTypes = new Set(edges.map(e => e.relationship));

  let desc = `${levels}节点，共${edges.length}条连接`;
  if (rootLabel) {
    desc = `以 ${rootLabel} 为核心，` + desc;
  }
  if (relTypes.size > 0) {
    desc += `，${relTypes.size}种关系类型`;
  }

  return desc;
}

export function generateFrameworkDescription(
  proposal: FrameworkProposal,
): FrameworkDescription {
  const template =
    structureDescriptions[proposal.structure_type] ||
    structureDescriptions.custom;

  return {
    thinkingPattern: template.thinking,
    organizingLogic:
      describeNodeHierarchy(proposal.nodes, proposal.edges) +
      ' — ' +
      template.logic,
  };
}
