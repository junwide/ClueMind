// src/components/Mindscape/TimeRuler.tsx
import { Panel } from '@xyflow/react';
import type { FrameworkGraphNode } from '../../types/mindscape';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function TimeRuler({ nodes }: { nodes: FrameworkGraphNode[] }) {
  if (nodes.length === 0) return null;

  const timestamps = nodes.map((n) => new Date(n.createdAt).getTime()).filter((t) => isFinite(t));
  if (timestamps.length === 0) return null;

  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);

  // Generate 3-5 tick marks
  const tickCount = Math.min(5, Math.max(3, nodes.length));
  const span = maxTs - minTs || 1;
  const ticks: { label: string; percent: number }[] = [];

  for (let i = 0; i < tickCount; i++) {
    const ts = minTs + (span * i) / (tickCount - 1);
    ticks.push({
      label: formatDate(new Date(ts).toISOString()),
      percent: (i / (tickCount - 1)) * 100,
    });
  }

  return (
    <Panel position="top-right" className="!m-2 !mt-14">
      <div className="bg-slate-800/90 rounded-lg shadow-lg border border-slate-600 px-3 py-2">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Timeline</div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          {ticks[0]?.label} → {ticks[ticks.length - 1]?.label}
        </div>
        <div className="mt-1 flex gap-0.5">
          {ticks.map((t, i) => (
            <div key={i} className="flex-1 text-center">
              <div className="h-px bg-slate-600 mb-0.5" />
              <span className="text-[9px] text-slate-500">{t.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
