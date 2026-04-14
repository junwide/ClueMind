// src/components/Mindscape/DropNode.tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { DropNodeData } from '../../types/reactFlow';

const typeIcons: Record<string, string> = {
  text: '📝',
  url: '🔗',
  image: '🖼️',
  file: '📁',
  voice: '🎤',
};

const typeColors: Record<string, string> = {
  text: 'bg-blue-900/60 border-blue-500',
  url: 'bg-purple-900/60 border-purple-500',
  image: 'bg-pink-900/60 border-pink-500',
  file: 'bg-amber-900/60 border-amber-500',
  voice: 'bg-teal-900/60 border-teal-500',
};

function DropNodeComponent({ data, selected }: NodeProps<Node<DropNodeData>>) {
  const label = data?.label ?? '';
  const contentType = data?.contentType ?? 'text';
  const frameworkCount = data?.frameworkCount ?? 0;
  const icon = typeIcons[contentType] || '📄';
  const styleClass = typeColors[contentType] || typeColors.text;

  return (
    <div
      className={`w-[180px] rounded-lg p-3 cursor-pointer transition-all duration-200 border ${styleClass} ${
        selected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900' : 'shadow-md'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-0 !h-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !opacity-0" />

      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-slate-400 uppercase">{contentType}</span>
      </div>
      <p className="text-xs text-slate-200 truncate">{label}</p>
      {frameworkCount > 0 && (
        <div className="mt-1 text-[10px] text-cyan-400">
          → {frameworkCount} framework{frameworkCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export const DropNode = memo(DropNodeComponent);
