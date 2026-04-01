import { useState, useCallback } from 'react'
import MainLayout from './components/Layout/MainLayout'
import Home from './pages/Home'
import Settings from './pages/Settings'
import RawInbox from './pages/RawInbox'
import CanvasPage from './pages/CanvasPage'
import { useAppEvents } from './hooks/useAppEvents'
import { QuickDropInput } from './components/Drop/QuickDropInput'
import { I18nProvider } from './i18n'

export type PageType = 'home' | 'inbox' | 'canvas' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [showQuickDrop, setShowQuickDrop] = useState(false)
  const [pendingFrameworkId, setPendingFrameworkId] = useState<string | null>(null)
  const [startNewFromHome, setStartNewFromHome] = useState(false)

  const handleQuickDropTriggered = useCallback(() => {
    console.log('[App] Quick drop triggered event received!')
    setShowQuickDrop(true)
  }, [])

  console.log('[App] Current state - showQuickDrop:', showQuickDrop)

  // Listen for Tauri events (works on X11/Windows/macOS)
  useAppEvents({
    'quick-drop-triggered': handleQuickDropTriggered,
  })

  // Fallback keyboard listener for Wayland (works when window is focused)
  useState(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'd') {
        console.log('[App] Keyboard shortcut detected (fallback for Wayland)')
        setShowQuickDrop(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const handleOpenFramework = useCallback((id: string) => {
    setPendingFrameworkId(id)
    setCurrentPage('canvas')
  }, [])

  const handleFrameworkLoaded = useCallback(() => {
    setPendingFrameworkId(null)
  }, [])

  const handleStartNewReview = useCallback(() => {
    setStartNewFromHome(true)
    setCurrentPage('canvas')
  }, [])

  const handleNewReviewConsumed = useCallback(() => {
    setStartNewFromHome(false)
  }, [])

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onOpenFramework={handleOpenFramework} onStartNewReview={handleStartNewReview} />
      case 'inbox':
        return <RawInbox />
      case 'canvas':
        return <CanvasPage loadFrameworkId={pendingFrameworkId} onFrameworkLoaded={handleFrameworkLoaded} startNewReview={startNewFromHome} onNewReviewConsumed={handleNewReviewConsumed} />
      case 'settings':
        return <Settings onNavigate={setCurrentPage} />
      default:
        return <Home onOpenFramework={handleOpenFramework} onStartNewReview={handleStartNewReview} />
    }
  }

  return (
    <I18nProvider>
    <>
      <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
        {renderPage()}
      </MainLayout>
      <QuickDropInput
        isOpen={showQuickDrop}
        onClose={() => setShowQuickDrop(false)}
      />
    </>
    </I18nProvider>
  )
}

export default App
