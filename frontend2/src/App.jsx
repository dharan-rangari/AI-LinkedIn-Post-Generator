import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GeneratePost from './pages/GeneratePost'
import History from './pages/History'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/generate" element={<GeneratePost />} />
      <Route path="/history" element={<History />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/settings" element={<Settings />} />
      {/* Fallback: redirect unknown paths back to Home */}
      <Route path="*" element={<Home />} />
    </Routes>
  )
}

export default App
