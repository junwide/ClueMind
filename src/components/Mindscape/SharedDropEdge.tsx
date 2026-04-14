// src/components/Mindscape/SharedDropEdge.tsx
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { MindscapeEdgeData } from '../../types/reactFlow';

function SharedDropEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<Edge<MindscapeEdgeData>>) {
  const count = data?.sharedDropCount ?? 0;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id="shared-drop-edge"
        path={edgePath}
        style={{
          stroke: selected ? '#22d3ee' : '#818cf8',
          strokeWidth: Math.min(1 + count * 0.5, 4),
          strokeDasharray: '8,4',
          opacity: selected ? 0.9 : 0.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="text-[10px] text-cyan-300 bg-slate-800/80 border border-cyan-500/30 rounded-full px-2 py-0.5"
        >
          📄 {count}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const SharedDropEdge = memo(SharedDropEdgeComponent);
