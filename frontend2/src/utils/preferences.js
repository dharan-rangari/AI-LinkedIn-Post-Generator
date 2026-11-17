const STORAGE_KEY = 'postgen:preferences'

const DEFAULT_PREFERENCES = {
  defaultLength: 'Medium',
  defaultLanguage: 'English',
}

/**
 * Read saved user preferences (default length/language for the
 * Generate Post form). Falls back to sensible defaults if nothing
 * has been saved yet or storage is unavailable.
 */
export function getPreferences() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

/**
 * Persist user preferences to localStorage.
 */
export function savePreferences(preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    return true
  } catch {
    return false
  }
}

export { DEFAULT_PREFERENCES }
