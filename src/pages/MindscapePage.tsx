// src/pages/MindscapePage.tsx
import { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FrameworkNode } from '../components/Mindscape/FrameworkNode';
import { SharedDropEdge } from '../components/Mindscape/SharedDropEdge';
import { ViewSwitcher } from '../components/Mindscape/ViewSwitcher';
import { FrameworkDetailPanel } from '../components/Mindscape/FrameworkDetailPanel';
import { TimeRuler } from '../components/Mindscape/TimeRuler';
import { StructureZoneBackground } from '../components/Mindscape/StructureZoneBackground';
import { DropNode } from '../components/Mindscape/DropNode';
import { MaterialEdge } from '../components/Mindscape/MaterialEdge';
import { MaterialFilter } from '../components/Mindscape/MaterialFilter';
import { getLayoutForView } from '../utils/mindscapeLayout';
import { computeMaterialLayout } from '../utils/materialLayout';
import { useMindscapeStore } from '../stores/mindscapeStore';
import type { MaterialGraphData } from '../types/mindscape';
import type { DropType } from '../types/drop';
import { useTranslation } from '../i18n';

interface MindscapePageProps {
  onNavigateToCanvas: (frameworkId: string) => void;
}

const nodeTypes = {
  frameworkGraphNode: FrameworkNode,
  structureZone: StructureZoneBackground,
  dropNode: DropNode,
};
const edgeTypes = {
  sharedDropEdge: SharedDropEdge,
  materialEdge: MaterialEdge,
};

function MindscapePageInner({ onNavigateToCanvas }: MindscapePageProps) {
  const graphData = useMindscapeStore((s) => s.graphData);
  const materialData = useMindscapeStore((s) => s.materialData);
  const loading = useMindscapeStore((s) => s.loading);
  const error = useMindscapeStore((s) => s.error);
  const viewMode = useMindscapeStore((s) => s.viewMode);
  const materialFilter = useMindscapeStore((s) => s.materialFilter);
  const selectedFrameworkId = useMindscapeStore((s) => s.selectedFrameworkId);
  const fetchGraphData = useMindscapeStore((s) => s.fetchGraphData);
  const fetchMaterialData = useMindscapeStore((s) => s.fetchMaterialData);
  const selectFramework = useMindscapeStore((s) => s.selectFramework);
  const saveViewport = useMindscapeStore((s) => s.setViewport);
  const { t } = useTranslation();
  const { fitView, setViewport: applyViewport } = useReactFlow();
  const prevViewModeRef = useRef(viewMode);

  const viewports = useMindscapeStore((s) => s.viewports);

  // Fetch graph data on mount
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // Fetch material data when switching to material view
  useEffect(() => {
    if (viewMode === 'material' && !materialData) {
      fetchMaterialData();
    }
  }, [viewMode, materialData, fetchMaterialData]);

  // Fit view / restore viewport when switching modes
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      prevViewModeRef.current = viewMode;
      const saved = viewports[viewMode];
      const timer = setTimeout(() => {
        if (saved) {
          applyViewport(saved);
        } else {
          fitView({ padding: 0.3, duration: 300 });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, fitView, viewports, applyViewport]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    selectFramework(node.id);
  }, [selectFramework]);

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onNavigateToCanvas(node.id);
  }, [onNavigateToCanvas]);

  const handleViewportChange = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    saveViewport(viewMode, viewport);
  }, [viewMode, saveViewport]);

  // --- Compute nodes/edges based on view mode ---
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return { initialNodes: [], initialEdges: [] };

    // Count shared drops per framework
    const sharedDropCounts: Record<string, number> = {};
    for (const edge of graphData.edges) {
      sharedDropCounts[edge.sourceId] = (sharedDropCounts[edge.sourceId] || 0) + edge.sharedDropCount;
      sharedDropCounts[edge.targetId] = (sharedDropCounts[edge.targetId] || 0) + edge.sharedDropCount;
    }

    if (viewMode === 'material') {
      return computeMaterialViewData(materialData, materialFilter, selectFramework, onNavigateToCanvas);
    }

    const layout = getLayoutForView(viewMode, graphData.nodes, graphData.edges);
    const positions = layout.positions;

    // Build framework nodes
    const nodes: Node[] = graphData.nodes.map((fw) => ({
      id: fw.id,
      type: 'frameworkGraphNode',
      position: positions.get(fw.id) || { x: 0, y: 0 },
      data: {
        id: fw.id,
        title: fw.title,
        description: fw.description,
        lifecycle: fw.lifecycle,
        structureType: fw.structureType,
        nodeCount: fw.nodeCount,
        edgeCount: fw.edgeCount,
        dropCount: fw.dropCount,
        sharedDropCount: sharedDropCounts[fw.id] || 0,
        onSelect: selectFramework,
        onNavigateToCanvas,
      },
    }));

    // Build shared-drop edges (for circle/timeline/structure views)
    const edges: Edge[] = graphData.edges.map((e) => ({
      id: `edge-${e.sourceId}-${e.targetId}`,
      source: e.sourceId,
      target: e.targetId,
      type: 'sharedDropEdge',
      data: { sharedDropCount: e.sharedDropCount },
    }));

    // Add zone background nodes for structure view
    if (viewMode === 'structure' && layout.zones) {
      for (const zone of layout.zones) {
        nodes.unshift({
          id: zone.id,
          type: 'structureZone',
          position: { x: zone.x, y: zone.y },
          data: { label: zone.label, color: zone.color },
          style: { width: zone.width, height: zone.height },
          draggable: false,
          selectable: false,
          zIndex: -1,
        });
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [graphData, materialData, viewMode, materialFilter, selectFramework, onNavigateToCanvas]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (loading && !graphData) {
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
    <div className="flex-1 h-full flex bg-slate-900">
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onViewportChange={handleViewportChange}
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
          <ViewSwitcher />
          {viewMode === 'timeline' && <TimeRuler nodes={graphData.nodes} />}
          {viewMode === 'material' && <MaterialFilter />}
        </ReactFlow>
      </div>
      {selectedFrameworkId && (
        <FrameworkDetailPanel onNavigateToCanvas={onNavigateToCanvas} />
      )}
    </div>
  );
}

/** Compute nodes/edges for material view using d3-force layout */
function computeMaterialViewData(
  materialData: MaterialGraphData | null,
  filter: DropType[],
  selectFramework: (id: string | null) => void,
  onNavigateToCanvas: (id: string) => void,
) {
  if (!materialData) return { initialNodes: [], initialEdges: [] };

  const layout = computeMaterialLayout(
    materialData.drops,
    materialData.frameworks,
    materialData.edges,
    filter,
  );

  // Count frameworks per drop
  const fwCountPerDrop: Record<string, number> = {};
  for (const edge of materialData.edges) {
    fwCountPerDrop[edge.dropId] = (fwCountPerDrop[edge.dropId] || 0) + 1;
  }

  const nodes: Node[] = [];

  // Drop nodes
  for (const drop of materialData.drops) {
    if (!filter.includes(drop.contentType as DropType)) continue;
    const pos = layout.positions.get(drop.id);
    if (!pos) continue;
    nodes.push({
      id: drop.id,
      type: 'dropNode',
      position: pos,
      data: {
        id: drop.id,
        label: drop.label,
        contentType: drop.contentType,
        frameworkCount: fwCountPerDrop[drop.id] || 0,
      },
    });
  }

  // Framework nodes (simplified)
  for (const fw of materialData.frameworks) {
    const pos = layout.positions.get(fw.id);
    if (!pos) continue;
    nodes.push({
      id: fw.id,
      type: 'frameworkGraphNode',
      position: pos,
      data: {
        id: fw.id,
        title: fw.label,
        description: '',
        lifecycle: 'confirmed',
        structureType: 'custom',
        nodeCount: 0,
        edgeCount: 0,
        dropCount: 0,
        sharedDropCount: 0,
        onSelect: selectFramework,
        onNavigateToCanvas,
      },
    });
  }

  // Material edges
  const visibleDropIds = new Set(nodes.filter((n) => n.type === 'dropNode').map((n) => n.id));
  const edges: Edge[] = materialData.edges
    .filter((e) => visibleDropIds.has(e.dropId))
    .map((e, i) => ({
      id: `material-${i}`,
      source: e.dropId,
      target: e.frameworkId,
      type: 'materialEdge',
      data: {},
    }));

  return { initialNodes: nodes, initialEdges: edges };
}

export default function MindscapePage(props: MindscapePageProps) {
  return (
    <ReactFlowProvider>
      <MindscapePageInner {...props} />
    </ReactFlowProvider>
  );
}
