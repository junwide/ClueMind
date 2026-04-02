// src/components/Canvas/Canvas.tsx
import { useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { KnowledgeFramework } from '../../types/framework';
import {
  frameworkNodeToReactFlow,
  frameworkEdgeToReactFlow,
} from '../../utils/reactFlowAdapter';
import { applyDagreLayout } from '../../utils/autoLayout';
import { CustomNode } from './CustomNode';
import { CustomEdge } from './CustomEdge';
import { useTranslation } from '../../i18n';

const nodeTypes = { frameworkNode: CustomNode };
const edgeTypes = { frameworkEdge: CustomEdge };

interface CanvasProps {
  framework: KnowledgeFramework | null;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string, event: React.MouseEvent) => void;
  onEdgeClick: (edgeId: string) => void;
  selectedEdgeId: string | null;
  onNodeDrag?: (nodeId: string, position: { x: number; y: number }) => void;
}

function CanvasInner({
  framework,
  onNodeClick,
  onNodeContextMenu,
  onEdgeClick,
  selectedEdgeId,
  onNodeDrag,
}: CanvasProps) {
  const { fitView } = useReactFlow();
  const { t } = useTranslation();
  const prevFrameworkIdRef = useRef<string | null>(null);

  // Convert nodes — only depends on framework, NOT selectedEdgeId
  const rfNodes = useMemo(() => {
    if (!framework) return [];

    const hasExplicitPositions = framework.nodes.every((n) => n.position != null);
    let nodes = framework.nodes.map(frameworkNodeToReactFlow);

    // Only apply dagre layout when nodes have no saved positions (new framework)
    if (!hasExplicitPositions && nodes.length > 0) {
      const edges = framework.edges.map((e) => frameworkEdgeToReactFlow(e));
      nodes = applyDagreLayout(nodes, edges);
    }

    return nodes;
  }, [framework]);

  // Convert edges — separate memo so edge selection doesn't re-layout nodes
  const rfEdges = useMemo(() => {
    if (!framework) return [];
    return framework.edges.map((e) => {
      const result = frameworkEdgeToReactFlow(e);
      if (e.id === selectedEdgeId) result.selected = true;
      return result;
    });
  }, [framework, selectedEdgeId]);

  // Auto-fit view when framework changes
  useEffect(() => {
    if (framework && framework.id !== prevFrameworkIdRef.current) {
      prevFrameworkIdRef.current = framework.id;
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [framework?.id, fitView]);

  if (!framework) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <p className="text-gray-400">{t('canvas.noFramework')}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_event, node) => onNodeClick(node.id)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          onNodeContextMenu(node.id, event as unknown as React.MouseEvent);
        }}
        onEdgeClick={(_event, edge) => onEdgeClick(edge.id)}
        onNodeDragStop={(_event, node) => {
          onNodeDrag?.(node.id, { x: node.position.x, y: node.position.y });
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-white !border-gray-200"
        />
      </ReactFlow>
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
