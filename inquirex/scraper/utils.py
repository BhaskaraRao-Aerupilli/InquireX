"""Utility functions for web scraping.

This module provides helper functions for extracting content, images,
and processing HTML from web pages.
"""

import hashlib
import logging
import re
from urllib.parse import parse_qs, urljoin, urlparse
from typing import List, Optional

import bs4
from bs4 import BeautifulSoup


def _extract_entity_keywords(query: str) -> List[str]:
    """
    Derive a compact set of entity-level keywords from the user query.
    These are used to validate that scraped images are actually relevant
    to the search topic rather than site-chrome (logos, author headshots, etc.)
    """
    if not query:
        return []
    # Strip common filler words, keep meaningful tokens
    stop = {
        "a", "an", "the", "in", "on", "at", "to", "for", "of", "and",
        "or", "is", "was", "are", "were", "be", "been", "what", "who",
        "how", "why", "when", "where", "about", "with", "by", "from",
        "vs", "versus", "vs.", "research", "analysis", "report",
    }
    tokens = re.findall(r"[a-zA-Z0-9']+", query.lower())
    keywords = [t for t in tokens if len(t) > 2 and t not in stop]
    return keywords


def _image_context_score(img_tag, surrounding_text: str, entity_keywords: List[str]) -> int:
    """
    Return +score based on how many entity keywords appear in the image's
    alt text, title, or surrounding paragraph text.
    """
    if not entity_keywords:
        return 0  # no filter if no keywords

    alt = img_tag.get("alt", "").lower()
    title = img_tag.get("title", "").lower()
    ctx = (alt + " " + title + " " + surrounding_text.lower())
    hits = sum(1 for kw in entity_keywords if kw in ctx)
    return hits


def _get_surrounding_text(img_tag, max_chars: int = 300) -> str:
    """Extract text from the parent and grandparent elements of the img tag."""
    texts = []
    el = img_tag.parent
    for _ in range(3):  # walk up 3 levels
        if el is None:
            break
        raw = el.get_text(separator=" ", strip=True)
        if raw:
            texts.append(raw[:max_chars])
        el = el.parent
    return " ".join(texts)


def _derive_caption(img_tag, page_title: str, soup: BeautifulSoup) -> str:
    """
    Build a meaningful 3-6 word caption:
    1. Prefer the img alt text if descriptive (>10 chars)
    2. Fall back to the nearest heading above the image
    3. Fall back to the first 5 words of the page title
    4. Last resort: 'Research Visual'
    """
    alt = img_tag.get("alt", "").strip()
    if alt and len(alt) > 10:
        # Trim to ~60 chars so captions stay readable
        return alt[:60].rstrip()

    # Nearest heading (h1..h4) above the image
    el = img_tag.parent
    for _ in range(6):
        if el is None:
            break
        heading = el.find_previous(["h1", "h2", "h3", "h4"])
        if heading:
            text = heading.get_text(strip=True)
            if text and len(text) > 3:
                words = text.split()[:6]
                return " ".join(words)
            break
        el = el.parent

    # First 5 words of page title
    if page_title:
        words = page_title.split()[:5]
        if words:
            return " ".join(words)

    return "Research Visual"


def get_relevant_images(
    soup: BeautifulSoup,
    url: str,
    query: str = "",
    entity_filter_threshold: int = 1
) -> list:
    """Extract relevant, high-resolution content images from the page with captions.

    Args:
        soup: Parsed BeautifulSoup page.
        url: Source URL (used to resolve relative image paths).
        query: The original user research query — used for entity-context filtering.
        entity_filter_threshold: Minimum number of entity keyword hits required
            in image context (alt/title/surrounding text) to keep the image.
            Set to 0 to disable entity filtering.
    """
    image_urls = []

    junk_patterns = (
        ".svg", ".ico", ".gif", "pixel", "avatar", "favicon", "logo", "tracking",
        "badge", "spinner", "1x1", "ad-", "advertisement", "doubleclick", "button",
        "icon", "share", "placeholder", "banner", "sponsor", "w_64", "w_32", "w_100",
        "64x64", "32x32", "fallback", "author", "profile", "thumb_", "headshot",
        "mugshot", "portrait_small", "site-logo", "brand-logo", "nav-logo",
    )

    # Junk alt/title words — images whose caption contains these are site-chrome
    caption_junk = frozenset([
        "logo", "icon", "advertisement", "banner", "avatar", "thumbnail",
        "headshot", "author photo", "staff photo", "profile picture", "site icon",
        "company logo", "brand logo",
    ])

    entity_keywords = _extract_entity_keywords(query) if query else []
    page_title = extract_title(soup)

    try:
        all_images = soup.find_all("img", src=True)

        for img in all_images:
            img_src = urljoin(url, img["src"])
            if not img_src.startswith(("http://", "https://")):
                continue

            src_lower = img_src.lower()
            if any(junk in src_lower for junk in junk_patterns):
                continue

            # Explicit dimension filter
            width = parse_dimension(img.get("width", ""))
            height = parse_dimension(img.get("height", ""))
            if width and width < 220:
                continue
            if height and height < 160:
                continue

            score = 1

            # Semantic class bonus
            classes = [c.lower() for c in img.get("class", [])]
            if any(cls in classes for cls in ["featured", "hero", "lead", "main", "content", "article-image", "figure"]):
                score += 3

            # Alt / title caption
            alt_text = img.get("alt", "").strip()
            title_text = img.get("title", "").strip()
            caption_raw = alt_text or title_text

            if caption_raw:
                caption_lower = caption_raw.lower()
                if any(junk in caption_lower for junk in caption_junk):
                    continue
                if len(caption_raw) > 10:
                    score += 2

            # Dimension size bonus
            if width and height:
                if width >= 1200 or height >= 700:
                    score += 2
                elif width >= 600 or height >= 400:
                    score += 1

            # --- Entity context relevance filter ---
            if entity_keywords and entity_filter_threshold > 0:
                surrounding = _get_surrounding_text(img)
                ctx_hits = _image_context_score(img, surrounding, entity_keywords)
                if ctx_hits < entity_filter_threshold:
                    # Image has no entity keyword match -- likely site-chrome
                    continue
                score += ctx_hits  # reward contextually relevant images

            # Build a meaningful dynamic caption
            caption = _derive_caption(img, page_title, soup)

            image_urls.append({
                "url": img_src,
                "score": score,
                "alt": caption,
                "title": title_text or caption,
            })

        # Sort by score descending, return top 10
        sorted_images = sorted(image_urls, key=lambda x: x["score"], reverse=True)
        return sorted_images[:10]

    except Exception as e:
        logging.error(f"Error in get_relevant_images: {e}")
        return []


def parse_dimension(value: str) -> Optional[int]:
    """Parse dimension value, handling px units"""
    if not value:
        return None
    if value.lower().endswith("px"):
        value = value[:-2]
    try:
        return int(float(value))
    except (ValueError, TypeError) as e:
        logging.debug("Could not parse dimension value %r: %s", value, e)
        return None


def extract_title(soup: BeautifulSoup) -> str:
    """Extract the title text from the BeautifulSoup object.

    Always returns a string. An empty ``<title></title>`` yields ``""`` (not
    ``None``), and a title containing nested markup (e.g.
    ``<title><span>x</span></title>``) yields its text content rather than the
    raw inner HTML.
    """
    title_tag = soup.title
    if not title_tag:
        return ""
    return title_tag.get_text(strip=True)


def get_image_hash(image_url: str) -> str:
    """Calculate a simple hash based on the image filename and essential query parameters"""
    try:
        parsed_url = urlparse(image_url)
        filename = parsed_url.path.split("/")[-1]
        query_params = parse_qs(parsed_url.query)
        essential_params = query_params.get("url", [])
        image_identifier = filename + "".join(essential_params)
        return hashlib.md5(image_identifier.encode()).hexdigest()
    except Exception as e:
        logging.error(f"Error calculating image hash for {image_url}: {e}")
        return None


# Tags that should be completely removed from the page DOM
UNWANTED_TAGS = {
    "script", "style", "noscript", "iframe", "svg", "canvas", "dialog",
    "form", "select", "input", "button", "template", "portal", "footer",
    "header", "nav", "menu"
}

# Protected main content selectors / classes (must NEVER be decomposed as noise)
PROTECTED_CONTENT_CLASSES = {
    "mw-parser-output", "mw-content-ltr", "mw-content-rtl",
    "post-content", "entry-content", "article-body", "article-content",
    "portable-infobox", "infobox", "respect-thread", "shreddit-post",
    "shreddit-comment", "usertext-body", "md"
}

# Pattern for ads, cookie banners, consent prompts, popups, and non-content noise
NOISE_PATTERN = re.compile(
    r'(?i)\b('
    r'ad[-_]?(?:box|slot|wrapper|banner|container|module|sense|system|block|zone)?|'
    r'advert(?:isement|s|ing)?|sponsored[-_]?(?:post|content|links?)?|'
    r'cookie[-_]?(?:banner|consent|notice|modal|popup|bar|dialog|alert|message)?|'
    r'consent[-_]?(?:banner|dialog|modal|popup|container|wrapper)?|'
    r'gdpr[-_]?(?:banner|notice|modal|popup)?|'
    r'onetrust[-_]?[a-z0-9_-]*|qc[-_]?cmp[a-z0-9_-]*|sp[-_]?message[a-z0-9_-]*|'
    r'popup[-_]?[a-z0-9_-]*|modal[-_]?(?:backdrop|overlay|dialog|wrapper)?|'
    r'newsletter[-_]?(?:signup|popup|modal|prompt|subscribe|container)?|'
    r'subscribe[-_]?(?:banner|modal|popup|prompt|overlay)?|'
    r'paywall[-_]?(?:overlay|container|modal)?|'
    r'login[-_]?(?:wall|modal|prompt|overlay)?|'
    r'app[-_]?(?:promo|banner|upsell|prompt)?|'
    r'social[-_]?(?:share|links?|buttons?|icons?)|'
    r'outbrain|taboola|zergnet|disqus|comment-form|'
    r'fandom-community-header|page-side-tools|wikia-bar|rail-module'
    r')\b'
)


def clean_soup(soup: BeautifulSoup) -> BeautifulSoup:
    """Clean the soup by aggressively stripping non-content elements (ads, popups, cookie banners)."""
    # 1. Remove unwanted structural and interactive tags
    for tag in soup.find_all(list(UNWANTED_TAGS)):
        tag.decompose()

    # 2. Decompose noise elements (ads, cookie banners, popups) while preserving core content
    for tag in soup.find_all(True):
        if not isinstance(tag, bs4.Tag) or tag.decomposed:
            continue

        # Root elements are never decomposed
        if tag.name in ["html", "body", "main", "article"]:
            continue

        classes = tag.get("class", [])
        if isinstance(classes, list):
            class_str = " ".join(classes)
        else:
            class_str = str(classes)
        tag_id = str(tag.get("id", ""))

        # Preserve protected content containers (wikis, markdown blocks, respect threads)
        if any(pc in classes for pc in PROTECTED_CONTENT_CLASSES):
            continue

        # Check noise pattern in class or ID
        if NOISE_PATTERN.search(class_str) or (tag_id and NOISE_PATTERN.search(tag_id)):
            tag.decompose()
            continue

        # Check aria roles and dialogs
        if tag.get("role") in ["dialog", "alertdialog"] or tag.get("aria-modal") == "true":
            tag.decompose()
            continue

    return soup


def get_text_from_soup(soup: BeautifulSoup) -> str:
    """Get the relevant text from the soup with clean paragraph and list item formatting."""
    # Insert newlines before and after block elements to preserve paragraph readability
    for block in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote"]):
        block.insert_before("\n")
        block.insert_after("\n")

    raw_text = soup.get_text(separator="\n")
    lines = []
    for line in raw_text.splitlines():
        cleaned_line = re.sub(r"[ \t]+", " ", line).strip()
        if cleaned_line:
            lines.append(cleaned_line)

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
