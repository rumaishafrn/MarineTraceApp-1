import React, { useState } from 'react'
import './App.css'
import MainPage        from './pages/MainPage'
import TrackingPage    from './pages/TrackingPage'
import DetectionPage   from './pages/DetectionPage'
import SpatialMapPage  from './pages/SpatialMapPage'

function App() {
  const [currentPage, setCurrentPage] = useState('main')

  const renderPage = () => {
    switch (currentPage) {
      case 'main':
        return <MainPage onNavigate={setCurrentPage} />
      case 'tracking':
        return <TrackingPage onBack={() => setCurrentPage('main')} />
      case 'detection':
        return <DetectionPage onBack={() => setCurrentPage('main')} />
      case 'spatial-map':
        return <SpatialMapPage onBack={() => setCurrentPage('main')} />
      default:
        return <MainPage onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="app">
      {renderPage()}
    </div>
  )
}

export default App
