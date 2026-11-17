# LinkedIn AI Post Assistant ? Chrome Extension

A Manifest V3 Chrome Extension providing a floating AI assistant on LinkedIn. It slides in a panel supporting three functions: **Generate**, **History**, and **Analytics** ? fully compatible with your existing FastAPI backend (`backend/api.py`).

*Note: The image generation feature has been completely removed to match project specifications.*

---

## Folder Structure

```
chrome-extension/
??? manifest.json                     # MV3 configuration
??? background.js                     # Background service worker (proxies API requests)
??? content.js                        # Injects the floating widget and coordinates state
??? README.md                         # This documentation file
??? icons/                            # Extension icon assets
?   ??? icon16.png
?   ??? icon32.png
?   ??? icon48.png
?   ??? icon128.png
?   ??? icon.svg
??? panel/
    ??? services/
    ?   ??? api.js                    # Message wrapper for backend queries
    ??? styles/
    ?   ??? panel.css                 # Shadow-DOM scoped panel CSS styles
    ??? utils/
        ??? dom.js                    # DOM tree construction helper and SVG icons
        ??? linkedinEditor.js         # Stable, Quill-compatible LinkedIn composer writer
```

---

## How to Load in Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle the **Developer mode** switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `chrome-extension/` directory.

---

## FastAPI Backend Setup

Make sure your backend server is active before launching:
```bash
cd backend
python api.py
```
The server will run on `http://localhost:8000`.

---

## Features & Verification Guide

### 1. Panel Injection & Sliding View
* Go to `https://www.linkedin.com`.
* Look for the blue floating action button (FAB) in the bottom-right corner.
* Click the FAB to slide the panel in/out. You can also close it using the Escape key or clicking the dark overlay.

### 2. Post Generation
* Navigate to the **Generate** tab.
* Select a topic from the dropdown, choose your preferred Length and Language.
* Click **Generate LinkedIn Post**. A loading animation will spin.
* The output post will render along with character counts, word counts, and estimated reading time.

### 3. Copy, Download & Insertion
* **Copy**: Copies the output text directly to your clipboard.
* **Download**: Downloads the post as a timestamped `.txt` text file.
* **Insert into LinkedIn**: 
  * Automatically verifies you are on `linkedin.com/feed`.
  * Verifies if the post composer modal is open. If not, it automatically clicks **Start a post**.
  * Waits for the contenteditable input to load.
  * Focuses the editor and safely inserts the generated text, keeping Quill's model updated.

### 4. History Feed
* Navigate to the **History** tab.
* Searches through past posts in the SQLite database with debounced input filtering.

### 5. Analytics
* Navigate to the **Analytics** tab.
* Renders post statistics and custom-drawn CSS bar charts illustrating topic and language frequencies.
