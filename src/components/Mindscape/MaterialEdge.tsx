// src/components/Mindscape/MaterialEdge.tsx
import { memo } from 'react';
import { getBezierPath, BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';
import type { MaterialEdgeData } from '../../types/reactFlow';

function MaterialEdgeComponent({
  id: _id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<Edge<MaterialEdgeData>>) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: selected ? '#22d3ee' : '#64748b',
        strokeWidth: 1,
        opacity: selected ? 0.8 : 0.3,
      }}
    />
  );
}

export const MaterialEdge = memo(MaterialEdgeComponent);
