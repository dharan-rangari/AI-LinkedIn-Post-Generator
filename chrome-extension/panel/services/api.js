/**
 * api.js
 * -------
 * Thin wrapper around chrome.runtime.sendMessage so content.js never
 * calls the messaging API directly and never hardcodes a message
 * "type" string more than once. All actual network calls happen in
 * background.js - this file just promisifies the request/response.
 *
 * Classic script (no import/export) for the same reason as dom.js:
 * content scripts listed in manifest.json are not loaded as ES modules.
 * Exposed as `window.LiAiApi`.
 */
(function () {
  /**
   * @param {string} type - message type handled in background.js
   * @param {Object} [payload]
   * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
   */
  function sendMessage(type, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: 'No response from background worker.' });
      });
    });
  }

  const LiAiApi = {
    ping: () => sendMessage('PING'),
    fetchTopics: () => sendMessage('FETCH_TOPICS'),
    generatePost: (payload) =>
      sendMessage('GENERATE_POST', payload),
    fetchHistory: (search) => sendMessage('FETCH_HISTORY', { search }),
    fetchAnalytics: () => sendMessage('FETCH_ANALYTICS'),
    generateImage: ({ post, topic }) =>
      sendMessage('GENERATE_IMAGE', { post, topic })
  };

  window.LiAiApi = LiAiApi;
})();
