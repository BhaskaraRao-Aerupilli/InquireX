import logging
import time
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from ..utils import get_relevant_images, extract_title, get_text_from_soup, clean_soup

logger = logging.getLogger(__name__)

# Response codes worth one retry: rate limiting and transient server errors.
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_CONTENT_BYTES = 10 * 1024 * 1024  # Skip pages larger than 10MB


class BeautifulSoupScraper:

    def __init__(self, link, session=None, query: str = ""):
        self.link = link
        self.session = session
        self.query = query

    def _try_wiki_api(self):
        """Fetch community wikis (Fandom, Wikia, Wikipedia) via official MediaWiki API.

        This avoids Cloudflare bot challenges, eliminates site chrome/ads/cookie banners,
        and provides direct access to complete wiki lore, power stats, and character tables.
        """
        try:
            parsed = urlparse(self.link)
            netloc = parsed.netloc.lower()
            if "/wiki/" not in parsed.path:
                return None, None

            page_title = parsed.path.split("/wiki/")[1].split("/")[0].split("?")[0]
            if not page_title:
                return None, None

            api_url = None
            if "fandom.com" in netloc or "wikia.com" in netloc:
                api_url = f"{parsed.scheme}://{parsed.netloc}/api.php?action=parse&page={page_title}&prop=text&format=json"
            elif "wikipedia.org" in netloc:
                api_url = f"{parsed.scheme}://{parsed.netloc}/w/api.php?action=parse&page={page_title}&prop=text&format=json"

            if api_url:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                }
                resp = self.session.get(api_url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    html_content = data.get("parse", {}).get("text", {}).get("*")
                    if html_content:
                        clean_title = page_title.replace("_", " ")
                        logger.info(f"Successfully retrieved wiki content via MediaWiki API for {self.link}")
                        return html_content, clean_title
        except Exception as e:
            logger.debug(f"MediaWiki API retrieval skipped for {self.link}: {e}")
        return None, None

    def scrape(self):
        """Fetch the page and extract cleaned text, images and title.

        Returns:
            Tuple of (content, image_urls, title). Empty values are returned
            when the page cannot be fetched or yields no usable content.
        """
        # 1. First check if this is a community wiki that can be cleanly fetched via MediaWiki API
        wiki_html, wiki_title = self._try_wiki_api()
        if wiki_html:
            try:
                soup = BeautifulSoup(wiki_html, "lxml")
                soup = clean_soup(soup)
                content = get_text_from_soup(soup)
                image_urls = get_relevant_images(soup, self.link, query=self.query)
                return content, image_urls, wiki_title
            except Exception as e:
                logger.warning(f"Error parsing wiki API response for {self.link}: {e}")

        # 2. Standard HTTP fetch and parse
        response = self._fetch()
        if response is None:
            return "", [], ""

        try:
            # response.encoding defaults to ISO-8859-1 when the Content-Type
            # header omits a charset, which garbles many UTF-8 pages. Only
            # trust it when the server actually declared a charset; otherwise
            # let BeautifulSoup detect the encoding from the document itself.
            content_type = response.headers.get("Content-Type", "")
            declared_encoding = response.encoding if "charset" in content_type.lower() else None
            soup = BeautifulSoup(
                response.content, "lxml", from_encoding=declared_encoding
            )

            soup = clean_soup(soup)

            content = get_text_from_soup(soup)

            image_urls = get_relevant_images(soup, self.link, query=self.query)

            # Extract the title using the utility function
            title = extract_title(soup)

            return content, image_urls, title

        except Exception as e:
            logger.error(f"Error parsing {self.link}: {e}")
            return "", [], ""

    def _fetch(self):
        """GET the page, retrying once on transient failures.

        Returns the response on success, or None when the page is
        unreachable, an error status, or too large to be worth parsing.
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Upgrade-Insecure-Requests": "1",
        }
        for attempt in (1, 2):
            try:
                response = self.session.get(self.link, headers=headers, timeout=10)
            except Exception as e:
                logger.warning(f"Request failed for {self.link} (attempt {attempt}): {e}")
                if attempt == 1:
                    time.sleep(1)
                    continue
                return None

            if response.status_code in RETRYABLE_STATUS_CODES and attempt == 1:
                logger.warning(
                    f"Got HTTP {response.status_code} for {self.link}, retrying once"
                )
                time.sleep(1)
                continue

            if response.status_code >= 400:
                # Don't parse error/paywall pages as if they were content
                logger.warning(f"Got HTTP {response.status_code} for {self.link}, skipping")
                return None

            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > MAX_CONTENT_BYTES:
                logger.warning(f"Content too large for {self.link} ({content_length} bytes), skipping")
                return None

            return response

        return None
