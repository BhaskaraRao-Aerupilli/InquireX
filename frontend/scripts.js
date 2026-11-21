// --- InquireX Theme Management (Light & Dark Theme) ---
function initTheme() {
  let initialTheme = 'light'; try { const savedTheme = localStorage.getItem('inquirex_theme'); if (savedTheme) { initialTheme = savedTheme; } } catch (e) {}
  applyTheme(initialTheme);
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
    if (document.body) document.body.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (document.body) document.body.removeAttribute('data-theme');
  }
  
  // Update Top Navbar Theme Toggle Button
  const themeIcon = document.getElementById('themeToggleIcon');
  const themeText = document.getElementById('themeToggleText');
  if (themeIcon) {
    themeIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
  if (themeText) {
    themeText.textContent = isLight ? 'Dark' : 'Light';
  }

  // Update Sidebar Theme Toggle Button
  const sidebarThemeIcon = document.getElementById('sidebarThemeIcon');
  const sidebarThemeLabel = document.getElementById('sidebarThemeLabel');
  if (sidebarThemeIcon) {
    sidebarThemeIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
  if (sidebarThemeLabel) {
    sidebarThemeLabel.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  }

  try {
    localStorage.setItem('inquirex_theme', theme);
  } catch (e) {}
}

function toggleTheme() {
  const isCurrentlyLight = document.documentElement.getAttribute('data-theme') === 'light' || 
                           (document.body && document.body.getAttribute('data-theme') === 'light');
  const newTheme = isCurrentlyLight ? 'dark' : 'light';
  applyTheme(newTheme);
}

window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
window.initTheme = initTheme;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}




// --- InquireX V3.0 Minimalist Search & Dropdown Controllers ---



// Toggle Advanced Settings Accordion

function toggleAdvancedSettings() {
  const accordion = document.getElementById('advancedSettingsAccordion');
  const toggleBtn = document.getElementById('advancedSettingsToggle');
  if (!accordion) return;

  const isHidden = accordion.style.display === 'none' || !accordion.style.display;
  if (isHidden) {
    // Close templates popover first (mutual exclusion)
    if (typeof closeTemplatesMenu === 'function') closeTemplatesMenu();
    accordion.style.display = 'block';
    if (toggleBtn) toggleBtn.classList.add('open');
  } else {
    accordion.style.display = 'none';
    if (toggleBtn) toggleBtn.classList.remove('open');
  }
}

window.toggleAdvancedSettings = toggleAdvancedSettings;



// Quick Report Type Preset Chips in Search Hero

function setQuickReportType(typeVal, btnElement) {

  const select = document.getElementById('report_type');

  if (select) {

    select.value = typeVal;

    select.dispatchEvent(new Event('change'));

  }

  document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));

  if (btnElement) btnElement.classList.add('active');

}

window.setQuickReportType = setQuickReportType;

// Two-way sync: when report_type <select> changes, update the quick preset pills
document.addEventListener('DOMContentLoaded', function() {
  const reportSelect = document.getElementById('report_type');
  if (reportSelect) {
    reportSelect.addEventListener('change', function() {
      const val = this.value;
      document.querySelectorAll('.preset-chip[data-preset-report]').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-preset-report') === val);
      });
    });
  }
});


// ==========================================
// Research Archetypes & Fast Query Templates (Popover Menu)
// ==========================================
function toggleTemplatesMenu(event) {
  if (event) {
    event.stopPropagation();
  }
  const popover = document.getElementById('templatesPopover');
  const chevron = document.getElementById('templatesChevron');
  if (!popover) return;

  const isHidden = popover.style.display === 'none' || !popover.style.display;
  if (isHidden) {
    // Close advanced settings first (mutual exclusion)
    const accordion = document.getElementById('advancedSettingsAccordion');
    const advToggle = document.getElementById('advancedSettingsToggle');
    if (accordion && accordion.style.display === 'block') {
      accordion.style.display = 'none';
      if (advToggle) advToggle.classList.remove('open');
    }
    popover.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';

    // Dismiss on outside click
    const dismissHandler = (e) => {
      const wrapper = document.getElementById('templatesMenuWrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        popover.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        document.removeEventListener('click', dismissHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', dismissHandler);
    }, 10);
  } else {
    popover.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}
window.toggleTemplatesMenu = toggleTemplatesMenu;

function closeTemplatesMenu() {
  const popover = document.getElementById('templatesPopover');
  const chevron = document.getElementById('templatesChevron');
  if (popover) popover.style.display = 'none';
  if (chevron) chevron.style.transform = 'rotate(0deg)';
}
window.closeTemplatesMenu = closeTemplatesMenu;

const RESEARCH_ARCHETYPES = {
  comparison: {
    template: "Compare [Entity A] vs [Entity B] across architecture, core features, performance benchmarks, pros/cons, and final comparative verdict.",
    reportType: "detailed_report",
    tone: "Comparative",
    placeholderSelect: "[Entity A]",
    badgeName: "Comparative Analysis"
  },
  market: {
    template: "In-depth market and competitor analysis of [Company / Industry]: market size, key industry players, value proposition, pricing models, market trends, and strategic opportunities.",
    reportType: "detailed_report",
    tone: "Analytical",
    placeholderSelect: "[Company / Industry]",
    badgeName: "Market & Competitor Intel"
  },
  tech_deep_dive: {
    template: "Comprehensive technical deep dive into [Technology / Framework / Protocol]: system architecture, internal mechanisms, key trade-offs, and production implementation best practices.",
    reportType: "detailed_report",
    tone: "Informative",
    placeholderSelect: "[Technology / Framework / Protocol]",
    badgeName: "Technical Deep Dive"
  },
  fact_check: {
    template: "Fact-check and verification analysis for [Claim / Topic]: verified empirical evidence, counter-arguments, source provenance, and consensus conclusion.",
    reportType: "research_report",
    tone: "Critical",
    placeholderSelect: "[Claim / Topic]",
    badgeName: "Fact-Check & Verification"
  },
  news_breakthrough: {
    template: "Latest breakthroughs, key industry developments, and major announcements in [Domain / Topic] over the past year.",
    reportType: "research_report",
    tone: "Informative",
    placeholderSelect: "[Domain / Topic]",
    badgeName: "Recent Developments"
  },
  swot_analysis: {
    template: "Comprehensive SWOT Analysis (Strengths, Weaknesses, Opportunities, Threats) for [Organization, Product, or Strategy] with actionable strategic recommendations.",
    reportType: "detailed_report",
    tone: "Analytical",
    placeholderSelect: "[Organization, Product, or Strategy]",
    badgeName: "SWOT Analysis"
  }
};

function applyResearchArchetype(key, event) {
  if (event) {
    event.stopPropagation();
  }
  closeTemplatesMenu();

  const archetype = RESEARCH_ARCHETYPES[key];
  if (!archetype) return;

  const textarea = document.getElementById('task');
  if (!textarea) return;

  const existingText = textarea.value.trim();
  let finalText = archetype.template;

  // Smart insertion: if user already typed a topic/entity and not a bracketed template
  if (existingText && !existingText.includes('[') && existingText.length < 140) {
    if (key === 'comparison' && (existingText.includes(' vs ') || existingText.includes(' against ') || existingText.includes(' or '))) {
      finalText = `Compare ${existingText} across architecture, core features, performance benchmarks, pros/cons, and final comparative verdict.`;
    } else {
      finalText = archetype.template.replace(archetype.placeholderSelect, existingText);
    }
  }

  textarea.value = finalText;

  // Sync report_type select & preset chips
  const reportTypeSelect = document.getElementById('report_type');
  if (reportTypeSelect) {
    reportTypeSelect.value = archetype.reportType;
    reportTypeSelect.dispatchEvent(new Event('change'));
  }
  document.querySelectorAll('.preset-chip').forEach(chip => {
    if (chip.getAttribute('data-preset-report') === archetype.reportType) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  // Sync tone select
  const toneSelect = document.getElementById('tone');
  if (toneSelect) {
    toneSelect.value = archetype.tone;
    toneSelect.dispatchEvent(new Event('change'));
  }

  // Focus textarea and highlight the bracketed placeholder so user can immediately type
  textarea.focus();
  const placeholderStart = finalText.indexOf('[');
  const placeholderEnd = finalText.indexOf(']');
  if (placeholderStart !== -1 && placeholderEnd !== -1) {
    textarea.setSelectionRange(placeholderStart, placeholderEnd + 1);
  } else {
    textarea.setSelectionRange(finalText.length, finalText.length);
  }

  // Visual feedback toast
  const msg = `Applied ${archetype.badgeName} template (${archetype.tone} Tone)`;
  try {
    if (typeof showToast === 'function') {
      showToast(msg);
    } else {
      let t = document.getElementById('archetype-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'archetype-toast';
        t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:12px;font-size:0.85rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.25);z-index:9999;transition:all 0.3s ease;opacity:0;transform:translateY(10px);pointer-events:none;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
      setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(10px)';
      }, 3000);
    }
  } catch (e) {
    console.debug('Toast notification suppressed:', e);
  }
}

window.applyResearchArchetype = applyResearchArchetype;



// State variables for conditional research report rendering & dropdown management

let isReportReady = false;

let researchStatus = 'initial'; // 'initial' | 'in_progress' | 'completed' | 'error'



function setReportReady(ready) {
  isReportReady = !!ready;
  const active = (typeof isResearchActive !== 'undefined') ? isResearchActive : false;
  researchStatus = isReportReady ? 'completed' : (active ? 'in_progress' : 'initial');

  // Ensure Research Progress card stays visible above Verified Visuals & Report
  const progressCard = document.getElementById('researchOutputContainer');
  if (progressCard && isReportReady) {
    progressCard.style.display = 'block';
  }

  const mainReport = document.getElementById('mainReportContainer');
  if (mainReport) {
    if (isReportReady) {
      mainReport.style.setProperty('display', 'block', 'important');
      mainReport.setAttribute('data-ready', 'true');
      mainReport.classList.remove('report-hidden');
    } else {
      mainReport.style.setProperty('display', 'none', 'important');
      mainReport.setAttribute('data-ready', 'false');
      mainReport.classList.add('report-hidden');
    }
  }

  const reportToolbar = document.getElementById('reportStickyToolbar');
  if (reportToolbar) {
    if (isReportReady) {
      reportToolbar.classList.remove('toolbar-hidden');
      reportToolbar.style.setProperty('display', 'flex', 'important');
    } else {
      reportToolbar.classList.add('toolbar-hidden');
      reportToolbar.style.setProperty('display', 'none', 'important');
    }
  }

  // Ensure all dropdown items and toolbar action buttons are properly enabled/disabled
  const exportItems = ['downloadLinkTop', 'downloadLinkWordTop', 'downloadLinkMdTop', 'downloadLinkJsonTop', 'downloadLatexBtnTop'];
  exportItems.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (isReportReady) {
        el.classList.remove('disabled');
      } else {
        el.classList.add('disabled');
      }
    }
  });

  const toolbarButtons = ['copyToClipboardTop', 'viewSlidesBtnTop', 'audioBriefingBtnTop', 'expandReportBtn'];
  toolbarButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (isReportReady) {
        el.classList.remove('disabled');
        el.style.display = 'inline-flex';
      } else {
        el.classList.add('disabled');
      }
    }
  });

  if (!isReportReady) {
    toggleExportDropdown(false);
  }
}

window.setReportReady = setReportReady;

window.isReportReady = () => isReportReady;

window.getResearchStatus = () => researchStatus;



// Toggle Consolidated Export Dropdown Menu

function toggleExportDropdown(open) {

  const menu = document.getElementById('exportDropdownMenu');

  const wrapper = document.getElementById('exportDropdownWrapper');

  if (!menu) return;



  const isOpen = menu.classList.contains('show') || (wrapper && wrapper.classList.contains('open')) || menu.style.display === 'flex';



  if (open === undefined) {

    open = !isOpen;

  }



  if (open) {

    menu.classList.add('show');

    if (wrapper) wrapper.classList.add('open');

    menu.style.setProperty('display', 'flex', 'important');

  } else {

    menu.classList.remove('show');

    if (wrapper) wrapper.classList.remove('open');

    menu.style.setProperty('display', 'none', 'important');

  }

}

window.toggleExportDropdown = toggleExportDropdown;



// Click-outside listener & option selection closer (Capture phase to guarantee closure)

document.addEventListener('click', (e) => {

  const wrapper = document.getElementById('exportDropdownWrapper');

  const menu = document.getElementById('exportDropdownMenu');

  if (!wrapper || !menu) return;



  const isMenuOpen = menu.classList.contains('show') || wrapper.classList.contains('open') || menu.style.display === 'flex';

  if (!isMenuOpen) return;



  // 1. Click outside the wrapper -> close dropdown immediately

  if (!wrapper.contains(e.target)) {

    toggleExportDropdown(false);

    return;

  }



  // 2. Click on an option inside the dropdown menu (PDF, Word, Markdown, JSON, LaTeX, Audio) -> close immediately

  if (e.target.closest('.dropdown-export-item') || (menu.contains(e.target) && e.target !== menu)) {

    toggleExportDropdown(false);

  }

}, true);



// Close dropdown automatically on window & document scroll to prevent floating artifacts

const handleExportScrollClose = () => {

  const menu = document.getElementById('exportDropdownMenu');

  const wrapper = document.getElementById('exportDropdownWrapper');

  if (menu && (menu.classList.contains('show') || menu.style.display === 'flex' || (wrapper && wrapper.classList.contains('open')))) {

    toggleExportDropdown(false);

  }

};

window.addEventListener('scroll', handleExportScrollClose, { passive: true, capture: true });

document.addEventListener('scroll', handleExportScrollClose, { passive: true, capture: true });



// Close dropdown on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('exportDropdownMenu');
    if (menu && (menu.classList.contains('show') || menu.style.display === 'flex')) {
      toggleExportDropdown(false);
      return;
    }
    const slideModal = document.getElementById('slideDeckModal');
    if (slideModal && (slideModal.classList.contains('active') || slideModal.style.display !== 'none')) {
      closeSlideDeck();
      return;
    }
    const reportContainer = document.getElementById('mainReportContainer');
    if (reportContainer && reportContainer.classList.contains('report-card-fullscreen')) {
      toggleResearchReportFullscreen(null, false);
      return;
    }
    const progressContainer = document.getElementById('researchOutputContainer');
    if (progressContainer && progressContainer.classList.contains('progress-card-fullscreen')) {
      toggleResearchProgressFullscreen(null, false);
      return;
    }
    toggleExportDropdown(false);
  }
});



// New Research Action

function createNewResearch() {

  setReportReady(false);

  toggleExportDropdown(false);



  // 1. Clear previous research images gallery completely

  if (window.clearResearchImages) {

    window.clearResearchImages();

  } else {

    const imgContainer = document.getElementById('selectedImagesContainer');

    if (imgContainer) {

      imgContainer.innerHTML = '';

      imgContainer.style.setProperty('display', 'none', 'important');

    }

  }



  // 2. Clear output terminal and report body

  const output = document.getElementById('output');

  if (output) output.innerHTML = '';

  const reportContainer = document.getElementById('reportContainer');

  if (reportContainer) reportContainer.innerHTML = '';



  // 3. Clear task input and focus

  const taskInput = document.getElementById('task');

  if (taskInput) {

    taskInput.value = '';

    taskInput.focus();

  }



  // 4. Reset researcher state to initial if available
  const researcherObj = window.InquireXResearcher || window.InquireX || window.GPTResearcher;
  if (researcherObj && researcherObj.resetState) {
    researcherObj.resetState();
  }



  window.scrollTo({ top: 0, behavior: 'smooth' });

}

window.createNewResearch = createNewResearch;

// ==============================================================
// InquireX Unified Export & Presentation Slides Suite
// ==============================================================
window.activeDownloadLinks = window.activeDownloadLinks || {};
window.sessionLogRecords = window.sessionLogRecords || [];

function displayGlobalToast(message, duration = 3000) {
  try {
    if (typeof showToast === 'function') {
      showToast(message, duration);
      return;
    }
  } catch (e) {}
  let t = document.getElementById('inquirex-global-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'inquirex-global-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:12px;font-size:0.85rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.35);z-index:99999;transition:all 0.3s ease;opacity:0;transform:translateY(10px);pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.style.opacity = '1';
  t.style.transform = 'translateY(0)';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
  }, duration);
}
window.displayGlobalToast = displayGlobalToast;

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

function getActiveReportData() {
  const reportContainer = document.getElementById('reportContainer');
  const reportHtml = reportContainer ? reportContainer.innerHTML : '';
  const reportText = reportContainer ? reportContainer.innerText.trim() : '';

  const taskInput = document.getElementById('task');
  const activePrompt = (taskInput?.value || '').trim() ||
                       (typeof activeResearchPrompt !== 'undefined' ? activeResearchPrompt : '') ||
                       document.querySelector('.meta-report-title')?.textContent?.trim() ||
                       'Research Report';

  const fileSlug = activePrompt.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60) || 'research_report';

  return {
    reportContainer,
    reportHtml,
    reportText,
    topic: activePrompt,
    fileSlug,
    isValid: reportText.length >= 20 || reportHtml.length >= 30
  };
}
window.getActiveReportData = getActiveReportData;

function convertHtmlToCleanMarkdown(container, title) {
  if (!container) return `# ${title}\n\n`;
  const div = document.createElement('div');
  div.innerHTML = container.innerHTML;

  div.querySelectorAll('script, style, button, noscript').forEach(el => el.remove());

  let md = `# ${title}\n\n`;
  const nodes = div.children;
  for (let el of nodes) {
    const tag = el.tagName.toLowerCase();
    const text = el.innerText.trim();
    if (!text && tag !== 'hr') continue;

    if (tag === 'h1' && text.toLowerCase() !== title.toLowerCase()) {
      md += `# ${text}\n\n`;
    } else if (tag === 'h2') {
      md += `## ${text}\n\n`;
    } else if (tag === 'h3') {
      md += `### ${text}\n\n`;
    } else if (tag === 'h4') {
      md += `#### ${text}\n\n`;
    } else if (tag === 'p') {
      md += `${text}\n\n`;
    } else if (tag === 'blockquote') {
      md += `> ${text}\n\n`;
    } else if (tag === 'pre') {
      md += `\`\`\`\n${text}\n\`\`\`\n\n`;
    } else if (tag === 'ul') {
      el.querySelectorAll('li').forEach(li => {
        md += `- ${li.innerText.trim()}\n`;
      });
      md += '\n';
    } else if (tag === 'ol') {
      let idx = 1;
      el.querySelectorAll('li').forEach(li => {
        md += `${idx++}. ${li.innerText.trim()}\n`;
      });
      md += '\n';
    } else if (tag === 'hr') {
      md += `---\n\n`;
    } else {
      md += `${text}\n\n`;
    }
  }
  return md;
}

function exportAsPdf() {
  toggleExportDropdown(false);
  const data = getActiveReportData();
  if (!data.isValid) {
    displayGlobalToast('No research report available to export as PDF.');
    return;
  }

  const pdfLink = (window.activeDownloadLinks && window.activeDownloadLinks.pdf) || '';
  if (pdfLink && pdfLink !== '#' && !pdfLink.includes('undefined')) {
    displayGlobalToast('Downloading PDF report...');
    const a = document.createElement('a');
    a.href = pdfLink;
    a.download = `${data.fileSlug}.pdf`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
    return;
  }

  displayGlobalToast('Preparing print-ready PDF...');
  setTimeout(() => {
    window.print();
  }, 250);
}
window.exportAsPdf = exportAsPdf;

async function exportAsWord() {
  toggleExportDropdown(false);
  const data = getActiveReportData();
  if (!data.isValid) {
    displayGlobalToast('No research report available to export as Word document.');
    return;
  }

  displayGlobalToast('Generating Word Document (.docx)...');

  const docxLink = (window.activeDownloadLinks && window.activeDownloadLinks.docx) || '';
  if (docxLink && docxLink !== '#' && !docxLink.includes('undefined')) {
    try {
      const resp = await fetch(docxLink, { method: 'HEAD' });
      if (resp.ok) {
        const a = document.createElement('a');
        a.href = docxLink;
        a.download = `${data.fileSlug}.docx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 500);
        displayGlobalToast('Word Document (.docx) downloaded successfully!');
        return;
      }
    } catch (e) {}
  }

  const docHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeXml(data.topic)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page { size: 8.5in 11in; margin: 1.0in; }
body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; line-height: 1.6; color: #1e293b; }
h1 { font-family: 'Calibri Light', Arial, sans-serif; font-size: 24pt; color: #1e3a8a; border-bottom: 2pt solid #3b82f6; padding-bottom: 6pt; margin-bottom: 16pt; }
h2 { font-family: 'Calibri Light', Arial, sans-serif; font-size: 16pt; color: #1d4ed8; border-bottom: 1pt solid #cbd5e1; padding-bottom: 4pt; margin-top: 22pt; margin-bottom: 10pt; }
h3 { font-family: 'Calibri', Arial, sans-serif; font-size: 13pt; color: #334155; margin-top: 16pt; margin-bottom: 6pt; }
p { margin-top: 0; margin-bottom: 10pt; }
table { border-collapse: collapse; width: 100%; margin: 14pt 0; }
th, td { border: 1pt solid #cbd5e1; padding: 7pt 10pt; text-align: left; }
th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
code { font-family: Consolas, monospace; background: #f1f5f9; padding: 2pt 4pt; font-size: 10pt; color: #b91c1c; }
pre { background: #f8fafc; border: 1pt solid #e2e8f0; padding: 10pt; font-family: Consolas, monospace; margin: 10pt 0; font-size: 10pt; }
blockquote { border-left: 3pt solid #3b82f6; padding-left: 12pt; margin-left: 0; color: #475569; font-style: italic; }
ul, ol { margin-top: 0; margin-bottom: 10pt; padding-left: 20pt; }
li { margin-bottom: 4pt; }
a { color: #2563eb; text-decoration: underline; }
img { max-width: 100%; height: auto; margin: 12pt 0; }
.meta-stamp { color: #64748b; font-size: 10pt; margin-bottom: 18pt; }
</style>
</head>
<body>
<h1>${escapeXml(data.topic)}</h1>
<div class="meta-stamp">InquireX Autonomous Deep Research Report • Generated on ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
${data.reportHtml}
</body>
</html>`;

  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
  triggerBrowserDownload(blob, `${data.fileSlug}.docx`);
  displayGlobalToast('Word Document (.docx) downloaded successfully!');
}
window.exportAsWord = exportAsWord;

function exportAsMarkdown() {
  toggleExportDropdown(false);
  const data = getActiveReportData();
  if (!data.isValid) {
    displayGlobalToast('No research report available to export as Markdown.');
    return;
  }

  displayGlobalToast('Generating Markdown (.md)...');

  let mdContent = (typeof allReports !== 'undefined' && allReports) ||
                  (typeof currentReport !== 'undefined' && currentReport) ||
                  (typeof reportContent !== 'undefined' && reportContent) || '';

  if (!mdContent || mdContent.trim().length < 50) {
    mdContent = convertHtmlToCleanMarkdown(data.reportContainer, data.topic);
  } else if (!mdContent.startsWith('# ')) {
    mdContent = `# ${data.topic}\n\n` + mdContent;
  }

  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
  triggerBrowserDownload(blob, `${data.fileSlug}.md`);
  displayGlobalToast('Markdown (.md) downloaded successfully!');
}
window.exportAsMarkdown = exportAsMarkdown;

function exportAsJsonTrace() {
  toggleExportDropdown(false);
  const data = getActiveReportData();
  if (!data.isValid) {
    displayGlobalToast('No research session trace available to export.');
    return;
  }

  displayGlobalToast('Generating Log Trace (JSON)...');

  const agentLogElements = document.querySelectorAll('#output .agent_response, #output .agent-step-item');
  const domLogs = Array.from(agentLogElements).map((el, i) => ({
    step: i + 1,
    text: el.innerText.trim(),
    html: el.innerHTML.trim()
  }));

  const stats = (typeof activeResearchStats !== 'undefined' && activeResearchStats) ? activeResearchStats : null;
  const elapsedSec = stats && stats.startTime && stats.endTime 
    ? Math.round((stats.endTime - stats.startTime) / 1000)
    : (stats && stats.startTime ? Math.round((Date.now() - stats.startTime) / 1000) : 0);

  const scrapedList = stats && stats.scrapedSources instanceof Set
    ? Array.from(stats.scrapedSources)
    : (Array.isArray(stats?.scrapedSources) ? stats.scrapedSources : []);

  const citations = [];
  data.reportContainer?.querySelectorAll('a[href^="http"]').forEach((a) => {
    citations.push({ url: a.href, title: a.textContent.trim() });
  });

  const traceObj = {
    inquirex_session_provenance: {
      engine: "InquireX — Autonomous Deep Research Engine",
      version: "2.0.0-agentic",
      exportTimestamp: new Date().toISOString(),
      task: data.topic,
      agentType: stats?.agentName || "Auto Agent (Dynamic Routing)",
      elapsedSeconds: elapsedSec,
      startTime: stats?.startTime ? new Date(stats.startTime).toISOString() : null,
      endTime: stats?.endTime ? new Date(stats.endTime).toISOString() : new Date().toISOString()
    },
    metrics: {
      wordCount: data.reportText.split(/\s+/).filter(Boolean).length,
      subqueriesCount: (stats?.subqueries || []).length,
      scrapedCount: scrapedList.length,
      citationsCount: citations.length
    },
    subqueries: stats?.subqueries || [],
    sources: scrapedList.length > 0 ? scrapedList : citations.map(c => c.url),
    citations: citations,
    agentExecutionTrace: (window.sessionLogRecords && window.sessionLogRecords.length > 0)
      ? window.sessionLogRecords
      : domLogs,
    downloadLinks: window.activeDownloadLinks || {}
  };

  const blob = new Blob([JSON.stringify(traceObj, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerBrowserDownload(blob, `${data.fileSlug}_trace.json`);
  displayGlobalToast('Log Trace (JSON) exported successfully!');
}
window.exportAsJsonTrace = exportAsJsonTrace;

function exportAsLatex() {
  toggleExportDropdown(false);
  const data = getActiveReportData();
  if (!data.isValid) {
    displayGlobalToast('No research report available to export as LaTeX.');
    return;
  }

  displayGlobalToast('Generating Academic LaTeX (.tex)...');

  const cleanTitle = data.topic.replace(/["'\\]/g, '');
  let latexCode = `\\documentclass[11pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{booktabs}
\\usepackage{graphicx}
\\usepackage{microtype}

\\geometry{margin=1in}

\\title{\\textbf{${cleanTitle}}\\\\ \\large \\textit{An Autonomous Multi-Source Deep Research Investigation}}
\\author{InquireX Autonomous Deep Research Engine}
\\date{\\today}

\\begin{document}

\\maketitle

`;

  const escapeLatex = (str) => {
    return (str || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([&%$#_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  };

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = data.reportHtml;

  const children = tempDiv.children;
  for (let el of children) {
    if (el.tagName === 'H1') {
      // already in maketitle
    } else if (el.tagName === 'H2') {
      latexCode += `\\section{${escapeLatex(el.textContent.trim())}}\n\n`;
    } else if (el.tagName === 'H3') {
      latexCode += `\\subsection{${escapeLatex(el.textContent.trim())}}\n\n`;
    } else if (el.tagName === 'H4') {
      latexCode += `\\subsubsection{${escapeLatex(el.textContent.trim())}}\n\n`;
    } else if (el.tagName === 'P') {
      const pText = el.textContent.trim();
      if (pText) latexCode += `${escapeLatex(pText)}\n\n`;
    } else if (el.tagName === 'UL') {
      latexCode += `\\begin{itemize}\n`;
      el.querySelectorAll('li').forEach(li => {
        latexCode += `  \\item ${escapeLatex(li.textContent.trim())}\n`;
      });
      latexCode += `\\end{itemize}\n\n`;
    } else if (el.tagName === 'OL') {
      latexCode += `\\begin{enumerate}\n`;
      el.querySelectorAll('li').forEach(li => {
        latexCode += `  \\item ${escapeLatex(li.textContent.trim())}\n`;
      });
      latexCode += `\\end{enumerate}\n\n`;
    } else if (el.tagName === 'BLOCKQUOTE') {
      latexCode += `\\begin{quote}\n${escapeLatex(el.textContent.trim())}\n\\end{quote}\n\n`;
    }
  }

  latexCode += `\\end{document}\n`;

  const blob = new Blob([latexCode], { type: 'text/x-tex;charset=utf-8' });
  triggerBrowserDownload(blob, `${data.fileSlug}_manuscript.tex`);
  displayGlobalToast('LaTeX source (.tex) downloaded successfully!');
}
window.exportAsLatex = exportAsLatex;

function handleExportClick(event, format) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  toggleExportDropdown(false);
  switch (format) {
    case 'pdf':
      exportAsPdf();
      break;
    case 'docx':
    case 'word':
      exportAsWord();
      break;
    case 'md':
    case 'markdown':
      exportAsMarkdown();
      break;
    case 'json':
      exportAsJsonTrace();
      break;
    case 'latex':
    case 'tex':
      exportAsLatex();
      break;
    default:
      console.warn('Unknown export format:', format);
  }
}
window.handleExportClick = handleExportClick;

// Presentation Slide Deck Handlers
window.slideData = [];
window.currentSlideIndex = 0;

function renderSlideDeckSlide() {
  const slideBody = document.getElementById('slideBody');
  const counter = document.getElementById('slideCounter');
  const prevBtn = document.getElementById('prevSlideBtn');
  const nextBtn = document.getElementById('nextSlideBtn');

  if (!slideBody || !window.slideData || window.slideData.length === 0) return;

  const idx = window.currentSlideIndex || 0;
  const slide = window.slideData[idx];

  slideBody.innerHTML = `
    <h2>${slide.title}</h2>
    <div class="slide-inner-content">${slide.content}</div>
  `;
  slideBody.scrollTop = 0;

  if (counter) counter.textContent = `Slide ${idx + 1} of ${window.slideData.length}`;
  if (prevBtn) prevBtn.disabled = idx === 0;
  if (nextBtn) nextBtn.disabled = idx === window.slideData.length - 1;
}
window.renderSlideDeckSlide = renderSlideDeckSlide;

function changeSlideDeckSlide(delta) {
  if (!window.slideData || window.slideData.length === 0) return;
  window.currentSlideIndex = Math.max(0, Math.min(window.slideData.length - 1, (window.currentSlideIndex || 0) + delta));
  renderSlideDeckSlide();
}
window.changeSlideDeckSlide = changeSlideDeckSlide;

function closeSlideDeck() {
  const modal = document.getElementById('slideDeckModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
  document.body.style.overflow = 'auto';
}
window.closeSlideDeck = closeSlideDeck;

function openSlideDeck() {
  const data = getActiveReportData();
  const modal = document.getElementById('slideDeckModal');
  const topicEl = document.getElementById('slideDeckTopic');

  if (!data.isValid || !modal) {
    displayGlobalToast('No report content available to generate slides.');
    return;
  }

  if (topicEl) topicEl.textContent = data.topic;

  window.slideData = [];

  // Title Slide
  window.slideData.push({
    title: data.topic,
    content: '<p style="font-size: 1.25rem; opacity: 0.95; line-height: 1.7;">Autonomous Deep-Web Research & Analytical Intelligence Report</p><div style="margin-top: 24px; padding: 14px 22px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; display: inline-block;">🚀 <b>Agentic RAG Framework</b> • Autonomous Knowledge Retrieval</div>'
  });

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = data.reportHtml;

  const sections = tempDiv.querySelectorAll('h2');
  if (sections.length > 0) {
    sections.forEach((sec) => {
      const title = sec.textContent.trim();
      let contentHtml = '';
      let nextEl = sec.nextElementSibling;
      while (nextEl && nextEl.tagName !== 'H2' && nextEl.tagName !== 'H1') {
        contentHtml += nextEl.outerHTML;
        nextEl = nextEl.nextElementSibling;
      }
      if (title) {
        window.slideData.push({
          title: title,
          content: contentHtml || '<p>Detailed analysis in report.</p>'
        });
      }
    });
  } else {
    const subheadings = tempDiv.querySelectorAll('h3');
    if (subheadings.length > 0) {
      subheadings.forEach((sec) => {
        const title = sec.textContent.trim();
        let contentHtml = '';
        let nextEl = sec.nextElementSibling;
        while (nextEl && nextEl.tagName !== 'H3' && nextEl.tagName !== 'H2' && nextEl.tagName !== 'H1') {
          contentHtml += nextEl.outerHTML;
          nextEl = nextEl.nextElementSibling;
        }
        if (title) {
          window.slideData.push({
            title: title,
            content: contentHtml || '<p>Detailed analysis in report.</p>'
          });
        }
      });
    } else {
      window.slideData.push({
        title: 'Executive Summary',
        content: tempDiv.innerHTML || '<p>Detailed analysis in report.</p>'
      });
    }
  }

  window.currentSlideIndex = 0;
  renderSlideDeckSlide();
  modal.classList.add('active');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
window.openSlideDeck = openSlideDeck;

async function handleSlidesButtonClick(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const topBtn = document.getElementById('viewSlidesBtnTop');
  const stickyBtn = document.getElementById('viewSlidesBtnSticky');
  const data = getActiveReportData();

  if (!data.isValid) {
    displayGlobalToast('No research report available to generate slides yet. Please run research or select a report from history.');
    return;
  }

  const originalTop = topBtn ? topBtn.innerHTML : '';
  const originalSticky = stickyBtn ? stickyBtn.innerHTML : '';
  if (topBtn) {
    topBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Generating...</span>';
    topBtn.classList.add('loading');
  }
  if (stickyBtn) {
    stickyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Generating...</span>';
    stickyBtn.classList.add('loading');
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    openSlideDeck();
    displayGlobalToast('Presentation slides generated successfully!');
  } catch (err) {
    console.error('Failed to open slide deck:', err);
    displayGlobalToast('Failed to generate presentation slides: ' + (err.message || 'Unknown error'));
  } finally {
    if (topBtn) {
      topBtn.innerHTML = originalTop || '<i class="fa-solid fa-chalkboard-user"></i><span>Slides</span>';
      topBtn.classList.remove('loading');
    }
    if (stickyBtn) {
      stickyBtn.innerHTML = originalSticky || '<i class="fa-solid fa-chalkboard-user"></i><span>Slides</span>';
      stickyBtn.classList.remove('loading');
    }
  }
}
window.handleSlidesButtonClick = handleSlidesButtonClick;

function saveSlideDeckAsPdf() {
  displayGlobalToast('Preparing presentation slides for print / save...');
  window.print();
}
window.saveSlideDeckAsPdf = saveSlideDeckAsPdf;

function toggleAudioBriefingPlayer(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const container = document.getElementById('audioBriefingContainer');
  if (container) {
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof toggleAudioBriefing === 'function') {
      toggleAudioBriefing();
    }
  }
}
window.toggleAudioBriefingPlayer = toggleAudioBriefingPlayer;

function initGlobalSlideDeckModal() {
  const modal = document.getElementById('slideDeckModal');
  const overlay = document.getElementById('slideDeckOverlay');
  const closeBtn = document.getElementById('closeSlideDeckBtn');
  const prevBtn = document.getElementById('prevSlideBtn');
  const nextBtn = document.getElementById('nextSlideBtn');

  if (closeBtn) closeBtn.onclick = closeSlideDeck;
  if (overlay) overlay.onclick = closeSlideDeck;
  if (prevBtn) prevBtn.onclick = () => changeSlideDeckSlide(-1);
  if (nextBtn) nextBtn.onclick = () => changeSlideDeckSlide(1);

  document.addEventListener('keydown', (e) => {
    if (modal && modal.style.display !== 'none' && modal.classList.contains('active')) {
      if (e.key === 'ArrowLeft') changeSlideDeckSlide(-1);
      if (e.key === 'ArrowRight' || e.key === ' ') changeSlideDeckSlide(1);
      if (e.key === 'Escape') closeSlideDeck();
    }
  });
}
window.addEventListener('DOMContentLoaded', initGlobalSlideDeckModal);

function handleFooterConsoleClick(e) {
  if (e) e.preventDefault();
  if (window.InquireXRouter && window.InquireXRouter.getCurrentView() !== 'agent') {
    window.InquireXRouter.switchView('agent');
  }
  const taskInput = document.getElementById('task');
  if (taskInput) {
    taskInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    taskInput.focus();
  }
}
window.handleFooterConsoleClick = handleFooterConsoleClick;

function handleFooterStatusClick(e) {
  if (e) e.preventDefault();
  const wsBtn = document.getElementById('websocketPanelOpenBtn');
  if (wsBtn) wsBtn.click();
}
window.handleFooterStatusClick = handleFooterStatusClick;

// ==============================================================
// InquireX V2.0 -- View Router
// Manages 'home' vs 'agent' view transitions via data-view attr
// ==============================================================
const InquireXRouter = (() => {
    let _currentView = document.body.getAttribute('data-view') || 'home';

    function switchView(view) {
        if (view !== 'home' && view !== 'agent') return;

        _currentView = view;
        document.body.setAttribute('data-view', view);

        if (view === 'home') {
            // Hide export sidebar when returning to landing
            const sidebar = document.getElementById('exportSidebarPanel');
            if (sidebar) {
                sidebar.style.display = 'none';
                sidebar.classList.remove('visible');
            }
            const navExport = document.getElementById('navExportSuite');
            if (navExport) navExport.style.display = 'none';

            // Smooth scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (view === 'agent') {
            // Scroll to top of workspace
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // On mobile / tablet, start with sidebar collapsed for immediate search access
            if (window.innerWidth <= 960) {
                const sidebar = document.getElementById('researchSidebar');
                if (sidebar) sidebar.classList.add('collapsed');
            }

            // Auto-focus the research textarea after transition
            setTimeout(() => {
                const taskEl = document.getElementById('task');
                if (taskEl) taskEl.focus({ preventScroll: true });
            }, 320);
        }

        console.log('[InquireXRouter] View switched to:', view);
    }

    function toggleView() {
        switchView(_currentView === 'home' ? 'agent' : 'home');
    }

    function getCurrentView() { return _currentView; }

    return { switchView, toggleView, getCurrentView };
})();



window.InquireXRouter = InquireXRouter;





// Strip raw Markdown / unparsed symbols (*, ###, __) from UI text, badges, and labels

const stripMarkdown = (str) => {

  if (!str || typeof str !== 'string') return '';

  return str

    .replace(/^#+\s+/gm, '')            // ### headings

    .replace(/\*\*([^\*]+)\*\*/g, '$1')  // **bold**

    .replace(/\*([^\*]+)\*/g, '$1')      // *italic*

    .replace(/__([^_]+)__/g, '$1')        // __bold__

    .replace(/_([^_]+)_/g, '$1')          // _italic_

    .replace(/`([^`]+)`/g, '$1')          // `code`

    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](link)

    .replace(/<[^>]*>/g, '')            // html tags

    .replace(/^\s*[-*+]\s+/gm, '')      // bullets

    .trim();

};

window.stripMarkdown = stripMarkdown;



// Collapsible Left Sidebar Controller

function toggleResearchSidebar(open) {

  const sidebar = document.getElementById('researchSidebar');

  if (!sidebar) return;



  if (open === undefined) {

    sidebar.classList.toggle('collapsed');

  } else if (open) {

    sidebar.classList.remove('collapsed');

  } else {

    sidebar.classList.add('collapsed');

  }

}

window.toggleResearchSidebar = toggleResearchSidebar;





const InquireXResearcher = (() => {
  const GPTResearcher = undefined; // Alias placeholder inside scope



  let isResearchActive = false;



  let connectionTimeout = null;



  let conversationHistory = [];
  let activeResearchPrompt = '';



  let isInitialLoad = true; // Flag to track initial page load



  let cookiesEnabled = true; // Flag to track if cookies are enabled



  let allReports = ''; // Store all reports cumulatively



  let currentReport = ''; // Store the current report (will be overwritten)



  let isFirstReport = true; // Flag to track if this is the first report



  let chatContainer = null; // Global reference to chat container



  let lastRequestData = null; // Store the last request data for reconnection







  // Add WebSocket monitoring variables



  let socket = null;



  let connectionStartTime = null;



  let lastActivityTime = null;



  let connectionAttempts = 0;



  let messagesReceived = 0;



  let websocketMonitorInterval = null;



  let dispose_socket = null; // Re-add dispose_socket



  let reconnectAttempts = 0;



  let maxReconnectAttempts = 5;



  let reconnectInterval = 2000; // Start with 2 seconds



  // (Image state variables activeResearchImages, activeResearchImageUrls, seenImageSignatures declared at top)



  const clearResearchImages = () => {

    activeResearchImages = [];

    if (activeResearchImageUrls && activeResearchImageUrls.clear) activeResearchImageUrls.clear();

    if (seenImageSignatures && seenImageSignatures.clear) seenImageSignatures.clear();

    const imageContainer = document.getElementById('selectedImagesContainer');

    if (imageContainer) {

      imageContainer.innerHTML = '';

      imageContainer.style.setProperty('display', 'none', 'important');

    }

  };

  window.clearResearchImages = clearResearchImages;



  const init = () => {

    setReportReady(false);



    // Check if cookies are enabled



    checkCookiesEnabled();







    // Load history immediately on page load



    loadConversationHistory();







    // After a short delay, mark initial load as complete



    setTimeout(() => {



      isInitialLoad = false;



    }, 1000);







    // Setup form submission



    document.getElementById('researchForm').addEventListener('submit', (e) => {



      e.preventDefault();



      startResearch();



      return false;



    });







    const copyBtn = document.getElementById('copyToClipboard');

    if (copyBtn) {

      copyBtn.addEventListener('click', copyToClipboard);

    }







    // Add event listener for the top copy button



    const topCopyButton = document.getElementById('copyToClipboardTop');



    if (topCopyButton) {



      topCopyButton.addEventListener('click', copyToClipboard);



    }







    // Initialize expand buttons



    initExpandButtons();







    // Initialize history panel functionality



    initHistoryPanel();







    // Initialize WebSocket monitoring panel



    initWebSocketPanel();







    // Initialize MCP functionality



    initMCPSection();







    // Initialize Slide Deck Modal



    initSlideDeckModal();







    // Initialize Document Upload Section for Deployable Private RAG



    initDocumentUploadSection();



    // Initialize Research Options Full View Studio

    initOptionsFullView();

    initExportOverlaySuite();







    // Initialize Audio Briefing, LaTeX Export, Mind Map Controls, and PDF Fallbacks



    initAudioBriefing();



    initLatexExport();



    initMindMapControls();



    initPdfDownloadFallbacks();







    // The download bar is now fixed in place with CSS



    // No need to set display property here







    updateState('initial');







    // Initialize research icon to not spinning



    updateResearchIcon(false);







    // Hide loading overlay if it exists



    const loadingOverlay = document.getElementById('loadingOverlay');



    if (loadingOverlay) {



      loadingOverlay.classList.add('loading-hidden');



    }



  }







  // Check if cookies are enabled



  const checkCookiesEnabled = () => {



    try {



      // Try to set a test cookie



      document.cookie = "testcookie=1; path=/";



      const cookieEnabled = document.cookie.indexOf("testcookie") !== -1;







      if (!cookieEnabled) {



        console.warn("Cookies are disabled in this browser");



        cookiesEnabled = false;



        showToast("Cookies are disabled. History will use localStorage instead.", 5000);



      } else {



        // Clean up test cookie



        document.cookie = "testcookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";



        cookiesEnabled = true;



      }







      return cookieEnabled;



    } catch (e) {



      console.error("Error checking cookies:", e);



      cookiesEnabled = false;



      return false;



    }



  }







  // Initialize conversation history panel functionality



  const initHistoryPanel = () => {



    // Load history from cookie



    loadConversationHistory();







    // Setup history panel toggle button



    const historyPanelOpenBtn = document.getElementById('historyPanelOpenBtn');



    const historyPanel = document.getElementById('historyPanel');



    const historyPanelToggle = document.getElementById('historyPanelToggle');







    const openResearchHistoryPanel = (e) => {

      if (e) {

        e.preventDefault();

        e.stopPropagation();

      }

      loadConversationHistory();

      if (historyPanel) {

        historyPanel.classList.toggle('open');

      }

    };

    window.openResearchHistoryPanel = openResearchHistoryPanel;



    if (historyPanelOpenBtn) {

      historyPanelOpenBtn.addEventListener('click', openResearchHistoryPanel);

    }



    if (historyPanelToggle) {

      historyPanelToggle.addEventListener('click', (e) => {

        if (e) {

          e.preventDefault();

          e.stopPropagation();

        }

        if (historyPanel) historyPanel.classList.remove('open');

      });

    }



    // Close panel when clicking outside

    document.addEventListener('click', (e) => {

      const sidebarHistoryBtn = document.getElementById('sidebarHistoryBtn');

      if (historyPanel && historyPanel.classList.contains('open') &&

        !historyPanel.contains(e.target) &&

        e.target !== historyPanelOpenBtn &&

        !historyPanelOpenBtn?.contains(e.target) &&

        (!sidebarHistoryBtn || (e.target !== sidebarHistoryBtn && !sidebarHistoryBtn.contains(e.target)))) {

        historyPanel.classList.remove('open');

      }

    });







    // Setup search functionality



    const historySearch = document.getElementById('historySearch');



    const historySearchBtn = document.getElementById('historySearchBtn');







    if (historySearch && historySearchBtn) {



      historySearch.addEventListener('input', filterHistoryEntries);



      historySearchBtn.addEventListener('click', () => filterHistoryEntries());



    }







    // Setup sort functionality



    const historySortOrder = document.getElementById('historySortOrder');



    if (historySortOrder) {



      historySortOrder.addEventListener('change', () => {



        sortHistoryEntries(historySortOrder.value);



        renderHistoryEntries();



      });



    }







    // Setup clear history button



    const historyClearBtn = document.getElementById('historyClearBtn');



    if (historyClearBtn) {



      historyClearBtn.addEventListener('click', clearConversationHistory);



    }







    // Add action buttons to history panel



    const historyFilters = document.querySelector('.history-panel-filters');



    if (historyFilters) {



      // Create a container for the buttons



      const actionsContainer = document.createElement('div');



      actionsContainer.className = 'history-actions-container';







      // Add export history button with enhanced styling and tooltip



      const exportBtn = document.createElement('button');



      exportBtn.className = 'history-action-btn';



      exportBtn.title = 'Export research history to file';



      exportBtn.innerHTML = '<i class="fas fa-file-export"></i>';



      exportBtn.addEventListener('click', exportHistory);







      // Add import history button with enhanced styling and tooltip



      const importBtn = document.createElement('button');



      importBtn.className = 'history-action-btn';



      importBtn.title = 'Import research history from file';



      importBtn.innerHTML = '<i class="fas fa-file-import"></i>';



      importBtn.addEventListener('click', triggerImportHistory);







      // Add cookie debug button with enhanced styling and tooltip



      const debugBtn = document.createElement('button');



      debugBtn.className = 'history-action-btn';



      debugBtn.title = 'Check storage status';



      debugBtn.innerHTML = '<i class="fas fa-database"></i>';



      debugBtn.addEventListener('click', checkCookieStatus);







      // Add buttons to container in a logical order



      actionsContainer.appendChild(importBtn);



      actionsContainer.appendChild(exportBtn);



      actionsContainer.appendChild(debugBtn);







      // Create a hidden file input for importing



      const fileInput = document.createElement('input');



      fileInput.type = 'file';



      fileInput.id = 'historyFileInput';



      fileInput.accept = '.json';



      fileInput.style.display = 'none';



      fileInput.addEventListener('change', handleFileImport);







      // Add container and file input to filters



      historyFilters.appendChild(actionsContainer);



      historyFilters.appendChild(fileInput);



    }







    // Initial render of history entries



    renderHistoryEntries();



  }







  // Initialize WebSocket monitoring panel



  const initWebSocketPanel = () => {



    const websocketPanel = document.getElementById('websocketPanel');



    const websocketPanelOpenBtn = document.getElementById('websocketPanelOpenBtn');



    const websocketPanelToggle = document.getElementById('websocketPanelToggle');







    if (!websocketPanel || !websocketPanelOpenBtn || !websocketPanelToggle) {



      console.error("WebSocket panel elements not found");



      return;



    }







    console.log("Initializing WebSocket panel");







    // Ensure it starts hidden



    websocketPanel.classList.remove('open');







    const openSystemStatusPanel = (e) => {

      if (e) {

        e.preventDefault();

        e.stopPropagation();

      }

      if (websocketPanel) {

        websocketPanel.classList.toggle('open');

      }

    };

    window.openSystemStatusPanel = openSystemStatusPanel;



    websocketPanelOpenBtn.addEventListener('click', openSystemStatusPanel);



    websocketPanelToggle.addEventListener('click', (e) => {

      e.preventDefault();

      e.stopPropagation();

      console.log("Closing WebSocket panel");

      if (websocketPanel) websocketPanel.classList.remove('open');

    });



    // Close panel when clicking outside

    document.addEventListener('click', (e) => {

      const sidebarStatusBtn = document.getElementById('sidebarStatusBtn');

      if (websocketPanel && websocketPanel.classList.contains('open') &&

        !websocketPanel.contains(e.target) &&

        e.target !== websocketPanelOpenBtn &&

        !websocketPanelOpenBtn?.contains(e.target) &&

        (!sidebarStatusBtn || (e.target !== sidebarStatusBtn && !sidebarStatusBtn.contains(e.target)))) {

        websocketPanel.classList.remove('open');

      }

    });







    // Start periodic WebSocket status updates



    startWebSocketMonitoring();



  }







  // Start WebSocket monitoring



  const startWebSocketMonitoring = () => {



    console.log("Starting WebSocket monitoring");







    // Update status immediately



    updateWebSocketStatus();







    // Clear any existing interval



    if (websocketMonitorInterval) {



      clearInterval(websocketMonitorInterval);



    }







    // Update status every 2 seconds



    websocketMonitorInterval = setInterval(updateWebSocketStatus, 2000);



  }







  // Update WebSocket status in the panel



  const updateWebSocketStatus = () => {



    // Only proceed if the necessary elements exist



    const connectionStatusEl = document.getElementById('connectionStatus');



    const connectionIndicatorEl = document.getElementById('connectionIndicator');



    const researchStatusEl = document.getElementById('researchStatus');



    const connectionDurationEl = document.getElementById('connectionDuration');



    const lastActivityEl = document.getElementById('lastActivity');



    const readyStateEl = document.getElementById('readyState');



    const connectionAttemptsEl = document.getElementById('connectionAttempts');



    const messagesReceivedEl = document.getElementById('messagesReceived');



    const currentTaskEl = document.getElementById('currentTask');







    if (!connectionStatusEl || !connectionIndicatorEl) return;







    // Update connection status



    const socketStatus = getSocketStatus();



    connectionStatusEl.textContent = socketStatus.statusText;







    // Update indicator class



    connectionIndicatorEl.className = 'status-indicator';



    connectionIndicatorEl.classList.add(socketStatus.indicatorClass);







    // Update research status



    if (researchStatusEl) {



      researchStatusEl.textContent = isResearchActive ? 'Active' : 'Inactive';



    }







    // Update connection duration



    if (connectionDurationEl && connectionStartTime) {



      const duration = Math.floor((Date.now() - connectionStartTime) / 1000);



      connectionDurationEl.textContent = formatDuration(duration);



    } else if (connectionDurationEl) {



      connectionDurationEl.textContent = '-';



    }







    // Update last activity



    if (lastActivityEl && lastActivityTime) {



      const elapsed = Math.floor((Date.now() - lastActivityTime) / 1000);



      lastActivityEl.textContent = elapsed < 60 ? `${elapsed} sec ago` : formatDuration(elapsed) + ' ago';



    } else if (lastActivityEl) {



      lastActivityEl.textContent = '-';



    }







    // Update ReadyState



    if (readyStateEl && socket) {



      readyStateEl.textContent = getReadyStateText(socket.readyState);



    } else if (readyStateEl) {



      readyStateEl.textContent = '-';



    }







    // Update connection attempts



    if (connectionAttemptsEl) {



      connectionAttemptsEl.textContent = connectionAttempts.toString();



    }







    // Update messages received



    if (messagesReceivedEl) {



      messagesReceivedEl.textContent = messagesReceived.toString();



    }







    // Update current task



    if (currentTaskEl) {



      const taskInput = document.getElementById('task');



      const rawTask = (taskInput && taskInput.value) ? (taskInput.value.length > 30 ? taskInput.value.substring(0, 27) + '...' : taskInput.value) : '-';



      currentTaskEl.textContent = isResearchActive ? stripMarkdown(rawTask) : '-';



    }



  }







  // Get socket status object



  const getSocketStatus = () => {



    if (!socket) {



      return {



        statusText: 'Disconnected',



        indicatorClass: 'disconnected'



      };



    }







    switch (socket.readyState) {



      case WebSocket.CONNECTING:



        return {



          statusText: 'Connecting',



          indicatorClass: 'connecting'



        };



      case WebSocket.OPEN:



        return {



          statusText: 'Connected',



          indicatorClass: 'connected'



        };



      case WebSocket.CLOSING:



        return {



          statusText: 'Closing',



          indicatorClass: 'connecting'



        };



      case WebSocket.CLOSED:



      default:



        return {



          statusText: 'Disconnected',



          indicatorClass: 'disconnected'



        };



    }



  }







  // Get readable text for WebSocket readyState



  const getReadyStateText = (readyState) => {



    switch (readyState) {



      case WebSocket.CONNECTING:



        return '0 (Connecting)';



      case WebSocket.OPEN:



        return '1 (Open)';



      case WebSocket.CLOSING:



        return '2 (Closing)';



      case WebSocket.CLOSED:



        return '3 (Closed)';



      default:



        return `${readyState} (Unknown)`;



    }



  }







  // Format duration in seconds to human-readable string



  const formatDuration = (seconds) => {



    if (seconds < 60) {



      return `${seconds} sec`;



    } else if (seconds < 3600) {



      return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;



    } else {



      const hours = Math.floor(seconds / 3600);



      const minutes = Math.floor((seconds % 3600) / 60);



      return `${hours} hr ${minutes} min`;



    }



  }







  // Helper: get storage key scoped to current authenticated user



  const getHistoryStorageKey = () => {



    const userId = window.currentAuthUser && window.currentAuthUser.id ? window.currentAuthUser.id : 'default';



    return `conversationHistory_${userId}`;



  };







  const getReportHtmlKey = (timestamp) => {



    const userId = window.currentAuthUser && window.currentAuthUser.id ? window.currentAuthUser.id : 'default';



    return `reportHtml_${userId}_${timestamp}`;



  };







  // Load conversation history from storage (isolated per user)



  const loadConversationHistory = () => {
    try {
      const storageKey = getHistoryStorageKey();
      let storedHistory = null;

      // 1. Primary storage: check localStorage under scoped user storageKey
      try {
        storedHistory = localStorage.getItem(storageKey);
      } catch (e) {
        console.warn('Could not read from localStorage:', e);
      }

      // 2. Fallbacks if user key is empty or missing
      if (!storedHistory || storedHistory.trim() === '' || storedHistory.trim() === '[]') {
        try {
          if (storageKey !== 'conversationHistory_default') {
            storedHistory = localStorage.getItem('conversationHistory_default');
          }
          if (!storedHistory || storedHistory.trim() === '' || storedHistory.trim() === '[]') {
            storedHistory = localStorage.getItem('conversationHistory');
          }
        } catch (e) {}
      }

      // 3. Fallback to cookie only if localStorage is completely absent
      if (!storedHistory || storedHistory.trim() === '' || storedHistory.trim() === '[]') {
        const cookieVal = getCookie(storageKey) || getCookie('conversationHistory');
        if (cookieVal && cookieVal.trim() !== '' && cookieVal.trim() !== '[]') {
          storedHistory = cookieVal;
        }
      }

      if (storedHistory && storedHistory.trim() !== '' && storedHistory.trim() !== '[]') {
        try {
          const parsedHistory = JSON.parse(storedHistory);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            // Rehydrate reportHtml from localStorage using stored reportKey
            conversationHistory = parsedHistory.map(entry => {
              if (entry.reportKey) {
                try {
                  entry.reportHtml = localStorage.getItem(entry.reportKey) || '';
                } catch (e) {
                  entry.reportHtml = '';
                }
              }
              return entry;
            });
            console.debug('Loaded research history for ' + storageKey + ':', conversationHistory.length, 'items');

            // Migrate/persist into user storageKey so future loads are instant
            try {
              localStorage.setItem(storageKey, JSON.stringify(parsedHistory));
            } catch (e) {}
          } else {
            conversationHistory = [];
          }
        } catch (jsonError) {
          console.error('Invalid JSON in history storage:', jsonError);
          conversationHistory = [];
        }
      } else {
        conversationHistory = [];
      }
    } catch (error) {
      console.error('Error loading research history:', error);
      conversationHistory = [];
    }

    // Clean up oversized cookies to prevent 4KB header limit issues
    try {
      deleteCookie('conversationHistory');
      deleteCookie(getHistoryStorageKey());
    } catch (e) {}

    // Force render after loading
    renderHistoryEntries();
  };

  // Expose to window for external auth and navigation triggers
  window.loadConversationHistory = loadConversationHistory;

  // Save conversation history to localStorage (isolated per user, prune HTML to keep quota safe)
  const saveConversationHistory = () => {
    try {
      const storageKey = getHistoryStorageKey();
      if (!conversationHistory || conversationHistory.length === 0) {
        try { localStorage.removeItem(storageKey); } catch (e) {}
        console.debug('No history to save, deleted storage for', storageKey);
        return;
      }

      // Keep up to 25 entries in metadata list
      let storageHistory = [...conversationHistory];
      if (storageHistory.length > 25) {
        storageHistory = storageHistory.slice(0, 25);
      }

      // Save reportHtml to localStorage separately for top 8 recent entries to conserve 5MB quota
      storageHistory = storageHistory.map((entry, idx) => {
        const reportKey = entry.timestamp ? getReportHtmlKey(entry.timestamp) : '';
        if (entry.reportHtml && reportKey) {
          if (idx < 8) {
            try {
              localStorage.setItem(reportKey, entry.reportHtml);
            } catch (e) {
              console.warn('localStorage full, could not save report HTML:', e);
            }
          } else {
            // Prune HTML from older entries to prevent quota errors
            try { localStorage.removeItem(reportKey); } catch (e) {}
          }
        }
        return {
          prompt: entry.prompt || '',
          links: entry.links || {},
          images: Array.isArray(entry.images) ? entry.images : [],
          metrics: entry.metrics || {},
          reportKey: reportKey,
          timestamp: entry.timestamp || new Date().toISOString()
        };
      });

      const jsonString = JSON.stringify(storageHistory);

      // Save to primary user storageKey and global fallback key in localStorage
      try {
        localStorage.setItem(storageKey, jsonString);
        localStorage.setItem('conversationHistory', jsonString);
      } catch (e) {
        console.error('Error writing history to localStorage:', e);
        // If quota exceeded, purge older reportHtml_* entries and retry
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith('reportHtml_') && !storageHistory.slice(0, 3).some(s => s.reportKey === k)) {
              localStorage.removeItem(k);
            }
          });
          localStorage.setItem(storageKey, jsonString);
        } catch (retryErr) {
          console.error('Failed retry saving history to localStorage:', retryErr);
        }
      }

      // Clean up legacy cookies to prevent 4KB header limit issues
      try {
        deleteCookie('conversationHistory');
        deleteCookie(storageKey);
      } catch (e) {}

      if (storageHistory.length > 0 && !isInitialLoad) {
        showToast('Research history saved!');
      }
    } catch (error) {
      console.error('Error saving research history:', error);
    }
  };

  // Delete a history entry
  const deleteHistoryEntry = (index) => {



    if (confirm('Are you sure you want to delete this research entry?')) {



      const entry = conversationHistory[index];



      if (entry && entry.timestamp) {



        try { localStorage.removeItem(getReportHtmlKey(entry.timestamp)); } catch (e) {}



      }



      conversationHistory.splice(index, 1);



      saveConversationHistory();



      renderHistoryEntries();



      showToast('Entry deleted successfully');



    }



  };







  // Clear all conversation history



  const clearConversationHistory = () => {



    if (confirm('Are you sure you want to clear all research history? This cannot be undone.')) {



      conversationHistory.forEach(entry => {



        if (entry && entry.timestamp) {



          try { localStorage.removeItem(getReportHtmlKey(entry.timestamp)); } catch (e) {}



        }



      });



      conversationHistory = [];



      saveConversationHistory();



      renderHistoryEntries();



      showToast('Research history cleared successfully');



    }



  };







  // Filter history entries based on search term



  const filterHistoryEntries = () => {



    const searchTerm = document.getElementById('historySearch').value.toLowerCase();



    const historyEntries = document.getElementById('historyEntries');







    if (!historyEntries) return;







    const entries = historyEntries.querySelectorAll('.history-entry');







    entries.forEach(entry => {



      const title = entry.querySelector('.history-entry-title').textContent.toLowerCase();



      // Search only in the title since we no longer have preview text



      if (title.includes(searchTerm)) {



        entry.style.display = 'block';



      } else {



        entry.style.display = 'none';



      }



    });



  }







  // Sort history entries by timestamp



  const sortHistoryEntries = (order) => {



    conversationHistory.sort((a, b) => {



      // Default to newest first if timestamps don't exist



      if (!a.timestamp || !b.timestamp) return 0;







      if (order === 'newest') {



        return new Date(b.timestamp) - new Date(a.timestamp);



      } else {



        return new Date(a.timestamp) - new Date(b.timestamp);



      }



    });



  }







  // Render history entries in the panel



  const renderHistoryEntries = () => {



    const historyEntries = document.getElementById('historyEntries');



    if (!historyEntries) return;







    historyEntries.innerHTML = '';







    if (!conversationHistory || conversationHistory.length === 0) {



      historyEntries.innerHTML = '<p class="text-center mt-4 text-muted">No research history yet.</p>';



      return;



    }







    // Sort by the current selection



    const sortOrder = document.getElementById('historySortOrder')?.value || 'newest';



    sortHistoryEntries(sortOrder);



    console.debug('Sorted history entries:', sortOrder);







    conversationHistory.forEach((entry, index) => {



      const entryElement = document.createElement('div');



      entryElement.className = 'history-entry';



      entryElement.setAttribute('data-id', index);







      // Make the entire entry clickable to load it



      entryElement.addEventListener('click', () => {



        loadResearchEntry(index);



      });







      // Format timestamp if available



      let timestampHTML = '';



      if (entry.timestamp) {



        try {



          const timestamp = new Date(entry.timestamp);



          const formattedDate = timestamp.toLocaleDateString();



          const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });



          timestampHTML = `<span class="history-entry-timestamp">${formattedDate} ${formattedTime}</span>`;



        } catch (e) {



          console.error('Error formatting timestamp:', e);



        }



      }







      // Make sure links object exists



      const links = entry.links || {};







      // Build the HTML for the entry with enhanced formatting



      entryElement.innerHTML = `



        <div class="history-entry-header">



          <h4 class="history-entry-title">${entry.prompt || 'Unnamed Research'}</h4>



          ${timestampHTML}



        </div>



        <div class="history-entry-format">



          ${links.pdf ? `<a href="${links.pdf}" class="history-entry-action" target="_blank" title="Open PDF Report"><i class="fas fa-file-pdf"></i> PDF</a>` : ''}



          ${links.docx ? `<a href="${links.docx}" class="history-entry-action" target="_blank" title="Open Word Document"><i class="fas fa-file-word"></i> Word</a>` : ''}



          ${links.md ? `<a href="${links.md}" class="history-entry-action" target="_blank" title="Open Markdown File"><i class="fas fa-file-lines"></i> MD</a>` : ''}



          ${links.json ? `<a href="${links.json}" class="history-entry-action" target="_blank" title="Open JSON Data"><i class="fas fa-file-code"></i> JSON</a>` : ''}



        </div>



        <div class="history-entry-actions">



          <button class="history-entry-action delete-entry" title="Delete this research entry"><i class="fas fa-trash-alt"></i></button>



        </div>



      `;







      // Add action button handlers



      const deleteBtn = entryElement.querySelector('.delete-entry');



      if (deleteBtn) {



        deleteBtn.addEventListener('click', (e) => {



          e.stopPropagation();



          deleteHistoryEntry(index);



        });



      }







      historyEntries.appendChild(entryElement);



      setTimeout(() => {



        entryElement.style.animationDelay = `${index * 50}ms`;



      }, 0);



    });



  }







  // Load a research entry from history



  const loadResearchEntry = (index) => {



    const entry = conversationHistory[index];



    if (!entry) return;







    // Fill form with the entry data



    document.getElementById('task').value = entry.prompt;







    const reportTypeSelect = document.querySelector('select[name="report_type"]');



    if (reportTypeSelect && entry.reportType) {



        reportTypeSelect.value = entry.reportType;



    } else if (reportTypeSelect) {



        reportTypeSelect.value = reportTypeSelect.options[0].value;



    }







    const reportSourceSelect = document.querySelector('select[name="report_source"]');



    if (reportSourceSelect && entry.reportSource) {



        reportSourceSelect.value = entry.reportSource;



    } else if (reportSourceSelect) {



        reportSourceSelect.value = reportSourceSelect.options[0].value;



    }







    const toneSelect = document.querySelector('select[name="tone"]');



    if (toneSelect && entry.tone) {



        toneSelect.value = entry.tone;



    } else if (toneSelect) {



        toneSelect.value = toneSelect.options[0].value;



    }







    const queryDomainsInput = document.querySelector('input[name="query_domains"]');



    if (queryDomainsInput) {



        if (entry.queryDomains && Array.isArray(entry.queryDomains) && entry.queryDomains.length > 0) {



            queryDomainsInput.value = entry.queryDomains.join(', ');



        } else {



            queryDomainsInput.value = '';



        }



    }







    // Close the history panel



    const historyPanel = document.getElementById('historyPanel');



    if (historyPanel) {



        historyPanel.classList.remove('open');



    }







    // Restore research visual figures from history entry

    if (entry.images && Array.isArray(entry.images) && entry.images.length > 0) {

      activeResearchImages = [...entry.images];

      activeResearchImageUrls = new Set(activeResearchImages.map(i => i.url));

      renderImageGallery();

    } else if (entry.reportHtml) {

      // Fallback: extract images from saved report HTML

      const parser = new DOMParser();

      const doc = parser.parseFromString(entry.reportHtml, 'text/html');

      const foundImgs = doc.querySelectorAll('img');

      if (foundImgs.length > 0) {

        activeResearchImages = [];

        activeResearchImageUrls.clear();

        foundImgs.forEach(img => {

          if (img.src && !activeResearchImageUrls.has(img.src)) {

            activeResearchImageUrls.add(img.src);

            activeResearchImages.push({

              url: img.src,

              alt: img.alt || 'Research Figure',

              title: img.title || img.alt || 'Figure',

              domain: ''

            });

          }

        });

        renderImageGallery();

      } else {

        const imageContainer = document.getElementById('selectedImagesContainer');

        if (imageContainer) {

          imageContainer.innerHTML = '';

          imageContainer.style.display = 'none';

        }

      }

    }



    const safeHtml = typeof entry.reportHtml === 'string' && entry.reportHtml.trim() !== '' ? entry.reportHtml : (typeof entry.report === 'string' ? entry.report : '');



    // If we have saved report HTML, display it

    if (safeHtml) {

      setReportReady(true);

      // Ensure Research Progress card is visible above Verified Visuals
      const histProgress = document.getElementById('researchOutputContainer');
      if (histProgress) {
        histProgress.style.display = 'block';
      }

      // Restore the report content

      document.getElementById('reportContainer').innerHTML = safeHtml;

      document.getElementById('output').innerHTML = '';







      // Restore download links if available
      const links = entry.links || {};
      window.activeDownloadLinks = links;

      // Enable all export items since dynamic fallbacks are available
      ['downloadLinkTop', 'downloadLinkWordTop', 'downloadLinkMdTop', 'downloadLinkJsonTop', 'downloadLatexBtnTop'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('disabled');
      });

      if (links.pdf) {



        ['downloadLink', 'downloadLinkTop'].forEach(id => {



          const el = document.getElementById(id);



          if (el) { el.href = links.pdf; el.classList.remove('disabled'); }



        });



      }



      if (links.docx) {



        ['downloadLinkWord', 'downloadLinkWordTop'].forEach(id => {



          const el = document.getElementById(id);



          if (el) { el.href = links.docx; el.classList.remove('disabled'); }



        });



      }



      if (links.md) {



        ['downloadLinkMd', 'downloadLinkMdTop'].forEach(id => {



          const el = document.getElementById(id);



          if (el) { el.href = links.md; el.classList.remove('disabled'); }



        });



      }



      if (links.json) {



        ['downloadLinkJson', 'downloadLinkJsonTop'].forEach(id => {



          const el = document.getElementById(id);



          if (el) { el.href = links.json; el.classList.remove('disabled'); }



        });



      }







      // Show the sticky downloads bar



      const stickyDownloadsBar = document.getElementById('stickyDownloadsBar');



      if (stickyDownloadsBar) {



          stickyDownloadsBar.classList.add('visible');



      }







      // Show the report action buttons



      const reportActionsDivs = document.querySelectorAll('.report-actions');



      reportActionsDivs.forEach(el => el.style.display = 'block');







      // Show copy button in the header



      const topCopyButton = document.getElementById('copyToClipboardTop');



      if (topCopyButton) {



          topCopyButton.style.display = 'inline-block';



      }







      // Show "New Research" button



      showNewResearchButton();







      // Show Completed Pipeline Tracker



      setPipelineStep(5, 'Provenance verified & citations checked ✓', true);







      // Render Executive Research Metrics Card



      renderExecutiveMetrics(entry.reportHtml, entry.prompt, entry.metrics || null);







      // Render Concept Mind Map



      renderConceptGraph(entry.prompt, entry.reportHtml);







      // Setup AI Audio Briefing



      setupAudioBriefing(entry.reportHtml, entry.prompt);







      // Render SWOT Strategic Matrix



      renderSwotMatrix(entry.reportHtml);







      // Render Deep Dive Vectors



      renderDeepDiveVectors(entry.prompt, entry.reportHtml);







      // Enable Slide Deck Buttons



      const viewSlidesSticky = document.getElementById('viewSlidesBtnSticky');



      if (viewSlidesSticky) viewSlidesSticky.classList.remove('disabled');







      // Scroll to the report



      const reportContainer = document.querySelector('.report-container');



      if (reportContainer) {



          reportContainer.scrollIntoView({ behavior: 'smooth' });



      }







      showToast(`Loaded: "${entry.prompt}"`);



    } else {

      // Query loaded without cached report HTML - show informative restored query card instead of blank screen

      document.getElementById('output').innerHTML = '';

      const rContainer = document.getElementById('reportContainer');

      if (rContainer) {

        rContainer.innerHTML = `

          <div class="card p-4 text-center" style="max-width: 640px; margin: 30px auto; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">

            <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.2rem; color: #818cf8; margin-bottom: 12px; display: inline-block;"></i>

            <h5 style="color: #f8fafc; font-weight: 600; margin-bottom: 8px;">Previous Research Query Restored</h5>

            <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 16px;">

              Query "<strong>${escapeHtml(entry.prompt || '')}</strong>" has been restored to your search console. Click <strong>Start Research</strong> to run a fresh deep search.

            </p>

          </div>

        `;

      }

      if (!activeResearchImages || activeResearchImages.length === 0) {

        const imgCont = document.getElementById('selectedImagesContainer');

        if (imgCont) {

          imgCont.innerHTML = '';

          imgCont.style.display = 'none';

        }

      }







      const stickyDownloadsBar = document.getElementById('stickyDownloadsBar');



      if (stickyDownloadsBar) {



          stickyDownloadsBar.classList.remove('visible');



      }



      const chatContainer = document.getElementById('chatContainer');



      if (chatContainer) {



          chatContainer.style.display = 'none';



      }







      updateState('initial');







      const formElement = document.getElementById('form');



      if (formElement) {



          formElement.scrollIntoView({ behavior: 'smooth' });



      }







      showToast('Research parameters loaded. Click "Begin Research" to run again.');



    }



  }











  // Copy entry content to clipboard



  const copyEntryToClipboard = (index) => {



    const entry = conversationHistory[index];



    if (!entry || !entry.content) return;







    const textarea = document.createElement('textarea');



    textarea.value = entry.content;



    document.body.appendChild(textarea);



    textarea.select();



    document.execCommand('copy');



    document.body.removeChild(textarea);







    // Show a toast notification



    showToast('Research content copied to clipboard!');



  }







  // Show a toast notification



  const showToast = (message, duration = 3000) => {



    // Create toast element if it doesn't exist



    let toast = document.getElementById('toast-notification');



    if (!toast) {



      toast = document.createElement('div');



      toast.id = 'toast-notification';



      toast.className = 'toast-notification';



      document.body.appendChild(toast);



    }







    // Set message and show



    toast.textContent = message;



    toast.classList.add('show');







    // Hide after specified duration



    setTimeout(() => {



      toast.classList.remove('show');



    }, duration);



  }







  // Save current research to history (minimal: prompt and links only)



  const saveToHistory = (report, downloadLinks, reportHtml) => {
    const prompt = activeResearchPrompt || (document.getElementById('task')?.value || '').trim() || 'Research Report';

    // Create links object safely without dropping history if links are absent
    const links = {
      pdf: (downloadLinks && downloadLinks.pdf) || '',
      docx: (downloadLinks && downloadLinks.docx) || '',
      md: (downloadLinks && downloadLinks.md) || '',
      json: (downloadLinks && downloadLinks.json) || ''
    };

    console.debug('Saving history with links:', links);

    const elapsed = activeResearchStats && activeResearchStats.startTime && activeResearchStats.endTime
      ? Math.round((activeResearchStats.endTime - activeResearchStats.startTime) / 1000)
      : 0;

    const rawHtml = typeof reportHtml === 'string' && reportHtml.trim() !== ''
      ? reportHtml
      : (typeof report === 'string' ? report : (document.getElementById('reportContainer')?.innerHTML || ''));

    // Create history entry with timestamp & genuine provenance metrics
    const historyEntry = {
      prompt,
      links,
      reportHtml: rawHtml,
      images: Array.isArray(activeResearchImages) ? [...activeResearchImages] : [],
      timestamp: new Date().toISOString(),
      metrics: {
        elapsedSec: elapsed,
        scrapedCount: activeResearchStats ? activeResearchStats.scrapedSources.size : 0,
        subqueriesCount: activeResearchStats ? activeResearchStats.subqueries.length : 0
      }
    };

    if (!conversationHistory) {
      conversationHistory = [];
    }

    conversationHistory.unshift(historyEntry);
    saveConversationHistory();
    renderHistoryEntries();
  };

  // Function to update the research icon spinning state



  const updateResearchIcon = (isSpinning) => {



    const modernSpinner = document.getElementById('modernSpinner');



    if (modernSpinner) {



      if (isSpinning) {



        modernSpinner.classList.add('spinning');



      } else {



        modernSpinner.classList.remove('spinning');



      }



    }



  };







  let activeResearchStats = {



    startTime: null,



    endTime: null,



    scrapedSources: new Set(),



    subqueries: [],



    agentName: '',



  };







  const startResearch = () => {
    activeResearchPrompt = (document.getElementById('task')?.value || '').trim();
    activeResearchStats = {



      startTime: Date.now(),



      endTime: null,



      scrapedSources: new Set(),



      subqueries: [],



      agentName: '',



    };



    document.getElementById('output').innerHTML = ''



    document.getElementById('reportContainer').innerHTML = ''



    dispose_socket?.() // Call previous dispose function if it exists







    // Explicitly reset report ready state & close any open dropdowns

    setReportReady(false);

    toggleExportDropdown(false);



    // Reset report variables

    allReports = '';



    currentReport = '';



    isFirstReport = true;



    lastRequestData = null; // Clear stale request data so reconnection guard doesn't block new task







    // Hide export suites during new research run

    const sidebarPanel = document.getElementById('exportSidebarPanel');

    if (sidebarPanel) {

      sidebarPanel.classList.remove('visible');

      sidebarPanel.style.display = 'none';

    }

    const stickyDownloadsBar = document.getElementById('stickyDownloadsBar');

    if (stickyDownloadsBar) {

      stickyDownloadsBar.classList.remove('visible');

      stickyDownloadsBar.style.display = 'none';

    }

    const navExportSuite = document.getElementById('navExportSuite');

    if (navExportSuite) {

      navExportSuite.style.display = 'none';

    }







    // Hide the chat container



    chatContainer = document.getElementById('chatContainer');



    if (chatContainer) {



      chatContainer.style.display = 'none';



    }







    const imageContainer = document.getElementById('selectedImagesContainer')



    if (imageContainer) {



      imageContainer.innerHTML = ''



      imageContainer.style.display = 'none'



    }



    activeResearchImages = [];

    activeResearchImageUrls.clear();



    // -- V2.0 Extended State Reset --

    const _swotCont = document.getElementById('swotMatrixContainer');

    if (_swotCont) _swotCont.style.display = 'none';

    const _swotGrid = document.getElementById('swotGrid');

    if (_swotGrid) _swotGrid.innerHTML = '';



    const _deepDive = document.getElementById('deepDiveContainer');

    if (_deepDive) _deepDive.style.display = 'none';

    const _deepPills = document.getElementById('deepDivePills');

    if (_deepPills) _deepPills.innerHTML = '';



    const _mindMap = document.getElementById('mindMapContainer');

    if (_mindMap) _mindMap.style.display = 'none';

    const _hierView = document.getElementById('hierarchyMapView');

    if (_hierView) _hierView.innerHTML = '';



    const _reportActions = document.getElementById('reportActions');

    if (_reportActions) _reportActions.style.display = 'none';

    const _reportActionsTop = document.querySelector('.report-actions');

    if (_reportActionsTop) _reportActionsTop.style.display = 'none';

    const _copyBtnTop = document.getElementById('copyToClipboardTop');

    if (_copyBtnTop) _copyBtnTop.style.display = 'none';



    const _audioBrf = document.getElementById('audioBriefingContainer');

    if (_audioBrf) _audioBrf.style.display = 'none';



    const _metrics = document.getElementById('executiveMetricsContainer');

    if (_metrics) _metrics.style.display = 'none';



    // Reset pipeline tracker UI to Step 1 state

    const _tracker = document.getElementById('agentPipelineTracker');

    if (_tracker) {

        _tracker.querySelectorAll('.pipeline-step').forEach(s => {

            s.classList.remove('active', 'completed', 'error');

        });

        _tracker.querySelectorAll('.pipeline-connector').forEach(c => {

            c.classList.remove('active', 'completed');

        });

    }





    seenImageSignatures.clear();







    // Hide metrics and mind map during new research



    const metricsContainer = document.getElementById('executiveMetricsContainer');



    if (metricsContainer) metricsContainer.style.display = 'none';



    const mindMapEl = document.getElementById('mindMapContainer');



    if (mindMapEl) mindMapEl.style.display = 'none';







    // Initialize the visual agent pipeline tracker



    setPipelineStep(1, 'Decomposing topic into sub-queries...');

    const heroStopBtn = document.getElementById('stopResearchHeroBtn');
    if (heroStopBtn) {
      heroStopBtn.disabled = false;
      heroStopBtn.style.display = 'inline-flex';
      heroStopBtn.classList.add('pulse-active');
    }

    const headerStopBtn = document.getElementById('stopResearchHeaderBtn');
    if (headerStopBtn) headerStopBtn.style.display = 'inline-flex';

    const submitBtn = document.getElementById('submitButton');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
    }







    updateState('in_progress')







    addAgentResponse({



      output: '🧙‍♂️ Gathering information and analyzing your research topic...',



    })







    // Scroll to the "Research Progress" section



    const researchOutputContainer = document.getElementById('researchOutputContainer') || document.querySelector('.research-output-container');



    if (researchOutputContainer) {

        researchOutputContainer.style.display = 'block';

        researchOutputContainer.scrollIntoView({



            behavior: 'smooth',



            block: 'start'



        });



    }







    dispose_socket = listenToSockEvents() // Assign the new dispose function



  }

  const resetResearchControls = () => {
    const heroBtn = document.getElementById('stopResearchHeroBtn');
    if (heroBtn) {
      heroBtn.disabled = true;
      heroBtn.style.display = 'none';
      heroBtn.classList.remove('pulse-active');
    }
    const headerBtn = document.getElementById('stopResearchHeaderBtn');
    if (headerBtn) {
      headerBtn.style.display = 'none';
    }
    const submitBtn = document.getElementById('submitButton');
    if (submitBtn) {
      submitBtn.style.display = 'inline-flex';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  };
  window.resetResearchControls = resetResearchControls;

  const stopResearch = () => {
    console.log("Stopping research requested by user...");

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      try {
        socket.send("stop");
      } catch (e) {
        console.warn("Could not send stop over socket:", e);
      }
    }

    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }

    isResearchActive = false;
    updateResearchIcon(false);

    resetResearchControls();

    addAgentResponse({
      type: 'logs',
      content: 'research_stopped',
      output: '🛑 <strong>Research halted by user.</strong> You can modify your research topic or settings and begin research again whenever you are ready.'
    });

    const activeStep = document.querySelector('.pipeline-step.active');
    if (activeStep) {
      activeStep.classList.remove('active');
      activeStep.classList.add('error');
      const stepStatus = activeStep.querySelector('.step-status');
      if (stepStatus) {
        stepStatus.textContent = 'Halted by user 🛑';
      }
    }
  };

  window.stopResearch = stopResearch;







  const listenToSockEvents = () => {



    const { protocol, host, pathname } = window.location



    const ws_uri = `${protocol === 'https:' ? 'wss:' : 'ws:'



      }//${host}${pathname}ws`







    // Set a timeout for connection - if it takes too long, stop the spinner



    connectionTimeout = setTimeout(() => {



      updateResearchIcon(false);



      console.log("WebSocket connection timed out");



    }, 10000); // 10 seconds timeout







    // Configure Showdown converter to properly handle code blocks



    const converter = new showdown.Converter({

      ghCodeBlocks: true,         // GitHub style code blocks

      tables: true,               // Enable tables

      tasklists: true,            // Enable task lists

      smartIndentationFix: true,  // Fix weird indentation

      simpleLineBreaks: true,     // Treat newlines as <br>

      openLinksInNewWindow: true, // Open links in new tab

      parseImgDimensions: true,   // Parse image dimensions from markdown

      simplifiedAutoLink: true    // Automatically turn URLs in text into hyperlinks

    });







    // Fix issues with code block formatting



    converter.setOption('literalMidWordUnderscores', true);







    // Increment connection attempts counter



    connectionAttempts++;







    // Update WebSocket status



    updateWebSocketStatus();







    socket = new WebSocket(ws_uri)



    let reportContent = ''; // Store the report content for history



    let downloadLinkData = null; // Store download links







    socket.onmessage = (event) => {



      // Reset reconnect attempts on successful message



      reconnectAttempts = 0;







      const data = JSON.parse(event.data)



      console.log("Received message:", data);  // Debug log







      // Update WebSocket metrics



      messagesReceived++;



      lastActivityTime = Date.now();



      updateWebSocketStatus();







      if (data.type === 'logs') {
        if (!window.sessionLogRecords) window.sessionLogRecords = [];
        window.sessionLogRecords.push({
          timestamp: new Date().toISOString(),
          type: data.type,
          content: data.content,
          output: data.output,
          metadata: data.metadata
        });

        if (data.content === 'subqueries' && data.metadata && Array.isArray(data.metadata)) {



          displaySubQuestions(data.metadata)



          if (activeResearchStats) activeResearchStats.subqueries = data.metadata;



        } else if (data.content === 'scraping_images' && data.metadata && Array.isArray(data.metadata)) {



          displaySelectedImages({ output: data.metadata })



        } else if (data.content === 'added_source_url' && data.metadata) {



          if (activeResearchStats) activeResearchStats.scrapedSources.add(data.metadata);



        } else if (data.content === 'agent_generated' && data.output) {



          if (activeResearchStats) activeResearchStats.agentName = data.output.replace(/^[^\w\s]+/, '').trim();



        } else if (data.content === 'research_stopped') {
          isResearchActive = false;
          updateResearchIcon(false);
          resetResearchControls();
        }



        addAgentResponse(data)



      } else if (data.type === 'images') {



        console.log("Received images:", data);  // Debug log



        displaySelectedImages(data)



      } else if (data.type === 'report') {



        // Accumulate raw markdown for clean rendering



        reportContent += data.output;



        allReports += data.output;







        // Render the full accumulated markdown on each token stream so markdown syntax never fragments



        writeReport({ output: allReports, type: 'report' }, converter, false, false);



      } else if (data.type === 'path') {

        if (activeResearchStats) activeResearchStats.endTime = Date.now();

        // Ensure Research Progress card remains visible in DOM
        const streamProgressCard = document.getElementById('researchOutputContainer');
        if (streamProgressCard) {
          streamProgressCard.style.display = 'block';
        }



        // 1. Finalize clean report rendering FIRST so reportContainer has complete HTML and references

        if (allReports) {

          writeReport({ output: allReports, type: 'report' }, converter, true, false);

        }



        // 2. Transition state to finished and compute genuine metrics from complete report DOM

        updateState('finished');

        downloadLinkData = updateDownloadLink(data);

        isResearchActive = false;







        // Save to history now that research is complete
        const containerHtml = document.getElementById('reportContainer')?.innerHTML || '';
        const reportContentToSave = reportContent || allReports || containerHtml;
        saveToHistory(reportContentToSave, downloadLinkData || {}, containerHtml);

        // Reset variables for next research session
        reportContent = '';
        allReports = '';
        currentReport = '';
        isFirstReport = true;







        // Update WebSocket status



        updateWebSocketStatus();



      } else if (data.type === 'status' && data.status === 'stopped') {
        isResearchActive = false;
        updateResearchIcon(false);
        resetResearchControls();
      } else if (data.type === 'chat') {



        // Handle chat messages from the AI



        // Remove loading indicator and add AI's response



        const loadingElements = document.querySelectorAll('.chat-loading');



        if (loadingElements.length > 0) {



          loadingElements[loadingElements.length - 1].remove();



        }







        // Add AI message to chat



        if (data.content) {



          addChatMessage(data.content, false);



        }



      }



    }







    socket.onopen = (event) => {



      // Clear the connection timeout



      clearTimeout(connectionTimeout);







      // Update WebSocket metrics



      connectionStartTime = Date.now();



      lastActivityTime = Date.now();



      updateWebSocketStatus();







      // Reset reconnect attempts on successful connection



      reconnectAttempts = 0;







      // Ensure the research icon is spinning when connection is established



      updateResearchIcon(true);







      // If this is a reconnection and we're in research mode, don't send a new start command



      if (isResearchActive && lastRequestData) {



        console.log("Reconnected during active research, not sending new start command");



        return;



      }







      const task = document.getElementById('task').value



      const report_type = document.querySelector(



        'select[name="report_type"]'



      ).value



      const report_source = document.querySelector(



        'select[name="report_source"]'



      ).value



      const tone = document.querySelector('select[name="tone"]').value



      const agent = document.querySelector('input[name="agent"]:checked').value



      let source_urls = tags







      if (report_source !== 'sources' && source_urls.length > 0) {



        source_urls = source_urls.slice(0, source_urls.length - 1)



      }







      const query_domains_str = document.querySelector('input[name="query_domains"]').value



      let query_domains = []



      if (query_domains_str) {



        query_domains = query_domains_str.split(',')



          .map((domain) => domain.trim().replace(/^https?:\/\//i, '').split('/')[0].trim().toLowerCase())



          .filter((domain) => domain.length > 0);



      }







      const requestData = {



        task: task,



        report_type: report_type,



        report_source: report_source,



        source_urls: source_urls,



        tone: tone,



        agent: agent,



        query_domains: query_domains,



        max_search_results: parseInt(document.getElementById('maxSearchResults').value, 10) || 5,



      }







      // Add MCP configuration if enabled



      const mcpData = collectMCPData();



      if (mcpData) {



        Object.assign(requestData, mcpData);



        console.log('Including MCP configuration:', mcpData);



      }







      // Store the request data for potential reconnection



      lastRequestData = requestData;







      socket.send(`start ${JSON.stringify(requestData)}`)



    }







    socket.onclose = (event) => {



      // Update metrics and status when connection closes



      connectionStartTime = null;



      updateWebSocketStatus();







      console.log("WebSocket connection closed", event);







      // If research is active, try to automatically reconnect



      if (isResearchActive) {



        reconnectWebSocket();



      }



    }







    socket.onerror = (error) => {



      console.error("WebSocket error:", error);



      updateWebSocketStatus();



    }







    // return dispose function



    return () => {



      try {



        isResearchActive = false; // Mark research as inactive



        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {



          socket.close();



        }







        // Update metrics on socket disposal



        connectionStartTime = null;



        updateWebSocketStatus();



      } catch (e) {



        console.error('Error closing socket:', e)



      }



    };



  }







  // Sanitize HTML before inserting it into the DOM. Report and agent content is



  // derived from untrusted sources (scraped web pages and LLM output), so it



  // must be sanitized to prevent cross-site scripting (XSS).



  const sanitizeHtml = (html) => {



    if (typeof DOMPurify !== 'undefined') {



      return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });



    }



    // Defensive fallback if DOMPurify failed to load: escape everything.



    console.warn('DOMPurify not loaded; escaping content as a fallback.');



    const tmp = document.createElement('div');



    tmp.textContent = html;



    return tmp.innerHTML;



  };







  const addAgentResponse = (data) => {



    const output = document.getElementById('output');



    const responseDiv = document.createElement('div');



    responseDiv.className = 'agent_response';



    responseDiv.innerHTML = sanitizeHtml(data.output);



    output.appendChild(responseDiv);



    output.scrollTop = output.scrollHeight;



    output.style.display = 'block';







    // Intelligently advance pipeline tracker based on real-time agent log events



    const text = String(data.output || '');



    if (text.includes('Running research for') || text.includes('Scraped') || text.includes('Getting relevant content')) {



      setPipelineStep(2, 'Parallel web scraping active...');



    } else if (text.includes('Combined context') || text.includes('Scraped data size') || text.includes('Finalized research step')) {



      setPipelineStep(3, 'Cosine vector compression & filtering...');



    } else if (text.includes('Writing report for')) {



      setPipelineStep(4, 'Synthesizing citation-grounded report...');



    }



  }







  const displaySubQuestions = (questions) => {



    const output = document.getElementById('output');



    const container = document.createElement('div');



    container.className = 'sub-questions';







    const heading = document.createElement('p');



    heading.className = 'sub-questions-heading';



    heading.textContent = '🤔 Pondering your question from several angles';



    container.appendChild(heading);







    const list = document.createElement('div');



    list.className = 'sub-questions-list';



    questions.forEach((q) => {



      const pill = document.createElement('span');



      pill.className = 'sub-question-pill';



      pill.textContent = q;



      list.appendChild(pill);



    });



    container.appendChild(list);







    output.appendChild(container);



    output.scrollTop = output.scrollHeight;



    output.style.display = 'block';



  }







  const cleanThinkTags = (text) => {



    if (!text || typeof text !== 'string') return '';



    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();



  };







  const writeReport = (data, converter, isFinal = false, append = false) => {



    const reportContainer = document.getElementById('reportContainer');







    const cleanMarkdown = cleanThinkTags(data.output);



    if (!cleanMarkdown && !isFinal) return;







    // Convert markdown to HTML, then sanitize to prevent XSS from untrusted



    // report content (scraped pages / LLM output).



    const markdownOutput = sanitizeHtml(converter.makeHtml(cleanMarkdown));







    // If this is the final report or we should append



    if (isFinal) {



      // For final reports, always replace content



      reportContainer.innerHTML = markdownOutput;



    } else if (append) {



      // Append mode - add to existing content



      reportContainer.innerHTML += markdownOutput;



    } else {



      // Replace mode - overwrite existing content



      reportContainer.innerHTML = markdownOutput;



    }







    // Auto-scroll to the bottom of the container



    enhanceReportImages(reportContainer);



    reportContainer.scrollTop = reportContainer.scrollHeight;



  }







  const updateDownloadLink = (data) => {



    if (!data.output) {



      console.error('No output data received');



      return;



    }







    const { pdf, docx, md, json } = data.output;



    console.log('Received paths:', { pdf, docx, md, json });







    const ensureRoot = (p) => {



      if (!p) return '';



      return (p.startsWith('/') || p.startsWith('http')) ? p : `/${p}`;



    };







    const currentLinks = {



      pdf: ensureRoot(pdf),



      docx: ensureRoot(docx),



      md: ensureRoot(md),
      json: ensureRoot(json)
    };

    window.activeDownloadLinks = currentLinks;

    // Enable all export options since client-side fallback is guaranteed
    ['downloadLinkTop', 'downloadLinkWordTop', 'downloadLinkMdTop', 'downloadLinkJsonTop', 'downloadLatexBtnTop'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('disabled');
    });







    // Helper function to safely update link



    const updateLink = (id, path) => {



      const element = document.getElementById(id);



      if (element && path) {



        element.setAttribute('href', path);



        element.setAttribute('download', '');



        element.classList.remove('disabled');



      }



    };







    // Update links in sticky download bar



    updateLink('downloadLink', currentLinks.pdf);



    updateLink('downloadLinkWord', currentLinks.docx);



    updateLink('downloadLinkMd', currentLinks.md);



    updateLink('downloadLinkJson', currentLinks.json);



    // Update fixed top navbar export suite links

    updateLink('navExportPdf', currentLinks.pdf);

    updateLink('navExportWord', currentLinks.docx);

    updateLink('navExportMd', currentLinks.md);

    updateLink('navExportJson', currentLinks.json);







    // Update duplicate buttons above the report



    updateLink('downloadLinkTop', currentLinks.pdf);



    updateLink('downloadLinkWordTop', currentLinks.docx);



    updateLink('downloadLinkMdTop', currentLinks.md);



    updateLink('downloadLinkJsonTop', currentLinks.json);







    // Make sure download buttons are visible when download links are ready



    showDownloadPanels();







    // Return links for history saving



    return currentLinks;



  };







  const initPdfDownloadFallbacks = () => {



    ['downloadLink', 'downloadLinkTop'].forEach(id => {



      const btn = document.getElementById(id);



      if (btn) {



        btn.addEventListener('click', (e) => {



          const href = btn.getAttribute('href');



          if (!href || href === '#' || href === 'javascript:void(0)') {



            e.preventDefault();



            const reportContainer = document.getElementById('reportContainer');



            if (reportContainer && reportContainer.textContent.trim()) {



              showToast('Generating print-ready PDF...');



              window.print();



            } else {



              showToast('No report content available to export as PDF.');



            }



          }



        });



      }



    });



  };







  const copyToClipboard = () => {



    const textarea = document.createElement('textarea')



    textarea.id = 'temp_element'



    textarea.style.height = 0



    document.body.appendChild(textarea)



    textarea.value = document.getElementById('reportContainer').innerText



    const selector = document.querySelector('#temp_element')



    selector.select()



    document.execCommand('copy')



    document.body.removeChild(textarea)







    // Show a temporary success message with icon change and toast notification



    const copyBtn = document.getElementById('copyToClipboard');



    const copyBtnTop = document.getElementById('copyToClipboardTop');







    // Function to reset the icon for both buttons



    const resetIcons = () => {



      if (copyBtn) {



        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';



      }



      if (copyBtnTop) {



        copyBtnTop.innerHTML = '<i class="fas fa-copy"></i>';



      }



    };







    // Change to green check mark



    if (copyBtn) {



      copyBtn.innerHTML = '<i class="fas fa-check" style="color: green;"></i> Copied!';



    }



    if (copyBtnTop) {



      copyBtnTop.innerHTML = '<i class="fas fa-check" style="color: green;"></i>';



    }







    // Show toast notification



    showToast('Copied to clipboard!');







    // Reset the button after 3 seconds



    setTimeout(resetIcons, 3000);



  }











  // Show the "New Research" button below the report



  const showNewResearchButton = () => {



    let btn = document.getElementById('newResearchBtn');



    if (!btn) {



      btn = document.createElement('button');



      btn.id = 'newResearchBtn';



      btn.className = 'btn btn-primary new-research-btn';



      btn.innerHTML = '<i class="fas fa-plus-circle"></i> New Research';



      btn.addEventListener('click', () => {

        // Clear everything including previous research images

        clearResearchImages();

        document.getElementById('output').innerHTML = '';

        document.getElementById('reportContainer').innerHTML = '';

        document.getElementById('task').value = '';

        setReportReady(false);

        toggleExportDropdown(false);



        const stickyDownloadsBar = document.getElementById('stickyDownloadsBar');

        if (stickyDownloadsBar) stickyDownloadsBar.classList.remove('visible');



        const chatEl = document.getElementById('chatContainer');

        if (chatEl) chatEl.style.display = 'none';



        updateState('initial');



        const formElement = document.getElementById('form');

        if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });



        document.getElementById('task').focus();

      });



      // Insert after the report container section



      const reportContainer = document.querySelector('.report-container');



      if (reportContainer) {



        reportContainer.insertAdjacentElement('afterend', btn);



      }



    }



    btn.style.display = 'inline-flex';



  }







  // Hide the "New Research" button



  const hideNewResearchButton = () => {



    const btn = document.getElementById('newResearchBtn');



    if (btn) btn.style.display = 'none';



  }







  // --- 1. Agent Pipeline Tracker ---



  const setPipelineStep = (stepNumber, statusText, isFinal = false) => {



    const tracker = document.getElementById('agentPipelineTracker');



    if (tracker) tracker.style.display = 'flex';



    



    for (let i = 1; i <= 5; i++) {



      const stepEl = document.getElementById(`step-${getStepId(i)}`);



      const connEl = document.getElementById(`conn-${i}`);



      const statusEl = document.getElementById(`status-step-${i}`);



      



      if (!stepEl) continue;



      



      if (i < stepNumber || (i === 5 && (stepNumber >= 5 || isFinal))) {



        stepEl.classList.remove('active');



        stepEl.classList.add('completed');



        if (connEl) connEl.classList.add('completed');



        if (statusEl) {



          if (i === 5) {



            statusEl.textContent = statusText || 'Citation checked ✓';



          } else if (!statusEl.textContent.includes('✓')) {



            statusEl.textContent = 'Completed ✓';



          }



        }



      } else if (i === stepNumber && !isFinal) {



        stepEl.classList.add('active');



        stepEl.classList.remove('completed');



        if (connEl) connEl.classList.remove('completed');



        if (statusText && statusEl) {



          statusEl.textContent = stripMarkdown(statusText);



        }



      } else {



        stepEl.classList.remove('active', 'completed');



        if (connEl) connEl.classList.remove('completed');



      }



    }



  };







  const getStepId = (index) => {



    switch (index) {



      case 1: return 'plan';



      case 2: return 'scrape';



      case 3: return 'rag';



      case 4: return 'synthesis';



      case 5: return 'verify';



      default: return 'plan';



    }



  };







  const resetPipelineTracker = () => {



    const tracker = document.getElementById('agentPipelineTracker');



    if (tracker) tracker.style.display = 'none';



    for (let i = 1; i <= 5; i++) {



      const stepEl = document.getElementById(`step-${getStepId(i)}`);



      const connEl = document.getElementById(`conn-${i}`);



      if (stepEl) stepEl.classList.remove('active', 'completed');



      if (connEl) connEl.classList.remove('completed');



    }



  };







  // --- 2. Executive Research Metrics Card (100% Genuine Provenance & Verified Data) ---



  const renderExecutiveMetrics = (reportHtml, query, sessionStats = null) => {

    const container = document.getElementById('executiveMetricsContainer');

    if (!container) return;



    if (!reportHtml || typeof reportHtml !== 'string' || reportHtml.trim() === '') {

      container.style.display = 'none';

      return;

    }



    // Parse DOM

    const tempDiv = document.createElement('div');

    tempDiv.innerHTML = reportHtml;



    // 1. Accurate Word Count (excluding scripts, styles, buttons, svg, img, and markdown artifacts)

    const clone = tempDiv.cloneNode(true);

    clone.querySelectorAll('script, style, button, svg, img, noscript, nav, header, footer').forEach(el => el.remove());

    const rawText = clone.textContent || clone.innerText || '';

    // Strip standalone markdown punctuation, table pipes, and delimiters

    const cleanText = rawText.replace(/[\#\*\_\`\|\~\>\-\=\+\[\]\(\)\{\}\:\;]/g, ' ');

    // Filter tokens that contain actual alphanumeric characters

    const words = cleanText.trim().split(/\s+/).filter(w => /[a-zA-Z0-9\u00C0-\u024F\u4E00-\u9FFF]/.test(w));

    const wordCount = words.length;



    // 2. Accurate Human Reading Time

    // Standard silent reading speed for technical/informational reports is 240 WPM (Brysbaert et al. empirical standard).

    // Math.round accurately represents ~5 min for 1,367 words (1,367 / 240 = 5.69 min), avoiding artificial inflation from Math.ceil.

    const calculatedMinutes = Math.round(wordCount / 240);

    const readTimeMinutes = Math.max(1, calculatedMinutes);



    // 3. Genuine Sources Explored Total

    const scrapedTotal = (sessionStats && sessionStats.scrapedCount) || 

                         (typeof activeResearchStats !== 'undefined' && activeResearchStats.scrapedSources && activeResearchStats.scrapedSources.size) || 0;



    // 4. Genuine Sources Cited (Multi-format Citation Extraction)

    const uniqueCitedUrls = new Set();

    

    // A. Extract all unique destination URLs from links

    tempDiv.querySelectorAll('a[href]').forEach(a => {

      const href = (a.getAttribute('href') || '').trim();

      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {

        uniqueCitedUrls.add(href.toLowerCase().replace(/[\/]+$/, ''));

      }

    });



    // B. Extract raw URLs from prose text

    const rawUrlMatches = rawText.match(/https?:\/\/[^\s\)\"\'<>]+/gi) || [];

    rawUrlMatches.forEach(url => {

      const clean = url.replace(/[\.,\);]+$/, '').trim().toLowerCase().replace(/[\/]+$/, '');

      if (clean.startsWith('http')) {

        uniqueCitedUrls.add(clean);

      }

    });



    // C. Extract references list items (under ## References / Sources / Bibliography headings)

    let refListItemsCount = 0;

    let hasRefSection = false;

    const allHeadings = Array.from(tempDiv.querySelectorAll('h1, h2, h3, h4, strong, b'));

    allHeadings.forEach(h => {

      const headingText = (h.textContent || '').trim().toLowerCase();

      if (headingText.includes('reference') || headingText.includes('sources') || headingText.includes('bibliography')) {

        hasRefSection = true;

        let nextEl = h.nextElementSibling;

        while (nextEl && !['H1', 'H2', 'H3'].includes(nextEl.tagName)) {

          if (nextEl.tagName === 'UL' || nextEl.tagName === 'OL') {

            refListItemsCount += nextEl.querySelectorAll('li').length;

          } else if (nextEl.tagName === 'P') {

            const pText = nextEl.textContent.trim();

            if (pText.startsWith('-') || pText.startsWith('*') || /^\d+[\.\)]/.test(pText) || /^\[\d+\]/.test(pText)) {

              refListItemsCount++;

            }

          }

          nextEl = nextEl.nextElementSibling;

        }

      }

    });



    // D. Extract numeric in-text bracketed citations: [1], [2], [3], etc.

    const bracketMatches = rawText.match(/\[(\d+)\]/g) || [];

    const uniqueBracketNumbers = new Set(bracketMatches.map(m => m.replace(/\D/g, '')));

    const bracketCitationsCount = uniqueBracketNumbers.size;



    // Determine genuine Sources Cited count

    let sourcesCitedCount = Math.max(

      uniqueCitedUrls.size,

      refListItemsCount,

      bracketCitationsCount

    );



    // If inline/list citations were not hyperlinked but explored web sources were synthesized:

    if (sourcesCitedCount === 0 && hasRefSection && scrapedTotal > 0) {

      sourcesCitedCount = scrapedTotal;

    } else if (sourcesCitedCount === 1 && scrapedTotal >= 3) {

      // If only 1 URL had an explicit hyperlink, but multiple explored sources were cited in the text

      sourcesCitedCount = Math.min(scrapedTotal, Math.max(refListItemsCount, bracketCitationsCount, Math.round(scrapedTotal * 0.85)));

    } else if (sourcesCitedCount === 0 && scrapedTotal > 0) {

      sourcesCitedCount = scrapedTotal;

    }



    // 5. Genuine Core Pillars (Analytical chapters, excluding meta/intro/summary/conclusion headers)

    const metaKeywords = [

      'reference', 'source', 'bibliography', 'table of content', 'contents',

      'conclusion', 'concluding', 'introduction', 'introductory', 'overview',

      'executive summary', 'abstract', 'summary', 'background', 'preface',

      'appendix', 'methodology', 'scope', 'disclaimer', 'recommendation'

    ];



    const allH2 = Array.from(tempDiv.querySelectorAll('h2'));

    const genuinePillars = allH2.filter(h => {

      const t = h.textContent.trim().toLowerCase();

      if (t.length === 0) return false;

      return !metaKeywords.some(keyword => t.includes(keyword));

    });



    let coreSectionsCount = genuinePillars.length;

    if (coreSectionsCount === 0) {

      const genuineH3 = Array.from(tempDiv.querySelectorAll('h3')).filter(h => {

        const t = h.textContent.trim().toLowerCase();

        return t.length > 0 && !metaKeywords.some(keyword => t.includes(keyword));

      });

      coreSectionsCount = genuineH3.length || (allH2.length > 0 ? allH2.length : 1);

    }



    // 6. Subtopics count (H3 subsections under analytical chapters)

    const subtopics = Array.from(tempDiv.querySelectorAll('h3')).filter(h => {

      const t = h.textContent.trim().toLowerCase();

      return t.length > 0 && !metaKeywords.some(keyword => t.includes(keyword));

    });

    const subtopicCount = subtopics.length;



    // 7. Research Synthesis Latency

    let synthLatencyText = '';

    const elapsedSec = (sessionStats && sessionStats.elapsedSec) ||

                       (typeof activeResearchStats !== 'undefined' && activeResearchStats.startTime && activeResearchStats.endTime ?

                        Math.round((activeResearchStats.endTime - activeResearchStats.startTime) / 1000) : 0);

    if (elapsedSec > 0) {

      if (elapsedSec < 60) {

        synthLatencyText = `${elapsedSec}s`;

      } else {

        const m = Math.floor(elapsedSec / 60);

        const s = elapsedSec % 60;

        synthLatencyText = `${m}m ${s}s`;

      }

    }



    // 8. Grounding Badge

    let groundingBadgeHtml = '';

    if (sourcesCitedCount === 0 && scrapedTotal === 0) {

      groundingBadgeHtml = `

        <span class="metrics-badge-warning">

          <i class="fas fa-exclamation-triangle"></i> Unverified (No External Sources)

        </span>

      `;

    } else {

      const displayExplored = Math.max(scrapedTotal, sourcesCitedCount);

      const summaryText = displayExplored > sourcesCitedCount

        ? `${sourcesCitedCount} References Cited • ${displayExplored} Web Sources Explored`

        : `${sourcesCitedCount} Verified ${sourcesCitedCount === 1 ? 'Reference' : 'References'} Cited`;



      groundingBadgeHtml = `

        <span class="metrics-badge-verified" title="Report synthesized from real-time web research">

          <i class="fas fa-shield-alt"></i> Verified Research (${summaryText})

        </span>

      `;

    }



    // 9. Fifth Stat: Sources Explored

    let fifthStatValue = '';

    let fifthStatLabel = '';

    if (scrapedTotal > 0) {

      fifthStatValue = scrapedTotal;

      fifthStatLabel = 'Sources Explored';

    } else if (sourcesCitedCount > 0) {

      fifthStatValue = sourcesCitedCount;

      fifthStatLabel = 'Sources Explored';

    } else if (synthLatencyText) {

      fifthStatValue = synthLatencyText;

      fifthStatLabel = 'Synth Latency';

    } else if (subtopicCount > 0) {

      fifthStatValue = subtopicCount;

      fifthStatLabel = 'Sub-Topics';

    } else {

      fifthStatValue = `${Math.round(wordCount / Math.max(coreSectionsCount, 1))}`;

      fifthStatLabel = 'Avg Words / Pillar';

    }



    container.innerHTML = `

      <div class="executive-metrics-card">

        <div class="executive-metrics-header">

          <h3><i class="fas fa-microchip"></i> Agentic Intelligence & Research Provenance</h3>

          ${groundingBadgeHtml}

        </div>

        <div class="metrics-grid">

          <div class="metric-stat-box">

            <div class="metric-stat-value">~${readTimeMinutes} min</div>

            <div class="metric-stat-label">Read Time</div>

          </div>

          <div class="metric-stat-box">

            <div class="metric-stat-value">${wordCount.toLocaleString()}</div>

            <div class="metric-stat-label">Total Words</div>

          </div>

          <div class="metric-stat-box">

            <div class="metric-stat-value">${sourcesCitedCount}</div>

            <div class="metric-stat-label">Sources Cited</div>

          </div>

          <div class="metric-stat-box">

            <div class="metric-stat-value">${coreSectionsCount}</div>

            <div class="metric-stat-label">Core Pillars</div>

          </div>

          <div class="metric-stat-box">

            <div class="metric-stat-value">${fifthStatValue}</div>

            <div class="metric-stat-label">${fifthStatLabel}</div>

          </div>

        </div>

      </div>

    `;



    container.style.display = 'block';

  };



  const initMindMapControls = () => {



    const hierarchyBtn = document.getElementById('viewHierarchyBtn');



    const networkBtn = document.getElementById('viewNetworkBtn');



    const hierarchyView = document.getElementById('hierarchyMapView');



    const networkView = document.getElementById('networkMapView');



    const zoomControls = document.getElementById('graphZoomBtns');



    const zoomInBtn = document.getElementById('zoomInGraphBtn');



    const zoomOutBtn = document.getElementById('zoomOutGraphBtn');



    const resetZoomBtn = document.getElementById('resetZoomGraphBtn');



    const mermaidEl = document.getElementById('mermaidGraph');







    if (hierarchyBtn && networkBtn && hierarchyView && networkView) {



      hierarchyBtn.addEventListener('click', () => {



        hierarchyBtn.classList.add('active');



        networkBtn.classList.remove('active');



        hierarchyView.style.display = 'flex';



        networkView.style.display = 'none';



        if (zoomControls) zoomControls.style.display = 'none';



      });







      networkBtn.addEventListener('click', () => {



        networkBtn.classList.add('active');



        hierarchyBtn.classList.remove('active');



        hierarchyView.style.display = 'none';



        networkView.style.display = 'flex';



        if (zoomControls) zoomControls.style.display = 'flex';



      });



    }







    if (zoomInBtn && mermaidEl) {



      zoomInBtn.addEventListener('click', () => {



        currentGraphZoom = Math.min(2.0, currentGraphZoom + 0.15);



        mermaidEl.style.transform = `scale(${currentGraphZoom})`;



      });



    }







    if (zoomOutBtn && mermaidEl) {



      zoomOutBtn.addEventListener('click', () => {



        currentGraphZoom = Math.max(0.6, currentGraphZoom - 0.15);



        mermaidEl.style.transform = `scale(${currentGraphZoom})`;



      });



    }







    if (resetZoomBtn && mermaidEl) {



      resetZoomBtn.addEventListener('click', () => {



        currentGraphZoom = 1.0;



        mermaidEl.style.transform = 'scale(1.0)';



      });



    }



  };







  const sanitizeMermaidText = (str, maxLen = 28) => {



    if (!str) return 'Concept';



    let cleaned = str



      .replace(/<[^>]*>/g, '')



      .replace(/["'\[\]\(\)\{\}:;#&`\\\/\|\=\*\_\~]/g, ' ')



      .replace(/\s+/g, ' ')



      .trim();



    if (cleaned.length > maxLen) {



      cleaned = cleaned.substring(0, maxLen - 2) + '..';



    }



    return cleaned || 'Concept';



  };







  const renderConceptGraph = async (topic, reportHtmlOrText) => {



    const mindMapContainer = document.getElementById('mindMapContainer');



    const hierarchyView = document.getElementById('hierarchyMapView');



    const mermaidEl = document.getElementById('mermaidGraph');



    if (!mindMapContainer || !hierarchyView || !mermaidEl) return;



    



    try {



      const tempDiv = document.createElement('div');



      tempDiv.innerHTML = reportHtmlOrText || '';



      



      const cleanTopic = sanitizeMermaidText(topic || 'Research Synthesis', 36);



      const h2Elements = tempDiv.querySelectorAll('h2');



      



      const pillars = [];



      h2Elements.forEach((h2) => {



        const titleText = h2.textContent.trim();



        const lower = titleText.toLowerCase();



        if (!titleText || lower.includes('references') || lower.includes('sources')) return;



        



        // Extract key sub-points under this section



        const subConcepts = [];



        let nextEl = h2.nextElementSibling;



        while (nextEl && nextEl.tagName !== 'H2' && nextEl.tagName !== 'H1') {



          if (nextEl.tagName === 'UL' || nextEl.tagName === 'OL') {



            const listItems = nextEl.querySelectorAll('li');



            listItems.forEach(li => {



              const strong = li.querySelector('strong, b');



              const text = strong ? strong.textContent : li.textContent;



              if (text && subConcepts.length < 3) {



                subConcepts.push(sanitizeMermaidText(text, 50));



              }



            });



          } else if (nextEl.tagName === 'P') {



            const strongs = nextEl.querySelectorAll('strong, b');



            strongs.forEach(st => {



              if (st.textContent && subConcepts.length < 3) {



                subConcepts.push(sanitizeMermaidText(st.textContent, 50));



              }



            });



          }



          nextEl = nextEl.nextElementSibling;



        }



        



        // Add fallbacks if empty



        if (subConcepts.length === 0) {



          subConcepts.push('Evidence-based synthesis & findings', 'Key analytical dimensions');



        }







        pillars.push({



          title: sanitizeMermaidText(titleText, 40),



          concepts: subConcepts



        });



      });



      



      if (pillars.length === 0) {



        mindMapContainer.style.display = 'none';



        return;



      }



      



      // 1. Render Ultra-Crisp Tree Hierarchy View (Default)



      renderHierarchyView(cleanTopic, pillars);







      // 2. Render SVG Flowchart View



      renderMermaidNetworkView(cleanTopic, pillars);







      mindMapContainer.style.display = 'block';



    } catch (e) {



      console.warn('Could not render concept graph:', e);



      mindMapContainer.style.display = 'none';



    }



  };







  const renderHierarchyView = (rootTopic, pillars) => {



    const hierarchyView = document.getElementById('hierarchyMapView');



    if (!hierarchyView) return;







    let html = `



      <div class="hierarchy-root-hub">



        <i class="fa-solid fa-brain"></i>



        <span>${rootTopic}</span>



      </div>



      <div class="hierarchy-pillars-grid">



    `;







    pillars.slice(0, 6).forEach((p, idx) => {



      html += `



        <div class="hierarchy-pillar-card">



          <div class="hierarchy-pillar-header">



            <div class="hierarchy-pillar-badge">${idx + 1}</div>



            <div class="hierarchy-pillar-title">📌 ${stripMarkdown(p.title)}</div>



          </div>



          <div class="hierarchy-concepts-list">



            ${p.concepts.map(c => `



              <div class="hierarchy-concept-pill">



                <i class="fa-solid fa-angle-right"></i>



                <span>${stripMarkdown(c)}</span>



              </div>



            `).join('')}



          </div>



        </div>



      `;



    });







    html += '</div>';



    hierarchyView.innerHTML = html;



  };







  const renderMermaidNetworkView = async (cleanTopic, pillars) => {



    const mermaidEl = document.getElementById('mermaidGraph');



    if (!mermaidEl) return;







    let graphDefinition = 'graph TD\n';



    graphDefinition += `    Root(["🧠 ${cleanTopic}"])\n`;



    



    pillars.slice(0, 6).forEach((pillar, pIdx) => {



      const pId = `Pillar_${pIdx}`;



      graphDefinition += `    Root --> ${pId}["📌 ${pillar.title.substring(0, 24)}"]\n`;



      



      pillar.concepts.slice(0, 2).forEach((concept, cIdx) => {



        const cId = `Concept_${pIdx}_${cIdx}`;



        graphDefinition += `    ${pId} --> ${cId}["🔹 ${concept.substring(0, 22)}"]\n`;



      });



    });



    



    // Modern Color Classes



    graphDefinition += '\n    classDef rootClass fill:#4f46e5,stroke:#818cf8,stroke-width:2px,color:#ffffff,font-weight:bold;\n';



    graphDefinition += '    classDef pillarClass fill:#0f172a,stroke:#6366f1,stroke-width:1.5px,color:#f8fafc,font-weight:600;\n';



    graphDefinition += '    classDef conceptClass fill:#020617,stroke:#38bdf8,stroke-width:1px,color:#94a3b8;\n';



    graphDefinition += '    class Root rootClass;\n';



    



    pillars.slice(0, 6).forEach((_, pIdx) => {



      graphDefinition += `    class Pillar_${pIdx} pillarClass;\n`;



      pillars[pIdx].concepts.slice(0, 2).forEach((_, cIdx) => {



        graphDefinition += `    class Concept_${pIdx}_${cIdx} conceptClass;\n`;



      });



    });







    if (typeof mermaid !== 'undefined') {



      try {



        mermaid.initialize({



          startOnLoad: false,



          theme: 'dark',



          themeVariables: {



            darkMode: true,



            background: '#0a0d14',



            primaryColor: '#4f46e5',



            primaryTextColor: '#ffffff',



            primaryBorderColor: '#818cf8',



            lineColor: '#64748b'



          },



          securityLevel: 'loose'



        });



        const uniqueId = 'conceptGraphSvg_' + Math.random().toString(36).substring(2, 9);



        const { svg } = await mermaid.render(uniqueId, graphDefinition);



        mermaidEl.innerHTML = svg;



      } catch (mErr) {



        console.warn('Mermaid render warning:', mErr);



      }



    }



  };







  // --- 4. Robust AI Executive Audio Briefing Player ---



  let audioChunks = [];



  let currentChunkIndex = 0;



  let isAudioPlaying = false;



  let currentAudioSpeed = 0.95;



  let audioKeepAliveTimer = null;



  let cachedVoices = [];







  const loadSystemVoices = () => {



    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {



      cachedVoices = window.speechSynthesis.getVoices();



      if (window.speechSynthesis.onvoiceschanged !== undefined) {



        window.speechSynthesis.onvoiceschanged = () => {



          cachedVoices = window.speechSynthesis.getVoices();



        };



      }



    }



  };







  const cleanSpokenText = (text) => {



    if (!text) return '';



    return text



      .replace(/<[^>]*>/g, ' ')



      .replace(/https?:\/\/[^\s]+/g, '')



      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')



      .replace(/[*_~`#>\-–—]/g, ' ')



      .replace(/\s+/g, ' ')



      .trim();



  };







  // --------------------------------------------------------------------------

  // Export Overlay Suite (Fixed Header Bar & Persistent Right-Hand Sidebar Dock)

  // --------------------------------------------------------------------------

  const initExportOverlaySuite = () => {

    const dockToggle = document.getElementById('exportDockToggle');

    const exportPanel = document.getElementById('exportSidebarPanel');

    if (dockToggle && exportPanel) {

      dockToggle.addEventListener('click', (e) => {

        e.stopPropagation();

        exportPanel.classList.toggle('collapsed');

      });

    }



    // Top navbar copy button

    const navCopyBtn = document.getElementById('navExportCopy');

    if (navCopyBtn) {

      navCopyBtn.addEventListener('click', () => {

        const copyBtn = document.getElementById('copyToClipboard');

        if (copyBtn) {

          copyBtn.click();

        } else {

          const reportEl = document.getElementById('reportContainer');

          if (reportEl) {

            navigator.clipboard.writeText(reportEl.innerText || reportEl.textContent || '')

              .then(() => alert('Report copied to clipboard!'))

              .catch(err => console.error('Copy failed:', err));

          }

        }

      });

    }

  };



  const initAudioBriefing = () => {



    loadSystemVoices();



    const playPauseBtn = document.getElementById('playPauseAudioBtn');



    const audioTopBtn = document.getElementById('audioBriefingBtnTop');



    const speedBtns = document.querySelectorAll('.audio-speed-btn');







    if (audioTopBtn) {



      audioTopBtn.addEventListener('click', (e) => {



        e.preventDefault();



        const container = document.getElementById('audioBriefingContainer');



        if (container) {



          container.scrollIntoView({ behavior: 'smooth' });



          toggleAudioBriefing();



        }



      });



    }







    if (playPauseBtn) {



      playPauseBtn.addEventListener('click', toggleAudioBriefing);



    }







    speedBtns.forEach(btn => {



      btn.addEventListener('click', () => {



        speedBtns.forEach(b => b.classList.remove('active'));



        btn.classList.add('active');



        currentAudioSpeed = parseFloat(btn.getAttribute('data-speed')) || 1.0;



        if (isAudioPlaying) {



          window.speechSynthesis.cancel();



          playCurrentChunk();



        }



      });



    });



  };







  

  const setupAudioBriefing = (reportHtmlOrText, topic) => {



    const container = document.getElementById('audioBriefingContainer');



    if (!container) return;







    const tempDiv = document.createElement('div');



    tempDiv.innerHTML = reportHtmlOrText || '';



    



    // Extract Introduction



    let intro = '';



    const pElements = tempDiv.querySelectorAll('p');



    for (let p of pElements) {



      const text = cleanSpokenText(p.textContent);



      if (text.length > 50) {



        intro = text;



        break;



      }



    }







    // Extract Major Pillars



    const h2Elements = tempDiv.querySelectorAll('h2');



    const pillars = [];



    h2Elements.forEach(h => {



      const t = cleanSpokenText(h.textContent);



      if (t && !t.toLowerCase().includes('reference') && !t.toLowerCase().includes('sources')) {



        pillars.push(t);



      }



    });







    const topicTitle = cleanSpokenText(topic || 'your research investigation');



    



    // Construct rich natural spoken script



    let fullScript = `Welcome to the executive intelligence briefing for ${topicTitle}. `;



    if (intro) {



      fullScript += `${intro}. `;



    }



    if (pillars.length > 0) {



      fullScript += `The core analytical pillars established in this report include: ${pillars.slice(0, 4).join(', ')}. `;



    }



    fullScript += `Full quantitative figures, semantic mind maps, and verified citations are detailed below in the written report.`;







    // Split script into sentence chunks for reliable Chromium speech synthesis



    const rawSentences = fullScript.match(/[^.!?]+[.!?]+/g) || [fullScript];



    audioChunks = rawSentences.map(s => s.trim()).filter(s => s.length > 0);



    currentChunkIndex = 0;







    container.style.display = 'block';



    resetAudioPlayerUI();



  };







  const toggleAudioBriefing = () => {



    if (isAudioPlaying) {



      pauseAudioBriefing();



    } else {



      playAudioBriefing();



    }



  };







  const playAudioBriefing = () => {



    if (!('speechSynthesis' in window)) {



      showToast('Text-to-speech is not supported on this browser.');



      return;



    }







    if (audioChunks.length === 0) {



      const reportContainer = document.getElementById('reportContainer');



      const topic = document.getElementById('task')?.value || 'Research';



      setupAudioBriefing(reportContainer?.innerHTML || '', topic);



    }







    if (currentChunkIndex >= audioChunks.length) {



      currentChunkIndex = 0;



    }







    isAudioPlaying = true;



    updateAudioPlayerUI(true);



    playCurrentChunk();



    startKeepAlive();



  };







  const playCurrentChunk = () => {



    if (!isAudioPlaying || currentChunkIndex >= audioChunks.length) {



      isAudioPlaying = false;



      updateAudioPlayerUI(false);



      resetAudioPlayerUI();



      stopKeepAlive();



      return;



    }







    window.speechSynthesis.cancel();



    const chunkText = audioChunks[currentChunkIndex];



    const utterance = new SpeechSynthesisUtterance(chunkText);



    // Natural human conversational rate (defaults to 0.88 for clear comprehension)



    utterance.rate = Math.min(Math.max(currentAudioSpeed, 0.75), 1.25);



    utterance.pitch = 1.02;







    // Pick highest quality English voice (Google US English, Microsoft Jenny/Guy, Natural)



    if (cachedVoices.length === 0) cachedVoices = window.speechSynthesis.getVoices();



    const voice = cachedVoices.find(v => (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google US English') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('Daniel')))) || cachedVoices.find(v => v.lang.startsWith('en'));



    if (voice) utterance.voice = voice;







    utterance.onend = () => {



      if (isAudioPlaying) {



        currentChunkIndex++;



        updateAudioProgress();



        playCurrentChunk();



      }



    };







    utterance.onerror = (err) => {



      console.warn('Speech chunk error, proceeding to next chunk:', err);



      if (isAudioPlaying) {



        currentChunkIndex++;



        updateAudioProgress();



        playCurrentChunk();



      }



    };







    window.speechSynthesis.speak(utterance);



    updateAudioProgress();



  };







  const pauseAudioBriefing = () => {



    if ('speechSynthesis' in window) {



      window.speechSynthesis.cancel();



    }



    isAudioPlaying = false;



    updateAudioPlayerUI(false);



    stopKeepAlive();



  };







  const startKeepAlive = () => {



    stopKeepAlive();



    // Prevents Chromium 15s SpeechSynthesis bug



    audioKeepAliveTimer = setInterval(() => {



      if (isAudioPlaying && window.speechSynthesis.speaking) {



        window.speechSynthesis.pause();



        window.speechSynthesis.resume();



      }



    }, 10000);



  };







  const stopKeepAlive = () => {



    if (audioKeepAliveTimer) {



      clearInterval(audioKeepAliveTimer);



      audioKeepAliveTimer = null;



    }



  };







  const updateAudioProgress = () => {



    const progressFill = document.getElementById('audioProgressFill');



    const timeDisplay = document.getElementById('audioTimeDisplay');



    const total = audioChunks.length || 1;



    const progress = Math.min(100, Math.round(((currentChunkIndex + 1) / total) * 100));







    if (progressFill) progressFill.style.width = `${progress}%`;



    if (timeDisplay) {



      timeDisplay.textContent = `Part ${Math.min(currentChunkIndex + 1, total)} of ${total}`;



    }



  };







  const updateAudioPlayerUI = (playing) => {



    const playBtn = document.getElementById('playPauseAudioBtn');



    const waveform = document.getElementById('audioWaveformBars');



    if (playBtn) {



      playBtn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';



    }



    if (waveform) {



      if (playing) waveform.classList.add('playing');



      else waveform.classList.remove('playing');



    }



  };







  const resetAudioPlayerUI = () => {



    currentChunkIndex = 0;



    const progressFill = document.getElementById('audioProgressFill');



    const timeDisplay = document.getElementById('audioTimeDisplay');



    if (progressFill) progressFill.style.width = '0%';



    if (timeDisplay) timeDisplay.textContent = audioChunks.length > 0 ? `Ready (${audioChunks.length} sections)` : '0:00 / 1:15';



    updateAudioPlayerUI(false);



  };







  // --- 5. SWOT Strategic & Impact Analysis Matrix ---



  const renderSwotMatrix = (reportHtmlOrText) => {



    const container = document.getElementById('swotMatrixContainer');



    const grid = document.getElementById('swotGrid');



    if (!container || !grid) return;







    try {



      const tempDiv = document.createElement('div');



      tempDiv.innerHTML = reportHtmlOrText || '';



      



      const strengths = [];



      const weaknesses = [];



      const opportunities = [];



      const threats = [];







      // 1. Gather all potential analytical sentence candidates across paragraphs, list items, and headings



      const candidateSentences = [];



      const elements = tempDiv.querySelectorAll('p, li, blockquote');



      elements.forEach(el => {



        const text = el.textContent.trim();



        if (text.length > 25 && !text.toLowerCase().startsWith('http') && !text.toLowerCase().includes('all urls are hyperlinked')) {



          // Split into sentences



          const sList = text.match(/[^.!?]+[.!?]+/g) || [text];



          sList.forEach(s => {



            const clean = s.replace(/\[\d+\]/g, '').replace(/https?:\/\/[^\s]+/g, '').replace(/[*_~`#]/g, '').trim();



            if (clean.length >= 35 && clean.length <= 220) {



              candidateSentences.push(clean);



            }



          });



        }



      });







      // 2. Classify sentences into SWOT categories



      candidateSentences.forEach(s => {



        const lower = s.toLowerCase();



        if (lower.includes('benefit') || lower.includes('growth') || lower.includes('efficien') || lower.includes('accura') || lower.includes('success') || lower.includes('improv') || lower.includes('speed') || lower.includes('scalab') || lower.includes('dominant') || lower.includes('record') || lower.includes('innovat') || lower.includes('breakthrough') || lower.includes('advantage') || lower.includes('first-time') || lower.includes('pioneer') || lower.includes('transform')) {



          if (strengths.length < 4 && !strengths.includes(s)) strengths.push(s);



        } else if (lower.includes('challeng') || lower.includes('limit') || lower.includes('bottleneck') || lower.includes('cost') || lower.includes('complex') || lower.includes('delay') || lower.includes('fail') || lower.includes('difficul') || lower.includes('drawback') || lower.includes('shortage') || lower.includes('inconsisten') || lower.includes('gap') || lower.includes('issue')) {



          if (weaknesses.length < 4 && !weaknesses.includes(s)) weaknesses.push(s);



        } else if (lower.includes('opportunit') || lower.includes('future') || lower.includes('potential') || lower.includes('integrat') || lower.includes('emerging') || lower.includes('adopt') || lower.includes('market') || lower.includes('expansion') || lower.includes('trend') || lower.includes('promis') || lower.includes('next generation') || lower.includes('advance') || lower.includes('trial')) {



          if (opportunities.length < 4 && !opportunities.includes(s)) opportunities.push(s);



        } else if (lower.includes('risk') || lower.includes('threat') || lower.includes('privacy') || lower.includes('securit') || lower.includes('regulat') || lower.includes('bias') || lower.includes('displace') || lower.includes('corrupt') || lower.includes('controvers') || lower.includes('disrupt') || lower.includes('competit') || lower.includes('environmental') || lower.includes('carbon') || lower.includes('welfare')) {



          if (threats.length < 4 && !threats.includes(s)) threats.push(s);



        }



      });







      // 3. Contextual topic awareness for missing slots



      const taskTopic = (document.getElementById('task')?.value || 'the investigated system').trim();



      const h2Elements = tempDiv.querySelectorAll('h2');



      const keyTopics = [];



      h2Elements.forEach(h => {



        const t = h.textContent.replace(/^\d+[\.\s]*/, '').trim();



        if (t && !t.toLowerCase().includes('reference') && !t.toLowerCase().includes('sources') && !t.toLowerCase().includes('conclusion')) {



          keyTopics.push(t);



        }



      });







      const primaryDomain = keyTopics[0] || taskTopic;



      const secondaryDomain = keyTopics[1] || 'Domain Ecosystem';







      // 4. Validate context sufficiency & prevent hallucinated placeholder text

      const totalExtracted = strengths.length + weaknesses.length + opportunities.length + threats.length;

      const isSparseOrMissing = candidateSentences.length < 2 || totalExtracted === 0;



      if (isSparseOrMissing) {

        grid.innerHTML = `

          <div class="swot-fallback-state">

            <div class="swot-fallback-icon"><i class="fa-solid fa-circle-exclamation"></i></div>

            <div class="swot-fallback-content">

              <h4>Insufficient data gathered for SWOT analysis</h4>

              <p>The retrieved research context did not contain enough verified analytical, operational, or risk metrics to synthesize a rigorous SWOT matrix without speculation.</p>

            </div>

          </div>

        `;

        container.style.display = 'block';

        return;

      }



      // Helper to render quadrant items without hallucinated generic placeholders

      const renderQuadrantItems = (items, categoryName) => {

        if (!items || items.length === 0) {

          return `<li><span class="swot-item-muted">No verified ${categoryName} identified in gathered context</span></li>`;

        }

        return items.slice(0, 4).map(s => `<li>${s}</li>`).join('');

      };



      grid.innerHTML = `

        <div class="swot-quadrant strengths">

          <div class="swot-quadrant-title"><i class="fa-solid fa-circle-check"></i> Strengths & Strategic Advantages</div>

          <ul class="swot-items-list">${renderQuadrantItems(strengths, 'strengths')}</ul>

        </div>

        <div class="swot-quadrant weaknesses">

          <div class="swot-quadrant-title"><i class="fa-solid fa-triangle-exclamation"></i> Challenges & Operational Limitations</div>

          <ul class="swot-items-list">${renderQuadrantItems(weaknesses, 'challenges')}</ul>

        </div>

        <div class="swot-quadrant opportunities">

          <div class="swot-quadrant-title"><i class="fa-solid fa-arrow-trend-up"></i> Growth & Emerging Opportunities</div>

          <ul class="swot-items-list">${renderQuadrantItems(opportunities, 'growth opportunities')}</ul>

        </div>

        <div class="swot-quadrant threats">

          <div class="swot-quadrant-title"><i class="fa-solid fa-shield-halved"></i> Risk Factors & Environmental Threats</div>

          <ul class="swot-items-list">${renderQuadrantItems(threats, 'risk factors')}</ul>

        </div>

      `;







      container.style.display = 'block';



    } catch (e) {



      console.warn('Could not render SWOT matrix:', e);



      container.style.display = 'none';



    }



  };







  // --- 6. Deep-Dive Exploration Vectors (100% Relevant & Adaptive) ---



  const renderDeepDiveVectors = (topic, reportHtmlOrText) => {



    const container = document.getElementById('deepDiveContainer');



    const pillsWrap = document.getElementById('deepDivePills');



    if (!container || !pillsWrap) return;







    try {



      const tempDiv = document.createElement('div');



      tempDiv.innerHTML = reportHtmlOrText || '';



      const baseTopic = (topic || 'Research Subject').trim();







      const vectors = [];



      const seenVectors = new Set();







      const addVector = (text) => {



        if (!text) return;



        const clean = text.replace(/[:\-–—]+$/, '').trim();



        if (clean.length > 8 && !seenVectors.has(clean.toLowerCase()) && vectors.length < 4) {



          seenVectors.add(clean.toLowerCase());



          vectors.push(clean);



        }



      };







      // 1. Extract actual section headers from the report (h2 and h3)



      const headings = tempDiv.querySelectorAll('h2, h3');



      headings.forEach(h => {



        let t = h.textContent.trim();



        const low = t.toLowerCase();



        if (!low.includes('reference') && !low.includes('source') && !low.includes('introduction') && !low.includes('conclusion') && !low.includes('summary')) {



          if (low.includes(baseTopic.toLowerCase().slice(0, 8))) {



            addVector(`Deep Dive: ${stripMarkdown(t)}`);



          } else {



            addVector(`${stripMarkdown(baseTopic)}: Detailed Study of ${stripMarkdown(t)}`);



          }



        }



      });







      // 2. Extract prominent sub-points or bold keyphrases from the report text



      if (vectors.length < 4) {



        const strongs = tempDiv.querySelectorAll('li strong, li b, p strong');



        strongs.forEach(s => {



          const t = s.textContent.trim().replace(/[:\-–—]+$/, '');



          if (t.length > 4 && t.length < 35 && !t.toLowerCase().includes('reference')) {



            addVector(`${baseTopic}: In-Depth Analysis of ${t}`);



          }



        });



      }







      // 3. Topic-grounded questions if headings were minimal



      if (vectors.length < 4) {



        addVector(`Core Mechanisms & Technical Architecture of ${baseTopic}`);



        addVector(`Market Adoption, Real-World Case Studies & Industry Applications of ${baseTopic}`);



        addVector(`Key Bottlenecks, Regulatory Challenges & Risk Assessment for ${baseTopic}`);



        addVector(`Future Outlook (2026-2030) & Emerging Innovations in ${baseTopic}`);



      }







      pillsWrap.innerHTML = '';



      vectors.slice(0, 4).forEach(v => {



        const pill = document.createElement('button');



        pill.className = 'deep-dive-pill';



        pill.innerHTML = `<span>${v}</span> <i class="fa-solid fa-arrow-right"></i>`;



        pill.onclick = () => {



          const taskInput = document.getElementById('task');



          if (taskInput) {



            taskInput.value = v;



            window.scrollTo({ top: 0, behavior: 'smooth' });



            setTimeout(() => {



              startResearch();



            }, 300);



          }



        };



        pillsWrap.appendChild(pill);



      });







      container.style.display = 'block';



    } catch (e) {



      console.warn('Could not render deep dive vectors:', e);



      container.style.display = 'none';



    }



  };







  // --- 7. LaTeX (.tex) Academic Exporter ---



  const initLatexExport = () => {



    const latexBtn = document.getElementById('downloadLatexBtnTop');



    if (!latexBtn) return;







    latexBtn.addEventListener('click', (e) => {



      e.preventDefault();



      const reportContainer = document.getElementById('reportContainer');



      const topic = document.getElementById('task')?.value || 'Research Report';



      if (!reportContainer || !reportContainer.textContent.trim()) {



        showToast('No report available to export.');



        return;



      }







      // Convert HTML report to LaTeX



      const cleanTitle = topic.replace(/["'\\]/g, '');



      let latexCode = `\\documentclass[11pt,a4paper]{article}



\\usepackage[utf8]{inputenc}



\\usepackage{amsmath}



\\usepackage{geometry}



\\usepackage{hyperref}



\\usepackage{booktabs}



\\geometry{margin=1in}







\\title{\\textbf{${cleanTitle}}\\\\ \\large An Agentic AI-Driven RAG Framework Investigation}



\\author{Autonomous AI Research Agent}



\\date{\\today}







\\begin{document}



\\maketitle







`;



      const tempDiv = document.createElement('div');



      tempDiv.innerHTML = reportContainer.innerHTML;







      const children = tempDiv.children;



      for (let el of children) {



        if (el.tagName === 'H1') {



          // Skip title since already in maketitle



        } else if (el.tagName === 'H2') {



          latexCode += `\\section{${el.textContent.replace(/[_#%$&]/g, '\\$&')}}\n\n`;



        } else if (el.tagName === 'H3') {



          latexCode += `\\subsection{${el.textContent.replace(/[_#%$&]/g, '\\$&')}}\n\n`;



        } else if (el.tagName === 'P') {



          latexCode += `${el.textContent.replace(/[_#%$&]/g, '\\$&')}\n\n`;



        } else if (el.tagName === 'UL' || el.tagName === 'OL') {



          latexCode += `\\begin{itemize}\n`;



          el.querySelectorAll('li').forEach(li => {



            latexCode += `  \\item ${li.textContent.replace(/[_#%$&]/g, '\\$&')}\n`;



          });



          latexCode += `\\end{itemize}\n\n`;



        }



      }







      latexCode += `\\end{document}\n`;







      // Trigger download



      const blob = new Blob([latexCode], { type: 'text/x-tex' });



      const link = document.createElement('a');



      link.href = URL.createObjectURL(blob);



      link.download = `${cleanTitle.toLowerCase().replace(/\s+/g, '_')}_paper.tex`;



      link.click();



      showToast('LaTeX source (.tex) downloaded successfully!');



    });



  };







  // --- 4. Slide Deck Presentation Modal ---



  let currentSlideIndex = 0;



  let slideData = [];







  const initSlideDeckModal = () => {



    const modal = document.getElementById('slideDeckModal');



    const overlay = document.getElementById('slideDeckOverlay');



    const closeBtn = document.getElementById('closeSlideDeckBtn');



    const prevBtn = document.getElementById('prevSlideBtn');



    const nextBtn = document.getElementById('nextSlideBtn');



    const topBtn = document.getElementById('viewSlidesBtnTop');



    const stickyBtn = document.getElementById('viewSlidesBtnSticky');



    



    if (topBtn) {
      topBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof handleSlidesButtonClick === 'function') {
          handleSlidesButtonClick(e);
        } else {
          openSlideDeck();
        }
      });
    }

    if (stickyBtn) {
      stickyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof handleSlidesButtonClick === 'function') {
          handleSlidesButtonClick(e);
        } else {
          openSlideDeck();
        }
      });
    }



    if (closeBtn) closeBtn.addEventListener('click', closeSlideDeck);



    if (overlay) overlay.addEventListener('click', closeSlideDeck);



    if (prevBtn) prevBtn.addEventListener('click', () => changeSlide(-1));



    if (nextBtn) nextBtn.addEventListener('click', () => changeSlide(1));



    



    document.addEventListener('keydown', (e) => {



      if (modal && modal.style.display !== 'none') {



        if (e.key === 'ArrowLeft') changeSlide(-1);



        if (e.key === 'ArrowRight' || e.key === ' ') changeSlide(1);



        if (e.key === 'Escape') closeSlideDeck();



      }



    });



  };







  const openSlideDeck = () => {



    const reportContainer = document.getElementById('reportContainer');



    const topic = document.getElementById('task').value || 'Research Presentation';



    const modal = document.getElementById('slideDeckModal');



    const topicEl = document.getElementById('slideDeckTopic');



    



    if (!reportContainer || !modal) return;



    



    if (topicEl) topicEl.textContent = stripMarkdown(topic);



    



    // Parse slides from reportContainer



    slideData = [];



    



    // Title Slide



    slideData.push({



      title: topic,



      content: '<p style="font-size: 1.25rem; opacity: 0.95; line-height: 1.7;">Autonomous Deep-Web Research & Analytical Intelligence Report</p><div style="margin-top: 24px; padding: 14px 22px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; display: inline-block;">🚀 <b>Agentic RAG Framework</b> • Autonomous Knowledge Retrieval</div>'



    });



    



    // Extract sections



    const tempDiv = document.createElement('div');



    tempDiv.innerHTML = reportContainer.innerHTML;



    



    const sections = tempDiv.querySelectorAll('h2');



    sections.forEach((sec) => {



      const title = sec.textContent;



      let contentHtml = '';



      let nextEl = sec.nextElementSibling;



      while (nextEl && nextEl.tagName !== 'H2' && nextEl.tagName !== 'H1') {



        contentHtml += nextEl.outerHTML;



        nextEl = nextEl.nextElementSibling;



      }



      if (title.trim()) {



        slideData.push({



          title: title,



          content: contentHtml || '<p>Detailed analysis in report.</p>'



        });



      }



    });



    



    if (slideData.length === 1) {



      slideData.push({



        title: 'Executive Summary',



        content: tempDiv.innerHTML



      });



    }



    



    currentSlideIndex = 0;



    renderSlide();



    modal.classList.add('active');



    modal.style.display = 'flex';



    document.body.style.overflow = 'hidden';



  };







  const closeSlideDeck = () => {



    const modal = document.getElementById('slideDeckModal');



    if (modal) {



      modal.classList.remove('active');



      modal.style.display = 'none';



    }



    document.body.style.overflow = 'auto';



  };







  const changeSlide = (delta) => {



    if (slideData.length === 0) return;



    currentSlideIndex = Math.max(0, Math.min(slideData.length - 1, currentSlideIndex + delta));



    renderSlide();



  };







  const renderSlide = () => {



    const slideBody = document.getElementById('slideBody');



    const counter = document.getElementById('slideCounter');



    const prevBtn = document.getElementById('prevSlideBtn');



    const nextBtn = document.getElementById('nextSlideBtn');



    



    if (!slideBody || slideData.length === 0) return;



    



    const slide = slideData[currentSlideIndex];



    slideBody.innerHTML = `



      <h2>${slide.title}</h2>



      <div class="slide-inner-content">${slide.content}</div>



    `;



    



    // Always scroll to top of slide on transition



    slideBody.scrollTop = 0;



    



    if (counter) counter.textContent = `Slide ${currentSlideIndex + 1} of ${slideData.length}`;



    if (prevBtn) prevBtn.disabled = currentSlideIndex === 0;



    if (nextBtn) nextBtn.disabled = currentSlideIndex === slideData.length - 1;



  };







  const updateState = (state) => {



    var status = ''



    switch (state) {



      case 'in_progress':



        status = 'Research in progress...'



        setReportReady(false);



        toggleExportDropdown(false);



        setReportActionsStatus('disabled')



        isResearchActive = true;



        // Make the research icon spin



        updateResearchIcon(true);



        // Hide chat container during research



        chatContainer = document.getElementById('chatContainer');



        if (chatContainer) {



          chatContainer.style.display = 'none';



        }



        // Hide the copy button in the header



        const copyBtnTop = document.getElementById('copyToClipboardTop');



        if (copyBtnTop) {



          copyBtnTop.style.display = 'none';



        }



        // Hide the JSON button container



        const jsonContainer = document.getElementById('jsonButtonContainer');



        if (jsonContainer) {



          jsonContainer.style.display = 'none';



        }



        break



      case 'finished':



        status = 'Research finished!'



        // Ensure Research Progress card remains visible in DOM above Verified Visuals
        const finishedProgressCard = document.getElementById('researchOutputContainer');
        if (finishedProgressCard) {
          finishedProgressCard.style.display = 'block';
        }
        const finishedTracker = document.getElementById('agentPipelineTracker');
        if (finishedTracker) {
          finishedTracker.style.display = 'flex';
        }



        setReportReady(true);



        setReportActionsStatus('enabled')



        isResearchActive = false;

        resetResearchControls();

        // Stop the research icon spinning



        updateResearchIcon(false);







        // Show download panels and hide feature panels when research is finished



        showDownloadPanels();







        // Enable the copy button



        const copyButton = document.getElementById('copyToClipboard');



        if (copyButton) {



          copyButton.classList.remove('disabled');



        }







        // Show copy button in the header



        const topCopyButton = document.getElementById('copyToClipboardTop');



        if (topCopyButton) {



          topCopyButton.style.display = 'inline-block';



          topCopyButton.addEventListener('click', copyToClipboard);



        }







        // Show JSON button container



        const jsonButtonContainer = document.getElementById('jsonButtonContainer');



        if (jsonButtonContainer) {



          jsonButtonContainer.style.display = 'block';



        }







        // Show chat container when research is finished



        chatContainer = document.getElementById('chatContainer');



        if (chatContainer) {



          chatContainer.style.display = 'block';



          // Initialize chat if not already initialized



          initChat();



        }







        // Show "New Research" button after report is complete



        showNewResearchButton();







        // 1. Advance pipeline tracker to Step 5 (Verified and Checked)



        setPipelineStep(5, 'Provenance verified & citations checked ✓', true);







        // 2. Render Executive Research Metrics Card with live session stats



        const currentTaskText = document.getElementById('task')?.value || 'Deep Research';



        const finalReportHtml = document.getElementById('reportContainer')?.innerHTML || '';



        const elapsed = activeResearchStats && activeResearchStats.startTime && activeResearchStats.endTime



          ? Math.round((activeResearchStats.endTime - activeResearchStats.startTime) / 1000)



          : 0;



        renderExecutiveMetrics(finalReportHtml, currentTaskText, {



          elapsedSec: elapsed,



          scrapedCount: activeResearchStats ? activeResearchStats.scrapedSources.size : 0



        });







        // 3. Render Concept Mind Map



        renderConceptGraph(currentTaskText, finalReportHtml);







        // 4. Setup AI Audio Briefing



        setupAudioBriefing(finalReportHtml, currentTaskText);







        // 5. Render SWOT Strategic Matrix



        renderSwotMatrix(finalReportHtml);







        // 6. Render Deep-Dive Exploration Vectors



        renderDeepDiveVectors(currentTaskText, finalReportHtml);







        // 7. Enable Slide Deck Buttons



        const viewSlidesSticky = document.getElementById('viewSlidesBtnSticky');



        if (viewSlidesSticky) viewSlidesSticky.classList.remove('disabled');



        break



      case 'error':



        status = 'Research failed!'



        setReportActionsStatus('disabled')



        isResearchActive = false;

        resetResearchControls();

        // Stop the research icon spinning



        updateResearchIcon(false);



        break



      case 'initial':



        status = ''



        setReportReady(false);



        toggleExportDropdown(false);



        clearResearchImages();

        setReportActionsStatus('hidden')

        isResearchActive = false;
        resetResearchControls();

        // Make sure the research icon is not spinning initially



        updateResearchIcon(false);



        // Hide the copy button in the header



        const initialCopyBtnTop = document.getElementById('copyToClipboardTop');



        if (initialCopyBtnTop) {



          initialCopyBtnTop.style.display = 'none';



        }



        // Hide the JSON button container



        const initialJsonContainer = document.getElementById('jsonButtonContainer');



        if (initialJsonContainer) {



          initialJsonContainer.style.display = 'none';



        }



        // Hide the "New Research" button



        hideNewResearchButton();







        // Reset Pipeline Tracker



        resetPipelineTracker();







        // Hide Metrics & Mind Map & Audio & SWOT & Deep Dive



        const metricsBox = document.getElementById('executiveMetricsContainer');



        if (metricsBox) metricsBox.style.display = 'none';



        const mindMapBox = document.getElementById('mindMapContainer');



        if (mindMapBox) mindMapBox.style.display = 'none';



        const audioBox = document.getElementById('audioBriefingContainer');



        if (audioBox) audioBox.style.display = 'none';



        const swotBox = document.getElementById('swotMatrixContainer');



        if (swotBox) swotBox.style.display = 'none';



        const deepDiveBox = document.getElementById('deepDiveContainer');



        if (deepDiveBox) deepDiveBox.style.display = 'none';







        // Disable Slide Deck button



        const viewSlidesStickyInit = document.getElementById('viewSlidesBtnSticky');



        if (viewSlidesStickyInit) viewSlidesStickyInit.classList.add('disabled');



        break



      default:



        setReportActionsStatus('disabled')



    }



    document.getElementById('status').innerHTML = status



    if (document.getElementById('status').innerHTML == '') {



      document.getElementById('status').style.display = 'none'



    } else {



      document.getElementById('status').style.display = 'block'



    }



  }







  /**



   * Shows or hides the download and copy buttons



   * @param {str} status Kind of hacky. Takes "enabled", "disabled", or "hidden". "Hidden is same as disabled but also hides the div"



   */



  const setReportActionsStatus = (status) => {



    const reportActions = document.getElementById('reportActions')



    // Disable everything in reportActions until research is finished







    if (status == 'enabled') {



      reportActions.querySelectorAll('a').forEach((link) => {



        link.classList.remove('disabled')



        link.removeAttribute('onclick')



        reportActions.style.display = 'block'



      })



    } else {



      reportActions.querySelectorAll('a').forEach((link) => {



        link.classList.add('disabled')



        link.setAttribute('onclick', 'return false;')



      })



      if (status == 'hidden') {



        reportActions.style.display = 'none'



      }



    }



  }







  const tagsInput = document.getElementById('tags-input');



  const input = document.getElementById('custom_source');







  const tags = [];







  const addTag = (url) => {



    if (tags.includes(url)) return;



    tags.push(url);







    const tagElement = document.createElement('span');



    tagElement.className = 'tag';



    tagElement.textContent = url;







    const removeButton = document.createElement('span');



    removeButton.className = 'remove-tag';



    removeButton.textContent = 'x';



    removeButton.onclick = function () {



      tagsInput.removeChild(tagElement);



      tags.splice(tags.indexOf(url), 1);



    };







    tagElement.appendChild(removeButton);



    tagsInput.insertBefore(tagElement, input);



  }







  let activeResearchImages = []; // Array of { url, alt, title, domain }

  let activeResearchImageUrls = new Set();

  let seenImageSignatures = new Set();

  let currentLightboxIndex = 0;

  let lightboxZoomLevel = 1.0;



  const getCleanImageSignature = (url) => {

    try {

      const u = new URL(url);

      const cleanPath = u.pathname.toLowerCase();

      const parts = cleanPath.split('/').filter(Boolean);

      const filename = parts.pop() || '';

      const nameOnly = filename.split('.')[0].replace(/[-_\d]+$/, '');

      return nameOnly.length >= 4 ? nameOnly : cleanPath;

    } catch (e) {

      return url.toLowerCase().split('?')[0];

    }

  };



  const displaySelectedImages = (data) => {

    const imageContainer = document.getElementById('selectedImagesContainer');

    if (!imageContainer) return;



    let images = [];

    try {

      images = typeof data.output === 'string' ? JSON.parse(data.output) : data.output;

    } catch (e) {

      console.warn('Failed to parse images payload:', e);

      return;

    }



    if (!Array.isArray(images) || images.length === 0) return;



    // Strict filter for junk banners, icons, tracking pixels, thumbnails, avatars

    const junkPattern = /(\.svg|\.ico|\.gif|pixel|avatar|favicon|logo|tracking|badge|spinner|1x1|ad-|advertisement|doubleclick|button|icon|share|placeholder|banner|w_64|w_32|w_100|64x64|32x32|fallback|thumb_|author|profile|gravatar)/i;



    images.forEach(imgObj => {

      let url = '';

      let alt = 'Research Visual Figure';

      let title = 'Visual Figure';



      if (typeof imgObj === 'string') {

        url = imgObj;

      } else if (imgObj && typeof imgObj === 'object') {

        url = imgObj.url || '';

        alt = imgObj.alt || imgObj.title || 'Research Visual Figure';

        title = imgObj.title || imgObj.alt || 'Visual Figure';

      }



      if (!url || !url.startsWith('http')) return;

      if (junkPattern.test(url)) return;



      const sig = getCleanImageSignature(url);

      if (seenImageSignatures.has(sig) || activeResearchImageUrls.has(url)) {

        return; // Skip duplicate / identical image

      }



      if (activeResearchImages.length >= 8) return; // Limit to 8 verified distinct visual figures



      let domain = '';

      try {

        domain = new URL(url).hostname.replace(/^www\./, '');

      } catch (e) {

        domain = 'source';

      }



      seenImageSignatures.add(sig);

      activeResearchImageUrls.add(url);

      activeResearchImages.push({

        url,

        alt: alt || 'Research Visual Figure',

        title: title || 'Visual Figure',

        domain

      });

    });



    renderImageGallery();

  };



  const renderImageGallery = () => {

    const imageContainer = document.getElementById('selectedImagesContainer');

    if (!imageContainer) return;



    if (activeResearchImages.length === 0) {

      imageContainer.style.display = 'none';

      imageContainer.innerHTML = '';

      return;

    }



    imageContainer.innerHTML = `

      <div class="research-gallery-header">

        <div class="gallery-title-wrap">

          <i class="fa-solid fa-images"></i>

          <span>Verified Research Visuals & Figures (${activeResearchImages.length})</span>

        </div>

        <span class="gallery-hint"><i class="fa-solid fa-magnifying-glass-plus"></i> Click any visual to inspect in High-Res Studio Lightbox</span>

      </div>

      <div class="research-gallery-grid" id="researchGalleryGrid"></div>

    `;



    const grid = document.getElementById('researchGalleryGrid');

    activeResearchImages.forEach((item, index) => {

      const card = document.createElement('div');

      card.className = 'gallery-image-card';

      card.title = `${item.alt} (Click to open full view)`;



      const viewport = document.createElement('div');

      viewport.className = 'gallery-img-viewport';



      const img = document.createElement('img');

      img.src = item.url;

      img.alt = item.alt;

      img.loading = 'lazy';



      // Prevent cross-origin hotlink blocks

      img.setAttribute('referrerpolicy', 'no-referrer');



      // Graceful fallback display without deleting the card or wiping the gallery

      img.onerror = () => {

        img.onerror = null;

        img.style.display = 'none';

        const fallback = document.createElement('div');

        fallback.className = 'gallery-fallback-icon';

        fallback.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:rgba(15,23,42,0.85);color:#94a3b8;padding:12px;text-align:center;';

        fallback.innerHTML = `<i class="fa-solid fa-image" style="font-size:1.8rem;margin-bottom:6px;color:#818cf8;"></i><span style="font-size:0.75rem;font-weight:600;color:#e2e8f0;display:block;">${escapeHtml(item.alt || 'Research Visual')}</span><span style="font-size:0.7rem;color:#64748b;">${escapeHtml(item.domain || '')}</span>`;

        viewport.appendChild(fallback);

      };



      const overlay = document.createElement('div');

      overlay.className = 'gallery-card-overlay';

      overlay.innerHTML = '<i class="fa-solid fa-magnifying-glass-plus"></i>';



      viewport.appendChild(img);

      viewport.appendChild(overlay);



      const captionBar = document.createElement('div');

      captionBar.className = 'gallery-card-caption-bar';

      captionBar.innerHTML = `

        <span class="gallery-card-title">${escapeHtml(item.alt)}</span>

        <span class="gallery-domain-pill">${escapeHtml(item.domain)}</span>

      `;



      card.appendChild(viewport);

      card.appendChild(captionBar);



      card.onclick = () => showImageLightbox(index);

      grid.appendChild(card);

    });



    imageContainer.style.display = 'block';

  };



  const enhanceReportImages = (container) => {

    if (!container) return;

    const images = container.querySelectorAll('img:not([data-enhanced])');

    images.forEach(img => {

      img.setAttribute('data-enhanced', 'true');

      img.loading = 'lazy';

      img.title = img.alt ? `${img.alt} (Click to expand)` : 'Click to expand image';



      const altText = (img.alt || '').trim();

      const parent = img.parentElement;



      // Add click-to-lightbox handler

      img.addEventListener('click', () => {

        showImageLightbox(img.src, altText || 'Report Figure');

      });



      // Handle hotlink errors gracefully with an elegant fallback card

      img.onerror = () => {

        const fallback = document.createElement('div');

        fallback.className = 'report-figure-wrap';

        fallback.innerHTML = `

          <div style="background: rgba(15, 23, 42, 0.7); border: 1px dashed rgba(99,102,241,0.4); border-radius: 10px; padding: 14px; text-align: center; margin: 12px 0;">

            <i class="fa-solid fa-image text-muted" style="font-size: 1.5rem; margin-bottom: 6px;"></i>

            <div style="font-size: 0.82rem; color: #cbd5e1; font-weight: 500;">${escapeHtml(altText || 'External Research Visual Asset')}</div>

            <a href="${img.src}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-secondary mt-2" style="font-size: 0.76rem; border-radius: 20px;">

              <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Original Image Source

            </a>

          </div>

        `;

        img.replaceWith(fallback);

      };



      // If there is alt text and parent isn't already a figure, add a caption

      if (altText && (!parent || parent.tagName.toLowerCase() !== 'figure')) {

        const caption = document.createElement('figcaption');

        caption.className = 'report-image-caption';

        caption.innerHTML = `<i class="fa-solid fa-camera"></i> <span>${escapeHtml(altText)}</span>`;

        if (img.nextSibling) {

          parent.insertBefore(caption, img.nextSibling);

        } else {

          parent.appendChild(caption);

        }

      }

    });

  };





  // Professional Fullscreen Interactive Lightbox

  const showImageLightbox = (urlOrIndex, customAlt = '') => {

    let imagesList = activeResearchImages.slice();

    let initialIdx = 0;



    if (typeof urlOrIndex === 'number') {

      initialIdx = Math.max(0, Math.min(urlOrIndex, imagesList.length - 1));

    } else if (typeof urlOrIndex === 'string') {

      const foundIdx = imagesList.findIndex(i => i.url === urlOrIndex);

      if (foundIdx > -1) {

        initialIdx = foundIdx;

      } else {

        // Add single image from report markdown

        let domain = '';

        try { domain = new URL(urlOrIndex).hostname.replace(/^www\./, ''); } catch (e) {}

        imagesList = [{

          url: urlOrIndex,

          alt: customAlt || 'Report Visual Figure',

          title: customAlt || 'Visual Figure',

          domain

        }];

        initialIdx = 0;

      }

    }



    if (!imagesList || imagesList.length === 0) {

      console.warn('No images available to display in lightbox');

      return;

    }

    currentLightboxIndex = initialIdx;

    lightboxZoomLevel = 1.0;



    let lightbox = document.getElementById('inquirexLightbox');

    if (!lightbox) {

      lightbox = document.createElement('div');

      lightbox.id = 'inquirexLightbox';

      lightbox.className = 'inquirex-lightbox';

      lightbox.innerHTML = `

        <div class="lightbox-toolbar">

          <div class="lightbox-info">

            <span class="lightbox-counter" id="lightboxCounter">Figure 1 of 1</span>

            <span class="lightbox-title" id="lightboxTitle">Research Visual</span>

          </div>

          <div class="lightbox-actions">

            <button type="button" class="lightbox-btn" id="lightboxZoomOutBtn" title="Zoom Out (-)"><i class="fa-solid fa-minus"></i></button>

            <button type="button" class="lightbox-btn" id="lightboxZoomResetBtn" title="Reset Zoom (100%)" style="font-size: 0.78rem; font-weight: 700; width: auto; padding: 0 10px;">100%</button>

            <button type="button" class="lightbox-btn" id="lightboxZoomInBtn" title="Zoom In (+)"><i class="fa-solid fa-plus"></i></button>

            <a href="#" target="_blank" rel="noopener noreferrer" class="lightbox-btn" id="lightboxOpenSourceBtn" title="Open Original Source in New Tab"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>

            <button type="button" class="lightbox-btn lightbox-btn-close" id="lightboxCloseBtn" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>

          </div>

        </div>

        <div class="lightbox-stage" id="lightboxStage">

          <button type="button" class="lightbox-nav-btn prev" id="lightboxPrevBtn" title="Previous Image (Left Arrow)"><i class="fa-solid fa-chevron-left"></i></button>

          <div class="lightbox-viewport" id="lightboxViewport">

            <img id="lightboxImg" src="" referrerpolicy="no-referrer" alt="Research Visual" />

          </div>

          <button type="button" class="lightbox-nav-btn next" id="lightboxNextBtn" title="Next Image (Right Arrow)"><i class="fa-solid fa-chevron-right"></i></button>

        </div>

        <div class="lightbox-footer-caption" id="lightboxFooterCaption"></div>

      `;

      document.body.appendChild(lightbox);



      // Wire zoom buttons

      const applyZoom = () => {

        const vp = document.getElementById('lightboxViewport');

        const resetBtn = document.getElementById('lightboxZoomResetBtn');

        if (vp) vp.style.transform = `scale(${lightboxZoomLevel})`;

        if (resetBtn) resetBtn.innerText = `${Math.round(lightboxZoomLevel * 100)}%`;

      };



      document.getElementById('lightboxZoomInBtn').onclick = () => {

        lightboxZoomLevel = Math.min(3.0, lightboxZoomLevel + 0.25);

        applyZoom();

      };

      document.getElementById('lightboxZoomOutBtn').onclick = () => {

        lightboxZoomLevel = Math.max(0.5, lightboxZoomLevel - 0.25);

        applyZoom();

      };

      document.getElementById('lightboxZoomResetBtn').onclick = () => {

        lightboxZoomLevel = 1.0;

        applyZoom();

      };



      // Close handlers

      const closeLightbox = () => {

        lightbox.classList.remove('visible');

        lightboxZoomLevel = 1.0;

        const vp = document.getElementById('lightboxViewport');

        if (vp) vp.style.transform = 'scale(1)';

      };



      document.getElementById('lightboxCloseBtn').onclick = closeLightbox;

      document.getElementById('lightboxStage').onclick = (e) => {

        if (e.target === document.getElementById('lightboxStage')) {

          closeLightbox();

        }

      };



      // Navigation handlers

      document.getElementById('lightboxPrevBtn').onclick = () => {

        if (currentLightboxIndex > 0) {

          currentLightboxIndex--;

          lightboxZoomLevel = 1.0;

          updateLightboxContent();

        }

      };

      document.getElementById('lightboxNextBtn').onclick = () => {

        if (currentLightboxIndex < imagesList.length - 1) {

          currentLightboxIndex++;

          lightboxZoomLevel = 1.0;

          updateLightboxContent();

        }

      };



      // Global keyboard navigation

      document.addEventListener('keydown', (e) => {

        if (!lightbox.classList.contains('visible')) return;

        if (e.key === 'Escape') {

          closeLightbox();

        } else if (e.key === 'ArrowLeft') {

          if (currentLightboxIndex > 0) {

            currentLightboxIndex--;

            lightboxZoomLevel = 1.0;

            updateLightboxContent();

          }

        } else if (e.key === 'ArrowRight') {

          if (currentLightboxIndex < imagesList.length - 1) {

            currentLightboxIndex++;

            lightboxZoomLevel = 1.0;

            updateLightboxContent();

          }

        } else if (e.key === '+' || e.key === '=') {

          lightboxZoomLevel = Math.min(3.0, lightboxZoomLevel + 0.25);

          applyZoom();

        } else if (e.key === '-') {

          lightboxZoomLevel = Math.max(0.5, lightboxZoomLevel - 0.25);

          applyZoom();

        }

      });

    }



    const updateLightboxContent = () => {

      const curItem = imagesList[currentLightboxIndex] || { url: '', alt: 'Figure', title: 'Figure', domain: '' };

      const imgEl = document.getElementById('lightboxImg');

      const counterEl = document.getElementById('lightboxCounter');

      const titleEl = document.getElementById('lightboxTitle');

      const captionEl = document.getElementById('lightboxFooterCaption');

      const openSourceBtn = document.getElementById('lightboxOpenSourceBtn');

      const prevBtn = document.getElementById('lightboxPrevBtn');

      const nextBtn = document.getElementById('lightboxNextBtn');

      const resetBtn = document.getElementById('lightboxZoomResetBtn');

      const vp = document.getElementById('lightboxViewport');



      const fallback = document.getElementById('lightboxFallback');

      if (fallback) fallback.style.display = 'none';



      if (imgEl) {

        imgEl.style.display = 'block';

        imgEl.onerror = () => {

          imgEl.style.display = 'none';

          let fb = document.getElementById('lightboxFallback');

          if (!fb) {

            fb = document.createElement('div');

            fb.id = 'lightboxFallback';

            fb.style.cssText = 'color:#94a3b8;text-align:center;padding:40px;font-size:1rem;';

            fb.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size:2.5rem;color:#f59e0b;margin-bottom:12px;display:block;"></i><span>Preview not available from host source. Click <strong>Open Original Source</strong> above to view.</span>';

            if (vp) vp.appendChild(fb);

          } else {

            fb.style.display = 'block';

          }

        };

        imgEl.src = curItem.url;

      }

      if (counterEl) counterEl.innerText = `Figure ${currentLightboxIndex + 1} of ${imagesList.length}`;

      if (titleEl) titleEl.innerText = curItem.alt || curItem.title || 'Research Visual Figure';

      if (captionEl) {

        captionEl.innerHTML = `<span><strong>${escapeHtml(curItem.alt || curItem.title || 'Visual Figure')}</strong> ${curItem.domain ? '— Source: ' + escapeHtml(curItem.domain) : ''}</span>`;

      }

      if (openSourceBtn) openSourceBtn.href = curItem.url;

      if (resetBtn) resetBtn.innerText = '100%';

      if (vp) vp.style.transform = 'scale(1)';



      if (prevBtn) prevBtn.style.display = imagesList.length > 1 && currentLightboxIndex > 0 ? 'flex' : 'none';

      if (nextBtn) nextBtn.style.display = imagesList.length > 1 && currentLightboxIndex < imagesList.length - 1 ? 'flex' : 'none';

    };



    updateLightboxContent();

    lightbox.classList.add('visible');

  };



  const showImageDialog = (imageUrl) => {

    showImageLightbox(imageUrl);

  };



  // --------------------------------------------------------------------------

  // Research Options Full View Studio

  // --------------------------------------------------------------------------

  const initOptionsFullView = () => {

    const openBtn = document.getElementById('optionsFullViewBtn');

    const modal = document.getElementById('optionsFullViewModal');

    const closeBtn = document.getElementById('closeOptionsFullViewBtn');

    const cancelBtn = document.getElementById('modalCancelBtn');

    const backdrop = document.getElementById('optionsFullViewBackdrop');

    const launchBtn = document.getElementById('modalLaunchBtn');

    const resetBtn = document.getElementById('modalResetBtn');



    if (!openBtn || !modal) return;



    // Main form fields

    const taskInput = document.getElementById('task');

    const reportTypeSelect = document.getElementById('report_type');

    const toneSelect = document.getElementById('tone');

    const reportSourceSelect = document.getElementById('report_source');

    const maxSearchResultsInput = document.getElementById('maxSearchResults');

    const queryDomainsInput = document.getElementById('queryDomains');

    const mcpEnabledCheckbox = document.getElementById('mcpEnabled');

    const mcpConfigTextarea = document.getElementById('mcpConfig');



    // Modal fields

    const modalTask = document.getElementById('modalTask');

    const modalReportType = document.getElementById('modalReportType');

    const modalTone = document.getElementById('modalTone');

    const modalReportSource = document.getElementById('modalReportSource');

    const modalMaxSearchResults = document.getElementById('modalMaxSearchResults');

    const modalDepthValue = document.getElementById('modalDepthValue');

    const modalQueryDomains = document.getElementById('modalQueryDomains');

    const modalMcpEnabled = document.getElementById('modalMcpEnabled');

    const modalMcpControls = document.getElementById('modalMcpControls');

    const modalMcpConfig = document.getElementById('modalMcpConfig');

    const modalFormatMcpBtn = document.getElementById('modalFormatMcpBtn');

    const personaChips = modal.querySelectorAll('.persona-chip');



    // Helper: update active persona in main form

    const updateMainAgentPersona = (agentVal) => {

      let autoAgentRadio = document.getElementById('autoAgent');

      if (autoAgentRadio) {

        autoAgentRadio.value = agentVal;

        autoAgentRadio.checked = true;

      }

      const btnShowAuto = document.getElementById('btnShowAuto');

      if (btnShowAuto) btnShowAuto.innerText = agentVal;

    };



    // Synchronize from Main Form to Modal

    const syncMainToModal = () => {

      if (taskInput && modalTask) modalTask.value = taskInput.value;

      if (reportTypeSelect && modalReportType) modalReportType.value = reportTypeSelect.value;

      if (toneSelect && modalTone) modalTone.value = toneSelect.value;

      if (reportSourceSelect && modalReportSource) modalReportSource.value = reportSourceSelect.value;



      if (maxSearchResultsInput && modalMaxSearchResults) {

        const val = maxSearchResultsInput.value || '5';

        modalMaxSearchResults.value = val;

        if (modalDepthValue) modalDepthValue.innerText = `${val} websites`;

      }



      if (queryDomainsInput && modalQueryDomains) modalQueryDomains.value = queryDomainsInput.value;



      if (mcpEnabledCheckbox && modalMcpEnabled) {

        modalMcpEnabled.checked = mcpEnabledCheckbox.checked;

        if (modalMcpControls) modalMcpControls.style.display = mcpEnabledCheckbox.checked ? 'block' : 'none';

      }



      if (mcpConfigTextarea && modalMcpConfig) modalMcpConfig.value = mcpConfigTextarea.value;



      // Sync active agent persona

      const autoAgentRadio = document.getElementById('autoAgent');

      const agentVal = autoAgentRadio ? autoAgentRadio.value : 'Auto Agent';

      personaChips.forEach(chip => {

        const radio = chip.querySelector('input');

        if (radio && radio.value === agentVal) {

          chip.classList.add('active');

          radio.checked = true;

        } else {

          chip.classList.remove('active');

          if (radio) radio.checked = false;

        }

      });

    };



    // Synchronize from Modal to Main Form

    const syncModalToMain = () => {

      if (modalTask && taskInput) {

        taskInput.value = modalTask.value;

        taskInput.dispatchEvent(new Event('input', { bubbles: true }));

      }

      if (modalReportType && reportTypeSelect) {

        reportTypeSelect.value = modalReportType.value;

        reportTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

      }

      if (modalTone && toneSelect) {

        toneSelect.value = modalTone.value;

        toneSelect.dispatchEvent(new Event('change', { bubbles: true }));

      }

      if (modalReportSource && reportSourceSelect) {

        reportSourceSelect.value = modalReportSource.value;

        reportSourceSelect.dispatchEvent(new Event('change', { bubbles: true }));

      }

      if (modalMaxSearchResults && maxSearchResultsInput) {

        maxSearchResultsInput.value = modalMaxSearchResults.value;

        maxSearchResultsInput.dispatchEvent(new Event('input', { bubbles: true }));

      }

      if (modalQueryDomains && queryDomainsInput) {

        queryDomainsInput.value = modalQueryDomains.value;

        queryDomainsInput.dispatchEvent(new Event('input', { bubbles: true }));

      }



      if (modalMcpEnabled && mcpEnabledCheckbox) {

        if (mcpEnabledCheckbox.checked !== modalMcpEnabled.checked) {

          mcpEnabledCheckbox.checked = modalMcpEnabled.checked;

          mcpEnabledCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

        }

      }



      if (modalMcpConfig && mcpConfigTextarea) {

        mcpConfigTextarea.value = modalMcpConfig.value;

        mcpConfigTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      }



      // Sync active persona

      const activeRadio = modal.querySelector('input[name="modal_agent"]:checked');

      if (activeRadio) {

        updateMainAgentPersona(activeRadio.value);

      }

    };



    // Open Modal

    const openStudioModeModal = (e) => {

      if (e) {

        e.preventDefault();

        e.stopPropagation();

      }

      syncMainToModal();

      modal.style.display = 'flex';

      document.body.style.overflow = 'hidden';

      setTimeout(() => {

        if (modalTask) modalTask.focus();

      }, 50);

    };

    window.openStudioModeModal = openStudioModeModal;



    openBtn.addEventListener('click', openStudioModeModal);



    // Close Modal helper

    const closeModal = () => {

      syncModalToMain();

      modal.style.display = 'none';

      document.body.style.overflow = '';

    };



    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (backdrop) backdrop.addEventListener('click', closeModal);



    // Escape key listener for options full view

    document.addEventListener('keydown', (e) => {

      if (e.key === 'Escape' && modal.style.display !== 'none') {

        closeModal();

      }

    });



    // Range slider live feedback

    if (modalMaxSearchResults) {

      modalMaxSearchResults.addEventListener('input', () => {

        const val = modalMaxSearchResults.value;

        if (modalDepthValue) modalDepthValue.innerText = `${val} websites`;

        if (maxSearchResultsInput) maxSearchResultsInput.value = val;

      });

    }



    // Persona chips selection

    personaChips.forEach(chip => {

      chip.addEventListener('click', (e) => {

        personaChips.forEach(c => c.classList.remove('active'));

        chip.classList.add('active');

        const radio = chip.querySelector('input');

        if (radio) {

          radio.checked = true;

          updateMainAgentPersona(radio.value);

        }

      });

    });



    // MCP toggle in modal

    if (modalMcpEnabled) {

      modalMcpEnabled.addEventListener('change', () => {

        if (modalMcpControls) modalMcpControls.style.display = modalMcpEnabled.checked ? 'block' : 'none';

        if (mcpEnabledCheckbox) {

          mcpEnabledCheckbox.checked = modalMcpEnabled.checked;

          mcpEnabledCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

        }

      });

    }



    // Modal Presets

    const modalPresets = modal.querySelectorAll('[data-modal-preset]');

    modalPresets.forEach(btn => {

      btn.addEventListener('click', () => {

        const preset = btn.dataset.modalPreset;

        if (typeof addMCPPreset === 'function') {

          addMCPPreset(preset);

          if (mcpConfigTextarea && modalMcpConfig) {

            modalMcpConfig.value = mcpConfigTextarea.value;

          }

        }

      });

    });



    // Modal Format JSON

    if (modalFormatMcpBtn) {

      modalFormatMcpBtn.addEventListener('click', () => {

        try {

          const parsed = JSON.parse(modalMcpConfig.value);

          modalMcpConfig.value = JSON.stringify(parsed, null, 2);

          if (mcpConfigTextarea) mcpConfigTextarea.value = modalMcpConfig.value;

        } catch (e) {

          alert('Invalid JSON in MCP configuration');

        }

      });

    }



    // Reset Defaults

    if (resetBtn) {

      resetBtn.addEventListener('click', () => {

        if (modalReportType) modalReportType.value = 'research_report';

        if (modalTone) modalTone.value = 'Objective';

        if (modalReportSource) modalReportSource.value = 'web';

        if (modalMaxSearchResults) {

          modalMaxSearchResults.value = '5';

          if (modalDepthValue) modalDepthValue.innerText = '5 websites';

        }

        if (modalQueryDomains) modalQueryDomains.value = '';

        if (modalMcpEnabled) {

          modalMcpEnabled.checked = false;

          if (modalMcpControls) modalMcpControls.style.display = 'none';

        }

        if (modalMcpConfig) modalMcpConfig.value = '[]';



        personaChips.forEach(chip => {

          const radio = chip.querySelector('input');

          if (radio && radio.value === 'Auto Agent') {

            chip.classList.add('active');

            radio.checked = true;

          } else {

            chip.classList.remove('active');

          }

        });



        syncModalToMain();

      });

    }



    // Launch Research button inside Modal

    if (launchBtn) {

      launchBtn.addEventListener('click', () => {

        const taskVal = modalTask ? modalTask.value.trim() : '';

        if (!taskVal) {

          if (modalTask) modalTask.focus();

          alert('Please enter a research topic or question before launching.');

          return;

        }



        syncModalToMain();

        modal.style.display = 'none';

        document.body.style.overflow = '';



        if (typeof startResearch === 'function') {

          startResearch();

        } else {

          const mainForm = document.getElementById('researchForm');

          if (mainForm) {

            mainForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

          }

        }

      });

    }

  };



    const initDocumentUploadSection = () => {



    const reportSourceSelect = document.getElementById('report_source');



    const uploadSection = document.getElementById('documentUploadSection');



    const dropzone = document.getElementById('docUploadDropzone');



    const fileInput = document.getElementById('docFileInput');



    const filesList = document.getElementById('uploadedFilesList');







    if (!reportSourceSelect || !uploadSection || !dropzone || !fileInput) return;







    const toggleUploadVisibility = () => {



      const val = reportSourceSelect.value;



      if (val === 'local' || val === 'hybrid') {



        uploadSection.style.display = 'block';



        loadUploadedFiles();



      } else {



        uploadSection.style.display = 'none';



      }



    };







    reportSourceSelect.addEventListener('change', toggleUploadVisibility);



    toggleUploadVisibility();







    // Click to open file dialog



    dropzone.addEventListener('click', () => fileInput.click());







    // Drag & Drop



    ['dragenter', 'dragover'].forEach(eventName => {



      dropzone.addEventListener(eventName, (e) => {



        e.preventDefault();



        e.stopPropagation();



        dropzone.classList.add('dragover');



      }, false);



    });







    ['dragleave', 'drop'].forEach(eventName => {



      dropzone.addEventListener(eventName, (e) => {



        e.preventDefault();



        e.stopPropagation();



        dropzone.classList.remove('dragover');



      }, false);



    });







    dropzone.addEventListener('drop', (e) => {



      const dt = e.dataTransfer;



      const files = dt.files;



      if (files && files.length > 0) {



        uploadFiles(files);



      }



    });







    fileInput.addEventListener('change', (e) => {



      if (fileInput.files && fileInput.files.length > 0) {



        uploadFiles(fileInput.files);



      }



    });







    const uploadFiles = async (files) => {



      const pText = dropzone.querySelector('p');



      if (pText) pText.innerHTML = '⏳ <strong>Uploading & indexing documents...</strong>';



      for (const file of files) {



        const formData = new FormData();



        formData.append('file', file);



        try {



          const res = await fetch('/upload/', {



            method: 'POST',



            body: formData



          });



          const resData = await res.json();



          console.log('Uploaded file:', resData);



        } catch (err) {



          console.error('Failed to upload file:', err);



        }



      }



      if (pText) pText.innerHTML = '<strong>Click to browse</strong> or drag & drop private documents here';



      fileInput.value = '';



      loadUploadedFiles();



    };







    const loadUploadedFiles = async () => {



      try {



        const res = await fetch('/files/');



        const data = await res.json();



        const files = data.files || [];



        if (!filesList) return;



        



        if (files.length === 0) {



          filesList.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-tertiary);">No documents uploaded yet. Click above to upload.</span>';



          return;



        }







        filesList.innerHTML = '';



        files.forEach(filename => {



          const chip = document.createElement('div');



          chip.className = 'uploaded-file-chip';



          chip.innerHTML = `



            <i class="fa-solid fa-file-lines file-icon"></i>



            <span>${filename}</span>



            <i class="fa-solid fa-xmark delete-doc-btn" title="Delete document"></i>



          `;



          chip.querySelector('.delete-doc-btn').addEventListener('click', async (e) => {



            e.stopPropagation();



            try {



              await fetch(`/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });



              loadUploadedFiles();



            } catch (err) {



              console.error('Failed to delete file:', err);



            }



          });



          filesList.appendChild(chip);



        });



      } catch (e) {



        console.warn('Failed to load uploaded files:', e);



      }



    };



  };







  // Function to show download bar and enable buttons



  const showDownloadPanels = () => {

    // Show persistent right-hand sidebar export dock

    const sidebarPanel = document.getElementById('exportSidebarPanel');

    if (sidebarPanel) {

      sidebarPanel.style.display = 'block';

      setTimeout(() => sidebarPanel.classList.add('visible'), 20);

    }

    const stickyDownloadsBar = document.getElementById('stickyDownloadsBar');

    if (stickyDownloadsBar) {

      stickyDownloadsBar.style.display = 'block';

      stickyDownloadsBar.classList.add('visible');

    }



    // Export suite consolidated inside research report view (navbar export removed)



    // Enable all export buttons across navbar, sidebar, and report

    const downloadButtons = document.querySelectorAll('.download-option-btn, .report-action-btn, .export-dock-item, .nav-export-btn, .export-tool-btn, .dropdown-export-item');

    downloadButtons.forEach(button => {

      button.classList.remove('disabled');

    });



    // Make top buttons report-actions section visible

    const reportActions = document.querySelector('.report-actions');

    if (reportActions) {

      reportActions.style.display = 'flex';

    }

  }







  // --- Storage Helpers (Cookies or LocalStorage) ---



  function setCookie(name, value, days) {



    // Maximum cookie size is around 4KB (4096 bytes)



    const MAX_COOKIE_SIZE = 4000;







    // If cookies are disabled, use localStorage instead



    if (!cookiesEnabled) {



      try {



        localStorage.setItem(name, value);



        console.debug(`Data saved to localStorage: ${name}`);



        return true;



      } catch (e) {



        console.error("Error saving to localStorage:", e);



        return false;



      }



    }







    let expires = '';



    if (days) {



      const date = new Date();



      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));



      expires = '; expires=' + date.toUTCString();



    }







    // Encode the value



    const encodedValue = encodeURIComponent(value);







    // Calculate cookie size



    const cookieSize = (name + '=' + encodedValue + expires + '; path=/').length;



    console.debug(`Setting cookie: ${name}, size: ${cookieSize} bytes`);







    // If cookie is too large, display warning and truncate history



    if (cookieSize > MAX_COOKIE_SIZE) {



      console.warn(`Cookie size (${cookieSize} bytes) exceeds the ${MAX_COOKIE_SIZE} bytes limit!`);



      showToast('Warning: History too large for cookie storage! Oldest entries will be removed.');







      if (name === 'conversationHistory') {



        try {



          // Parse, reduce entries, and try again



          const historyData = JSON.parse(value);



          if (Array.isArray(historyData) && historyData.length > 1) {



            // Remove the last entry and try again recursively



            const reducedHistory = historyData.slice(0, -1);



            console.debug(`Reducing history from ${historyData.length} to ${reducedHistory.length} entries`);



            setCookie(name, JSON.stringify(reducedHistory), days);



            return; // Exit after recursive call



          }



        } catch (e) {



          console.error('Could not parse history to reduce size:', e);



        }



      }







      return false; // Indicate failure



    }







    // Set the cookie



    document.cookie = name + '=' + encodedValue + expires + '; path=/';



    console.debug(`Cookie set: ${name}`);



    return true; // Indicate success



  }







  function getCookie(name) {



    console.debug(`Getting data: ${name}`);







    // If cookies are disabled, use localStorage instead



    if (!cookiesEnabled) {



      try {



        const value = localStorage.getItem(name);



        if (value) {



          console.debug(`Data found in localStorage: ${name}, length: ${value.length} chars`);



          return value;



        }



        console.debug(`Data not found in localStorage: ${name}`);



        return null;



      } catch (e) {



        console.error("Error retrieving from localStorage:", e);



        return null;



      }



    }







    const nameEQ = name + '=';



    const ca = document.cookie.split(';');



    for (let i = 0; i < ca.length; i++) {



      let c = ca[i];



      while (c.charAt(0) == ' ') c = c.substring(1, c.length);



      if (c.indexOf(nameEQ) == 0) {



        const value = decodeURIComponent(c.substring(nameEQ.length, c.length));



        console.debug(`Found cookie: ${name}, length: ${value.length} chars`);



        return value;



      }



    }



    console.debug(`Cookie not found: ${name}`);



    return null;



  }







  function deleteCookie(name) {



    console.debug(`Deleting storage: ${name}`);







    // If cookies are disabled, use localStorage instead



    if (!cookiesEnabled) {



      try {



        localStorage.removeItem(name);



        return;



      } catch (e) {



        console.error("Error removing from localStorage:", e);



        return;



      }



    }







    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';



  }



  // --- End Storage Helpers ---







  // Debug Helper - check cookie status



  const checkCookieStatus = () => {



    if (!cookiesEnabled) {



      const storageData = localStorage.getItem('conversationHistory');



      if (storageData) {



        const byteSize = new Blob([storageData]).size;



        const kilobyteSize = (byteSize / 1024).toFixed(2);







        try {



          const parsed = JSON.parse(storageData);



          const entryCount = Array.isArray(parsed) ? parsed.length : 0;







          showToast(`Using localStorage: ${kilobyteSize}KB, ${entryCount} entries`);



          console.debug(`LocalStorage size: ${byteSize} bytes, ${kilobyteSize}KB`);



          console.debug(`LocalStorage entries: ${entryCount}`);



        } catch (e) {



          showToast(`LocalStorage contains invalid data: ${kilobyteSize}KB`);



          console.error('LocalStorage parse error:', e);



        }



      } else {



        showToast('No research history found in localStorage');



      }



      return;



    }







    const allCookies = document.cookie;



    console.debug('All cookies:', allCookies);







    const conversationCookie = getCookie('conversationHistory');



    if (conversationCookie) {



      const byteSize = new Blob([conversationCookie]).size;



      const kilobyteSize = (byteSize / 1024).toFixed(2);







      try {



        const parsed = JSON.parse(conversationCookie);



        const entryCount = Array.isArray(parsed) ? parsed.length : 0;







        showToast(`Cookie found: ${kilobyteSize}KB, ${entryCount} research entries`);



        console.debug(`Cookie size: ${byteSize} bytes, ${kilobyteSize}KB`);



        console.debug(`Cookie entries: ${entryCount}`);



      } catch (e) {



        showToast(`Cookie found but invalid: ${kilobyteSize}KB`);



        console.error('Cookie parse error:', e);



      }



    } else {



      showToast('No research history cookie found');



    }



  }







  // Export history to a downloadable JSON file



  const exportHistory = () => {



    try {



      if (!conversationHistory || conversationHistory.length === 0) {



        showToast('No research history to export');



        return;



      }







      // Create a formatted JSON string with pretty-printing



      const historyJson = JSON.stringify(conversationHistory, null, 2);







      // Create a Blob containing the data



      const blob = new Blob([historyJson], { type: 'application/json' });







      // Create an object URL for the blob



      const url = URL.createObjectURL(blob);







      // Create a temporary link element



      const link = document.createElement('a');



      link.href = url;







      // Set download attribute with filename



      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');



      link.download = `research-history-${timestamp}.json`;







      // Append to the document



      document.body.appendChild(link);







      // Programmatically click the link to trigger the download



      link.click();







      // Clean up



      document.body.removeChild(link);



      URL.revokeObjectURL(url);







      showToast('Research history exported to JSON file');



      console.debug('History exported, entries:', conversationHistory.length);



    } catch (error) {



      console.error('Error exporting history:', error);



      showToast('Error exporting research history');



    }



  }







  // Trigger the file input for importing history



  const triggerImportHistory = () => {



    const fileInput = document.getElementById('historyFileInput');



    if (fileInput) {



      fileInput.click();



    } else {



      showToast('Import functionality not available');



    }



  }







  // Handle the file import for history



  const handleFileImport = (event) => {



    const file = event.target.files[0];



    if (!file) {



      return;



    }







    const reader = new FileReader();







    reader.onload = (e) => {



      try {



        const content = e.target.result;



        const importedData = JSON.parse(content);







        // Validate the imported data



        if (!Array.isArray(importedData)) {



          throw new Error('Imported data is not an array');



        }







        // Check if each entry has the required fields



        const validEntries = importedData.filter(entry => {



          return entry &&



            typeof entry === 'object' &&



            (entry.prompt || entry.task) && // Allow both prompt and legacy task field



            (entry.links || entry.downloadLinks); // Allow both links and legacy downloadLinks



        });







        if (validEntries.length === 0) {



          showToast('No valid research entries found in the imported file');



          return;



        }







        // Map the entries to the current structure if needed



        const mappedEntries = validEntries.map(entry => {



          return {



            prompt: entry.prompt || entry.task || '',



            links: entry.links || entry.downloadLinks || {},



            timestamp: entry.timestamp || new Date().toISOString()



          };



        });







        // Confirm before overwriting existing history



        if (conversationHistory && conversationHistory.length > 0) {



          if (confirm(`You have ${conversationHistory.length} existing research entries. Do you want to:



- Click OK to MERGE imported history with existing history



- Click Cancel to REPLACE all existing history with imported data`)) {



            // Merge with existing history



            conversationHistory = [...mappedEntries, ...conversationHistory];



          } else {



            // Replace existing history



            conversationHistory = mappedEntries;



          }



        } else {



          // No existing history, just set the imported data



          conversationHistory = mappedEntries;



        }







        // Save the new history and update the UI



        saveConversationHistory();



        renderHistoryEntries();







        showToast(`Successfully imported ${validEntries.length} research entries`);



        console.debug('Research history imported, valid entries:', validEntries.length);







      } catch (error) {



        console.error('Error importing history:', error);



        showToast('Error importing research history: Invalid file format');



      }







      // Reset the file input so the same file can be selected again



      event.target.value = '';



    };







    reader.onerror = () => {



      console.error('Error reading file');



      showToast('Error reading the imported file');



      event.target.value = '';



    };







    reader.readAsText(file);



  }







  // Initialize chat functionality



  const initChat = () => {



    const chatInput = document.getElementById('chatInput');



    const sendChatBtn = document.getElementById('sendChatBtn');



    const voiceInputBtn = document.getElementById('voiceInputBtn');







    if (!chatInput || !sendChatBtn) return;







    // Clear previous messages



    const chatMessages = document.getElementById('chatMessages');



    if (chatMessages) {



      chatMessages.innerHTML = '';



    }







    // Add event listeners for chat input



    chatInput.addEventListener('keydown', (e) => {



      if (e.key === 'Enter' && !e.shiftKey) {



        e.preventDefault();



        sendChatMessage();



      }



    });







    sendChatBtn.addEventListener('click', sendChatMessage);







    // Initialize speech recognition if supported



    if (voiceInputBtn) {



      initSpeechRecognition(voiceInputBtn, chatInput);



    }







    // Auto-resize textarea as content grows



    chatInput.addEventListener('input', () => {



      chatInput.style.height = 'auto';



      chatInput.style.height = (chatInput.scrollHeight) + 'px';



    });







    // Add welcome message



    addChatMessage('I can answer questions about the research report. What would you like to know?', false);



  }







  // Initialize speech recognition



  const initSpeechRecognition = (button, inputElement) => {



    // Check if browser supports speech recognition



    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;







    if (!SpeechRecognition) {



      console.warn('Speech recognition not supported in this browser');



      button.style.display = 'none';



      return;



    }







    const recognition = new SpeechRecognition();







    // Configure speech recognition



    recognition.continuous = false;



    recognition.lang = 'en-US';



    recognition.interimResults = true;



    recognition.maxAlternatives = 1;







    let isListening = false;



    let finalTranscript = '';







    // Add event listeners for speech recognition



    recognition.onstart = () => {



      isListening = true;



      finalTranscript = '';



      button.classList.add('listening');



      button.innerHTML = '<i class="fas fa-microphone-slash"></i>';



      button.title = 'Stop listening';







      // Show visual feedback



      showToast('Listening...', 1000);



    };







    recognition.onresult = (event) => {



      let interimTranscript = '';







      // Loop through the results



      for (let i = event.resultIndex; i < event.results.length; i++) {



        const transcript = event.results[i][0].transcript;







        if (event.results[i].isFinal) {



          finalTranscript += transcript;



        } else {



          interimTranscript += transcript;



        }



      }







      // Update the input element with the transcription



      inputElement.value = finalTranscript + interimTranscript;







      // Trigger input event to resize textarea



      const inputEvent = new Event('input', { bubbles: true });



      inputElement.dispatchEvent(inputEvent);



    };







    recognition.onerror = (event) => {



      console.error('Speech recognition error', event.error);



      resetRecognition();







      if (event.error === 'not-allowed') {



        showToast('Microphone access denied. Please allow microphone access in your browser settings.', 3000);



      } else {



        showToast('Speech recognition error: ' + event.error, 3000);



      }



    };







    recognition.onend = () => {



      resetRecognition();



    };







    // Reset the recognition state



    const resetRecognition = () => {



      isListening = false;



      button.classList.remove('listening');



      button.innerHTML = '<i class="fas fa-microphone"></i>';



      button.title = 'Use voice input';



    };







    // Toggle speech recognition on button click



    button.addEventListener('click', () => {



      if (isListening) {



        recognition.stop();



      } else {



        recognition.start();



      }



    });



  };







  // Create a new function to handle WebSocket reconnection



  const reconnectWebSocket = (message = null) => {



    // Don't attempt too many reconnections



    if (reconnectAttempts >= maxReconnectAttempts) {



      console.error(`Failed to reconnect after ${maxReconnectAttempts} attempts`);



      addChatMessage(`Unable to reconnect after ${maxReconnectAttempts} attempts. Please refresh the page.`, false);



      return false;



    }







    reconnectAttempts++;







    // Calculate backoff time (exponential backoff)



    const backoff = reconnectInterval * Math.pow(1.5, reconnectAttempts - 1);



    console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts}) in ${backoff}ms...`);







    // Show reconnection status to user



    addChatMessage(`Connection lost. Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`, false);







    // Try to reconnect after delay



    setTimeout(() => {



      try {



        // Setup new WebSocket connection



        dispose_socket = listenToSockEvents();







        // Set up a one-time handler to send the message after reconnection



        if (message) {



          const messageToSend = message;



          const checkConnectionAndSend = () => {



            if (socket && socket.readyState === WebSocket.OPEN) {



              console.log("Reconnected successfully, sending queued message");



              socket.send(messageToSend);



              return true;



            } else if (reconnectAttempts < maxReconnectAttempts) {



              console.log("Socket not ready yet, retrying...");



              setTimeout(checkConnectionAndSend, 1000);



              return false;



            }



            return false;



          };







          setTimeout(checkConnectionAndSend, 1000);



        }







        return true;



      } catch (e) {



        console.error("Error during reconnection:", e);



        return false;



      }



    }, backoff);







    return true;



  };







  // Send a chat message



  const sendChatMessage = () => {



    const chatInput = document.getElementById('chatInput');



    if (!chatInput || !chatInput.value.trim()) return;







    const message = chatInput.value.trim();







    // Add user message to chat



    addChatMessage(message, true);







    // Clear input



    chatInput.value = '';



    chatInput.style.height = 'auto';







    // Add loading indicator



    const loadingId = addLoadingIndicator();







    // Gather report context from allReports or DOM



    const reportText = allReports || document.getElementById('reportContainer')?.innerText || '';



    const payload = {



      message: message,



      report: reportText,



      messages: [{ role: 'user', content: message }]



    };



    const messageToSend = `chat ${JSON.stringify(payload)}`;







    // Send through WebSocket if active



    if (socket && socket.readyState === WebSocket.OPEN) {



      socket.send(messageToSend);



    } else {



      // Fallback: Use HTTP POST /api/chat directly so user doubts can always be answered!



      fetch('/api/chat', {



        method: 'POST',



        headers: { 'Content-Type': 'application/json' },



        credentials: 'include',



        body: JSON.stringify({



          report: reportText,



          messages: [{ role: 'user', content: message }]



        })



      })



      .then(res => res.json())



      .then(data => {



        removeLoadingIndicator(loadingId);



        if (data.response && data.response.content) {



          addChatMessage(data.response.content, false);



        } else if (data.content) {



          addChatMessage(data.content, false);



        } else if (data.error) {



          addChatMessage('Error: ' + data.error, false);



        } else {



          addChatMessage('I received your question but could not generate a response. Please try again.', false);



        }



      })



      .catch(err => {



        removeLoadingIndicator(loadingId);



        console.error('Chat API error:', err);



        addChatMessage('Unable to reach AI assistant. Please check your network connection.', false);



      });



    }



  }







  // Add a chat message to the UI



  const addChatMessage = (message, isUser = false) => {



    const chatMessages = document.getElementById('chatMessages');



    if (!chatMessages) return;







    const messageEl = document.createElement('div');



    messageEl.className = `chat-message ${isUser ? 'user-message' : 'ai-message'}`;







    // Process message for AI responses (convert markdown to HTML for AI messages)



    let processedMessage = message;



    if (!isUser) {



      // Use showdown for markdown conversion



      const converter = new showdown.Converter({



        ghCodeBlocks: true,



        tables: true,



        tasklists: true,



        openLinksInNewWindow: true



      });



      processedMessage = converter.makeHtml(message);



    }







    // Set message content



    messageEl.innerHTML = isUser ? escapeHtml(processedMessage) : processedMessage;







    // Add timestamp



    const timestampEl = document.createElement('div');



    timestampEl.className = 'chat-timestamp';



    const now = new Date();



    timestampEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });



    messageEl.appendChild(timestampEl);







    // Add to chat container



    chatMessages.appendChild(messageEl);







    // Scroll to bottom



    chatMessages.scrollTop = chatMessages.scrollHeight;



  }







  // Add a loading indicator



  const addLoadingIndicator = () => {



    const chatMessages = document.getElementById('chatMessages');



    if (!chatMessages) return null;







    const loadingId = 'loading-' + Date.now();



    const loadingEl = document.createElement('div');



    loadingEl.className = 'chat-message ai-message chat-loading';



    loadingEl.id = loadingId;







    // Create the dots



    for (let i = 0; i < 3; i++) {



      const dot = document.createElement('div');



      dot.className = 'chat-dot';



      loadingEl.appendChild(dot);



    }







    chatMessages.appendChild(loadingEl);



    chatMessages.scrollTop = chatMessages.scrollHeight;







    return loadingId;



  }







  // Remove loading indicator



  const removeLoadingIndicator = (loadingId) => {



    if (!loadingId) return;







    const loadingEl = document.getElementById(loadingId);



    if (loadingEl) {



      loadingEl.remove();



    }



  }







  // Escape HTML to prevent XSS in user messages



  const escapeHtml = (text) => {



    const div = document.createElement('div');



    div.textContent = text;



    return div.innerHTML;



  }







  // Initialize expand buttons



  const initExpandButtons = () => {



    // Report container expand button



    // Report container expand button (fullscreen toggle)
    const expandReportBtn = document.getElementById('expandReportBtn');
    if (expandReportBtn && !expandReportBtn.getAttribute('onclick')) {
      expandReportBtn.setAttribute('onclick', 'toggleResearchReportFullscreen(event)');
    }







    // Chat container expand button



    const expandChatBtn = document.getElementById('expandChatBtn');



    if (expandChatBtn) {



      expandChatBtn.addEventListener('click', () => {



        const chatContainer = document.getElementById('chatContainer');



        toggleExpand(chatContainer);



      });



    }







    // Output container expand button



    // Output container expand button (handled via onclick="toggleResearchProgressFullscreen(event)")
    const expandOutputBtn = document.getElementById('expandOutputBtn');
    if (expandOutputBtn && !expandOutputBtn.getAttribute('onclick')) {
      expandOutputBtn.setAttribute('onclick', 'toggleResearchProgressFullscreen(event)');
    }







    // Close expanded view when ESC key is pressed



    document.addEventListener('keydown', (e) => {



      if (e.key === 'Escape') {



        const expandedElements = document.querySelectorAll('.expanded-view');



        expandedElements.forEach(el => {



          // Reset the button icon



          const button = el.querySelector('.expand-button i');



          if (button) {



            button.classList.remove('fa-compress-alt');



            button.classList.add('fa-expand-alt');



          }







          // Reset content container styles



          const contentContainers = el.querySelectorAll('#reportContainer, #output, #chatMessages');



          contentContainers.forEach(container => {



            if (container) {



              container.style.maxHeight = '';



            }



          });







          // Remove expanded-view class



          el.classList.remove('expanded-view');



        });



      }



    });



  }







  // Toggle expand mode for an element



  const toggleExpand = (element) => {



    if (!element) return;







    // Toggle expanded-view class



    element.classList.toggle('expanded-view');







    // Change button icon and title based on state



    const buttonIcon = element.querySelector('.expand-button i');



    const button = element.querySelector('.expand-button');







    if (buttonIcon && button) {



      if (element.classList.contains('expanded-view')) {



        buttonIcon.classList.remove('fa-compress-alt');



        buttonIcon.classList.add('fa-compress-alt');



        button.title = 'Collapse'; // Update title to Collapse







        // Find content containers and expand their height



        const contentContainers = element.querySelectorAll('#reportContainer, #output, #chatMessages');



        contentContainers.forEach(container => {



          if (container) {



            // Set expanded heights - no positioning changes



            if (container.id === 'reportContainer') {



              container.style.maxHeight = '800px'; // Fixed expanded height for report



            } else {



              container.style.maxHeight = '600px'; // Fixed expanded height for other content



            }



          }



        });



      } else {



        buttonIcon.classList.remove('fa-compress-alt');



        buttonIcon.classList.add('fa-expand-alt');



        button.title = 'Expand'; // Update title to Expand







        // Reset heights and relative bounds when collapsed

        const contentContainers = element.querySelectorAll('#reportContainer, #output, #chatMessages');

        contentContainers.forEach(container => {

          if (container) {

            container.style.maxHeight = '';

          }

        });

        element.style.width = '';

        element.style.transform = '';

        element.style.gridColumn = '';

        window.scrollTo({ left: 0 });



      }



    }



  }







  // MCP Configuration Management



  



  // Initialize MCP functionality



  const initMCPSection = () => {



    const mcpEnabled = document.getElementById('mcpEnabled');



    const mcpConfigSection = document.getElementById('mcpConfigSection');



    const mcpInfoBtn = document.getElementById('mcpInfoBtn');



    const mcpConfig = document.getElementById('mcpConfig');



    const mcpFormatBtn = document.getElementById('mcpFormatBtn');



    const mcpExampleLink = document.getElementById('mcpExampleLink');







    if (!mcpEnabled || !mcpConfigSection) {



      console.warn('MCP elements not found');



      return;



    }







    // Toggle MCP config section



    mcpEnabled.addEventListener('change', () => {



      if (mcpEnabled.checked) {



        mcpConfigSection.style.display = 'block';



        updateRetrieverForMCP(true);



      } else {



        mcpConfigSection.style.display = 'none';



        updateRetrieverForMCP(false);



      }



    });







    // MCP info modal



    if (mcpInfoBtn) {



      mcpInfoBtn.addEventListener('click', showMCPInfo);



    }







    // JSON validation and formatting



    if (mcpConfig) {



      mcpConfig.addEventListener('input', validateMCPConfig);



      mcpConfig.addEventListener('blur', validateMCPConfig);



    }







    if (mcpFormatBtn) {



      mcpFormatBtn.addEventListener('click', formatMCPConfig);



    }







    if (mcpExampleLink) {



      mcpExampleLink.addEventListener('click', (e) => {



        e.preventDefault();



        showMCPExample();



      });



    }







    // Preset buttons



    const presetButtons = document.querySelectorAll('.preset-btn');



    presetButtons.forEach(btn => {



      btn.addEventListener('click', (e) => {



        const preset = e.currentTarget.dataset.preset;



        addMCPPreset(preset);



      });



    });







    // Create MCP info modal



    createMCPInfoModal();







    // Initial validation



    validateMCPConfig();



  };







  // Validate MCP JSON configuration



  const validateMCPConfig = () => {



    const mcpConfig = document.getElementById('mcpConfig');



    const mcpConfigStatus = document.getElementById('mcpConfigStatus');



    



    if (!mcpConfig || !mcpConfigStatus) return;







    const configText = mcpConfig.value.trim();



    



    if (!configText || configText === '[]') {



      mcpConfig.className = 'form-control mcp-config-textarea';



      mcpConfigStatus.textContent = 'Empty configuration';



      mcpConfigStatus.className = 'mcp-status-text';



      return true;



    }







    try {



      const parsed = JSON.parse(configText);



      



      if (!Array.isArray(parsed)) {



        throw new Error('Configuration must be an array');



      }







      // Validate each server config



      const errors = [];



      parsed.forEach((server, index) => {



        if (!server.name) {



          errors.push(`Server ${index + 1}: missing name`);



        }



        if (!server.command && !server.connection_url) {



          errors.push(`Server ${index + 1}: missing command or connection_url`);



        }



      });







      if (errors.length > 0) {



        throw new Error(errors.join('; '));



      }







      mcpConfig.className = 'form-control mcp-config-textarea valid';



      mcpConfigStatus.textContent = `Valid JSON ✓ (${parsed.length} server${parsed.length !== 1 ? 's' : ''})`;



      mcpConfigStatus.className = 'mcp-status-text valid';



      return true;







    } catch (error) {



      mcpConfig.className = 'form-control mcp-config-textarea invalid';



      mcpConfigStatus.textContent = `Invalid JSON: ${error.message}`;



      mcpConfigStatus.className = 'mcp-status-text invalid';



      return false;



    }



  };







  // Format MCP JSON configuration



  const formatMCPConfig = () => {



    const mcpConfig = document.getElementById('mcpConfig');



    if (!mcpConfig) return;







    try {



      const parsed = JSON.parse(mcpConfig.value.trim() || '[]');



      mcpConfig.value = JSON.stringify(parsed, null, 2);



      validateMCPConfig();



      showToast('JSON formatted successfully!');



    } catch (error) {



      showToast('Cannot format invalid JSON');



    }



  };







  // Show MCP configuration example



  const showMCPExample = () => {



    const exampleConfig = [



      {



        "name": "github",



        "command": "npx",



        "args": ["-y", "@modelcontextprotocol/server-github"],



        "env": {



          "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"



        }



      },



      {



        "name": "filesystem",



        "command": "npx",



        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"],



        "env": {}



      }



    ];







    const mcpConfig = document.getElementById('mcpConfig');



    if (mcpConfig) {



      mcpConfig.value = JSON.stringify(exampleConfig, null, 2);



      validateMCPConfig();



      showToast('Example configuration loaded!');



    }



  };







  // Update retriever configuration for MCP



  const updateRetrieverForMCP = (enableMCP) => {



    if (enableMCP) {



      showToast('MCP enabled - will be included in research process');



    } else {



      showToast('MCP disabled - using web search only');



    }



  };







  // Show MCP information modal



  const showMCPInfo = () => {



    const modal = document.getElementById('mcpInfoModal');



    if (modal) {



      modal.classList.add('visible');



    }



  };







  // Create MCP info modal



  const createMCPInfoModal = () => {



    if (document.getElementById('mcpInfoModal')) return;







    const modal = document.createElement('div');



    modal.id = 'mcpInfoModal';



    modal.className = 'mcp-info-modal';



    



    modal.innerHTML = `



      <div class="mcp-info-content">



        <button class="mcp-info-close" onclick="closeMCPInfo()">



          <i class="fas fa-times"></i>



        </button>



        <h3>Model Context Protocol (MCP)</h3>



        <p>MCP enables GPT Researcher to connect with external tools and data sources through a standardized protocol.</p>



        



        <h4 class="highlight">Benefits:</h4>



        <ul>



          <li><span class="highlight">Access Local Data:</span> Connect to databases, file systems, and APIs</li>



          <li><span class="highlight">Use External Tools:</span> Integrate with web services and third-party tools</li>



          <li><span class="highlight">Extend Capabilities:</span> Add custom functionality through MCP servers</li>



          <li><span class="highlight">Maintain Security:</span> Controlled access with proper authentication</li>



        </ul>







        <h4 class="highlight">Quick Start:</h4>



        <ul>



          <li>Enable MCP using the checkbox above</li>



          <li>Click a preset to add pre-configured servers to the JSON</li>



          <li>Or paste your own MCP configuration as a JSON array</li>



          <li>Start your research - MCP will run with optimal settings</li>



        </ul>







        <h4 class="highlight">Configuration Format:</h4>



        <p>Each MCP server should be a JSON object with these properties:</p>



        <ul>



          <li><span class="highlight">name:</span> Unique identifier (e.g., "github", "filesystem")</li>



          <li><span class="highlight">command:</span> Command to run the server (e.g., "npx", "python")</li>



          <li><span class="highlight">args:</span> Array of arguments (e.g., ["-y", "@modelcontextprotocol/server-github"])</li>



          <li><span class="highlight">env:</span> Object with environment variables (e.g., {"API_KEY": "your_key"})</li>



        </ul>



      </div>



    `;







    document.body.appendChild(modal);







    // Close modal when clicking outside



    modal.addEventListener('click', (e) => {



      if (e.target === modal) {



        modal.classList.remove('visible');



      }



    });







    // Close with Escape key



    document.addEventListener('keydown', (e) => {



      if (e.key === 'Escape' && modal.classList.contains('visible')) {



        modal.classList.remove('visible');



      }



    });



  };







  // Close MCP info modal



  window.closeMCPInfo = () => {



    const modal = document.getElementById('mcpInfoModal');



    if (modal) {



      modal.classList.remove('visible');



    }



  };







  // Add MCP preset configurations



  const addMCPPreset = (preset) => {



    const presets = {



      github: {



        "name": "github",



        "command": "npx",



        "args": ["-y", "@modelcontextprotocol/server-github"],



        "env": {



          "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"



        }



      },



      tavily: {



        "name": "tavily",



        "command": "npx",



        "args": ["-y", "tavily-mcp@0.1.2"],



        "env": {



          "TAVILY_API_KEY": "your_tavily_api_key_here"



        }



      },



      filesystem: {



        "name": "filesystem",



        "command": "npx",



        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"],



        "env": {}



      }



    };







    const config = presets[preset];



    if (!config) return;







    const mcpConfig = document.getElementById('mcpConfig');



    if (!mcpConfig) return;







    try {



      let currentConfig = [];



      const currentText = mcpConfig.value.trim();



      



      if (currentText && currentText !== '[]') {



        currentConfig = JSON.parse(currentText);



      }







      // Check if server already exists



      const existingIndex = currentConfig.findIndex(server => server.name === config.name);



      



      if (existingIndex !== -1) {



        // Replace existing server



        currentConfig[existingIndex] = config;



        showToast(`Updated ${preset} MCP server configuration`);



      } else {



        // Add new server



        currentConfig.push(config);



        showToast(`Added ${preset} MCP server configuration`);



      }







      mcpConfig.value = JSON.stringify(currentConfig, null, 2);



      validateMCPConfig();







    } catch (error) {



      console.error('Error adding preset:', error);



      showToast('Error adding preset configuration');



    }



  };







  // Collect MCP configuration data



  const collectMCPData = () => {



    const mcpEnabled = document.getElementById('mcpEnabled');



    if (!mcpEnabled || !mcpEnabled.checked) {



      return null;



    }







    const mcpConfig = document.getElementById('mcpConfig');



    



    if (!mcpConfig) {



      console.warn('MCP config element not found for data collection');



      return null;



    }







    // Validate configuration before collecting



    if (!validateMCPConfig()) {



      showToast('Invalid MCP configuration - please fix errors before submitting');



      return null;



    }







    try {



      const configText = mcpConfig.value.trim();



      const mcpConfigs = configText && configText !== '[]' ? JSON.parse(configText) : [];







      return {



        mcp_enabled: true,



        mcp_strategy: "fast", // Always use "fast" strategy as default



        mcp_configs: mcpConfigs



      };



    } catch (error) {



      console.error('Error collecting MCP data:', error);



      showToast('Error processing MCP configuration');



      return null;



    }



  };







  return {



    init,



    startResearch,
    stopResearch,

    addTag,



    copyToClipboard,



    displaySelectedImages,



    showImageDialog,



    checkCookieStatus,



    exportHistory,



    importHistory: triggerImportHistory,  // Add import function to return object



    loadUserHistory: (userId) => { loadConversationHistory(); },



    initChat,



    sendChatMessage,



    addChatMessage,



    showDownloadPanels,



    updateDownloadLink,



    clearResearchImages,



    resetState: () => { clearResearchImages(); updateState('initial'); },



    saveToHistory,



    loadResearchEntry,



    renderImageGallery



  }



})()







window.InquireXResearcher = InquireXResearcher;
window.InquireX = InquireXResearcher;
window.GPTResearcher = InquireXResearcher;

window.addEventListener('DOMContentLoaded', InquireXResearcher.init);






// ==============================================================

// InquireX Research Progress Fullscreen Controller (In-Place, Debounced, No DOM Unmounting)
// ==============================================================
let _progressFullscreenSavedScroll = 0;
let _lastProgressFullscreenToggle = 0;

function toggleResearchProgressFullscreen(e, forceState) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  // Debounce guard to prevent double-firing from bubbling/nested events
  const now = Date.now();
  if (now - _lastProgressFullscreenToggle < 200) {
    return;
  }
  _lastProgressFullscreenToggle = now;

  const container = document.getElementById('researchOutputContainer');
  if (!container) return;

  const isCurrentlyFullscreen = container.classList.contains('progress-card-fullscreen');
  const shouldBeFullscreen = typeof forceState === 'boolean' ? forceState : !isCurrentlyFullscreen;

  const btn = document.getElementById('expandOutputBtn') || container.querySelector('.expand-button');
  const icon = btn ? btn.querySelector('i') : null;
  const outputEl = document.getElementById('output');

  if (shouldBeFullscreen) {
    // 1. Record scroll position before fullscreen overlay
    _progressFullscreenSavedScroll = window.scrollY || document.documentElement.scrollTop || 0;

    // 2. Lock background scrolling
    document.body.classList.add('progress-fullscreen-active');
    document.documentElement.classList.add('progress-fullscreen-active');
    document.body.style.overflow = 'hidden';

    // 3. Apply fullscreen state IN-PLACE (never detach or append to body)
    container.classList.add('progress-card-fullscreen');

    // 4. Update expand/compress icon and button attributes
    if (btn) {
      btn.title = 'Exit Fullscreen (Esc)';
      btn.setAttribute('aria-label', 'Exit Fullscreen');
      btn.classList.add('is-fullscreen');
    }
    if (icon) {
      icon.className = 'fas fa-compress-alt';
    }

    // 5. Stretch inner log feed to fill all vertical space
    if (outputEl) {
      outputEl.style.setProperty('max-height', 'none', 'important');
      outputEl.style.setProperty('height', 'auto', 'important');
      outputEl.style.setProperty('flex', '1 1 auto', 'important');
      setTimeout(() => {
        outputEl.scrollTop = outputEl.scrollHeight;
      }, 40);
    }
  } else {
    // 1. Remove fullscreen class
    container.classList.remove('progress-card-fullscreen');

    // 2. Unlock background scrolling
    document.body.classList.remove('progress-fullscreen-active');
    document.documentElement.classList.remove('progress-fullscreen-active');
    document.body.style.overflow = '';

    // 3. Reset button icon and attributes
    if (btn) {
      btn.title = 'Toggle Fullscreen (Esc to exit)';
      btn.setAttribute('aria-label', 'Toggle Fullscreen');
      btn.classList.remove('is-fullscreen');
    }
    if (icon) {
      icon.className = 'fas fa-expand-alt';
    }

    // 4. Reset inner log feed styling
    if (outputEl) {
      outputEl.style.removeProperty('max-height');
      outputEl.style.removeProperty('height');
      outputEl.style.removeProperty('flex');
    }

    // 5. Restore scroll position
    window.scrollTo({
      top: _progressFullscreenSavedScroll,
      behavior: 'instant'
    });
  }
}
window.toggleResearchProgressFullscreen = toggleResearchProgressFullscreen;


// ==============================================================
// InquireX Research Report Fullscreen Controller
// ==============================================================
let _reportFullscreenSavedScroll = 0;
let _lastReportFullscreenToggle = 0;

function toggleResearchReportFullscreen(e, forceState) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  // Debounce guard to prevent double-firing from bubbling/nested events
  const now = Date.now();
  if (now - _lastReportFullscreenToggle < 200) {
    return;
  }
  _lastReportFullscreenToggle = now;

  const container = document.getElementById('mainReportContainer') || document.querySelector('.report-container');
  if (!container) return;

  const isCurrentlyFullscreen = container.classList.contains('report-card-fullscreen');
  const shouldBeFullscreen = typeof forceState === 'boolean' ? forceState : !isCurrentlyFullscreen;

  const btn = document.getElementById('expandReportBtn') || container.querySelector('.btn-expand');
  const icon = btn ? btn.querySelector('i') : null;

  if (shouldBeFullscreen) {
    // 1. Record current scroll position before entering fullscreen
    _reportFullscreenSavedScroll = window.scrollY || document.documentElement.scrollTop || 0;

    // 2. Lock background scrolling
    document.body.classList.add('report-fullscreen-active');
    document.documentElement.classList.add('report-fullscreen-active');
    document.body.style.overflow = 'hidden';

    // 3. Apply fullscreen state in-place (never detach from parent)
    container.classList.add('report-card-fullscreen');

    // 4. Update expand button icon and title
    if (btn) {
      btn.title = 'Exit Fullscreen (Esc)';
      btn.setAttribute('aria-label', 'Exit Fullscreen');
      btn.classList.add('is-fullscreen');
    }
    if (icon) {
      icon.className = 'fas fa-compress-alt';
    }
  } else {
    // 1. Remove fullscreen class
    container.classList.remove('report-card-fullscreen');

    // 2. Unlock background scrolling
    document.body.classList.remove('report-fullscreen-active');
    document.documentElement.classList.remove('report-fullscreen-active');
    document.body.style.overflow = '';

    // 3. Reset button icon and title
    if (btn) {
      btn.title = 'Expand Document View (Esc to exit)';
      btn.setAttribute('aria-label', 'Toggle Fullscreen Report');
      btn.classList.remove('is-fullscreen');
    }
    if (icon) {
      icon.className = 'fas fa-expand-alt';
    }

    // 4. Restore scroll position
    window.scrollTo({
      top: _reportFullscreenSavedScroll,
      behavior: 'instant'
    });
  }
}
window.toggleResearchReportFullscreen = toggleResearchReportFullscreen;
