/**
 * InquireX Reusable UI Helpers, Sanitization, Modals & Lightbox
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripThinkTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

export function sanitizeHtml(html) {
  if (!html) return '';
  if (typeof window.DOMPurify !== 'undefined') {
    return window.DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
  }
  const tmp = document.createElement('div');
  tmp.textContent = html;
  return tmp.innerHTML;
}

let _converter = null;
export function markdownToHtml(md) {
  const clean = stripThinkTags(md);
  if (!clean) return '';
  if (typeof window.showdown === 'undefined') {
    return `<pre>${escapeHtml(clean)}</pre>`;
  }
  if (!_converter) {
    _converter = new window.showdown.Converter({
      ghCodeBlocks: true,
      tables: true,
      tasklists: true,
      smartIndentationFix: true,
      simpleLineBreaks: true,
      openLinksInNewWindow: true,
      parseImgDimensions: true,
      simplifiedAutoLink: true,
    });
    _converter.setOption('literalMidWordUnderscores', true);
  }
  return sanitizeHtml(_converter.makeHtml(clean));
}

export function formatRelativeTime(isoOrMs) {
  if (!isoOrMs) return 'Just now';
  const date = new Date(isoOrMs);
  if (Number.isNaN(date.getTime())) return 'Recent';
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function showToast(message, type = 'info', duration = 3200) {
  let region = document.getElementById('ixToastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'ixToastRegion';
    region.className = 'ix-toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }

  const icons = {
    success: 'fa-circle-check',
    warning: 'fa-triangle-exclamation',
    error: 'fa-circle-xmark',
    info: 'fa-circle-info',
  };

  const toast = document.createElement('div');
  toast.className = `ix-toast ix-toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span style="flex:1;">${escapeHtml(message)}</span>
  `;
  region.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 150ms ease, transform 150ms ease';
    setTimeout(() => toast.remove(), 180);
  }, duration);
}

export function openConfirmDialog({
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
}) {
  let backdrop = document.getElementById('ixConfirmBackdrop');
  if (backdrop) backdrop.remove();

  backdrop = document.createElement('div');
  backdrop.id = 'ixConfirmBackdrop';
  backdrop.className = 'ix-modal-backdrop open';
  backdrop.innerHTML = `
    <div class="ix-modal" style="max-width:440px;" role="dialog" aria-modal="true">
      <div class="ix-modal-header">
        <h3 class="ix-card-title">${escapeHtml(title)}</h3>
        <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-action="close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="ix-modal-body">
        <p style="color:var(--text-secondary); font-size:var(--text-sm); line-height:1.55;">
          ${escapeHtml(message)}
        </p>
      </div>
      <div class="ix-modal-footer">
        <button type="button" class="ix-btn ix-btn-secondary" data-action="close">${escapeHtml(cancelText)}</button>
        <button type="button" class="ix-btn ${danger ? 'ix-btn-danger' : 'ix-btn-primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-action="close"]')) {
      close();
    } else if (e.target.closest('[data-action="confirm"]')) {
      close();
      onConfirm?.();
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
}

export function renderEmptyState({ icon = 'fa-inbox', title, desc, actionHtml = '' }) {
  return `
    <div class="ix-empty-state">
      <div class="ix-empty-icon"><i class="fa-solid ${escapeHtml(icon)}"></i></div>
      <div class="ix-empty-title">${escapeHtml(title)}</div>
      <div class="ix-empty-desc">${escapeHtml(desc)}</div>
      ${actionHtml ? `<div style="margin-top:4px;">${actionHtml}</div>` : ''}
    </div>
  `;
}

export function renderErrorState({ title = 'Something went wrong', desc = '', retryId = '' }) {
  return `
    <div class="ix-error-state" role="alert">
      <div class="ix-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div class="ix-empty-title">${escapeHtml(title)}</div>
      ${desc ? `<div class="ix-empty-desc">${escapeHtml(desc)}</div>` : ''}
      ${retryId ? `<button type="button" id="${escapeHtml(retryId)}" class="ix-btn ix-btn-secondary ix-btn-sm">Retry</button>` : ''}
    </div>
  `;
}

export function openImageLightbox(images, startIndex = 0) {
  if (!Array.isArray(images) || images.length === 0) return;
  let idx = Math.max(0, Math.min(images.length - 1, startIndex));

  const existing = document.getElementById('ixLightboxBackdrop');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'ixLightboxBackdrop';
  modal.className = 'ix-modal-backdrop open';
  modal.style.zIndex = '600';

  const renderSlide = () => {
    const item = images[idx];
    const url = typeof item === 'string' ? item : item.url;
    const caption = typeof item === 'string' ? '' : (item.title || item.alt || item.domain || '');
    modal.innerHTML = `
      <div class="ix-modal ix-modal-lg" role="dialog" aria-modal="true" style="max-width:920px;">
        <div class="ix-modal-header">
          <div class="ix-card-title">
            <i class="fa-regular fa-image"></i>
            <span>Figure ${idx + 1} of ${images.length}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="ix-btn ix-btn-secondary ix-btn-sm">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Source
            </a>
            <button type="button" class="ix-icon-btn ix-icon-btn-sm" data-lb="close" aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="ix-modal-body" style="display:flex; align-items:center; justify-content:center; background:var(--bg-secondary); min-height:360px;">
          <img src="${escapeHtml(url)}" referrerpolicy="no-referrer" alt="${escapeHtml(caption || 'Research Visual')}" style="max-width:100%; max-height:66vh; object-fit:contain; border-radius:var(--radius-md);" />
        </div>
        <div class="ix-modal-footer" style="justify-content:space-between;">
          <span class="ix-help ix-truncate" style="max-width:60%;">${escapeHtml(caption || url)}</span>
          <div style="display:flex; gap:8px;">
            <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-lb="prev" ${idx === 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-left"></i> Prev
            </button>
            <button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-lb="next" ${idx >= images.length - 1 ? 'disabled' : ''}>
              Next <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const close = () => {
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft' && idx > 0) { idx -= 1; renderSlide(); }
    if (e.key === 'ArrowRight' && idx < images.length - 1) { idx += 1; renderSlide(); }
  };

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-lb="close"]')) close();
    else if (e.target.closest('[data-lb="prev"]') && idx > 0) { idx -= 1; renderSlide(); }
    else if (e.target.closest('[data-lb="next"]') && idx < images.length - 1) { idx += 1; renderSlide(); }
  });

  renderSlide();
  document.addEventListener('keydown', onKey);
  document.body.appendChild(modal);
}
