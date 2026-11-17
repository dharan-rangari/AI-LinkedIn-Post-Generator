import { useEffect, useState } from 'react'
import { FiCheckCircle, FiXCircle, FiServer, FiSave, FiSettings } from 'react-icons/fi'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import { checkHealth } from '../api/endpoints'
import { API_BASE_URL } from '../api/client'
import { getPreferences, savePreferences } from '../utils/preferences'

const LENGTH_OPTIONS = ['Short', 'Medium', 'Long']
const LANGUAGE_OPTIONS = ['English', 'Hinglish']

function Settings() {
  const [status, setStatus] = useState('checking') // checking | online | offline
  const [preferences, setPreferences] = useState(getPreferences())
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let isMounted = true

    const ping = async () => {
      try {
        await checkHealth()
        if (isMounted) setStatus('online')
      } catch {
        if (isMounted) setStatus('offline')
      }
    }

    ping()
    return () => {
      isMounted = false
    }
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    savePreferences(preferences)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Layout title="Settings" subtitle="Connection status and default preferences">
      <div className="max-w-2xl space-y-4">
        {/* Connection status */}
        <section className="app-card p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiServer className="text-linkedin" /> Backend Connection
          </h3>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-sm text-gray-700">API base URL</p>
              <p className="text-xs text-gray-400 mt-0.5 break-all">{API_BASE_URL}</p>
            </div>

            {status === 'checking' && (
              <span className="flex items-center gap-2 text-xs text-gray-400">
                <Spinner size={14} /> Checking...
              </span>
            )}
            {status === 'online' && (
              <span className="flex items-center gap-2 text-xs font-medium text-green-600">
                <FiCheckCircle size={16} /> Connected
              </span>
            )}
            {status === 'offline' && (
              <span className="flex items-center gap-2 text-xs font-medium text-red-500">
                <FiXCircle size={16} /> Unreachable
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Set <code className="bg-gray-100 px-1.5 py-0.5 rounded">VITE_API_BASE_URL</code> in{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">frontend/.env</code> to point this
            app at a different backend instance, then restart the dev server.
          </p>
        </section>

        {/* Default generation preferences */}
        <form onSubmit={handleSave} className="app-card p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FiSettings className="text-linkedin" /> Default Generation Preferences
          </h3>
          <p className="text-xs text-gray-400">
            These defaults are pre-selected next time you open Generate Post.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Default Length
              </label>
              <select
                value={preferences.defaultLength}
                onChange={(e) =>
                  setPreferences((prev) => ({ ...prev, defaultLength: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all"
              >
                {LENGTH_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Default Language
              </label>
              <select
                value={preferences.defaultLanguage}
                onChange={(e) =>
                  setPreferences((prev) => ({ ...prev, defaultLanguage: e.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 bg-linkedin text-white text-sm font-medium px-5 py-2.5
            rounded-xl hover:bg-linkedin-dark transition-all duration-200 shadow-card"
          >
            <FiSave size={16} /> {saved ? 'Saved!' : 'Save Preferences'}
          </button>
        </form>
      </div>
    </Layout>
  )
}

export default Settings
