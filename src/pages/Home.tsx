import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../i18n';

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

interface HomeProps {
  onOpenFramework?: (id: string) => void;
  onStartNewReview?: () => void;
}

export default function Home({ onOpenFramework, onStartNewReview }: HomeProps) {
  const { t } = useTranslation();
  const [frameworks, setFrameworks] = useState<FrameworkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFrameworks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const summaries = await invoke<FrameworkSummary[]>('list_framework_summaries');
      setFrameworks(summaries);
    } catch (err) {
      console.error('Failed to load frameworks:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('home.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      await invoke('delete_framework', { id });
      setFrameworks(prev => prev.filter(fw => fw.id !== id));
    } catch (err) {
      console.error('Failed to delete framework:', err);
      alert(t('home.deleteFailed', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setDeletingId(null);
    }
  }, []);

  useEffect(() => {
    loadFrameworks();
  }, [loadFrameworks]);

  const getLifecycleLabel = (lifecycle: string) => {
    switch (lifecycle) {
      case 'confirmed': return t('home.lifecycle.confirmed');
      case 'building': return t('home.lifecycle.building');
      case 'locked': return t('home.lifecycle.locked');
      default: return t('home.lifecycle.draft');
    }
  };

  const getLifecycleStyle = (lifecycle: string) => {
    switch (lifecycle) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'building': return 'bg-blue-100 text-blue-700';
      case 'locked': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="p-4 md:p-8 h-full overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ClueMind</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('home.subtitle')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onStartNewReview}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            {t('home.startNewReview')}
          </button>
          <div className="text-sm text-gray-400">
            {t('home.frameworkCount', { count: String(frameworks.length) })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('home.loading')}</div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-2">{t('home.loadFailedTitle')}</p>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={loadFrameworks}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            {t('home.retry')}
          </button>
        </div>
      ) : frameworks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{t('home.emptyState')}</p>
          <p className="text-sm text-gray-400">
            {t('home.emptyStateHint')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {frameworks.map((fw) => (
            <div
              key={fw.id}
              className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group relative"
              onClick={() => onOpenFramework?.(fw.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 truncate flex-1 mr-2">
                  {fw.title}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded ${getLifecycleStyle(fw.lifecycle)}`}>
                    {getLifecycleLabel(fw.lifecycle)}
                  </span>
                  <button
                    onClick={(e) => handleDelete(fw.id, e)}
                    disabled={deletingId === fw.id}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    title={t('home.deleteTooltip')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {fw.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{fw.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{t('home.nodeCount', { count: String(fw.node_count) })}</span>
                <span>{t('home.edgeCount', { count: String(fw.edge_count) })}</span>
                {fw.created_from_drops.length > 0 && (
                  <span>{t('home.fromDropsCount', { count: String(fw.created_from_drops.length) })}</span>
                )}
              </div>

              {/* Associated drops */}
              {fw.created_from_drops.length > 0 && (
                <div className="mt-2 space-y-1">
                  {fw.created_from_drops.slice(0, 3).map((drop) => (
                    <div key={drop.id} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        drop.content_type === 'text' ? 'bg-blue-50 text-blue-600' :
                        drop.content_type === 'url' ? 'bg-green-50 text-green-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {drop.content_type === 'text' ? t('home.textType') : drop.content_type === 'url' ? t('home.urlLinkType') : drop.content_type}
                      </span>
                      <span className="truncate">{drop.preview}</span>
                    </div>
                  ))}
                  {fw.created_from_drops.length > 3 && (
                    <span className="text-xs text-gray-300">{t('home.moreCount', { count: String(fw.created_from_drops.length - 3) })}</span>
                  )}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-400">
                {fw.updated_at
                  ? t('home.updatedAt', { date: new Date(fw.updated_at).toLocaleDateString() })
                  : ''
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
