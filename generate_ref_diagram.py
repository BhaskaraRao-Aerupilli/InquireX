import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Create high-resolution vertical figure matching reference aspect ratio
fig, ax = plt.subplots(figsize=(10, 15), dpi=300)
ax.set_facecolor('white')
fig.patch.set_facecolor('white')

# Remove axes
ax.set_xlim(0, 100)
ax.set_ylim(0, 140)
ax.axis('off')

# Title & Subtitle
ax.text(50, 136, "System Architecture", ha='center', va='center', fontsize=20, fontweight='bold', color='#111827', fontfamily='sans-serif')
ax.text(50, 133, "Autonomous Deep Research System", ha='center', va='center', fontsize=11, color='#6B7280', fontfamily='sans-serif')

def draw_box(x, y, w, h, title, subtitle="", bg_color='#EBF5FF', border_color='#3B82F6', title_color='#1E3A8A', sub_color='#4B5563', corner_radius=1.2, lw=1.2):
    fancy = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle=f"round,pad=0.2,rounding_size={corner_radius}",
        facecolor=bg_color, edgecolor=border_color, linewidth=lw, zorder=2
    )
    ax.add_patch(fancy)
    if subtitle:
        ax.text(x + w/2, y + h*0.62, title, ha='center', va='center', fontsize=10.5, fontweight='bold', color=title_color, zorder=3)
        ax.text(x + w/2, y + h*0.30, subtitle, ha='center', va='center', fontsize=7.5, color=sub_color, zorder=3)
    else:
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=9.5, fontweight='bold', color=title_color, zorder=3)

def draw_arrow(x1, y1, x2, y2):
    ax.annotate(
        '', xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(arrowstyle="-|>", color="#1F2937", lw=1.1, mutation_scale=10),
        zorder=1
    )

def draw_stage(y, text):
    ax.text(94, y, text, ha='right', va='center', fontsize=8, fontstyle='italic', color='#9CA3AF', fontweight='medium')

# 1. INPUT STAGE
draw_stage(123, "INPUT")
draw_box(25, 119, 50, 8, "Research Query & Document Input", "Target Topic | Query Scope | Uploaded PDF & DOCX Files", bg_color='#EBF5FF', border_color='#60A5FA', title_color='#1E3A8A')

draw_arrow(50, 119, 50, 111)

# 2. ORCHESTRATION STAGE
draw_stage(107, "ORCHESTRATION")
draw_box(22, 103, 56, 8, "FastAPI Backend & Orchestrator", "Session Management | Asynchronous Task Dispatcher | WebSocket Event Stream", bg_color='#EBF5FF', border_color='#60A5FA', title_color='#1E3A8A')

draw_arrow(50, 103, 50, 95)

# 3. RETRIEVAL STAGE
draw_stage(90, "RETRIEVAL")
draw_box(10, 86, 38, 8, "Web Search Engine", "Tavily | DuckDuckGo | Bing Search APIs", bg_color='#EBF5FF', border_color='#60A5FA', title_color='#1E3A8A')
draw_box(52, 86, 38, 8, "Dynamic Web Scraper", "Playwright Headless Browser | Trafilatura DOM Parser", bg_color='#EBF5FF', border_color='#60A5FA', title_color='#1E3A8A')

# Connecting lines down to Storage/Filtering
draw_arrow(29, 86, 42, 75)
draw_arrow(71, 86, 58, 75)

# 4. FILTERING / STORAGE STAGE
draw_stage(69, "MEMORY / VECTOR")
# Outer Container Box
container = patches.FancyBboxPatch((16, 61), 68, 14, boxstyle="round,pad=0.2,rounding_size=1.0", facecolor='white', edgecolor='#1F2937', linewidth=1.5, zorder=2)
ax.add_patch(container)
ax.text(50, 72.5, "Semantic Memory & Vector Store", ha='center', va='center', fontsize=11, fontweight='bold', color='#111827', zorder=3)
ax.text(50, 69.5, "Dense Vector Embeddings (Cosine Similarity Scoring | Token Chunking)", ha='center', va='center', fontsize=7.5, color='#4B5563', zorder=3)

# Inside Badges
draw_box(20, 63, 17, 4.5, "Deduplication Cache", bg_color='#F3F4F6', border_color='#9CA3AF', title_color='#374151', corner_radius=0.5, lw=0.8)
draw_box(41.5, 63, 17, 4.5, "Noise & Ad Filter", bg_color='#F3F4F6', border_color='#9CA3AF', title_color='#374151', corner_radius=0.5, lw=0.8)
draw_box(63, 63, 17, 4.5, "Context Reranker", bg_color='#F3F4F6', border_color='#9CA3AF', title_color='#374151', corner_radius=0.5, lw=0.8)

draw_arrow(50, 61, 50, 52)

# 5. MULTI-AGENT ENGINE STAGE
draw_stage(46, "AGENT ENGINE")
agent_container = patches.FancyBboxPatch((20, 41), 60, 11, boxstyle="round,pad=0.2,rounding_size=1.0", facecolor='white', edgecolor='#1F2937', linewidth=1.5, zorder=2)
ax.add_patch(agent_container)
ax.text(50, 49.5, "Multi-Agent Core Engine", ha='center', va='center', fontsize=11, fontweight='bold', color='#111827', zorder=3)

# Agent Badges
draw_box(23, 43, 15, 4.2, "PLANNER", bg_color='#DEF7EC', border_color='#31C48D', title_color='#03543F', corner_radius=0.5, lw=1)
draw_box(42.5, 43, 15, 4.2, "CRAWLER", bg_color='#FEEBC8', border_color='#F6AD55', title_color='#7B341E', corner_radius=0.5, lw=1)
draw_box(62, 43, 15, 4.2, "PUBLISHER", bg_color='#E1EFFE', border_color='#76A9FA', title_color='#1E429F', corner_radius=0.5, lw=1)

# Status/Verification sub-badge
draw_box(37.5, 38, 25, 3.8, "EVIDENCE_VERIFIED", bg_color='#F3E8FF', border_color='#C084FC', title_color='#6B21A8', corner_radius=0.4, lw=1)
draw_arrow(50, 41, 50, 38)
draw_arrow(50, 38, 50, 31)

# 6. PUBLISHING & CITATION STAGE
draw_stage(26, "PUBLISHING")
draw_box(10, 22, 38, 9, "Citation & Grounding Engine", "Deterministic In-Text Hyperlinks | Primary URL Validation", bg_color='#FEF3C7', border_color='#F59E0B', title_color='#92400E')
draw_box(52, 22, 38, 9, "Document Synthesis Engine", "Multi-Section Structuring | >2,000 Words Cohesive Text", bg_color='#FEF3C7', border_color='#F59E0B', title_color='#92400E')

draw_arrow(29, 22, 29, 15)
draw_arrow(71, 22, 71, 15)

# 7. INTERFACE / EXPORT STAGE
draw_stage(10, "INTERFACE")
draw_box(10, 6, 38, 9, "Next.js Web Dashboard", "Interactive UI | Live Progress Logs | Chat With Report", bg_color='#DEF7EC', border_color='#31C48D', title_color='#03543F')
draw_box(52, 6, 38, 9, "Multi-Format Exporter", "Adobe PDF | Microsoft Word (.docx) | Markdown (.md)", bg_color='#DEF7EC', border_color='#31C48D', title_color='#03543F')

# Lines down to End User
draw_arrow(29, 6, 45, 0.5)
draw_arrow(71, 6, 55, 0.5)

# 8. END USER
draw_stage(0, "END USER")
draw_box(30, -5, 40, 5.5, "End User", "Researcher | Academic Analyst | Industry Professional", bg_color='#F3F4F6', border_color='#4B5563', title_color='#111827')

plt.tight_layout()
plt.subplots_adjust(left=0.04, right=0.96, top=0.96, bottom=0.05)
plt.savefig(r'c:\gpt-researcher\system_architecture_reference_style.png', dpi=300, bbox_inches='tight')
print("Successfully generated system_architecture_reference_style.png")
