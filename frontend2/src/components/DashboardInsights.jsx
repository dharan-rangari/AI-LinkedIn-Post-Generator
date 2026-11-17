import { useEffect, useState } from 'react'
import { FiTrendingUp, FiClock, FiTag, FiBarChart2 } from 'react-icons/fi'
import Spinner from './Spinner'
import EmptyState from './EmptyState'
import { fetchAnalytics, fetchHistory } from '../api/endpoints'

/**
 * Right-sidebar widgets shared by Home and Generate Post pages:
 * quick statistics, recent posts, and the most popular topics
 * (derived from the topic distribution analytics).
 */
function DashboardInsights() {
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
        setRecentPosts(historyData.slice(0, 5))
      } catch (err) {
        if (isMounted) setError(err.friendlyMessage || 'Failed to load insights.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const popularTopics = [...(analytics?.topic_distribution || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  if (loading) {
    return (
      <div className="app-card p-6 flex items-center justify-center text-linkedin">
        <Spinner size={22} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-card p-4 text-sm text-red-600">{error}</div>
    )
  }

  return (
    <>
      {/* Quick Statistics */}
      <div className="app-card p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FiBarChart2 className="text-linkedin" /> Statistics
        </h4>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-lg font-semibold text-gray-900">{analytics?.total_posts ?? 0}</p>
            <p className="text-xs text-gray-400">Total Posts</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-lg font-semibold text-gray-900">{analytics?.posts_today ?? 0}</p>
            <p className="text-xs text-gray-400">Today</p>
          </div>
        </div>
      </div>

      {/* Popular Topics */}
      <div className="app-card p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FiTrendingUp className="text-linkedin" /> Popular Topics
        </h4>
        {popularTopics.length === 0 ? (
          <EmptyState icon={FiTag} title="No topics yet" />
        ) : (
          <ul className="space-y-2">
            {popularTopics.map((t) => (
              <li key={t.topic} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate flex items-center gap-2">
                  <FiTag className="text-gray-300 shrink-0" size={14} />
                  {t.topic}
                </span>
                <span className="text-xs font-semibold text-linkedin bg-linkedin-light rounded-full px-2 py-0.5 shrink-0">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent Posts */}
      <div className="app-card p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FiClock className="text-linkedin" /> Recent Posts
        </h4>
        {recentPosts.length === 0 ? (
          <EmptyState icon={FiClock} title="No posts yet" />
        ) : (
          <ul className="space-y-3">
            {recentPosts.map((p) => (
              <li key={p.id} className="text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                <p className="font-medium text-gray-800 truncate">{p.topic}</p>
                <p className="text-xs text-gray-400 truncate">{p.post}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export default DashboardInsights
