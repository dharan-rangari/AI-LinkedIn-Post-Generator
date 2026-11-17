import { FiAlertTriangle, FiX } from 'react-icons/fi'

/**
 * Inline error banner used to surface API failures, empty responses,
 * database errors and validation errors consistently across pages.
 */
function ErrorAlert({ message, onClose }) {
  if (!message) return null

  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 animate-fadeIn">
      <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
      <p className="text-sm flex-1">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="text-red-400 hover:text-red-600 transition-colors"
          aria-label="Dismiss error"
        >
          <FiX size={16} />
        </button>
      )}
    </div>
  )
}

export default ErrorAlert
