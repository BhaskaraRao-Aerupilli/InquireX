/**
 * InquireX Live Research Workspace
 * Real-time execution status driven strictly by /ws backend events.
 * Uses incremental in-place DOM patching (updateLiveResearchDOM) so log lines
 * and streamed report tokens render smoothly with zero flicker or layout jumping.
 */

import { store } from '../store.js';
import { escapeHtml, markdownToHtml, renderEmptyState, renderErrorState } from '../ui.js';

const STAGES = [
  { num: 1, title: '1. Planning', defaultSub: 'Decomposing topic & sub-queries' },
  { num: 2, title: '2. Retrieval', defaultSub: 'Searching & scraping sources' },
  { num: 3, title: '3. Context RAG', defaultSub: 'Filtering relevant excerpts' },
  { num: 4, title: '4. Synthesis', defaultSub: 'Drafting grounded report' },
  { num: 5, title: '5. Verified', defaultSub: 'Citations & outputs saved' },
];

const BADGE_MAP = {
  connecting: { cls: 'ix-badge-info', label: 'Connecting to WebSocket...' },
  running: { cls: 'ix-badge-accent', label: 'Running Research' },
  reconnecting: { cls: 'ix-badge-warning', label: 'Connection Interrupted — Reconnecting...' },
  completed: { cls: 'ix-badge-success', label: 'Completed' },
  stopped: { cls: 'ix-badge-warning', label: 'Stopped by User' },
  error: { cls: 'ix-badge-error', label: 'Execution Error' },
};

function isSessionActiveStatus(status) {
  return status === 'running' || status === 'connecting' || status === 'reconnecting';
}

function buildStageState(st, session) {
  let cls = '';
  if (session.status === 'completed' || session.stage > st.num) cls = 'completed';
  else if (session.stage === st.num) {
    cls = session.status === 'error' || session.status === 'stopped' ? 'error' : 'active';
  }
  const iconCls =
    cls === 'completed'
      ? 'fa-check'
      : cls === 'active'
      ? 'fa-spinner fa-spin'
      : cls === 'error'
      ? 'fa-xmark'
      : 'fa-circle-dot';
  const sub = session.stage === st.num && session.stageLabel ? session.stageLabel : st.defaultSub;
  return { cls, iconCls, sub };
}

function renderLogLineHtml(log) {
  return `
    <div class="ix-log-line">
      <span style="color:var(--text-secondary); margin-right:6px;">[${escapeHtml(log.time)}]</span>
      <span>${log.sanitizedHtml || escapeHtml(log.text)}</span>
    </div>
  `;
}

export function renderLiveResearchView(container, ctx) {
  const session = store.state.liveSession;
  const ws = store.state.wsStats;

  if (session.status === 'idle') {
    container._ixLiveState = null;
    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Live Research Workspace</h1>
            <p class="ix-page-desc">Monitor active multi-source search, scraping logs, and report token streaming over WebSockets.</p>
          </div>
        </div>
        ${renderEmptyState({
          icon: 'fa-wave-square',
          title: 'No research currently running',
          desc: 'Start a research inquiry from New Research to stream real-time agent logs, sources, and report generation here.',
          actionHtml: `<button type="button" class="ix-btn ix-btn-primary" data-nav="new-research"><i class="fa-solid fa-plus"></i> Configure New Research</button>`,
        })}
      </div>
    `;
    container.querySelector('[data-nav]')?.addEventListener('click', () => ctx.navigate('new-research'));
    return;
  }

  // If live shell is already mounted for this task, perform surgical update only
  const existingRoot = container.querySelector('#ixLiveViewRoot');
  if (existingRoot && container._ixLiveState?.task === session.task) {
    updateLiveResearchDOM(container, ctx);
    return;
  }

  const badge = BADGE_MAP[session.status] || { cls: '', label: session.status };
  const isRunning = isSessionActiveStatus(session.status);
  const canOpenReport = session.status === 'completed' || (session.html && session.html.length > 50);

  container.innerHTML = `
    <div id="ixLiveViewRoot" class="ix-view-enter">
      <div class="ix-page-header">
        <div>
          <h1 class="ix-page-title">Live Research Execution</h1>
          <p class="ix-page-desc ix-truncate" id="ixLiveTaskSubtitle" style="max-width:780px;">${escapeHtml(session.task)}</p>
        </div>
        <div class="ix-page-actions" id="ixLiveHeaderActions">
          <span class="ix-badge ${badge.cls}" id="ixLiveStatusBadge">
            <i class="fa-solid ${isRunning ? 'fa-spinner fa-spin' : 'fa-circle-info'}"></i>
            ${escapeHtml(badge.label)}
          </span>
          <button type="button" id="ixStopResearchBtn" class="ix-btn ix-btn-danger ${isRunning ? '' : 'ix-hidden'}">
            <i class="fa-solid fa-stop"></i> Stop Research
          </button>
          <button type="button" id="ixNewQueryBtn" class="ix-btn ix-btn-secondary ${isRunning ? 'ix-hidden' : ''}" data-nav="new-research">
            <i class="fa-solid fa-plus"></i> New Query
          </button>
          <button type="button" id="ixOpenActiveReportBtn" class="ix-btn ix-btn-primary ${canOpenReport ? '' : 'ix-hidden'}">
            <i class="fa-regular fa-file-lines"></i> Open Report Viewer
          </button>
        </div>
      </div>

      <div id="ixLiveNoticeSlot"></div>
      <div id="ixLiveErrorSlot"></div>

      <div class="ix-pipeline-stepper" id="ixLivePipelineStepper" aria-label="Execution Pipeline">
        ${STAGES.map((st) => {
          const { cls, iconCls, sub } = buildStageState(st, session);
          return `
            <div class="ix-step-card ${cls}" data-stage-num="${st.num}">
              <div class="ix-step-head">
                <span>${escapeHtml(st.title)}</span>
                <i class="fa-solid ${iconCls}" data-stage-icon></i>
              </div>
              <div class="ix-step-sub" data-stage-sub>${escapeHtml(sub)}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="ix-live-grid">
        <div style="display:flex; flex-direction:column; gap:var(--space-5);">
          <section class="ix-card" id="ixLiveLogsCard">
            <div class="ix-card-header">
              <h2 class="ix-card-title">
                <i class="fa-solid fa-terminal"></i>
                Execution Logs (<span id="ixLiveLogCount">${session.logs.length}</span>)
              </h2>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="ix-help" id="ixLiveWsState">WS: ${escapeHtml(ws.state)}</span>
                <button type="button" id="ixToggleLogsFullscreenBtn" class="ix-icon-btn ix-icon-btn-sm" title="Toggle Fullscreen (Esc to exit)">
                  <i class="fa-solid fa-expand"></i>
                </button>
              </div>
            </div>
            <div class="ix-card-body">
              <div class="ix-log-stream" id="ixLiveLogStream">
                ${
                  session.logs.length === 0
                    ? `<div class="ix-help" data-log-placeholder>Waiting for backend stream events...</div>`
                    : session.logs.map(renderLogLineHtml).join('')
                }
              </div>
            </div>
          </section>

          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-regular fa-file-lines"></i> Live Report Stream</h2>
              <span class="ix-badge" id="ixLiveWordCount">
                ${session.markdown ? `${session.markdown.split(/\s+/).filter(Boolean).length} words` : 'Awaiting synthesis'}
              </span>
            </div>
            <div class="ix-live-preview-pane" id="ixLivePreviewPane">
              <div id="ixLivePreviewInner">
                ${
                  session.html
                    ? `<div class="ix-prose" style="max-width:none;">${session.html}</div>`
                    : `<p class="ix-help">Report sections will stream here automatically once source retrieval and vector filtering complete.</p>`
                }
              </div>
            </div>
          </section>
        </div>

        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-solid fa-robot"></i> Active Execution Context</h2>
            </div>
            <div class="ix-card-body" style="display:flex; flex-direction:column; gap:10px; font-size:var(--text-sm);">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span class="ix-muted">Assigned Agent</span>
                <strong id="ixLiveAgentName">${escapeHtml(session.activeAgentName || session.config?.agent || 'Pending routing')}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span class="ix-muted">Report Type</span>
                <span>${escapeHtml(session.config?.report_type || 'research_report')}</span>
              </div>
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <span class="ix-muted">Source Channel</span>
                <span>${escapeHtml((session.config?.report_source || 'web').toUpperCase())}</span>
              </div>
            </div>
          </section>

          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-solid fa-sitemap"></i> Planned Sub-Queries (<span id="ixLiveSubqueriesCount">${session.subqueries.length}</span>)</h2>
            </div>
            <div class="ix-card-body" id="ixLiveSubqueriesBody"></div>
          </section>

          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-solid fa-globe"></i> Retrieved Sources (<span id="ixLiveSourcesCount">${session.scrapedSources.length}</span>)</h2>
            </div>
            <div class="ix-card-body" id="ixLiveSourcesBody" style="max-height:260px; overflow-y:auto;"></div>
          </section>
        </div>
      </div>
    </div>
  `;

  container._ixLiveState = {
    task: session.task,
    status: session.status,
    wsNotice: null,
    errorMessage: null,
    logCount: session.logs.length,
    mdLen: -1,
    subqueryCount: -1,
    sourceCount: -1,
    stage: -1,
    stageLabel: '',
    agentName: '',
  };

  // Bind permanent listeners once
  container.querySelector('#ixStopResearchBtn')?.addEventListener('click', () => ctx.stopResearch());
  container.querySelector('#ixNewQueryBtn')?.addEventListener('click', () => ctx.navigate('new-research'));
  container.querySelector('#ixOpenActiveReportBtn')?.addEventListener('click', () => {
    ctx.navigate('report-viewer');
  });

  const logsCard = container.querySelector('#ixLiveLogsCard');
  const fsBtn = container.querySelector('#ixToggleLogsFullscreenBtn');
  const setLogsFullscreen = (enable) => {
    if (!logsCard || !fsBtn) return;
    logsCard.classList.toggle('ix-fullscreen-overlay', enable);
    document.body.style.overflow = enable ? 'hidden' : '';
    fsBtn.innerHTML = enable ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
  };
  if (logsCard && fsBtn) {
    fsBtn.addEventListener('click', () => {
      setLogsFullscreen(!logsCard.classList.contains('ix-fullscreen-overlay'));
    });
  }
  const onEsc = (e) => {
    if (e.key === 'Escape' && logsCard?.classList.contains('ix-fullscreen-overlay')) {
      setLogsFullscreen(false);
    }
  };
  document.addEventListener('keydown', onEsc);

  updateLiveResearchDOM(container, ctx);

  return () => {
    document.removeEventListener('keydown', onEsc);
    document.body.style.overflow = '';
  };
}

/**
 * Incrementally update only changed subtrees inside the mounted Live Research DOM.
 * Zero innerHTML wipes on the outer layout -> zero screen twitching or blinking.
 */
export function updateLiveResearchDOM(container, ctx) {
  const session = store.state.liveSession;
  const ws = store.state.wsStats;
  const root = container?.querySelector('#ixLiveViewRoot');

  if (!root || session.status === 'idle') {
    renderLiveResearchView(container, ctx);
    return;
  }

  const prev = container._ixLiveState || {};
  if (prev.task !== session.task) {
    container._ixLiveState = null;
    renderLiveResearchView(container, ctx);
    return;
  }

  const isRunning = isSessionActiveStatus(session.status);

  // 1. Update header badge & action buttons only when status changes
  if (prev.status !== session.status) {
    const badge = BADGE_MAP[session.status] || { cls: '', label: session.status };
    const badgeEl = container.querySelector('#ixLiveStatusBadge');
    if (badgeEl) {
      badgeEl.className = `ix-badge ${badge.cls}`;
      badgeEl.innerHTML = `<i class="fa-solid ${isRunning ? 'fa-spinner fa-spin' : 'fa-circle-info'}"></i> ${escapeHtml(badge.label)}`;
    }
    container.querySelector('#ixStopResearchBtn')?.classList.toggle('ix-hidden', !isRunning);
    container.querySelector('#ixNewQueryBtn')?.classList.toggle('ix-hidden', isRunning);
    prev.status = session.status;
  }

  const canOpenReport = session.status === 'completed' || (session.markdown && session.markdown.length > 50);
  container.querySelector('#ixOpenActiveReportBtn')?.classList.toggle('ix-hidden', !canOpenReport);

  // 2. Notice & Error banners
  if (prev.wsNotice !== session.wsNotice || prev.status !== session.status) {
    const noticeSlot = container.querySelector('#ixLiveNoticeSlot');
    if (noticeSlot) {
      noticeSlot.innerHTML = session.wsNotice
        ? `<div class="ix-card" style="margin-bottom:var(--space-4); border-color:var(--status-warning-border); background:var(--status-warning-soft);">
             <div class="ix-card-body" style="padding:12px 16px; font-size:var(--text-sm); color:var(--text-primary); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
               <span><i class="fa-solid fa-wifi"></i> ${escapeHtml(session.wsNotice)}</span>
               ${!isRunning && session.config ? `<button type="button" id="ixRetryResearchBtn" class="ix-btn ix-btn-secondary ix-btn-sm">Retry Query</button>` : ''}
             </div>
           </div>`
        : '';
      noticeSlot.querySelector('#ixRetryResearchBtn')?.addEventListener('click', () => {
        if (session.config) ctx.startResearch(session.config);
      });
    }
    prev.wsNotice = session.wsNotice;
  }

  const errKey = `${session.status}:${session.errorMessage || ''}`;
  if (prev.errKey !== errKey) {
    const errSlot = container.querySelector('#ixLiveErrorSlot');
    if (errSlot) {
      errSlot.innerHTML =
        session.status === 'error'
          ? `<div style="margin-bottom:var(--space-5);">
               ${renderErrorState({
                 title: 'Research interrupted due to an error',
                 desc: session.errorMessage || 'An unexpected backend or connection error occurred. Partial output (if received) is preserved below.',
                 retryId: 'ixRetryResearchErrBtn',
               })}
             </div>`
          : '';
      errSlot.querySelector('#ixRetryResearchErrBtn')?.addEventListener('click', () => {
        if (session.config) ctx.startResearch(session.config);
      });
    }
    prev.errKey = errKey;
  }

  // 3. Pipeline stepper cards updated in-place
  if (prev.stage !== session.stage || prev.stageLabel !== session.stageLabel || prev.status2 !== session.status) {
    STAGES.forEach((st) => {
      const card = container.querySelector(`#ixLivePipelineStepper [data-stage-num="${st.num}"]`);
      if (!card) return;
      const { cls, iconCls, sub } = buildStageState(st, session);
      const nextCardClass = `ix-step-card ${cls}`.trim();
      if (card.className !== nextCardClass) card.className = nextCardClass;
      const iconEl = card.querySelector('[data-stage-icon]');
      const nextIconClass = `fa-solid ${iconCls}`;
      if (iconEl && iconEl.className !== nextIconClass) iconEl.className = nextIconClass;
      const subEl = card.querySelector('[data-stage-sub]');
      if (subEl && subEl.textContent !== sub) subEl.textContent = sub;
    });
    prev.stage = session.stage;
    prev.stageLabel = session.stageLabel;
    prev.status2 = session.status;
  }

  // 4. Append-only Execution Logs (zero flicker, preserves fullscreen & user scroll)
  const wsEl = container.querySelector('#ixLiveWsState');
  if (wsEl) {
    const nextWs = `WS: ${ws.state}`;
    if (wsEl.textContent !== nextWs) wsEl.textContent = nextWs;
  }

  const logCountEl = container.querySelector('#ixLiveLogCount');
  if (logCountEl && logCountEl.textContent !== String(session.logs.length)) {
    logCountEl.textContent = String(session.logs.length);
  }

  const logStream = container.querySelector('#ixLiveLogStream');
  if (logStream && session.logs.length > (prev.logCount || 0)) {
    const placeholder = logStream.querySelector('[data-log-placeholder]');
    if (placeholder) placeholder.remove();

    const nearBottom = logStream.scrollHeight - logStream.scrollTop - logStream.clientHeight < 64;
    const newLogs = session.logs.slice(prev.logCount || 0);
    if (newLogs.length > 0) {
      logStream.insertAdjacentHTML('beforeend', newLogs.map(renderLogLineHtml).join(''));
      if (nearBottom) {
        logStream.scrollTop = logStream.scrollHeight;
      }
    }
    prev.logCount = session.logs.length;
  }

  // 5. Throttled Markdown Report Stream preview update
  const mdLen = session.markdown ? session.markdown.length : 0;
  if (prev.mdLen !== mdLen) {
    const wordEl = container.querySelector('#ixLiveWordCount');
    const previewPane = container.querySelector('#ixLivePreviewPane');
    const previewInner = container.querySelector('#ixLivePreviewInner');

    if (session.markdown) {
      const renderedHtml = markdownToHtml(session.markdown);
      session.html = renderedHtml;
      if (wordEl) {
        wordEl.textContent = `${session.markdown.split(/\s+/).filter(Boolean).length} words`;
      }
      if (previewInner && previewPane) {
        const nearBottom = previewPane.scrollHeight - previewPane.scrollTop - previewPane.clientHeight < 80;
        let proseEl = previewInner.querySelector('#ixLiveProseContent');
        if (!proseEl) {
          previewInner.innerHTML = '<div class="ix-prose" id="ixLiveProseContent" style="max-width:none;"></div>';
          proseEl = previewInner.querySelector('#ixLiveProseContent');
        }
        proseEl.innerHTML = renderedHtml;
        if (nearBottom) {
          previewPane.scrollTop = previewPane.scrollHeight;
        }
      }
    } else if (prev.mdLen === -1 && previewInner) {
      previewInner.innerHTML = '<p class="ix-help">Report sections will stream here automatically once source retrieval and vector filtering complete.</p>';
    }
    prev.mdLen = mdLen;
  }

  // 6. Active Agent, Sub-Queries, Retrieved Sources
  const agentName = session.activeAgentName || session.config?.agent || 'Pending routing';
  if (prev.agentName !== agentName) {
    const agentEl = container.querySelector('#ixLiveAgentName');
    if (agentEl) agentEl.textContent = agentName;
    prev.agentName = agentName;
  }

  if (prev.subqueryCount !== session.subqueries.length) {
    const sqCount = container.querySelector('#ixLiveSubqueriesCount');
    const sqBody = container.querySelector('#ixLiveSubqueriesBody');
    if (sqCount) sqCount.textContent = String(session.subqueries.length);
    if (sqBody) {
      sqBody.innerHTML =
        session.subqueries.length === 0
          ? `<p class="ix-help">Sub-queries will appear once planner decomposition finishes.</p>`
          : `<ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:var(--text-xs); color:var(--text-primary);">
               ${session.subqueries.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}
             </ul>`;
    }
    prev.subqueryCount = session.subqueries.length;
  }

  if (prev.sourceCount !== session.scrapedSources.length) {
    const srcCount = container.querySelector('#ixLiveSourcesCount');
    const srcBody = container.querySelector('#ixLiveSourcesBody');
    if (srcCount) srcCount.textContent = String(session.scrapedSources.length);
    if (srcBody) {
      srcBody.innerHTML =
        session.scrapedSources.length === 0
          ? `<p class="ix-help">Visited URLs appear here as web retrieval runs.</p>`
          : `<div style="display:flex; flex-direction:column; gap:6px;">
               ${session.scrapedSources
                 .map(
                   (url) => `
                     <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="ix-truncate" style="font-size:var(--text-xs); display:block;">
                       <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px; margin-right:4px;"></i>
                       ${escapeHtml(url)}
                     </a>`
                 )
                 .join('')}
             </div>`;
    }
    prev.sourceCount = session.scrapedSources.length;
  }
}
