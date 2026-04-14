// src/components/Mindscape/ViewSwitcher.tsx
import { Panel } from '@xyflow/react';
import { useMindscapeStore } from '../../stores/mindscapeStore';
import type { MindscapeViewMode } from '../../types/mindscape';

const VIEW_OPTIONS: { mode: MindscapeViewMode; icon: string; label: string }[] = [
  { mode: 'circle', icon: '⭕', label: 'Circle' },
  { mode: 'timeline', icon: '📅', label: 'Timeline' },
  { mode: 'structure', icon: '🏗️', label: 'Structure' },
  { mode: 'material', icon: '📎', label: 'Material' },
];

export function ViewSwitcher() {
  const viewMode = useMindscapeStore((s) => s.viewMode);
  const setViewMode = useMindscapeStore((s) => s.setViewMode);

  return (
    <Panel position="top-left" className="!m-2">
      <div className="flex gap-1 bg-slate-800/90 rounded-lg shadow-lg border border-slate-600 p-1">
        {VIEW_OPTIONS.map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
