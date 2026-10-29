import json_repair
from typing import Any, List

from gpt_researcher.llm_provider.generic.base import ReasoningEfforts


def _normalize_sub_queries(parsed: Any, fallback_query: str) -> List[str]:
    """Coerce a parsed LLM response into a flat list of query strings.

    ``json_repair.loads`` may return a list, a dict (e.g. ``{"queries": [...]}``
    or a single ``{"query": "..."}``), a bare string, or ``None`` when the model
    does not return clean JSON. Callers expect a ``list[str]`` and otherwise crash
    on ``.append`` / iteration, so normalize defensively here.
    """
    if isinstance(parsed, dict):
        for key in ("queries", "sub_queries", "subQueries", "items"):
            value = parsed.get(key)
            if isinstance(value, list):
                parsed = value
                break
        else:
            # Single-query dict like {"query": "..."} or unrecognized shape.
            single = parsed.get("query")
            parsed = [single] if isinstance(single, str) else []

    if isinstance(parsed, str):
        parsed = [parsed] if parsed.strip() else []

    if not isinstance(parsed, list):
        parsed = []

    queries = [str(item).strip() for item in parsed if str(item).strip()]
    if not queries and fallback_query.strip():
        return [fallback_query.strip()]
    return queries
from ..utils.llm import create_chat_completion
from ..prompts import PromptFamily
from typing import Any, List, Dict
from ..config import Config
import logging

logger = logging.getLogger(__name__)

import re

STOPWORDS = {
    'in', 'the', 'a', 'an', 'of', 'for', 'to', 'and', 'on', 'with', 'is', 'are',
    'about', 'how', 'what', 'why', 'when', 'where', 'who', 'which', 'from', 'by',
    'as', 'at', 'or', 'its', 'it', 'that', 'this', 'into', 'within', 'across',
    'report', 'analysis', 'overview', 'summary', 'research', 'guide', 'study', 'details'
}

def _extract_core_entities(query: str) -> List[str]:
    words = re.findall(r"[a-zA-Z0-9_\-]+", query.lower())
    return [w for w in words if w not in STOPWORDS and len(w) >= 3]

def disambiguate_sub_queries(sub_queries: List[str], parent_query: str) -> List[str]:
    """Ensure sub-queries retain domain and entity context of the task to prevent keyword collision.

    If a sub-query lacks any of the core entity tokens from parent_query (for example,
    generating bare 'character' for 'Zoro in One Piece'), anchor it by prepending the
    parent entity so search retrievers do not fetch unrelated topics like java.lang.Character.
    """
    if not parent_query or not parent_query.strip():
        return sub_queries
    core_entities = _extract_core_entities(parent_query)
    if not core_entities:
        return sub_queries

    disambiguated = []
    for q in sub_queries:
        q_clean = q.strip()
        if not q_clean:
            continue
        q_lower = q_clean.lower()
        has_entity = any(re.search(r'\b' + re.escape(e) + r'\b', q_lower) for e in core_entities)
        if not has_entity:
            anchored = f"{parent_query} {q_clean}"
            disambiguated.append(anchored)
            logger.info(f"Disambiguated query without entity context: '{q_clean}' -> '{anchored}'")
        else:
            disambiguated.append(q_clean)
    return disambiguated


def extract_multi_entity_sub_queries(query: str) -> List[str]:
    """Force dedicated retrieval calls per topic for multi-entity or comparative queries.

    Instead of passing multi-entity queries together (e.g. 'Goku and Saitama strengths'),
    splits the subjects so the pipeline executes isolated searches (e.g. 'Goku strengths',
    'Saitama strengths') before combining them into the final prompt context.
    """
    if not query or not query.strip():
        return []

    clean_q = query.strip()
    # Strip common leading inquiry verbs
    stripped = re.sub(
        r'^(?:please\s+)?(?:compare\s+(?:and\s+contrast\s+)?|differences?\s+between\s+|comparison\s+between\s+|similarities\s+and\s+differences\s+between\s+)',
        '',
        clean_q,
        flags=re.IGNORECASE,
    ).strip()

    # Pattern 1: 'X vs Y' or 'X versus Y' with optional aspect
    m_vs = re.search(
        r'^(.*?)\s+(?:vs\.?|versus|v\.)\s+(.*?)(?:\s+(?:in|on|regarding|for|with\s+respect\s+to)\s+(.*))?$',
        stripped,
        flags=re.IGNORECASE,
    )
    if m_vs:
        e1 = m_vs.group(1).strip()
        rest = m_vs.group(2).strip()
        aspect = (m_vs.group(3) or "").strip()
        words = rest.split()
        if len(words) > 1 and not aspect:
            e2 = words[0]
            aspect = " ".join(words[1:])
        else:
            e2 = rest
        if e1 and e2 and len(e1.split()) <= 5 and len(e2.split()) <= 5:
            aspect_suffix = f" {aspect}".strip() if aspect else " strengths powers abilities feats"
            return [
                f"{e1} {aspect_suffix}".strip(),
                f"{e2} {aspect_suffix}".strip(),
                f"{e1} vs {e2} {aspect}".strip(),
            ]

    # Pattern 2: Multi-entity with 'and' or comma: 'X and Y [aspect]', 'X, Y, and Z [aspect]'
    aspect_words = [
        "strengths", "weaknesses", "powers", "abilities", "feats", "features",
        "pros and cons", "performance", "stats", "specs", "camera", "architecture",
        "speed", "comparison", "overview", "market share", "battery life"
    ]
    found_aspect = ""
    lower_stripped = stripped.lower()
    for aw in aspect_words:
        if lower_stripped.endswith(aw):
            found_aspect = stripped[-len(aw):]
            stripped = stripped[:-len(aw)].strip()
            break

    parts = re.split(r'\s+(?:vs\.?|versus)\s+|\s*,\s*(?:and\s+)?|\s+and\s+', stripped, flags=re.IGNORECASE)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) >= 2 and all(len(p.split()) <= 5 for p in parts):
        suffix = f" {found_aspect}".strip() if found_aspect else " strengths powers abilities feats"
        queries = [f"{p} {suffix}".strip() for p in parts]
        comp = f"{parts[0]} vs {parts[1]}"
        if found_aspect:
            comp += f" {found_aspect}"
        queries.append(comp)
        return queries

    return []


async def get_search_results(
    query: str,
    retriever: Any,
    query_domains: List[str] = None,
    researcher=None,
    max_results: int | None = None,
) -> List[Dict[str, Any]]:
    """
    Get web search results for a given query.

    Args:
        query: The search query
        retriever: The retriever instance
        query_domains: Optional list of domains to search
        researcher: The researcher instance (needed for MCP retrievers)
        max_results: Optional cap on the number of results

    Returns:
        A list of search results
    """
    import asyncio

    # Check if this is an MCP retriever and pass the researcher instance
    if "mcpretriever" in retriever.__name__.lower():
        search_retriever = retriever(
            query, 
            query_domains=query_domains,
            researcher=researcher  # Pass researcher instance for MCP retrievers
        )
    else:
        search_retriever = retriever(query, query_domains=query_domains)

    search_kwargs = {}
    if max_results is not None:
        search_kwargs["max_results"] = max_results

    # Retriever searches are blocking HTTP calls; keep the event loop free
    return await asyncio.to_thread(search_retriever.search, **search_kwargs)

async def generate_sub_queries(
    query: str,
    parent_query: str,
    report_type: str,
    context: List[Dict[str, Any]],
    cfg: Config,
    cost_callback: callable = None,
    prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
    **kwargs
) -> List[str]:
    """
    Generate sub-queries using the specified LLM model.

    Args:
        query: The original query
        parent_query: The parent query
        report_type: The type of report
        max_iterations: Maximum number of research iterations
        context: Search results context
        cfg: Configuration object
        cost_callback: Callback for cost calculation
        prompt_family: Family of prompts

    Returns:
        A list of sub-queries
    """
    gen_queries_prompt = prompt_family.generate_search_queries_prompt(
        query,
        parent_query,
        report_type,
        max_iterations=cfg.max_iterations or 3,
        context=context,
    )

    try:
        response = await create_chat_completion(
            model=cfg.strategic_llm_model,
            messages=[{"role": "user", "content": gen_queries_prompt}],
            llm_provider=cfg.strategic_llm_provider,
            max_tokens=None,
            llm_kwargs=cfg.llm_kwargs,
            reasoning_effort=ReasoningEfforts.Medium.value,
            cost_callback=cost_callback,
            **kwargs
        )
    except Exception as e:
        logger.warning(f"Error with strategic LLM: {e}. Retrying with max_tokens={cfg.strategic_token_limit}.")
        logger.warning(f"See https://github.com/assafelovic/gpt-researcher/issues/1022")
        try:
            response = await create_chat_completion(
                model=cfg.strategic_llm_model,
                messages=[{"role": "user", "content": gen_queries_prompt}],
                max_tokens=cfg.strategic_token_limit,
                llm_provider=cfg.strategic_llm_provider,
                llm_kwargs=cfg.llm_kwargs,
                cost_callback=cost_callback,
                **kwargs
            )
            logger.warning(f"Retrying with max_tokens={cfg.strategic_token_limit} successful.")
        except Exception as e:
            logger.warning(f"Retrying with max_tokens={cfg.strategic_token_limit} failed.")
            logger.warning(f"Error with strategic LLM: {e}. Falling back to smart LLM.")
            response = await create_chat_completion(
                model=cfg.smart_llm_model,
                messages=[{"role": "user", "content": gen_queries_prompt}],
                temperature=cfg.temperature,
                max_tokens=cfg.smart_token_limit,
                llm_provider=cfg.smart_llm_provider,
                llm_kwargs=cfg.llm_kwargs,
                cost_callback=cost_callback,
                **kwargs
            )

    sub_queries = _normalize_sub_queries(json_repair.loads(response), query)
    sub_queries = disambiguate_sub_queries(sub_queries, parent_query or query)

    # Enforce Per-Entity Query Splitting:
    # For multi-entity or comparative queries, guarantee dedicated isolated retrieval calls per topic
    split_queries = extract_multi_entity_sub_queries(parent_query or query)
    if split_queries:
        existing_lower = {sq.lower() for sq in sub_queries}
        for sq in reversed(split_queries):
            if sq.lower() not in existing_lower:
                sub_queries.insert(0, sq)
                existing_lower.add(sq.lower())
        logger.info(f"Enforced per-entity query splitting: injected dedicated searches {split_queries}")

    return sub_queries

async def plan_research_outline(
    query: str,
    search_results: List[Dict[str, Any]],
    agent_role_prompt: str,
    cfg: Config,
    parent_query: str,
    report_type: str,
    cost_callback: callable = None,
    retriever_names: List[str] = None,
    **kwargs
) -> List[str]:
    """
    Plan the research outline by generating sub-queries.

    Args:
        query: Original query
        search_results: Initial search results
        agent_role_prompt: Agent role prompt
        cfg: Configuration object
        parent_query: Parent query
        report_type: Report type
        cost_callback: Callback for cost calculation
        retriever_names: Names of the retrievers being used

    Returns:
        A list of sub-queries
    """
    # Handle the case where retriever_names is not provided
    if retriever_names is None:
        retriever_names = []
    
    # For MCP retrievers, we may want to skip sub-query generation
    # Check if MCP is the only retriever or one of multiple retrievers
    if retriever_names and ("mcp" in retriever_names or "MCPRetriever" in retriever_names):
        mcp_only = (len(retriever_names) == 1 and 
                   ("mcp" in retriever_names or "MCPRetriever" in retriever_names))
        
        if mcp_only:
            # If MCP is the only retriever, skip sub-query generation
            logger.info("Using MCP retriever only - skipping sub-query generation")
            # Return the original query to prevent additional search iterations
            return [query]
        else:
            # If MCP is one of multiple retrievers, generate sub-queries for the others
            logger.info("Using MCP with other retrievers - generating sub-queries for non-MCP retrievers")

    # Generate sub-queries for research outline
    sub_queries = await generate_sub_queries(
        query,
        parent_query,
        report_type,
        search_results,
        cfg,
        cost_callback,
        **kwargs
    )

    return sub_queries
