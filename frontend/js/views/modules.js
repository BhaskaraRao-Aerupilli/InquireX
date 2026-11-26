/**
 * InquireX Workspace Modules
 * Exports:
 *  - renderMyResearchView
 *  - renderHistoryView
 *  - renderKnowledgeGraphView
 *  - renderFactVerificationView
 *  - renderDocumentsView
 *  - renderPresentationsView
 *  - renderMonitorView
 *  - renderSettingsView
 */

import { store } from '../store.js';
import {
  escapeHtml,
  formatRelativeTime,
  markdownToHtml,
  sanitizeHtml,
  renderEmptyState,
  renderErrorState,
  openConfirmDialog,
  showToast,
} from '../ui.js';
import {
  extractReportMetrics,
  extractCitations,
  extractKnowledgeGraphData,
  renderMermaidFlowGraph,
  buildTreeHtml,
} from '../postprocess.js';
import { exportReport, buildSlidesFromReport, openSlideDeckModal } from '../exports.js';
import {
  fetchUploadedFiles,
  uploadDocumentFile,
  deleteUploadedFile,
  fetchAgentDiscovery,
} from '../api.js';
import { getThemeMode, applyThemeMode } from '../theme.js';

function ensureHtml(report) {
  if (!report) return '';
  if (report.reportHtml && report.reportHtml.trim().length > 0) {
    return sanitizeHtml(report.reportHtml);
  }
  return markdownToHtml(report.reportMarkdown || '');
}

function getAllSourcesForReport(report) {
  const html = ensureHtml(report);
  const extracted = extractCitations(html, report?.reportMarkdown || '');
  const byUrl = new Map();
  extracted.forEach((c) => byUrl.set(c.url, { ...c, origin: 'Citation in Report' }));
  (report?.sources || []).forEach((u) => {
    const clean = String(u || '').trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(clean) && !byUrl.has(clean)) {
      let domain = '';
      try {
        domain = new URL(clean).hostname.replace(/^www\./, '');
      } catch {}
      byUrl.set(clean, { url: clean, title: domain || clean, domain, origin: 'Scraped Source' });
    }
  });
  return Array.from(byUrl.values());
}

/* ============================================================================
   1. MY RESEARCH (Project Grid, Tabs, Favorites, Re-Run, Delete)
   ============================================================================ */
export function renderMyResearchView(container, ctx) {
  let currentTab = 'all';
  let searchQuery = '';

  const draw = () => {
    const reports = store.state.reports || [];
    const favorites = store.state.favorites || [];
    const live = store.state.liveSession;

    let filtered = reports.filter((r) => {
      if (currentTab === 'favorites') return favorites.includes(r.id);
      if (currentTab === 'completed') {
        return (r.reportHtml && r.reportHtml.length > 20) || (r.reportMarkdown && r.reportMarkdown.length > 20);
      }
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.prompt || '').toLowerCase().includes(q) ||
          (r.config?.agent || '').toLowerCase().includes(q) ||
          (r.config?.report_type || '').toLowerCase().includes(q)
      );
    }

    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">My Research Projects</h1>
            <p class="ix-page-desc">Organize ongoing inquiries, bookmarked topics, and saved reports across your workspace.</p>
          </div>
          <div class="ix-page-actions">
            <button type="button" class="ix-btn ix-btn-primary" data-nav="new-research">
              <i class="fa-solid fa-plus"></i> New Research
            </button>
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); margin-bottom:var(--space-5); flex-wrap:wrap;">
          <div class="ix-tabs" role="tablist">
            <button type="button" class="ix-tab ${currentTab === 'all' ? 'active' : ''}" data-tab="all">All (${reports.length})</button>
            <button type="button" class="ix-tab ${currentTab === 'favorites' ? 'active' : ''}" data-tab="favorites">Favorites (${favorites.length})</button>
            <button type="button" class="ix-tab ${currentTab === 'completed' ? 'active' : ''}" data-tab="completed">Completed</button>
          </div>

          <div class="ix-search-wrap" style="width:280px; max-width:100%;">
            <i class="fa-solid fa-magnifying-glass ix-search-icon"></i>
            <input type="search" id="ixProjectsSearch" class="ix-input" style="height:34px;" placeholder="Filter projects..." value="${escapeHtml(searchQuery)}" />
          </div>
        </div>

        ${
          live.status === 'running' || live.status === 'connecting'
            ? `<div class="ix-card" style="margin-bottom:var(--space-5); border-color:var(--accent-primary);">
                 <div class="ix-card-body" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-4); flex-wrap:wrap;">
                   <div style="display:flex; align-items:center; gap:12px;">
                     <span class="ix-badge ix-badge-accent"><i class="fa-solid fa-spinner fa-spin"></i> Running Now</span>
                     <strong style="font-size:var(--text-sm);">${escapeHtml(live.task)}</strong>
                   </div>
                   <button type="button" class="ix-btn ix-btn-primary ix-btn-sm" data-nav="live-research">Open Live Stream</button>
                 </div>
               </div>`
            : ''
        }

        ${
          filtered.length === 0
            ? renderEmptyState({
                icon: 'fa-folder-open',
                title: reports.length === 0 ? 'No research projects yet' : 'No matching research projects',
                desc:
                  reports.length === 0
                    ? 'Your saved research investigations will appear here automatically once completed.'
                    : 'Try clearing the search query or switching filter tabs.',
                actionHtml: `<button type="button" class="ix-btn ix-btn-primary" data-nav="new-research"><i class="fa-solid fa-plus"></i> Start Research</button>`,
              })
            : `<div class="ix-team-grid">
                ${filtered
                  .map((r) => {
                    const isFav = favorites.includes(r.id);
                    const html = ensureHtml(r);
                    const m = extractReportMetrics(html, r.reportMarkdown, r.metrics);
                    return `
                      <div class="ix-agent-card">
                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
                          <span class="ix-badge ix-badge-accent">${escapeHtml(r.config?.report_type || 'research_report')}</span>
                          <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-fav-id="${escapeHtml(r.id)}" title="Toggle bookmark">
                            <i class="fa-${isFav ? 'solid' : 'regular'} fa-star" style="${isFav ? 'color:var(--status-warning);' : ''}"></i>
                          </button>
                        </div>
                        <div style="font-weight:600; font-size:var(--text-md); color:var(--text-primary); line-height:1.4; flex:1;">
                          ${escapeHtml(r.prompt || 'Untitled Inquiry')}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; font-size:var(--text-xs); color:var(--text-secondary); flex-wrap:wrap;">
                          <span>${m.wordCount.toLocaleString()} words</span>
                          <span>&bull;</span>
                          <span>${m.citationsCount} citations</span>
                          <span>&bull;</span>
                          <span>${escapeHtml(formatRelativeTime(r.timestamp))}</span>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:10px; border-top:1px solid var(--border-subtle);">
                          <div style="display:flex; gap:6px;">
                            <button type="button" class="ix-btn ix-btn-primary ix-btn-sm" data-open-id="${escapeHtml(r.id)}">Open</button>
                            <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-rerun-id="${escapeHtml(r.id)}">Re-run</button>
                          </div>
                          <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-delete-id="${escapeHtml(r.id)}" title="Delete project">
                            <i class="fa-regular fa-trash-can"></i>
                          </button>
                        </div>
                      </div>`;
                  })
                  .join('')}
              </div>`
        }
      </div>
    `;

    container.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate(b.getAttribute('data-nav')))
    );
    container.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        currentTab = b.getAttribute('data-tab');
        draw();
      })
    );
    const searchEl = container.querySelector('#ixProjectsSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        draw();
        const nextInput = container.querySelector('#ixProjectsSearch');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      });
    }
    container.querySelectorAll('[data-fav-id]').forEach((b) =>
      b.addEventListener('click', () => {
        store.toggleFavorite(b.getAttribute('data-fav-id'));
        draw();
      })
    );
    container.querySelectorAll('[data-open-id]').forEach((b) =>
      b.addEventListener('click', () => {
        store.setActiveReportId(b.getAttribute('data-open-id'));
        ctx.navigate('report-viewer');
      })
    );
    container.querySelectorAll('[data-rerun-id]').forEach((b) =>
      b.addEventListener('click', () => {
        const rep = store.getReportById(b.getAttribute('data-rerun-id'));
        if (rep) {
          store.updateDraftConfig({
            task: rep.prompt || '',
            report_type: rep.config?.report_type || 'research_report',
            tone: rep.config?.tone || 'Objective',
            agent: rep.config?.agent || 'Auto Agent',
          });
          ctx.navigate('new-research');
        }
      })
    );
    container.querySelectorAll('[data-delete-id]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-delete-id');
        openConfirmDialog({
          title: 'Delete Research Project',
          message: 'Remove this report from workspace history? This action cannot be undone.',
          confirmText: 'Delete',
          danger: true,
          onConfirm: async () => {
            await store.deleteReport(id);
            showToast('Research report removed.', 'info');
            draw();
          },
        });
      })
    );
  };

  draw();
}

/* ============================================================================
   2. RESEARCH HISTORY (Searchable Audit Table)
   ============================================================================ */
export function renderHistoryView(container, ctx) {
  let query = '';
  let typeFilter = 'all';

  const draw = () => {
    const reports = store.state.reports || [];
    const filtered = reports.filter((r) => {
      if (typeFilter !== 'all' && (r.config?.report_type || 'research_report') !== typeFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        return (
          (r.prompt || '').toLowerCase().includes(q) ||
          (r.config?.agent || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Research History</h1>
            <p class="ix-page-desc">Searchable audit log of executed research queries, source modes, and generated outputs.</p>
          </div>
          <div class="ix-page-actions">
            ${
              reports.length > 0
                ? `<button type="button" id="ixClearHistoryBtn" class="ix-btn ix-btn-danger ix-btn-sm">
                     <i class="fa-regular fa-trash-can"></i> Clear Local Cache
                   </button>`
                : ''
            }
            <button type="button" class="ix-btn ix-btn-primary" data-nav="new-research">
              <i class="fa-solid fa-plus"></i> New Research
            </button>
          </div>
        </div>

        <div style="display:flex; gap:12px; margin-bottom:var(--space-4); flex-wrap:wrap; align-items:center;">
          <div class="ix-search-wrap" style="flex:1; min-width:220px; max-width:380px;">
            <i class="fa-solid fa-magnifying-glass ix-search-icon"></i>
            <input type="search" id="ixHistorySearch" class="ix-input" placeholder="Search report titles or personas..." value="${escapeHtml(query)}" />
          </div>
          <select id="ixHistoryTypeFilter" class="ix-select" style="width:auto; min-width:180px;">
            <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>All Report Types</option>
            <option value="research_report" ${typeFilter === 'research_report' ? 'selected' : ''}>Summary Report</option>
            <option value="detailed_report" ${typeFilter === 'detailed_report' ? 'selected' : ''}>Detailed Report</option>
            <option value="deep" ${typeFilter === 'deep' ? 'selected' : ''}>Deep Research</option>
          </select>
        </div>

        ${
          filtered.length === 0
            ? renderEmptyState({
                icon: 'fa-clock-rotate-left',
                title: reports.length === 0 ? 'History is empty' : 'No matching history records',
                desc: 'Completed investigations saved locally or on the server backend will be indexed here.',
              })
            : `<div class="ix-table-wrap">
                 <table class="ix-table">
                   <thead>
                     <tr>
                       <th>Research Inquiry</th>
                       <th>Depth</th>
                       <th>Persona</th>
                       <th>Metrics</th>
                       <th>Timestamp</th>
                       <th style="text-align:right;">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${filtered
                       .map((r) => {
                         const html = ensureHtml(r);
                         const m = extractReportMetrics(html, r.reportMarkdown, r.metrics);
                         return `
                           <tr>
                             <td style="max-width:340px;">
                               <button type="button" class="ix-btn ix-btn-ghost" data-open-id="${escapeHtml(r.id)}" style="padding:0; height:auto; text-align:left; font-weight:600; white-space:normal;">
                                 ${escapeHtml(r.prompt || 'Untitled Inquiry')}
                               </button>
                             </td>
                             <td><span class="ix-badge">${escapeHtml(r.config?.report_type || 'research_report')}</span></td>
                             <td style="font-size:var(--text-xs); color:var(--text-secondary);">${escapeHtml(r.metrics?.agentName || r.config?.agent || 'Auto Agent')}</td>
                             <td style="font-size:var(--text-xs);">${m.wordCount.toLocaleString()}w &bull; ${m.citationsCount} refs</td>
                             <td style="font-size:var(--text-xs); color:var(--text-secondary); white-space:nowrap;">${escapeHtml(formatRelativeTime(r.timestamp))}</td>
                             <td style="text-align:right; white-space:nowrap;">
                               <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-open-id="${escapeHtml(r.id)}">View</button>
                               <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-export-md="${escapeHtml(r.id)}" title="Download Markdown">
                                 <i class="fa-brands fa-markdown"></i>
                               </button>
                               <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-delete-id="${escapeHtml(r.id)}" title="Delete">
                                 <i class="fa-regular fa-trash-can"></i>
                               </button>
                             </td>
                           </tr>`;
                       })
                       .join('')}
                   </tbody>
                 </table>
               </div>`
        }
      </div>
    `;

    container.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate(b.getAttribute('data-nav')))
    );
    const searchEl = container.querySelector('#ixHistorySearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        query = e.target.value;
        draw();
        const nextEl = container.querySelector('#ixHistorySearch');
        if (nextEl) {
          nextEl.focus();
          nextEl.setSelectionRange(query.length, query.length);
        }
      });
    }
    container.querySelector('#ixHistoryTypeFilter')?.addEventListener('change', (e) => {
      typeFilter = e.target.value;
      draw();
    });
    container.querySelectorAll('[data-open-id]').forEach((b) =>
      b.addEventListener('click', () => {
        store.setActiveReportId(b.getAttribute('data-open-id'));
        ctx.navigate('report-viewer');
      })
    );
    container.querySelectorAll('[data-export-md]').forEach((b) =>
      b.addEventListener('click', () => {
        const rep = store.getReportById(b.getAttribute('data-export-md'));
        if (rep) exportReport({ ...rep, reportHtml: ensureHtml(rep) }, 'md');
      })
    );
    container.querySelectorAll('[data-delete-id]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-delete-id');
        openConfirmDialog({
          title: 'Delete History Item',
          message: 'Delete this report permanently from history?',
          confirmText: 'Delete',
          danger: true,
          onConfirm: async () => {
            await store.deleteReport(id);
            draw();
          },
        });
      })
    );
    container.querySelector('#ixClearHistoryBtn')?.addEventListener('click', () => {
      openConfirmDialog({
        title: 'Clear Local Research Cache',
        message: 'Clear cached local reports from this browser? Server-persisted records remain intact on next reload.',
        confirmText: 'Clear Cache',
        danger: true,
        onConfirm: async () => {
          await store.clearAllLocalHistory();
          showToast('Local history cache cleared.', 'info');
          draw();
        },
      });
    });
  };

  draw();
}

/* ============================================================================
   3. KNOWLEDGE GRAPH (Mermaid Flowchart + Hierarchy Tree + Live Theme Sync)
   ============================================================================ */
export function renderKnowledgeGraphView(container, ctx) {
  const reports = store.state.reports || [];
  let selectedReport = store.getActiveReport() || reports[0] || null;
  let viewMode = 'mermaid';
  let zoom = 1;

  const drawGraph = async () => {
    if (!selectedReport) {
      container.innerHTML = `
        <div class="ix-view-enter">
          <div class="ix-page-header">
            <div>
              <h1 class="ix-page-title">Knowledge Graph</h1>
              <p class="ix-page-desc">Explore structured concept hierarchies and thematic pillars extracted from completed reports.</p>
            </div>
          </div>
          ${renderEmptyState({
            icon: 'fa-diagram-project',
            title: 'No report available to map',
            desc: 'Run or select a completed research report to generate its theme-aware concept graph.',
            actionHtml: `<button type="button" class="ix-btn ix-btn-primary" data-nav="new-research"><i class="fa-solid fa-plus"></i> New Research</button>`,
          })}
        </div>
      `;
      container.querySelector('[data-nav]')?.addEventListener('click', () => ctx.navigate('new-research'));
      return;
    }

    const html = ensureHtml(selectedReport);
    const graphData = extractKnowledgeGraphData(selectedReport.prompt, html);

    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Knowledge Graph</h1>
            <p class="ix-page-desc">Concept topology extracted from headings and structured takeaways in your research report.</p>
          </div>
          <div class="ix-page-actions">
            <select id="ixGraphReportSelect" class="ix-select" style="width:auto; max-width:280px;" aria-label="Select report for knowledge graph">
              ${reports
                .slice(0, 20)
                .map(
                  (r) =>
                    `<option value="${escapeHtml(r.id)}" ${r.id === selectedReport.id ? 'selected' : ''}>${escapeHtml(
                      (r.prompt || 'Untitled').slice(0, 50)
                    )}</option>`
                )
                .join('')}
            </select>
            <button type="button" id="ixOpenGraphReportBtn" class="ix-btn ix-btn-secondary">Open Reader</button>
          </div>
        </div>

        <div class="ix-card">
          <div class="ix-card-header" style="flex-wrap:wrap;">
            <div class="ix-tabs">
              <button type="button" class="ix-tab ${viewMode === 'mermaid' ? 'active' : ''}" data-gmode="mermaid">
                <i class="fa-solid fa-diagram-project"></i> Flowchart (Mermaid)
              </button>
              <button type="button" class="ix-tab ${viewMode === 'tree' ? 'active' : ''}" data-gmode="tree">
                <i class="fa-solid fa-sitemap"></i> Structured Hierarchy
              </button>
            </div>

            <div style="display:flex; align-items:center; gap:6px;">
              ${
                viewMode === 'mermaid'
                  ? `<button type="button" class="ix-icon-btn ix-icon-btn-sm" id="ixZoomOutBtn" title="Zoom Out"><i class="fa-solid fa-minus"></i></button>
                     <span class="ix-mono" id="ixZoomLabel" style="font-size:var(--text-xs); min-width:44px; text-align:center;">${Math.round(zoom * 100)}%</span>
                     <button type="button" class="ix-icon-btn ix-icon-btn-sm" id="ixZoomInBtn" title="Zoom In"><i class="fa-solid fa-plus"></i></button>
                     <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" id="ixDownloadSvgBtn"><i class="fa-solid fa-download"></i> SVG</button>`
                  : ''
              }
            </div>
          </div>

          <div class="ix-card-body">
            ${
              graphData.pillars.length === 0
                ? renderEmptyState({
                    icon: 'fa-circle-nodes',
                    title: 'No structured H2 sections found in this report',
                    desc: 'Knowledge graphs require reports with section headings or bulleted takeaways.',
                  })
                : `<div class="ix-graph-stage">
                     <div id="ixGraphCanvas" style="transform:scale(${viewMode === 'mermaid' ? zoom : 1}); transform-origin:top left;"></div>
                   </div>`
            }
          </div>
        </div>
      </div>
    `;

    const canvasEl = container.querySelector('#ixGraphCanvas');
    if (canvasEl && graphData.pillars.length > 0) {
      if (viewMode === 'mermaid') {
        canvasEl.innerHTML = '<div class="ix-skeleton" style="height:260px;"></div>';
        await renderMermaidFlowGraph(canvasEl, graphData);
      } else {
        canvasEl.innerHTML = buildTreeHtml(graphData);
      }
    }

    container.querySelector('#ixGraphReportSelect')?.addEventListener('change', (e) => {
      selectedReport = store.getReportById(e.target.value);
      store.setActiveReportId(e.target.value);
      zoom = 1;
      drawGraph();
    });
    container.querySelector('#ixOpenGraphReportBtn')?.addEventListener('click', () => ctx.navigate('report-viewer'));
    container.querySelectorAll('[data-gmode]').forEach((b) =>
      b.addEventListener('click', () => {
        viewMode = b.getAttribute('data-gmode');
        drawGraph();
      })
    );
    container.querySelector('#ixZoomInBtn')?.addEventListener('click', () => {
      zoom = Math.min(1.75, +(zoom + 0.15).toFixed(2));
      const c = container.querySelector('#ixGraphCanvas');
      const l = container.querySelector('#ixZoomLabel');
      if (c) c.style.transform = `scale(${zoom})`;
      if (l) l.textContent = `${Math.round(zoom * 100)}%`;
    });
    container.querySelector('#ixZoomOutBtn')?.addEventListener('click', () => {
      zoom = Math.max(0.6, +(zoom - 0.15).toFixed(2));
      const c = container.querySelector('#ixGraphCanvas');
      const l = container.querySelector('#ixZoomLabel');
      if (c) c.style.transform = `scale(${zoom})`;
      if (l) l.textContent = `${Math.round(zoom * 100)}%`;
    });
    container.querySelector('#ixDownloadSvgBtn')?.addEventListener('click', () => {
      const svgEl = container.querySelector('#ixGraphCanvas svg');
      if (!svgEl) {
        showToast('No rendered SVG diagram to export.', 'warning');
        return;
      }
      const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inquirex_knowledge_graph.svg';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 400);
    });
  };

  const onThemeChange = () => {
    if (viewMode === 'mermaid') drawGraph();
  };
  window.addEventListener('inquirex:themechange', onThemeChange);
  drawGraph();

  return () => {
    window.removeEventListener('inquirex:themechange', onThemeChange);
  };
}

/* ============================================================================
   4. FACT VERIFICATION (Citation & Grounding URL Ledger)
   ============================================================================ */
export function renderFactVerificationView(container, ctx) {
  const reports = store.state.reports || [];
  let selectedReport = store.getActiveReport() || reports[0] || null;
  let search = '';

  const draw = () => {
    if (!selectedReport) {
      container.innerHTML = `
        <div class="ix-view-enter">
          <div class="ix-page-header">
            <div>
              <h1 class="ix-page-title">Fact Verification Ledger</h1>
              <p class="ix-page-desc">Audit citations, source domains, and captured retrieval URLs for grounded research reports.</p>
            </div>
          </div>
          ${renderEmptyState({
            icon: 'fa-shield-check',
            title: 'No report loaded to audit',
            desc: 'Select or complete a research run to inspect all cited references and scraped source domains.',
            actionHtml: `<button type="button" class="ix-btn ix-btn-primary" data-nav="new-research"><i class="fa-solid fa-plus"></i> New Research</button>`,
          })}
        </div>
      `;
      container.querySelector('[data-nav]')?.addEventListener('click', () => ctx.navigate('new-research'));
      return;
    }

    const sources = getAllSourcesForReport(selectedReport);
    const uniqueDomains = new Set(sources.map((s) => s.domain).filter(Boolean));
    const httpsCount = sources.filter((s) => s.url.startsWith('https://')).length;

    const filtered = search.trim()
      ? sources.filter(
          (s) =>
            s.url.toLowerCase().includes(search.trim().toLowerCase()) ||
            (s.title || '').toLowerCase().includes(search.trim().toLowerCase()) ||
            (s.domain || '').toLowerCase().includes(search.trim().toLowerCase())
        )
      : sources;

    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Fact Verification &amp; Citation Audit</h1>
            <p class="ix-page-desc">Inspect unique domains, protocol hygiene, and origin URLs backing report assertions.</p>
          </div>
          <div class="ix-page-actions">
            <select id="ixFactReportSelect" class="ix-select" style="width:auto; max-width:280px;">
              ${reports
                .slice(0, 20)
                .map(
                  (r) =>
                    `<option value="${escapeHtml(r.id)}" ${r.id === selectedReport.id ? 'selected' : ''}>${escapeHtml(
                      (r.prompt || 'Untitled').slice(0, 50)
                    )}</option>`
                )
                .join('')}
            </select>
            <button type="button" id="ixOpenFactReportBtn" class="ix-btn ix-btn-secondary">Open Reader</button>
          </div>
        </div>

        <div class="ix-stats-grid-3">
          <div class="ix-stat-card">
            <div class="ix-stat-label"><span>Extracted References</span><i class="fa-solid fa-link"></i></div>
            <div class="ix-stat-value">${sources.length}</div>
            <div class="ix-stat-sub">Unique URLs cited or scraped</div>
          </div>
          <div class="ix-stat-card">
            <div class="ix-stat-label"><span>Distinct Source Domains</span><i class="fa-solid fa-globe"></i></div>
            <div class="ix-stat-value">${uniqueDomains.size}</div>
            <div class="ix-stat-sub">Cross-origin breadth</div>
          </div>
          <div class="ix-stat-card">
            <div class="ix-stat-label"><span>HTTPS Transport</span><i class="fa-solid fa-lock"></i></div>
            <div class="ix-stat-value">${sources.length ? `${httpsCount}/${sources.length}` : '0'}</div>
            <div class="ix-stat-sub">Encrypted origin endpoints</div>
          </div>
        </div>

        <div class="ix-search-wrap" style="max-width:420px; margin-bottom:var(--space-4);">
          <i class="fa-solid fa-magnifying-glass ix-search-icon"></i>
          <input type="search" id="ixFactSearchInput" class="ix-input" placeholder="Filter sources by URL, title, or domain..." value="${escapeHtml(search)}" />
        </div>

        ${
          filtered.length === 0
            ? renderEmptyState({
                icon: 'fa-link-slash',
                title: 'No matching source references found',
                desc: 'This report may have synthesized local documents or contained no external HTTP links.',
              })
            : `<div class="ix-table-wrap">
                 <table class="ix-table">
                   <thead>
                     <tr>
                       <th>#</th>
                       <th>Source Title / Domain</th>
                       <th>Provenance</th>
                       <th>Protocol</th>
                       <th style="text-align:right;">Verify Origin</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${filtered
                       .map(
                         (s, idx) => `
                         <tr>
                           <td class="ix-mono" style="font-size:var(--text-xs); color:var(--text-secondary);">${idx + 1}</td>
                           <td style="max-width:420px;">
                             <div style="font-weight:600; font-size:var(--text-sm); color:var(--text-primary);">${escapeHtml(s.title || s.domain || 'External Link')}</div>
                             <div class="ix-truncate ix-mono" style="font-size:11px; color:var(--text-secondary);">${escapeHtml(s.url)}</div>
                           </td>
                           <td><span class="ix-badge">${escapeHtml(s.origin)}</span></td>
                           <td>
                             <span class="ix-badge ${s.url.startsWith('https://') ? 'ix-badge-success' : 'ix-badge-warning'}">
                               ${s.url.startsWith('https://') ? 'HTTPS' : 'HTTP'}
                             </span>
                           </td>
                           <td style="text-align:right; white-space:nowrap;">
                             <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="ix-btn ix-btn-secondary ix-btn-sm">
                               Inspect <i class="fa-solid fa-arrow-up-right-from-square"></i>
                             </a>
                           </td>
                         </tr>`
                       )
                       .join('')}
                   </tbody>
                 </table>
               </div>`
        }
      </div>
    `;

    container.querySelector('#ixFactReportSelect')?.addEventListener('change', (e) => {
      selectedReport = store.getReportById(e.target.value);
      store.setActiveReportId(e.target.value);
      draw();
    });
    container.querySelector('#ixOpenFactReportBtn')?.addEventListener('click', () => ctx.navigate('report-viewer'));
    container.querySelector('#ixFactSearchInput')?.addEventListener('input', (e) => {
      search = e.target.value;
      draw();
      const next = container.querySelector('#ixFactSearchInput');
      if (next) {
        next.focus();
        next.setSelectionRange(search.length, search.length);
      }
    });
  };

  draw();
}

/* ============================================================================
   5. DOCUMENT INTELLIGENCE (Connected to GET /files/, POST /upload/, DELETE)
   ============================================================================ */
export function renderDocumentsView(container, ctx) {
  let loading = false;
  let loadError = null;
  let search = '';

  const draw = () => {
    const files = store.state.files || [];
    const filtered = search.trim()
      ? files.filter((f) => String(f).toLowerCase().includes(search.trim().toLowerCase()))
      : files;

    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Document Intelligence</h1>
            <p class="ix-page-desc">
              Upload local PDFs, Markdown, text, CSV, or Office documents for vector-indexed RAG research (<code class="ix-mono">/files/</code>).
            </p>
          </div>
          <div class="ix-page-actions">
            <button type="button" id="ixRefreshDocsBtn" class="ix-btn ix-btn-secondary" ${loading ? 'disabled' : ''}>
              <i class="fa-solid fa-rotate ${loading ? 'fa-spin' : ''}"></i> Refresh
            </button>
            <button type="button" id="ixResearchLocalBtn" class="ix-btn ix-btn-primary">
              <i class="fa-solid fa-microscope"></i> Research Local Corpus
            </button>
          </div>
        </div>

        <section class="ix-card" style="margin-bottom:var(--space-5);">
          <div class="ix-card-body">
            <div class="ix-dropzone" id="ixDocsDropzone" role="button" tabindex="0">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size:26px; color:var(--accent-primary); margin-bottom:10px;"></i>
              <div style="font-size:var(--text-base); font-weight:600; color:var(--text-primary);">
                Drop files here or click to browse
              </div>
              <p class="ix-help" style="margin:6px 0 0;">
                Uploaded documents become immediately selectable in Local or Hybrid research source mode.
              </p>
              <input type="file" id="ixDocsFileInput" multiple hidden />
            </div>
          </div>
        </section>

        ${
          loadError
            ? renderErrorState({ title: 'Could not load document library', desc: loadError, retryId: 'ixRetryDocsBtn' })
            : `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:var(--space-4); flex-wrap:wrap;">
                <span class="ix-badge">${files.length} indexed file${files.length === 1 ? '' : 's'} in workspace</span>
                <div class="ix-search-wrap" style="width:280px; max-width:100%;">
                  <i class="fa-solid fa-magnifying-glass ix-search-icon"></i>
                  <input type="search" id="ixDocsSearch" class="ix-input" style="height:34px;" placeholder="Filter uploaded files..." value="${escapeHtml(search)}" />
                </div>
              </div>

              ${
                filtered.length === 0
                  ? renderEmptyState({
                      icon: 'fa-file-circle-plus',
                      title: files.length === 0 ? 'No local documents uploaded yet' : 'No files match your filter',
                      desc: 'Upload research papers, datasets, or internal PDFs above to analyze them privately.',
                    })
                  : `<div class="ix-table-wrap">
                       <table class="ix-table">
                         <thead>
                           <tr>
                             <th>Filename</th>
                             <th>Format</th>
                             <th style="text-align:right;">Actions</th>
                           </tr>
                         </thead>
                         <tbody>
                           ${filtered
                             .map((fname) => {
                               const parts = String(fname).split('.');
                               const ext = parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
                               return `
                                 <tr>
                                   <td style="font-weight:500;">
                                     <i class="fa-regular fa-file-lines" style="color:var(--accent-primary); margin-right:8px;"></i>
                                     ${escapeHtml(fname)}
                                   </td>
                                   <td><span class="ix-badge">${escapeHtml(ext)}</span></td>
                                   <td style="text-align:right;">
                                     <button type="button" class="ix-btn ix-btn-danger ix-btn-sm" data-del-file="${escapeHtml(fname)}">
                                       <i class="fa-regular fa-trash-can"></i> Remove
                                     </button>
                                   </td>
                                 </tr>`;
                             })
                             .join('')}
                         </tbody>
                       </table>
                     </div>`
              }
            `
        }
      </div>
    `;

    const doRefresh = async () => {
      loading = true;
      loadError = null;
      draw();
      try {
        await store.loadFiles();
      } catch (err) {
        loadError = err.message || 'Failed to inspect /files/';
      } finally {
        loading = false;
        draw();
      }
    };

    const handleUploadList = async (fileList) => {
      const arr = Array.from(fileList || []);
      if (!arr.length) return;
      for (const file of arr) {
        try {
          await uploadDocumentFile(file);
          showToast(`Uploaded ${file.name}`, 'success');
        } catch (err) {
          showToast(`Upload failed for ${file.name}: ${err.message}`, 'error');
        }
      }
      await store.loadFiles();
      draw();
    };

    container.querySelector('#ixRefreshDocsBtn')?.addEventListener('click', doRefresh);
    container.querySelector('#ixRetryDocsBtn')?.addEventListener('click', doRefresh);
    container.querySelector('#ixResearchLocalBtn')?.addEventListener('click', () => {
      store.updateDraftConfig({ report_source: 'local' });
      ctx.navigate('new-research');
    });

    const dropzone = container.querySelector('#ixDocsDropzone');
    const fileInput = container.querySelector('#ixDocsFileInput');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });
      fileInput.addEventListener('change', (e) => handleUploadList(e.target.files));
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleUploadList(e.dataTransfer?.files);
      });
    }

    container.querySelector('#ixDocsSearch')?.addEventListener('input', (e) => {
      search = e.target.value;
      draw();
      const next = container.querySelector('#ixDocsSearch');
      if (next) {
        next.focus();
        next.setSelectionRange(search.length, search.length);
      }
    });

    container.querySelectorAll('[data-del-file]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const filename = btn.getAttribute('data-del-file');
        openConfirmDialog({
          title: 'Remove Uploaded Document',
          message: `Remove "${filename}" from the InquireX document directory?`,
          confirmText: 'Remove File',
          danger: true,
          onConfirm: async () => {
            try {
              await deleteUploadedFile(filename);
              await store.loadFiles();
              showToast(`Removed ${filename}`, 'info');
              draw();
            } catch (err) {
              showToast(err.message || 'Delete failed', 'error');
            }
          },
        });
      });
    });
  };

  if (!store.state.filesLoaded) {
    store.loadFiles().finally(draw);
  } else {
    draw();
  }
}

/* ============================================================================
   6. PRESENTATIONS (Slide Deck Builder & Preview Stage)
   ============================================================================ */
export function renderPresentationsView(container, ctx) {
  const reports = store.state.reports || [];
  let selectedReport = store.getActiveReport() || reports[0] || null;
  let slideIdx = 0;

  const draw = () => {
    if (!selectedReport || (!selectedReport.reportHtml && !selectedReport.reportMarkdown)) {
      container.innerHTML = `
        <div class="ix-view-enter">
          <div class="ix-page-header">
            <div>
              <h1 class="ix-page-title">Presentations</h1>
              <p class="ix-page-desc">Generate structured executive slide decks directly from any completed research report.</p>
            </div>
          </div>
          ${renderEmptyState({
            icon: 'fa-display',
            title: 'No report ready for slide generation',
            desc: 'Complete a research report first, then turn it into a formatted slide deck here or from the Report Viewer.',
            actionHtml: `<button type="button" class="ix-btn ix-btn-primary" data-nav="new-research"><i class="fa-solid fa-plus"></i> New Research</button>`,
          })}
        </div>
      `;
      container.querySelector('[data-nav]')?.addEventListener('click', () => ctx.navigate('new-research'));
      return;
    }

    const htmlReport = { ...selectedReport, reportHtml: ensureHtml(selectedReport) };
    const slides = buildSlidesFromReport(htmlReport);
    if (slideIdx >= slides.length) slideIdx = 0;
    const current = slides[slideIdx];

    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Presentation Deck Studio</h1>
            <p class="ix-page-desc">Preview, navigate, and export executive briefings synthesized from your research sections.</p>
          </div>
          <div class="ix-page-actions">
            <select id="ixPresReportSelect" class="ix-select" style="width:auto; max-width:280px;">
              ${reports
                .slice(0, 20)
                .map(
                  (r) =>
                    `<option value="${escapeHtml(r.id)}" ${r.id === selectedReport.id ? 'selected' : ''}>${escapeHtml(
                      (r.prompt || 'Untitled').slice(0, 50)
                    )}</option>`
                )
                .join('')}
            </select>
            <button type="button" id="ixLaunchDeckModalBtn" class="ix-btn ix-btn-primary">
              <i class="fa-solid fa-expand"></i> Fullscreen Presenter
            </button>
          </div>
        </div>

        <div class="ix-presentations-grid">
          <!-- Slide Outline Sidebar -->
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title">Deck Outline (${slides.length})</h2>
            </div>
            <div class="ix-card-body" style="padding:var(--space-2); display:flex; flex-direction:column; gap:4px; max-height:460px; overflow-y:auto;">
              ${slides
                .map(
                  (s, idx) => `
                  <button
                    type="button"
                    class="ix-nav-item ${idx === slideIdx ? 'active' : ''}"
                    data-slide-select="${idx}"
                    style="height:auto; padding:8px 10px;"
                  >
                    <span class="ix-mono" style="font-size:11px; opacity:0.7;">${idx + 1}.</span>
                    <span class="ix-truncate" style="font-size:var(--text-xs);">${escapeHtml(s.title)}</span>
                  </button>`
                )
                .join('')}
            </div>
          </section>

          <!-- Main Slide Stage -->
          <section class="ix-card">
            <div class="ix-card-header">
              <span class="ix-badge ix-badge-accent">${escapeHtml(current.kicker || `Slide ${slideIdx + 1}`)}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" id="ixSlidePrevBtn" class="ix-btn ix-btn-secondary ix-btn-sm" ${slideIdx === 0 ? 'disabled' : ''}>
                  <i class="fa-solid fa-chevron-left"></i> Prev
                </button>
                <span class="ix-mono" style="font-size:var(--text-xs); color:var(--text-secondary);">${slideIdx + 1} / ${slides.length}</span>
                <button type="button" id="ixSlideNextBtn" class="ix-btn ix-btn-secondary ix-btn-sm" ${slideIdx >= slides.length - 1 ? 'disabled' : ''}>
                  Next <i class="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
            <div class="ix-card-body">
              <div class="ix-slide-stage">
                ${
                  current.type === 'title'
                    ? `<h2 style="font-size:var(--text-2xl); line-height:1.3;">${escapeHtml(current.title)}</h2>
                       <p style="color:var(--text-secondary); font-size:var(--text-md);">${escapeHtml(current.subtitle || '')}</p>`
                    : `<h2 style="font-size:var(--text-xl); margin-bottom:8px;">${escapeHtml(current.title)}</h2>
                       <ul style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:10px; font-size:var(--text-base); color:var(--text-secondary); line-height:1.6;">
                         ${(current.bullets || []).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
                       </ul>`
                }
              </div>
            </div>
          </section>
        </div>
      </div>
    `;

    container.querySelector('#ixPresReportSelect')?.addEventListener('change', (e) => {
      selectedReport = store.getReportById(e.target.value);
      store.setActiveReportId(e.target.value);
      slideIdx = 0;
      draw();
    });
    container.querySelector('#ixLaunchDeckModalBtn')?.addEventListener('click', () => openSlideDeckModal(htmlReport));
    container.querySelectorAll('[data-slide-select]').forEach((b) =>
      b.addEventListener('click', () => {
        slideIdx = Number(b.getAttribute('data-slide-select') || 0);
        draw();
      })
    );
    container.querySelector('#ixSlidePrevBtn')?.addEventListener('click', () => {
      if (slideIdx > 0) {
        slideIdx -= 1;
        draw();
      }
    });
    container.querySelector('#ixSlideNextBtn')?.addEventListener('click', () => {
      if (slideIdx < slides.length - 1) {
        slideIdx += 1;
        draw();
      }
    });
  };

  draw();
}

/* ============================================================================
   7. RESEARCH MONITOR (Real WebSocket Telemetry & Backend Health)
   ============================================================================ */
export function renderMonitorView(container, ctx) {
  const ws = store.state.wsStats || {};
  const live = store.state.liveSession || {};
  const reports = store.state.reports || [];

  const dotClass =
    ws.state === 'connected' ? 'connected' : ws.state === 'connecting' || ws.state === 'reconnecting' ? 'connecting' : ws.state === 'error' ? 'error' : '';

  container.innerHTML = `
    <div class="ix-view-enter">
      <div class="ix-page-header">
        <div>
          <h1 class="ix-page-title">Research Monitor</h1>
          <p class="ix-page-desc">Live WebSocket transport diagnostics, backend discovery metadata, and execution event log.</p>
        </div>
        <div class="ix-page-actions">
          <button type="button" id="ixTestWsReconnectBtn" class="ix-btn ix-btn-secondary">
            <i class="fa-solid fa-plug"></i> Connect / Ping /ws
          </button>
          <button type="button" class="ix-btn ix-btn-primary" data-nav="live-research">
            <i class="fa-solid fa-wave-square"></i> Live Stream
          </button>
        </div>
      </div>

      <div class="ix-stats-grid">
        <div class="ix-stat-card">
          <div class="ix-stat-label"><span>WebSocket State</span><span class="ix-ws-dot ${dotClass}"></span></div>
          <div class="ix-stat-value" style="font-size:var(--text-xl); text-transform:capitalize;">${escapeHtml(ws.state || 'disconnected')}</div>
          <div class="ix-stat-sub">ReadyState: <span class="ix-mono">${escapeHtml(ws.readyStateText || 'CLOSED')}</span></div>
        </div>
        <div class="ix-stat-card">
          <div class="ix-stat-label"><span>Frames Received</span><i class="fa-solid fa-arrows-rotate"></i></div>
          <div class="ix-stat-value">${ws.messagesReceived || 0}</div>
          <div class="ix-stat-sub">Current browser session</div>
        </div>
        <div class="ix-stat-card">
          <div class="ix-stat-label"><span>Reconnect Attempts</span><i class="fa-solid fa-plug-circle-check"></i></div>
          <div class="ix-stat-value">${ws.attempts || 0}</div>
          <div class="ix-stat-sub">${ws.lastError ? escapeHtml(ws.lastError) : 'Zero socket errors'}</div>
        </div>
        <div class="ix-stat-card">
          <div class="ix-stat-label"><span>Indexed Reports</span><i class="fa-solid fa-database"></i></div>
          <div class="ix-stat-value">${reports.length}</div>
          <div class="ix-stat-sub">Merged /api/reports + local</div>
        </div>
      </div>

      <div class="ix-dashboard-grid">
        <section class="ix-card">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-solid fa-terminal"></i> Session Execution Trace (${(live.logs || []).length})</h2>
          </div>
          <div class="ix-card-body">
            <div class="ix-log-stream" style="max-height:360px;">
              ${
                (live.logs || []).length === 0
                  ? `<div style="color:var(--text-secondary);">No WebSocket logs streamed in this session yet.</div>`
                  : live.logs
                      .slice(-80)
                      .map(
                        (entry) => `
                        <div class="ix-log-line">
                          <span style="color:var(--text-secondary); margin-right:8px;">[${escapeHtml(entry.time || '')}]</span>
                          <span>${escapeHtml(entry.output || '')}</span>
                        </div>`
                      )
                      .join('')
              }
            </div>
          </div>
        </section>

        <section class="ix-card">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-solid fa-server"></i> Backend Discovery Endpoint</h2>
          </div>
          <div class="ix-card-body">
            <pre id="ixDiscoveryJsonPre" class="ix-mono" style="margin:0; padding:var(--space-4); border-radius:var(--radius-lg); background-color:var(--bg-code); border:1px solid var(--border-default); font-size:var(--text-xs); overflow-x:auto; max-height:360px;">Fetching /.well-known/agent-discovery.json...</pre>
          </div>
        </section>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate(b.getAttribute('data-nav')))
  );

  container.querySelector('#ixTestWsReconnectBtn')?.addEventListener('click', () => {
    if (ctx.wsClient) {
      ctx.wsClient.connect(null);
      showToast('Initiated /ws WebSocket connection check.', 'info');
    }
  });

  const pre = container.querySelector('#ixDiscoveryJsonPre');
  fetchAgentDiscovery()
    .then((data) => {
      if (pre && document.body.contains(pre)) {
        pre.textContent = JSON.stringify(data, null, 2);
      }
    })
    .catch((err) => {
      if (pre && document.body.contains(pre)) {
        pre.textContent = `Endpoint unavailable: ${err.message}`;
      }
    });
}

/* ============================================================================
   8. SETTINGS (Theme Engine, Research Defaults, Account & Session Controls)
   ============================================================================ */
export function renderSettingsView(container, ctx) {
  const { user, preferences, reports, files, favorites } = store.state;
  const activeMode = getThemeMode();

  container.innerHTML = `
    <div class="ix-view-enter" style="max-width:920px; margin:0 auto;">
      <div class="ix-page-header">
        <div>
          <h1 class="ix-page-title">Settings</h1>
          <p class="ix-page-desc">Configure appearance, default research parameters, local browser storage, and authentication session.</p>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:var(--space-5);">
        <!-- Theme Selection -->
        <section class="ix-card">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-solid fa-palette"></i> Appearance &amp; Theme</h2>
          </div>
          <div class="ix-card-body">
            <p class="ix-help" style="margin-bottom:var(--space-4);">
              Choose between crisp Light mode, deep Dark mode, or follow your OS system preference without reloading.
            </p>
            <div class="ix-config-grid">
              ${[
                { mode: 'light', icon: 'fa-sun', label: 'Light Theme', desc: 'Pure #FFFFFF canvas with indigo accent' },
                { mode: 'dark', icon: 'fa-moon', label: 'Dark Theme', desc: '#0B1020 canvas tuned for low-light focus' },
                { mode: 'system', icon: 'fa-desktop', label: 'System Preference', desc: 'Automatically matches your OS theme' },
              ]
                .map(
                  (t) => `
                  <button
                    type="button"
                    class="ix-persona-option ${activeMode === t.mode ? 'active' : ''}"
                    data-theme-option="${t.mode}"
                    aria-pressed="${activeMode === t.mode}"
                  >
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                      <i class="fa-solid ${t.icon}" style="color:var(--accent-primary);"></i>
                      ${activeMode === t.mode ? '<span class="ix-badge ix-badge-accent">Active</span>' : ''}
                    </div>
                    <strong style="font-size:var(--text-sm); color:var(--text-primary); margin-top:4px;">${t.label}</strong>
                    <span class="ix-help">${t.desc}</span>
                  </button>`
                )
                .join('')}
            </div>
          </div>
        </section>

        <!-- Default Research Preferences -->
        <section class="ix-card">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-solid fa-sliders"></i> Research Defaults</h2>
          </div>
          <div class="ix-card-body">
            <div class="ix-config-grid">
              <div class="ix-field">
                <label class="ix-label" for="ixPrefDepth">Default Research Depth</label>
                <select id="ixPrefDepth" class="ix-select">
                  <option value="research_report" ${preferences.defaultReportType === 'research_report' ? 'selected' : ''}>Summary Report</option>
                  <option value="detailed_report" ${preferences.defaultReportType === 'detailed_report' ? 'selected' : ''}>Detailed Report</option>
                  <option value="deep" ${preferences.defaultReportType === 'deep' ? 'selected' : ''}>Deep Research</option>
                </select>
              </div>
              <div class="ix-field">
                <label class="ix-label" for="ixPrefTone">Default Writing Tone</label>
                <select id="ixPrefTone" class="ix-select">
                  ${['Objective', 'Analytical', 'Formal', 'Informative', 'Comparative', 'Critical']
                    .map(
                      (t) =>
                        `<option value="${t}" ${preferences.defaultTone === t ? 'selected' : ''}>${t}</option>`
                    )
                    .join('')}
                </select>
              </div>
              <div class="ix-field">
                <label class="ix-label" for="ixPrefSource">Default Source Mode</label>
                <select id="ixPrefSource" class="ix-select">
                  <option value="web" ${preferences.defaultReportSource === 'web' ? 'selected' : ''}>Web Search</option>
                  <option value="hybrid" ${preferences.defaultReportSource === 'hybrid' ? 'selected' : ''}>Hybrid (Web + Local Docs)</option>
                  <option value="local" ${preferences.defaultReportSource === 'local' ? 'selected' : ''}>Local Documents Only</option>
                </select>
              </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:var(--space-5); padding-top:var(--space-4); border-top:1px solid var(--border-subtle); flex-wrap:wrap; gap:12px;">
              <label class="ix-switch">
                <input type="checkbox" id="ixPrefPlanPreview" ${preferences.showPlanPreview !== false ? 'checked' : ''} />
                <span class="ix-switch-track"></span>
                <span style="font-size:var(--text-sm); color:var(--text-primary);">Show execution plan preview in New Research</span>
              </label>
              <button type="button" id="ixSavePrefsBtn" class="ix-btn ix-btn-primary ix-btn-sm">Save Defaults</button>
            </div>
          </div>
        </section>

        <!-- Account & Workspace Data -->
        <section class="ix-card">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-regular fa-user"></i> Account &amp; Session</h2>
          </div>
          <div class="ix-card-body" style="display:flex; flex-direction:column; gap:var(--space-4);">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(user?.name || 'Authenticated Researcher')}</div>
                <div class="ix-help">${escapeHtml(user?.email || 'Active gptr_session authenticated user')}</div>
              </div>
              <a href="/auth/logout" class="ix-btn ix-btn-secondary">
                <i class="fa-solid fa-right-from-bracket"></i> Sign Out
              </a>
            </div>

            <div class="ix-divider"></div>

            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="font-size:var(--text-sm); font-weight:600; color:var(--text-primary);">Browser Cache &amp; Bookmarks</div>
                <div class="ix-help">${reports.length} reports, ${favorites.length} bookmarks, ${files.length} indexed local docs</div>
              </div>
              <button type="button" id="ixSettingsClearCacheBtn" class="ix-btn ix-btn-danger ix-btn-sm">
                Clear Browser Cache
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-theme-option]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-theme-option');
      applyThemeMode(mode, true);
      showToast(`Theme switched to ${mode}.`, 'info');
      renderSettingsView(container, ctx);
    });
  });

  container.querySelector('#ixSavePrefsBtn')?.addEventListener('click', () => {
    const defaultReportType = container.querySelector('#ixPrefDepth').value;
    const defaultTone = container.querySelector('#ixPrefTone').value;
    const defaultReportSource = container.querySelector('#ixPrefSource').value;
    const showPlanPreview = container.querySelector('#ixPrefPlanPreview').checked;

    store.updatePreferences({
      defaultReportType,
      defaultTone,
      defaultReportSource,
      showPlanPreview,
    });
    store.updateDraftConfig({
      report_type: defaultReportType,
      tone: defaultTone,
      report_source: defaultReportSource,
    });
    showToast('Default research preferences saved.', 'success');
  });

  container.querySelector('#ixSettingsClearCacheBtn')?.addEventListener('click', () => {
    openConfirmDialog({
      title: 'Clear Browser Research Cache',
      message: 'Remove cached report HTML and local history entries stored in your browser?',
      confirmText: 'Clear Cache',
      danger: true,
      onConfirm: async () => {
        await store.clearAllLocalHistory();
        showToast('Local workspace cache cleared.', 'info');
        renderSettingsView(container, ctx);
      },
    });
  });
}
