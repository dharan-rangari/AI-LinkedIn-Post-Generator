import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { FiFileText, FiTag, FiGlobe, FiCalendar, FiBarChart2 } from 'react-icons/fi'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { fetchAnalytics } from '../api/endpoints'

const CHART_COLOR = '#0A66C2'

function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        const result = await fetchAnalytics()
        if (isMounted) setData(result)
      } catch (err) {
        if (isMounted) setError(err.friendlyMessage || 'Failed to load analytics.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const topicChartData = (data?.topic_distribution || []).map((d) => ({
    name: d.topic,
    count: d.count,
  }))

  const languageChartData = (data?.language_distribution || []).map((d) => ({
    name: d.language,
    count: d.count,
  }))

  return (
    <Layout title="Analytics" subtitle="Track how your generated posts are performing">
      <div className="max-w-4xl mx-auto space-y-5">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-linkedin">
            <Spinner size={28} />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={FiFileText} label="Total Posts" value={data.total_posts} />
              <StatCard icon={FiCalendar} label="Posts Today" value={data.posts_today} />
              <StatCard icon={FiTag} label="Most Used Topic" value={data.most_used_topic} />
              <StatCard icon={FiGlobe} label="Most Used Language" value={data.most_used_language} />
            </div>

            {/* Topic distribution */}
            <section className="app-card p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiBarChart2 className="text-linkedin" /> Topic Distribution
              </h3>
              {topicChartData.length === 0 ? (
                <EmptyState title="No data yet" description="Generate posts to populate this chart." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip cursor={{ fill: '#f3f2ef' }} />
                      <Bar dataKey="count" fill={CHART_COLOR} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Language distribution */}
            <section className="app-card p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiGlobe className="text-linkedin" /> Language Distribution
              </h3>
              {languageChartData.length === 0 ? (
                <EmptyState title="No data yet" description="Generate posts to populate this chart." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={languageChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip cursor={{ fill: '#f3f2ef' }} />
                      <Bar dataKey="count" fill="#57A0E8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  )
}

export default Analytics
