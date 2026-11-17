/**
 * dom.js
 * -------
 * Lightweight DOM builder and icons helper.
 */

(function () {
  /**
   * Create an element with attributes and children in one call.
   * @param {string} tag
   * @param {Object} [attrs]
   * @param {(Node|string)[]} [children]
   */
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') {
        el.className = value;
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === false || value === null || value === undefined) {
        // Skip so boolean attributes (e.g. disabled) are absent when false
      } else if (value === true) {
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, value);
      }
    });

    children.forEach((child) => {
      if (child === null || child === undefined) return;
      el.append(typeof child === 'string' ? document.createTextNode(child) : child);
    });

    return el;
  }

  const icons = {
    sparkle: `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z"
          fill="currentColor"/>
      </svg>`,
    close: `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2"
          stroke-linecap="round"/>
      </svg>`,
    wand: `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 20l8-8M14.5 4.5l1 1M17.5 2.5l1 1M20.5 5.5l1 1M9.5 9.5l1 1"
          stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M13 11l6-6 3 3-6 6-3-3z" fill="currentColor"/>
      </svg>`
  };

  window.LiAiDom = { h, icons };
})();
