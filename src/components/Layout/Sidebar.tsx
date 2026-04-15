// src/components/Layout/Sidebar.tsx
import { useState, useEffect } from 'react'
import { PageType } from '../../App'
import { useTranslation } from '../../i18n'
import { useSyncStore } from '../../stores/syncStore'

interface SidebarProps {
  currentPage: PageType
  onNavigate: (page: PageType) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { id: 'home' as PageType, label: 'Home', icon: '🏠' },
    { id: 'inbox' as PageType, label: 'Inbox', icon: '📥' },
    { id: 'canvas' as PageType, label: 'DeepMind', icon: '🎨' },
    { id: 'mindscape' as PageType, label: 'Mindscape', icon: '🌌' },
    { id: 'settings' as PageType, label: 'Settings', icon: '⚙️' },
  ]

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
      <div className={`${collapsed ? 'p-3' : 'p-6'} border-b border-gray-200 flex items-center justify-between`}>
        {!collapsed && <h1 className="text-xl font-bold text-gray-900">ClueMind</h1>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  currentPage === item.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <SyncIndicator collapsed={collapsed} />
    </aside>
  )
}

function SyncIndicator({ collapsed }: { collapsed: boolean }) {
  const { status, syncing, error, fetchStatus } = useSyncStore()

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const dotColor = syncing
    ? 'bg-yellow-400 animate-pulse'
    : error
    ? 'bg-red-400'
    : status?.lastSyncAt
    ? 'bg-green-400'
    : 'bg-gray-300'

  const label = syncing
    ? 'Syncing...'
    : error
    ? 'Sync Error'
    : status?.lastSyncAt
    ? `Synced ${new Date(status.lastSyncAt).toLocaleTimeString()}`
    : 'Not configured'

  return (
    <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      {!collapsed && <span className="truncate">{label}</span>}
    </div>
  )
}
