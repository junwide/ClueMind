// src/App.tsx
import { useState } from 'react'
import MainLayout from './components/Layout/MainLayout'
import Home from './pages/Home'
import Settings from './pages/Settings'
import RawInbox from './pages/RawInbox'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'inbox' | 'settings'>('home')

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />
      case 'inbox':
        return <RawInbox />
      case 'settings':
        return <Settings onNavigate={setCurrentPage} />
      default:
        return <Home />
    }
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </MainLayout>
  )
}

export default App
