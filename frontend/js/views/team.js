/**
 * InquireX AI Research Team View
 * Displays documented Multi-Agent LangGraph Orchestration pipeline (agent_teams)
 * and Single-Agent Persona routing catalog alongside real live session status.
 * Strictly avoids fabricating active states when no research run is live.
 */

import { store } from '../store.js';
import { escapeHtml } from '../ui.js';
import { fetchAgentDiscovery } from '../api.js';

const LANGGRAPH_AGENTS = [
  {
    id: 'chief_editor',
    name: 'Chief Editor',
    role: 'Supervisor & State Graph Coordinator',
    desc: 'Initializes research state, coordinates parallel sub-researchers, and routes revisions between Writer and Reviewer.',
  },
  {
    id: 'researcher',
    name: 'Browser & RAG Researcher',
    role: 'Information Gathering & Context Filtering',
    desc: 'Executes targeted web/local queries, extracts verified text, and filters high-signal context chunks.',
  },
  {
    id: 'writer',
    name: 'Research Writer',
    role: 'Drafting & Citation Synthesis',
    desc: 'Synthesizes collected findings into cohesive sections, introduction, conclusion, and structured formatting.',
  },
  {
    id: 'reviewer',
    name: 'Reviewer Agent',
    role: 'Critical Quality Assurance',
    desc: 'Evaluates draft completeness, methodological alignment, factual grounding, and requests targeted revisions.',
  },
  {
    id: 'reviser',
    name: 'Reviser Agent',
    role: 'Iterative Section Refinement',
    desc: 'Applies Reviewer critique directly to drafts before final compilation.',
  },
  {
    id: 'publisher',
    name: 'Publisher Agent',
    role: 'Multi-Format Artifact Export',
    desc: 'Publishes finalized reports to Markdown, PDF, Word (.docx), and JSON outputs.',
  },
  {
    id: 'human',
    name: 'Human-in-the-Loop Gate',
    role: 'Interactive Plan Approval',
    desc: 'Optional interactive checkpoint allowing researchers to review or steer topic outlines during execution.',
  },
];

const SINGLE_AGENT_PERSONAS = [
  {
    id: 'Auto Agent',
    avatar: '/static/defaultAgentAvatar.JPG',
    icon: 'fa-wand-magic-sparkles',
    title: 'Auto Agent',
    specialty: 'Dynamic Domain Routing',
    desc: 'Automatically selects an optimal research persona and search strategy from the submitted inquiry.',
    tone: 'Objective',
  },
  {
    id: 'Business Analyst',
    avatar: '/static/businessAnalystAgentAvatar.png',
    icon: 'fa-chart-line',
    title: 'Business Analyst',
    specialty: 'Strategy, Markets & Competitive Intelligence',
    desc: 'Prioritizes market sizing, SWOT vectors, competitive positioning, and enterprise adoption dynamics.',
    tone: 'Analytical',
  },
  {
    id: 'Academic Researcher',
    avatar: '/static/academicResearchAgentAvatar.png',
    icon: 'fa-graduation-cap',
    title: 'Academic Researcher',
    specialty: 'Peer-Reviewed Evidence & Literature Synthesis',
    desc: 'Emphasizes formal citations, empirical methodology comparison, and objective scholarly tone.',
    tone: 'Formal',
  },
  {
    id: 'Technical Lead',
    avatar: '/static/computerSecurityanalystAvatar.png',
    icon: 'fa-shield-halved',
    title: 'Technical & Security Lead',
    specialty: 'Systems Architecture & Security Auditing',
    desc: 'Examines technical specifications, protocol benchmarks, threat models, and implementation trade-offs.',
    tone: 'Analytical',
  },
  {
    id: 'Financial Analyst',
    avatar: '/static/financeAgentAvatar.png',
    icon: 'fa-coins',
    title: 'Financial Analyst',
    specialty: 'Valuation, Capital Allocation & Macro Indicators',
    desc: 'Surfaces revenue drivers, balance-sheet fundamentals, capital trends, and quantitative guidance.',
    tone: 'Objective',
  },
  {
    id: 'Quantitative Analyst',
    avatar: '/static/mathAgentAvatar.png',
    icon: 'fa-square-root-variable',
    title: 'Quantitative Analyst',
    specialty: 'Mathematical Modeling & Statistical Benchmarks',
    desc: 'Focuses on quantitative evaluation metrics, statistical comparisons, and reproducibility criteria.',
    tone: 'Comparative',
  },
];

export function renderTeamView(container, ctx) {
  const session = store.state.liveSession;
  const isRunning = session.status === 'running' || session.status === 'connecting' || session.status === 'reconnecting';
  const activeMode = session.config?.report_type === 'detailed_report' || session.config?.report_type === 'deep'
    ? 'Multi-Agent / Deep Pipeline'
    : 'Single-Agent / Standard Pipeline';

  container.innerHTML = `
    <div class="ix-view-enter">
      <div class="ix-page-header">
        <div>
          <h1 class="ix-page-title">AI Research Team</h1>
          <p class="ix-page-desc">
            Inspect the documented InquireX autonomous agent personas and multi-agent LangGraph orchestration architecture.
          </p>
        </div>
        <div class="ix-page-actions">
          ${
            isRunning
              ? `<button type="button" class="ix-btn ix-btn-secondary" data-nav="live-research">
                   <span class="ix-ws-dot connected"></span> Watch Live Run
                 </button>`
              : ''
          }
          <button type="button" class="ix-btn ix-btn-primary" data-nav="new-research">
            <i class="fa-solid fa-plus"></i> Configure Research Team
          </button>
        </div>
      </div>

      <!-- Honest Runtime Status Banner -->
      <div class="ix-live-status-banner">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="ix-ws-dot ${isRunning ? 'connected' : ''}"></span>
          <div>
            <div style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary);">
              ${
                isRunning
                  ? `Active Runtime: ${escapeHtml(session.activeAgentName || session.config?.agent || 'Auto Agent')}`
                  : 'Execution Status: Idle (No background agent loops active)'
              }
            </div>
            <div class="ix-help">
              ${
                isRunning
                  ? `Mode: ${escapeHtml(activeMode)} — Topic: ${escapeHtml((session.task || '').slice(0, 90))}`
                  : 'Agents execute strictly on-demand when you initiate a research task over WebSocket.'
              }
            </div>
          </div>
        </div>
        <span class="ix-badge ${isRunning ? 'ix-badge-success' : ''}" id="ixDiscoveryCapabilityBadge">
          Checking /.well-known/agent-discovery.json...
        </span>
      </div>

      <!-- Multi-Agent Orchestration Section -->
      <section class="ix-card" style="margin-bottom:var(--space-6);">
        <div class="ix-card-header">
          <h2 class="ix-card-title"><i class="fa-solid fa-diagram-project"></i> Multi-Agent LangGraph Orchestration (agent_teams)</h2>
          <span class="ix-badge ix-badge-accent">Detailed &amp; Deep Reports</span>
        </div>
        <div class="ix-card-body">
          <p class="ix-help" style="margin-bottom:var(--space-4);">
            When running <strong>Detailed</strong> or <strong>Deep</strong> reports, InquireX executes a stateful coordination graph where specialized agents plan sections, research in parallel, critique drafts, and publish verified artifacts.
          </p>

          <!-- Clean Theme-Adaptive SVG Flow Diagram -->
          <div style="overflow-x:auto; padding:var(--space-4); border:1px solid var(--border-default); border-radius:var(--radius-lg); background-color:var(--bg-secondary); margin-bottom:var(--space-5);">
            <svg viewBox="0 0 860 110" width="100%" height="110" style="min-width:680px; display:block;" aria-label="LangGraph agent collaboration pipeline">
              <defs>
                <marker id="ixArrowHead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="var(--text-secondary)" />
                </marker>
              </defs>
              ${[
                { x: 12, label: 'Chief Editor', sub: 'Plan & Route' },
                { x: 154, label: 'Researcher', sub: 'Web / RAG' },
                { x: 296, label: 'Writer', sub: 'Synthesize' },
                { x: 438, label: 'Reviewer', sub: 'Audit Critique' },
                { x: 580, label: 'Reviser', sub: 'Refine Draft' },
                { x: 722, label: 'Publisher', sub: 'MD / PDF / DOCX' },
              ]
                .map(
                  (n, i, arr) => `
                  <g transform="translate(${n.x}, 20)">
                    <rect width="124" height="62" rx="10" fill="var(--bg-card)" stroke="${
                      isRunning && i <= 2 ? 'var(--accent-primary)' : 'var(--border-strong)'
                    }" stroke-width="1.5" />
                    <text x="62" y="27" text-anchor="middle" fill="var(--text-primary)" font-size="12" font-weight="600" font-family="var(--font-sans)">${n.label}</text>
                    <text x="62" y="45" text-anchor="middle" fill="var(--text-secondary)" font-size="10.5" font-family="var(--font-sans)">${n.sub}</text>
                  </g>
                  ${
                    i < arr.length - 1
                      ? `<line x1="${n.x + 124}" y1="51" x2="${n.x + 152}" y2="51" stroke="var(--text-secondary)" stroke-width="1.5" marker-end="url(#ixArrowHead)" />`
                      : ''
                  }`
                )
                .join('')}
            </svg>
          </div>

          <div class="ix-team-grid">
            ${LANGGRAPH_AGENTS.map(
              (ag) => `
              <div class="ix-agent-card" style="padding:var(--space-4);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div>
                    <div style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary);">${escapeHtml(ag.name)}</div>
                    <div style="font-size:var(--text-xs); color:var(--accent-primary); font-weight:500;">${escapeHtml(ag.role)}</div>
                  </div>
                  <span class="ix-badge ${isRunning ? 'ix-badge-info' : ''}">
                    ${isRunning ? 'Pipeline Ready' : 'Standby'}
                  </span>
                </div>
                <p class="ix-help" style="margin:0; line-height:1.5;">${escapeHtml(ag.desc)}</p>
              </div>`
            ).join('')}
          </div>
        </div>
      </section>

      <!-- Single-Agent Persona Routing Catalog -->
      <section>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-4); flex-wrap:wrap; gap:8px;">
          <div>
            <h2 style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary);">Single-Agent Domain Personas</h2>
            <p class="ix-help">Select a persona below to pre-configure your next research run.</p>
          </div>
        </div>

        <div class="ix-team-grid">
          ${SINGLE_AGENT_PERSONAS.map((p) => {
            const isSelected = store.state.draftConfig?.agent === p.id;
            return `
              <div class="ix-agent-card">
                <div class="ix-agent-head">
                  <img
                    src="${escapeHtml(p.avatar)}"
                    alt="${escapeHtml(p.title)}"
                    class="ix-agent-avatar"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"
                  />
                  <span class="ix-empty-icon ix-hidden" style="width:44px; height:44px; flex-shrink:0;">
                    <i class="fa-solid ${escapeHtml(p.icon)}"></i>
                  </span>
                  <div style="min-width:0; flex:1;">
                    <div style="font-weight:600; font-size:var(--text-md); color:var(--text-primary);">${escapeHtml(p.title)}</div>
                    <div style="font-size:var(--text-xs); color:var(--text-secondary);">${escapeHtml(p.specialty)}</div>
                  </div>
                </div>
                <p class="ix-help" style="margin:0; flex:1; line-height:1.55;">${escapeHtml(p.desc)}</p>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:8px; border-top:1px solid var(--border-subtle);">
                  <span class="ix-badge">Default Tone: ${escapeHtml(p.tone)}</span>
                  <button
                    type="button"
                    class="ix-btn ${isSelected ? 'ix-btn-primary' : 'ix-btn-secondary'} ix-btn-sm"
                    data-select-persona="${escapeHtml(p.id)}"
                    data-select-tone="${escapeHtml(p.tone)}"
                  >
                    ${isSelected ? '<i class="fa-solid fa-check"></i> Selected' : 'Use Persona'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((btn) =>
    btn.addEventListener('click', () => ctx.navigate(btn.getAttribute('data-nav')))
  );

  container.querySelectorAll('[data-select-persona]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const agent = btn.getAttribute('data-select-persona');
      const tone = btn.getAttribute('data-select-tone');
      store.updateDraftConfig({ agent, tone });
      ctx.navigate('new-research');
    });
  });

  // Live backend check against /.well-known/agent-discovery.json
  const badgeEl = container.querySelector('#ixDiscoveryCapabilityBadge');
  fetchAgentDiscovery()
    .then((meta) => {
      if (!badgeEl || !document.body.contains(badgeEl)) return;
      const protocol = meta?.protocol_version || meta?.version || 'A2A Enabled';
      badgeEl.className = 'ix-badge ix-badge-success';
      badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Discovery API: ${escapeHtml(String(protocol))}`;
    })
    .catch(() => {
      if (!badgeEl || !document.body.contains(badgeEl)) return;
      badgeEl.className = 'ix-badge';
      badgeEl.textContent = 'Discovery Endpoint Unavailable';
    });
}
