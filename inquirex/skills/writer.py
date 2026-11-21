"""Report generator skill for GPT Researcher.

This module provides the ReportGenerator class that handles report
writing, including introductions, conclusions, and subtopic management.
"""

import json
import re
import logging
from typing import Dict, Optional

from ..actions import (
    identify_distinct_entities,
    balance_multi_entity_context,
    generate_draft_section_titles,
    generate_report,
    stream_output,
    write_conclusion,
    write_report_introduction,
)
from ..utils.llm import construct_subtopics


logger = logging.getLogger(__name__)


class ReportGenerator:
    """Generates reports based on research data.

    This class handles all aspects of report generation including
    writing introductions, conclusions, and managing report structure.

    Attributes:
        researcher: The parent InquireXResearcher instance.
        research_params: Dictionary of parameters for report generation.
    """

    def __init__(self, researcher):
        """Initialize the ReportGenerator.

        Args:
            researcher: The InquireXResearcher instance that owns this generator.
        """
        self.researcher = researcher
        self.research_params = {
            "query": self.researcher.query,
            "agent_role_prompt": self.researcher.cfg.agent_role or self.researcher.role,
            "report_type": self.researcher.report_type,
            "report_source": self.researcher.report_source,
            "tone": self.researcher.tone,
            "websocket": self.researcher.websocket,
            "cfg": self.researcher.cfg,
            "headers": self.researcher.headers,
        }

    async def write_report(self, existing_headers: list = [], relevant_written_contents: list = [], ext_context=None, custom_prompt="", available_images: list = None) -> str:
        """
        Write a report based on existing headers and relevant contents.

        Args:
            existing_headers (list): List of existing headers.
            relevant_written_contents (list): List of relevant written contents.
            ext_context (Optional): External context, if any.
            custom_prompt (str): Custom prompt for the report.
            available_images (list): Pre-generated images available for embedding.

        Returns:
            str: The generated report.
        """
        available_images = available_images or []
        
        # send the selected images prior to writing report
        research_images = self.researcher.get_research_images()
        if research_images:
            await stream_output(
                "images",
                "selected_images",
                json.dumps(research_images),
                self.researcher.websocket,
                True,
                research_images
            )

        context = ext_context or self.researcher.context

        # Guard against fabricating a report from nothing: if no research content was
        # gathered (every retriever returned empty / was blocked / rate-limited), don't
        # silently write a confident, sourced-looking report - abstain so it is visible.
        _ctx = "\n".join(context) if isinstance(context, list) else str(context or "")
        if not _ctx.strip():
            return (
                f'I could not gather any source material for "{self.researcher.query}". '
                "No sources were retrieved (searches may have returned nothing or been "
                "blocked), so I am not able to produce a reliable, sourced report."
            )

        # MULTI-ENTITY RETRIEVAL & BALANCE GUARD
        entities = identify_distinct_entities(self.researcher.query)
        if entities and len(entities) >= 2:
            # 1. Even Matrix Check: verify facts/metrics exist for EVERY subject
            _ctx_str = "\n".join(context) if isinstance(context, list) else str(context or "")
            for ent in entities:
                ent_hits = len(re.findall(r'\b' + re.escape(ent) + r'\b', _ctx_str, re.IGNORECASE))
                # Check character volume dedicated to this entity
                ent_chars = sum(
                    len(c) for c in (context if isinstance(context, list) else [_ctx_str])
                    if re.search(r'\b' + re.escape(ent) + r'\b', str(c), re.IGNORECASE)
                )
                if ent_hits < 3 or ent_chars < 500:
                    if self.researcher.verbose:
                        await stream_output(
                            "logs",
                            "even_matrix_re_retrieval",
                            f"⚖️ Even Matrix Guard: Context for '{ent}' is sparse/missing ({ent_hits} occurrences). Triggering targeted re-retrieval...",
                            self.researcher.websocket,
                        )
                    try:
                        targeted_sub_query = f"{ent} peak feats destructive capabilities durability speed stats scaling overview"
                        re_retrieved = await self.researcher.research_conductor._process_sub_query(
                            targeted_sub_query,
                            query_domains=getattr(self.researcher, "query_domains", [])
                        )
                        if re_retrieved:
                            if isinstance(context, list):
                                if isinstance(re_retrieved, list):
                                    context.extend(re_retrieved)
                                else:
                                    context.append(str(re_retrieved))
                            else:
                                context = str(context) + "\n\n" + str(re_retrieved)
                            self.researcher.context = context
                            _ctx_str = "\n".join(context) if isinstance(context, list) else str(context or "")
                    except Exception as e:
                        logger.warning(f"Targeted re-retrieval for '{ent}' failed: {e}")

            # 2. Entity Balancing: Equal token allocation + 60% ceiling
            context = balance_multi_entity_context(context, entities, max_ratio=0.60)
            if self.researcher.verbose:
                await stream_output(
                    "logs",
                    "entity_balanced",
                    f"⚖️ Entity Balance Guard: Balanced equal context allocation across {', '.join(entities)} (capped <= 60% per entity)",
                    self.researcher.websocket,
                )
        
        # Log image availability
        if available_images and self.researcher.verbose:
            await stream_output(
                "logs",
                "images_available",
                f"🖼️ {len(available_images)} pre-generated images available for embedding",
                self.researcher.websocket,
            )
        
        if self.researcher.verbose:
            await stream_output(
                "logs",
                "writing_report",
                f"✍️ Writing report for '{self.researcher.query}'...",
                self.researcher.websocket,
            )

        report_params = self.research_params.copy()
        if not report_params["agent_role_prompt"]:
            report_params["agent_role_prompt"] = self.researcher.cfg.agent_role or self.researcher.role
        report_params["context"] = context
        report_params["custom_prompt"] = custom_prompt
        report_params["available_images"] = available_images  # Pass pre-generated images

        if self.researcher.report_type == "subtopic_report":
            report_params.update({
                "main_topic": self.researcher.parent_query,
                "existing_headers": existing_headers,
                "relevant_written_contents": relevant_written_contents,
                "cost_callback": self.researcher.add_costs,
            })
        else:
            report_params["cost_callback"] = self.researcher.add_costs

        report = await generate_report(**report_params, **self.researcher.kwargs)

        if self.researcher.verbose:
            await stream_output(
                "logs",
                "report_written",
                f"📝 Report written for '{self.researcher.query}'",
                self.researcher.websocket,
            )

        return report

    async def write_report_conclusion(self, report_content: str) -> str:
        """
        Write the conclusion for the report.

        Args:
            report_content (str): The content of the report.

        Returns:
            str: The generated conclusion.
        """
        if self.researcher.verbose:
            await stream_output(
                "logs",
                "writing_conclusion",
                f"✍️ Writing conclusion for '{self.researcher.query}'...",
                self.researcher.websocket,
            )

        conclusion = await write_conclusion(
            query=self.researcher.query,
            context=report_content,
            config=self.researcher.cfg,
            agent_role_prompt=self.researcher.cfg.agent_role or self.researcher.role,
            cost_callback=self.researcher.add_costs,
            websocket=self.researcher.websocket,
            prompt_family=self.researcher.prompt_family,
            **self.researcher.kwargs
        )

        if self.researcher.verbose:
            await stream_output(
                "logs",
                "conclusion_written",
                f"📝 Conclusion written for '{self.researcher.query}'",
                self.researcher.websocket,
            )

        return conclusion

    async def write_introduction(self):
        """Write the introduction section of the report."""
        if self.researcher.verbose:
            await stream_output(
                "logs",
                "writing_introduction",
                f"✍️ Writing introduction for '{self.researcher.query}'...",
                self.researcher.websocket,
            )

        introduction = await write_report_introduction(
            query=self.researcher.query,
            context=self.researcher.context,
            agent_role_prompt=self.researcher.cfg.agent_role or self.researcher.role,
            config=self.researcher.cfg,
            websocket=self.researcher.websocket,
            cost_callback=self.researcher.add_costs,
            prompt_family=self.researcher.prompt_family,
            **self.researcher.kwargs
        )

        if self.researcher.verbose:
            await stream_output(
                "logs",
                "introduction_written",
                f"📝 Introduction written for '{self.researcher.query}'",
                self.researcher.websocket,
            )

        return introduction

    async def get_subtopics(self):
        """Retrieve subtopics for the research."""
        if self.researcher.verbose:
            await stream_output(
                "logs",
                "generating_subtopics",
                f"🌳 Generating subtopics for '{self.researcher.query}'...",
                self.researcher.websocket,
            )

        subtopics = await construct_subtopics(
            task=self.researcher.query,
            data=self.researcher.context,
            config=self.researcher.cfg,
            subtopics=self.researcher.subtopics,
            prompt_family=self.researcher.prompt_family,
            **self.researcher.kwargs
        )

        if self.researcher.verbose:
            await stream_output(
                "logs",
                "subtopics_generated",
                f"📊 Subtopics generated for '{self.researcher.query}'",
                self.researcher.websocket,
            )

        return subtopics

    async def get_draft_section_titles(self, current_subtopic: str):
        """Generate draft section titles for the report."""
        if self.researcher.verbose:
            await stream_output(
                "logs",
                "generating_draft_sections",
                f"📑 Generating draft section titles for '{self.researcher.query}'...",
                self.researcher.websocket,
            )

        draft_section_titles = await generate_draft_section_titles(
            query=self.researcher.query,
            current_subtopic=current_subtopic,
            context=self.researcher.context,
            role=self.researcher.cfg.agent_role or self.researcher.role,
            websocket=self.researcher.websocket,
            config=self.researcher.cfg,
            cost_callback=self.researcher.add_costs,
            prompt_family=self.researcher.prompt_family,
            **self.researcher.kwargs
        )

        if self.researcher.verbose:
            await stream_output(
                "logs",
                "draft_sections_generated",
                f"🗂️ Draft section titles generated for '{self.researcher.query}'",
                self.researcher.websocket,
            )

        return draft_section_titles
