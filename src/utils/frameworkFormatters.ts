import type { KnowledgeFramework } from '../types/framework';

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

export function formatProposalSummary(
  current: KnowledgeFramework,
  proposed: KnowledgeFramework,
): string {
  // Core nodes: show level 0 and 1 nodes with content
  const coreNodes = proposed.nodes.filter(n => n.level <= 1);
  const nodeDetails = coreNodes
    .slice(0, 6)
    .map(n => `  • "${n.label}" - ${truncate(n.content, 50)}`)
    .join('\n');

  // Edge details: show relationships with node labels
  const edgeDetails = proposed.edges
    .slice(0, 6)
    .map(e => {
      const source = proposed.nodes.find(n => n.id === e.source);
      const target = proposed.nodes.find(n => n.id === e.target);
      return `  • "${source?.label || e.source}" → "${target?.label || e.target}" (${e.relationship})`;
    })
    .join('\n');

  // Diff summary
  const addedNodes = proposed.nodes.filter(
    n => !current.nodes.find(cn => cn.id === n.id),
  );
  const removedNodes = current.nodes.filter(
    cn => !proposed.nodes.find(n => n.id === cn.id),
  );

  let diffLine = '';
  if (addedNodes.length > 0) {
    diffLine += `\n  + 新增 ${addedNodes.length} 个节点`;
  }
  if (removedNodes.length > 0) {
    diffLine += `\n  - 移除 ${removedNodes.length} 个节点`;
  }

  const parts = [`📋 建议修改：`];

  if (proposed.title !== current.title) {
    parts.push(`\n📝 标题："${current.title}" → "${proposed.title}"`);
  }

  if (nodeDetails) {
    parts.push(`\n📌 核心节点：\n${nodeDetails}`);
  }

  if (edgeDetails) {
    parts.push(`\n🔗 关联逻辑：\n${edgeDetails}`);
  }

  if (diffLine) {
    parts.push(`\n📊 变动：${diffLine}`);
  }

  return parts.join('');
}
