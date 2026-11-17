import { FiMenu } from 'react-icons/fi'

/**
 * Top navigation bar: hamburger toggle (mobile), project title, and a
 * user avatar placeholder on the right, per the design brief.
 */
function Topbar({ title, subtitle, onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 h-16 px-4 sm:px-6 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Toggle navigation"
        >
          <FiMenu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-gray-400 truncate hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:inline text-sm text-gray-500">Welcome back</span>
        <div className="w-9 h-9 rounded-full bg-linkedin text-white flex items-center justify-center text-sm font-semibold shadow-card">
          U
        </div>
      </div>
    </header>
  )
}

export default Topbar
