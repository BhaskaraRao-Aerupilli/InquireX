"""Browser manager skill for GPT Researcher.

This module provides the BrowserManager class that handles web scraping
and content extraction from URLs.
"""

from gpt_researcher.utils.workers import WorkerPool

from ..actions.utils import stream_output
from ..actions.web_scraping import scrape_urls
from ..scraper.utils import get_image_hash


class BrowserManager:
    """Manages web browsing and content scraping for research.

    This class handles URL scraping, content extraction, and image
    selection during the research process.

    Attributes:
        researcher: The parent GPTResearcher instance.
        worker_pool: Pool of workers for parallel scraping.
    """

    def __init__(self, researcher):
        """Initialize the BrowserManager.

        Args:
            researcher: The GPTResearcher instance that owns this manager.
        """
        self.researcher = researcher
        self.worker_pool = WorkerPool(
            researcher.cfg.max_scraper_workers,
            researcher.cfg.scraper_rate_limit_delay
        )

    async def browse_urls(self, urls: list[str]) -> list[dict]:
        """
        Scrape content from a list of URLs.

        Args:
            urls (list[str]): list of URLs to scrape.

        Returns:
            list[dict]: list of scraped content results.
        """
        if self.researcher.verbose:
            await stream_output(
                "logs",
                "scraping_urls",
                f"🌐 Scraping content from {len(urls)} URLs...",
                self.researcher.websocket,
            )

        query = getattr(self.researcher, 'query', '')
        scraped_content, images = await scrape_urls(
            urls, self.researcher.cfg, self.worker_pool, query=query
        )
        self.researcher.add_research_sources(scraped_content)
        new_images = self.select_top_images(images, k=4)  # Select top 4 images
        self.researcher.add_research_images(new_images)

        if self.researcher.verbose:
            await stream_output(
                "logs",
                "scraping_content",
                f"📄 Scraped {len(scraped_content)} pages of content",
                self.researcher.websocket,
            )
            await stream_output(
                "logs",
                "scraping_images",
                f"🖼️ Selected {len(new_images)} new images from {len(images)} total images",
                self.researcher.websocket,
                True,
                new_images,
            )
            await stream_output(
                "logs",
                "scraping_complete",
                f"🌐 Scraping complete",
                self.researcher.websocket,
            )

        return scraped_content

    def select_top_images(self, images: list[dict], k: int = 4) -> list[dict]:
        """
        Select most relevant images and remove duplicates based on image content and URLs.
        """
        unique_images = []
        seen_hashes = set()
        existing_imgs = self.researcher.get_research_images(top_k=100)
        existing_urls = {img['url'] if isinstance(img, dict) else str(img) for img in existing_imgs}

        junk_keywords = (
            '.svg', '.ico', '.gif', 'pixel', 'avatar', 'favicon', 'logo', 'tracking',
            'badge', 'spinner', '1x1', 'ad-', 'advertisement', 'doubleclick',
            'share_icon', 'social', 'button', 'w_64', 'w_32', '64x64', 'fallback',
            'icon', 'sponsor', 'placeholder', 'author', 'profile', 'headshot',
            'portrait', 'shutterstock', 'gettyimages', 'istock', 'stockphoto',
            'banner', 'promo', 'subscribe', 'newsletter'
        )

        for img in sorted(images, key=lambda im: im.get("score", 0) if isinstance(im, dict) else 0, reverse=True):
            if isinstance(img, dict):
                score = img.get('score', 0)
                # Filter out low-relevance scraped images that do not match topic entities
                if score < 2:
                    continue
                url = img.get('url', '')
                alt = img.get('alt') or getattr(self.researcher, 'query', 'Research Visual Figure')
                title = img.get('title') or alt
            else:
                url = str(img)
                alt = getattr(self.researcher, 'query', 'Research Visual Figure')
                title = alt
                score = 2

            if not url or not url.startswith('http'):
                continue
            
            url_lower = url.lower()
            if any(junk in url_lower for junk in junk_keywords):
                continue

            img_hash = get_image_hash(url)
            if (
                img_hash
                and img_hash not in seen_hashes
                and url not in existing_urls
            ):
                seen_hashes.add(img_hash)
                existing_urls.add(url)
                unique_images.append({
                    'url': url,
                    'alt': alt,
                    'title': title,
                    'score': score
                })

                if len(unique_images) == k:
                    break

        return unique_images