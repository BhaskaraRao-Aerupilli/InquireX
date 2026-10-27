import matplotlib.pyplot as plt
import matplotlib.patches as patches

# High-resolution widescreen canvas
fig, ax = plt.subplots(figsize=(15, 8.5), dpi=300)
ax.set_facecolor('white')
fig.patch.set_facecolor('white')
ax.set_xlim(0, 150)
ax.set_ylim(0, 85)
ax.axis('off')

# System Boundary Box
boundary = patches.FancyBboxPatch(
    (30, 4), 90, 76,
    boxstyle="round,pad=0.5,rounding_size=2.0",
    facecolor='#F8FAFC', edgecolor='#64748B', linewidth=1.5, zorder=1
)
ax.add_patch(boundary)
ax.text(75, 76.5, "Autonomous Deep Research System", ha='center', va='center', fontsize=15, fontweight='bold', color='#0F172A')

# Function to draw Actor Stick Figure
def draw_actor(x, y, label):
    head = patches.Circle((x, y + 10), 3.0, facecolor='#E2E8F0', edgecolor='#1E293B', linewidth=1.8, zorder=3)
    ax.add_patch(head)
    # Body
    ax.plot([x, x], [y + 7, y - 2], color='#1E293B', lw=2, zorder=3)
    # Arms
    ax.plot([x - 5.5, x + 5.5], [y + 4, y + 4], color='#1E293B', lw=2, zorder=3)
    # Legs
    ax.plot([x, x - 4.5], [y - 2, y - 10], color='#1E293B', lw=2, zorder=3)
    ax.plot([x, x + 4.5], [y - 2, y - 10], color='#1E293B', lw=2, zorder=3)
    # Label
    ax.text(x, y - 14, label, ha='center', va='center', fontsize=11, fontweight='bold', color='#0F172A', zorder=3)

draw_actor(15, 45, "End User /\nResearcher")
draw_actor(135, 45, "External Services /\nLLM API")

# Function to draw Use Case Oval
def draw_use_case(cx, cy, text, w=27, h=8.0, fill='#EFF6FF', border='#3B82F6', text_color='#1E3A8A'):
    oval = patches.FancyBboxPatch(
        (cx - w/2, cy - h/2), w, h,
        boxstyle="round,pad=0.2,rounding_size=3.8",
        facecolor=fill, edgecolor=border, linewidth=1.5, zorder=2
    )
    ax.add_patch(oval)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=9.5, fontweight='bold', color=text_color, zorder=3)

# Coordinates for Use Cases (Properly spaced to avoid any collision)
# Left Column: User Interactive Actions
uc_query      = (48, 66)
uc_params     = (48, 54)
uc_upload     = (48, 42)
uc_monitor    = (48, 30)
uc_chat       = (48, 18)
uc_export     = (48, 8)   # Placed cleanly in user column at the bottom!

# Right Column: Automated Backend Workflows
uc_research   = (102, 58)
uc_generate   = (102, 38)

# Render Left Column Use Cases (User-driven)
draw_use_case(uc_query[0],   uc_query[1],   "Submit Research\nQuery")
draw_use_case(uc_params[0],  uc_params[1],  "Configure Research\nParameters")
draw_use_case(uc_upload[0],  uc_upload[1],  "Upload Local\nDocuments")
draw_use_case(uc_monitor[0], uc_monitor[1], "Monitor Live\nResearch Progress")
draw_use_case(uc_chat[0],    uc_chat[1],    "Chat with\nCompleted Report")
draw_use_case(uc_export[0],  uc_export[1],  "Export Final Report\n(PDF / Word / MD)", fill='#F5F3FF', border='#8B5CF6', text_color='#5B21B6')

# Render Right Column Use Cases (System/API-driven)
draw_use_case(uc_research[0], uc_research[1], "Conduct Automated\nWeb Research", w=28, h=8.5, fill='#F0FDF4', border='#22C55E', text_color='#15803D')
draw_use_case(uc_generate[0], uc_generate[1], "Generate Cited\nResearch Report", w=28, h=8.5, fill='#FEF3C7', border='#F59E0B', text_color='#B45309')

# Actor Association Lines (User to Left Column: Direct, Clean, No Intersecting Boxes)
user_pt = (18, 46)
ax.plot([user_pt[0], uc_query[0] - 13.5],   [user_pt[1], uc_query[1]],   color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc_params[0] - 13.5],  [user_pt[1], uc_params[1]],  color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc_upload[0] - 13.5],  [user_pt[1], uc_upload[1]],  color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc_monitor[0] - 13.5], [user_pt[1], uc_monitor[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc_chat[0] - 13.5],    [user_pt[1], uc_chat[1]],    color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc_export[0] - 13.5],  [user_pt[1], uc_export[1]],  color='#334155', lw=1.3, zorder=2)

# External Actor Association Lines (Right Actor to Automated Web Research & Report Synthesis)
api_pt = (132, 46)
ax.plot([api_pt[0], uc_research[0] + 14], [api_pt[1], uc_research[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([api_pt[0], uc_generate[0] + 14], [api_pt[1], uc_generate[1]], color='#334155', lw=1.3, zorder=2)

# System Workflow Arrows (Completely clean, non-overlapping paths):
# 1. Submit Query -> Conduct Automated Web Research
ax.annotate('', xy=(uc_research[0] - 14, uc_research[1] + 2), xytext=(uc_query[0] + 13.5, uc_query[1]),
            arrowprops=dict(arrowstyle="-|>", color="#0F172A", lw=1.5, mutation_scale=12), zorder=4)

# 2. Conduct Research -> Generate Cited Report (Vertical arrow)
ax.annotate('', xy=(uc_generate[0], uc_generate[1] + 4.25), xytext=(uc_research[0], uc_research[1] - 4.25),
            arrowprops=dict(arrowstyle="-|>", color="#0F172A", lw=1.5, mutation_scale=12), zorder=4)

# 3. Generate Report -> Export Final Report (Clean downward angled curve, zero overlaps)
ax.annotate('', xy=(uc_export[0] + 13.5, uc_export[1]), xytext=(uc_generate[0] - 8, uc_generate[1] - 4.25),
            arrowprops=dict(arrowstyle="-|>", color="#0F172A", lw=1.5, mutation_scale=12,
                            connectionstyle="arc3,rad=-0.15"), zorder=4)

plt.tight_layout()
plt.subplots_adjust(left=0.01, right=0.99, top=0.98, bottom=0.02)
plt.savefig(r'c:\gpt-researcher\use_case_diagram_no_overlap.png', dpi=300, bbox_inches='tight')
print("Successfully generated use_case_diagram_no_overlap.png")
