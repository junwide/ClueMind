// src/components/Settings/BackupSettings.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../i18n';

interface DropInfo {
  id: string;
  preview: string;
  content_type: string;
}

interface FrameworkSummary {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  node_count: number;
  edge_count: number;
  created_from_drops: DropInfo[];
  created_at: string;
  updated_at: string;
}

interface DropItem {
  id: string;
  content: {
    type: string;
    text?: string;
    url?: string;
    title?: string;
    path?: string;
  };
  status: string;
  createdAt: string;
}

type Message = { type: 'success' | 'error'; text: string };

function getDropPreview(drop: DropItem): string {
  switch (drop.content?.type) {
    case 'text': return drop.content.text?.slice(0, 60) || '';
    case 'url': return drop.content.title || drop.content.url || '';
    case 'image': return drop.content.path?.split('/').pop() || 'Image';
    case 'file': return drop.content.path?.split('/').pop() || 'File';
    case 'voice': return drop.content.path?.split('/').pop() || 'Voice';
    default: return '';
  }
}

function getDropTypeIcon(type: string): string {
  switch (type) {
    case 'text': return '📝';
    case 'url': return '🔗';
    case 'image': return '🖼';
    case 'file': return '📄';
    case 'voice': return '🎤';
    default: return '📁';
  }
}

function getLifecycleStyle(lifecycle: string) {
  switch (lifecycle) {
    case 'confirmed': return 'bg-green-100 text-green-700';
    case 'building': return 'bg-blue-100 text-blue-700';
    case 'locked': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

export function BackupSettings() {
  const { t } = useTranslation();
  const [frameworks, setFrameworks] = useState<FrameworkSummary[]>([]);
  const [drops, setDrops] = useState<DropItem[]>([]);
  const [fwSelected, setFwSelected] = useState<Set<string>>(new Set());
  const [dropSelected, setDropSelected] = useState<Set<string>>(new Set());
  const [includeConfig, setIncludeConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fwList, dropList] = await Promise.all([
          invoke<FrameworkSummary[]>('list_framework_summaries'),
          invoke<DropItem[]>('list_drops'),
        ]);
        setFrameworks(fwList);
        setDrops(dropList);
      } catch (err) {
        console.error('Failed to load backup data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const showMessage = useCallback((msg: Message) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 6000);
  }, []);

  // Framework selection
  const toggleFw = useCallback((id: string) => {
    setFwSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAllFw = useCallback(() => setFwSelected(new Set(frameworks.map(f => f.id))), [frameworks]);
  const deselectAllFw = useCallback(() => setFwSelected(new Set()), []);

  // Drop selection
  const toggleDrop = useCallback((id: string) => {
    setDropSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAllDrops = useCallback(() => setDropSelected(new Set(drops.map(d => d.id))), [drops]);
  const deselectAllDrops = useCallback(() => setDropSelected(new Set()), []);

  // Custom export
  const handleExportCustom = useCallback(async () => {
    if (fwSelected.size === 0 && dropSelected.size === 0) return;
    setOperating(true);
    setMessage(null);
    try {
      const destPath = await save({
        defaultPath: `dropmind-export-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!destPath) { setOperating(false); return; }
      const result = await invoke<string>('export_custom_backup', {
        destPath,
        frameworkIds: Array.from(fwSelected),
        dropIds: Array.from(dropSelected),
        includeConfig,
      });
      showMessage({ type: 'success', text: result });
    } catch (err) {
      showMessage({ type: 'error', text: t('backup.exportFailed', { error: String(err) }) });
    } finally {
      setOperating(false);
    }
  }, [fwSelected, dropSelected, includeConfig, t, showMessage]);

  // Full export
  const handleExportFull = useCallback(async () => {
    setOperating(true);
    setMessage(null);
    try {
      const destPath = await save({
        defaultPath: `dropmind-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!destPath) { setOperating(false); return; }
      await invoke('export_full_backup', { destPath });
      showMessage({ type: 'success', text: t('backup.exportSuccess') });
    } catch (err) {
      showMessage({ type: 'error', text: t('backup.exportFailed', { error: String(err) }) });
    } finally {
      setOperating(false);
    }
  }, [t, showMessage]);

  // Import
  const handleImport = useCallback(async () => {
    if (!window.confirm(t('backup.importConfirm'))) return;
    setOperating(true);
    setMessage(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (!selected) { setOperating(false); return; }
      const sourcePath = typeof selected === 'string' ? selected : selected;
      const result = await invoke<string>('import_full_backup', { sourcePath });
      showMessage({ type: 'success', text: t('backup.importSuccess', { result }) });
      // Reload data after import
      const [fwList, dropList] = await Promise.all([
        invoke<FrameworkSummary[]>('list_framework_summaries'),
        invoke<DropItem[]>('list_drops'),
      ]);
      setFrameworks(fwList);
      setDrops(dropList);
      setFwSelected(new Set());
      setDropSelected(new Set());
    } catch (err) {
      showMessage({ type: 'error', text: t('backup.importFailed', { error: String(err) }) });
    } finally {
      setOperating(false);
    }
  }, [t, showMessage]);

  const hasSelection = fwSelected.size > 0 || dropSelected.size > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('backup.title')}</h2>
        <p className="text-gray-500 text-sm mt-1">{t('backup.description')}</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Framework selector */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">{t('backup.frameworkSection')} ({frameworks.length})</h3>
          {frameworks.length > 0 && (
            <div className="flex gap-2">
              <button onClick={selectAllFw} className="text-xs text-blue-600 hover:text-blue-700">{t('backup.selectAll')}</button>
              <span className="text-gray-300">|</span>
              <button onClick={deselectAllFw} className="text-xs text-gray-500 hover:text-gray-700">{t('backup.deselectAll')}</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-3 text-center">{t('backup.loading')}</div>
        ) : frameworks.length === 0 ? (
          <div className="text-sm text-gray-400 py-3 text-center">{t('backup.noFrameworks')}</div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {frameworks.map((fw) => (
              <label
                key={fw.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  fwSelected.has(fw.id) ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={fwSelected.has(fw.id)}
                  onChange={() => toggleFw(fw.id)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{fw.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getLifecycleStyle(fw.lifecycle)}`}>
                    {fw.lifecycle}
                  </span>
                  <span className="text-gray-400 text-xs">{fw.node_count}n {fw.edge_count}e {fw.created_from_drops.length}d</span>
                </div>
              </label>
            ))}
          </div>
        )}
        {fwSelected.size > 0 && (
          <div className="text-xs text-blue-600 mt-2">{t('backup.selectedCount', { count: String(fwSelected.size) })}</div>
        )}
      </div>

      {/* Drop selector */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">{t('backup.dropsSection')} ({drops.length})</h3>
          {drops.length > 0 && (
            <div className="flex gap-2">
              <button onClick={selectAllDrops} className="text-xs text-blue-600 hover:text-blue-700">{t('backup.selectAll')}</button>
              <span className="text-gray-300">|</span>
              <button onClick={deselectAllDrops} className="text-xs text-gray-500 hover:text-gray-700">{t('backup.deselectAll')}</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-3 text-center">{t('backup.loading')}</div>
        ) : drops.length === 0 ? (
          <div className="text-sm text-gray-400 py-3 text-center">{t('backup.noDrops')}</div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-auto">
            {drops.map((drop) => (
              <label
                key={drop.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                  dropSelected.has(drop.id) ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={dropSelected.has(drop.id)}
                  onChange={() => toggleDrop(drop.id)}
                  className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm">{getDropTypeIcon(drop.content?.type || '')}</span>
                  <span className="text-gray-700 truncate">{getDropPreview(drop)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    drop.status === 'raw' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-600'
                  }`}>
                    {drop.status}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
        {dropSelected.size > 0 && (
          <div className="text-xs text-blue-600 mt-2">{t('backup.selectedCount', { count: String(dropSelected.size) })}</div>
        )}
      </div>

      {/* Config option */}
      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
        <input
          type="checkbox"
          checked={includeConfig}
          onChange={(e) => setIncludeConfig(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <div>
          <span className="text-sm font-medium text-gray-900">{t('backup.includeConfig')}</span>
          <p className="text-xs text-gray-500">{t('backup.configHint')}</p>
        </div>
      </label>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExportCustom}
          disabled={operating || !hasSelection}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {operating ? t('backup.exporting') : t('backup.exportSelected')}
        </button>
        <button
          onClick={handleExportFull}
          disabled={operating}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:opacity-50"
        >
          {operating ? t('backup.exporting') : t('backup.exportFull')}
        </button>
        <button
          onClick={handleImport}
          disabled={operating}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:opacity-50"
        >
          {operating ? t('backup.importing') : t('backup.importFull')}
        </button>
      </div>
      <p className="text-xs text-amber-600">{t('backup.importWarning')}</p>
    </div>
  );
}
