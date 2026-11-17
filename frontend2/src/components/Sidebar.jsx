import { NavLink } from 'react-router-dom'
import {
  FiHome,
  FiEdit3,
  FiClock,
  FiBarChart2,
  FiSettings,
  FiLinkedin,
} from 'react-icons/fi'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: FiHome },
  { to: '/generate', label: 'Generate Post', icon: FiEdit3 },
  { to: '/history', label: 'History', icon: FiClock },
  { to: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  { to: '/settings', label: 'Settings', icon: FiSettings },
]

/**
 * Fixed left sidebar with the app logo and primary navigation.
 * Collapses to an off-canvas drawer on small screens via `isOpen`/`onClose`.
 */
function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 bg-white border-r border-gray-100
        flex flex-col transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-100">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-linkedin text-white">
            <FiLinkedin size={20} />
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-gray-900 text-sm">PostGen AI</p>
            <p className="text-xs text-gray-400">LinkedIn Assistant</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? 'bg-linkedin-light text-linkedin'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-linkedin'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-400">
          Powered by Groq &amp; ChromaDB
        </div>
      </aside>
    </>
  )
}

export default Sidebar
