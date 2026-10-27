"""
Demo InquireX MCP Server
Provides real-time local analytical tools via the Model Context Protocol (MCP).
"""
import sys
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP("InquireX-Analytics-Server")

@mcp.tool()
def get_live_market_stats(asset: str) -> str:
    """Get live market pricing, P/E ratio, and volatility index for tech and crypto assets."""
    stats = {
        "apple": "Apple Inc. (AAPL): Price $235.40 | P/E: 34.2 | Market Cap: $3.58T | 52w High: $237.23",
        "tesla": "Tesla Inc. (TSLA): Price $218.85 | Forward P/E: 72.1 | Market Cap: $698B | 52w Range: $138-$271",
        "nvidia": "NVIDIA Corp (NVDA): Price $141.54 | P/E: 65.8 | Market Cap: $3.47T | Data Center Growth: +154% YoY",
        "bitcoin": "Bitcoin (BTC): Price $67,820 | 24h Vol: $32.4B | Market Dominance: 58.2%",
        "ethereum": "Ethereum (ETH): Price $2,540 | Staking Ratio: 28.9% | Gas Avg: 12 Gwei",
    }
    key = asset.lower().strip()
    for name, data in stats.items():
        if name in key:
            return f"[LIVE MCP MARKET FEED] {data}"
    return f"[LIVE MCP MARKET FEED] Asset '{asset}': Price: $100.00 | Volatility Index (VIX): 15.4 | Trend: Bullish Consolidation"

@mcp.tool()
def calculate_project_metrics(lines_of_code: int, test_coverage_pct: float) -> str:
    """Calculate software project maintainability index and technical debt assessment."""
    debt_score = "LOW" if test_coverage_pct >= 80 else ("MODERATE" if test_coverage_pct >= 50 else "HIGH")
    return (
        f"[LIVE MCP CODE AUDIT] Lines of Code: {lines_of_code} | "
        f"Test Coverage: {test_coverage_pct}% | "
        f"Technical Debt Risk: {debt_score} | "
        f"Maintainability Index: {min(100, int(test_coverage_pct * 1.1))}/100"
    )

if __name__ == "__main__":
    mcp.run()
