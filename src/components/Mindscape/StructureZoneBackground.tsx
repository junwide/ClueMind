// src/components/Mindscape/StructureZoneBackground.tsx
import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import type { StructureZoneData } from '../../types/reactFlow';

function StructureZoneBackgroundComponent({ data }: NodeProps<Node<StructureZoneData>>) {
  const label = data?.label ?? '';
  const color = data?.color ?? 'rgba(139, 92, 246, 0.12)';

  return (
    <div
      className="w-full h-full rounded-2xl border-2 border-dashed border-slate-600/50 flex items-start justify-center pt-3"
      style={{ backgroundColor: color }}
    >
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export const StructureZoneBackground = memo(StructureZoneBackgroundComponent);
