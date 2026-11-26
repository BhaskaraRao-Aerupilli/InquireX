/**
 * InquireX Home View
 * Signature InquireX landing hero featuring the animated 3D Quantum Agent Orb,
 * staggered entrance choreography, interactive capability pills, and quick launch actions.
 */

import { store } from '../store.js';
import { escapeHtml } from '../ui.js';

export function renderHomeView(container, ctx) {
  const { reports, files, liveSession } = store.state;
  const isRunning =
    liveSession.status === 'running' ||
    liveSession.status === 'connecting' ||
    liveSession.status === 'reconnecting';

  const featurePills = [
    { icon: 'fa-sitemap', label: 'Multi-Hop Planning', route: 'new-research' },
    { icon: 'fa-globe', label: 'Deep Web Retrieval', route: 'new-research' },
    { icon: 'fa-filter', label: 'Semantic Vector RAG', route: 'documents' },
    { icon: 'fa-shield-halved', label: 'Citation Grounding', route: 'fact-verification' },
    { icon: 'fa-chalkboard-user', label: 'Presentation Slide Deck', route: 'presentations' },
  ];

  container.innerHTML = `
    <div class="ix-home-hero">
      <div class="ix-orb-stage">
        <button
          type="button"
          class="quantum-agent-orb"
          id="quantumAgentOrbLanding"
          aria-label="Launch Research Agent"
          title="Click to start new research"
        >
          <span class="orb-sonar-ring" aria-hidden="true"></span>
          <span class="orb-pulse-glow" aria-hidden="true"></span>
          <span class="orb-outer-ring" aria-hidden="true"></span>
          <span class="orb-gyro-ring" aria-hidden="true"></span>
          <span class="orb-gyro-ring-alt" aria-hidden="true"></span>
          <span class="orb-core">
            <i class="fa-solid fa-atom orb-icon"></i>
          </span>
          <span class="orb-particles" aria-hidden="true">
            <span class="p-dot dot-1"></span>
            <span class="p-dot dot-2"></span>
            <span class="p-dot dot-3"></span>
            <span class="p-dot dot-4"></span>
          </span>
        </button>
      </div>

      <div class="ix-home-badge ix-hero-stagger" style="--ix-delay:110ms;">
        <i class="fa-solid fa-microchip"></i>
        <span>INQUIREX &mdash; AGENTIC RESEARCH ENGINE V2.0</span>
      </div>

      <h1 class="ix-home-title ix-hero-stagger" style="--ix-delay:190ms;">
        An Agentic AI-Driven<br />
        <span class="ix-hero-rag-text">RAG Framework</span>
      </h1>

      <h2 class="ix-home-subtitle ix-hero-stagger" style="--ix-delay:260ms;">
        for Automated Deep Web Research and Analytical Reporting
      </h2>

      <p class="ix-home-desc ix-hero-stagger" style="--ix-delay:330ms;">
        Autonomous multi-agent architecture for query decomposition, parallel deep-web scraping,
        vector context compression, verified citation synthesis, and interactive presentation decks.
      </p>

      <div class="ix-home-pills ix-hero-stagger" style="--ix-delay:410ms;">
        ${featurePills
          .map(
            (pill) => `
            <button type="button" class="ix-home-pill" data-nav="${escapeHtml(pill.route)}">
              <i class="fa-solid ${escapeHtml(pill.icon)}"></i>
              <span>${escapeHtml(pill.label)}</span>
            </button>`
          )
          .join('')}
      </div>

      <div class="ix-home-actions ix-hero-stagger" style="--ix-delay:490ms;">
        <button type="button" id="ixHeroLaunchBtn" class="ix-btn ix-btn-primary ix-btn-lg" data-nav="new-research">
          <i class="fa-solid fa-bolt"></i>
          <span>Launch Research Agent</span>
        </button>
        <button type="button" class="ix-btn ix-btn-secondary ix-btn-lg" data-nav="dashboard">
          <i class="fa-solid fa-table-columns"></i>
          <span>Open Dashboard</span>
        </button>
        ${
          isRunning
            ? `<button type="button" class="ix-btn ix-btn-secondary ix-btn-lg" data-nav="live-research">
                 <span class="ix-ws-dot connected"></span>
                 <span>View Live Research</span>
               </button>`
            : ''
        }
      </div>

      ${
        reports.length > 0 || files.length > 0
          ? `<div class="ix-home-meta-strip ix-hero-stagger" style="--ix-delay:560ms;">
               <span><strong>${reports.length}</strong> saved report${reports.length === 1 ? '' : 's'}</span>
               <span>&bull;</span>
               <span><strong>${files.length}</strong> indexed document${files.length === 1 ? '' : 's'}</span>
               <span>&bull;</span>
               <button type="button" class="ix-crumb-btn" data-nav="history" style="font-size:var(--text-xs);">View History &rarr;</button>
             </div>`
          : ''
      }
    </div>
  `;

  container.querySelector('#quantumAgentOrbLanding')?.addEventListener('click', () => {
    ctx.navigate('new-research');
  });

  container.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate(el.getAttribute('data-nav')));
  });
}
