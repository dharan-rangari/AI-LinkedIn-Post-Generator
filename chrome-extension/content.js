/**
 * content.js
 * -----------
 * Injected into every https://www.linkedin.com/* page.
 *
 * Implements:
 *   - Floating action button (FAB) + sliding side panel.
 *   - Generate Post (Topic/Length/Language selections ? FastAPI backend ? output).
 *   - Action buttons: Copy, Insert into LinkedIn, Download.
 *   - Post History: debounced search and scrollable listing.
 *   - Analytics: core performance stats and lightweight HTML/CSS bar charts.
 *
 * Dependency free: uses a simple DOM renderer loop that rebuilds panel subviews on state updates.
 */

(function () {
  if (document.getElementById('li-ai-assistant-root')) {
    return; // guard against double-injection
  }

  const { h, icons } = window.LiAiDom;
  const api = window.LiAiApi;
  const { insertIntoLinkedInComposer } = window.LiAiLinkedInEditor;

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    isOpen: false,
    activeTab: 'generate', // 'generate' | 'history' | 'analytics'

    // Generate tab
    topics: [],
    lengthOptions: ['Short', 'Medium', 'Long'],
    languageOptions: ['English', 'Hinglish'],
    topicMode: 'existing', // 'existing' | 'custom'
    topic: '',
    customTopic: '',
    length: 'Medium',
    language: 'English',
    loadingTopics: true,
    generating: false,
    result: null,
    error: '',
    copied: false,
    inserting: false,
    imageLoading: false,
    image: null,
    imageError: '',

    // History tab
    history: [],
    historyLoading: false,
    historyError: '',
    historySearch: '',
    historyLoadedOnce: false,
    historySearchDebounce: null,

    // Analytics tab
    analytics: null,
    analyticsLoading: false,
    analyticsError: '',
    analyticsLoadedOnce: false,
  };

  let bodyEl;
  let tabsEl;

  function setState(patch) {
    Object.assign(state, patch);
    renderBody();
    refreshTabs();
  }

  // ---------------------------------------------------------------------
  // Shared small components
  // ---------------------------------------------------------------------
  function ErrorBanner(message) {
    if (!message) return null;
    return h('div', { class: 'li-ai-error' }, [message]);
  }

  function Spinner(dark) {
    return h('span', { class: `li-ai-spinner${dark ? ' dark' : ''}` });
  }

  // ---------------------------------------------------------------------
  // Generate tab logic
  // ---------------------------------------------------------------------
  async function loadTopicsIfNeeded() {
    if (!state.loadingTopics) return;
    const response = await api.fetchTopics();
    if (response.ok) {
      const data = response.data;
      setState({
        topics: data.topics || [],
        lengthOptions: data.length_options || state.lengthOptions,
        languageOptions: data.language_options || state.languageOptions,
        topic: data.topics && data.topics.length > 0 ? data.topics[0] : '',
        loadingTopics: false,
      });
    } else {
      setState({ loadingTopics: false, error: response.error });
    }
  }

  async function handleGenerate() {
    const isCustom = state.topicMode === 'custom';
    const trimmedCustom = (state.customTopic || '').trim();

    if (isCustom && !trimmedCustom) {
      setState({ error: 'Please enter a custom topic before generating a post.' });
      return;
    }
    if (!isCustom && !state.topic) {
      setState({ error: 'Please choose a topic before generating a post.' });
      return;
    }

    setState({
      generating: true,
      error: '',
      result: null,
      copied: false,
      image: null,
      imageError: '',
      imageLoading: false,
    });

    const payload = isCustom
      ? { custom_topic: trimmedCustom, length: state.length, language: state.language }
      : { topic: state.topic, length: state.length, language: state.language };

    const response = await api.generatePost(payload);

    if (response.ok && response.data?.post) {
      setState({ generating: false, result: response.data });
    } else {
      setState({
        generating: false,
        error: response.error || 'The server returned an empty post. Please try again.',
      });
    }
  }

  async function handleCopy() {
    if (!state.result?.post) return;
    try {
      await navigator.clipboard.writeText(state.result.post);
      setState({ copied: true });
      setTimeout(() => setState({ copied: false }), 2000);
    } catch {
      setState({ error: 'Could not copy to clipboard. Please copy the text manually.' });
    }
  }

  function handleDownload() {
    if (!state.result?.post) return;
    const blob = new Blob([state.result.post], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `linkedin_post_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleInsert() {
    if (!state.result?.post) return;
    setState({ inserting: true, error: '' });
    try {
      await insertIntoLinkedInComposer(state.result.post);
      setState({ inserting: false });
    } catch (err) {
      setState({ inserting: false, error: err.message || 'Could not insert into LinkedIn.' });
    }
  }

  function dataUrlToBlobUrl(dataUrl) {
    try {
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return URL.createObjectURL(blob);
    } catch (_) {
      return dataUrl;
    }
  }

  async function handleGenerateImage() {
    if (!state.result?.post) return;
    setState({ imageLoading: true, imageError: '' });

    const activeTopic =
      state.result.topic ||
      (state.topicMode === 'custom' ? (state.customTopic || '').trim() : state.topic);

    const response = await api.generateImage({
      post: state.result.post,
      topic: activeTopic,
    });

    if (response.ok && response.data?.image) {
      const displayUrl = dataUrlToBlobUrl(response.data.image);
      setState({
        imageLoading: false,
        image: { ...response.data, displayUrl },
      });
    } else {
      setState({
        imageLoading: false,
        imageError: response.error || 'Failed to generate image. Please try again.',
      });
    }
  }

  function handleDownloadImage() {
    if (!state.image?.image) return;
    const downloadUrl = state.image.displayUrl || state.image.image;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `linkedin_image_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function GenerateView() {
    const modeToggle = h('div', { class: 'li-ai-mode-toggle' }, [
      h(
        'button',
        {
          type: 'button',
          class: `li-ai-mode-btn${state.topicMode === 'existing' ? ' active' : ''}`,
          onClick: () => {
            if (state.topicMode !== 'existing') {
              setState({ topicMode: 'existing', error: '' });
            }
          },
        },
        ['Existing Topic']
      ),
      h(
        'button',
        {
          type: 'button',
          class: `li-ai-mode-btn${state.topicMode === 'custom' ? ' active' : ''}`,
          onClick: () => {
            if (state.topicMode !== 'custom') {
              setState({ topicMode: 'custom', error: '' });
            }
          },
        },
        ['Custom Topic']
      ),
    ]);

    const topicSelect = h(
      'select',
      {
        class: 'li-ai-select',
        disabled: state.loadingTopics,
        onChange: (e) => setState({ topic: e.target.value }),
      },
      state.loadingTopics
        ? [h('option', {}, ['Loading topics...'])]
        : state.topics.length === 0
        ? [h('option', { value: '' }, ['No topics available'])]
        : state.topics.map((t) =>
            h('option', { value: t, ...(t === state.topic ? { selected: 'selected' } : {}) }, [t])
          )
    );

    let topicField;
    if (state.topicMode === 'custom') {
      topicField = h('div', { class: 'li-ai-field' }, [
        h('label', { class: 'li-ai-label' }, ['Your Custom Topic']),
        h('input', {
          class: 'li-ai-input',
          type: 'text',
          placeholder: 'e.g. Quantum Computing, AI Agents...',
          value: state.customTopic,
          maxlength: '200',
          onInput: (e) => {
            state.customTopic = e.target.value;
          },
          onKeydown: (e) => {
            if (e.key === 'Enter' && !state.generating) {
              handleGenerate();
            }
          },
        }),
        h('div', { class: 'li-ai-help-text' }, [
          'Enter any topic — generates directly without dataset limits.',
        ]),
      ]);
    } else {
      topicField = h('div', { class: 'li-ai-field' }, [
        h('label', { class: 'li-ai-label' }, ['Select Topic from Dataset']),
        topicSelect,
        h('div', { class: 'li-ai-help-text' }, [
          'Uses relevant few-shot examples from your RAG dataset.',
        ]),
      ]);
    }

    const lengthSelect = h(
      'select',
      { class: 'li-ai-select', onChange: (e) => setState({ length: e.target.value }) },
      state.lengthOptions.map((l) =>
        h('option', { value: l, ...(l === state.length ? { selected: 'selected' } : {}) }, [l])
      )
    );

    const languageSelect = h(
      'select',
      { class: 'li-ai-select', onChange: (e) => setState({ language: e.target.value }) },
      state.languageOptions.map((l) =>
        h('option', { value: l, ...(l === state.language ? { selected: 'selected' } : {}) }, [l])
      )
    );

    const generateButton = h(
      'button',
      {
        class: 'li-ai-btn li-ai-btn-primary',
        type: 'button',
        disabled: state.generating || (state.topicMode === 'existing' && state.loadingTopics),
        onClick: handleGenerate,
      },
      state.generating
        ? [Spinner(), 'Generating...']
        : [h('span', { html: icons.wand }), 'Generate LinkedIn Post']
    );

    const form = h('div', {}, [
      h('div', { class: 'li-ai-field' }, [
        h('label', { class: 'li-ai-label' }, ['How would you like to choose a topic?']),
        modeToggle,
      ]),
      topicField,
      h('div', { class: 'li-ai-field' }, [
        h('label', { class: 'li-ai-label' }, ['Length']),
        lengthSelect,
      ]),
      h('div', { class: 'li-ai-field' }, [
        h('label', { class: 'li-ai-label' }, ['Language']),
        languageSelect,
      ]),
      generateButton,
    ]);

    const resultBlock = state.result
      ? h('div', { class: 'li-ai-result' }, [
          h('textarea', { class: 'li-ai-result-textarea', readonly: 'readonly' }, [
            state.result.post,
          ]),
          h('div', { class: 'li-ai-stats' }, [
            h('div', { class: 'li-ai-stat' }, [
              h('div', { class: 'li-ai-stat-value' }, [String(state.result.character_count)]),
              h('div', { class: 'li-ai-stat-label' }, ['Characters']),
            ]),
            h('div', { class: 'li-ai-stat' }, [
              h('div', { class: 'li-ai-stat-value' }, [String(state.result.word_count)]),
              h('div', { class: 'li-ai-stat-label' }, ['Words']),
            ]),
            h('div', { class: 'li-ai-stat' }, [
              h('div', { class: 'li-ai-stat-value' }, [`${state.result.reading_time_minutes} min`]),
              h('div', { class: 'li-ai-stat-label' }, ['Reading']),
            ]),
          ]),
          h('div', { class: 'li-ai-btn-row' }, [
            h(
              'button',
              { class: 'li-ai-btn li-ai-btn-secondary', type: 'button', onClick: handleCopy },
              [state.copied ? 'Copied!' : 'Copy']
            ),
            h(
              'button',
              { class: 'li-ai-btn li-ai-btn-secondary', type: 'button', onClick: handleDownload },
              ['Download']
            ),
          ]),
          h('div', { class: 'li-ai-btn-row' }, [
            h(
              'button',
              {
                class: 'li-ai-btn li-ai-btn-primary',
                type: 'button',
                disabled: state.inserting,
                onClick: handleInsert,
              },
              state.inserting ? [Spinner(), 'Inserting...'] : ['Insert into LinkedIn']
            ),
          ]),
          h('div', { class: 'li-ai-btn-row' }, [
            h(
              'button',
              {
                class: 'li-ai-btn li-ai-btn-secondary',
                type: 'button',
                disabled: state.imageLoading,
                onClick: handleGenerateImage,
              },
              state.imageLoading
                ? [Spinner(true), 'Generating image...']
                : [state.image ? 'Regenerate Image' : 'Generate Image']
            ),
          ]),
          ErrorBanner(state.imageError),
          state.image
            ? h('div', { class: 'li-ai-image-block' }, [
                h('img', {
                  class: 'li-ai-image',
                  src: state.image.displayUrl || state.image.image,
                  alt: 'Generated LinkedIn post illustration',
                }),
                h('div', { class: 'li-ai-btn-row' }, [
                  h(
                    'button',
                    {
                      class: 'li-ai-btn li-ai-btn-secondary',
                      type: 'button',
                      onClick: handleDownloadImage,
                    },
                    ['Download Image']
                  ),
                ]),
              ])
            : null,
        ])
      : null;

    return h('div', {}, [ErrorBanner(state.error), form, resultBlock]);
  }

  // ---------------------------------------------------------------------
  // History tab logic
  // ---------------------------------------------------------------------
  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function loadHistory(search) {
    setState({ historyLoading: true, historyError: '' });
    const response = await api.fetchHistory(search);
    if (response.ok) {
      setState({ historyLoading: false, history: response.data, historyLoadedOnce: true });
    } else {
      setState({ historyLoading: false, historyError: response.error, historyLoadedOnce: true });
    }
  }

  function handleHistorySearchInput(value) {
    state.historySearch = value;
    if (state.historySearchDebounce) clearTimeout(state.historySearchDebounce);
    state.historySearchDebounce = setTimeout(() => loadHistory(value), 350);
  }

  function HistoryView() {
    if (!state.historyLoadedOnce && !state.historyLoading) {
      loadHistory('');
    }

    const searchInput = h('input', {
      class: 'li-ai-input',
      type: 'text',
      placeholder: 'Search topic, language or content...',
      value: state.historySearch,
      onInput: (e) => handleHistorySearchInput(e.target.value),
    });

    let listNode;
    if (state.historyLoading) {
      listNode = h('div', { style: 'display:flex;justify-content:center;padding:30px 0;' }, [
        Spinner(true),
      ]);
    } else if (state.historyError) {
      listNode = ErrorBanner(state.historyError);
    } else if (state.history.length === 0) {
      listNode = h('div', { class: 'li-ai-placeholder' }, [
        h('p', { class: 'li-ai-placeholder-title' }, ['No posts found']),
        h('p', { class: 'li-ai-placeholder-text' }, [
          state.historySearch ? 'Try a different search term.' : 'Generate your first post to see it here.',
        ]),
      ]);
    } else {
      listNode = h(
        'div',
        {},
        state.history.map((post) =>
          h('div', { class: 'li-ai-history-item' }, [
            h('div', { class: 'li-ai-history-topic' }, [post.topic]),
            h('div', { class: 'li-ai-history-meta' }, [
              `${post.language} - ${post.length} - ${formatDate(post.created_at)}`,
            ]),
            h('div', { class: 'li-ai-history-preview' }, [post.post]),
          ])
        )
      );
    }

    return h('div', {}, [h('div', { class: 'li-ai-field' }, [searchInput]), listNode]);
  }

  // ---------------------------------------------------------------------
  // Analytics tab logic
  // ---------------------------------------------------------------------
  async function loadAnalytics() {
    setState({ analyticsLoading: true, analyticsError: '' });
    const response = await api.fetchAnalytics();
    if (response.ok) {
      setState({ analyticsLoading: false, analytics: response.data, analyticsLoadedOnce: true });
    } else {
      setState({ analyticsLoading: false, analyticsError: response.error, analyticsLoadedOnce: true });
    }
  }

  function BarChart(rows, valueKey, labelKey) {
    if (!rows || rows.length === 0) {
      return h('div', { class: 'li-ai-placeholder-text' }, ['No data yet.']);
    }
    const max = Math.max(...rows.map((r) => r[valueKey]), 1);
    return h(
      'div',
      {},
      rows.map((row) =>
        h('div', { class: 'li-ai-bar-row' }, [
          h('div', { class: 'li-ai-bar-label', title: row[labelKey] }, [row[labelKey]]),
          h('div', { class: 'li-ai-bar-track' }, [
            h('div', { class: 'li-ai-bar-fill', style: `width:${(row[valueKey] / max) * 100}%` }),
          ]),
          h('div', { class: 'li-ai-bar-count' }, [String(row[valueKey])]),
        ])
      )
    );
  }

  function AnalyticsView() {
    if (!state.analyticsLoadedOnce && !state.analyticsLoading) {
      loadAnalytics();
    }

    if (state.analyticsLoading) {
      return h('div', { style: 'display:flex;justify-content:center;padding:30px 0;' }, [Spinner(true)]);
    }

    if (state.analyticsError) {
      return ErrorBanner(state.analyticsError);
    }

    const data = state.analytics;
    if (!data) return h('div', {});

    return h('div', {}, [
      h('div', { class: 'li-ai-analytics-grid' }, [
        h('div', { class: 'li-ai-analytics-card' }, [
          h('div', { class: 'li-ai-analytics-value' }, [String(data.total_posts)]),
          h('div', { class: 'li-ai-analytics-label' }, ['Total Posts']),
        ]),
        h('div', { class: 'li-ai-analytics-card' }, [
          h('div', { class: 'li-ai-analytics-value' }, [String(data.posts_today)]),
          h('div', { class: 'li-ai-analytics-label' }, ['Posts Today']),
        ]),
        h('div', { class: 'li-ai-analytics-card' }, [
          h('div', { class: 'li-ai-analytics-value' }, [data.most_used_topic || 'N/A']),
          h('div', { class: 'li-ai-analytics-label' }, ['Top Topic']),
        ]),
        h('div', { class: 'li-ai-analytics-card' }, [
          h('div', { class: 'li-ai-analytics-value' }, [data.most_used_language || 'N/A']),
          h('div', { class: 'li-ai-analytics-label' }, ['Top Language']),
        ]),
      ]),
      h('div', { class: 'li-ai-section-title' }, ['Topic Distribution']),
      BarChart(data.topic_distribution, 'count', 'topic'),
      h('div', { class: 'li-ai-section-title' }, ['Language Distribution']),
      BarChart(data.language_distribution, 'count', 'language'),
    ]);
  }

  // ---------------------------------------------------------------------
  // Shell & Mounting structure
  // ---------------------------------------------------------------------
  function renderBody() {
    if (!bodyEl) return;
    bodyEl.innerHTML = '';
    let view;
    if (state.activeTab === 'generate') {
      loadTopicsIfNeeded();
      view = GenerateView();
    } else if (state.activeTab === 'history') {
      view = HistoryView();
    } else {
      view = AnalyticsView();
    }
    bodyEl.appendChild(view);
  }

  function buildTabsNode() {
    const tabs = [
      { id: 'generate', label: 'Generate' },
      { id: 'history', label: 'History' },
      { id: 'analytics', label: 'Analytics' },
    ];
    return h(
      'div',
      { class: 'li-ai-tabs' },
      tabs.map((tab) =>
        h(
          'button',
          {
            class: `li-ai-tab${state.activeTab === tab.id ? ' active' : ''}`,
            type: 'button',
            onClick: () => setState({ activeTab: tab.id }),
          },
          [tab.label]
        )
      )
    );
  }

  function refreshTabs() {
    if (!tabsEl || !tabsEl.parentNode) return;
    const fresh = buildTabsNode();
    tabsEl.replaceWith(fresh);
    tabsEl = fresh;
  }

  function buildFloatingButton(onClick) {
    return h(
      'button',
      {
        class: 'li-ai-fab',
        type: 'button',
        'aria-label': 'Open AI Post Assistant',
        title: 'AI Post Assistant',
        onClick,
      },
      [h('span', { html: icons.sparkle })]
    );
  }

  function buildPanel({ onClose }) {
    const overlay = h('div', { class: 'li-ai-overlay', onClick: onClose });

    const closeButton = h(
      'button',
      { class: 'li-ai-close', type: 'button', 'aria-label': 'Close panel', onClick: onClose },
      [h('span', { html: icons.close })]
    );

    const header = h('div', { class: 'li-ai-header' }, [
      h('div', { class: 'li-ai-header-brand' }, [
        h('div', { class: 'li-ai-logo' }, ['AI']),
        h('div', {}, [
          h('p', { class: 'li-ai-title' }, ['AI Post Assistant']),
          h('p', { class: 'li-ai-subtitle' }, ['Draft LinkedIn posts in seconds']),
        ]),
      ]),
      closeButton,
    ]);

    tabsEl = buildTabsNode();
    bodyEl = h('div', { class: 'li-ai-body' });
    renderBody();

    const panel = h(
      'div',
      { class: 'li-ai-panel', role: 'dialog', 'aria-label': 'AI Post Assistant panel' },
      [header, tabsEl, bodyEl]
    );

    return { overlay, panel };
  }

  async function loadPanelStyles() {
    const cssUrl = chrome.runtime.getURL('panel/styles/panel.css');
    const response = await fetch(cssUrl);
    return response.text();
  }

  async function mount() {
    const host = h('div', { id: 'li-ai-assistant-root' });
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = await loadPanelStyles();
    shadowRoot.appendChild(styleEl);

    const setOpen = (nextOpen) => {
      state.isOpen = nextOpen;
      panel.classList.toggle('open', state.isOpen);
      overlay.classList.toggle('open', state.isOpen);
      fab.setAttribute('aria-expanded', String(state.isOpen));
    };

    const { overlay, panel } = buildPanel({ onClose: () => setOpen(false) });
    const fab = buildFloatingButton(() => setOpen(!state.isOpen));

    shadowRoot.appendChild(fab);
    shadowRoot.appendChild(overlay);
    shadowRoot.appendChild(panel);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.isOpen) {
        setOpen(false);
      }
    });
  }

  mount().catch((error) => {
    console.error('[LinkedIn AI Assistant] Failed to mount panel:', error);
  });
})();
