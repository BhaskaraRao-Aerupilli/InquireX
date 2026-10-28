"""Utility functions for web scraping.

This module provides helper functions for extracting content, images,
and processing HTML from web pages.
"""

import hashlib
import logging
import re
from urllib.parse import parse_qs, urljoin, urlparse

import bs4
from bs4 import BeautifulSoup


def get_relevant_images(soup: BeautifulSoup, url: str) -> list:
    """Extract relevant, high-resolution content images from the page with captions"""
    image_urls = []
    
    junk_patterns = (
        '.svg', '.ico', '.gif', 'pixel', 'avatar', 'favicon', 'logo', 'tracking',
        'badge', 'spinner', '1x1', 'ad-', 'advertisement', 'doubleclick', 'button',
        'icon', 'share', 'placeholder', 'banner', 'sponsor', 'w_64', 'w_32', 'w_100',
        '64x64', '32x32', 'fallback', 'author', 'profile', 'thumb_'
    )

    try:
        all_images = soup.find_all('img', src=True)
        
        for img in all_images:
            img_src = urljoin(url, img['src'])
            if not img_src.startswith(('http://', 'https://')):
                continue
            
            src_lower = img_src.lower()
            if any(junk in src_lower for junk in junk_patterns):
                continue
            
            # Check explicit dimensions if present
            width = parse_dimension(img.get('width', ''))
            height = parse_dimension(img.get('height', ''))
            if width and width < 220:
                continue
            if height and height < 160:
                continue
            
            score = 1
            # Check for relevant semantic classes (excluding thumbnail)
            classes = [c.lower() for c in img.get('class', [])]
            if any(cls in classes for cls in ['featured', 'hero', 'lead', 'main', 'content', 'article-image', 'figure']):
                score += 3
            
            # Bonus for descriptive alt or title text
            alt_text = img.get('alt', '').strip()
            title_text = img.get('title', '').strip()
            caption = alt_text or title_text
            
            if caption and len(caption) > 10:
                score += 2
                caption_lower = caption.lower()
                if any(junk in caption_lower for junk in ['logo', 'icon', 'advertisement', 'banner', 'avatar', 'thumbnail']):
                    continue
            
            if width and height:
                if width >= 1200 or height >= 700:
                    score += 2
                elif width >= 600 or height >= 400:
                    score += 1

            image_urls.append({
                'url': img_src,
                'score': score,
                'alt': caption or 'Research Visual Figure',
                'title': title_text or caption or 'Visual Figure'
            })
        
        # Sort by score descending
        sorted_images = sorted(image_urls, key=lambda x: x['score'], reverse=True)
        return sorted_images[:10]
    
    except Exception as e:
        logging.error(f"Error in get_relevant_images: {e}")
        return []

def parse_dimension(value: str) -> int:
    """Parse dimension value, handling px units"""
    if value.lower().endswith('px'):
        value = value[:-2]  # Remove 'px' suffix
    try:
        # Convert to float first to handle decimal values like '409.12'
        return int(float(value))
    except (ValueError, TypeError) as e:
        # Non-numeric dimensions (e.g. '100%', 'auto', '50em') are common and
        # expected on real pages; log at debug level instead of spamming stdout.
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
        
        # Extract the filename
        filename = parsed_url.path.split('/')[-1]
        
        # Extract essential query parameters (e.g., 'url' for CDN-served images)
        query_params = parse_qs(parsed_url.query)
        essential_params = query_params.get('url', [])
        
        # Combine filename and essential parameters
        image_identifier = filename + ''.join(essential_params)
        
        # Calculate hash
        return hashlib.md5(image_identifier.encode()).hexdigest()
    except Exception as e:
        logging.error(f"Error calculating image hash for {image_url}: {e}")
        return None


def clean_soup(soup: BeautifulSoup) -> BeautifulSoup:
    """Clean the soup by removing unwanted tags"""
    for tag in soup.find_all(
        [
            "script",
            "style",
            "footer",
            "header",
            "nav",
            "menu",
            "sidebar",
            "svg",
        ]
    ):
        tag.decompose()

    disallowed_class_set = {"nav", "menu", "sidebar", "footer"}

    # clean tags with certain classes
    def does_tag_have_disallowed_class(elem) -> bool:
        if not isinstance(elem, bs4.Tag):
            return False

        return any(
            cls_name in disallowed_class_set for cls_name in elem.get("class", [])
        )

    for tag in soup.find_all(does_tag_have_disallowed_class):
        tag.decompose()

    return soup


def get_text_from_soup(soup: BeautifulSoup) -> str:
    """Get the relevant text from the soup with improved filtering"""
    text = soup.get_text(strip=True, separator="\n")
    # Remove excess whitespace
    text = re.sub(r"\s{2,}", " ", text)
    return text