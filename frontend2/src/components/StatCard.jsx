/**
 * Compact metric card - "Total Posts", "Posts Today", etc.
 */
function StatCard({ icon: Icon, label, value, accent = 'text-linkedin' }) {
  return (
    <div className="app-card p-4 flex items-center gap-3">
      {Icon && (
        <div className={`w-10 h-10 rounded-xl bg-linkedin-light flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className="text-lg font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

export default StatCard
