// src/components/Mindscape/FrameworkDetailPanel.tsx
import { ResizablePanel } from '../Layout/ResizablePanel';
import { useMindscapeStore } from '../../stores/mindscapeStore';
import type { FrameworkGraphNode } from '../../types/mindscape';

const lifecycleLabels: Record<string, string> = {
  draft: 'Draft',
  building: 'Building',
  confirmed: 'Confirmed',
  locked: 'Locked',
};

const lifecycleColors: Record<string, string> = {
  draft: 'text-slate-400 bg-slate-700/80',
  building: 'text-indigo-400 bg-indigo-900/80',
  confirmed: 'text-emerald-400 bg-emerald-900/80',
  locked: 'text-amber-400 bg-amber-900/80',
};

const structureLabels: Record<string, string> = {
  pyramid: 'Pyramid',
  pillars: 'Pillars',
  custom: 'Custom',
};

export function FrameworkDetailPanel({
  onNavigateToCanvas,
}: {
  onNavigateToCanvas: (id: string) => void;
}) {
  const selectedId = useMindscapeStore((s) => s.selectedFrameworkId);
  const graphData = useMindscapeStore((s) => s.graphData);
  const selectFramework = useMindscapeStore((s) => s.selectFramework);

  if (!selectedId || !graphData) return null;

  const framework = graphData.nodes.find((n) => n.id === selectedId);
  if (!framework) return null;

  return (
    <ResizablePanel initialWidth={320} minWidth={260} maxWidth={480} handleSide="left">
      <FrameworkDetailContent
        framework={framework}
        onClose={() => selectFramework(null)}
        onOpenCanvas={() => onNavigateToCanvas(framework.id)}
      />
    </ResizablePanel>
  );
}

function FrameworkDetailContent({
  framework,
  onClose,
  onOpenCanvas,
}: {
  framework: FrameworkGraphNode;
  onClose: () => void;
  onOpenCanvas: () => void;
}) {
  const lifecycle = framework.lifecycle || 'draft';
  const stType = framework.structureType || 'custom';

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-200 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-100 truncate flex-1 mr-2">
          {framework.title}
        </h2>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4 text-xs">
        {/* Badges */}
        <div className="flex gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${lifecycleColors[lifecycle] || lifecycleColors.draft}`}>
            {lifecycleLabels[lifecycle] || lifecycle}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-700/80">
            {structureLabels[stType] || stType}
          </span>
        </div>

        {/* Description */}
        {framework.description && (
          <p className="text-slate-400 leading-relaxed">{framework.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Nodes" value={framework.nodeCount} />
          <StatBox label="Edges" value={framework.edgeCount} />
          <StatBox label="Drops" value={framework.dropCount} />
        </div>

        {/* Dates */}
        <div className="space-y-1 text-slate-500">
          <div>Created: {formatDate(framework.createdAt)}</div>
          <div>Updated: {formatDate(framework.updatedAt)}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onOpenCanvas}
          className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
        >
          Open in Canvas
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-800 rounded-lg p-2 text-center">
      <div className="text-base font-semibold text-slate-200">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
