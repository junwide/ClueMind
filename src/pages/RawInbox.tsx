import { useState, useCallback, useEffect } from 'react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { useDropStore } from '../stores/dropStore'
import { Drop, DropContent } from '../types/drop'
import { useTranslation } from '../i18n'
import {
  groupByType, groupByDate, getCategoryLabel, getTypeLabel, getTypeColor,
  getPreview, formatDateLabel, formatTime,
  type DropCategory,
} from '../utils/dropHelpers'

function getEditableText(content: DropContent): string {
  if (content.type === 'text') return content.text || ''
  if (content.type === 'url') return content.url || ''
  return ''
}

function updateContentText(drop: Drop, newText: string): Drop {
  if (drop.content.type === 'text') {
    return { ...drop, content: { ...drop.content, text: newText } }
  }
  if (drop.content.type === 'url') {
    return { ...drop, content: { ...drop.content, url: newText } }
  }
  return drop
}

type TabType = 'raw' | 'used'

const CATEGORY_ORDER: DropCategory[] = ['text', 'url', 'other']

export default function RawInbox() {
  const { t } = useTranslation()
  const { drops, loading, error, deleteDrop, updateDrop } = useDropStore()
  const [activeTab, setActiveTab] = useState<TabType>('raw')
  const [filteredDrops, setFilteredDrops] = useState<Drop[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  // Load drops filtered by status when tab changes
  useEffect(() => {
    const loadFiltered = async () => {
      try {
        const result = await invoke<Drop[]>('list_drops_by_status', {
          status: activeTab === 'raw' ? 'raw' : 'processed',
        })
        setFilteredDrops(result)
      } catch (err) {
        console.error('Failed to load drops by status:', err)
        if (activeTab === 'raw') {
          setFilteredDrops(drops.filter(d => d.status === 'raw'))
        } else {
          setFilteredDrops(drops.filter(d => d.status === 'processed'))
        }
      }
    }
    loadFiltered()
  }, [activeTab, drops])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(t('inbox.deleteConfirm'))) return
    try {
      await deleteDrop(id)
    } catch (err) {
      console.error('Failed to delete drop:', err)
    }
  }, [deleteDrop])

  const startEdit = useCallback((drop: Drop) => {
    setEditingId(drop.id)
    setEditText(getEditableText(drop.content))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText('')
  }, [])

  const saveEdit = useCallback(async (drop: Drop) => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      const updated = updateContentText(drop, editText.trim())
      await updateDrop(updated)
      setEditingId(null)
      setEditText('')
    } catch (err) {
      console.error('Failed to update drop:', err)
    } finally {
      setSaving(false)
    }
  }, [editText, updateDrop])

  // Group filtered drops by type, then by date
  const grouped = groupByType(filteredDrops)

  const renderDropCard = (drop: Drop) => {
    const isEditing = editingId === drop.id
    const canEdit = drop.content?.type === 'text' || drop.content?.type === 'url'
    const hasRelatedFrameworks = (drop.metadata?.relatedFrameworkIds?.length ?? 0) > 0

    // Multimodal content indicators
    const contentIcon = (() => {
      switch (drop.content?.type) {
        case 'image': return '\u{1F5BC}';
        case 'file': return '\u{1F4C4}';
        case 'voice': return '\u{1F3A4}';
        default: return null;
      }
    })();

    return (
      <div
        key={drop.id}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
      >
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={cancelEdit} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg" disabled={saving}>{t('inbox.cancel')}</button>
              <button onClick={() => saveEdit(drop)} disabled={saving || !editText.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? t('inbox.saving') : t('inbox.save')}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Multimodal content preview */}
              {drop.content?.type === 'image' && (() => {
                const imgSrc = drop.content.path ? convertFileSrc(drop.content.path) : null;
                return (
                  <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                    {imgSrc && (
                      <img
                        src={imgSrc}
                        alt="drop content"
                        className="max-h-32 max-w-xs rounded object-contain mb-2"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-xl">{contentIcon}</span>
                      <div>
                        <p className="font-medium">{drop.content.path?.split('/').pop() || 'Image'}</p>
                        {drop.content.ocrText && <p className="mt-1 text-gray-600 truncate max-w-xs">{drop.content.ocrText}</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {drop.content?.type === 'file' && (
                <div className="mb-2 p-2 bg-gray-50 rounded-lg inline-flex items-center gap-2">
                  <span className="text-xl">{contentIcon}</span>
                  <div className="text-xs text-gray-500">
                    <p className="font-medium">{drop.content.path?.split('/').pop() || 'File'}</p>
                    {drop.content.fileType && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-medium">
                        {drop.content.fileType.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {drop.content?.type === 'voice' && (() => {
                const audioSrc = drop.content.path ? convertFileSrc(drop.content.path) : null;
                return (
                  <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="text-xl">{contentIcon}</span>
                      <p className="font-medium">{drop.content.path?.split('/').pop() || 'Voice'}</p>
                    </div>
                    {audioSrc && (
                      <audio controls className="w-full h-8" preload="metadata">
                        <source src={audioSrc} />
                      </audio>
                    )}
                    {drop.content.transcription && (
                      <p className="mt-1 text-xs text-gray-600 truncate max-w-xs">{drop.content.transcription}</p>
                    )}
                  </div>
                );
              })()}
              {/* Text/URL preview */}
              {(drop.content?.type === 'text' || drop.content?.type === 'url') && (
                <p className="text-gray-800 break-all">{getPreview(drop.content)}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className={`px-2 py-0.5 rounded ${getTypeColor(drop.content?.type || '')}`}>{getTypeLabel(drop.content?.type || '')}</span>
                <span>{formatTime(drop.createdAt)}</span>
                {drop.status === 'processed' && <span className="px-2 py-0.5 rounded bg-green-50 text-green-600">{t('inbox.dropUsed')}</span>}
              </div>
              {hasRelatedFrameworks && (
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-xs text-gray-400">{t('inbox.relatedFrameworks')}</span>
                  {drop.metadata.relatedFrameworkIds.map((fwId) => (
                    <span key={fwId} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">{fwId.slice(0, 8)}...</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {canEdit && (
                <button onClick={() => startEdit(drop)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title={t('inbox.editTooltip')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              )}
              <button onClick={(e) => handleDelete(drop.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title={t('inbox.deleteTooltip')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderCategoryGroup = (cat: DropCategory, dropsInCat: Drop[]) => {
    if (dropsInCat.length === 0) return null

    // Sort by createdAt descending
    const sorted = [...dropsInCat].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const byDate = groupByDate(sorted)

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">{getCategoryLabel(cat)}</h3>
          <span className="text-xs text-gray-400">({dropsInCat.length})</span>
        </div>
        {Array.from(byDate.entries()).map(([date, dayDrops]) => (
          <div key={date} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDateLabel(date + 'T00:00:00Z')}</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="space-y-2">
              {dayDrops.map(drop => renderDropCard(drop))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button onClick={() => setActiveTab('raw')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'raw' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Raw</button>
          <button onClick={() => setActiveTab('used')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'used' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Used</button>
        </div>
      </div>
      <p className="text-gray-600 mb-8">
        {activeTab === 'raw' ? t('inbox.description.raw') : t('inbox.description.used')}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{t('inbox.loadFailed', { error })}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : filteredDrops.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">
            {activeTab === 'raw'
              ? t('inbox.emptyState.raw')
              : t('inbox.emptyState.used')
            }
          </p>
        </div>
      ) : (
        <div>
          {CATEGORY_ORDER.map(cat => <div key={cat}>{renderCategoryGroup(cat, grouped[cat])}</div>)}
        </div>
      )}
    </div>
  )
}
