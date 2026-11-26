/**
 * InquireX Report Intelligence & Post-Processing
 * Extracts genuine metrics, headings ToC, verified citation ledgers,
 * SWOT points, exploration vectors, and theme-aware Mermaid concept graphs.
 */

import { escapeHtml } from './ui.js';
import { resolveTheme } from './theme.js';

export function extractReportMetrics(reportHtml, reportMarkdown = '', sessionMetrics = {}) {
  const tmp = document.createElement('div');
  tmp.innerHTML = reportHtml || '';

  const clone = tmp.cloneNode(true);
  clone.querySelectorAll('script, style, button, svg, img, noscript').forEach((el) => el.remove());
  const rawText = (clone.textContent || clone.innerText || '').trim();
  const cleanWords = rawText
    .replace(/[#*_`|~>\-=+[\](){}:;]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9\u00C0-\u024F\u4E00-\u9FFF]/.test(w));

  const wordCount = cleanWords.length;
  const readTimeMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 240)) : 0;

  const citations = extractCitations(tmp, reportMarkdown);
  const h2s = Array.from(tmp.querySelectorAll('h2'));
  const metaKeywords = ['reference', 'source', 'bibliography', 'table of content', 'contents', 'conclusion', 'introduction', 'overview', 'summary'];
  const corePillars = h2s.filter((h) => {
    const t = (h.textContent || '').trim().toLowerCase();
    return t && !metaKeywords.some((k) => t.includes(k));
  }).length;

  return {
    wordCount,
    readTimeMinutes,
    citationsCount: citations.length,
    corePillars: corePillars || h2s.length,
    scrapedCount: sessionMetrics.scrapedCount || 0,
    subqueriesCount: sessionMetrics.subqueriesCount || 0,
    elapsedSec: sessionMetrics.elapsedSec || 0,
    citations,
  };
}

export function extractCitations(rootElementOrHtml, rawMarkdown = '') {
  let root = rootElementOrHtml;
  if (typeof rootElementOrHtml === 'string') {
    root = document.createElement('div');
    root.innerHTML = rootElementOrHtml;
  }

  const byUrl = new Map();
  if (root) {
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = (a.getAttribute('href') || '').trim();
      if (/^https?:\/\//i.test(href)) {
        const normalized = href.replace(/\/+$/, '');
        let domain = '';
        try {
          domain = new URL(normalized).hostname.replace(/^www\./, '');
        } catch {}
        if (!byUrl.has(normalized)) {
          byUrl.set(normalized, {
            url: normalized,
            title: (a.textContent || '').trim() || domain || normalized,
            domain,
          });
        }
      }
    });
  }

  if (rawMarkdown) {
    const urlRegex = /https?:\/\/[^\s)\]"'<>]+/gi;
    let m;
    while ((m = urlRegex.exec(rawMarkdown)) !== null) {
      const normalized = m[0].replace(/[.,;)]+$/, '').replace(/\/+$/, '');
      if (!byUrl.has(normalized)) {
        let domain = '';
        try {
          domain = new URL(normalized).hostname.replace(/^www\./, '');
        } catch {}
        byUrl.set(normalized, {
          url: normalized,
          title: domain || normalized,
          domain,
        });
      }
    }
  }

  return Array.from(byUrl.values());
}

export function extractTableOfContents(containerEl) {
  if (!containerEl) return [];
  const headings = Array.from(containerEl.querySelectorAll('h1, h2, h3'));
  return headings
    .map((h, idx) => {
      const text = (h.textContent || '').trim();
      if (!text) return null;
      if (!h.id) {
        h.id = `ix-sec-${idx}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`;
      }
      return {
        id: h.id,
        text,
        level: Number(h.tagName.slice(1)),
      };
    })
    .filter(Boolean);
}

export function extractKnowledgeGraphData(topic, reportHtml) {
  const cleanLabel = (str, maxLen = 36) => {
    const cleaned = String(str || 'Concept')
      .replace(/<[^>]*>/g, '')
      .replace(/["'[\](){}:;#&`\\/|*=~_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return 'Concept';
    return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 2)}..` : cleaned;
  };

  const tmp = document.createElement('div');
  tmp.innerHTML = reportHtml || '';

  const pillars = [];
  tmp.querySelectorAll('h2').forEach((h2) => {
    const title = (h2.textContent || '').trim();
    const low = title.toLowerCase();
    if (!title || low.includes('reference') || low.includes('sources') || low.includes('bibliography')) {
      return;
    }

    const concepts = [];
    let el = h2.nextElementSibling;
    while (el && el.tagName !== 'H2' && el.tagName !== 'H1') {
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        el.querySelectorAll('li').forEach((li) => {
          if (concepts.length >= 3) return;
          const strong = li.querySelector('strong, b');
          const txt = strong ? strong.textContent : li.textContent;
          if (txt && txt.trim()) concepts.push(cleanLabel(txt, 46));
        });
      } else if (el.tagName === 'P') {
        el.querySelectorAll('strong, b').forEach((st) => {
          if (concepts.length >= 3) return;
          if (st.textContent && st.textContent.trim()) {
            concepts.push(cleanLabel(st.textContent, 46));
          }
        });
      }
      el = el.nextElementSibling;
    }

    if (concepts.length === 0) {
      // Fallback: extract H3 subheadings under this H2 if present
      let sub = h2.nextElementSibling;
      while (sub && sub.tagName !== 'H2' && sub.tagName !== 'H1') {
        if (sub.tagName === 'H3' && concepts.length < 3) {
          concepts.push(cleanLabel(sub.textContent, 46));
        }
        sub = sub.nextElementSibling;
      }
    }

    pillars.push({
      title: cleanLabel(title, 42),
      concepts,
    });
  });

  return {
    rootTopic: cleanLabel(topic || 'Research Synthesis', 40),
    pillars: pillars.slice(0, 8),
  };
}

export async function renderMermaidFlowGraph(targetEl, graphData) {
  if (!targetEl) return;
  if (typeof window.mermaid === 'undefined') {
    targetEl.innerHTML = '<p class="ix-help">Mermaid library unavailable.</p>';
    return;
  }

  const isDark = resolveTheme() === 'dark';
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    themeVariables: {
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
      primaryColor: isDark ? '#1E293B' : '#EEF2FF',
      primaryTextColor: isDark ? '#F8FAFC' : '#172033',
      primaryBorderColor: isDark ? '#818CF8' : '#635BFF',
      lineColor: isDark ? '#64748B' : '#94A3B8',
      secondaryColor: isDark ? '#172033' : '#F6F8FC',
      tertiaryColor: isDark ? '#111827' : '#FFFFFF',
    },
  });

  const lines = ['flowchart LR'];
  lines.push(`  ROOT(["${graphData.rootTopic}"])`);
  graphData.pillars.forEach((p, pi) => {
    const pid = `P${pi}`;
    lines.push(`  ROOT --> ${pid}["${p.title}"]`);
    p.concepts.forEach((c, ci) => {
      const cid = `C${pi}_${ci}`;
      lines.push(`  ${pid} --> ${cid}["${c}"]`);
    });
  });

  try {
    const uid = `ix_mermaid_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const { svg } = await window.mermaid.render(uid, lines.join('\n'));
    targetEl.innerHTML = svg;
  } catch (err) {
    console.warn('Mermaid render error:', err);
    targetEl.innerHTML = '<p class="ix-help">Could not render flow diagram for this report.</p>';
  }
}

export function extractSwotSections(reportHtml) {
  const tmp = document.createElement('div');
  tmp.innerHTML = reportHtml || '';
  const items = Array.from(tmp.querySelectorAll('li, p'))
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 24 && t.length <= 240 && !/^https?:\/\//i.test(t));

  const buckets = {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  };

  const patterns = {
    strengths: /\b(strength|advantage|benefit|efficien|improv|strong|leader|robust|accelerat|reliable)\b/i,
    weaknesses: /\b(weakness|limitation|challenge|drawback|bottle|lack|costly|complex|gap|deficit)\b/i,
    opportunities: /\b(opportunit|growth|emerging|future|potential|adopt|expand|scale|innovation|market)\b/i,
    threats: /\b(threat|risk|vulnerab|regulat|competi|privacy|security|uncertainty|decline|fail)\b/i,
  };

  items.forEach((txt) => {
    for (const key of Object.keys(buckets)) {
      if (buckets[key].length < 4 && patterns[key].test(txt)) {
        if (!Object.values(buckets).some((arr) => arr.includes(txt))) {
          buckets[key].push(txt);
          return;
        }
      }
    }
  });

  return buckets;
}

export function extractFollowUpVectors(topic, reportHtml) {
  const tmp = document.createElement('div');
  tmp.innerHTML = reportHtml || '';
  const vectors = [];
  const metaSkip = ['reference', 'source', 'bibliography', 'introduction', 'conclusion', 'summary', 'contents'];

  tmp.querySelectorAll('h2, h3').forEach((h) => {
    if (vectors.length >= 4) return;
    const text = (h.textContent || '').trim();
    const low = text.toLowerCase();
    if (!text || text.length < 4 || metaSkip.some((k) => low.includes(k))) return;
    vectors.push(`Deep dive into "${text}" in the context of ${topic || 'this topic'}`);
  });

  return vectors;
}

export function buildTreeHtml(graphData) {
  if (!graphData || !graphData.pillars.length) return '';
  return `
    <div style="margin-bottom:16px;">
      <span class="ix-badge ix-badge-accent"><i class="fa-solid fa-diagram-project"></i> ${escapeHtml(graphData.rootTopic)}</span>
    </div>
    <div class="ix-tree-grid">
      ${graphData.pillars
        .map(
          (p) => `
          <div class="ix-tree-branch">
            <div style="font-weight:600; font-size:var(--text-sm); margin-bottom:8px; color:var(--text-primary);">
              ${escapeHtml(p.title)}
            </div>
            ${
              p.concepts.length > 0
                ? `<ul style="margin:0; padding-left:16px; color:var(--text-secondary); font-size:var(--text-xs); display:flex; flex-direction:column; gap:4px;">
                    ${p.concepts.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
                   </ul>`
                : `<p class="ix-help">Analytical section node</p>`
            }
          </div>`
        )
        .join('')}
    </div>
  `;
}
