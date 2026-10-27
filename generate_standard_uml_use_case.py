import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Professional widescreen 16:9 canvas
fig, ax = plt.subplots(figsize=(15, 8.5), dpi=300)
ax.set_facecolor('white')
fig.patch.set_facecolor('white')
ax.set_xlim(0, 150)
ax.set_ylim(0, 85)
ax.axis('off')

# System Boundary Box (UML Standard)
boundary = patches.FancyBboxPatch(
    (32, 4), 86, 76,
    boxstyle="round,pad=0.5,rounding_size=2.0",
    facecolor='#F8FAFC', edgecolor='#64748B', linewidth=1.5, zorder=1
)
ax.add_patch(boundary)
ax.text(75, 76.5, "Autonomous Deep Research System", ha='center', va='center', fontsize=15, fontweight='bold', color='#0F172A')

# Function to draw Stick Figure Actor
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

# Primary & Secondary Actors
draw_actor(15, 45, "End User /\nResearcher")
draw_actor(135, 45, "External Search &\nLLM Services")

# Function to draw UML Use Case Oval
def draw_use_case(cx, cy, text, w=32, h=7.5, fill='#EFF6FF', border='#3B82F6', text_color='#1E3A8A'):
    oval = patches.FancyBboxPatch(
        (cx - w/2, cy - h/2), w, h,
        boxstyle="round,pad=0.2,rounding_size=3.8",
        facecolor=fill, edgecolor=border, linewidth=1.4, zorder=2
    )
    ax.add_patch(oval)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=10, fontweight='bold', color=text_color, zorder=3)

# 8 Standard UML Use Cases (User capabilities + External System capabilities)
# Centered vertically in a clean balanced stack
uc1 = (75, 68)  # Submit Research Query
uc2 = (75, 59)  # Configure Research Parameters
uc3 = (75, 50)  # Upload Local Documents (PDF/DOCX)
uc4 = (75, 41)  # Monitor Real-Time Research Stream
uc5 = (75, 32)  # Chat with Synthesized Report
uc6 = (75, 23)  # Export Final Report (PDF / Word / MD)
uc7 = (75, 14)  # Fetch Multi-Engine Search Results
uc8 = (75, 5.5) # Execute LLM Inference & Verification

# Draw User Use Cases (Blue theme)
draw_use_case(uc1[0], uc1[1], "Submit Research Query")
draw_use_case(uc2[0], uc2[1], "Configure Research Parameters")
draw_use_case(uc3[0], uc3[1], "Upload Local Documents (PDF / DOCX)")
draw_use_case(uc4[0], uc4[1], "Monitor Real-Time Research Stream")
draw_use_case(uc5[0], uc5[1], "Chat with Synthesized Report")
draw_use_case(uc6[0], uc6[1], "Export Final Report (PDF / Word / MD)", fill='#F5F3FF', border='#8B5CF6', text_color='#5B21B6')

# Draw External System Use Cases (Green / Teal theme)
draw_use_case(uc7[0], uc7[1], "Fetch Multi-Engine Search Results", fill='#F0FDF4', border='#22C55E', text_color='#15803D')
draw_use_case(uc8[0], uc8[1], "Execute LLM Inference & Verification", fill='#FEF3C7', border='#F59E0B', text_color='#B45309')

# UML Standard Solid Association Lines (NO confusing arrows, perfectly straight/clean)
user_pt = (19, 45)
ax.plot([user_pt[0], uc1[0] - 16], [user_pt[1], uc1[1]], color='#334155', lw=1.3, zorder=1)
ax.plot([user_pt[0], uc2[0] - 16], [user_pt[1], uc2[1]], color='#334155', lw=1.3, zorder=1)
ax.plot([user_pt[0], uc3[0] - 16], [user_pt[1], uc3[1]], color='#334155', lw=1.3, zorder=1)
ax.plot([user_pt[0], uc4[0] - 16], [user_pt[1], uc4[1]], color='#334155', lw=1.3, zorder=1)
ax.plot([user_pt[0], uc5[0] - 16], [user_pt[1], uc5[1]], color='#334155', lw=1.3, zorder=1)
ax.plot([user_pt[0], uc6[0] - 16], [user_pt[1], uc6[1]], color='#334155', lw=1.3, zorder=1)

api_pt = (131, 45)
ax.plot([api_pt[0], uc7[0] + 16], [api_pt[1], uc7[1]], color='#334155', lw=1.3, zorder=1)
ax.plot([api_pt[0], uc8[0] + 16], [api_pt[1], uc8[1]], color='#334155', lw=1.3, zorder=1)

plt.tight_layout()
plt.subplots_adjust(left=0.01, right=0.99, top=0.98, bottom=0.02)
plt.savefig(r'c:\gpt-researcher\use_case_diagram_standard.png', dpi=300, bbox_inches='tight')
print("Successfully generated use_case_diagram_standard.png")
