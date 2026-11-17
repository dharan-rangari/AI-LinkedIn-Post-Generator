/**
 * background.js
 * ---------------
 * MV3 service worker. All backend/API calls happen here, not in
 * content.js, because a service worker with host_permissions bypasses
 * both CORS and the LinkedIn page's Content-Security-Policy.
 */

const API_BASE_URL = 'http://localhost:8000/api';

if (typeof window === 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('[LinkedIn AI Assistant] Installed/updated:', details.reason);
  });
}

async function safeFetchJson(url, options) {
  try {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = body?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
        : detail || `Request failed with status ${response.status}`;
      return { ok: false, error: message };
    }

    return { ok: true, data: body };
  } catch (error) {
    return {
      ok: false,
      error:
        'Could not reach the backend. Make sure "python api.py" is running on ' +
        API_BASE_URL,
    };
  }
}

async function handleFetchTopics() {
  return safeFetchJson(`${API_BASE_URL}/topics`);
}

async function handleGeneratePost(payload) {
  return safeFetchJson(`${API_BASE_URL}/generate-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function handleFetchHistory(payload) {
  const search = payload?.search;
  const url = search
    ? `${API_BASE_URL}/history?search=${encodeURIComponent(search)}`
    : `${API_BASE_URL}/history`;
  return safeFetchJson(url);
}

async function handleFetchAnalytics() {
  return safeFetchJson(`${API_BASE_URL}/analytics`);
}

async function handleGenerateImage(payload) {
  // Keep service worker active during long-running image generation
  const keepAliveTimer = setInterval(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getPlatformInfo) {
      chrome.runtime.getPlatformInfo(() => {});
    }
  }, 20000);

  try {
    return await safeFetchJson(`${API_BASE_URL}/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } finally {
    clearInterval(keepAliveTimer);
  }
}

if (typeof window === 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') {
      sendResponse({ ok: false, error: 'Malformed message' });
      return false;
    }

    switch (message.type) {
      case 'PING':
        sendResponse({ ok: true, data: 'PONG', receivedAt: Date.now() });
        return false;

      case 'FETCH_TOPICS':
        handleFetchTopics().then(sendResponse);
        break;

      case 'GENERATE_POST':
        handleGeneratePost(message.payload).then(sendResponse);
        break;

      case 'GENERATE_IMAGE':
        handleGenerateImage(message.payload).then(sendResponse);
        break;

      case 'FETCH_HISTORY':
        handleFetchHistory(message.payload).then(sendResponse);
        break;

      case 'FETCH_ANALYTICS':
        handleFetchAnalytics().then(sendResponse);
        break;

      default:
        sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
        return false;
    }

    // Return true to keep the message channel open for async sendResponse calls.
    return true;
  });
}
