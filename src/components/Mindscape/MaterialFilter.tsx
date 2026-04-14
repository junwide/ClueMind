// src/components/Mindscape/MaterialFilter.tsx
import { Panel } from '@xyflow/react';
import { useMindscapeStore } from '../../stores/mindscapeStore';
import type { DropType } from '../../types/drop';

const FILTER_OPTIONS: { type: DropType; icon: string; label: string }[] = [
  { type: 'text', icon: '📝', label: 'Text' },
  { type: 'url', icon: '🔗', label: 'URL' },
  { type: 'image', icon: '🖼️', label: 'Image' },
  { type: 'file', icon: '📁', label: 'File' },
  { type: 'voice', icon: '🎤', label: 'Voice' },
];

export function MaterialFilter() {
  const filter = useMindscapeStore((s) => s.materialFilter);
  const setMaterialFilter = useMindscapeStore((s) => s.setMaterialFilter);

  const toggle = (type: DropType) => {
    if (filter.includes(type)) {
      setMaterialFilter(filter.filter((t) => t !== type));
    } else {
      setMaterialFilter([...filter, type]);
    }
  };

  return (
    <Panel position="top-right" className="!m-2">
      <div className="bg-slate-800/90 rounded-lg shadow-lg border border-slate-600 p-2 space-y-1">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider px-1">Filter</div>
        {FILTER_OPTIONS.map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => toggle(type)}
            className={`flex items-center gap-2 w-full text-xs px-2 py-1 rounded transition-colors ${
              filter.includes(type)
                ? 'text-slate-200 bg-slate-700'
                : 'text-slate-500 hover:text-slate-300'
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
