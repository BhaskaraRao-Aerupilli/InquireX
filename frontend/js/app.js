/**
 * InquireX Main Application Shell, Router & Real-Time WebSocket Coordinator
 * Modular Vanilla ES6 Architecture without framework bloat.
 */

import { applyThemeMode, getThemeMode, cycleThemeMode, syncThemeControls } from './theme.js';
import {
  fetchCurrentUser,
  sendFollowUpChatHttp,
  ResearchSocketClient,
} from './api.js';
import { store } from './store.js';
import {
  escapeHtml,
  markdownToHtml,
  stripThinkTags,
  formatRelativeTime,
  showToast,
  renderErrorState,
} from './ui.js';

import { renderHomeView } from './views/home.js';
import { renderDashboardView } from './views/dashboard.js';
import { renderNewResearchView } from './views/research.js';
import { renderLiveResearchView, updateLiveResearchDOM } from './views/live.js';
import { renderReportViewerView } from './views/reportViewer.js';
import { renderTeamView } from './views/team.js';
import { renderCompanionView } from './views/companion.js';
import { FloatingCompanionWidget } from './companion/floatingCompanion.js';
import {
  renderMyResearchView,
  renderHistoryView,
  renderKnowledgeGraphView,
  renderFactVerificationView,
  renderDocumentsView,
  renderPresentationsView,
  renderMonitorView,
  renderSettingsView,
} from './views/modules.js';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { id: 'home', title: 'Home', icon: 'fa-house' },
      { id: 'dashboard', title: 'Dashboard', icon: 'fa-table-columns' },
      { id: 'new-research', title: 'New Research', icon: 'fa-plus' },
      { id: 'my-research', title: 'My Research', icon: 'fa-folder-open' },
      { id: 'history', title: 'Research History', icon: 'fa-clock-rotate-left' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'companion', title: 'AI Companion', icon: 'fa-microphone-lines' },
      { id: 'live-research', title: 'Live Research', icon: 'fa-wave-square', isLive: true },
      { id: 'report-viewer', title: 'Report Viewer', icon: 'fa-file-lines' },
      { id: 'team', title: 'AI Research Team', icon: 'fa-users-gear' },
      { id: 'knowledge-graph', title: 'Knowledge Graph', icon: 'fa-diagram-project' },
      { id: 'fact-verification', title: 'Fact Verification', icon: 'fa-shield-halved' },
      { id: 'documents', title: 'Document Intelligence', icon: 'fa-file-import' },
      { id: 'presentations', title: 'Presentations', icon: 'fa-display' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'monitor', title: 'Research Monitor', icon: 'fa-heart-pulse' },
      { id: 'settings', title: 'Settings', icon: 'fa-gear' },
    ],
  },
];

const ROUTE_RENDERERS = {
  home: renderHomeView,
  dashboard: renderDashboardView,
  companion: renderCompanionView,
  'new-research': renderNewResearchView,
  'live-research': renderLiveResearchView,
  'report-viewer': renderReportViewerView,
  'my-research': renderMyResearchView,
  history: renderHistoryView,
  team: renderTeamView,
  'knowledge-graph': renderKnowledgeGraphView,
  'fact-verification': renderFactVerificationView,
  documents: renderDocumentsView,
  presentations: renderPresentationsView,
  monitor: renderMonitorView,
  settings: renderSettingsView,
};

const ALL_ROUTE_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function getRouteMeta(routeId) {
  return ALL_ROUTE_ITEMS.find((item) => item.id === routeId) || ALL_ROUTE_ITEMS[0];
}

function getInitials(name, email) {
  const src = (name || email || 'IR').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function formatClockTime() {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

function parseUrlsFromText(str) {
  const urls = [];
  const regex = /https?:\/\/[^\s"'<>)\]]+/gi;
  let m;
  while ((m = regex.exec(str || '')) !== null) {
    urls.push(m[0].replace(/[.,;)]+$/, ''));
  }
  return urls;
}

class InquireXApp {
  constructor() {
    this.root = document.getElementById('app');
    this.currentRoute = 'home';
    this.cleanupCurrentView = null;
    this.liveRenderTimer = null;
    this.tooltipEl = null;

    this.wsClient = new ResearchSocketClient({
      onStats: (stats) => {
        store.updateWsStats(stats);
        this.syncTopbarWsPill(stats);
        if (this.currentRoute === 'monitor') {
          this.renderCurrentView();
        }
      },
      onOpen: () => {
        const s = store.state.liveSession;
        if (s.status === 'connecting' || s.status === 'reconnecting') {
          store.updateLiveSession({
            status: 'running',
            wsNotice: '',
          });
        }
      },
      onMessage: (msg) => this.handleWsMessage(msg),
      onReconnecting: (attempt, maxAttempts, delayMs) => {
        store.updateLiveSession({
          status: 'reconnecting',
          wsNotice: `WebSocket disconnected. Reconnecting (attempt ${attempt}/${maxAttempts}) in ${Math.round(
            delayMs / 1000
          )}s...`,
        });
        this.scheduleLiveViewRefresh();
      },
      onError: (errMsg) => {
        const s = store.state.liveSession;
        if (s.status === 'running' || s.status === 'connecting') {
          store.updateLiveSession({
            wsNotice: errMsg || 'WebSocket connection error occurred.',
          });
          this.scheduleLiveViewRefresh();
        }
      },
      onClose: (event, wasActiveTask) => {
        const s = store.state.liveSession;
        if (wasActiveTask && s.status !== 'completed' && s.status !== 'stopped') {
          store.updateLiveSession({
            status: 'error',
            errorMessage: `Connection closed (${event?.code || 1006}) before research completion.`,
            endedAt: Date.now(),
          });
          showToast('Research WebSocket connection closed unexpectedly.', 'error');
          this.scheduleLiveViewRefresh();
        }
      },
    });
  }

  async init() {
    applyThemeMode(getThemeMode(), false);

    if (!this.root) return;
    this.renderLoadingShell();

    try {
      const auth = await fetchCurrentUser();
      if (auth.unauthenticated) {
        window.location.href = '/login';
        return;
      }
      store.setUser(auth.user);
    } catch (err) {
      this.root.innerHTML = `
        <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--bg-secondary);">
          <div style="max-width:460px; width:100%;">
            ${renderErrorState({
              title: 'Unable to reach InquireX backend',
              desc: err.message || 'Check that FastAPI is running on port 8000 and reload.',
              retryId: 'ixBootRetryBtn',
            })}
          </div>
        </div>
      `;
      document.getElementById('ixBootRetryBtn')?.addEventListener('click', () => this.init());
      return;
    }

    await Promise.all([store.loadReports(), store.loadFiles()]);

    const hashRoute = window.location.hash.replace(/^#\/?/, '').trim();
    if (ROUTE_RENDERERS[hashRoute]) {
      this.currentRoute = hashRoute;
    }

    const bootOverlay = document.getElementById('ixBootOverlay');
    if (bootOverlay) {
      document.body.appendChild(bootOverlay);
    }
    this.mountShell();
    this.syncShellUserAndBadges();
    this.renderCurrentView();

    if (bootOverlay) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (this.currentRoute === 'home') {
            this.renderCurrentView();
          }
          bootOverlay.classList.add('fade-out');
          setTimeout(() => bootOverlay.remove(), 400);
        }, 280);
      });
    }

    window.addEventListener('hashchange', () => {
      const r = window.location.hash.replace(/^#\/?/, '').trim();
      if (ROUTE_RENDERERS[r] && r !== this.currentRoute) {
        this.navigate(r, false);
      }
    });

    store.subscribe((_state, reason) => {
      if (reason === 'liveSession') {
        const liveDot = document.getElementById('ixSidebarLiveDot');
        const ls = store.state.liveSession;
        const running =
          ls?.status === 'running' ||
          ls?.status === 'connecting' ||
          ls?.status === 'reconnecting';
        liveDot?.classList.toggle('ix-hidden', !running);
        return;
      }
      if (['reports', 'files', 'notifications', 'favorites'].includes(reason)) {
        this.syncShellUserAndBadges();
        if (
          reason === 'reports' &&
          (this.currentRoute === 'home' || this.currentRoute === 'report-viewer')
        ) {
          this.renderCurrentView();
        }
      }
    });
  }

  renderLoadingShell() {
    this.root.innerHTML = `
      <div class="ix-boot-screen" id="ixBootOverlay">
        <div class="quantum-agent-orb" style="pointer-events:none;">
          <span class="orb-sonar-ring"></span>
          <span class="orb-pulse-glow"></span>
          <span class="orb-outer-ring"></span>
          <span class="orb-gyro-ring"></span>
          <span class="orb-gyro-ring-alt"></span>
          <span class="orb-core">
            <i class="fa-solid fa-atom"></i>
          </span>
          <span class="orb-particles" aria-hidden="true">
            <span class="p-dot dot-1"></span>
            <span class="p-dot dot-2"></span>
            <span class="p-dot dot-3"></span>
            <span class="p-dot dot-4"></span>
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
          <span style="font-family:var(--font-display); font-size:20px; font-weight:700; letter-spacing:-0.02em; color:var(--text-primary);">
            Inquire<span style="color:var(--accent-primary);">X</span>
          </span>
        </div>
        <span style="font-size:var(--text-xs); letter-spacing:0.06em; text-transform:uppercase; color:var(--text-secondary);">
          Initializing Autonomous Research Engine...
        </span>
      </div>
    `;
  }

  mountShell() {
    const collapsed = Boolean(store.state.preferences?.sidebarCollapsed);

    this.root.innerHTML = `
      <div class="ix-app-shell ${collapsed ? 'sidebar-collapsed' : ''}" id="ixAppShell">
        <div class="ix-sidebar-backdrop" id="ixSidebarBackdrop"></div>

        <!-- Left Navigation Sidebar -->
        <aside class="ix-sidebar" id="ixSidebar" aria-label="Primary Navigation">
          <div class="ix-sidebar-header">
            <button type="button" class="ix-brand-link" data-nav="home" title="InquireX Home">
              <span class="ix-brand-mark" aria-hidden="true">
                <svg class="inquirex-logo-svg" width="24" height="24" viewBox="0 0 32 32" fill="none">
                  <defs>
                    <linearGradient id="ixp1Side" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stop-color="#38bdf8" />
                      <stop offset="50%" stop-color="#6366f1" />
                      <stop offset="100%" stop-color="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="ixp2Side" x1="30" y1="2" x2="2" y2="30" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stop-color="#818cf8" />
                      <stop offset="100%" stop-color="#4f46e5" />
                    </linearGradient>
                  </defs>
                  <circle cx="16" cy="16" r="13.5" stroke="url(#ixp1Side)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="28 10 12 10" class="ix-gyro-ring" />
                  <path d="M9.5 9.5L22.5 22.5" stroke="url(#ixp1Side)" stroke-width="2.75" stroke-linecap="round" />
                  <path d="M22.5 9.5L9.5 22.5" stroke="url(#ixp2Side)" stroke-width="2.75" stroke-linecap="round" />
                  <circle cx="16" cy="16" r="3.4" fill="var(--bg-card)" stroke="url(#ixp1Side)" stroke-width="1.5" />
                  <circle cx="16" cy="16" r="1.5" fill="var(--accent-primary)" class="ix-focal-core" />
                </svg>
              </span>
              <span class="ix-brand-wordmark">Inquire<span>X</span></span>
            </button>
            <button
              type="button"
              class="ix-sidebar-collapse-btn"
              id="ixSidebarCollapseBtn"
              aria-label="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
              title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
            >
              <i class="fa-solid ${collapsed ? 'fa-angles-right' : 'fa-angles-left'}"></i>
            </button>
          </div>

          <nav class="ix-sidebar-nav" id="ixSidebarNav">
            ${NAV_GROUPS.map(
              (group, gi) => `
              ${gi > 0 ? '<div class="ix-nav-divider"></div>' : ''}
              <div class="ix-nav-group-label">${escapeHtml(group.label)}</div>
              ${group.items
                .map(
                  (item) => `
                  <button
                    type="button"
                    class="ix-nav-item ${item.id === this.currentRoute ? 'active' : ''}"
                    data-nav="${escapeHtml(item.id)}"
                    data-tooltip="${escapeHtml(item.title)}"
                    aria-label="${escapeHtml(item.title)}"
                  >
                    <i class="fa-solid ${escapeHtml(item.icon)}"></i>
                    <span class="ix-nav-label">${escapeHtml(item.title)}</span>
                    ${
                      item.isLive
                        ? '<span class="ix-nav-live-dot ix-hidden" id="ixSidebarLiveDot" title="Research Running"></span>'
                        : ''
                    }
                    ${
                      item.id === 'history'
                        ? '<span class="ix-nav-badge" id="ixSidebarHistoryCount">0</span>'
                        : item.id === 'documents'
                        ? '<span class="ix-nav-badge" id="ixSidebarDocsCount">0</span>'
                        : ''
                    }
                  </button>`
                )
                .join('')}
            `
            ).join('')}
          </nav>

          <div class="ix-sidebar-footer">
            <button type="button" class="ix-user-chip" data-nav="settings" data-tooltip="Account & Settings">
              <span class="ix-user-avatar" id="ixSidebarAvatar">IR</span>
              <span class="ix-user-meta">
                <span class="ix-user-name" id="ixSidebarUserName">Researcher</span>
                <span class="ix-user-email" id="ixSidebarUserEmail">workspace</span>
              </span>
            </button>
          </div>
        </aside>

        <!-- Main Workspace Column -->
        <div class="ix-main-frame">
          <header class="ix-topbar">
            <div class="ix-topbar-left">
              <button
                type="button"
                class="ix-icon-btn ix-mobile-menu-btn"
                id="ixMobileMenuBtn"
                aria-label="Open navigation drawer"
              >
                <i class="fa-solid fa-bars"></i>
              </button>
              <nav class="ix-breadcrumbs" id="ixBreadcrumbs" aria-label="Breadcrumb">
                <button type="button" class="ix-crumb-btn" data-nav="home">InquireX</button>
                <span aria-hidden="true">/</span>
                <span class="ix-crumb-current" id="ixBreadcrumbCurrent">${escapeHtml(getRouteMeta(this.currentRoute).title)}</span>
              </nav>
            </div>

            <div class="ix-topbar-center">
              <div class="ix-search-wrap">
                <i class="fa-solid fa-magnifying-glass ix-search-icon"></i>
                <input
                  type="search"
                  id="ixGlobalSearchInput"
                  class="ix-global-search-input"
                  placeholder="Search reports or jump to module..."
                  autocomplete="off"
                  aria-label="Global search"
                />
                <span class="ix-kbd-shortcut">Ctrl K</span>
              </div>
              <div class="ix-global-search-results" id="ixGlobalSearchResults" role="listbox"></div>
            </div>

            <div class="ix-topbar-right">
              <button
                type="button"
                class="ix-ws-status-pill"
                id="ixTopWsPill"
                data-nav="monitor"
                title="View WebSocket & Backend Telemetry"
              >
                <span class="ix-ws-dot" id="ixTopWsDot"></span>
                <span class="ix-ws-status-text" id="ixTopWsText">Ready</span>
              </button>

              <button
                type="button"
                class="ix-btn ix-btn-secondary ix-btn-sm"
                id="ixTopThemeBtn"
                title="Switch theme (Light / Dark / System)"
              >
                <i class="fa-solid fa-desktop" id="themeToggleIcon"></i>
                <span id="themeToggleText" class="ix-ws-status-text">System</span>
              </button>

              <div class="ix-dropdown" id="ixNotifWrap">
                <button
                  type="button"
                  class="ix-icon-btn ix-notif-btn"
                  id="ixTopNotifBtn"
                  aria-label="Notifications"
                  aria-expanded="false"
                >
                  <i class="fa-regular fa-bell"></i>
                  <span class="ix-notif-count ix-hidden" id="ixNotifCount">0</span>
                </button>
                <div class="ix-dropdown-menu" id="ixNotifMenu" style="width:310px;">
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px;">
                    <strong style="font-size:var(--text-xs); text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary);">Notifications</strong>
                    <button type="button" id="ixMarkNotifReadBtn" class="ix-btn ix-btn-ghost ix-btn-sm" style="height:24px;">Mark read</button>
                  </div>
                  <div class="ix-dropdown-sep"></div>
                  <div id="ixNotifList" style="max-height:260px; overflow-y:auto;"></div>
                </div>
              </div>

              <div class="ix-dropdown" id="ixProfileWrap">
                <button
                  type="button"
                  class="ix-icon-btn"
                  id="ixTopProfileBtn"
                  aria-label="User Profile Menu"
                  aria-expanded="false"
                  style="width:auto; padding:0 8px; gap:6px;"
                >
                  <span class="ix-user-avatar" id="ixTopAvatar" style="width:24px; height:24px; font-size:10px;">IR</span>
                  <i class="fa-solid fa-chevron-down" style="font-size:10px;"></i>
                </button>
                <div class="ix-dropdown-menu" id="ixProfileMenu" style="min-width:220px;">
                  <div style="padding:8px 10px;">
                    <div id="ixMenuUserName" style="font-weight:600; font-size:var(--text-sm); color:var(--text-primary);">Researcher</div>
                    <div id="ixMenuUserEmail" class="ix-truncate" style="font-size:var(--text-xs); color:var(--text-secondary);">workspace</div>
                  </div>
                  <div class="ix-dropdown-sep"></div>
                  <button type="button" class="ix-dropdown-item" data-nav="my-research">
                    <i class="fa-regular fa-folder-open" style="margin-top:2px;"></i>
                    <span>My Research</span>
                  </button>
                  <button type="button" class="ix-dropdown-item" data-nav="settings">
                    <i class="fa-solid fa-gear" style="margin-top:2px;"></i>
                    <span>Settings</span>
                  </button>
                  <div class="ix-dropdown-sep"></div>
                  <a href="/auth/logout" class="ix-dropdown-item" style="color:var(--status-error);">
                    <i class="fa-solid fa-right-from-bracket" style="margin-top:2px;"></i>
                    <span>Sign Out</span>
                  </a>
                </div>
              </div>
            </div>
          </header>

          <main class="ix-main-content" id="ixMainContent" tabindex="-1"></main>
        </div>
      </div>

      <div class="ix-sidebar-tooltip" id="ixSidebarTooltip" role="tooltip"></div>
    `;

    this.tooltipEl = document.getElementById('ixSidebarTooltip');
    syncThemeControls(getThemeMode());
    this.bindShellEvents();

    if (!this.floatingCompanion) {
      this.floatingCompanion = new FloatingCompanionWidget(() => this.navigate('companion'));
      this.floatingCompanion.mount();
    }
    this.floatingCompanion.syncRoute(this.currentRoute);
  }

  bindShellEvents() {
    const shell = document.getElementById('ixAppShell');
    const collapseBtn = document.getElementById('ixSidebarCollapseBtn');
    const mobileBtn = document.getElementById('ixMobileMenuBtn');
    const backdrop = document.getElementById('ixSidebarBackdrop');

    collapseBtn?.addEventListener('click', () => {
      const next = !shell.classList.contains('sidebar-collapsed');
      shell.classList.toggle('sidebar-collapsed', next);
      collapseBtn.innerHTML = `<i class="fa-solid ${next ? 'fa-angles-right' : 'fa-angles-left'}"></i>`;
      collapseBtn.setAttribute('aria-label', next ? 'Expand sidebar' : 'Collapse sidebar');
      collapseBtn.setAttribute('title', next ? 'Expand sidebar' : 'Collapse sidebar');
      store.updatePreferences({ sidebarCollapsed: next });
      this.hideTooltip();
    });

    const closeMobileDrawer = () => shell?.classList.remove('mobile-sidebar-open');
    mobileBtn?.addEventListener('click', () => shell?.classList.toggle('mobile-sidebar-open'));
    backdrop?.addEventListener('click', closeMobileDrawer);

    // Nav links inside sidebar, breadcrumbs, dropdowns
    this.root.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => {
        const target = el.getAttribute('data-nav');
        if (target) {
          closeMobileDrawer();
          this.closeTopMenus();
          this.navigate(target);
        }
      });
    });

    // Collapsed Sidebar Floating Tooltips
    this.root.querySelectorAll('.ix-sidebar [data-tooltip]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        if (!shell?.classList.contains('sidebar-collapsed') || window.innerWidth <= 960) return;
        const label = el.getAttribute('data-tooltip');
        if (!label || !this.tooltipEl) return;
        const rect = el.getBoundingClientRect();
        this.tooltipEl.textContent = label;
        this.tooltipEl.style.left = `${rect.right + 10}px`;
        this.tooltipEl.style.top = `${rect.top + rect.height / 2 - 13}px`;
        this.tooltipEl.classList.add('visible');
      });
      el.addEventListener('mouseleave', () => this.hideTooltip());
    });

    // Top Theme Switcher
    document.getElementById('ixTopThemeBtn')?.addEventListener('click', () => {
      cycleThemeMode();
    });

    // Notifications & Profile Dropdowns
    const notifBtn = document.getElementById('ixTopNotifBtn');
    const notifMenu = document.getElementById('ixNotifMenu');
    const profileBtn = document.getElementById('ixTopProfileBtn');
    const profileMenu = document.getElementById('ixProfileMenu');

    notifBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu?.classList.remove('open');
      profileBtn?.setAttribute('aria-expanded', 'false');
      const open = notifMenu?.classList.toggle('open');
      notifBtn.setAttribute('aria-expanded', String(Boolean(open)));
    });

    profileBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu?.classList.remove('open');
      notifBtn?.setAttribute('aria-expanded', 'false');
      const open = profileMenu?.classList.toggle('open');
      profileBtn.setAttribute('aria-expanded', String(Boolean(open)));
    });

    document.getElementById('ixMarkNotifReadBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      store.markAllNotificationsRead();
    });

    // Global Search (reports + routes + Ctrl/Cmd+K)
    const searchInput = document.getElementById('ixGlobalSearchInput');
    const searchResults = document.getElementById('ixGlobalSearchResults');

    const updateSearchPopover = (term) => {
      if (!searchResults) return;
      const q = (term || '').trim().toLowerCase();
      if (!q) {
        searchResults.classList.remove('open');
        searchResults.innerHTML = '';
        return;
      }

      const routeHits = ALL_ROUTE_ITEMS.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 4);
      const reportHits = (store.state.reports || [])
        .filter((r) => (r.prompt || '').toLowerCase().includes(q))
        .slice(0, 6);

      if (routeHits.length === 0 && reportHits.length === 0) {
        searchResults.innerHTML = `<div style="padding:10px 12px; font-size:var(--text-xs); color:var(--text-secondary);">No matching reports or workspace modules.</div>`;
        searchResults.classList.add('open');
        return;
      }

      searchResults.innerHTML = `
        ${routeHits
          .map(
            (r) => `
            <button type="button" class="ix-dropdown-item" data-search-nav="${escapeHtml(r.id)}">
              <i class="fa-solid ${escapeHtml(r.icon)}" style="margin-top:2px; color:var(--accent-primary);"></i>
              <div class="ix-dropdown-item-meta">
                <span class="ix-dropdown-item-title">${escapeHtml(r.title)}</span>
                <span class="ix-dropdown-item-desc">Workspace Page</span>
              </div>
            </button>`
          )
          .join('')}
        ${reportHits
          .map(
            (rep) => `
            <button type="button" class="ix-dropdown-item" data-search-report="${escapeHtml(rep.id)}">
              <i class="fa-regular fa-file-lines" style="margin-top:2px; color:var(--text-secondary);"></i>
              <div class="ix-dropdown-item-meta">
                <span class="ix-dropdown-item-title ix-truncate">${escapeHtml(rep.prompt || 'Untitled')}</span>
                <span class="ix-dropdown-item-desc">${escapeHtml(formatRelativeTime(rep.timestamp))}</span>
              </div>
            </button>`
          )
          .join('')}
      `;

      searchResults.classList.add('open');
      searchResults.querySelectorAll('[data-search-nav]').forEach((b) =>
        b.addEventListener('click', () => {
          searchResults.classList.remove('open');
          searchInput.value = '';
          this.navigate(b.getAttribute('data-search-nav'));
        })
      );
      searchResults.querySelectorAll('[data-search-report]').forEach((b) =>
        b.addEventListener('click', () => {
          searchResults.classList.remove('open');
          searchInput.value = '';
          store.setActiveReportId(b.getAttribute('data-search-report'));
          this.navigate('report-viewer');
        })
      );
    };

    searchInput?.addEventListener('input', (e) => updateSearchPopover(e.target.value));
    searchInput?.addEventListener('focus', (e) => {
      if (e.target.value.trim()) updateSearchPopover(e.target.value);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#ixNotifWrap') && !e.target.closest('#ixProfileWrap')) {
        this.closeTopMenus();
      }
      if (!e.target.closest('.ix-topbar-center')) {
        searchResults?.classList.remove('open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput?.focus();
      } else if (e.key === 'Escape') {
        this.closeTopMenus();
        searchResults?.classList.remove('open');
        closeMobileDrawer();
      }
    });
  }

  hideTooltip() {
    this.tooltipEl?.classList.remove('visible');
  }

  closeTopMenus() {
    document.getElementById('ixNotifMenu')?.classList.remove('open');
    document.getElementById('ixNotifBtn')?.setAttribute('aria-expanded', 'false');
    document.getElementById('ixProfileMenu')?.classList.remove('open');
    document.getElementById('ixTopProfileBtn')?.setAttribute('aria-expanded', 'false');
  }

  syncTopbarWsPill(stats) {
    const dot = document.getElementById('ixTopWsDot');
    const txt = document.getElementById('ixTopWsText');
    if (!dot || !txt) return;
    dot.className = 'ix-ws-dot';
    if (stats.state === 'connected') {
      dot.classList.add('connected');
      txt.textContent = 'WS Connected';
    } else if (stats.state === 'connecting' || stats.state === 'reconnecting') {
      dot.classList.add('connecting');
      txt.textContent = stats.state === 'reconnecting' ? 'Reconnecting' : 'Connecting';
    } else if (stats.state === 'error') {
      dot.classList.add('error');
      txt.textContent = 'WS Error';
    } else {
      txt.textContent = 'WS Ready';
    }
  }

  syncShellUserAndBadges() {
    const { user, reports, files, notifications, liveSession } = store.state;
    const displayName = user?.name || user?.email?.split('@')[0] || 'Researcher';
    const displayEmail = user?.email || 'Authenticated Session';
    const initials = getInitials(user?.name, user?.email);

    ['ixSidebarAvatar', 'ixTopAvatar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = initials;
    });
    const sbName = document.getElementById('ixSidebarUserName');
    const sbEmail = document.getElementById('ixSidebarUserEmail');
    const mName = document.getElementById('ixMenuUserName');
    const mEmail = document.getElementById('ixMenuUserEmail');
    if (sbName) sbName.textContent = displayName;
    if (sbEmail) sbEmail.textContent = displayEmail;
    if (mName) mName.textContent = displayName;
    if (mEmail) mEmail.textContent = displayEmail;

    const histBadge = document.getElementById('ixSidebarHistoryCount');
    if (histBadge) histBadge.textContent = String((reports || []).length);
    const docsBadge = document.getElementById('ixSidebarDocsCount');
    if (docsBadge) docsBadge.textContent = String((files || []).length);

    const liveDot = document.getElementById('ixSidebarLiveDot');
    const running =
      liveSession?.status === 'running' ||
      liveSession?.status === 'connecting' ||
      liveSession?.status === 'reconnecting';
    liveDot?.classList.toggle('ix-hidden', !running);

    const unreadCount = (notifications || []).filter((n) => !n.read).length;
    const notifBadge = document.getElementById('ixNotifCount');
    if (notifBadge) {
      notifBadge.textContent = String(unreadCount);
      notifBadge.classList.toggle('ix-hidden', unreadCount === 0);
    }

    const notifList = document.getElementById('ixNotifList');
    if (notifList) {
      notifList.innerHTML =
        notifications.length === 0
          ? `<div style="padding:12px; font-size:var(--text-xs); color:var(--text-secondary);">No new workspace notifications.</div>`
          : notifications
              .slice(0, 10)
              .map(
                (n) => `
                <div style="padding:8px 10px; border-radius:var(--radius-md); background:${
                  n.read ? 'transparent' : 'var(--bg-secondary)'
                }; margin-bottom:2px;">
                  <div style="font-size:var(--text-xs); font-weight:600; color:var(--text-primary);">${escapeHtml(n.title)}</div>
                  <div style="font-size:11px; color:var(--text-secondary);">${escapeHtml(n.message)}</div>
                </div>`
              )
              .join('');
    }
  }

  navigate(routeId, updateHash = true) {
    const resolved = ROUTE_RENDERERS[routeId] ? routeId : 'dashboard';
    this.currentRoute = resolved;
    if (updateHash && window.location.hash !== `#${resolved}`) {
      window.location.hash = `#${resolved}`;
    }

    // Sync active nav item & breadcrumb
    this.root.querySelectorAll('.ix-sidebar .ix-nav-item[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-nav') === resolved);
    });

    const meta = getRouteMeta(resolved);
    const crumbEl = document.getElementById('ixBreadcrumbCurrent');
    if (crumbEl) {
      crumbEl.textContent = meta.title;
    }

    this.renderCurrentView();
    this.floatingCompanion?.syncRoute(resolved);
    const mainEl = document.getElementById('ixMainContent');
    if (mainEl) mainEl.scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  renderCurrentView() {
    const mainEl = document.getElementById('ixMainContent');
    if (!mainEl) return;

    if (typeof this.cleanupCurrentView === 'function') {
      try {
        this.cleanupCurrentView();
      } catch {}
      this.cleanupCurrentView = null;
    }

    const renderFn = ROUTE_RENDERERS[this.currentRoute] || renderDashboardView;
    const maybeCleanup = renderFn(mainEl, {
      navigate: (r) => this.navigate(r),
      startResearch: (payload) => this.startResearch(payload),
      stopResearch: () => this.stopResearch(),
      sendFollowUpChat: (rep, q, onDone) => this.sendFollowUpChat(rep, q, onDone),
      wsClient: this.wsClient,
    });
    if (typeof maybeCleanup === 'function') {
      this.cleanupCurrentView = maybeCleanup;
    }
  }

  startResearch(payload) {
    store.resetLiveSession(payload.task, payload);
    store.addNotification('Research Started', (payload.task || '').slice(0, 80), 'info');
    this.navigate('live-research');
    this.wsClient.connect(payload);
  }

  stopResearch() {
    this.wsClient.stopResearch();
    if (this.liveRenderTimer) {
      clearTimeout(this.liveRenderTimer);
      this.liveRenderTimer = null;
    }
    store.updateLiveSession({
      status: 'stopped',
      endedAt: Date.now(),
      stageLabel: 'Stopped by user',
      wsNotice: 'Execution cancelled cleanly.',
    });
    showToast('Research stopped.', 'warning');
    if (this.currentRoute === 'live-research') {
      const mainEl = document.getElementById('ixMainContent');
      if (mainEl) {
        updateLiveResearchDOM(mainEl, {
          navigate: (r) => this.navigate(r),
          startResearch: (payload) => this.startResearch(payload),
          stopResearch: () => this.stopResearch(),
          sendFollowUpChat: (rep, q, onDone) => this.sendFollowUpChat(rep, q, onDone),
          wsClient: this.wsClient,
        });
      }
    }
  }

  scheduleLiveViewRefresh() {
    if (this.currentRoute !== 'live-research' || this.liveRenderTimer) return;
    this.liveRenderTimer = setTimeout(() => {
      this.liveRenderTimer = null;
      if (this.currentRoute === 'live-research') {
        const mainEl = document.getElementById('ixMainContent');
        if (mainEl) {
          updateLiveResearchDOM(mainEl, {
            navigate: (r) => this.navigate(r),
            startResearch: (payload) => this.startResearch(payload),
            stopResearch: () => this.stopResearch(),
            sendFollowUpChat: (rep, q, onDone) => this.sendFollowUpChat(rep, q, onDone),
            wsClient: this.wsClient,
          });
        }
      }
    }, 120);
  }

  async handleWsMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    const ls = store.state.liveSession;

    if (msg.type === 'logs') {
      const cleanOut = stripThinkTags(String(msg.output || ''));
      const contentType = String(msg.content || '').toLowerCase();
      const logEntry = {
        time: formatClockTime(),
        type: msg.content || 'log',
        text: cleanOut,
        output: cleanOut,
      };

      const patch = {
        status: 'running',
        logs: [...(ls.logs || []).slice(-300), logEntry],
      };

      if (contentType === 'agent_generated') {
        const agentMatch = cleanOut.match(/as\s+([A-Za-z0-9 &_-]+)/i);
        if (agentMatch) patch.activeAgentName = agentMatch[1].trim();
        patch.stage = Math.max(ls.stage || 1, 1);
        patch.stageLabel = `Assigned persona: ${patch.activeAgentName || cleanOut.slice(0, 50)}`;
      } else if (contentType === 'planning_research' || contentType === 'subqueries') {
        patch.stage = Math.max(ls.stage || 1, 2);
        patch.stageLabel = 'Decomposing & running search queries';
        if (Array.isArray(msg.metadata)) {
          const merged = new Set([...(ls.subqueries || []), ...msg.metadata.map(String)]);
          patch.subqueries = Array.from(merged);
        }
      } else if (
        contentType === 'scraped_urls' ||
        contentType === 'added_source_url' ||
        contentType === 'fetching_query_content' ||
        contentType === 'researching'
      ) {
        patch.stage = Math.max(ls.stage || 1, contentType === 'scraped_urls' ? 3 : 2);
        patch.stageLabel = contentType === 'scraped_urls' ? 'Filtering verified context' : 'Searching & scraping sources';
        const metaUrls = Array.isArray(msg.metadata) ? msg.metadata : [];
        const textUrls = parseUrlsFromText(cleanOut);
        const merged = new Set([...(ls.scrapedSources || []), ...metaUrls.map(String), ...textUrls]);
        patch.scrapedSources = Array.from(merged);
      } else if (contentType === 'research_step_finalized' || contentType === 'writing_report') {
        patch.stage = Math.max(ls.stage || 1, 4);
        patch.stageLabel = 'Synthesizing final report';
      }

      store.updateLiveSession(patch);
      this.scheduleLiveViewRefresh();
      return;
    }

    if (msg.type === 'images') {
      let parsedImgs = [];
      try {
        parsedImgs = typeof msg.output === 'string' ? JSON.parse(msg.output) : Array.isArray(msg.output) ? msg.output : [];
      } catch {}
      if (parsedImgs.length > 0) {
        const merged = Array.from(new Set([...(ls.images || []), ...parsedImgs]));
        store.updateLiveSession({ images: merged });
        this.scheduleLiveViewRefresh();
      }
      return;
    }

    if (msg.type === 'report') {
      const nextMd = `${ls.markdown || ''}${msg.output || ''}`;
      store.updateLiveSession({
        status: 'running',
        stage: Math.max(ls.stage || 1, 4),
        stageLabel: 'Streaming synthesized report...',
        markdown: nextMd,
      });
      this.scheduleLiveViewRefresh();
      return;
    }

    if (msg.type === 'path') {
      const links = msg.output && typeof msg.output === 'object' ? msg.output : {};
      const finalHtml = ls.markdown ? markdownToHtml(ls.markdown) : ls.html || '';
      store.updateLiveSession({
        status: 'completed',
        stage: 5,
        stageLabel: 'Completed & artifacts saved',
        html: finalHtml,
        downloadLinks: links,
        endedAt: Date.now(),
        wsNotice: '',
      });
      this.wsClient.markTaskFinished();

      const saved = await store.saveCompletedResearch(store.state.liveSession);
      store.addNotification('Report Completed', (saved?.prompt || ls.task || 'Ready to view').slice(0, 80), 'success');
      showToast('Research complete! Report saved to workspace.', 'success');
      if (this.currentRoute === 'live-research') {
        const mainEl = document.getElementById('ixMainContent');
        if (mainEl) {
          updateLiveResearchDOM(mainEl, {
            navigate: (r) => this.navigate(r),
            startResearch: (payload) => this.startResearch(payload),
            stopResearch: () => this.stopResearch(),
            sendFollowUpChat: (rep, q, onDone) => this.sendFollowUpChat(rep, q, onDone),
            wsClient: this.wsClient,
          });
        }
      }
      return;
    }

    if (msg.type === 'status') {
      const out = String(msg.output || '').toLowerCase();
      if (out === 'stopped' || out === 'cancelled') {
        this.wsClient.markTaskFinished();
        store.updateLiveSession({
          status: 'stopped',
          endedAt: Date.now(),
          stageLabel: 'Execution stopped',
        });
        this.renderCurrentView();
      } else if (out === 'error') {
        this.wsClient.markTaskFinished();
        store.updateLiveSession({
          status: 'error',
          endedAt: Date.now(),
          errorMessage: msg.detail || msg.message || 'Backend reported an execution error.',
        });
        this.renderCurrentView();
      }
    }
  }

  async sendFollowUpChat(report, question, onDone) {
    const contextMessages = [...(report.chatMessages || []).slice(-8), { role: 'user', content: question }];
    const reportText = report.reportMarkdown || report.reportHtml || '';
    const res = await sendFollowUpChatHttp(reportText, contextMessages);
    const replyContent = res?.response?.content || res?.content || '';
    const assistantMsg = replyContent
      ? {
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toISOString(),
          metadata: res?.response?.metadata || {},
        }
      : null;

    if (assistantMsg && report.id && report.id !== 'live_preview') {
      await store.appendReportChat(report.id, null, assistantMsg);
    }
    onDone?.(assistantMsg);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new InquireXApp();
  window.inquirexApp = app;
  app.init();
});
