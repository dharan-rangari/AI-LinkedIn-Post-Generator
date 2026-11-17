// /**
//  * linkedinEditor.js
//  * ------------------
//  * Inserts generated text into LinkedIn's post composer (Quill editor).
//  *
//  * ROOT CAUSE (discovered via debug logs):
//  *   LinkedIn renders the post composer inside a Shadow DOM tree.
//  *   Regular document.querySelector() CANNOT see into Shadow DOM.
//  *   MutationObserver on document.body CANNOT observe Shadow DOM subtrees.
//  *   
//  *   Fix: recursively traverse ALL Shadow DOM roots when searching for
//  *   the editor, and use setInterval polling instead of MutationObserver.
//  */
// (function () {

//   const LOG = '[LI-AI]';

//   /* ================================================================== */
//   /* DEEP DOM SEARCH — traverses into Shadow DOM roots                   */
//   /* ================================================================== */

//   /**
//    * Recursively searches the entire DOM tree INCLUDING Shadow DOM roots
//    * for an element matching the given CSS selector.
//    */
//   function deepQuerySelector(selector, root) {
//     if (!root) root = document;

//     // Try regular querySelector first
//     const found = root.querySelector(selector);
//     if (found) return found;

//     // Get all elements to check for shadow roots
//     const allElements = root.querySelectorAll('*');
//     for (const el of allElements) {
//       if (el.shadowRoot) {
//         const inShadow = deepQuerySelector(selector, el.shadowRoot);
//         if (inShadow) return inShadow;
//       }
//     }

//     return null;
//   }

//   /**
//    * Like deepQuerySelector but returns ALL matches.
//    */
//   function deepQuerySelectorAll(selector, root) {
//     if (!root) root = document;
//     const results = [];

//     // Regular matches
//     const found = root.querySelectorAll(selector);
//     results.push(...found);

//     // Search inside shadow roots
//     const allElements = root.querySelectorAll('*');
//     for (const el of allElements) {
//       if (el.shadowRoot) {
//         const shadowResults = deepQuerySelectorAll(selector, el.shadowRoot);
//         results.push(...shadowResults);
//       }
//     }

//     return results;
//   }

//   /* ================================================================== */
//   /* EDITOR DETECTION — uses deep search into Shadow DOM                 */
//   /* ================================================================== */

//   function getOpenEditor() {
//     // Strategy 1: data-test attribute (most specific)
//     const s1 = deepQuerySelector('[data-test-ql-editor-contenteditable="true"]');
//     if (s1) { console.log(LOG, 'Editor found via data-test attr'); return s1; }

//     // Strategy 2: ql-editor class + contenteditable
//     const s2 = deepQuerySelector('.ql-editor[contenteditable="true"]');
//     if (s2) { console.log(LOG, 'Editor found via .ql-editor class'); return s2; }

//     // Strategy 3: aria-label match
//     const s3 = deepQuerySelector('[aria-label="Text editor for creating content"][contenteditable="true"]');
//     if (s3) { console.log(LOG, 'Editor found via aria-label'); return s3; }

//     // Strategy 4: role=textbox + contenteditable
//     const s4 = deepQuerySelector('[role="textbox"][contenteditable="true"]');
//     if (s4) { console.log(LOG, 'Editor found via role=textbox+contenteditable'); return s4; }

//     // Strategy 5: data-placeholder match
//     const s5 = deepQuerySelector('[data-placeholder="What do you want to talk about?"]');
//     if (s5) { console.log(LOG, 'Editor found via data-placeholder'); return s5; }

//     // Strategy 6: aria-placeholder match
//     const s6 = deepQuerySelector('[aria-placeholder="What do you want to talk about?"]');
//     if (s6) { console.log(LOG, 'Editor found via aria-placeholder'); return s6; }

//     // Strategy 7: any contenteditable inside a dialog/modal (deep search)
//     const dialogs = deepQuerySelectorAll('[role="dialog"]');
//     for (const dialog of dialogs) {
//       // Search within this dialog (which might itself be in shadow DOM)
//       const root = dialog.shadowRoot || dialog;
//       const edInDialog = root.querySelector('[contenteditable="true"]');
//       if (edInDialog) { console.log(LOG, 'Editor found in dialog'); return edInDialog; }
//     }

//     // Strategy 8: brute force — find ALL contenteditable elements (deep)
//     const allEditable = deepQuerySelectorAll('[contenteditable="true"]');
//     console.log(LOG, 'Deep search: found', allEditable.length, 'contenteditable elements');

//     for (const el of allEditable) {
//       // Skip elements inside our own extension panel
//       if (el.closest && el.closest('#li-ai-assistant-root')) continue;

//       const rect = el.getBoundingClientRect();
//       const hasQuillClass = el.classList && el.classList.contains('ql-editor');
//       const hasTextboxRole = el.getAttribute && el.getAttribute('role') === 'textbox';
//       const isLargeEnough = rect.width > 100 && rect.height > 30;

//       console.log(LOG, 'Candidate:', {
//         tag: el.tagName,
//         class: (el.className || '').toString().substring(0, 60),
//         role: el.getAttribute ? el.getAttribute('role') : null,
//         w: Math.round(rect.width),
//         h: Math.round(rect.height),
//         quill: hasQuillClass,
//         textbox: hasTextboxRole
//       });

//       if (hasQuillClass || hasTextboxRole || isLargeEnough) {
//         console.log(LOG, 'Editor found via brute force deep search');
//         return el;
//       }
//     }

//     // Strategy 9: search inside iframes (some LinkedIn layouts use them)
//     try {
//       const iframes = document.querySelectorAll('iframe');
//       for (const iframe of iframes) {
//         try {
//           const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
//           if (!iframeDoc) continue;
//           const inIframe = iframeDoc.querySelector('[contenteditable="true"]');
//           if (inIframe) {
//             console.log(LOG, 'Editor found inside iframe');
//             return inIframe;
//           }
//         } catch (e) { /* cross-origin iframe, skip */ }
//       }
//     } catch (e) { /* skip */ }

//     console.log(LOG, 'Editor NOT found by any strategy');
//     return null;
//   }

//   /* ================================================================== */
//   /* "START A POST" TRIGGER DETECTION                                    */
//   /* ================================================================== */

//   function findStartPostTrigger() {
//     console.log(LOG, 'Searching for "Start a post" trigger...');

//     // 1. Exact aria-label
//     const s1 = document.querySelector('button[aria-label="Start a post"]');
//     if (s1) { console.log(LOG, 'Trigger found via exact aria-label'); return s1; }

//     // 2. Case-insensitive aria-label on buttons AND anchors
//     const allInteractive = document.querySelectorAll('button, a, [role="button"]');
//     for (const el of allInteractive) {
//       const label = (el.getAttribute('aria-label') || '').toLowerCase();
//       if (label.includes('start a post') || label.includes('create a post') || label.includes('write a post')) {
//         console.log(LOG, 'Trigger found via aria-label scan:', label);
//         return el;
//       }
//     }

//     // 3. LinkedIn share-box class selectors
//     const shareBoxSelectors = [
//       '.share-box-feed-entry__trigger',
//       'button.share-box-feed-entry__trigger',
//       '.share-box-feed-entry__cta-button',
//       '[data-control-name="share.sharebox_feed_cta"]'
//     ];
//     for (const sel of shareBoxSelectors) {
//       const el = document.querySelector(sel);
//       if (el) { console.log(LOG, 'Trigger found via', sel); return el; }
//     }

//     // 4. Text-content scan across ALL elements (not just buttons)
//     //    LinkedIn uses <a> tags for "Start a post" — discovered via debug logs
//     const scanTargets = document.querySelectorAll(
//       'button, a, [role="button"], div[tabindex], span[tabindex], div[role], span[role]'
//     );
//     console.log(LOG, 'Scanning', scanTargets.length, 'elements for text content...');

//     for (const el of scanTargets) {
//       const text = (el.textContent || '').trim().toLowerCase();
//       if (text.length > 200 || !text) continue;
//       if (
//         text.includes('start a post') ||
//         text.includes('create a post') ||
//         text.includes('write a post')
//       ) {
//         const interactive = el.closest('button, a, [role="button"]');
//         const result = interactive || el;
//         console.log(LOG, 'Trigger found via text scan:', text.substring(0, 40));
//         return result;
//       }
//     }

//     console.log(LOG, 'Trigger NOT found');
//     return null;
//   }

//   /* ================================================================== */
//   /* WAIT FOR EDITOR — uses polling instead of MutationObserver          */
//   /* because MutationObserver CANNOT observe into Shadow DOM subtrees    */
//   /* ================================================================== */

//   function waitForEditor(timeoutMs) {
//     return new Promise((resolve, reject) => {
//       const existing = getOpenEditor();
//       if (existing) { resolve(existing); return; }

//       console.log(LOG, 'Polling for editor (timeout:', timeoutMs, 'ms)...');
//       const startTime = Date.now();
//       let pollCount = 0;

//       const interval = setInterval(() => {
//         pollCount++;
//         const elapsed = Date.now() - startTime;
//         const found = getOpenEditor();

//         if (found) {
//           clearInterval(interval);
//           console.log(LOG, 'Editor appeared after', elapsed, 'ms (poll #' + pollCount + ')');
//           resolve(found);
//           return;
//         }

//         if (elapsed >= timeoutMs) {
//           clearInterval(interval);
//           console.log(LOG, 'Editor NOT found after', timeoutMs, 'ms (' + pollCount + ' polls)');

//           // Final diagnostic dump
//           dumpDiagnostics();

//           reject(new Error(
//             'The LinkedIn post composer was not detected.\n\n' +
//             'Please try:\n' +
//             '1. Click "Start a post" on LinkedIn to open the composer.\n' +
//             '2. Click inside the writing area.\n' +
//             '3. Then click "Insert into LinkedIn" again.\n\n' +
//             'Check Console (F12) for [LI-AI] diagnostic logs.'
//           ));
//         }
//       }, 500); // Poll every 500ms
//     });
//   }

//   /* ================================================================== */
//   /* DIAGNOSTIC DUMP                                                     */
//   /* ================================================================== */

//   function dumpDiagnostics() {
//     console.group(LOG + ' === DIAGNOSTIC DUMP ===');

//     // All contenteditable elements (deep)
//     const editables = deepQuerySelectorAll('[contenteditable="true"]');
//     console.log('All contenteditable (deep search):', editables.length);
//     editables.forEach((el, i) => {
//       const rect = el.getBoundingClientRect();
//       console.log(`  [${i}]`, {
//         tag: el.tagName,
//         class: (el.className || '').toString().substring(0, 80),
//         role: el.getAttribute ? el.getAttribute('role') : null,
//         ariaLabel: el.getAttribute ? el.getAttribute('aria-label') : null,
//         w: Math.round(rect.width),
//         h: Math.round(rect.height)
//       });
//     });

//     // All shadow DOM hosts
//     const shadows = [];
//     document.querySelectorAll('*').forEach(el => {
//       if (el.shadowRoot) {
//         shadows.push({
//           tag: el.tagName,
//           id: el.id || '',
//           class: el.className.toString().substring(0, 40)
//         });
//       }
//     });
//     console.log('Shadow DOM hosts:', shadows.length, shadows);

//     // All dialogs/overlays
//     const dialogs = deepQuerySelectorAll('[role="dialog"]');
//     console.log('Dialogs (deep):', dialogs.length);

//     // All iframes
//     console.log('Iframes:', document.querySelectorAll('iframe').length);

//     // Current URL
//     console.log('URL:', window.location.href);

//     console.groupEnd();
//   }

//   /* ================================================================== */
//   /* OPEN COMPOSER AND GET EDITOR                                        */
//   /* ================================================================== */

//   async function openComposerAndGetEditor() {
//     console.log(LOG, '--- openComposerAndGetEditor START ---');
//     console.log(LOG, 'URL:', window.location.href);

//     // PATH A: Composer already open
//     console.log(LOG, 'PATH A: Checking if editor is already open...');
//     const alreadyOpen = getOpenEditor();
//     if (alreadyOpen) {
//       console.log(LOG, 'PATH A: Editor found!');
//       return alreadyOpen;
//     }
//     console.log(LOG, 'PATH A: Editor not open.');

//     // PATH B: Find and click trigger
//     console.log(LOG, 'PATH B: Looking for trigger...');
//     const trigger = findStartPostTrigger();

//     if (trigger) {
//       console.log(LOG, 'PATH B: Trigger found:', trigger.tagName, (trigger.className || '').toString().substring(0, 40));

//       // Click using multiple methods for reliability
//       trigger.focus();
//       trigger.click();

//       // Also dispatch synthetic mouse events
//       try {
//         trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
//         trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
//         trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
//       } catch (e) {
//         console.log(LOG, 'Event dispatch note:', e.message);
//       }

//       // Wait longer before polling — LinkedIn's composer animation takes time
//       console.log(LOG, 'PATH B: Waiting 2s for composer to render...');
//       await new Promise(r => setTimeout(r, 2000));

//       // Poll for editor for 15 seconds
//       return waitForEditor(15000);
//     }

//     // PATH C: No trigger found
//     console.log(LOG, 'PATH C: No trigger found');
//     dumpDiagnostics();

//     throw new Error(
//       'Could not find the "Start a post" button.\n\n' +
//       'Please:\n' +
//       '1. Click "Start a post" on LinkedIn yourself.\n' +
//       '2. Click inside the writing area.\n' +
//       '3. Click "Insert into LinkedIn" again.'
//     );
//   }

//   /* ================================================================== */
//   /* TEXT INSERTION                                                       */
//   /* ================================================================== */

//   function placeCursorAtEnd(el) {
//     try {
//       el.focus();
//       const range = document.createRange();
//       range.selectNodeContents(el);
//       range.collapse(false);
//       const sel = window.getSelection();
//       sel.removeAllRanges();
//       sel.addRange(range);
//     } catch (_) { /* non-fatal */ }
//   }

//   function insertTextSafely(editorEl, text) {
//     console.log(LOG, 'insertTextSafely: Starting...');

//     // Focus the editor
//     editorEl.focus();

//     // Set selection inside the editor
//     const range = document.createRange();
//     range.selectNodeContents(editorEl);
//     const sel = window.getSelection();
//     sel.removeAllRanges();
//     sel.addRange(range);

//     // Try execCommand first
//     const ok = document.execCommand('insertText', false, text);
//     console.log(LOG, 'execCommand result:', ok);

//     if (!ok) {
//       // Fallback: set textContent directly
//       console.log(LOG, 'Fallback: using textContent');
//       editorEl.textContent = text;
//     }

//     // Dispatch input events to notify React/Quill
//     editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
//     editorEl.dispatchEvent(new Event('change', { bubbles: true }));

//     // Place cursor at end
//     placeCursorAtEnd(editorEl);

//     // Verify
//     const actual = (editorEl.textContent || '').trim();
//     const sample = text.slice(0, 20).trim();
//     const verified = sample && actual.includes(sample);
//     console.log(LOG, 'Verified:', verified, '| Content:', actual.substring(0, 50) + '...');
//   }

//   /* ================================================================== */
//   /* PUBLIC API                                                          */
//   /* ================================================================== */

//   async function insertIntoLinkedInComposer(text) {
//     console.log(LOG, '=== insertIntoLinkedInComposer called ===');
//     const editor = await openComposerAndGetEditor();
//     insertTextSafely(editor, text);
//     console.log(LOG, '=== COMPLETE ===');
//   }

//   window.LiAiLinkedInEditor = { insertIntoLinkedInComposer };
//   console.log(LOG, 'linkedinEditor.js loaded');

// })();


/**
 * linkedinEditor.js
 * ------------------
 * Inserts generated text into LinkedIn's post composer (Quill editor).
 *
 * ROOT CAUSE (discovered via debug logs):
 *   LinkedIn renders the post composer inside a Shadow DOM tree.
 *   Regular document.querySelector() CANNOT see into Shadow DOM.
 *   MutationObserver on document.body CANNOT observe Shadow DOM subtrees.
 *
 *   Fix: recursively traverse ALL Shadow DOM roots when searching for
 *   the editor, and use setInterval polling instead of MutationObserver.
 *
 * UPDATE (this patch):
 *   Root cause of "composer not detected" timeouts traced to
 *   findStartPostTrigger() matching a HIDDEN duplicate element (LinkedIn
 *   renders multiple "Start a post" triggers for different breakpoints,
 *   only one of which is visible/interactive at a time). Clicking a
 *   hidden trigger fires .click() with no visible effect, so the modal
 *   never opens and the editor poll always times out.
 *
 *   Fix: filter candidates by visibility before clicking, dispatch a
 *   fuller mousedown/mouseup/click sequence, and verify a dialog actually
 *   opened -- retrying the click once if not.
 */
// (function () {

//   const LOG = '[LI-AI]';

//   /* ================================================================== */
//   /* VISIBILITY HELPER                                                   */
//   /* ================================================================== */

//   function isVisible(el) {
//     if (!el || !(el instanceof Element)) return false;
//     if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
//     const style = getComputedStyle(el);
//     if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
//     const rect = el.getBoundingClientRect();
//     if (rect.width <= 0 || rect.height <= 0) return false;
//     return true;
//   }

//   /* ================================================================== */
//   /* DEEP DOM SEARCH — traverses into Shadow DOM roots                   */
//   /* ================================================================== */

//   /**
//    * Recursively searches the entire DOM tree INCLUDING Shadow DOM roots
//    * for an element matching the given CSS selector.
//    */
//   function deepQuerySelector(selector, root) {
//     if (!root) root = document;

//     // Try regular querySelector first
//     const found = root.querySelector(selector);
//     if (found) return found;

//     // Get all elements to check for shadow roots
//     const allElements = root.querySelectorAll('*');
//     for (const el of allElements) {
//       if (el.shadowRoot) {
//         const inShadow = deepQuerySelector(selector, el.shadowRoot);
//         if (inShadow) return inShadow;
//       }
//     }

//     return null;
//   }

//   /**
//    * Like deepQuerySelector but returns ALL matches.
//    */
//   function deepQuerySelectorAll(selector, root) {
//     if (!root) root = document;
//     const results = [];

//     // Regular matches
//     const found = root.querySelectorAll(selector);
//     results.push(...found);

//     // Search inside shadow roots
//     const allElements = root.querySelectorAll('*');
//     for (const el of allElements) {
//       if (el.shadowRoot) {
//         const shadowResults = deepQuerySelectorAll(selector, el.shadowRoot);
//         results.push(...shadowResults);
//       }
//     }

//     return results;
//   }

//   /* ================================================================== */
//   /* EDITOR DETECTION — uses deep search into Shadow DOM                 */
//   /* ================================================================== */

//   // function getOpenEditor() {
//   //   // Strategy 1: data-test attribute (most specific)
//   //   const s1 = deepQuerySelector('[data-test-ql-editor-contenteditable="true"]');
//   //   if (s1) { console.log(LOG, 'Editor found via data-test attr'); return s1; }

//   //   // Strategy 2: ql-editor class + contenteditable
//   //   const s2 = deepQuerySelector('.ql-editor[contenteditable="true"]');
//   //   if (s2) { console.log(LOG, 'Editor found via .ql-editor class'); return s2; }

//   //   // Strategy 3: aria-label match
//   //   const s3 = deepQuerySelector('[aria-label="Text editor for creating content"][contenteditable="true"]');
//   //   if (s3) { console.log(LOG, 'Editor found via aria-label'); return s3; }

//   //   // Strategy 4: role=textbox + contenteditable
//   //   const s4 = deepQuerySelector('[role="textbox"][contenteditable="true"]');
//   //   if (s4) { console.log(LOG, 'Editor found via role=textbox+contenteditable'); return s4; }

//   //   // Strategy 5: data-placeholder match
//   //   const s5 = deepQuerySelector('[data-placeholder="What do you want to talk about?"]');
//   //   if (s5) { console.log(LOG, 'Editor found via data-placeholder'); return s5; }

//   //   // Strategy 6: aria-placeholder match
//   //   const s6 = deepQuerySelector('[aria-placeholder="What do you want to talk about?"]');
//   //   if (s6) { console.log(LOG, 'Editor found via aria-placeholder'); return s6; }

//   //   // Strategy 7: any contenteditable inside a dialog/modal (deep search)
//   //   const dialogs = deepQuerySelectorAll('[role="dialog"]');
//   //   for (const dialog of dialogs) {
//   //     // Search within this dialog (which might itself be in shadow DOM)
//   //     const root = dialog.shadowRoot || dialog;
//   //     const edInDialog = root.querySelector('[contenteditable="true"]');
//   //     if (edInDialog) { console.log(LOG, 'Editor found in dialog'); return edInDialog; }
//   //   }

//   //   // Strategy 8: brute force — find ALL contenteditable elements (deep)
//   //   const allEditable = deepQuerySelectorAll('[contenteditable="true"]');
//   //   console.log(LOG, 'Deep search: found', allEditable.length, 'contenteditable elements');

//   //   for (const el of allEditable) {
//   //     // Skip elements inside our own extension panel
//   //     if (el.closest && el.closest('#li-ai-assistant-root')) continue;
//   //     // Skip hidden candidates
//   //     if (!isVisible(el)) continue;

//   //     const rect = el.getBoundingClientRect();
//   //     const hasQuillClass = el.classList && el.classList.contains('ql-editor');
//   //     const hasTextboxRole = el.getAttribute && el.getAttribute('role') === 'textbox';
//   //     const isLargeEnough = rect.width > 100 && rect.height > 30;

//   //     console.log(LOG, 'Candidate:', {
//   //       tag: el.tagName,
//   //       class: (el.className || '').toString().substring(0, 60),
//   //       role: el.getAttribute ? el.getAttribute('role') : null,
//   //       w: Math.round(rect.width),
//   //       h: Math.round(rect.height),
//   //       quill: hasQuillClass,
//   //       textbox: hasTextboxRole
//   //     });

//   //     if (hasQuillClass || hasTextboxRole || isLargeEnough) {
//   //       console.log(LOG, 'Editor found via brute force deep search');
//   //       return el;
//   //     }
//   //   }

//   //   // Strategy 9: search inside iframes (some LinkedIn layouts use them)
//   //   try {
//   //     const iframes = document.querySelectorAll('iframe');
//   //     for (const iframe of iframes) {
//   //       try {
//   //         const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
//   //         if (!iframeDoc) continue;
//   //         const inIframe = iframeDoc.querySelector('[contenteditable="true"]');
//   //         if (inIframe) {
//   //           console.log(LOG, 'Editor found inside iframe');
//   //           return inIframe;
//   //         }
//   //       } catch (e) { /* cross-origin iframe, skip */ }
//   //     }
//   //   } catch (e) { /* skip */ }

//   //   console.log(LOG, 'Editor NOT found by any strategy');
//   //   return null;
//   // }
//   /* ================================================================== */
//   /* EDITOR DETECTION — Updated for modern LinkedIn DOM                 */
//   /* ================================================================== */

//   function getOpenEditor() {
//     // Strategy 1: Broad Quill / Contenteditable lookups used by LinkedIn
//     const selectors = [
//       'div.ql-editor[contenteditable="true"]',
//       'div[contenteditable="true"][data-test-ql-editor-contenteditable="true"]',
//       'div[role="textbox"][contenteditable="true"]',
//       '.share-box-feed-entry__top-bar ~ div [contenteditable="true"]',
//       'div.artdeco-modal [contenteditable="true"]',
//       '[aria-label="Text editor for creating content"]',
//       '[aria-placeholder="What do you want to talk about?"]',
//       '[data-placeholder="What do you want to talk about?"]'
//     ];

//     for (const sel of selectors) {
//       const el = deepQuerySelector(sel);
//       if (el && isVisible(el)) {
//         console.log(LOG, 'Editor found via selector:', sel);
//         return el;
//       }
//     }

//     // Strategy 2: Deep search fallback across all contenteditable elements
//     const allEditable = deepQuerySelectorAll('[contenteditable="true"]');
//     for (const el of allEditable) {
//       if (el.closest && el.closest('#li-ai-assistant-root')) continue;
//       if (!isVisible(el)) continue;

//       const rect = el.getBoundingClientRect();
//       // Ensure it's large enough to be the main post creation text box
//       if (rect.width > 50 && rect.height > 20) {
//         console.log(LOG, 'Editor found via deep search fallback filtering');
//         return el;
//       }
//     }

//     return null;
//   }
//   /* ================================================================== */
//   /* "START A POST" TRIGGER DETECTION                                    */
//   /* ================================================================== */

//   function findStartPostTrigger() {
//     console.log(LOG, 'Searching for "Start a post" trigger...');

//     const visibleCandidates = [];
//     const hiddenCandidates = [];

//     function consider(el, reason) {
//       if (!el) return;
//       if (isVisible(el)) {
//         visibleCandidates.push({ el, reason });
//       } else {
//         hiddenCandidates.push({ el, reason });
//       }
//     }

//     // 1. Exact aria-label (collect ALL matches, not just the first)
//     document.querySelectorAll('button[aria-label="Start a post"]').forEach(el =>
//       consider(el, 'exact aria-label'));

//     // 2. Case-insensitive aria-label on buttons AND anchors
//     const allInteractive = document.querySelectorAll('button, a, [role="button"]');
//     for (const el of allInteractive) {
//       const label = (el.getAttribute('aria-label') || '').toLowerCase();
//       if (label.includes('start a post') || label.includes('create a post') || label.includes('write a post')) {
//         consider(el, 'aria-label scan: ' + label);
//       }
//     }

//     // 3. LinkedIn share-box class selectors
//     const shareBoxSelectors = [
//       '.share-box-feed-entry__trigger',
//       'button.share-box-feed-entry__trigger',
//       '.share-box-feed-entry__cta-button',
//       '[data-control-name="share.sharebox_feed_cta"]'
//     ];
//     for (const sel of shareBoxSelectors) {
//       document.querySelectorAll(sel).forEach(el => consider(el, 'class selector: ' + sel));
//     }

//     // 4. Text-content scan across ALL elements (not just buttons)
//     const scanTargets = document.querySelectorAll(
//       'button, a, [role="button"], div[tabindex], span[tabindex], div[role], span[role]'
//     );
//     for (const el of scanTargets) {
//       const text = (el.textContent || '').trim().toLowerCase();
//       if (text.length > 200 || !text) continue;
//       if (
//         text.includes('start a post') ||
//         text.includes('create a post') ||
//         text.includes('write a post')
//       ) {
//         const interactive = el.closest('button, a, [role="button"]');
//         consider(interactive || el, 'text scan: ' + text.substring(0, 40));
//       }
//     }

//     console.log(LOG, 'Trigger candidates — visible:', visibleCandidates.length,
//       'hidden:', hiddenCandidates.length);
//     visibleCandidates.forEach((c, i) => console.log(LOG, `  visible[${i}]`, c.reason, c.el));
//     hiddenCandidates.forEach((c, i) => console.log(LOG, `  hidden[${i}] (skipped)`, c.reason, c.el));

//     if (visibleCandidates.length > 0) {
//       // Prefer the share-box feed trigger if present among visible ones,
//       // since it's the most reliable path to the full composer modal.
//       const preferred = visibleCandidates.find(c => c.reason.indexOf('class selector') === 0
//         || c.reason.startsWith('class selector'));
//       const chosen = (preferred || visibleCandidates[0]).el;
//       console.log(LOG, 'Trigger chosen (visible):', chosen);
//       return chosen;
//     }

//     if (hiddenCandidates.length > 0) {
//       console.log(LOG, 'WARNING: only hidden trigger candidates found. ' +
//         'Falling back to first hidden candidate, but this likely will not work.');
//       return hiddenCandidates[0].el;
//     }

//     console.log(LOG, 'Trigger NOT found');
//     return null;
//   }

//   /* ================================================================== */
//   /* WAIT FOR EDITOR — uses polling instead of MutationObserver          */
//   /* because MutationObserver CANNOT observe into Shadow DOM subtrees    */
//   /* ================================================================== */

//   function waitForEditor(timeoutMs) {
//     return new Promise((resolve, reject) => {
//       const existing = getOpenEditor();
//       if (existing) { resolve(existing); return; }

//       console.log(LOG, 'Polling for editor (timeout:', timeoutMs, 'ms)...');
//       const startTime = Date.now();
//       let pollCount = 0;

//       const interval = setInterval(() => {
//         pollCount++;
//         const elapsed = Date.now() - startTime;
//         const found = getOpenEditor();

//         if (found) {
//           clearInterval(interval);
//           console.log(LOG, 'Editor appeared after', elapsed, 'ms (poll #' + pollCount + ')');
//           resolve(found);
//           return;
//         }

//         if (elapsed >= timeoutMs) {
//           clearInterval(interval);
//           console.log(LOG, 'Editor NOT found after', timeoutMs, 'ms (' + pollCount + ' polls)');

//           // Final diagnostic dump
//           dumpDiagnostics();

//           reject(new Error(
//             'The LinkedIn post composer was not detected.\n\n' +
//             'Please try:\n' +
//             '1. Click "Start a post" on LinkedIn to open the composer.\n' +
//             '2. Click inside the writing area.\n' +
//             '3. Then click "Insert into LinkedIn" again.\n\n' +
//             'Check Console (F12) for [LI-AI] diagnostic logs.'
//           ));
//         }
//       }, 500); // Poll every 500ms
//     });
//   }

//   /**
//    * Polls briefly just for a role="dialog" to appear, so we can confirm
//    * the click actually opened something before committing to the full
//    * editor wait / retry logic.
//    */
//   function waitForAnyDialog(timeoutMs) {
//     return new Promise((resolve) => {
//       const startTime = Date.now();
//       const interval = setInterval(() => {
//         const dialogs = deepQuerySelectorAll('[role="dialog"]');
//         const visibleDialog = dialogs.find(isVisible);
//         if (visibleDialog || Date.now() - startTime >= timeoutMs) {
//           clearInterval(interval);
//           resolve(!!visibleDialog);
//         }
//       }, 250);
//     });
//   }

//   /* ================================================================== */
//   /* DIAGNOSTIC DUMP                                                     */
//   /* ================================================================== */

//   function dumpDiagnostics() {
//     console.group(LOG + ' === DIAGNOSTIC DUMP ===');

//     // All contenteditable elements (deep)
//     const editables = deepQuerySelectorAll('[contenteditable="true"]');
//     console.log('All contenteditable (deep search):', editables.length);
//     editables.forEach((el, i) => {
//       const rect = el.getBoundingClientRect();
//       console.log(`  [${i}]`, {
//         tag: el.tagName,
//         class: (el.className || '').toString().substring(0, 80),
//         role: el.getAttribute ? el.getAttribute('role') : null,
//         ariaLabel: el.getAttribute ? el.getAttribute('aria-label') : null,
//         w: Math.round(rect.width),
//         h: Math.round(rect.height),
//         visible: isVisible(el)
//       });
//     });

//     // All shadow DOM hosts
//     const shadows = [];
//     document.querySelectorAll('*').forEach(el => {
//       if (el.shadowRoot) {
//         shadows.push({
//           tag: el.tagName,
//           id: el.id || '',
//           class: el.className.toString().substring(0, 40)
//         });
//       }
//     });
//     console.log('Shadow DOM hosts:', shadows.length, shadows);

//     // All dialogs/overlays
//     const dialogs = deepQuerySelectorAll('[role="dialog"]');
//     console.log('Dialogs (deep):', dialogs.length, dialogs.map(d => ({ visible: isVisible(d) })));

//     // All iframes
//     console.log('Iframes:', document.querySelectorAll('iframe').length);

//     // Current URL
//     console.log('URL:', window.location.href);

//     console.groupEnd();
//   }

//   /* ================================================================== */
//   /* CLICK HELPER — fuller event sequence for React-controlled buttons   */
//   /* ================================================================== */

//   function robustClick(el) {
//     el.scrollIntoView({ block: 'center', behavior: 'instant' });
//     el.focus();

//     const rect = el.getBoundingClientRect();
//     const cx = rect.left + rect.width / 2;
//     const cy = rect.top + rect.height / 2;
//     const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };

//     try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
//     try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (e) {}
//     try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
//     try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (e) {}
//     try { el.dispatchEvent(new MouseEvent('click', opts)); } catch (e) {}
//     // Belt-and-suspenders native click too
//     try { el.click(); } catch (e) {}
//   }

//   /* ================================================================== */
//   /* OPEN COMPOSER AND GET EDITOR                                        */
//   /* ================================================================== */

//   async function openComposerAndGetEditor() {
//     console.log(LOG, '--- openComposerAndGetEditor START ---');
//     console.log(LOG, 'URL:', window.location.href);

//     // PATH A: Composer already open
//     console.log(LOG, 'PATH A: Checking if editor is already open...');
//     const alreadyOpen = getOpenEditor();
//     if (alreadyOpen) {
//       console.log(LOG, 'PATH A: Editor found!');
//       return alreadyOpen;
//     }
//     console.log(LOG, 'PATH A: Editor not open.');

//     // PATH B: Find and click trigger
//     console.log(LOG, 'PATH B: Looking for trigger...');
//     const trigger = findStartPostTrigger();

//     if (trigger) {
//       console.log(LOG, 'PATH B: Trigger found:', trigger.tagName, (trigger.className || '').toString().substring(0, 40));

//       robustClick(trigger);

//       let dialogOpened = await waitForAnyDialog(3000);
//       console.log(LOG, 'PATH B: Dialog appeared within 3s?', dialogOpened);

//       if (!dialogOpened) {
//         console.log(LOG, 'PATH B: No dialog yet — retrying click once...');
//         robustClick(trigger);
//         dialogOpened = await waitForAnyDialog(3000);
//         console.log(LOG, 'PATH B: Dialog appeared after retry?', dialogOpened);
//       }

//       // Poll for editor for up to 15 seconds regardless, in case the
//       // dialog check itself missed a non-standard container.
//       return waitForEditor(15000);
//     }

//     // PATH C: No trigger found
//     console.log(LOG, 'PATH C: No trigger found');
//     dumpDiagnostics();

//     throw new Error(
//       'Could not find the "Start a post" button.\n\n' +
//       'Please:\n' +
//       '1. Click "Start a post" on LinkedIn yourself.\n' +
//       '2. Click inside the writing area.\n' +
//       '3. Click "Insert into LinkedIn" again.'
//     );
//   }

//   /* ================================================================== */
//   /* TEXT INSERTION                                                       */
//   /* ================================================================== */

//   function placeCursorAtEnd(el) {
//     try {
//       el.focus();
//       const range = document.createRange();
//       range.selectNodeContents(el);
//       range.collapse(false);
//       const sel = window.getSelection();
//       sel.removeAllRanges();
//       sel.addRange(range);
//     } catch (_) { /* non-fatal */ }
//   }

//   function insertTextSafely(editorEl, text) {
//     console.log(LOG, 'insertTextSafely: Starting...');

//     // Focus the editor
//     editorEl.focus();

//     // Set selection inside the editor
//     const range = document.createRange();
//     range.selectNodeContents(editorEl);
//     const sel = window.getSelection();
//     sel.removeAllRanges();
//     sel.addRange(range);

//     // Try execCommand first
//     const ok = document.execCommand('insertText', false, text);
//     console.log(LOG, 'execCommand result:', ok);

//     if (!ok) {
//       // Fallback: set textContent directly
//       console.log(LOG, 'Fallback: using textContent');
//       editorEl.textContent = text;
//     }

//     // Dispatch input events to notify React/Quill
//     editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
//     editorEl.dispatchEvent(new Event('change', { bubbles: true }));

//     // Place cursor at end
//     placeCursorAtEnd(editorEl);

//     // Verify
//     const actual = (editorEl.textContent || '').trim();
//     const sample = text.slice(0, 20).trim();
//     const verified = sample && actual.includes(sample);
//     console.log(LOG, 'Verified:', verified, '| Content:', actual.substring(0, 50) + '...');
//   }

//   /* ================================================================== */
//   /* PUBLIC API                                                          */
//   /* ================================================================== */

//   async function insertIntoLinkedInComposer(text) {
//     console.log(LOG, '=== insertIntoLinkedInComposer called ===');
//     const editor = await openComposerAndGetEditor();
//     insertTextSafely(editor, text);
//     console.log(LOG, '=== COMPLETE ===');
//   }

//   window.LiAiLinkedInEditor = { insertIntoLinkedInComposer };
//   console.log(LOG, 'linkedinEditor.js loaded');

// })();


(function () {
  const LOG = '[LI-AI]';

  /* ================================================================== */
  /* VISIBILITY & DOM HELPERS                                           */
  /* ================================================================== */

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function deepQuerySelector(selector, root = document) {
    const found = root.querySelector(selector);
    if (found) return found;
    
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        const inShadow = deepQuerySelector(selector, el.shadowRoot);
        if (inShadow) return inShadow;
      }
    }
    return null;
  }

  function deepQuerySelectorAll(selector, root = document) {
    const results = [...root.querySelectorAll(selector)];
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        results.push(...deepQuerySelectorAll(selector, el.shadowRoot));
      }
    }
    return results;
  }

  /* ================================================================== */
  /* ROBUST EDITOR DETECTION                                            */
  /* ================================================================== */

  function getOpenEditor() {
    // 1. Direct targeted selectors for LinkedIn's various layouts
    const selectors = [
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][data-test-ql-editor-contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      '.artdeco-modal [contenteditable="true"]',
      '[aria-label*="Text editor"]',
      '[data-placeholder*="What do you want"]'
    ];

    for (const sel of selectors) {
      const el = deepQuerySelector(sel);
      if (el && isVisible(el)) return el;
    }

    // 2. Fallback: Search all contenteditable elements on the page
    const allEditables = deepQuerySelectorAll('[contenteditable="true"]');
    for (const el of allEditables) {
      if (el.closest && el.closest('#li-ai-assistant-root')) continue;
      if (isVisible(el) && el.getBoundingClientRect().width > 40) {
        return el;
      }
    }

    return null;
  }

  /* ================================================================== */
  /* TRIGGER SEARCH & CLICK                                             */
  /* ================================================================== */

  function findStartPostTrigger() {
    const selectors = [
      'button[aria-label="Start a post"]',
      '.share-box-feed-entry__trigger',
      '.share-box-feed-entry__cta-button',
      'button.artdeco-button--muted'
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && isVisible(btn)) return btn;
    }

    // Text scan fallback for buttons/divs
    const allInteractive = document.querySelectorAll('button, a, [role="button"], div[tabindex]');
    for (const el of allInteractive) {
      const text = (el.textContent || '').trim().toLowerCase();
      if ((text.includes('start a post') || text.includes('create a post')) && isVisible(el)) {
        return el;
      }
    }

    return null;
  }

  function robustClick(el) {
    try {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      el.focus();
      const rect = el.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + 5, clientY: rect.top + 5 };
      
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
      el.dispatchEvent(new MouseEvent('click', opts));
      el.click();
    } catch (e) {
      console.error(LOG, 'Click failed', e);
    }
  }

  /* ================================================================== */
  /* TEXT INSERTION ENGINE                                              */
  /* ================================================================== */

  function insertTextSafely(editorEl, text) {
    editorEl.focus();

    // Select all existing content to replace or append nicely
    const range = document.createRange();
    range.selectNodeContents(editorEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Execute safe insertion command supported by modern rich text libraries (Quill/Draft.js)
    const success = document.execCommand('insertText', false, text);
    if (!success) {
      editorEl.textContent = text;
    }

    // Trigger framework change bindings (React)
    editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    editorEl.dispatchEvent(new Event('change', { bubbles: true }));
    console.log(LOG, 'Text inserted successfully.');
  }

  /* ================================================================== */
  /* MAIN HANDLER WITH CLIPBOARD FALLBACK                               */
  /* ================================================================== */

  async function insertIntoLinkedInComposer(text) {
    console.log(LOG, '=== Insertion Triggered ===');

    let editor = getOpenEditor();

    // If editor isn't open, try finding and clicking the "Start a post" button automatically
    if (!editor) {
      console.log(LOG, 'Editor not open. Attempting to open composer...');
      const trigger = findStartPostTrigger();
      if (trigger) {
        robustClick(trigger);
        
        // Wait up to 5 seconds for the modal/editor to load into DOM
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          editor = getOpenEditor();
          if (editor) break;
        }
      }
    }

    // If we successfully found or opened the editor, inject text
    if (editor) {
      insertTextSafely(editor, text);
      return;
    }

    // ULTIMATE FAILSAFE: If LinkedIn layout changes block DOM injection entirely, 
    // copy to clipboard so the user can just press Ctrl+V manually without breaking workflow.
    console.warn(LOG, 'Automatic injection failed. Falling back to clipboard.');
    try {
      await navigator.clipboard.writeText(text);
      alert(
        '⚠️ LinkedIn layout updated or composer not focused.\n\n' +
        'Your post has been copied to your clipboard! Please click "Start a post" on LinkedIn and press Ctrl+V to paste.'
      );
    } catch (err) {
      prompt('Copy your generated post below:', text);
    }
  }

  window.LiAiLinkedInEditor = { insertIntoLinkedInComposer };
  console.log(LOG, 'linkedinEditor.js loaded securely.');
})();