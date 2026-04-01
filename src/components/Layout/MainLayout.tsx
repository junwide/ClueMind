// src/components/Layout/MainLayout.tsx
import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { PageType } from '../../App'

interface MainLayoutProps {
  children: ReactNode
  currentPage: PageType
  onNavigate: (page: PageType) => void
}

export default function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
