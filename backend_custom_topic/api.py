"""
FastAPI backend for the LinkedIn Post Generator.

This file is a thin REST layer on top of the existing, unmodified
business logic in post_generator.py, database.py and few_shot.py.
No AI/prompt logic, database schema, or generation logic has been
changed - this module only wires those functions to HTTP endpoints
so the new React frontend can talk to them.
"""

import chromadb
import os
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

# ---------------------------------------------------------------------------
# Existing backend logic (unmodified)
# ---------------------------------------------------------------------------
from post_generator import generate_post
from few_shot import FewShotPosts
from database import PostDatabase
from image_generator import build_image_prompt, generate_image_from_prompt, ImageGenerationError

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="LinkedIn Post Generator API",
    description="REST API wrapping the existing post generation, "
                 "few-shot retrieval and analytics logic.",
    version="1.0.0",
)

# Allow the Vite dev server (and any other configured origins) to call the API.
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons - constructed once, reused across requests (mirrors how the
# Streamlit app created them once per session).
db = PostDatabase()
fs = FewShotPosts()

LENGTH_OPTIONS = ["Short", "Medium", "Long"]
LANGUAGE_OPTIONS = ["English", "Hinglish"]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class GeneratePostRequest(BaseModel):
    # Select a known RAG topic OR enter a custom topic.
    topic: Optional[str] = Field(default=None, description="Existing topic/tag from the RAG dataset")
    custom_topic: Optional[str] = Field(default=None, min_length=1, description="A user-defined topic not covered by the RAG dataset")
    length: str = Field(..., description="Short | Medium | Long")
    language: str = Field(..., description="English | Hinglish")


class GeneratePostResponse(BaseModel):
    post: str
    topic: str
    length: str
    language: str
    character_count: int
    word_count: int
    reading_time_minutes: int


class HistoryItem(BaseModel):
    id: int
    topic: str
    language: str
    length: str
    post: str
    created_at: str


class AnalyticsResponse(BaseModel):
    total_posts: int
    most_used_topic: str
    most_used_language: str
    posts_today: int
    topic_distribution: List[dict]
    language_distribution: List[dict]


class TopicsResponse(BaseModel):
    topics: List[str]
    length_options: List[str]
    language_options: List[str]


class GenerateImageRequest(BaseModel):
    post: str = Field(..., min_length=10, description="Post text to generate an image for")
    topic: Optional[str] = Field(default=None, description="Topic/tag of the post")


class GenerateImageResponse(BaseModel):
    image_prompt: str
    prompt_source: str
    image: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _compute_stats(post_text: str):
    character_count = len(post_text)
    word_count = len(post_text.split())
    reading_time_minutes = max(1, word_count // 200)
    return character_count, word_count, reading_time_minutes


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/topics", response_model=TopicsResponse)
def get_topics():
    """Return the list of topics/tags available for post generation,
    plus the valid length/language options."""
    try:
        tags = fs.get_tags() or []
        return TopicsResponse(
            topics=sorted(tags),
            length_options=LENGTH_OPTIONS,
            language_options=LANGUAGE_OPTIONS,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load topics: {exc}")


@app.post("/api/generate-post", response_model=GeneratePostResponse)
def create_post(payload: GeneratePostRequest):
    """Generate a new LinkedIn post using the existing RAG + LLM pipeline.
    Reuses generate_post() from post_generator.py unchanged, which also
    saves the post to the database internally."""

    selected_topic = (payload.custom_topic or payload.topic or "").strip()
    if not selected_topic:
        raise HTTPException(
            status_code=422,
            detail="Provide either topic or custom_topic.",
        )

    # Custom topics deliberately bypass RAG so unrelated retrieved examples
    # cannot steer generation for a topic absent from the dataset.
    is_custom_topic = bool(payload.custom_topic and payload.custom_topic.strip())

    if payload.length not in LENGTH_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"length must be one of {LENGTH_OPTIONS}",
        )

    if payload.language not in LANGUAGE_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"language must be one of {LANGUAGE_OPTIONS}",
        )

    try:
        post_text = generate_post(
            payload.length,
            payload.language,
            selected_topic,
            # use_rag=not is_custom_topic,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Post generation failed: {exc}",
        )

    if not post_text or not post_text.strip():
        raise HTTPException(
            status_code=502,
            detail="The model returned an empty response. Please try again.",
        )

    character_count, word_count, reading_time_minutes = _compute_stats(post_text)

    return GeneratePostResponse(
        post=post_text,
        topic=selected_topic,
        length=payload.length,
        language=payload.language,
        character_count=character_count,
        word_count=word_count,
        reading_time_minutes=reading_time_minutes,
    )


@app.post("/api/generate-image", response_model=GenerateImageResponse)
def create_image(payload: GenerateImageRequest):
    """Generate an image matching a LinkedIn post using Hugging Face."""
    try:
        image_prompt, source = build_image_prompt(payload.post, payload.topic)
        image_data_url = generate_image_from_prompt(image_prompt, payload.topic, payload.post)
        return GenerateImageResponse(
            image_prompt=image_prompt,
            prompt_source=source,
            image=image_data_url,
        )
    except ImageGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed: {exc}",
        )


@app.get("/api/history", response_model=List[HistoryItem])
def get_history(search: Optional[str] = Query(default=None, description="Filter by topic, language or content")):
    """Return post history, optionally filtered by a search term across
    topic / language / post content (mirrors the Streamlit history search)."""
    try:
        posts = db.get_all_posts()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    items = [
        HistoryItem(
            id=row[0],
            topic=row[1],
            language=row[2],
            length=row[3],
            post=row[4],
            created_at=str(row[5]),
        )
        for row in posts
    ]

    if search:
        term = search.lower().strip()
        items = [
            item
            for item in items
            if term in item.topic.lower()
            or term in item.language.lower()
            or term in item.post.lower()
        ]

    return items


@app.get("/api/analytics", response_model=AnalyticsResponse)
@app.get("/api/stats", response_model=AnalyticsResponse)
def get_analytics():
    """Return the same analytics the Streamlit "Analytics Dashboard" dialog
    used to show: totals, most used topic/language, today's count and the
    topic/language distributions."""
    try:
        total_posts = db.get_total_posts()
        most_used_topic = db.get_most_used_topic()
        most_used_language = db.get_most_used_language()
        posts_today = db.get_posts_today()
        topic_distribution = [
            {"topic": row[0], "count": row[1]} for row in db.get_topic_distribution()
        ]
        language_distribution = [
            {"language": row[0], "count": row[1]} for row in db.get_language_distribution()
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    return AnalyticsResponse(
        total_posts=total_posts,
        most_used_topic=most_used_topic,
        most_used_language=most_used_language,
        posts_today=posts_today,
        topic_distribution=topic_distribution,
        language_distribution=language_distribution,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
