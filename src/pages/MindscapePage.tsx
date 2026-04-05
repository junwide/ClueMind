// src/pages/MindscapePage.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import { FrameworkNode } from '../components/Mindscape/FrameworkNode';
import { SharedDropEdge } from '../components/Mindscape/SharedDropEdge';
import { computeCircleLayout } from '../utils/mindscapeLayout';
import type { FrameworkGraphData } from '../types/mindscape';
import { useTranslation } from '../i18n';

interface MindscapePageProps {
  onNavigateToCanvas: (frameworkId: string) => void;
}

const nodeTypes = { frameworkGraphNode: FrameworkNode };
const edgeTypes = { sharedDropEdge: SharedDropEdge };

function MindscapePageInner({ onNavigateToCanvas }: MindscapePageProps) {
  const [graphData, setGraphData] = useState<FrameworkGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    invoke<FrameworkGraphData>('list_framework_graph')
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onNavigateToCanvas(node.id);
  }, [onNavigateToCanvas]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graphData) return { initialNodes: [], initialEdges: [] };

    // Count shared drops per framework (for node display)
    const sharedDropCounts: Record<string, number> = {};
    for (const edge of graphData.edges) {
      sharedDropCounts[edge.sourceId] = (sharedDropCounts[edge.sourceId] || 0) + edge.sharedDropCount;
      sharedDropCounts[edge.targetId] = (sharedDropCounts[edge.targetId] || 0) + edge.sharedDropCount;
    }

    const positions = computeCircleLayout(graphData.nodes);

    const nodes: Node[] = graphData.nodes.map((fw) => ({
      id: fw.id,
      type: 'frameworkGraphNode',
      position: positions.get(fw.id) || { x: 0, y: 0 },
      data: {
        id: fw.id,
        title: fw.title,
        description: fw.description,
        lifecycle: fw.lifecycle,
        nodeCount: fw.nodeCount,
        edgeCount: fw.edgeCount,
        dropCount: fw.dropCount,
        sharedDropCount: sharedDropCounts[fw.id] || 0,
        onClick: onNavigateToCanvas,
      },
    }));

    const edges: Edge[] = graphData.edges.map((e) => ({
      id: `edge-${e.sourceId}-${e.targetId}`,
      source: e.sourceId,
      target: e.targetId,
      type: 'sharedDropEdge',
      data: {
        sharedDropCount: e.sharedDropCount,
      },
    }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [graphData, onNavigateToCanvas]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 text-sm animate-pulse">{t('mindscape.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 gap-3">
        <div className="text-4xl">🌌</div>
        <div className="text-slate-400 text-sm">{t('mindscape.empty')}</div>
        <div className="text-slate-500 text-xs">{t('mindscape.emptyHint')}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-slate-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls
          className="!bg-slate-800 !border-slate-700 [&>button]:!bg-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
        />
        <MiniMap
          nodeColor={() => '#6366f1'}
          maskColor="rgba(15, 23, 42, 0.8)"
          style={{ background: '#1e293b', border: '1px solid #334155' }}
        />
      </ReactFlow>
    </div>
  );
}

export default function MindscapePage(props: MindscapePageProps) {
  return (
    <ReactFlowProvider>
      <MindscapePageInner {...props} />
    </ReactFlowProvider>
  );
}
