// src/components/Mindscape/FrameworkNode.tsx
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const lifecycleStyles: Record<string, string> = {
  draft: 'bg-slate-800/60 border-slate-600',
  building: 'bg-indigo-900/60 border-indigo-500',
  confirmed: 'bg-emerald-900/60 border-emerald-500',
  locked: 'bg-amber-900/60 border-amber-500',
};

const lifecycleBadge: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-slate-400' },
  building: { label: 'Building', color: 'text-indigo-400' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-400' },
  locked: { label: 'Locked', color: 'text-amber-400' },
};

function FrameworkNodeComponent({ data, selected }: NodeProps) {
  const id = (data?.id as string) || '';
  const title = (data?.title as string) || 'Untitled';
  const lifecycle = (data?.lifecycle as string) || 'draft';
  const nodeCount = (data?.nodeCount as number) || 0;
  const dropCount = (data?.dropCount as number) || 0;
  const edgeCount = (data?.edgeCount as number) || 0;
  const onClick = data?.onClick as ((id: string) => void) | undefined;
  const sharedDropCount = (data?.sharedDropCount as number) || 0;

  const styleClass = lifecycleStyles[lifecycle] || lifecycleStyles.draft;
  const badge = lifecycleBadge[lifecycle] || lifecycleBadge.draft;

  return (
    <div
      className={`w-[280px] rounded-xl p-4 cursor-pointer transition-all duration-200 ${styleClass} ${
        selected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900' : ''
      } ${sharedDropCount > 0 ? 'shadow-lg shadow-cyan-500/20' : 'shadow-md'}`}
      onClick={() => onClick?.(id)}
    >
      {/* Invisible handles for edge connections */}
      <Handle type="target" position={Position.Top} className="!w-0 !h-0 !opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !opacity-0" />
      <Handle type="target" position={Position.Left} className="!w-0 !h-0 !opacity-0" />
      <Handle type="source" position={Position.Right} className="!w-0 !h-0 !opacity-0" />

      {/* Header: title + badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-100 truncate flex-1">
          {title}
        </h3>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.color} bg-slate-700/80 flex-shrink-0`}>
          {badge.label}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="4" />
          </svg>
          {nodeCount} nodes
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 5l5 5-5M5 10l5 5M10 15l-5-5M15 10l-5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          {edgeCount} edges
        </span>
        {dropCount > 0 && (
          <span className="flex items-center gap-1">
            📄 {dropCount}
          </span>
        )}
      </div>

      {/* Shared drops indicator */}
      {sharedDropCount > 0 && (
        <div className="mt-2 text-[10px] text-cyan-400 bg-cyan-500/10 rounded px-2 py-0.5">
          🔗 {sharedDropCount} shared material{sharedDropCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export const FrameworkNode = memo(FrameworkNodeComponent);
