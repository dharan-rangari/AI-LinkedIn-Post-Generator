import { useEffect, useState } from 'react'
import { FiSearch, FiClock } from 'react-icons/fi'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import PostHistoryCard from '../components/PostHistoryCard'
import { fetchHistory } from '../api/endpoints'

function History() {
  const [posts, setPosts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadHistory = async (term) => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchHistory(term)
      setPosts(data)
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to load post history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Debounce search input before hitting the API
  useEffect(() => {
    const handle = setTimeout(() => {
      loadHistory(search)
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <Layout title="Post History" subtitle="Search and review previously generated posts">
      <div className="max-w-3xl mx-auto space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by topic, language or content..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm
            focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all shadow-card"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-linkedin">
            <Spinner size={28} />
          </div>
        ) : posts.length === 0 ? (
          <div className="app-card">
            <EmptyState
              icon={FiClock}
              title={search ? 'No matching history found' : 'No posts generated yet'}
              description={
                search
                  ? 'Try a different search term.'
                  : 'Generate your first post to see it appear here.'
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostHistoryCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default History
