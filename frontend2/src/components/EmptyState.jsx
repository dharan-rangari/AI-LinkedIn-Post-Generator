/**
 * Friendly empty state used when a list (history, recent posts, topics)
 * has nothing to show yet.
 */
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-gray-400">
      {Icon && <Icon size={28} className="mb-3 text-gray-300" />}
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {description && <p className="text-xs mt-1 max-w-xs">{description}</p>}
    </div>
  )
}

export default EmptyState
