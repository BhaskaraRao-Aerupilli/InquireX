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
  },
  {
    title: 'Agentic RAG vs Fine-Tuning',
    prompt: 'Compare agentic retrieval-augmented generation architectures against domain fine-tuning across accuracy, latency, hallucination mitigation, and cost.',
    report_type: 'research_report',
    tone: 'Comparative',
  },
  {
    title: 'Solid-State Battery Commercialization',
    prompt: 'Comprehensive technical and market assessment of solid-state EV battery manufacturing breakthroughs, key industry players, and 2026 commercialization hurdles.',
    report_type: 'deep',
    tone: 'Formal',
  },
];

const PERSONAS = [
  { id: 'Auto Agent', icon: 'fa-wand-magic-sparkles', title: 'Auto Agent', desc: 'Dynamic backend routing based on topic domain' },
  { id: 'Business Analyst', icon: 'fa-chart-line', title: 'Business Analyst', desc: 'Market trends, competitive sizing & strategy' },
  { id: 'Academic Researcher', icon: 'fa-graduation-cap', title: 'Academic Researcher', desc: 'Literature rigor & peer-reviewed evidence' },
  { id: 'Technical Lead', icon: 'fa-code', title: 'Technical Lead', desc: 'System architecture & engineering trade-offs' },
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

export function renderNewResearchView(container, ctx) {
  const draft = store.state.draftConfig;
  const files = store.state.files || [];
  const showUpload = draft.report_source === 'local' || draft.report_source === 'hybrid';
  const showSourceUrls = draft.report_source === 'sources';

  const depthLabels = {
    research_report: 'Summary Report (~1–2 min, focused sub-queries)',
    detailed_report: 'Detailed Report (~3–5 min, multi-section synthesis)',
    deep: 'Deep Research (iterative tree exploration)',
    resource_report: 'Resource Report (curated sources & references)',
    outline_report: 'Outline Report (structured research blueprint)',
  };

  container.innerHTML = `
    <div class="ix-view-enter ix-research-composer">
      <div class="ix-page-header" style="margin-bottom:0;">
        <div>
          <h1 class="ix-page-title">New Research</h1>
          <p class="ix-page-desc">
            Configure query scope, depth, synthesis tone, and source channels before launching autonomous execution.
          </p>
        </div>
        <div class="ix-page-actions">
          <button type="button" class="ix-btn ix-btn-secondary" id="ixTogglePlanPreviewBtn">
            <i class="fa-regular fa-eye"></i>
            ${draft.showPlanPreview ? 'Hide Plan Preview' : 'Execution Preview'}
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
              <button type="button" class="ix-tab ${draft.report_type === 'research_report' ? 'active' : ''}" data-depth="research_report">Summary</button>
              <button type="button" class="ix-tab ${draft.report_type === 'detailed_report' ? 'active' : ''}" data-depth="detailed_report">Detailed</button>
              <button type="button" class="ix-tab ${draft.report_type === 'deep' ? 'active' : ''}" data-depth="deep">Deep Research</button>
              <button type="button" class="ix-tab ${draft.report_type === 'resource_report' ? 'active' : ''}" data-depth="resource_report">Resources</button>
            </div>

            <button type="submit" id="submitButton" class="ix-btn ix-btn-primary ix-btn-lg">
              <i class="fa-solid fa-play" style="font-size:12px;"></i>
              Start Research
            </button>
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
            <span class="ix-help">Guides framing &amp; analytical perspective</span>
          </div>
          <div class="ix-card-body">
            <div class="ix-persona-grid">
              ${PERSONAS.map(
                (p) => `
                  <button type="button" class="ix-persona-option ${draft.agent === p.id ? 'active' : ''}" data-persona="${escapeHtml(p.id)}">
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

            ${
              showSourceUrls
                ? `<div class="ix-field" style="margin-top:var(--space-4);">
                     <label class="ix-label" for="ixSourceUrls">Specific URLs</label>
                     <input id="ixSourceUrls" type="text" value="${escapeHtml(draft.source_urls)}" placeholder="https://example.com/article1, https://example.com/article2" class="ix-input" />
                   </div>`
                : ''
            }

            ${
              showUpload
                ? `<div style="margin-top:var(--space-5); padding-top:var(--space-4); border-top:1px solid var(--border-subtle);">
                     <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                       <span class="ix-label">Private RAG Documents (${files.length} indexed)</span>
                       <button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-nav="documents">Open Document Manager</button>
                     </div>
                     <div class="ix-dropzone" id="ixInlineDropzone">
                       <i class="fa-solid fa-cloud-arrow-up" style="font-size:20px; color:var(--accent-primary);"></i>
                       <p style="margin-top:6px; font-size:var(--text-sm); font-weight:500;">Click to upload or drop files here</p>
                       <p class="ix-help">PDF, DOCX, TXT, MD, CSV, PPTX</p>
                       <input type="file" id="ixInlineFileInput" multiple accept=".pdf,.docx,.txt,.md,.csv,.pptx" class="ix-hidden" />
                     </div>
                     ${
                       files.length > 0
                         ? `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
                             ${files
                               .map(
                                 (fn) => `
                                   <span class="ix-badge">
                                     <i class="fa-regular fa-file-lines"></i>
                                     ${escapeHtml(fn)}
                                     <button type="button" data-del-file="${escapeHtml(fn)}" style="border:none;background:none;padding:0 2px;color:var(--text-secondary);" title="Remove file">&times;</button>
                                   </span>`
                               )
                               .join('')}
                            </div>`
                         : ''
                     }
                   </div>`
                : ''
            }

            <div style="margin-top:var(--space-5); padding-top:var(--space-4); border-top:1px solid var(--border-subtle);">
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <label class="ix-switch">
                  <input type="checkbox" id="mcpEnabled" ${draft.mcp_enabled ? 'checked' : ''} />
                  <span class="ix-switch-track"></span>
                  <span style="font-size:var(--text-sm); font-weight:500;">Enable Model Context Protocol (MCP) Tools</span>
                </label>
                <span class="ix-help">Default server format: Markdown + DOCX + PDF exports</span>
              </div>

              ${
                draft.mcp_enabled
                  ? `<div style="margin-top:var(--space-4); display:flex; flex-direction:column; gap:12px;">
                       <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                         <span class="ix-help" style="font-weight:600;">Presets:</span>
                         <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-mcp-preset="github"><i class="fa-brands fa-github"></i> GitHub</button>
                         <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-mcp-preset="tavily"><i class="fa-solid fa-magnifying-glass"></i> Tavily</button>
                         <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-mcp-preset="filesystem"><i class="fa-regular fa-folder"></i> Filesystem</button>
                         <button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" id="ixFormatMcpBtn"><i class="fa-solid fa-code"></i> Format JSON</button>
                       </div>
                       <div class="ix-field">
                         <label class="ix-label" for="mcpConfig">MCP Servers JSON Array</label>
                         <textarea id="mcpConfig" rows="5" class="ix-textarea ix-mono" style="font-size:12px;">${escapeHtml(draft.mcp_config)}</textarea>
                         <span id="ixMcpValidation" class="ix-help"></span>
                       </div>
                     </div>`
                  : ''
              }
            </div>
          </div>
        </section>

        ${
          draft.showPlanPreview
            ? `<section class="ix-plan-preview-box" style="margin-top:var(--space-5);">
                 <div style="display:flex; align-items:center; justify-content:space-between;">
                   <span style="font-weight:600; font-size:var(--text-sm);"><i class="fa-solid fa-list-check" style="color:var(--accent-primary);"></i> Pre-Run Execution Preview</span>
                   <span class="ix-badge ix-badge-accent">WS /ws Payload Ready</span>
                 </div>
                 <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; font-size:var(--text-xs); color:var(--text-secondary);">
                   <div><strong style="color:var(--text-primary);">Strategy:</strong> ${escapeHtml(depthLabels[draft.report_type] || draft.report_type)}</div>
                   <div><strong style="color:var(--text-primary);">Data Source:</strong> ${escapeHtml(draft.report_source.toUpperCase())} (${draft.max_search_results} sources/query)</div>
                   <div><strong style="color:var(--text-primary);">Tone &amp; Persona:</strong> ${escapeHtml(draft.tone)} &bull; ${escapeHtml(draft.agent)}</div>
                   <div><strong style="color:var(--text-primary);">MCP Tools:</strong> ${draft.mcp_enabled ? 'Enabled' : 'Disabled'}</div>
                 </div>
               </section>`
            : ''
        }
      </form>
    </div>
  `;

  const taskEl = container.querySelector('#task');
  const autoResize = () => {
    if (!taskEl) return;
    taskEl.style.height = 'auto';
    taskEl.style.height = `${Math.max(84, taskEl.scrollHeight)}px`;
  };
  autoResize();

  taskEl?.addEventListener('input', () => {
    autoResize();
    store.state.draftConfig.task = taskEl.value;
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
      });
    });
  });

  container.querySelectorAll('[data-persona]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.updateDraftConfig({ agent: btn.getAttribute('data-persona') });
    });
  });

  container.querySelector('#report_type')?.addEventListener('change', (e) => {
    store.updateDraftConfig({ report_type: e.target.value });
  });
  container.querySelector('#tone')?.addEventListener('change', (e) => {
    store.updateDraftConfig({ tone: e.target.value });
  });
  container.querySelector('#report_source')?.addEventListener('change', (e) => {
    store.updateDraftConfig({ report_source: e.target.value });
    if (e.target.value === 'local' || e.target.value === 'hybrid') store.loadFiles();
  });
  container.querySelector('#maxSearchResults')?.addEventListener('input', (e) => {
    store.state.draftConfig.max_search_results = Math.max(1, Math.min(20, Number(e.target.value) || 5));
  });
  container.querySelector('#queryDomains')?.addEventListener('input', (e) => {
    store.state.draftConfig.query_domains = e.target.value;
  });
  container.querySelector('#mcpEnabled')?.addEventListener('change', (e) => {
    store.updateDraftConfig({ mcp_enabled: e.target.checked });
  });

  const mcpEl = container.querySelector('#mcpConfig');
  const mcpStatusEl = container.querySelector('#ixMcpValidation');
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
  if (mcpEl) {
    validateMcp();
    mcpEl.addEventListener('input', () => {
      store.state.draftConfig.mcp_config = mcpEl.value;
      validateMcp();
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
  container.querySelectorAll('[data-del-file]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await deleteUploadedFile(btn.getAttribute('data-del-file'));
        await store.loadFiles();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
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

    let mcpConfigs = [];
    if (store.state.draftConfig.mcp_enabled) {
      if (!validateMcp()) {
        showToast('Please fix invalid MCP JSON before starting.', 'error');
        return;
      }
      try {
        mcpConfigs = JSON.parse(store.state.draftConfig.mcp_config || '[]');
      } catch {}
    }

    const queryDomains = (store.state.draftConfig.query_domains || '')
      .split(',')
      .map((d) => d.trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase())
      .filter(Boolean);

    const payload = {
      task,
      report_type: store.state.draftConfig.report_type,
      report_source: store.state.draftConfig.report_source,
      source_urls: [],
      tone: store.state.draftConfig.tone,
      agent: store.state.draftConfig.agent,
      query_domains: queryDomains,
      max_search_results: Number(store.state.draftConfig.max_search_results) || 5,
      mcp_enabled: Boolean(store.state.draftConfig.mcp_enabled),
      mcp_strategy: store.state.draftConfig.mcp_strategy || 'fast',
      mcp_configs: mcpConfigs,
    };

    ctx.startResearch(payload);
  });
}
