import re


def extract_headers(markdown_text: str):
    return re.findall(r"^#+\s+(.*)$", markdown_text, re.MULTILINE)


def extract_sections(markdown_text: str):
    return re.split(r"^#+\s+.*$", markdown_text, flags=re.MULTILINE)[1:]


def table_of_contents(markdown_text: str):
    try:
        # Extract headers from markdown text
        headers = extract_headers(markdown_text)
        table_of_contents = "# Table of Contents\n\n"
        for header in headers:
            # Generate a link format from header
            header_link = header.strip().lower().replace(" ", "-")
            header_link = re.sub(
                r"[^\w\-]", "", header_link
            )  # Remove non-alphanumeric characters except hyphens
            table_of_contents += f"- [{header}](#{header_link})\n"
        return table_of_contents
    except Exception as e:
        print("table_of_contents Exception : ", e)
        return markdown_text


def add_references(report_markdown: str, visited_urls: set) -> str:
    """
    Add references to the markdown report.

    Args:
        report_markdown (str): The existing markdown report.
        visited_urls (set): A set of URLs that have been visited during research.

    Returns:
        str: The updated markdown report with added references.
    """
    try:
        # If the LLM already synthesized its own References section, do not append a duplicate block
        if "## References" in report_markdown or "# References" in report_markdown:
            return report_markdown

        # Filter out junk or non-content URLs (e.g. LinkedIn profiles, login pages, Facebook wall posts)
        blocked_domains = [
            "linkedin.com/in/",
            "facebook.com/login",
            "twitter.com/login",
            "instagram.com/accounts",
            "tiktok.com/@",
        ]
        clean_urls = [
            url for url in visited_urls
            if not any(b in url.lower() for b in blocked_domains)
        ]
        target_urls = clean_urls if clean_urls else list(visited_urls)

        url_markdown = "\n\n\n## References\n\n"
        url_markdown += "".join(f"- [{url}]({url})\n" for url in sorted(target_urls))
        return report_markdown + url_markdown
    except Exception as e:
        print(f"Encountered exception in adding source urls : {e}")
        return report_markdown
