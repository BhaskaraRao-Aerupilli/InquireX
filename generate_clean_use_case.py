import matplotlib.pyplot as plt
import matplotlib.patches as patches

fig, ax = plt.subplots(figsize=(14, 8), dpi=300)
ax.set_facecolor('white')
fig.patch.set_facecolor('white')
ax.set_xlim(0, 140)
ax.set_ylim(0, 80)
ax.axis('off')

# System Boundary Box
boundary = patches.FancyBboxPatch(
    (28, 5), 84, 70,
    boxstyle="round,pad=0.5,rounding_size=2.0",
    facecolor='#F8FAFC', edgecolor='#64748B', linewidth=1.5, zorder=1
)
ax.add_patch(boundary)
ax.text(70, 71.5, "Autonomous Deep Research System", ha='center', va='center', fontsize=15, fontweight='bold', color='#0F172A')

# Function to draw Stick Figure Actor
def draw_actor(x, y, label):
    # Head
    head = patches.Circle((x, y + 10), 2.8, facecolor='#E2E8F0', edgecolor='#1E293B', linewidth=1.8, zorder=3)
    ax.add_patch(head)
    # Body
    ax.plot([x, x], [y + 7.2, y - 2], color='#1E293B', lw=2, zorder=3)
    # Arms
    ax.plot([x - 5, x + 5], [y + 4, y + 4], color='#1E293B', lw=2, zorder=3)
    # Legs
    ax.plot([x, x - 4.5], [y - 2, y - 10], color='#1E293B', lw=2, zorder=3)
    ax.plot([x, x + 4.5], [y - 2, y - 10], color='#1E293B', lw=2, zorder=3)
    # Label
    ax.text(x, y - 14, label, ha='center', va='center', fontsize=11, fontweight='bold', color='#0F172A', zorder=3)

draw_actor(14, 42, "End User /\nResearcher")
draw_actor(126, 42, "External Services /\nLLM API")

# Helper to draw use case ovals
def draw_use_case(cx, cy, text, w=26, h=7.5, fill='#EFF6FF', border='#3B82F6'):
    oval = patches.FancyBboxPatch(
        (cx - w/2, cy - h/2), w, h,
        boxstyle="round,pad=0.2,rounding_size=3.5",
        facecolor=fill, edgecolor=border, linewidth=1.5, zorder=2
    )
    ax.add_patch(oval)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=10, fontweight='semibold', color='#1E3A8A', zorder=3)

# User-facing Use Cases (Left Column)
uc1 = (45, 62)  # Submit Research Query
uc2 = (45, 51)  # Configure Parameters
uc3 = (45, 40)  # Upload Local Documents
uc4 = (45, 29)  # Monitor Live Progress
uc5 = (45, 18)  # Chat with Completed Report

draw_use_case(uc1[0], uc1[1], "Submit Research\nQuery")
draw_use_case(uc2[0], uc2[1], "Configure Research\nParameters")
draw_use_case(uc3[0], uc3[1], "Upload Local\nDocuments")
draw_use_case(uc4[0], uc4[1], "Monitor Live\nResearch Progress")
draw_use_case(uc5[0], uc5[1], "Chat with\nCompleted Report")

# System & Export Use Cases (Right Column)
uc6 = (95, 58)  # Conduct Automated Web Research
uc7 = (95, 42)  # Generate Cited Research Report
uc8 = (95, 22)  # Export Final Report (PDF/Word)

draw_use_case(uc6[0], uc6[1], "Conduct Automated\nWeb Research", w=27, h=8.5, fill='#F0FDF4', border='#22C55E')
draw_use_case(uc7[0], uc7[1], "Generate Cited\nResearch Report", w=27, h=8.5, fill='#FEF3C7', border='#F59E0B')
draw_use_case(uc8[0], uc8[1], "Export Final Report\n(PDF / Word / MD)", w=27, h=8.5, fill='#F5F3FF', border='#8B5CF6')

# Actor Association Lines (User to Left Column + Export)
user_pt = (17, 43)
ax.plot([user_pt[0], uc1[0] - 13], [user_pt[1], uc1[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc2[0] - 13], [user_pt[1], uc2[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc3[0] - 13], [user_pt[1], uc3[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc4[0] - 13], [user_pt[1], uc4[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([user_pt[0], uc5[0] - 13], [user_pt[1], uc5[1]], color='#334155', lw=1.3, zorder=2)
# User can also export
ax.plot([user_pt[0], 45, uc8[0] - 13.5], [user_pt[1], 12, uc8[1]], color='#334155', lw=1.3, zorder=2)

# External Actor Association Lines (Right Actor to Automated Research & Synthesis)
api_pt = (123, 43)
ax.plot([api_pt[0], uc6[0] + 13.5], [api_pt[1], uc6[1]], color='#334155', lw=1.3, zorder=2)
ax.plot([api_pt[0], uc7[0] + 13.5], [api_pt[1], uc7[1]], color='#334155', lw=1.3, zorder=2)

# Clean Directional System Flow Arrows (Submit -> Research -> Generate -> Export)
# Arrow 1: Submit Query triggers Conduct Research
ax.annotate('', xy=(uc6[0] - 13.5, uc6[1]), xytext=(uc1[0] + 13, uc1[1]),
            arrowprops=dict(arrowstyle="-|>", color="#0F172A", lw=1.5, mutation_scale=12), zorder=4)

# Arrow 2: Conduct Research triggers Generate Report
ax.annotate('', xy=(uc7[0], uc7[1] + 4.25), xytext=(uc6[0], uc6[1] - 4.25),
            arrowprops=dict(arrowstyle="-|>", color="#0F172A", lw=1.5, mutation_scale=12), zorder=4)

# Arrow 3: Generate Report enables Export Report
ax.annotate('', xy=(uc8[0], uc8[1] + 4.25), xytext=(uc7[0], uc7[1] - 4.25),
            arrowprops=dict(arrowstyle="-|>", color="#0F172A", lw=1.5, mutation_scale=12), zorder=4)

plt.tight_layout()
plt.subplots_adjust(left=0.01, right=0.99, top=0.98, bottom=0.02)
plt.savefig(r'c:\gpt-researcher\use_case_diagram_perfect.png', dpi=300, bbox_inches='tight')
print("Successfully generated use_case_diagram_perfect.png")
