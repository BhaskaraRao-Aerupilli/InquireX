/**
 * InquireX Export Suite, Presentation Slide Deck & AI Audio Briefing
 * Preserves PDF, Word (.docx), Markdown (.md), Log Trace (.json), LaTeX (.tex),
 * Slide Deck modal with keyboard shortcuts, and SpeechSynthesis briefing.
 */

import { escapeHtml, showToast } from './ui.js';
import { checkPathExists } from './api.js';

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 800);
}

function makeSlug(title) {
  return (
    String(title || 'research_report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'research_report'
  );
}

function htmlToCleanMarkdown(html, title) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  div.querySelectorAll('script, style, button, noscript').forEach((el) => el.remove());

  let md = `# ${title}\n\n`;
  Array.from(div.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.innerText || el.textContent || '').trim();
    if (!text && tag !== 'hr') return;
    if (tag === 'h1' && text.toLowerCase() !== title.toLowerCase()) md += `# ${text}\n\n`;
    else if (tag === 'h2') md += `## ${text}\n\n`;
    else if (tag === 'h3') md += `### ${text}\n\n`;
    else if (tag === 'h4') md += `#### ${text}\n\n`;
    else if (tag === 'blockquote') md += `> ${text}\n\n`;
    else if (tag === 'pre') md += `\`\`\`\n${text}\n\`\`\`\n\n`;
    else if (tag === 'ul') {
      el.querySelectorAll('li').forEach((li) => { md += `- ${(li.innerText || li.textContent || '').trim()}\n`; });
      md += '\n';
    } else if (tag === 'ol') {
      let i = 1;
      el.querySelectorAll('li').forEach((li) => { md += `${i++}. ${(li.innerText || li.textContent || '').trim()}\n`; });
      md += '\n';
    } else if (tag === 'hr') md += `---\n\n`;
    else md += `${text}\n\n`;
  });
  return md;
}

export async function exportReport(report, format) {
  if (!report || (!report.reportHtml && !report.reportMarkdown)) {
    showToast('No report content available to export.', 'warning');
    return;
  }

  const title = report.prompt || 'Research Report';
  const slug = makeSlug(title);
  const links = report.links || {};
  const html = report.reportHtml || '';
  const md = report.reportMarkdown || htmlToCleanMarkdown(html, title);

  if (format === 'pdf') {
    if (links.pdf && await checkPathExists(links.pdf.startsWith('/') ? links.pdf : `/${links.pdf}`)) {
      const href = links.pdf.startsWith('/') ? links.pdf : `/${links.pdf}`;
      const a = document.createElement('a');
      a.href = href;
      a.download = `${slug}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 400);
      showToast('Downloading PDF document...', 'success');
      return;
    }
    showToast('Opening print dialog for PDF export...', 'info');
    setTimeout(() => window.print(), 200);
    return;
  }

  if (format === 'docx' || format === 'word') {
    if (links.docx && await checkPathExists(links.docx.startsWith('/') ? links.docx : `/${links.docx}`)) {
      const href = links.docx.startsWith('/') ? links.docx : `/${links.docx}`;
      const a = document.createElement('a');
      a.href = href;
      a.download = `${slug}.docx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 400);
      showToast('Downloading Word document...', 'success');
      return;
    }

    const docHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #172033; }
  h1 { font-size: 20pt; color: #172033; border-bottom: 1.5pt solid #635BFF; padding-bottom: 6pt; }
  h2 { font-size: 15pt; color: #172033; margin-top: 18pt; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  th, td { border: 1pt solid #CBD5E1; padding: 6pt 8pt; text-align: left; }
  th { background: #F6F8FC; }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p style="color:#64748B;font-size:9.5pt;">InquireX Autonomous Deep Research Report &bull; ${new Date(report.timestamp || Date.now()).toLocaleString()}</p>
  ${html}
</body></html>`;
    triggerDownload(new Blob(['\ufeff', docHtml], { type: 'application/msword' }), `${slug}.docx`);
    showToast('Word document (.docx) exported.', 'success');
    return;
  }

  if (format === 'md' || format === 'markdown') {
    const content = md.startsWith('# ') ? md : `# ${title}\n\n${md}`;
    triggerDownload(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${slug}.md`);
    showToast('Markdown (.md) exported.', 'success');
    return;
  }

  if (format === 'json') {
    if (links.json && await checkPathExists(links.json.startsWith('/') ? links.json : `/${links.json}`)) {
      const href = links.json.startsWith('/') ? links.json : `/${links.json}`;
      const a = document.createElement('a');
      a.href = href;
      a.download = `${slug}_trace.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 400);
      showToast('Log Trace (JSON) downloaded.', 'success');
      return;
    }

    const trace = {
      inquirex_trace: {
        engine: 'InquireX',
        exportedAt: new Date().toISOString(),
        reportId: report.id,
        task: title,
        timestamp: report.timestamp,
      },
      metrics: report.metrics || {},
      subqueries: report.subqueries || [],
      sources: report.sources || [],
      logs: report.logs || [],
      downloadLinks: links,
    };
    triggerDownload(new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json;charset=utf-8' }), `${slug}_trace.json`);
    showToast('Log Trace (JSON) exported.', 'success');
    return;
  }

  if (format === 'latex' || format === 'tex') {
    const esc = (s) =>
      String(s || '')
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');

    let tex = `\\documentclass[11pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath,geometry,hyperref,booktabs}\n\\geometry{margin=1in}\n\\title{\\textbf{${esc(title)}}}\n\\author{InquireX Autonomous Research Platform}\n\\date{\\today}\n\\begin{document}\n\\maketitle\n\n`;

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    Array.from(tmp.children).forEach((el) => {
      const t = (el.textContent || '').trim();
      if (!t) return;
      if (el.tagName === 'H2') tex += `\\section{${esc(t)}}\n\n`;
      else if (el.tagName === 'H3') tex += `\\subsection{${esc(t)}}\n\n`;
      else if (el.tagName === 'H4') tex += `\\subsubsection{${esc(t)}}\n\n`;
      else if (el.tagName === 'P') tex += `${esc(t)}\n\n`;
      else if (el.tagName === 'UL' || el.tagName === 'OL') {
        const env = el.tagName === 'UL' ? 'itemize' : 'enumerate';
        tex += `\\begin{${env}}\n`;
        el.querySelectorAll('li').forEach((li) => {
          tex += `  \\item ${esc((li.textContent || '').trim())}\n`;
        });
        tex += `\\end{${env}}\n\n`;
      } else if (el.tagName === 'BLOCKQUOTE') {
        tex += `\\begin{quote}\n${esc(t)}\n\\end{quote}\n\n`;
      }
    });
    tex += '\\end{document}\n';
    triggerDownload(new Blob([tex], { type: 'text/x-tex;charset=utf-8' }), `${slug}.tex`);
    showToast('LaTeX source (.tex) exported.', 'success');
  }
}

export function buildSlidesFromReport(report) {
  if (!report) return [];
  const title = report.prompt || 'Research Presentation';
  const slides = [
    {
      title,
      subtitle: `Generated ${new Date(report.timestamp || Date.now()).toLocaleDateString()}`,
      content: `<p style="font-size:1.05rem; color:var(--text-secondary); line-height:1.65;">Autonomous Deep Research Synthesis &amp; Provenance Brief</p>`,
      isTitle: true,
    },
  ];

  const tmp = document.createElement('div');
  tmp.innerHTML = report.reportHtml || '';
  const h2s = Array.from(tmp.querySelectorAll('h2'));

  if (h2s.length > 0) {
    h2s.forEach((h2) => {
      const secTitle = (h2.textContent || '').trim();
      let html = '';
      let el = h2.nextElementSibling;
      while (el && el.tagName !== 'H2' && el.tagName !== 'H1') {
        html += el.outerHTML;
        el = el.nextElementSibling;
      }
      if (secTitle) {
        slides.push({ title: secTitle, content: html || '<p>No section body.</p>' });
      }
    });
  } else {
    slides.push({
      title: 'Executive Synthesis',
      content: tmp.innerHTML || '<p>No structured sections found.</p>',
    });
  }

  return slides;
}

export function openSlideDeckModal(report) {
  const slides = buildSlidesFromReport(report);
  if (slides.length === 0) {
    showToast('No report content available to generate slides.', 'warning');
    return;
  }

  let idx = 0;
  const existing = document.getElementById('ixSlideDeckBackdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'ixSlideDeckBackdrop';
  backdrop.className = 'ix-modal-backdrop open';

  const render = () => {
    const s = slides[idx];
    backdrop.innerHTML = `
      <div class="ix-modal ix-modal-lg" role="dialog" aria-modal="true">
        <div class="ix-modal-header">
          <div class="ix-card-title">
            <i class="fa-solid fa-chalkboard-user" style="color:var(--accent-primary);"></i>
            <span class="ix-truncate" style="max-width:520px;">${escapeHtml(report.prompt || 'Presentation')}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-slide="print">
              <i class="fa-solid fa-print"></i> Print / Save
            </button>
            <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-slide="close" aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="ix-modal-body" style="background:var(--bg-secondary);">
          <div class="ix-slide-stage">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span class="ix-badge ix-badge-accent">Slide ${idx + 1} / ${slides.length}</span>
              ${s.subtitle ? `<span class="ix-help">${escapeHtml(s.subtitle)}</span>` : ''}
            </div>
            <h2 style="font-size:${s.isTitle ? '1.75rem' : '1.4rem'}; margin-top:4px;">${escapeHtml(s.title)}</h2>
            <div class="ix-prose" style="margin:0; max-width:none; overflow-y:auto; max-height:46vh;">
              ${s.content}
            </div>
          </div>
        </div>
        <div class="ix-modal-footer" style="justify-content:space-between;">
          <span class="ix-help">Use Arrow keys or Space to navigate &bull; Esc to close</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-slide="prev" ${idx === 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-left"></i> Previous
            </button>
            <span class="ix-mono" style="font-size:var(--text-xs); color:var(--text-secondary);">
              ${idx + 1} / ${slides.length}
            </span>
            <button type="button" class="ix-btn ix-btn-primary ix-btn-sm" data-slide="next" ${idx >= slides.length - 1 ? 'disabled' : ''}>
              Next <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft' && idx > 0) { idx -= 1; render(); }
    else if ((e.key === 'ArrowRight' || e.key === ' ') && idx < slides.length - 1) {
      e.preventDefault();
      idx += 1;
      render();
    }
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-slide="close"]')) close();
    else if (e.target.closest('[data-slide="prev"]') && idx > 0) { idx -= 1; render(); }
    else if (e.target.closest('[data-slide="next"]') && idx < slides.length - 1) { idx += 1; render(); }
    else if (e.target.closest('[data-slide="print"]')) window.print();
  });

  render();
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
}

export { AudioBriefingController, DEFAULT_STUDIO_VOICES, formatAudioTime } from './audioBriefing.js';
