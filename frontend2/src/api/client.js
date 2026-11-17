import axios from 'axios'

// Single source of truth for the backend URL. Never hardcode URLs
// elsewhere in the app - import `api` from this file instead.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // LLM generation can take a while
  headers: {
    'Content-Type': 'application/json',
  },
})

// Normalize errors into a friendly, predictable shape so every page
// can handle failures the same way.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Something went wrong. Please try again.'

    if (error.response) {
      // Server responded with an error status
      const detail = error.response.data?.detail
      if (Array.isArray(detail)) {
        message = detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
      } else if (typeof detail === 'string') {
        message = detail
      } else if (error.response.status === 404) {
        message = 'The requested resource was not found.'
      } else if (error.response.status >= 500) {
        message = 'The server ran into a problem. Please try again shortly.'
      }
    } else if (error.code === 'ERR_BLOCKED_BY_CLIENT' || error.message?.includes('BLOCKED_BY_CLIENT')) {
      message = 'Request blocked by a browser extension (e.g. ad blocker). Please disable it for this site.'
    } else if (error.request) {
      // Request was made but no response received
      message = 'Could not reach the backend. Make sure the API server is running.'
    } else if (error.message) {
      message = error.message
    }

    return Promise.reject({ ...error, friendlyMessage: message })
  }
)

export default api
export { API_BASE_URL }
