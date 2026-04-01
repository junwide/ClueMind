// src/components/Canvas/NodeRenderer.tsx
import React, { useCallback, useRef } from 'react';
import { FrameworkNode, Position } from '../../types/framework';

interface NodeRendererProps {
  node: FrameworkNode;
  onNodeClick: (nodeId: string) => void;
  onNodeContextMenu: (nodeId: string, event: React.MouseEvent) => void;
  onNodeDrag?: (nodeId: string, position: Position) => void;
  viewportScale?: number;
}

export function NodeRenderer({ node, onNodeClick, onNodeContextMenu, onNodeDrag, viewportScale = 1 }: NodeRendererProps) {
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const nodeStart = useRef({ x: 0, y: 0 });

  const getNodeStyle = () => {
    const baseStyle: React.CSSProperties = {
      padding: '12px',
      borderRadius: '8px',
      cursor: 'grab',
      transition: dragging.current ? 'none' : 'all 0.3s ease',
      width: '220px',
      userSelect: 'none',
    };

    switch (node.state) {
      case 'virtual':
        return {
          ...baseStyle,
          border: '2px dashed #2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          opacity: 0.7,
        };
      case 'confirmed':
        return {
          ...baseStyle,
          border: '2px solid #4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
        };
      case 'locked':
        return {
          ...baseStyle,
          border: '3px solid #ff9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
        };
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    dragging.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    nodeStart.current = { x: node.position?.x || 0, y: node.position?.y || 0 };

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;

      if (!dragging.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragging.current = true;
      }

      if (dragging.current && onNodeDrag) {
        onNodeDrag(node.id, {
          x: nodeStart.current.x + dx / viewportScale,
          y: nodeStart.current.y + dy / viewportScale,
        });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (!dragging.current) {
        // It was a click, not a drag
        onNodeClick(node.id);
      }
      dragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [node.id, node.position, onNodeClick, onNodeDrag]);

  return (
    <div
      style={{
        ...getNodeStyle(),
        position: 'absolute',
        left: node.position?.x || 0,
        top: node.position?.y || 0,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onNodeContextMenu(node.id, e);
      }}
    >
      <div className="font-medium text-sm">{node.label}</div>
      <div className="text-xs text-gray-600 mt-1 line-clamp-2">{node.content}</div>
      {node.state === 'locked' && <span className="ml-2">🔒</span>}
    </div>
  );
}
