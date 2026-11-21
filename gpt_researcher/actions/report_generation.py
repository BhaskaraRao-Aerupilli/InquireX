import asyncio
import os
from typing import List, Dict, Any
from ..config.config import Config
from ..utils.llm import create_chat_completion
from ..utils.logger import get_formatted_logger
from ..prompts import PromptFamily, get_prompt_by_report_type
from ..utils.enum import Tone

logger = get_formatted_logger()


def _cap_context(context, max_chars: int = None):
    """Cap context length with balanced entity allocation to prevent exceeding LLM tokens-per-minute (TPM) limits."""
    if max_chars is None:
        max_chars = int(os.environ.get("MAX_CONTEXT_CHARS", "12000"))
    if isinstance(context, str):
        if len(context) <= max_chars:
            return context
        # Split by sub-query paragraphs so every entity/topic receives equal context budget
        sections = [s for s in context.split("\n\n") if s.strip()]
        if len(sections) > 1:
            per_section_budget = max(400, max_chars // len(sections))
            capped = [s[:per_section_budget] for s in sections]
            return "\n\n".join(capped)
        return context[:max_chars] + "\n...[Context truncated to fit token limits]..."
    elif isinstance(context, list):
        if not context:
            return context
        per_item_budget = max(400, max_chars // len(context))
        capped_list = [str(item)[:per_item_budget] for item in context]
        return capped_list
    return context


async def write_report_introduction(
    query: str,
    context: str,
    agent_role_prompt: str,
    config: Config,
    websocket=None,
    cost_callback: callable = None,
    prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
    **kwargs
) -> str:
    """
    Generate an introduction for the report.
    """
    try:
        context = _cap_context(context)
        introduction = await create_chat_completion(
            model=config.smart_llm_model,
            messages=[
                {"role": "system", "content": f"{agent_role_prompt}"},
                {"role": "user", "content": prompt_family.generate_report_introduction(
                    question=query,
                    research_summary=context,
                    language=config.language
                )},
            ],
            temperature=0.25,
            llm_provider=config.smart_llm_provider,
            stream=True,
            websocket=websocket,
            max_tokens=config.smart_token_limit,
            llm_kwargs=config.llm_kwargs,
            cost_callback=cost_callback,
            **kwargs
        )
        return introduction
    except Exception as e:
        logger.error(f"Error in generating report introduction: {e}")
    return ""


async def write_conclusion(
    query: str,
    context: str,
    agent_role_prompt: str,
    config: Config,
    websocket=None,
    cost_callback: callable = None,
    prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
    **kwargs
) -> str:
    """
    Write a conclusion for the report.
    """
    try:
        context = _cap_context(context)
        conclusion = await create_chat_completion(
            model=config.smart_llm_model,
            messages=[
                {"role": "system", "content": f"{agent_role_prompt}"},
                {
                    "role": "user",
                    "content": prompt_family.generate_report_conclusion(query=query,
                                                                        report_content=context,
                                                                        language=config.language),
                },
            ],
            temperature=0.25,
            llm_provider=config.smart_llm_provider,
            stream=True,
            websocket=websocket,
            max_tokens=config.smart_token_limit,
            llm_kwargs=config.llm_kwargs,
            cost_callback=cost_callback,
            **kwargs
        )
        return conclusion
    except Exception as e:
        logger.error(f"Error in writing conclusion: {e}")
    return ""


async def summarize_url(
    url: str,
    content: str,
    role: str,
    config: Config,
    websocket=None,
    cost_callback: callable = None,
    **kwargs
) -> str:
    """
    Summarize the content of a URL.

    Args:
        url (str): The URL to summarize.
        content (str): The content of the URL.
        role (str): The role of the agent.
        config (Config): Configuration object.
        websocket: WebSocket connection for streaming output.
        cost_callback (callable, optional): Callback for calculating LLM costs.

    Returns:
        str: The summarized content.
    """
    try:
        summary = await create_chat_completion(
            model=config.smart_llm_model,
            messages=[
                {"role": "system", "content": f"{role}"},
                {"role": "user", "content": f"Summarize the following content from {url}:\n\n{content}"},
            ],
            temperature=0.25,
            llm_provider=config.smart_llm_provider,
            stream=True,
            websocket=websocket,
            max_tokens=config.smart_token_limit,
            llm_kwargs=config.llm_kwargs,
            cost_callback=cost_callback,
            **kwargs
        )
        return summary
    except Exception as e:
        logger.error(f"Error in summarizing URL: {e}")
    return ""


async def generate_draft_section_titles(
    query: str,
    current_subtopic: str,
    context: str,
    role: str,
    config: Config,
    websocket=None,
    cost_callback: callable = None,
    prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
    **kwargs
) -> List[str]:
    """
    Generate draft section titles for the report.

    Args:
        query (str): The research query.
        context (str): Context for the report.
        role (str): The role of the agent.
        config (Config): Configuration object.
        websocket: WebSocket connection for streaming output.
        cost_callback (callable, optional): Callback for calculating LLM costs.
        prompt_family: Family of prompts

    Returns:
        List[str]: A list of generated section titles.
    """
    try:
        context = _cap_context(context)
        section_titles = await create_chat_completion(
            model=config.smart_llm_model,
            messages=[
                {"role": "system", "content": f"{role}"},
                {"role": "user", "content": prompt_family.generate_draft_titles_prompt(
                    current_subtopic, query, context)},
            ],
            temperature=0.25,
            llm_provider=config.smart_llm_provider,
            stream=True,
            websocket=None,
            max_tokens=config.smart_token_limit,
            llm_kwargs=config.llm_kwargs,
            cost_callback=cost_callback,
            **kwargs
        )
        return section_titles.split("\n")
    except Exception as e:
        logger.error(f"Error in generating draft section titles: {e}")
    return []


async def generate_report(
    query: str,
    context,
    agent_role_prompt: str,
    report_type: str,
    tone: Tone,
    report_source: str,
    websocket,
    cfg,
    main_topic: str = "",
    existing_headers: list = [],
    relevant_written_contents: list = [],
    cost_callback: callable = None,
    custom_prompt: str = "", # This can be any prompt the user chooses with the context
    headers=None,
    prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
    available_images: list = None,
    **kwargs
):
    available_images = (available_images or [])[:4]
    generate_prompt = get_prompt_by_report_type(report_type, prompt_family)
    report = ""

    # Cap context length to fit LLM tokens-per-minute (TPM) limits
    context = _cap_context(context)

    if report_type == "subtopic_report":
        content = f"{generate_prompt(query, existing_headers, relevant_written_contents, main_topic, context, report_format=cfg.report_format, tone=tone, total_words=cfg.total_words, language=cfg.language)}"
    elif custom_prompt:
        content = f"{custom_prompt}\n\nContext: {context}"
    else:
        content = f"{generate_prompt(query, context, report_source, report_format=cfg.report_format, tone=tone, total_words=cfg.total_words, language=cfg.language)}"
    
    # Add verified research images instruction if images are available
    if available_images:
        images_info = "\n".join([
            f"- Image {i+1}: ![{img.get('title', img.get('alt_text', 'Visual Figure'))}]({img['url']})\n  Topic Context: {img.get('section_hint', img.get('alt_text', 'Figure relevant to the topic'))}"
            for i, img in enumerate(available_images)
        ])
        content += f"""

VERIFIED RESEARCH VISUAL FIGURES & DIAGRAMS:
You have the following topic-verified visual figures and diagrams available from the research search. You MUST embed them into the report:

{images_info}

INLINE MEDIA & VISUAL INTEGRATION RULES:
1. Contextual Placement: When visual content or images are available, embed the image syntax directly inline within the specific section or layout position they illustrate.
2. Gallery Segregation: Do NOT move or bundle inline media into top-level lightbox galleries or headers unless explicitly commanded by the user.
3. Image Verification: Use the exact markdown syntax: `![Title](url)`. Only embed image links present in the scraping metadata above. NEVER alter URLs, fabricate media source paths, or invent placeholder URLs.
4. Explanatory Captions: Immediately below each image, include an informative italicized caption explaining the figure (e.g. `*Figure: Explanatory caption based on the research context.*`).
5. Formatting: Ensure each image is placed on its own line with empty lines before and after so it renders cleanly in Markdown."""
    try:
        report = await create_chat_completion(
            model=cfg.smart_llm_model,
            messages=[
                {"role": "system", "content": f"{agent_role_prompt}"},
                {"role": "user", "content": content},
            ],
            temperature=0.35,
            llm_provider=cfg.smart_llm_provider,
            stream=True,
            websocket=websocket,
            max_tokens=cfg.smart_token_limit,
            llm_kwargs=cfg.llm_kwargs,
            cost_callback=cost_callback,
            **kwargs
        )
    except Exception as e:
        logger.warning(f"Streaming report generation failed: {e}. Retrying non-streaming fallback...")
        report = ""

    # Reliable fallback: If streaming failed or returned empty (e.g. socket dropped during rate limit backoff),
    # invoke non-streaming completion directly to guarantee output.
    if not report:
        try:
            report = await create_chat_completion(
                model=cfg.smart_llm_model,
                messages=[
                    {"role": "system", "content": f"{agent_role_prompt}"},
                    {"role": "user", "content": content},
                ],
                temperature=0.35,
                llm_provider=cfg.smart_llm_provider,
                stream=False,
                websocket=None,
                max_tokens=cfg.smart_token_limit,
                llm_kwargs=cfg.llm_kwargs,
                cost_callback=cost_callback,
                **kwargs
            )
        except Exception as e:
            logger.error(f"Non-streaming report fallback also failed: {e}")

    return report
