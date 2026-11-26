/**
 * InquireX Research Report Viewer
 * Full-featured reading experience with sticky right rail, action toolbar,
 * export dropdown popover, slide deck modal, audio briefing, fullscreen mode,
 * verified visuals gallery + lightbox, SWOT analysis, deep-dive vectors, and follow-up chat.
 */

import { store } from '../store.js';
import {
  escapeHtml,
  formatRelativeTime,
  markdownToHtml,
  sanitizeHtml,
  renderEmptyState,
  showToast,
  openImageLightbox,
} from '../ui.js';
import {
  extractReportMetrics,
  extractCitations,
  extractTableOfContents,
  extractKnowledgeGraphData,
  extractSwotSections,
  extractFollowUpVectors,
} from '../postprocess.js';
import { exportReport, openSlideDeckModal, AudioBriefingController } from '../exports.js';

const audioController = new AudioBriefingController();

function normalizeImageUrls(report, proseRoot) {
  const seen = new Set();
  const list = [];
  const pushImg = (src, alt = '') => {
    const clean = String(src || '').trim();
    if (!clean || clean.startsWith('data:image/svg') || seen.has(clean)) return;
    seen.add(clean);
    list.push({ src: clean, alt: alt || 'Research Figure' });
  };

  if (Array.isArray(report?.images)) {
    report.images.forEach((img) => {
      if (typeof img === 'string') pushImg(img);
      else if (img && img.url) pushImg(img.url, img.alt || img.title);
      else if (img && img.src) pushImg(img.src, img.alt);
    });
  }

  if (proseRoot) {
    proseRoot.querySelectorAll('img[src]').forEach((el) => {
      pushImg(el.getAttribute('src'), el.getAttribute('alt') || '');
    });
  }

  return list;
}

export function renderReportViewerView(container, ctx) {
  // Ensure speech playback stops when view re-renders for another report
  audioController.stop();

  const reports = store.state.reports || [];
  let report = store.getActiveReport() || reports[0] || null;

  // Fallback to currently completed liveSession HTML if not yet persisted
  if (!report && store.state.liveSession?.html) {
    const ls = store.state.liveSession;
    report = {
      id: 'live_preview',
      prompt: ls.task || 'Live Research Report',
      reportHtml: ls.html,
      reportMarkdown: ls.markdown,
      links: ls.downloadLinks || {},
      images: ls.images || [],
      sources: ls.scrapedSources || [],
      subqueries: ls.subqueries || [],
      logs: ls.logs || [],
      config: ls.config || {},
      chatMessages: [],
      timestamp: new Date().toISOString(),
    };
  }

  if (!report || (!report.reportHtml && !report.reportMarkdown)) {
    container.innerHTML = `
      <div class="ix-view-enter">
        <div class="ix-page-header">
          <div>
            <h1 class="ix-page-title">Research Report Viewer</h1>
            <p class="ix-page-desc">Read generated reports, inspect verified citations, export documents, and ask follow-up questions.</p>
          </div>
          <div class="ix-page-actions">
            <button type="button" class="ix-btn ix-btn-primary" data-nav="new-research">
              <i class="fa-solid fa-plus"></i> New Research
            </button>
          </div>
        </div>
        ${renderEmptyState({
          icon: 'fa-file-lines',
          title: 'No report selected',
          desc: 'Complete a research inquiry or choose a saved report from Research History to open the interactive reader.',
          actionHtml: `
            <button type="button" class="ix-btn ix-btn-primary" data-nav="new-research">
              <i class="fa-solid fa-magnifying-glass"></i> Start New Research
            </button>
            <button type="button" class="ix-btn ix-btn-secondary" data-nav="history">
              <i class="fa-solid fa-clock-rotate-left"></i> Browse History
            </button>
          `,
        })}
      </div>
    `;
    container.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate(b.getAttribute('data-nav')))
    );
    return;
  }

  const rawHtml =
    report.reportHtml && report.reportHtml.trim().length > 0
      ? sanitizeHtml(report.reportHtml)
      : markdownToHtml(report.reportMarkdown || '');

  const normalizedReport = {
    ...report,
    reportHtml: rawHtml,
  };

  // Parse DOM fragment for ToC, citations, images, and link hardening
  const parserDiv = document.createElement('div');
  parserDiv.innerHTML = rawHtml;
  parserDiv.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  const tocItems = extractTableOfContents(parserDiv);
  const hardenedHtml = parserDiv.innerHTML;
  const metrics = extractReportMetrics(hardenedHtml, report.reportMarkdown, report.metrics || {});
  const extractedCitations = extractCitations(parserDiv, report.reportMarkdown);

  // Combine extracted citations + scraped session URLs cleanly without duplicates
  const allSourcesMap = new Map();
  extractedCitations.forEach((c) => allSourcesMap.set(c.url, c));
  (report.sources || []).forEach((u) => {
    const cleanUrl = String(u || '').trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(cleanUrl) && !allSourcesMap.has(cleanUrl)) {
      let domain = '';
      try {
        domain = new URL(cleanUrl).hostname.replace(/^www\./, '');
      } catch {}
      allSourcesMap.set(cleanUrl, { url: cleanUrl, title: domain || cleanUrl, domain });
    }
  });
  const sourceList = Array.from(allSourcesMap.values());

  const galleryImages = normalizeImageUrls(report, parserDiv);
  const swot = extractSwotSections(hardenedHtml);
  const hasSwot = Object.values(swot).some((arr) => arr.length > 0);
  const followUpVectors = extractFollowUpVectors(report.prompt, hardenedHtml);
  const graphData = extractKnowledgeGraphData(report.prompt, hardenedHtml);
  const isFav = store.isFavorite(report.id);

  container.innerHTML = `
    <div id="ixReportViewerRoot" class="ix-view-enter">
      <!-- Report Selector & Metadata Header -->
      <div class="ix-page-header" style="margin-bottom:var(--space-4);">
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <span class="ix-badge ix-badge-accent">
              <i class="fa-solid fa-file-shield"></i>
              ${escapeHtml(report.config?.report_type || 'research_report')}
            </span>
            <span class="ix-badge">
              <i class="fa-solid fa-robot"></i>
              ${escapeHtml(report.metrics?.agentName || report.config?.agent || 'Auto Agent')}
            </span>
            <span class="ix-help">${escapeHtml(formatRelativeTime(report.timestamp))}</span>
          </div>
          <h1 class="ix-page-title" style="font-size:var(--text-xl); line-height:1.3;">
            ${escapeHtml(report.prompt || 'Research Report')}
          </h1>
        </div>

        <div class="ix-page-actions">
          ${
            reports.length > 1
              ? `<select id="ixReportSwitcherSelect" class="ix-select" style="width:auto; max-width:min(260px, 100%); height:34px; font-size:var(--text-xs);" aria-label="Switch saved report">
                  ${reports
                    .slice(0, 20)
                    .map(
                      (r) =>
                        `<option value="${escapeHtml(r.id)}" ${r.id === report.id ? 'selected' : ''}>${escapeHtml(
                          (r.prompt || 'Untitled').slice(0, 48)
                        )}</option>`
                    )
                    .join('')}
                 </select>`
              : ''
          }
          <button
            type="button"
            id="ixToggleFavReportBtn"
            class="ix-btn ix-btn-secondary ix-btn-sm"
            aria-label="${isFav ? 'Remove from favorites' : 'Save to favorites'}"
          >
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-star" style="${isFav ? 'color:var(--status-warning);' : ''}"></i>
            <span>${isFav ? 'Saved' : 'Save Topic'}</span>
          </button>
        </div>
      </div>

      <!-- Sticky Action Toolbar -->
      <div class="ix-report-toolbar" role="toolbar" aria-label="Report actions">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button type="button" id="ixCopyReportBtn" class="ix-btn ix-btn-secondary ix-btn-sm">
            <i class="fa-regular fa-copy"></i> Copy Report
          </button>
          <button type="button" id="ixOpenSlidesBtn" class="ix-btn ix-btn-secondary ix-btn-sm">
            <i class="fa-solid fa-display"></i> Slides
          </button>

          <div class="ix-dropdown" id="ixExportDropdownWrap">
            <button
              type="button"
              id="ixExportTriggerBtn"
              class="ix-btn ix-btn-secondary ix-btn-sm"
              aria-expanded="false"
              aria-haspopup="menu"
            >
              <i class="fa-solid fa-download"></i>
              Export &amp; Share
              <i class="fa-solid fa-chevron-down" style="font-size:10px; opacity:0.75;"></i>
            </button>
            <div class="ix-dropdown-menu align-left" id="ixExportMenu" role="menu" style="min-width:270px;">
              <button type="button" class="ix-dropdown-item" data-export="pdf" role="menuitem">
                <i class="fa-regular fa-file-pdf" style="margin-top:2px; color:var(--status-error);"></i>
                <div class="ix-dropdown-item-meta">
                  <span class="ix-dropdown-item-title">PDF Document (.pdf)</span>
                  <span class="ix-dropdown-item-desc">Download artifact or print-ready PDF</span>
                </div>
              </button>
              <button type="button" class="ix-dropdown-item" data-export="docx" role="menuitem">
                <i class="fa-regular fa-file-word" style="margin-top:2px; color:var(--accent-secondary);"></i>
                <div class="ix-dropdown-item-meta">
                  <span class="ix-dropdown-item-title">Word Document (.docx)</span>
                  <span class="ix-dropdown-item-desc">Microsoft Word compatible document</span>
                </div>
              </button>
              <button type="button" class="ix-dropdown-item" data-export="md" role="menuitem">
                <i class="fa-brands fa-markdown" style="margin-top:2px; color:var(--accent-primary);"></i>
                <div class="ix-dropdown-item-meta">
                  <span class="ix-dropdown-item-title">Markdown (.md)</span>
                  <span class="ix-dropdown-item-desc">Clean structured Markdown source</span>
                </div>
              </button>
              <button type="button" class="ix-dropdown-item" data-export="json" role="menuitem">
                <i class="fa-solid fa-brackets-curly" style="margin-top:2px; color:var(--status-warning);"></i>
                <div class="ix-dropdown-item-meta">
                  <span class="ix-dropdown-item-title">Log Trace (JSON)</span>
                  <span class="ix-dropdown-item-desc">Session logs, queries, sources &amp; timestamps</span>
                </div>
              </button>
              <button type="button" class="ix-dropdown-item" data-export="latex" role="menuitem">
                <i class="fa-solid fa-square-root-variable" style="margin-top:2px; color:var(--status-success);"></i>
                <div class="ix-dropdown-item-meta">
                  <span class="ix-dropdown-item-title">LaTeX Academic Source (.tex)</span>
                  <span class="ix-dropdown-item-desc">Typeset paper format with bibliography</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <button
              type="button"
              id="ixAudioBriefingBtn"
              class="ix-btn ix-btn-secondary ix-btn-sm"
              title="Listen to AI Voice Audio Briefing"
            >
              <i class="fa-solid fa-headphones"></i>
              <span>Audio Briefing</span>
            </button>
            <select
              id="ixAudioRateSelect"
              class="ix-select ix-hidden"
              style="width:74px; height:30px; font-size:var(--text-xs); padding:0 22px 0 8px;"
              aria-label="Audio playback speed"
            >
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>
          </div>

          <button
            type="button"
            id="ixReportFullscreenBtn"
            class="ix-icon-btn ix-icon-btn-sm"
            aria-label="Toggle fullscreen reading mode"
            title="Fullscreen Report"
          >
            <i class="fa-solid fa-expand"></i>
          </button>
        </div>
      </div>

      <!-- Summary Metrics Strip (Strictly Real Report Counts) -->
      <div class="ix-stats-grid" style="margin-bottom:var(--space-5);">
        <div class="ix-stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="ix-stat-label"><span>Word Count</span><i class="fa-solid fa-align-left"></i></div>
          <div class="ix-stat-value" style="font-size:var(--text-xl);">${metrics.wordCount.toLocaleString()}</div>
        </div>
        <div class="ix-stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="ix-stat-label"><span>Estimated Read Time</span><i class="fa-regular fa-clock"></i></div>
          <div class="ix-stat-value" style="font-size:var(--text-xl);">${metrics.readTimeMinutes > 0 ? `${metrics.readTimeMinutes} min` : '—'}</div>
        </div>
        <div class="ix-stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="ix-stat-label"><span>Verified Citations</span><i class="fa-solid fa-link"></i></div>
          <div class="ix-stat-value" style="font-size:var(--text-xl);">${sourceList.length}</div>
        </div>
        <div class="ix-stat-card" style="padding:var(--space-3) var(--space-4);">
          <div class="ix-stat-label"><span>Core Pillars</span><i class="fa-solid fa-layer-group"></i></div>
          <div class="ix-stat-value" style="font-size:var(--text-xl);">${metrics.corePillars}</div>
        </div>
      </div>

      <!-- 2-Column Main Reading Layout + Sticky Right Contextual Rail -->
      <div class="ix-report-layout">
        <div style="display:flex; flex-direction:column; gap:var(--space-5); min-width:0;">
          <article class="ix-report-article-card" id="ixReportArticleCard">
            <div class="ix-prose" id="ixReportProse">
              ${hardenedHtml}
            </div>
          </article>

          ${
            galleryImages.length > 0
              ? `<section class="ix-card">
                   <div class="ix-card-header">
                     <h2 class="ix-card-title"><i class="fa-regular fa-images"></i> Verified Research Visuals &amp; Figures (${galleryImages.length})</h2>
                   </div>
                   <div class="ix-card-body">
                     <div class="ix-gallery-grid">
                       ${galleryImages
                         .map(
                           (img, idx) => `
                           <div class="ix-gallery-item" data-img-index="${idx}" role="button" tabindex="0" aria-label="View figure ${idx + 1}">
                             <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy" />
                             <div class="ix-gallery-caption">${escapeHtml(img.alt || `Figure ${idx + 1}`)}</div>
                           </div>`
                         )
                         .join('')}
                     </div>
                   </div>
                 </section>`
              : ''
          }

          ${
            hasSwot
              ? `<section class="ix-card">
                   <div class="ix-card-header">
                     <h2 class="ix-card-title"><i class="fa-solid fa-table-cells-large"></i> Strategic SWOT Breakdown</h2>
                     <button type="button" id="ixToggleSwotBtn" class="ix-btn ix-btn-ghost ix-btn-sm">
                       Hide Matrix
                     </button>
                   </div>
                   <div class="ix-card-body" id="ixSwotBody">
                     <div class="ix-swot-grid">
                       ${renderSwotQuadrant('Strengths', 'fa-circle-check', 'var(--status-success)', swot.strengths)}
                       ${renderSwotQuadrant('Weaknesses', 'fa-circle-minus', 'var(--status-warning)', swot.weaknesses)}
                       ${renderSwotQuadrant('Opportunities', 'fa-arrow-trend-up', 'var(--accent-primary)', swot.opportunities)}
                       ${renderSwotQuadrant('Threats & Risks', 'fa-triangle-exclamation', 'var(--status-error)', swot.threats)}
                     </div>
                   </div>
                 </section>`
              : ''
          }

          ${
            followUpVectors.length > 0
              ? `<section class="ix-card">
                   <div class="ix-card-header">
                     <h2 class="ix-card-title"><i class="fa-solid fa-compass"></i> Recommended Deep-Dive Vectors</h2>
                   </div>
                   <div class="ix-card-body" style="display:flex; flex-direction:column; gap:8px;">
                     <p class="ix-help" style="margin:0 0 4px;">Launch a focused follow-up investigation based on key themes identified in this report:</p>
                     <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap:10px;">
                       ${followUpVectors
                         .map(
                           (vec) => `
                           <button
                             type="button"
                             class="ix-suggestion-card"
                             data-deep-dive="${escapeHtml(vec)}"
                           >
                             <span class="ix-suggestion-title" style="font-size:var(--text-xs);">${escapeHtml(vec)}</span>
                             <span class="ix-suggestion-desc">Configure follow-up query &rarr;</span>
                           </button>`
                         )
                         .join('')}
                     </div>
                   </div>
                 </section>`
              : ''
          }
        </div>

        <!-- Sticky Contextual Right Rail -->
        <aside class="ix-report-rail" aria-label="Report contextual sidebar">
          <!-- Follow-Up Research Chat -->
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-regular fa-comments"></i> Follow-up Chat</h2>
              <span class="ix-badge">${(report.chatMessages || []).length}</span>
            </div>
            <div class="ix-card-body">
              <div class="ix-chat-messages" id="ixReportChatMessages">
                ${renderChatBubbles(report.chatMessages || [])}
              </div>
              <form id="ixReportChatForm" style="display:flex; flex-direction:column; gap:8px;">
                <textarea
                  id="ixReportChatInput"
                  class="ix-textarea"
                  rows="2"
                  placeholder="Ask a follow-up question grounded in this report..."
                ></textarea>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                  <span class="ix-help" style="font-size:11px;">Uses WebSocket or /api/chat</span>
                  <button type="submit" id="ixReportChatSendBtn" class="ix-btn ix-btn-primary ix-btn-sm">
                    <i class="fa-solid fa-paper-plane"></i> Ask
                  </button>
                </div>
              </form>
            </div>
          </section>

          <!-- Table of Contents -->
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-solid fa-list-ul"></i> Table of Contents</h2>
            </div>
            <div class="ix-card-body" style="padding:var(--space-3);">
              ${
                tocItems.length === 0
                  ? `<p class="ix-help" style="padding:var(--space-2);">No structured section headings detected.</p>`
                  : `<nav class="ix-toc-list" aria-label="Section headings">
                      ${tocItems
                        .map(
                          (item) => `
                          <button
                            type="button"
                            class="ix-toc-link ${item.level >= 3 ? 'indent' : ''} ix-truncate"
                            data-scroll-id="${escapeHtml(item.id)}"
                            title="${escapeHtml(item.text)}"
                          >
                            ${escapeHtml(item.text)}
                          </button>`
                        )
                        .join('')}
                    </nav>`
              }
            </div>
          </section>

          <!-- Citations & Grounding Sources -->
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-solid fa-book-bookmark"></i> Citations (${sourceList.length})</h2>
              ${
                sourceList.length > 0
                  ? `<button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-nav="fact-verification">Audit</button>`
                  : ''
              }
            </div>
            <div class="ix-card-body" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
              ${
                sourceList.length === 0
                  ? `<p class="ix-help">No external citation URLs were detected in this report.</p>`
                  : sourceList
                      .slice(0, 30)
                      .map(
                        (s, idx) => `
                        <a
                          href="${escapeHtml(s.url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border-radius:var(--radius-md); background-color:var(--bg-secondary); font-size:var(--text-xs); text-decoration:none; border:1px solid var(--border-subtle);"
                        >
                          <span class="ix-mono" style="color:var(--text-secondary); flex-shrink:0;">[${idx + 1}]</span>
                          <span style="min-width:0; flex:1;">
                            <span class="ix-truncate" style="display:block; color:var(--text-primary); font-weight:500;">${escapeHtml(s.title || s.domain || s.url)}</span>
                            <span class="ix-truncate" style="display:block; color:var(--text-secondary); font-size:11px;">${escapeHtml(s.domain || s.url)}</span>
                          </span>
                          <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px; color:var(--text-secondary); margin-top:3px;"></i>
                        </a>`
                      )
                      .join('')
              }
            </div>
          </section>

          <!-- Related Concepts & Metadata -->
          <section class="ix-card">
            <div class="ix-card-header">
              <h2 class="ix-card-title"><i class="fa-solid fa-circle-nodes"></i> Concepts &amp; Metadata</h2>
            </div>
            <div class="ix-card-body" style="display:flex; flex-direction:column; gap:10px;">
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${
                  graphData.pillars.length > 0
                    ? graphData.pillars
                        .slice(0, 6)
                        .map((p) => `<span class="ix-badge">${escapeHtml(p.title)}</span>`)
                        .join('')
                    : `<span class="ix-help">No topic pillars extracted.</span>`
                }
              </div>
              <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-nav="knowledge-graph" style="width:100%;">
                <i class="fa-solid fa-diagram-project"></i> Open Knowledge Graph
              </button>
              <div class="ix-divider" style="margin:4px 0;"></div>
              <div style="display:flex; flex-direction:column; gap:6px; font-size:var(--text-xs);">
                <div style="display:flex; justify-content:space-between; gap:8px;">
                  <span class="ix-muted">Source Channel</span>
                  <span>${escapeHtml((report.config?.report_source || 'web').toUpperCase())}</span>
                </div>
                <div style="display:flex; justify-content:space-between; gap:8px;">
                  <span class="ix-muted">Tone</span>
                  <span>${escapeHtml(report.config?.tone || 'Objective')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; gap:8px;">
                  <span class="ix-muted">Execution Duration</span>
                  <span>${report.metrics?.elapsedSec ? `${report.metrics.elapsedSec}s` : 'Recorded session'}</span>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `;

  // Report switcher
  container.querySelector('#ixReportSwitcherSelect')?.addEventListener('change', (e) => {
    store.setActiveReportId(e.target.value);
    renderReportViewerView(container, ctx);
  });

  // Favorite toggle
  container.querySelector('#ixToggleFavReportBtn')?.addEventListener('click', () => {
    const nowFav = store.toggleFavorite(report.id);
    showToast(nowFav ? 'Report bookmarked to Favorites.' : 'Removed from Favorites.', 'info');
    renderReportViewerView(container, ctx);
  });

  // Copy Report
  const copyBtn = container.querySelector('#ixCopyReportBtn');
  copyBtn?.addEventListener('click', async () => {
    const textToCopy = report.reportMarkdown || container.querySelector('#ixReportProse')?.innerText || '';
    if (!textToCopy.trim()) {
      showToast('No report text available to copy.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
      showToast('Report content copied to clipboard.', 'success');
      setTimeout(() => {
        if (document.body.contains(copyBtn)) {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Report';
        }
      }, 1800);
    } catch {
      showToast('Clipboard access failed. Try exporting Markdown instead.', 'error');
    }
  });

  // Slides button
  const slidesBtn = container.querySelector('#ixOpenSlidesBtn');
  slidesBtn?.addEventListener('click', () => {
    const origHtml = slidesBtn.innerHTML;
    slidesBtn.disabled = true;
    slidesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    setTimeout(() => {
      try {
        openSlideDeckModal(normalizedReport);
      } catch (err) {
        showToast(err?.message || 'Unable to generate presentation slides.', 'error');
      } finally {
        slidesBtn.disabled = false;
        slidesBtn.innerHTML = origHtml;
      }
    }, 60);
  });

  // Export & Share Dropdown Popover (closes on option click, outside click, and Escape)
  const exportWrap = container.querySelector('#ixExportDropdownWrap');
  const exportTrigger = container.querySelector('#ixExportTriggerBtn');
  const exportMenu = container.querySelector('#ixExportMenu');

  const closeExportMenu = () => {
    if (!exportMenu) return;
    exportMenu.classList.remove('open');
    exportTrigger?.setAttribute('aria-expanded', 'false');
  };

  exportTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = exportMenu?.classList.toggle('open');
    exportTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  exportMenu?.querySelectorAll('[data-export]').forEach((item) => {
    item.addEventListener('click', async () => {
      const fmt = item.getAttribute('data-export');
      closeExportMenu();
      const origTriggerHtml = exportTrigger.innerHTML;
      exportTrigger.disabled = true;
      exportTrigger.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exporting...';
      try {
        await exportReport(normalizedReport, fmt);
      } catch (err) {
        showToast(err?.message || `Failed to export ${fmt.toUpperCase()}.`, 'error');
      } finally {
        if (document.body.contains(exportTrigger)) {
          exportTrigger.disabled = false;
          exportTrigger.innerHTML = origTriggerHtml;
        }
      }
    });
  });

  const onDocClick = (e) => {
    if (exportWrap && !exportWrap.contains(e.target)) {
      closeExportMenu();
    }
  };
  document.addEventListener('click', onDocClick);

  // Fullscreen Report Toggle + Escape cleanup
  const viewerRoot = container.querySelector('#ixReportViewerRoot');
  const fsBtn = container.querySelector('#ixReportFullscreenBtn');

  const setFullscreen = (enable) => {
    if (!viewerRoot || !fsBtn) return;
    viewerRoot.classList.toggle('ix-fullscreen-overlay', enable);
    if (enable) {
      viewerRoot.style.padding = 'var(--space-6)';
      viewerRoot.style.overflowY = 'auto';
      document.body.style.overflow = 'hidden';
      fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
      fsBtn.setAttribute('title', 'Exit Fullscreen (Esc)');
    } else {
      viewerRoot.style.padding = '';
      viewerRoot.style.overflowY = '';
      document.body.style.overflow = '';
      fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
      fsBtn.setAttribute('title', 'Fullscreen Report');
    }
  };

  fsBtn?.addEventListener('click', () => {
    const active = viewerRoot?.classList.contains('ix-fullscreen-overlay');
    setFullscreen(!active);
  });

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeExportMenu();
      if (viewerRoot?.classList.contains('ix-fullscreen-overlay')) {
        setFullscreen(false);
      }
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // AI Audio Briefing Controls
  const audioBtn = container.querySelector('#ixAudioBriefingBtn');
  const rateSelect = container.querySelector('#ixAudioRateSelect');

  const syncAudioBtn = (playing) => {
    if (!audioBtn) return;
    audioBtn.innerHTML = playing
      ? '<i class="fa-solid fa-stop"></i> <span>Stop Briefing</span>'
      : '<i class="fa-solid fa-headphones"></i> <span>Audio Briefing</span>';
    if (rateSelect) rateSelect.classList.toggle('ix-hidden', !playing);
  };

  audioBtn?.addEventListener('click', () => {
    if (audioController.isPlaying) {
      audioController.stop(syncAudioBtn);
    } else {
      const spokenText = container.querySelector('#ixReportProse')?.innerText || report.reportMarkdown || '';
      audioController.play(spokenText, syncAudioBtn);
    }
  });

  rateSelect?.addEventListener('change', (e) => {
    audioController.setRate(Number(e.target.value));
    if (audioController.isPlaying) {
      const spokenText = container.querySelector('#ixReportProse')?.innerText || '';
      audioController.play(spokenText, syncAudioBtn);
    }
  });

  // Gallery Lightbox triggers
  container.querySelectorAll('.ix-gallery-item').forEach((card) => {
    const open = () => {
      const idx = Number(card.getAttribute('data-img-index') || 0);
      openImageLightbox(galleryImages, idx);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  // SWOT collapsible toggle
  const swotBtn = container.querySelector('#ixToggleSwotBtn');
  const swotBody = container.querySelector('#ixSwotBody');
  swotBtn?.addEventListener('click', () => {
    const hidden = swotBody?.classList.toggle('ix-hidden');
    swotBtn.textContent = hidden ? 'Show Matrix' : 'Hide Matrix';
  });

  // Deep-dive follow-up buttons
  container.querySelectorAll('[data-deep-dive]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const promptText = btn.getAttribute('data-deep-dive') || '';
      store.updateDraftConfig({ task: promptText });
      ctx.navigate('new-research');
    });
  });

  // Table of Contents smooth scroll
  container.querySelectorAll('[data-scroll-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-scroll-id');
      const targetEl = targetId ? document.getElementById(targetId) : null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Generic internal navigation triggers inside right rail
  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => ctx.navigate(btn.getAttribute('data-nav')));
  });

  // Follow-up Chat submission
  const chatForm = container.querySelector('#ixReportChatForm');
  const chatInput = container.querySelector('#ixReportChatInput');
  const chatMessagesEl = container.querySelector('#ixReportChatMessages');
  const chatSendBtn = container.querySelector('#ixReportChatSendBtn');

  if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  chatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = (chatInput?.value || '').trim();
    if (!question) return;

    chatInput.value = '';
    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    chatSendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const userMsg = { role: 'user', content: question, timestamp: new Date().toISOString() };
    await store.appendReportChat(report.id, userMsg, null);
    if (chatMessagesEl) {
      chatMessagesEl.innerHTML = renderChatBubbles(store.getReportById(report.id)?.chatMessages || [userMsg]);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    try {
      await ctx.sendFollowUpChat(normalizedReport, question, async (assistantReply) => {
        const updated = store.getReportById(report.id);
        if (chatMessagesEl && updated) {
          chatMessagesEl.innerHTML = renderChatBubbles(updated.chatMessages || []);
          chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
        if (!assistantReply) {
          showToast('No assistant response was returned.', 'warning');
        }
      });
    } catch (err) {
      showToast(err?.message || 'Follow-up chat request failed.', 'error');
    } finally {
      if (document.body.contains(chatInput)) {
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatSendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Ask';
        chatInput.focus();
      }
    }
  });

  // Return cleanup hook so app router can remove document listeners & stop speech on view change
  return () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = '';
    audioController.stop();
  };
}

function renderSwotQuadrant(title, iconClass, colorVar, items) {
  return `
    <div class="ix-swot-quad">
      <div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:var(--text-sm); margin-bottom:8px; color:var(--text-primary);">
        <i class="fa-solid ${iconClass}" style="color:${colorVar};"></i>
        <span>${escapeHtml(title)}</span>
      </div>
      ${
        items.length === 0
          ? `<p class="ix-help" style="margin:0;">No distinct ${escapeHtml(title.toLowerCase())} extracted.</p>`
          : `<ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:5px; font-size:var(--text-xs); color:var(--text-secondary);">
              ${items.map((txt) => `<li>${escapeHtml(txt)}</li>`).join('')}
             </ul>`
      }
    </div>
  `;
}

function renderChatBubbles(messages) {
  if (!messages || messages.length === 0) {
    return `<p class="ix-help" style="margin:0;">Ask clarifications, request deeper citations, or summarize key takeaways from this report.</p>`;
  }
  return messages
    .map((m) => {
      const isUser = m.role === 'user';
      const body = isUser ? `<p style="margin:0;">${escapeHtml(m.content || '')}</p>` : markdownToHtml(m.content || '');
      return `
        <div class="ix-chat-bubble ${isUser ? 'user' : 'assistant'}">
          <div style="font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:3px;">
            ${isUser ? 'You' : 'InquireX Assistant'}
          </div>
          <div>${body}</div>
        </div>
      `;
    })
    .join('');
}
