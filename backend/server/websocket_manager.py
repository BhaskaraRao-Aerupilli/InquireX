import os
import asyncio
import datetime
import json
import logging
import os
import traceback
from typing import Any, Dict, List

from fastapi import WebSocket

from backend.report_type import BasicReport, DetailedReport

from inquirex.utils.enum import ReportType, Tone
from inquirex.actions import stream_output  # Import stream_output
from .multi_agent_runner import run_multi_agent_task
from .server_utils import CustomLogsHandler

logger = logging.getLogger(__name__)

PERSONA_ROLE_PROMPTS: Dict[str, tuple[str, str]] = {
    "business analyst": (
        "📈 Business Analyst Agent",
        "You are an experienced AI business and market analyst assistant. Your main objective is to produce "
        "comprehensive, insightful, impartial, and systematically structured business reports based on market "
        "data, competitive positioning, SWOT vectors, and strategic analysis.",
    ),
    "academic researcher": (
        "🎓 Academic Researcher Agent",
        "You are an experienced AI academic researcher assistant. Your main objective is to compose rigorous, "
        "scholarly, evidence-grounded research reports citing peer-reviewed methodology, empirical evidence, "
        "formal citations, and theoretical frameworks.",
    ),
    "technical lead": (
        "💻 Technical & Security Lead Agent",
        "You are a principal AI technical and security lead assistant. Your main objective is to produce "
        "thorough engineering and systems architecture reports covering specifications, design trade-offs, "
        "protocols, benchmarks, and implementation or security analysis.",
    ),
    "financial analyst": (
        "💰 Financial Analyst Agent",
        "You are a seasoned AI financial analyst assistant. Your main objective is to compose comprehensive, "
        "impartial, and methodically structured financial and valuation reports analyzing capital allocation, "
        "revenue drivers, balance-sheet fundamentals, and macro indicators.",
    ),
    "quantitative analyst": (
        "📐 Quantitative Analyst Agent",
        "You are an expert AI quantitative researcher and mathematical analyst assistant. Your main objective is to "
        "evaluate quantitative metrics, statistical methodologies, mathematical models, empirical benchmarks, "
        "and reproducibility criteria rigorously.",
    ),
}


def resolve_agent_persona(agent: str | None, role: str | None = None) -> tuple[str | None, str | None]:
    """Resolve UI persona selection into (agent_name, agent_role_prompt) for InquireXResearcher."""
    if role and agent:
        return agent, role
    raw = str(agent or "").strip()
    if not raw or raw.lower() in {"auto agent", "auto", "default agent", "default"}:
        return None, None
    preset = PERSONA_ROLE_PROMPTS.get(raw.lower())
    if preset:
        return preset
    return (
        raw,
        role
        or (
            f"You are a specialized {raw} AI research assistant. Compose comprehensive, impartial, "
            "accurate, and systematically structured reports grounded in verified sources."
        ),
    )


def resolve_tone(tone_raw: Any) -> Tone:
    """Resolve string or Tone value into a Tone enum safely."""
    if isinstance(tone_raw, Tone):
        return tone_raw
    key = str(tone_raw or "").strip()
    if not key:
        return getattr(Tone, "Objective", next(iter(Tone)))
    try:
        return Tone[key]
    except KeyError:
        lower = key.lower()
        for member in Tone:
            if member.name.lower() == lower or str(member.value).lower().startswith(lower):
                return member
    return getattr(Tone, "Objective", next(iter(Tone)))


def normalize_url_list(raw: Any) -> List[str]:
    """Normalize URL string (comma/newline separated) or list into a clean list of URLs."""
    if not raw:
        return []
    if isinstance(raw, str):
        return [u.strip() for u in raw.replace("\n", ",").split(",") if u.strip()]
    if isinstance(raw, (list, tuple, set)):
        return [str(u).strip() for u in raw if str(u).strip()]
    return []

class WebSocketManager:
    """Manage websockets"""

    def __init__(self):
        """Initialize the WebSocketManager class."""
        self.active_connections: List[WebSocket] = []
        self.sender_tasks: Dict[WebSocket, asyncio.Task] = {}
        self.message_queues: Dict[WebSocket, asyncio.Queue] = {}

    async def start_sender(self, websocket: WebSocket):
        """Start the sender task."""
        queue = self.message_queues.get(websocket)
        if not queue:
            return

        while True:
            try:
                message = await queue.get()
                if message is None:  # Shutdown signal
                    break
                    
                if websocket in self.active_connections:
                    if message == "ping":
                        await websocket.send_text("pong")
                    else:
                        await websocket.send_text(message)
                else:
                    break
            except Exception as e:
                print(f"Error in sender task: {e}")
                break

    async def connect(self, websocket: WebSocket):
        """Connect a websocket."""
        try:
            await websocket.accept()
            self.active_connections.append(websocket)
            self.message_queues[websocket] = asyncio.Queue()
            self.sender_tasks[websocket] = asyncio.create_task(
                self.start_sender(websocket))
        except Exception as e:
            print(f"Error connecting websocket: {e}")
            if websocket in self.active_connections:
                await self.disconnect(websocket)

    async def disconnect(self, websocket: WebSocket):
        """Disconnect a websocket."""
        try:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                
                # Cancel sender task if it exists
                if websocket in self.sender_tasks:
                    try:
                        self.sender_tasks[websocket].cancel()
                        await self.message_queues[websocket].put(None)
                    except Exception as e:
                        logger.error(f"Error canceling sender task: {e}")
                    finally:
                        # Always try to clean up regardless of errors
                        if websocket in self.sender_tasks:
                            del self.sender_tasks[websocket]
                
                # Clean up message queue
                if websocket in self.message_queues:
                    del self.message_queues[websocket]
                
                # Finally close the WebSocket
                try:
                    await websocket.close()
                except Exception as e:
                    logger.info(f"WebSocket already closed: {e}")
        except Exception as e:
            logger.error(f"Error during WebSocket disconnection: {e}")
            # Still try to close the connection if possible
            try:
                await websocket.close()
            except Exception:
                pass  # If this fails too, there's nothing more we can do

    async def start_streaming(self, task, report_type, report_source, source_urls, document_urls, tone, websocket, headers=None, query_domains=[], mcp_enabled=False, mcp_strategy="fast", mcp_configs=[], max_search_results=None, agent=None, role=None, doc_path=None):
        """Start streaming the output."""
        resolved_tone = resolve_tone(tone)
        # add customized JSON config file path here
        config_path = os.environ.get("CONFIG_PATH", "default")

        # Pass MCP & Persona parameters to run_agent
        report = await run_agent(
            task, report_type, report_source, source_urls, document_urls, resolved_tone, websocket, 
            headers=headers, query_domains=query_domains, config_path=config_path,
            mcp_enabled=mcp_enabled, mcp_strategy=mcp_strategy, mcp_configs=mcp_configs,
            max_search_results=max_search_results, agent=agent, role=role, doc_path=doc_path
        )
        return report

async def run_agent(task, report_type, report_source, source_urls, document_urls, tone: Tone, websocket, stream_output=stream_output, headers=None, query_domains=[], config_path="", return_researcher=False, mcp_enabled=False, mcp_strategy="fast", mcp_configs=[], max_search_results=None, agent=None, role=None, doc_path=None):
    """Run the agent."""    
    # Create logs handler for this research task
    logs_handler = CustomLogsHandler(websocket, task)
    tone = resolve_tone(tone)
    resolved_agent, resolved_role = resolve_agent_persona(agent, role)

    normalized_source_urls = normalize_url_list(source_urls)
    normalized_document_urls = normalize_url_list(document_urls)
    effective_report_source = report_source or "web"
    if effective_report_source == "sources":
        if normalized_source_urls:
            effective_report_source = "web"
        else:
            effective_report_source = "web"
            await logs_handler.send_json({
                "type": "logs",
                "content": "warning",
                "output": "⚠️ No custom source URLs provided; falling back to web search.",
            })

    # Log MCP initialization. Retriever and strategy are configured per-request
    # inside InquireXResearcher via mcp_configs/mcp_strategy params — no os.environ
    # mutation needed here (mutating os.environ would persist across requests and
    # affect unrelated sessions, see issue #1676).
    if mcp_enabled and mcp_configs:
        print(f"🔧 MCP enabled with strategy '{mcp_strategy}' and {len(mcp_configs)} server(s)")
        await logs_handler.send_json({
            "type": "logs",
            "content": "mcp_init",
            "output": f"🔧 MCP enabled with strategy '{mcp_strategy}' and {len(mcp_configs)} server(s)"
        })

    # Initialize researcher based on report type
    if report_type in ["agent_teams", "multi_agents"]:
        report = await run_multi_agent_task(
            query=task, 
            websocket=logs_handler,  # Use logs_handler instead of raw websocket
            stream_output=stream_output, 
            tone=tone, 
            headers=headers
        )
        report = report.get("report", "")

    elif report_type == ReportType.DetailedReport.value:
        researcher = DetailedReport(
            query=task,
            query_domains=query_domains,
            report_type=report_type,
            report_source=effective_report_source,
            source_urls=normalized_source_urls,
            document_urls=normalized_document_urls,
            tone=tone,
            config_path=config_path,
            websocket=logs_handler,  # Use logs_handler instead of raw websocket
            headers=headers,
            mcp_configs=mcp_configs if mcp_enabled else None,
            mcp_strategy=mcp_strategy if mcp_enabled else None,
            max_search_results=max_search_results,
            agent=resolved_agent,
            role=resolved_role,
            doc_path=doc_path,
        )
        report = await researcher.run()
        
    else:
        researcher = BasicReport(
            query=task,
            query_domains=query_domains,
            report_type=report_type,
            report_source=effective_report_source,
            source_urls=normalized_source_urls,
            document_urls=normalized_document_urls,
            tone=tone,
            config_path=config_path,
            websocket=logs_handler,  # Use logs_handler instead of raw websocket
            headers=headers,
            mcp_configs=mcp_configs if mcp_enabled else None,
            mcp_strategy=mcp_strategy if mcp_enabled else None,
            max_search_results=max_search_results,
            agent=resolved_agent,
            role=resolved_role,
            doc_path=doc_path,
        )
        report = await researcher.run()

    if report_type not in ["multi_agents", "agent_teams"] and return_researcher:
        res = getattr(researcher, "inquirex_researcher", None)
        return report, res
    else:
        return report
