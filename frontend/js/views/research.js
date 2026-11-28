/**
 * InquireX New Research Workspace
 * Distraction-free research configuration preserving all backend payload options,
 * topic suggestions, persona routing, document ingestion, MCP setup, and plan preview.
 */

import { store } from '../store.js';
import { escapeHtml, showToast } from '../ui.js';
import { uploadDocumentFile, deleteUploadedFile } from '../api.js';

const TOPIC_SUGGESTIONS = [
  {
    title: 'Post-Quantum Cryptography Adoption',
    prompt: 'Analyze NIST post-quantum cryptography standards (ML-KEM, ML-DSA), enterprise migration timelines, and performance trade-offs.',
    report_type: 'detailed_report',
    tone: 'Analytical',
    agent: 'Technical Lead',
  },
  {
    title: 'Agentic RAG vs Fine-Tuning',
    prompt: 'Compare agentic retrieval-augmented generation architectures against domain fine-tuning across accuracy, latency, hallucination mitigation, and cost.',
    report_type: 'research_report',
    tone: 'Comparative',
    agent: 'Academic Researcher',
  },
  {
    title: 'Solid-State Battery Commercialization',
    prompt: 'Comprehensive technical and market assessment of solid-state EV battery manufacturing breakthroughs, key industry players, and commercialization hurdles.',
    report_type: 'deep',
    tone: 'Formal',
    agent: 'Business Analyst',
  },
];

const PERSONAS = [
  { id: 'Auto Agent', icon: 'fa-wand-magic-sparkles', title: 'Auto Agent', desc: 'Dynamic backend routing based on topic domain' },
  { id: 'Business Analyst', icon: 'fa-chart-line', title: 'Business Analyst', desc: 'Market trends, competitive sizing & strategy' },
  { id: 'Academic Researcher', icon: 'fa-graduation-cap', title: 'Academic Researcher', desc: 'Literature rigor & peer-reviewed evidence' },
  { id: 'Technical Lead', icon: 'fa-code', title: 'Technical Lead', desc: 'System architecture, engineering & security' },
  { id: 'Financial Analyst', icon: 'fa-coins', title: 'Financial Analyst', desc: 'Valuation, revenue drivers & capital allocation' },
  { id: 'Quantitative Analyst', icon: 'fa-square-root-variable', title: 'Quantitative Analyst', desc: 'Statistical models & numerical benchmarks' },
];

const TONES = [
  { value: 'Objective', label: 'Objective (Impartial facts)' },
  { value: 'Analytical', label: 'Analytical (Data breakdown)' },
  { value: 'Formal', label: 'Formal (Academic rigor)' },
  { value: 'Informative', label: 'Informative (Comprehensive)' },
  { value: 'Comparative', label: 'Comparative (Methods & trade-offs)' },
  { value: 'Critical', label: 'Critical (Evidence & gaps)' },
  { value: 'Explanatory', label: 'Explanatory (Conceptual clarity)' },
  { value: 'Persuasive', label: 'Persuasive (Structured thesis)' },
  { value: 'Descriptive', label: 'Descriptive (Case examination)' },
  { value: 'Speculative', label: 'Speculative (Future scenarios)' },
];

const DEPTH_LABELS = {
  research_report: 'Summary Report (~1–2 min, focused sub-queries)',
  detailed_report: 'Detailed Report (~3–5 min, multi-section synthesis)',
  deep: 'Deep Research (iterative tree exploration)',
  resource_report: 'Resource Report (curated sources & references)',
  outline_report: 'Outline Report (structured research blueprint)',
};

const MCP_PRESETS = {
  github: {
    name: 'github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'your_github_token_here' },
  },
  tavily: {
    name: 'tavily',
    command: 'npx',
    args: ['-y', 'tavily-mcp@0.1.2'],
    env: { TAVILY_API_KEY: 'your_tavily_api_key_here' },
  },
  filesystem: {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
    env: {},
  },
};

function parseUrls(raw) {
  return String(raw || '')
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

function parseDomains(raw) {
  return String(raw || '')
    .split(',')
    .map((d) => d.trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase())
    .filter(Boolean);
}

export function renderNewResearchView(container, ctx) {
  const draft = store.state.draftConfig;

  container.innerHTML = `
    <div class="ix-view-enter ix-research-composer">
      <div class="ix-page-header" style="margin-bottom:0;">
        <div>
          <h1 class="ix-page-title">New Research</h1>
          <p class="ix-page-desc">
            Configure query scope, depth, research persona, synthesis tone, and source channels before launching autonomous execution.
          </p>
        </div>
        <div class="ix-page-actions">
          <button type="button" class="ix-btn ix-btn-secondary" id="ixTogglePlanPreviewBtn" aria-pressed="${Boolean(draft.showPlanPreview)}">
            <i class="fa-regular fa-eye"></i>
            <span id="ixTogglePlanPreviewLabel">${draft.showPlanPreview ? 'Hide Plan Preview' : 'Execution Preview'}</span>
          </button>
        </div>
      </div>

      <form id="researchForm">
        <div class="ix-prompt-box">
          <label for="task" class="sr-only">Research Question or Objective</label>
          <textarea
            id="task"
            name="task"
            class="ix-prompt-textarea"
            placeholder="What would you like to investigate? Enter a research question, hypothesis, or comparison..."
            required
          >${escapeHtml(draft.task)}</textarea>

          <div class="ix-prompt-footer">
            <div class="ix-tabs" role="tablist" aria-label="Research Depth">
              <button type="button" class="ix-tab ${draft.report_type === 'research_report' ? 'active' : ''}" data-depth="research_report" aria-selected="${draft.report_type === 'research_report'}">Summary</button>
              <button type="button" class="ix-tab ${draft.report_type === 'detailed_report' ? 'active' : ''}" data-depth="detailed_report" aria-selected="${draft.report_type === 'detailed_report'}">Detailed</button>
              <button type="button" class="ix-tab ${draft.report_type === 'deep' ? 'active' : ''}" data-depth="deep" aria-selected="${draft.report_type === 'deep'}">Deep Research</button>
              <button type="button" class="ix-tab ${draft.report_type === 'resource_report' ? 'active' : ''}" data-depth="resource_report" aria-selected="${draft.report_type === 'resource_report'}">Resources</button>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" id="ixClearTaskBtn" class="ix-btn ix-btn-ghost ix-btn-sm ${draft.task ? '' : 'ix-hidden'}" title="Clear prompt text">
                <i class="fa-solid fa-xmark"></i> Clear
              </button>
              <button type="submit" id="submitButton" class="ix-btn ix-btn-primary ix-btn-lg">
                <i class="fa-solid fa-play" style="font-size:12px;"></i>
                Start Research
              </button>
            </div>
          </div>
        </div>

        <div style="margin-top:var(--space-4);">
          <div style="font-size:var(--text-xs); font-weight:600; color:var(--text-secondary); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">
            Topic Suggestions
          </div>
          <div class="ix-suggestion-grid">
            ${TOPIC_SUGGESTIONS.map(
              (s, idx) => `
                <button type="button" class="ix-suggestion-card" data-suggestion="${idx}">
                  <span class="ix-suggestion-title">${escapeHtml(s.title)}</span>
                  <span class="ix-suggestion-desc">${escapeHtml(s.prompt.slice(0, 88))}...</span>
                </button>
              `
            ).join('')}
          </div>
        </div>

        <section class="ix-card" style="margin-top:var(--space-5);">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-solid fa-robot" style="color:var(--accent-primary);"></i> Research Persona</h2>
            <span class="ix-badge ix-badge-accent" id="ixActivePersonaBadge">${escapeHtml(draft.agent || 'Auto Agent')}</span>
          </div>
          <div class="ix-card-body">
            <div class="ix-persona-grid">
              ${PERSONAS.map(
                (p) => `
                  <button
                    type="button"
                    class="ix-persona-option ${draft.agent === p.id ? 'active' : ''}"
                    data-persona="${escapeHtml(p.id)}"
                    aria-pressed="${draft.agent === p.id}"
                  >
                    <div style="display:flex; align-items:center; gap:8px; font-weight:600; font-size:var(--text-sm); color:var(--text-primary);">
                      <i class="fa-solid ${p.icon}" style="color:var(--accent-primary);"></i>
                      <span>${escapeHtml(p.title)}</span>
                    </div>
                    <div class="ix-help">${escapeHtml(p.desc)}</div>
                  </button>
                `
              ).join('')}
            </div>
          </div>
        </section>

        <section class="ix-card" style="margin-top:var(--space-5);">
          <div class="ix-card-header">
            <h2 class="ix-card-title"><i class="fa-solid fa-sliders"></i> Research Configuration</h2>
            <span class="ix-help">All selections apply directly to the backend execution run</span>
          </div>
          <div class="ix-card-body">
            <div class="ix-config-grid">
              <div class="ix-field">
                <label class="ix-label" for="report_type">Report Blueprint</label>
                <select id="report_type" name="report_type" class="ix-select">
                  <option value="research_report" ${draft.report_type === 'research_report' ? 'selected' : ''}>Summary Report (~2 min)</option>
                  <option value="detailed_report" ${draft.report_type === 'detailed_report' ? 'selected' : ''}>Detailed Report (~5 min)</option>
                  <option value="deep" ${draft.report_type === 'deep' ? 'selected' : ''}>Deep Research (Multi-hop)</option>
                  <option value="resource_report" ${draft.report_type === 'resource_report' ? 'selected' : ''}>Resource Report (Sources)</option>
                  <option value="outline_report" ${draft.report_type === 'outline_report' ? 'selected' : ''}>Outline Report</option>
                </select>
              </div>

              <div class="ix-field">
                <label class="ix-label" for="tone">Writing Tone</label>
                <select id="tone" name="tone" class="ix-select">
                  ${TONES.map(
                    (t) => `<option value="${t.value}" ${draft.tone === t.value ? 'selected' : ''}>${escapeHtml(t.label)}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="ix-field">
                <label class="ix-label" for="report_source">Search &amp; Data Source</label>
                <select id="report_source" name="report_source" class="ix-select">
                  <option value="web" ${draft.report_source === 'web' ? 'selected' : ''}>Web Search (Live Multi-Engine)</option>
                  <option value="local" ${draft.report_source === 'local' ? 'selected' : ''}>My Documents (Private RAG)</option>
                  <option value="hybrid" ${draft.report_source === 'hybrid' ? 'selected' : ''}>Hybrid (Web + Local Docs)</option>
                  <option value="sources" ${draft.report_source === 'sources' ? 'selected' : ''}>Specific URLs (Custom Links)</option>
                  <option value="azure" ${draft.report_source === 'azure' ? 'selected' : ''}>Azure Blob Storage</option>
                </select>
              </div>
            </div>

            <div class="ix-config-row-2">
              <div class="ix-field">
                <label class="ix-label" for="maxSearchResults">Max Sources per Query</label>
                <input id="maxSearchResults" name="max_search_results" type="number" min="1" max="20" value="${Number(draft.max_search_results) || 5}" class="ix-input" />
                <span class="ix-help">Between 1 and 20 sites per sub-query</span>
              </div>

              <div class="ix-field">
                <label class="ix-label" for="queryDomains">Restrict / Prioritize Domains (Optional)</label>
                <input id="queryDomains" name="query_domains" type="text" value="${escapeHtml(draft.query_domains)}" placeholder="e.g. arxiv.org, nature.com, github.com" class="ix-input" />
                <span class="ix-help">Comma-separated domains passed to search retrievers</span>
              </div>
            </div>

            <div id="ixSourceUrlsWrap" class="ix-field ${draft.report_source === 'sources' ? '' : 'ix-hidden'}" style="margin-top:var(--space-4);">
              <label class="ix-label" for="ixSourceUrls">Specific URLs</label>
              <input id="ixSourceUrls" type="text" value="${escapeHtml(draft.source_urls)}" placeholder="https://example.com/article1, https://example.com/article2" class="ix-input" />
              <span class="ix-help">Comma- or newline-separated URLs to scrape directly</span>
            </div>

            <div id="ixLocalDocsWrap" class="${draft.report_source === 'local' || draft.report_source === 'hybrid' ? '' : 'ix-hidden'}" style="margin-top:var(--space-5); padding-top:var(--space-4); border-top:1px solid var(--border-subtle);">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <span class="ix-label" id="ixLocalDocsLabel">Private RAG Documents (${(store.state.files || []).length} indexed)</span>
                <button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-nav="documents">Open Document Manager</button>
              </div>
              <div class="ix-dropzone" id="ixInlineDropzone">
                <i class="fa-solid fa-cloud-arrow-up" style="font-size:20px; color:var(--accent-primary);"></i>
                <p style="margin-top:6px; font-size:var(--text-sm); font-weight:500;">Click to upload or drop files here</p>
                <p class="ix-help">PDF, DOCX, TXT, MD, CSV, PPTX</p>
                <input type="file" id="ixInlineFileInput" multiple accept=".pdf,.docx,.txt,.md,.csv,.pptx" class="ix-hidden" />
              </div>
              <div id="ixInlineFilesList" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;"></div>
            </div>

            <div style="margin-top:var(--space-5); padding-top:var(--space-4); border-top:1px solid var(--border-subtle);">
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <label class="ix-switch">
                  <input type="checkbox" id="mcpEnabled" ${draft.mcp_enabled ? 'checked' : ''} />
                  <span class="ix-switch-track"></span>
                  <span style="font-size:var(--text-sm); font-weight:500;">Enable Model Context Protocol (MCP) Tools</span>
                </label>
                <span class="ix-help">Default output formats: Markdown + DOCX + PDF exports</span>
              </div>

              <div id="ixMcpPanel" class="${draft.mcp_enabled ? '' : 'ix-hidden'}" style="margin-top:var(--space-4); display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:space-between;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="ix-help" style="font-weight:600;">Presets:</span>
                    <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-mcp-preset="github"><i class="fa-brands fa-github"></i> GitHub</button>
                    <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-mcp-preset="tavily"><i class="fa-solid fa-magnifying-glass"></i> Tavily</button>
                    <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-mcp-preset="filesystem"><i class="fa-regular fa-folder"></i> Filesystem</button>
                    <button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" id="ixFormatMcpBtn"><i class="fa-solid fa-code"></i> Format JSON</button>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <label class="ix-label" for="mcpStrategy" style="margin:0;">Strategy:</label>
                    <select id="mcpStrategy" class="ix-select" style="width:auto; height:30px; font-size:var(--text-xs);">
                      <option value="fast" ${draft.mcp_strategy === 'fast' ? 'selected' : ''}>Fast (Primary query)</option>
                      <option value="deep" ${draft.mcp_strategy === 'deep' ? 'selected' : ''}>Deep (Every sub-query)</option>
                    </select>
                  </div>
                </div>
                <div class="ix-field">
                  <label class="ix-label" for="mcpConfig">MCP Servers JSON Array</label>
                  <textarea id="mcpConfig" rows="5" class="ix-textarea ix-mono" style="font-size:12px;">${escapeHtml(draft.mcp_config)}</textarea>
                  <span id="ixMcpValidation" class="ix-help"></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ixPlanPreviewWrap" class="ix-plan-preview-box ${draft.showPlanPreview ? '' : 'ix-hidden'}" style="margin-top:var(--space-5);"></section>
      </form>
    </div>
  `;

  const taskEl = container.querySelector('#task');
  const reportTypeEl = container.querySelector('#report_type');
  const toneEl = container.querySelector('#tone');
  const sourceEl = container.querySelector('#report_source');
  const maxSourcesEl = container.querySelector('#maxSearchResults');
  const domainsEl = container.querySelector('#queryDomains');
  const sourceUrlsEl = container.querySelector('#ixSourceUrls');
  const sourceUrlsWrap = container.querySelector('#ixSourceUrlsWrap');
  const localDocsWrap = container.querySelector('#ixLocalDocsWrap');
  const localDocsLabel = container.querySelector('#ixLocalDocsLabel');
  const filesListEl = container.querySelector('#ixInlineFilesList');
  const mcpEnabledEl = container.querySelector('#mcpEnabled');
  const mcpPanelEl = container.querySelector('#ixMcpPanel');
  const mcpStrategyEl = container.querySelector('#mcpStrategy');
  const mcpEl = container.querySelector('#mcpConfig');
  const mcpStatusEl = container.querySelector('#ixMcpValidation');
  const personaBadgeEl = container.querySelector('#ixActivePersonaBadge');
  const previewBtnEl = container.querySelector('#ixTogglePlanPreviewBtn');
  const previewBtnLabelEl = container.querySelector('#ixTogglePlanPreviewLabel');
  const previewWrapEl = container.querySelector('#ixPlanPreviewWrap');

  const autoResize = () => {
    if (!taskEl) return;
    taskEl.style.height = 'auto';
    taskEl.style.height = `${Math.max(84, taskEl.scrollHeight)}px`;
  };
  autoResize();

  const validateMcp = () => {
    if (!mcpEl || !mcpStatusEl) return true;
    try {
      const parsed = JSON.parse(mcpEl.value.trim() || '[]');
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
      mcpStatusEl.textContent = `Valid JSON (${parsed.length} server${parsed.length === 1 ? '' : 's'})`;
      mcpStatusEl.style.color = 'var(--status-success)';
      return true;
    } catch (err) {
      mcpStatusEl.textContent = `Invalid JSON: ${err.message}`;
      mcpStatusEl.style.color = 'var(--status-error)';
      return false;
    }
  };

  const renderFilesList = () => {
    const files = store.state.files || [];
    if (localDocsLabel) {
      localDocsLabel.textContent = `Private RAG Documents (${files.length} indexed)`;
    }
    if (!filesListEl) return;
    if (files.length === 0) {
      filesListEl.innerHTML = `<span class="ix-help">No documents uploaded yet.</span>`;
      return;
    }
    filesListEl.innerHTML = files
      .map(
        (fn) => `
          <span class="ix-badge">
            <i class="fa-regular fa-file-lines"></i>
            ${escapeHtml(fn)}
            <button type="button" data-del-file="${escapeHtml(fn)}" style="border:none;background:none;padding:0 2px;color:var(--text-secondary);cursor:pointer;" title="Remove file">&times;</button>
          </span>`
      )
      .join('');
    filesListEl.querySelectorAll('[data-del-file]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await deleteUploadedFile(btn.getAttribute('data-del-file'));
          await store.loadFiles();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  };

  const renderPlanPreview = () => {
    if (!previewWrapEl) return;
    const d = store.state.draftConfig;
    const isVisible = Boolean(d.showPlanPreview);
    previewWrapEl.classList.toggle('ix-hidden', !isVisible);
    if (previewBtnEl) previewBtnEl.setAttribute('aria-pressed', String(isVisible));
    if (previewBtnLabelEl) {
      previewBtnLabelEl.textContent = isVisible ? 'Hide Plan Preview' : 'Execution Preview';
    }
    if (!isVisible) return;

    const domains = parseDomains(d.query_domains);
    const urls = parseUrls(d.source_urls);
    previewWrapEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <span style="font-weight:600; font-size:var(--text-sm);"><i class="fa-solid fa-list-check" style="color:var(--accent-primary);"></i> Pre-Run Execution Preview</span>
        <span class="ix-badge ix-badge-accent">WS /ws Payload Ready</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:10px; font-size:var(--text-xs); color:var(--text-secondary);">
        <div><strong style="color:var(--text-primary);">Strategy:</strong> ${escapeHtml(DEPTH_LABELS[d.report_type] || d.report_type)}</div>
        <div><strong style="color:var(--text-primary);">Data Source:</strong> ${escapeHtml((d.report_source || 'web').toUpperCase())} (${Number(d.max_search_results) || 5} sources/query)${
          d.report_source === 'sources' ? ` &bull; ${urls.length} URL${urls.length === 1 ? '' : 's'}` : ''
        }</div>
        <div><strong style="color:var(--text-primary);">Tone &amp; Persona:</strong> ${escapeHtml(d.tone)} &bull; ${escapeHtml(d.agent)}</div>
        <div><strong style="color:var(--text-primary);">MCP Tools:</strong> ${d.mcp_enabled ? `Enabled (${escapeHtml(d.mcp_strategy || 'fast')})` : 'Disabled'}${
          domains.length ? ` &bull; Domains: ${escapeHtml(domains.join(', '))}` : ''
        }</div>
      </div>
    `;
  };

  const clearTaskBtnEl = container.querySelector('#ixClearTaskBtn');

  const syncUiFromDraft = (reason = 'draft') => {
    const d = store.state.draftConfig;

    if (taskEl && document.activeElement !== taskEl && taskEl.value !== (d.task || '')) {
      taskEl.value = d.task || '';
      autoResize();
    }
    clearTaskBtnEl?.classList.toggle('ix-hidden', !(taskEl?.value || '').trim());

    container.querySelectorAll('[data-depth]').forEach((btn) => {
      const isMatch = btn.getAttribute('data-depth') === d.report_type;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
    });

    if (reportTypeEl && reportTypeEl.value !== d.report_type) {
      reportTypeEl.value = d.report_type || 'research_report';
    }
    if (toneEl && toneEl.value !== d.tone) {
      toneEl.value = d.tone || 'Objective';
    }
    if (sourceEl && sourceEl.value !== d.report_source) {
      sourceEl.value = d.report_source || 'web';
    }
    if (maxSourcesEl && document.activeElement !== maxSourcesEl) {
      maxSourcesEl.value = String(Number(d.max_search_results) || 5);
    }
    if (domainsEl && document.activeElement !== domainsEl && domainsEl.value !== (d.query_domains || '')) {
      domainsEl.value = d.query_domains || '';
    }
    if (sourceUrlsEl && document.activeElement !== sourceUrlsEl && sourceUrlsEl.value !== (d.source_urls || '')) {
      sourceUrlsEl.value = d.source_urls || '';
    }

    container.querySelectorAll('[data-persona]').forEach((btn) => {
      const active = btn.getAttribute('data-persona') === d.agent;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (personaBadgeEl) {
      personaBadgeEl.textContent = d.agent || 'Auto Agent';
    }

    sourceUrlsWrap?.classList.toggle('ix-hidden', d.report_source !== 'sources');
    const showDocs = d.report_source === 'local' || d.report_source === 'hybrid';
    localDocsWrap?.classList.toggle('ix-hidden', !showDocs);
    if (showDocs || reason === 'files') {
      renderFilesList();
    }

    if (mcpEnabledEl) mcpEnabledEl.checked = Boolean(d.mcp_enabled);
    mcpPanelEl?.classList.toggle('ix-hidden', !d.mcp_enabled);
    if (mcpStrategyEl && mcpStrategyEl.value !== (d.mcp_strategy || 'fast')) {
      mcpStrategyEl.value = d.mcp_strategy || 'fast';
    }
    if (mcpEl && document.activeElement !== mcpEl && mcpEl.value !== (d.mcp_config || '[]')) {
      mcpEl.value = d.mcp_config || '[]';
    }
    if (d.mcp_enabled) {
      validateMcp();
    }

    renderPlanPreview();
  };

  // Initial sync (including local docs list & validation)
  syncUiFromDraft('init');

  // Re-sync UI whenever draft/files/preferences update (e.g. Companion action or upload)
  const unsubscribe = store.subscribe((_state, reason) => {
    if (reason === 'draft' || reason === 'files' || reason === 'preferences') {
      syncUiFromDraft(reason);
    }
  });

  taskEl?.addEventListener('input', () => {
    autoResize();
    store.state.draftConfig.task = taskEl.value;
    clearTaskBtnEl?.classList.toggle('ix-hidden', !taskEl.value.trim());
  });

  clearTaskBtnEl?.addEventListener('click', () => {
    if (taskEl) taskEl.value = '';
    store.updateDraftConfig({ task: '' });
    autoResize();
    taskEl?.focus();
  });

  container.querySelector('#ixTogglePlanPreviewBtn')?.addEventListener('click', () => {
    store.updateDraftConfig({ showPlanPreview: !store.state.draftConfig.showPlanPreview });
  });

  container.querySelectorAll('[data-depth]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.updateDraftConfig({ report_type: btn.getAttribute('data-depth') });
    });
  });

  container.querySelectorAll('[data-suggestion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = TOPIC_SUGGESTIONS[Number(btn.getAttribute('data-suggestion'))];
      if (!s) return;
      store.updateDraftConfig({
        task: s.prompt,
        report_type: s.report_type,
        tone: s.tone,
        agent: s.agent || 'Auto Agent',
      });
    });
  });

  container.querySelectorAll('[data-persona]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const persona = btn.getAttribute('data-persona');
      store.updateDraftConfig({ agent: persona });
    });
  });

  reportTypeEl?.addEventListener('change', (e) => {
    store.updateDraftConfig({ report_type: e.target.value });
  });
  toneEl?.addEventListener('change', (e) => {
    store.updateDraftConfig({ tone: e.target.value });
  });
  sourceEl?.addEventListener('change', (e) => {
    const val = e.target.value;
    store.updateDraftConfig({ report_source: val });
    if (val === 'local' || val === 'hybrid') store.loadFiles();
  });
  maxSourcesEl?.addEventListener('input', (e) => {
    store.state.draftConfig.max_search_results = Math.max(1, Math.min(20, Number(e.target.value) || 5));
    renderPlanPreview();
  });
  domainsEl?.addEventListener('input', (e) => {
    store.state.draftConfig.query_domains = e.target.value;
    renderPlanPreview();
  });
  sourceUrlsEl?.addEventListener('input', (e) => {
    store.state.draftConfig.source_urls = e.target.value;
    renderPlanPreview();
  });
  mcpEnabledEl?.addEventListener('change', (e) => {
    store.updateDraftConfig({ mcp_enabled: e.target.checked });
  });
  mcpStrategyEl?.addEventListener('change', (e) => {
    store.updateDraftConfig({ mcp_strategy: e.target.value });
  });

  if (mcpEl) {
    mcpEl.addEventListener('input', () => {
      store.state.draftConfig.mcp_config = mcpEl.value;
      validateMcp();
      renderPlanPreview();
    });
  }

  container.querySelector('#ixFormatMcpBtn')?.addEventListener('click', () => {
    if (!mcpEl) return;
    try {
      const parsed = JSON.parse(mcpEl.value.trim() || '[]');
      mcpEl.value = JSON.stringify(parsed, null, 2);
      store.state.draftConfig.mcp_config = mcpEl.value;
      validateMcp();
    } catch {
      showToast('Fix JSON syntax errors before formatting.', 'error');
    }
  });

  container.querySelectorAll('[data-mcp-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = MCP_PRESETS[btn.getAttribute('data-mcp-preset')];
      if (!preset) return;
      let arr = [];
      try {
        arr = JSON.parse(store.state.draftConfig.mcp_config || '[]');
        if (!Array.isArray(arr)) arr = [];
      } catch {
        arr = [];
      }
      const existing = arr.findIndex((s) => s.name === preset.name);
      if (existing >= 0) arr[existing] = preset;
      else arr.push(preset);
      store.updateDraftConfig({ mcp_config: JSON.stringify(arr, null, 2) });
      showToast(`Added ${preset.name} MCP preset.`, 'success');
    });
  });

  // Inline File Upload Handlers
  const dropzone = container.querySelector('#ixInlineDropzone');
  const fileInput = container.querySelector('#ixInlineFileInput');
  const handleFiles = async (fileList) => {
    for (const f of Array.from(fileList)) {
      try {
        await uploadDocumentFile(f);
        showToast(`Uploaded ${f.name}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    await store.loadFiles();
  };
  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });
  fileInput?.addEventListener('change', () => {
    if (fileInput.files?.length) handleFiles(fileInput.files);
  });

  container.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate(el.getAttribute('data-nav')));
  });

  container.querySelector('#researchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const task = (taskEl?.value || '').trim();
    if (!task) {
      showToast('Please enter a research topic first.', 'warning');
      taskEl?.focus();
      return;
    }

    const reportSource = sourceEl?.value || store.state.draftConfig.report_source || 'web';
    const parsedSourceUrls = reportSource === 'sources' ? parseUrls(sourceUrlsEl?.value || store.state.draftConfig.source_urls) : [];
    if (reportSource === 'sources' && parsedSourceUrls.length === 0) {
      showToast('Please enter at least one URL under Specific URLs.', 'warning');
      sourceUrlsEl?.focus();
      return;
    }

    let mcpConfigs = [];
    const mcpEnabled = Boolean(mcpEnabledEl ? mcpEnabledEl.checked : store.state.draftConfig.mcp_enabled);
    if (mcpEnabled) {
      if (!validateMcp()) {
        showToast('Please fix invalid MCP JSON before starting.', 'error');
        return;
      }
      try {
        mcpConfigs = JSON.parse((mcpEl?.value || store.state.draftConfig.mcp_config || '[]').trim() || '[]');
      } catch {}
    }

    const reportType = reportTypeEl?.value || store.state.draftConfig.report_type || 'research_report';
    const tone = toneEl?.value || store.state.draftConfig.tone || 'Objective';
    const maxResults = Math.max(1, Math.min(20, Number(maxSourcesEl?.value || store.state.draftConfig.max_search_results) || 5));
    const queryDomains = parseDomains(domainsEl?.value || store.state.draftConfig.query_domains);
    const mcpStrategy = mcpStrategyEl?.value || store.state.draftConfig.mcp_strategy || 'fast';
    const agent = store.state.draftConfig.agent || 'Auto Agent';

    // Sync final submitted values back into draftConfig
    store.state.draftConfig.task = task;
    store.state.draftConfig.report_type = reportType;
    store.state.draftConfig.report_source = reportSource;
    store.state.draftConfig.tone = tone;
    store.state.draftConfig.max_search_results = maxResults;
    store.state.draftConfig.mcp_enabled = mcpEnabled;
    store.state.draftConfig.mcp_strategy = mcpStrategy;

    const payload = {
      task,
      report_type: reportType,
      report_source: reportSource,
      source_urls: parsedSourceUrls,
      tone,
      agent,
      query_domains: queryDomains,
      max_search_results: maxResults,
      mcp_enabled: mcpEnabled,
      mcp_strategy: mcpStrategy,
      mcp_configs: mcpConfigs,
    };

    ctx.startResearch(payload);
  });

  return () => unsubscribe();
}
