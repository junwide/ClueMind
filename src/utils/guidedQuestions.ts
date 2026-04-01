import type { KnowledgeFramework } from '../types/framework';

interface InitialGuidance {
  structureDescription: string;
  guidingQuestions: string[];
}

export function generateInitialGuidance(
  framework: KnowledgeFramework,
  maxQuestions: number = 3,
  drops?: Array<{ id: string; content: string }>,
): InitialGuidance {
  // Group nodes by level
  const levelGroups: Record<number, typeof framework.nodes> = {};
  for (const node of framework.nodes) {
    if (!levelGroups[node.level]) {
      levelGroups[node.level] = [];
    }
    levelGroups[node.level].push(node);
  }

  // Build material summary (first 3 drops)
  let materialSummary = '';
  if (drops && drops.length > 0) {
    const dropLines = drops.slice(0, 3).map((d, i) => {
      const preview = d.content.length > 100 ? d.content.slice(0, 100) + '...' : d.content;
      return `  素材${i + 1}：${preview}`;
    });
    materialSummary = `\n📚 素材摘要：\n${dropLines.join('\n')}`;
    if (drops.length > 3) {
      materialSummary += `\n  ...还有 ${drops.length - 3} 条素材`;
    }
  }

  // Build structure description
  const structureLines = Object.entries(levelGroups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, nodes]) => {
      const labels = nodes.map(n => `"${n.label}"`).join('、');
      const indent = '  '.repeat(Number(level));
      return `${indent}第${Number(level) + 1}层：${labels}`;
    });

  // Build edge summary
  const edgeLines = framework.edges
    .slice(0, 5)
    .map(e => {
      const source = framework.nodes.find(n => n.id === e.source);
      const target = framework.nodes.find(n => n.id === e.target);
      return `  • ${source?.label || e.source} → ${target?.label || e.target} (${e.relationship})`;
    });

  const structureDescription =
    `${materialSummary}\n\n📊 当前框架结构：\n${structureLines.join('\n')}` +
    (edgeLines.length > 0
      ? `\n\n🔗 核心连接：\n${edgeLines.join('\n')}` +
        (framework.edges.length > 5
          ? `\n  ...还有 ${framework.edges.length - 5} 条连接`
          : '')
      : '');

  // Generate deduction-oriented questions
  const questions: string[] = [];

  if (drops && drops.length > 0) {
    // Start from material content
    questions.push(
      `我们从 ${drops.length} 条素材出发。在仔细阅读这些素材后，你发现了哪些关键观点、核心主题或重要信息？请分享你从素材中提炼出的核心要点。`,
    );

    questions.push(
      `这些关键观点之间是否存在逻辑关系？比如因果关系、对比关系、递进关系、或者分类包含关系？请描述你观察到的关联。`,
    );

    questions.push(
      `基于以上对素材的分析和关联梳理，当前框架的节点划分和层级结构是否合理地反映了这些关系？有哪些地方需要调整？`,
    );
  } else {
    // Fallback: no drops available, use structure-based questions
    questions.push(
      `框架的主题是"${framework.title}"，这个定位是否准确反映了你想要表达的核心？`,
    );

    const topNodes = levelGroups[0] || [];
    if (topNodes.length > 0) {
      const labels = topNodes.map(n => `"${n.label}"`).join('、');
      questions.push(
        `核心节点包括 ${labels}，这些是否覆盖了最重要的维度？有没有遗漏的？`,
      );
    }

    if (framework.edges.length > 0) {
      questions.push(
        `节点之间的关联关系是否需要调整或补充？`,
      );
    }
  }

  return { structureDescription, guidingQuestions: questions.slice(0, maxQuestions) };
}

export function generateFollowUpQuestions(
  framework: KnowledgeFramework,
  drops?: Array<{ id: string; content: string }>,
): string[] {
  const questions: string[] = [];

  const virtualNodes = framework.nodes.filter(n => n.state === 'virtual');

  if (drops && drops.length > 0) {
    // Material-oriented follow-ups
    if (virtualNodes.length > 0) {
      const labels = virtualNodes.slice(0, 3).map(n => `"${n.label}"`).join('、');
      questions.push(
        `还有 ${virtualNodes.length} 个未确认的节点（${labels}），它们是否充分反映了素材中的核心论点？有没有素材中的重要信息被遗漏了？`,
      );
    } else {
      questions.push(
        `素材中是否还有未被框架覆盖的关键点或重要细节？请回顾素材内容检查是否有遗漏。`,
      );
    }

    questions.push(
      '各节点的信息来源和推理链条是否清晰？是否有需要补充或修正的逻辑推导？',
    );
  } else {
    // Fallback: structure-based follow-ups
    if (virtualNodes.length > 0) {
      const labels = virtualNodes.slice(0, 3).map(n => `"${n.label}"`).join('、');
      questions.push(
        `还有 ${virtualNodes.length} 个节点未确认（${labels}），是否需要调整？`,
      );
    }

    if (framework.edges.length > 0) {
      questions.push(
        '节点之间的关联关系是否需要调整或补充？',
      );
    }
  }

  questions.push(
    '框架整体结构是否满意？是否可以开始定稿确认？',
  );

  return questions.slice(0, 3);
}
