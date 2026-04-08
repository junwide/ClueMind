import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { CanvasEdgeData } from '../../types/reactFlow';

const stateStyles: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  virtual: { stroke: '#60a5fa', strokeWidth: 1.5, strokeDasharray: '5,5' },
  confirmed: { stroke: '#22c55e', strokeWidth: 2 },
  locked: { stroke: '#f97316', strokeWidth: 2.5 },
};

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<Edge<CanvasEdgeData>>) {
  const state = data?.state ?? 'virtual';
  const relationship = data?.relationship ?? '';
  const { stroke, strokeWidth, strokeDasharray } = stateStyles[state] || stateStyles.virtual;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const showLabel = selected || state === 'locked';

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke, strokeWidth, strokeDasharray }}
        markerEnd={markerEnd}
      />
      {showLabel && relationship && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-600 whitespace-nowrap shadow-sm"
          >
            {relationship}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);
