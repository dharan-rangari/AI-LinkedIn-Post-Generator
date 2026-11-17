import api from './client'

/**
 * Ping the backend health endpoint. Used by the Settings page to show
 * a live connection status.
 */
export const checkHealth = async () => {
  const response = await api.get('/health')
  return response.data
}

/**
 * Fetch available topics/tags plus the valid length/language options.
 * Backed by FewShotPosts.get_tags() on the backend.
 */
export const fetchTopics = async () => {
  const response = await api.get('/topics')
  return response.data
}

/**
 * Generate a new LinkedIn post.
 * Backed by generate_post() in post_generator.py.
 * @param {{ topic?: string, custom_topic?: string, length: string, language: string }} payload
 * Pass `topic` to use RAG examples, or `custom_topic` to bypass RAG.
 */
export const generatePost = async (payload) => {
  const response = await api.post('/generate-post', payload)
  return response.data
}

/**
 * Fetch post history, optionally filtered by a search term.
 * Backed by PostDatabase.get_all_posts().
 * @param {string} [search]
 */
export const fetchHistory = async (search) => {
  const response = await api.get('/history', {
    params: search ? { search } : {},
  })
  return response.data
}

/**
 * Fetch analytics: totals, most used topic/language, today's count,
 * and topic/language distributions.
 * Backed by the analytics functions in database.py.
 */
export const fetchAnalytics = async () => {
  // Use /stats endpoint to prevent ad blockers (e.g. uBlock Origin) from blocking the request
  const response = await api.get('/stats')
  return response.data
}

/**
 * Generate an image matching a LinkedIn post.
 * Backed by /api/generate-image.
 * @param {{ post: string, topic?: string }} payload
 */
export const generateImage = async (payload) => {
  const response = await api.post('/generate-image', payload)
  return response.data
}

