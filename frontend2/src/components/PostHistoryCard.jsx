import { useState } from 'react'
import { FiChevronDown, FiChevronUp, FiTag, FiGlobe, FiAlignLeft } from 'react-icons/fi'

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Expandable card showing one saved post: topic/language/length badges,
 * created date, and the full text on expand.
 */
function PostHistoryCard({ post, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="app-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/70 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{post.topic}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <FiGlobe size={12} /> {post.language}
            </span>
            <span className="flex items-center gap-1">
              <FiAlignLeft size={12} /> {post.length}
            </span>
            <span className="hidden sm:inline">{formatDate(post.created_at)}</span>
          </div>
        </div>
        {open ? <FiChevronUp className="shrink-0 text-gray-400" /> : <FiChevronDown className="shrink-0 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 animate-fadeIn">
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-2 sm:hidden">
            <FiTag size={12} /> {formatDate(post.created_at)}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {post.post}
          </p>
        </div>
      )}
    </div>
  )
}

export default PostHistoryCard
