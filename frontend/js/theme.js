/**
 * InquireX Theme Engine
 * Supports 'light', 'dark', and 'system' modes with zero-flash initialization,
 * OS preference tracking, and live cross-component event notifications.
 */

const STORAGE_KEY_MODE = 'inquirex_theme_mode';
const LEGACY_STORAGE_KEY = 'inquirex_theme';

const mediaQuery = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

export function getThemeMode() {
  try {
    const mode = localStorage.getItem(STORAGE_KEY_MODE);
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      return mode;
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === 'dark' || legacy === 'light') {
      return legacy;
    }
  } catch (e) {}
  return 'system';
}

export function resolveTheme(mode = getThemeMode()) {
  if (mode === 'dark' || mode === 'light') return mode;
  return mediaQuery && mediaQuery.matches ? 'dark' : 'light';
}

export function applyThemeMode(mode = getThemeMode(), persist = true) {
  const validMode = (mode === 'light' || mode === 'dark' || mode === 'system') ? mode : 'system';
  const resolved = resolveTheme(validMode);

  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.setAttribute('data-theme-mode', validMode);
  if (document.body) {
    document.body.setAttribute('data-theme', resolved);
  }

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY_MODE, validMode);
      localStorage.setItem(LEGACY_STORAGE_KEY, resolved);
    } catch (e) {}
  }

  syncThemeControls(validMode, resolved);

  window.dispatchEvent(
    new CustomEvent('inquirex:themechange', {
      detail: { mode: validMode, resolved }
    })
  );

  return { mode: validMode, resolved };
}

export function cycleThemeMode() {
  const current = getThemeMode();
  const order = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  return applyThemeMode(next, true);
}

export function syncThemeControls(mode = getThemeMode(), resolved = resolveTheme(mode)) {
  const topIcon = document.getElementById('themeToggleIcon');
  const topLabel = document.getElementById('themeToggleText');

  if (topIcon) {
    if (mode === 'system') {
      topIcon.className = 'fa-solid fa-desktop';
    } else if (resolved === 'dark') {
      topIcon.className = 'fa-solid fa-moon';
    } else {
      topIcon.className = 'fa-solid fa-sun';
    }
  }

  if (topLabel) {
    topLabel.textContent =
      mode === 'system' ? 'System' : resolved === 'dark' ? 'Dark' : 'Light';
  }

  document.querySelectorAll('[data-theme-option]').forEach((el) => {
    const opt = el.getAttribute('data-theme-option');
    el.classList.toggle('active', opt === mode);
    el.setAttribute('aria-pressed', String(opt === mode));
  });
}

if (mediaQuery) {
  const onOsThemeChange = () => {
    if (getThemeMode() === 'system') {
      applyThemeMode('system', false);
    }
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onOsThemeChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(onOsThemeChange);
  }
}

window.InquireXTheme = {
  getMode: getThemeMode,
  resolve: resolveTheme,
  setMode: (mode) => applyThemeMode(mode, true),
  cycle: cycleThemeMode,
};
window.toggleTheme = () => {
  const resolved = resolveTheme();
  return applyThemeMode(resolved === 'dark' ? 'light' : 'dark', true);
};
