/**
 * InquireX Dashboard View
 * Displays real backend/local session statistics, recent projects & reports,
 * favorite topics, activity timeline, and helpful empty states.
 */

import { store } from '../store.js';
import { escapeHtml, formatRelativeTime, renderEmptyState, openConfirmDialog, showToast } from '../ui.js';
import { extractReportMetrics } from '../postprocess.js';

export function renderDashboardView(container, ctx) {
  const { user, reports, files, favorites, liveSession } = store.state;
  const userName = user?.name || user?.email?.split('@')[0] || 'Researcher';

  // Derive genuine metrics strictly from stored reports & files (zero fabricated numbers)
  const totalSessions = reports.length;
  const completedReports = reports.filter(
    (r) => (r.reportHtml && r.reportHtml.trim().length > 20) || (r.reportMarkdown && r.reportMarkdown.trim().length > 20)
  );
  let totalCitations = 0;
  let totalDurationSec = 0;
  let timedCount = 0;

  completedReports.forEach((r) => {
    const m = extractReportMetrics(r.reportHtml, r.reportMarkdown, r.metrics);
    totalCitations += m.citationsCount || 0;
    if (r.metrics && r.metrics.elapsedSec > 0) {
      totalDurationSec += r.metrics.elapsedSec;
      timedCount += 1;
    }
  });

  const avgDurationText = timedCount > 0 ? `${Math.round(totalDurationSec / timedCount)}s` : '—';
  const favoriteReports = reports.filter((r) => favorites.includes(r.id));

  container.innerHTML = `
    <div class="ix-view-enter">
      <div class="ix-page-header">
        <div>
          <h1 class="ix-page-title">Welcome back, ${escapeHtml(userName)}</h1>
          <p class="ix-page-desc">
            Launch autonomous deep research investigations, review verified reports, and inspect retrieved knowledge.
          </p>
        </div>
        <div class="ix-page-actions">
          ${
            liveSession.status === 'running' || liveSession.status === 'connecting'
              ? `<button type="button" class="ix-btn ix-btn-secondary" data-nav="live-research">
                   <span class="ix-ws-dot connected"></span>
                   Active Run in Progress
                 </button>`
              : ''
          }
          <button type="button" class="ix-btn ix-btn-secondary" data-nav="documents">
            <i class="fa-regular fa-folder-open"></i>
            Documents (${files.length})
          </button>
          <button type="button" class="ix-btn ix-btn-primary" data-nav="new-research">
            <i class="fa-solid fa-plus"></i>
            New Research
          </button>
        </div>
      </div>

      <div class="ix-stats-grid">
        <div class="ix-stat-card">
          <div class="ix-stat-label">
            <span>Total Research Sessions</span>
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div class="ix-stat-value">${totalSessions}</div>
          <div class="ix-stat-sub">Saved across workspace</div>
        </div>

        <div class="ix-stat-card">
          <div class="ix-stat-label">
            <span>Completed Reports</span>
            <i class="fa-regular fa-file-lines"></i>
          </div>
          <div class="ix-stat-value">${completedReports.length}</div>
          <div class="ix-stat-sub">Avg completion: ${avgDurationText}</div>
        </div>

        <div class="ix-stat-card">
          <div class="ix-stat-label">
            <span>Verified Citations Logged</span>
            <i class="fa-solid fa-link"></i>
          </div>
          <div class="ix-stat-value">${totalCitations}</div>
          <div class="ix-stat-sub">Extracted from saved reports</div>
        </div>

        <div class="ix-stat-card">
          <div class="ix-stat-label">
            <span>Indexed Private Docs</span>
            <i class="fa-solid fa-database"></i>
          </div>
          <div class="ix-stat-value">${files.length}</div>
          <div class="ix-stat-sub">Available in local RAG store</div>
        </div>
      </div>

      <div class="ix-dashboard-grid">
        <div class="ix-dashboard-stack">
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title">
                <i class="fa-regular fa-folder-open" style="color:var(--accent-primary);"></i>
                Recent Research Projects &amp; Reports
              </h2>
              ${
                reports.length > 0
                  ? `<button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-nav="history">
                       View all <i class="fa-solid fa-arrow-right"></i>
                     </button>`
                  : ''
              }
            </div>
            <div>
              ${
                reports.length === 0
                  ? `<div style="padding:20px;">
                       ${renderEmptyState({
                         icon: 'fa-compass',
                         title: 'No research sessions yet',
                         desc: 'Start your first autonomous deep research query to gather multi-source evidence and synthesize a cited report.',
                         actionHtml: `<button type="button" class="ix-btn ix-btn-primary" data-nav="new-research"><i class="fa-solid fa-plus"></i> Start First Research</button>`,
                       })}
                     </div>`
                  : reports
                      .slice(0, 6)
                      .map((r) => {
                        const isFav = favorites.includes(r.id);
                        const metrics = extractReportMetrics(r.reportHtml, r.reportMarkdown, r.metrics);
                        return `
                          <div class="ix-report-list-row" data-open-report="${escapeHtml(r.id)}">
                            <div class="ix-report-row-main">
                              <div class="ix-report-row-title">${escapeHtml(r.prompt)}</div>
                              <div class="ix-report-row-meta">
                                <span><i class="fa-regular fa-clock"></i> ${formatRelativeTime(r.timestamp)}</span>
                                ${metrics.wordCount ? `<span>${metrics.wordCount.toLocaleString()} words</span>` : ''}
                                ${metrics.citationsCount ? `<span>${metrics.citationsCount} sources</span>` : ''}
                                ${r.metrics?.agentName ? `<span class="ix-badge">${escapeHtml(r.metrics.agentName)}</span>` : ''}
                              </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                              <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-toggle-fav="${escapeHtml(r.id)}" title="${isFav ? 'Remove from favorites' : 'Pin to favorites'}">
                                <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star" style="color:${isFav ? 'var(--status-warning)' : 'inherit'};"></i>
                              </button>
                              <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-delete-report="${escapeHtml(r.id)}" title="Delete report">
                                <i class="fa-regular fa-trash-can"></i>
                              </button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
              }
            </div>
          </section>

          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title">
                <i class="fa-regular fa-star" style="color:var(--status-warning);"></i>
                Favorite Research Topics
              </h2>
            </div>
            <div class="ix-card-body">
              ${
                favoriteReports.length === 0
                  ? `<p class="ix-help">Star any completed research project above to pin it here for quick access and re-runs.</p>`
                  : `<div class="ix-fav-chips">
                      ${favoriteReports
                        .map(
                          (r) => `
                            <button type="button" class="ix-topic-pill" data-open-report="${escapeHtml(r.id)}">
                              <i class="fa-solid fa-star" style="color:var(--status-warning); font-size:11px;"></i>
                              <span class="ix-truncate" style="max-width:260px;">${escapeHtml(r.prompt)}</span>
                            </button>
                          `
                        )
                        .join('')}
                    </div>`
              }
            </div>
          </section>
        </div>

        <div class="ix-dashboard-stack">
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title">
                <i class="fa-solid fa-bolt" style="color:var(--accent-primary);"></i>
                Quick Actions
              </h2>
            </div>
            <div class="ix-card-body" style="display:flex; flex-direction:column; gap:8px;">
              <button type="button" class="ix-btn ix-btn-secondary" style="justify-content:flex-start;" data-quick-preset="research_report">
                <i class="fa-solid fa-magnifying-glass"></i> Run Fast Executive Summary
              </button>
              <button type="button" class="ix-btn ix-btn-secondary" style="justify-content:flex-start;" data-quick-preset="detailed_report">
                <i class="fa-solid fa-book-open"></i> Run Detailed Multi-Section Report
              </button>
              <button type="button" class="ix-btn ix-btn-secondary" style="justify-content:flex-start;" data-quick-preset="deep">
                <i class="fa-solid fa-diagram-project"></i> Launch Iterative Deep Research
              </button>
              <button type="button" class="ix-btn ix-btn-secondary" style="justify-content:flex-start;" data-nav="documents">
                <i class="fa-solid fa-cloud-arrow-up"></i> Manage Private RAG Documents
              </button>
            </div>
          </section>

          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title">
                <i class="fa-solid fa-clock-rotate-left"></i>
                Research Activity Timeline
              </h2>
            </div>
            <div class="ix-card-body">
              ${
                reports.length === 0
                  ? `<p class="ix-help">No recorded research events yet. Completed sessions appear here in chronological order.</p>`
                  : `<div class="ix-timeline">
                      ${reports
                        .slice(0, 6)
                        .map(
                          (r) => `
                            <div class="ix-timeline-item">
                              <div style="font-size:var(--text-sm); font-weight:500; color:var(--text-primary);" class="ix-truncate">
                                ${escapeHtml(r.prompt)}
                              </div>
                              <div style="font-size:var(--text-xs); color:var(--text-secondary);">
                                ${formatRelativeTime(r.timestamp)}${r.metrics?.elapsedSec ? ` &bull; Completed in ${r.metrics.elapsedSec}s` : ''}
                              </div>
                            </div>
                          `
                        )
                        .join('')}
                    </div>`
              }
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.navigate(btn.getAttribute('data-nav')));
  });

  container.querySelectorAll('[data-quick-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.updateDraftConfig({ report_type: btn.getAttribute('data-quick-preset') });
      ctx.navigate('new-research');
    });
  });

  container.querySelectorAll('[data-open-report]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('button[data-toggle-fav]') || e.target.closest('button[data-delete-report]')) return;
      store.setActiveReportId(el.getAttribute('data-open-report'));
      ctx.navigate('report-viewer');
    });
  });

  container.querySelectorAll('[data-toggle-fav]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-toggle-fav');
      const nowFav = store.toggleFavorite(id);
      showToast(nowFav ? 'Pinned to favorite topics.' : 'Removed from favorites.', 'info');
      renderDashboardView(container, ctx);
    });
  });

  container.querySelectorAll('[data-delete-report]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-report');
      openConfirmDialog({
        title: 'Delete Research Report',
        message: 'Remove this report from workspace history? This cannot be undone.',
        confirmText: 'Delete',
        danger: true,
        onConfirm: async () => {
          await store.deleteReport(id);
          showToast('Report removed.', 'success');
          renderDashboardView(container, ctx);
        },
      });
    });
  });
}
