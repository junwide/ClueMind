// src/components/Layout/Sidebar.tsx
interface SidebarProps {
  currentPage: 'home' | 'inbox' | 'settings'
  onNavigate: (page: 'home' | 'inbox' | 'settings') => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const navItems = [
    { id: 'home' as const, label: '首页', icon: '🏠' },
    { id: 'inbox' as const, label: 'Raw Inbox', icon: '📥' },
    { id: 'settings' as const, label: '设置', icon: '⚙️' },
  ]

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">ReviewYourMind</h1>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
