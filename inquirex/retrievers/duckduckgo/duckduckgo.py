from itertools import islice
from ..utils import check_pkg


class Duckduckgo:
    """
    Duckduckgo API Retriever
    """
    def __init__(self, query, query_domains=None):
        check_pkg('ddgs')
        from ddgs import DDGS
        self.ddg = DDGS()
        self.query = query
        self.query_domains = query_domains or None

    def search(self, max_results=5):
        """
        Performs the search and normalizes ddgs payloads to the shared
        ``{href, body, title?}`` contract used by other retrievers.

        ``ddgs`` historically returned dicts with ``href``/`body` keys; newer
        releases emit ``link``/`url` and ``body`/`snippet`/`description``.
        Downstream research steps expect ``href`` and would KeyError or skip
        sources if the raw ddgs shape is returned unchanged.
        """
        import re
        query = self.query
        if self.query_domains:
            clean_domains = [
                re.sub(r"^https?://", "", str(d).strip(), flags=re.IGNORECASE).split("/")[0].strip()
                for d in self.query_domains if d
            ]
            clean_domains = [d for d in clean_domains if d]
            if clean_domains:
                domain_query = " OR ".join([f"site:{d}" for d in clean_domains])
                query = f"({domain_query}) {query}"

        try:
            search_response = self.ddg.text(query, region='wt-wt', max_results=max_results)
        except Exception as e:
            print(f"Error: {e}. Failed fetching sources. Resulting in empty response.")
            search_response = []

        if not search_response:
            return []

        normalized = []
        for result in search_response:
            if not isinstance(result, dict):
                continue
            href = (
                result.get("href")
                or result.get("link")
                or result.get("url")
                or ""
            )
            if not href:
                continue
            body = (
                result.get("body")
                or result.get("snippet")
                or result.get("description")
                or ""
            )
            item = {"href": href, "body": body}
            title = result.get("title")
            if title:
                item["title"] = title
            normalized.append(item)

        # Preserve caller-requested max_results even if the client ignored it.
        return list(islice(normalized, max_results))
