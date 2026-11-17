import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiZap,
  FiClock,
  FiBarChart2,
  FiFileText,
  FiCalendar,
  FiTag,
  FiGlobe,
  FiArrowRight,
} from 'react-icons/fi'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import PostHistoryCard from '../components/PostHistoryCard'
import { fetchAnalytics, fetchHistory } from '../api/endpoints'

function Home() {
  const [analytics, setAnalytics] = useState(null)
  const [recentPosts, setRecentPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const [analyticsData, historyData] = await Promise.all([
          fetchAnalytics(),
          fetchHistory(),
        ])
        if (!isMounted) return
        setAnalytics(analyticsData)
        setRecentPosts(historyData.slice(0, 3))
      } catch (err) {
        if (isMounted) setError(err.friendlyMessage || 'Failed to load dashboard data.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <Layout title="Home" subtitle="Your LinkedIn AI Post Assistant, at a glance">
      <div className="space-y-5">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Hero */}
        <section className="app-card p-6 sm:p-8 bg-gradient-to-br from-linkedin to-linkedin-dark text-white shadow-card">
          <h2 className="text-xl sm:text-2xl font-semibold mb-1">
            Create engaging LinkedIn posts, powered by AI
          </h2>
          <p className="text-sm text-white/80 mb-5 max-w-xl">
            Pick a topic, choose a tone and length, and let your RAG-backed
            assistant draft a ready-to-publish post in seconds.
          </p>
          <Link
            to="/generate"
            className="inline-flex items-center gap-2 bg-white text-linkedin font-semibold text-sm px-5 py-2.5
            rounded-xl hover:bg-gray-100 transition-all duration-200 shadow-card"
          >
            <FiZap size={16} /> Generate a Post <FiArrowRight size={14} />
          </Link>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-linkedin">
            <Spinner size={28} />
          </div>
        ) : (
          <>
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={FiFileText} label="Total Posts" value={analytics?.total_posts ?? 0} />
              <StatCard icon={FiCalendar} label="Posts Today" value={analytics?.posts_today ?? 0} />
              <StatCard icon={FiTag} label="Top Topic" value={analytics?.most_used_topic ?? 'N/A'} />
              <StatCard icon={FiGlobe} label="Top Language" value={analytics?.most_used_language ?? 'N/A'} />
            </div>

            {/* Quick links */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                to="/history"
                className="app-card p-5 flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-linkedin-light text-linkedin flex items-center justify-center">
                    <FiClock size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Post History</p>
                    <p className="text-xs text-gray-400">Search everything you've generated</p>
                  </div>
                </div>
                <FiArrowRight className="text-gray-300 group-hover:text-linkedin transition-colors" />
              </Link>

              <Link
                to="/analytics"
                className="app-card p-5 flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-linkedin-light text-linkedin flex items-center justify-center">
                    <FiBarChart2 size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Analytics</p>
                    <p className="text-xs text-gray-400">Topic and language breakdowns</p>
                  </div>
                </div>
                <FiArrowRight className="text-gray-300 group-hover:text-linkedin transition-colors" />
              </Link>
            </div>

            {/* Recent posts preview */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Recent Posts</h3>
                <Link to="/history" className="text-xs text-linkedin hover:underline">
                  View all
                </Link>
              </div>

              {recentPosts.length === 0 ? (
                <div className="app-card">
                  <EmptyState
                    icon={FiClock}
                    title="No posts generated yet"
                    description="Head to Generate Post to create your first one."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPosts.map((post) => (
                    <PostHistoryCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}

export default Home
