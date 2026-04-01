// src/components/Canvas/Canvas.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { KnowledgeFramework, Position } from '../../types/framework';
import { NodeRenderer } from './NodeRenderer';
import { EdgeRenderer } from './EdgeRenderer';
import { CanvasControls } from './CanvasControls';
import { useTranslation } from '../../i18n';

interface CanvasProps {
  framework: KnowledgeFramework | null;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string, event: React.MouseEvent) => void;
  onEdgeClick: (edgeId: string) => void;
  selectedEdgeId: string | null;
  onNodeDrag?: (nodeId: string, position: { x: number; y: number }) => void;
}

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

const NODE_WIDTH = 220;

// Auto-positioning helper
const getNodePosition = (index: number, total: number, level?: number): Position => {
  const nodeHeight = 120;
  const paddingX = 40;
  const paddingY = 30;

  const cols = Math.min(Math.ceil(Math.sqrt(total * 1.5)), 4);
  const row = Math.floor(index / cols);
  const col = index % cols;

  const levelOffset = (level || 0) * 50;

  return {
    x: col * (NODE_WIDTH + paddingX) + 100 + levelOffset,
    y: row * (nodeHeight + paddingY) + 100,
  };
};

export function Canvas({
  framework,
  onNodeClick,
  onNodeContextMenu,
  onEdgeClick,
  selectedEdgeId,
  onNodeDrag,
}: CanvasProps) {
  const { t } = useTranslation();
  const [viewport, setViewport] = useState<ViewportState>({ offsetX: 0, offsetY: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });

  // Wheel zoom centered on mouse position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setViewport(prev => {
      const newScale = Math.min(Math.max(prev.scale + delta, 0.2), 3);
      // Zoom toward mouse position
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const scaleRatio = newScale / prev.scale;
        return {
          offsetX: mouseX - scaleRatio * (mouseX - prev.offsetX),
          offsetY: mouseY - scaleRatio * (mouseY - prev.offsetY),
          scale: newScale,
        };
      }
      return { ...prev, scale: newScale };
    });
  }, []);

  // Middle mouse button pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) { // Middle button
      e.preventDefault();
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { x: viewport.offsetX, y: viewport.offsetY };
    }
  }, [viewport.offsetX, viewport.offsetY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!panningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport(prev => ({
        ...prev,
        offsetX: panOffsetStartRef.current.x + dx,
        offsetY: panOffsetStartRef.current.y + dy,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        panningRef.current = false;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Also support right-click drag for panning (alternative to middle button)
  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan if right-clicking on empty canvas, not on nodes
    if (e.button === 2) {
      e.preventDefault();
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { x: viewport.offsetX, y: viewport.offsetY };
    }
  }, [viewport.offsetX, viewport.offsetY]);

  const handleZoomIn = useCallback(() => {
    setViewport(prev => ({ ...prev, scale: Math.min(prev.scale + 0.2, 3) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewport(prev => ({ ...prev, scale: Math.max(prev.scale - 0.2, 0.2) }));
  }, []);

  const handleReset = useCallback(() => {
    if (!framework || framework.nodes.length === 0) {
      setViewport({ offsetX: 0, offsetY: 0, scale: 1 });
      return;
    }
    // Calculate bounding box of all nodes and center
    const positions = framework.nodes
      .map((n, i) => n.position || getNodePosition(i, framework.nodes.length, n.level))
      .filter(Boolean);

    if (positions.length === 0) {
      setViewport({ offsetX: 0, offsetY: 0, scale: 1 });
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x + NODE_WIDTH));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y + 120));

    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;
    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const scale = Math.min(scaleX, scaleY, 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setViewport({
      offsetX: rect.width / 2 - centerX * scale,
      offsetY: rect.height / 2 - centerY * scale,
      scale,
    });
  }, [framework]);

  if (!framework) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">{t('canvas.noFramework')}</p>
      </div>
    );
  }

  // Apply auto-positioning to nodes without positions
  const nodesWithPositions = framework.nodes.map((node, index) => {
    if (!node.position) {
      const position = getNodePosition(index, framework.nodes.length, node.level);
      return { ...node, position };
    }
    return node;
  });

  // Build nodeId -> position mapping for edge rendering
  const nodePositions: Record<string, Position> = {};
  nodesWithPositions.forEach(node => {
    if (node.position) {
      nodePositions[node.id] = node.position;
    }
  });

  const transform = `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-50 overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={(e) => { handleMouseDown(e); handleRightMouseDown(e); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <CanvasControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        scale={viewport.scale}
      />

      {/* Transformed layer for both edges and nodes */}
      <div
        style={{
          transform,
          transformOrigin: '0 0',
          position: 'absolute',
          inset: 0,
        }}
      >
        {/* SVG layer for edges */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {framework.edges.map((edge) => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            if (!sourcePos || !targetPos) return null;

            return (
              <EdgeRenderer
                key={edge.id}
                edge={edge}
                sourceX={sourcePos.x + NODE_WIDTH / 2}
                sourceY={sourcePos.y}
                targetX={targetPos.x + NODE_WIDTH / 2}
                targetY={targetPos.y}
                isSelected={edge.id === selectedEdgeId}
                onEdgeClick={onEdgeClick}
              />
            );
          })}
        </svg>

        {/* Node layer */}
        {nodesWithPositions.map((node) => (
          <NodeRenderer
            key={node.id}
            node={node}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDrag={onNodeDrag}
            viewportScale={viewport.scale}
          />
        ))}
      </div>
    </div>
  );
}
