"""
image_generator.py
------------------
Generates professional LinkedIn post illustration images using Google Gemini
(google-genai SDK, model: gemini-2.5-flash-image) and reference prompts from
the processed LinkedIn dataset or dynamic LLM adaptation via Groq.
"""

import base64
import io
import json
import logging
import os
import random
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types

from llm_helper import llm

load_dotenv()

logger = logging.getLogger(__name__)


class ImageGenerationError(Exception):
    """Custom exception raised when prompt generation or image synthesis fails."""
    pass


# Configuration helpers reading from environment (with defaults)
def get_gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def get_gemini_image_model() -> str:
    return os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image").strip()


def get_image_prompt_mode() -> str:
    return os.getenv("IMAGE_PROMPT_MODE", "hybrid").strip().lower()


def get_image_aspect_ratio() -> str:
    return os.getenv("IMAGE_ASPECT_RATIO", "16:9").strip()


def is_mock_enabled() -> bool:
    val = os.getenv("MOCK_IMAGE_GENERATION", "false").strip().lower()
    return val in ("1", "true", "yes", "on")


# Suffix appended to all prompts to ensure high quality and prevent unwanted elements
PROMPT_SUFFIX = (
    "\n\nMANDATORY VISUAL STYLE — TECHNICAL INFOGRAPHIC:\n"
    "Create a detailed, information-rich technical infographic, similar "
    "to a professionally designed software architecture diagram or "
    "engineering workflow poster. Do NOT create a decorative LinkedIn "
    "social media card or a generic editorial illustration.\n\n"

    "LAYOUT:\n"
    "- Use a wide 16:9 canvas with a clean, structured composition.\n"
    "- Organize information into clearly separated, numbered sections.\n"
    "- Use component cards, colored section headers, and directional arrows.\n"
    "- Show the relationships and flow between system components.\n"
    "- Include appropriate technical icons, databases, documents, "
    "servers, AI models, and flowchart symbols where relevant.\n"
    "- Use a consistent grid, aligned elements, and balanced spacing.\n"
    "- Make the diagram information-dense without becoming cluttered.\n\n"

    "CONTENT:\n"
    "- Derive the actual components and workflow from the LinkedIn post.\n"
    "- Use meaningful labels for components and stages.\n"
    "- Include short explanations inside relevant sections.\n"
    "- Use arrows to communicate the correct processing sequence.\n"
    "- Adapt the architecture to the subject instead of reusing "
    "the same diagram for every post.\n"
    "- Never invent technical components or claim an unsupported "
    "workflow is present in the source post.\n\n"

    "VISUAL DESIGN:\n"
    "- Professional engineering documentation aesthetic.\n"
    "- White or very light background with subtle section colors.\n"
    "- Use blue, teal, green, purple, and amber to distinguish stages.\n"
    "- Use readable typography, crisp borders, and high contrast.\n"
    "- Use flat vector graphics and clean technical illustrations.\n\n"

    "STRICTLY AVOID:\n"
    "- Large empty cards containing only a few lines of text.\n"
    "- Decorative concentric circles and abstract neural networks.\n"
    "- Random connecting lines without meaningful relationships.\n"
    "- A generic dark background with a glowing central circle.\n"
    "- Unrelated stock illustrations or oversized decorative elements.\n"
    "- Watermarks, company logos, and unnecessary branding.\n\n"

    "OUTPUT: A complete technical infographic that explains the topic "
    "visually, with structured sections, readable labels, and "
    "meaningful connections. Maintain a 16:9 composition."
)
# Lazy-loaded in-memory cache mapping normalized topic -> list of dataset image_prompts
_TOPIC_PROMPTS_CACHE: Optional[Dict[str, List[str]]] = None


def get_topic_prompts_map() -> Dict[str, List[str]]:
    """Lazy-load and cache topic -> list of image_prompt strings from processed_posts.json."""
    global _TOPIC_PROMPTS_CACHE
    if _TOPIC_PROMPTS_CACHE is not None:
        return _TOPIC_PROMPTS_CACHE

    # Resolve path relative to this file
    data_path = os.path.join(os.path.dirname(__file__), "data", "processed_posts.json")
    prompts_map: Dict[str, List[str]] = {}

    if os.path.exists(data_path):
        try:
            with open(data_path, "r", encoding="utf-8") as f:
                records = json.load(f)
            for rec in records:
                img_prompt = rec.get("image_prompt")
                if not img_prompt:
                    continue
                tags = rec.get("tags") or []
                for tag in tags:
                    cleaned_tag = str(tag).strip().lower()
                    if cleaned_tag:
                        prompts_map.setdefault(cleaned_tag, []).append(str(img_prompt).strip())
        except Exception as exc:
            logger.warning("Could not load image prompts from dataset: %s", exc)

    _TOPIC_PROMPTS_CACHE = prompts_map
    return _TOPIC_PROMPTS_CACHE


def get_dataset_prompt_for_topic(topic: Optional[str]) -> Optional[str]:
    """Retrieve a random dataset image prompt for the given topic (case-insensitive)."""
    if not topic:
        return None
    cleaned = topic.strip().lower()
    prompts_map = get_topic_prompts_map()
    prompts = prompts_map.get(cleaned)
    if prompts:
        return random.choice(prompts)
    return None


def build_image_prompt(post_text: str, topic: Optional[str] = None) -> Tuple[str, str]:
    """
    Build a tailored image prompt based on the post text, optional topic, and configured mode.
    Modes:
      - 'hybrid' (default): Uses the dataset prompt as a reference and calls Groq LLM to adapt
        it to the post concepts (max ~70 words).
      - 'dataset': Uses the dataset prompt directly without an LLM call.
      - 'llm': Ignores the dataset and writes a prompt from the post only.
    Fallbacks:
      - If no dataset prompt exists for topic -> generates a prompt from the post.
      - If Groq LLM fails -> falls back to dataset prompt if available, else first ~300 chars of post.
    Returns:
      (final_prompt, source) where source is 'dataset+post', 'dataset', or 'post'.
    """
    mode = get_image_prompt_mode()
    post_cleaned = post_text.strip()
    dataset_prompt = get_dataset_prompt_for_topic(topic)

    # 1. Dataset mode: use prompt directly if available
    if mode == "dataset":
        if dataset_prompt:
            return f"{dataset_prompt}{PROMPT_SUFFIX}", "dataset"
        # Fallback to LLM post-only if no dataset prompt
        return _build_prompt_from_post_only(post_cleaned)

    # 2. LLM-only mode: ignore dataset
    if mode == "llm":
        return _build_prompt_from_post_only(post_cleaned)

    # 3. Hybrid mode (default): combine dataset reference with post concepts
    if dataset_prompt:
        try:
            instruction = (
    "You are a senior technical infographic designer and software "
    "architecture visualization expert.\n\n"

    "TASK:\n"
    "Design an image-generation prompt for a detailed technical "
    "infographic that explains the actual subject of the LinkedIn post.\n\n"

    "REFERENCE USAGE:\n"
    "Use the reference prompt only for visual inspiration. "
    "Never copy its subject or layout when they do not match the post.\n\n"

    "CONTENT ANALYSIS:\n"
    "Identify the main technical concept, its components, and the "
    "relationships between them. Determine whether the post describes "
    "a pipeline, architecture, comparison, lifecycle, or conceptual "
    "system. Select a suitable diagram layout accordingly.\n\n"

    "VISUAL REQUIREMENTS:\n"
    "1. Use a structured 16:9 technical infographic layout.\n"
    "2. Divide complex workflows into numbered sections.\n"
    "3. Represent components using clearly separated visual cards.\n"
    "4. Connect related components with meaningful directional arrows.\n"
    "5. Include short, relevant labels and explanations.\n"
    "6. Use technical icons and diagrams appropriate to the topic.\n"
    "7. Use a clean light background, readable typography, and "
    "a consistent blue, teal, green, purple, and amber palette.\n"
    "8. Make the visual content specific to the post.\n"
    "9. Avoid generic decorative circles, empty cards, and abstract "
    "technology graphics unrelated to the topic.\n"
    "10. Do not invent technical details absent from the source.\n\n"

    "OUTPUT RULES:\n"
    "Return one detailed image-generation prompt in 100-150 words. "
    "Return only the prompt, without headings or explanations.\n\n"

    f"REFERENCE IMAGE PROMPT:\n{dataset_prompt}\n\n"
    f"LINKEDIN POST:\n{post_cleaned}"
)
            response = llm.invoke(instruction)
            adapted_prompt = response.content.strip().strip('"\'')
            if adapted_prompt:
                return f"{adapted_prompt}{PROMPT_SUFFIX}", "dataset+post"
        except Exception as exc:
            logger.warning("Groq hybrid prompt adaptation failed: %s; falling back to dataset prompt.", exc)
            return f"{dataset_prompt}{PROMPT_SUFFIX}", "dataset"

    # If no dataset prompt was found for the topic, fall back to post-only prompt
    return _build_prompt_from_post_only(post_cleaned)


def _build_prompt_from_post_only(post_cleaned: str) -> Tuple[str, str]:
    """Helper to generate an image prompt purely from post text with fallback."""
    try:
        instruction = (
    "You are an expert technical infographic designer.\n\n"

    "Create one detailed image-generation prompt for a technical "
    "infographic representing the following LinkedIn post.\n\n"

    "Requirements:\n"
    "- Wide 16:9 engineering infographic.\n"
    "- Identify the central concept and relevant supporting components.\n"
    "- Use numbered stages when explaining a workflow.\n"
    "- Use component cards, meaningful arrows, and technical icons.\n"
    "- Include concise labels and explanations.\n"
    "- Select a layout appropriate to the actual subject.\n"
    "- Use a clean light background, readable text, and a "
    "professional blue, teal, green, purple, and amber palette.\n"
    "- Make the visual specific to the post, not a generic AI graphic.\n"
    "- Do not invent technical details unsupported by the post.\n"
    "- Do not prohibit text, because labels are required.\n"
    "- Avoid decorative circles, empty cards, and generic social "
    "media templates.\n\n"

    "Return only the image-generation prompt, without explanations.\n\n"
    f"LINKEDIN POST:\n{post_cleaned}"
)
        response = llm.invoke(instruction)
        prompt_text = response.content.strip().strip('"\'')
        if prompt_text:
            return f"{prompt_text}{PROMPT_SUFFIX}", "post"
    except Exception as exc:
        logger.warning("Groq post-only prompt generation failed: %s; falling back to post snippet.", exc)

    # Ultimate fallback: post excerpt
    fallback_prompt = post_cleaned[:300].replace("\n", " ").strip()
    return f"A modern professional editorial illustration representing: {fallback_prompt}{PROMPT_SUFFIX}", "post"


def _get_font(size: int, bold: bool = False):
    """Attempt to load standard system fonts with graceful fallback to default bitmap font."""
    font_candidates = (
        ["arialbd.ttf", "segoeuib.ttf", "CalibriBold.ttf", "DejaVuSans-Bold.ttf"]
        if bold
        else ["arial.ttf", "segoeui.ttf", "Calibri.ttf", "DejaVuSans.ttf"]
    )
    for name in font_candidates:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


def _get_theme_colors(topic: Optional[str], post_text: Optional[str]):
    """Determine dynamic card accents matching the post content."""
    combined = f"{topic or ''} {post_text or ''}".lower()
    if any(k in combined for k in ["job", "career", "interview", "resume", "hire", "hiring", "talent", "hr"]):
        # Emerald / Mint for career & job search
        return (5, 150, 105), (16, 185, 129), (110, 231, 183)
    elif any(k in combined for k in ["marketing", "brand", "content", "growth", "social", "creator", "audience"]):
        # Purple / Violet for marketing & growth
        return (124, 58, 237), (168, 85, 247), (216, 180, 254)
    elif any(k in combined for k in ["business", "finance", "money", "leadership", "invest", "sales", "executive"]):
        # Amber / Gold for business & leadership
        return (217, 119, 6), (245, 158, 11), (252, 211, 77)
    else:
        # Cyan / Blue for Tech, AI & Software
        return (10, 102, 194), (56, 189, 248), (125, 211, 252)


def generate_local_mock_image(
    prompt: str,
    topic: Optional[str] = None,
    post_text: Optional[str] = None,
) -> str:
    """
    Generate an offline, professional 16:9 LinkedIn illustration card (1280x720) locally using Pillow.
    Dynamically extracts the post headline, theme colors, and takeaways so the graphic is directly
    related to the generated post.
    Requires no external API keys or quota. Returns a JPEG base64 data URL.
    """
    width, height = 1280, 720
    img = Image.new("RGB", (width, height), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    badge_fill, accent, light_accent = _get_theme_colors(topic, post_text)

    # 1. Subtle horizontal gradient background
    for y in range(height):
        ratio = y / height
        r = int(15 + (10 - 15) * ratio)
        g = int(23 + (35 - 23) * ratio)
        b = int(42 + (65 - 42) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # 2. Modern tech grid lines
    for i in range(0, width, 60):
        draw.line([(i, 0), (i, height)], fill=(30, 41, 59), width=1)
    for j in range(0, height, 60):
        draw.line([(0, j), (width, j)], fill=(30, 41, 59), width=1)

    # 3. Decorative abstract neural / tech nodes on the right
    draw.ellipse([830, 100, 1170, 440], outline=accent, width=3)
    draw.ellipse([870, 140, 1130, 400], outline=light_accent, width=2)
    draw.ellipse([910, 180, 1090, 360], outline=(71, 85, 105), width=1)
    draw.ellipse([975, 245, 1025, 295], fill=accent)

    nodes = [(880, 200), (1050, 160), (1120, 300), (940, 340), (1020, 250), (1090, 410)]
    for n in nodes:
        draw.ellipse([n[0] - 7, n[1] - 7, n[0] + 7, n[1] + 7], fill=(255, 255, 255))
    for i in range(len(nodes) - 1):
        draw.line([nodes[i], nodes[i + 1]], fill=light_accent, width=2)

    # 4. Content card container on left/center
    draw.rounded_rectangle([60, 60, 800, 660], radius=20, fill=(15, 23, 42), outline=(51, 65, 85), width=2)

    # Topic badge
    topic_text = (topic or "LINKEDIN POST").strip().upper()
    badge_font = _get_font(13, bold=True)
    badge_width = len(topic_text) * 9 + 28
    draw.rounded_rectangle([90, 95, 90 + badge_width, 133], radius=6, fill=badge_fill)
    draw.text((104, 105), topic_text, fill=(255, 255, 255), font=badge_font)

    # Extract headline and key bullets directly from post_text
    headline = "KEY TAKEAWAYS & INSIGHTS"
    bullets: List[str] = []

    if post_text:
        raw_lines = [l.strip() for l in post_text.split("\n") if l.strip()]
        # Filter out hashtag-only lines
        content_lines = [l for l in raw_lines if not l.startswith("#")]
        if content_lines:
            first_line = content_lines[0].replace('"', "").replace("'", "")
            if len(first_line) > 52:
                headline = first_line[:49].rstrip() + "..."
            else:
                headline = first_line

            for line in content_lines[1:]:
                cleaned_line = line.lstrip("0123456789.-•* ").strip()
                if cleaned_line and len(cleaned_line) > 10:
                    if len(cleaned_line) > 65:
                        cleaned_line = cleaned_line[:62].rstrip() + "..."
                    bullets.append(cleaned_line)
                if len(bullets) >= 3:
                    break

    # Fallback to prompt if no bullets found in post
    if not bullets:
        clean_display_prompt = prompt.split("Style rules:")[0].strip()
        words = clean_display_prompt.split()
        curr: List[str] = []
        for w in words:
            curr.append(w)
            if len(" ".join(curr)) > 45:
                bullets.append(" ".join(curr))
                curr = []
            if len(bullets) >= 4:
                break
        if curr and len(bullets) < 4:
            bullets.append(" ".join(curr))

    # Headline title
    title_font = _get_font(23, bold=True)
    draw.text((90, 155), headline, fill=(248, 250, 252), font=title_font)

    # Accent underline beneath headline
    draw.line([(90, 195), (320, 195)], fill=accent, width=3)

    # Bullet points / takeaways
    body_font = _get_font(17)
    y_pos = 225

    for b in bullets:
        draw.polygon([(90, y_pos + 4), (101, y_pos + 10), (90, y_pos + 16)], fill=accent)
        draw.text((118, y_pos), b, fill=(226, 232, 240), font=body_font)
        y_pos += 48

    # Footer separator and branding
    draw.line([(90, 595), (770, 595)], fill=(51, 65, 85), width=1)
    footer_font = _get_font(14)
    draw.text((90, 615), "LinkedIn AI Assistant • 16:9 Illustration Asset", fill=(148, 163, 184), font=footer_font)

    # Save to JPEG buffer
    out_buf = io.BytesIO()
    img.save(out_buf, format="JPEG", quality=90)
    b64_str = base64.b64encode(out_buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"


def generate_image_from_prompt(
    prompt: str,
    topic: Optional[str] = None,
    post_text: Optional[str] = None,
) -> str:
    """
    Generate a real image using Google Gemini.

    Local mock generation is available only when explicitly enabled.
    API configuration and quota failures are reported instead of
    silently returning the fixed mock template.
    """

    if is_mock_enabled():
        logger.warning(
            "MOCK MODE ENABLED: Returning the fixed Pillow template, "
            "not an AI-generated image."
        )
        return generate_local_mock_image(prompt, topic, post_text)

    api_key = get_gemini_api_key()

    if not api_key:
        raise ImageGenerationError(
            "GEMINI_API_KEY is missing. Configure your API key "
            "in the backend environment."
        )

    model_id = get_gemini_image_model()
    aspect_ratio = get_image_aspect_ratio()

    try:
        client = genai.Client(api_key=api_key)

        logger.info(
            "Generating REAL AI image with Gemini model: %s",
            model_id,
        )

        response = client.models.generate_content(
            model=model_id,
            contents=(
                "Create a detailed technical infographic, not a generic "
                "social media card. Follow the supplied image prompt. "
                "Use structured sections, meaningful technical components, "
                "directional arrows, readable labels, and a layout specific "
                "to the subject. Avoid decorative circles, empty cards, "
                "and generic abstract technology backgrounds.\n\n"
                f"IMAGE PROMPT:\n{prompt}\n\n"
                f"LINKEDIN POST:\n{post_text or topic or ''}"
            ),
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio,
                ),
            ),
        )

    except Exception as exc:
        err_msg = str(exc).replace(api_key, "[REDACTED]")
        logger.exception("Gemini image generation failed.")

        if (
            "429" in err_msg
            or "quota" in err_msg.lower()
            or "resource_exhausted" in err_msg.lower()
        ):
            raise ImageGenerationError(
                "Gemini quota or rate limit reached. "
                "Check your API quota and billing."
            ) from exc

        raise ImageGenerationError(
            f"Gemini image generation failed: {err_msg}"
        ) from exc

    image_bytes = None

    for candidate in getattr(response, "candidates", []) or []:
        content = getattr(candidate, "content", None)

        for part in getattr(content, "parts", []) or []:
            inline_data = getattr(part, "inline_data", None)

            if inline_data and getattr(inline_data, "data", None):
                image_bytes = inline_data.data
                break

        if image_bytes:
            break

    if not image_bytes:
        raise ImageGenerationError(
            "Gemini did not return image data. "
            "Check the model response and image-generation configuration."
        )

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            pil_img = source.convert("RGB")

        out_buf = io.BytesIO()
        pil_img.save(out_buf, format="JPEG", quality=95)

        b64_str = base64.b64encode(
            out_buf.getvalue()
        ).decode("utf-8")

        logger.info(
            "Successfully generated real Gemini image: %s",
            pil_img.size,
        )

        return f"data:image/jpeg;base64,{b64_str}"

    except Exception as exc:
        raise ImageGenerationError(
            f"Failed to process generated image: {exc}"
        ) from exc