# LinkedIn AI Post Assistant

An AI-powered LinkedIn post generator. A FastAPI backend exposes the existing
post-generation, RAG (ChromaDB) retrieval and analytics logic as REST APIs,
and a React (Vite) + Tailwind CSS frontend replaces the previous Streamlit UI.

The Streamlit app has been fully removed. All existing functionality
(post generation, post history + search, analytics/statistics, database
persistence) has been preserved and reimplemented in the new frontend.

---

## Project Structure

```
project/
├── backend/
│   ├── api.py                 # FastAPI app - REST layer over the existing logic
│   ├── post_generator.py      # Unmodified: post generation + hashtag logic
│   ├── database.py            # Unmodified: SQLite history + analytics
│   ├── few_shot.py            # Unmodified: RAG retrieval via ChromaDB
│   ├── llm_helper.py          # Unmodified: Groq LLM client
│   ├── vector_db.py           # Utility script to (re)build the Chroma collection
│   ├── preprocess.py          # Utility script to build data/processed_posts.json
│   ├── data/
│   │   ├── raw_posts.json
│   │   └── processed_posts.json
│   ├── chroma_db/             # Persisted Chroma vector store
│   ├── post_history.db        # SQLite database (created automatically if missing)
│   ├── resources/
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios client + typed endpoint functions (no hardcoded URLs)
│   │   ├── components/         # Reusable UI: Sidebar, Topbar, cards, spinners, alerts...
│   │   ├── pages/               # Home, Generate Post, History, Analytics, Settings
│   │   ├── utils/               # localStorage preference helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── .env.example
│
└── README.md
```

---

## Backend Setup

**Python version:** 3.11 (matches the original project's virtual environment).

1. Create and activate a virtual environment from inside `backend/`:

   ```bash
   cd backend
   python -m venv venv

   # Windows
   venv\Scripts\activate

   # macOS / Linux
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables. Copy `.env.example` to `.env` and set your
   Groq API key (a working `.env` is already included for convenience, but
   verify the key is still valid):

   ```bash
   cp .env.example .env
   # then edit .env and set GROQ_API_KEY=...
   ```

   | Variable        | Description                                                        | Default                                            |
   |-----------------|---------------------------------------------------------------------|-----------------------------------------------------|
   | `GROQ_API_KEY`  | API key for the Groq-hosted LLM used by `llm_helper.py`             | *(required)*                                       |
   | `CORS_ORIGINS`  | Comma-separated origins allowed to call the API                     | `http://localhost:5173,http://127.0.0.1:5173`      |

4. Start the backend:

   ```bash
   python api.py
   ```

   This starts a Uvicorn server on `http://localhost:8000` with auto-reload.
   You can also run it directly with Uvicorn:

   ```bash
   uvicorn api:app --reload --host 0.0.0.0 --port 8000
   ```

   Interactive API docs are available at `http://localhost:8000/docs`.

### Rebuilding the vector store / processed posts (optional)

These are the same utility scripts the original project used and are only
needed if you change `data/raw_posts.json`:

```bash
python preprocess.py   # rebuilds data/processed_posts.json from raw_posts.json
python vector_db.py     # rebuilds the Chroma collection from processed_posts.json
```

---

## Frontend Setup

**Node version:** 18+ recommended.

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Configure the API URL. A `.env` file is already included pointing at the
   local backend; copy `.env.example` again if you ever need to reset it:

   ```bash
   cp .env.example .env
   ```

   | Variable              | Description                          | Default                          |
   |------------------------|---------------------------------------|-----------------------------------|
   | `VITE_API_BASE_URL`   | Base URL of the FastAPI backend       | `http://localhost:8000/api`      |

3. Run the dev server:

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

4. Production build (optional):

   ```bash
   npm run build
   npm run preview
   ```

---

## Running Both Together

1. Start the backend first: `cd backend && python api.py` (port `8000`).
2. Start the frontend: `cd frontend && npm run dev` (port `5173`).
3. Open `http://localhost:5173` in your browser.

The frontend is pre-configured to talk to `http://localhost:8000/api`, so no
additional code changes are required.

---

## API Endpoints

| Method | Endpoint             | Description                                                        |
|--------|-----------------------|----------------------------------------------------------------------|
| GET    | `/api/health`         | Health check                                                        |
| GET    | `/api/topics`         | List of topics/tags + valid length/language options                 |
| POST   | `/api/generate-post`  | Generate a post `{ topic, length, language }` → post + stats        |
| GET    | `/api/history`        | Post history, optional `?search=` query across topic/language/post  |
| GET    | `/api/analytics`      | Totals, most used topic/language, posts today, distributions        |

All business logic (prompting, RAG retrieval, hashtag generation, database
reads/writes) is untouched and still lives in `post_generator.py`,
`few_shot.py` and `database.py` - `api.py` only wires HTTP requests to those
existing functions.

---

## Frontend Features

- **Home** - welcome hero, quick stats, quick links, recent posts preview.
- **Generate Post** - topic / length / language selectors, generate button,
  generated post preview with character count, word count, reading time,
  copy-to-clipboard and download-as-`.txt` buttons, plus a right sidebar with
  live statistics, popular topics and recent posts.
- **History** - debounced search across topic, language and post content,
  backed by the existing SQLite history table.
- **Analytics** - total posts, posts today, most used topic/language, and
  topic/language distribution bar charts (replacing the Streamlit
  `st.bar_chart` calls).
- **Settings** - live backend connection status and saved default
  length/language preferences (persisted in the browser).

All API calls go through a single reusable Axios instance
(`src/api/client.js`) with centralized, user-friendly error handling for
network failures, validation errors (422), and server errors (5xx).

---

## Notes

- The SQLite database (`post_history.db`) and Chroma vector store
  (`chroma_db/`) from the original project are included as-is, so existing
  history and RAG examples keep working immediately.
- No Streamlit package, component, or page remains anywhere in the project.
