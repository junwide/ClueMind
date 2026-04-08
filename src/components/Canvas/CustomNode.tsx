import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CanvasNodeData } from '../../types/reactFlow';

const stateStyles: Record<string, string> = {
  virtual:
    'border-2 border-dashed border-blue-400 bg-blue-50 opacity-80',
  confirmed:
    'border-2 border-solid border-green-500 bg-green-50',
  locked:
    'border-2 border-solid border-orange-500 bg-orange-50',
};

function CustomNodeComponent({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const state = data?.state ?? 'virtual';
  const level = data?.level ?? 0;
  const label = data?.label ?? '';
  const content = data?.content ?? '';
  const styleClass = stateStyles[state] || stateStyles.virtual;

  return (
    <div
      className={`px-3 py-2 rounded-lg shadow-sm min-w-[200px] max-w-[220px] transition-shadow ${styleClass} ${selected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-gray-400 !border-none"
      />

      <div className="flex items-start gap-2">
        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded px-1 mt-0.5 flex-shrink-0">
          L{level}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">
            {label}
          </div>
          {content && (
            <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
              {content}
            </div>
          )}
        </div>
        {state === 'locked' && (
          <span className="text-sm flex-shrink-0" title="Locked">🔒</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-gray-400 !border-none"
      />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
