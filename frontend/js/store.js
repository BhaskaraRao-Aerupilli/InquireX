/**
 * InquireX Application State & Persistence Store
 * Combines real backend /api/reports + per-user localStorage with zero fabricated stats.
 */

import {
  fetchBackendReports,
  upsertBackendReport,
  deleteBackendReport,
  fetchUploadedFiles,
} from './api.js';

const DEFAULT_PREFERENCES = {
  sidebarCollapsed: false,
  defaultReportType: 'research_report',
  defaultTone: 'Objective',
  defaultReportSource: 'web',
  defaultMaxSearchResults: 5,
};

function createEmptyLiveSession() {
  return {
    status: 'idle', // 'idle' | 'connecting' | 'running' | 'reconnecting' | 'completed' | 'stopped' | 'error'
    task: '',
    config: null,
    stage: 0, // 0..5 derived purely from backend log/path progression
    stageLabel: 'Idle',
    activeAgentName: '',
    subqueries: [],
    scrapedSources: [],
    images: [],
    logs: [],
    markdown: '',
    html: '',
    downloadLinks: {},
    startedAt: null,
    endedAt: null,
    errorMessage: '',
    wsNotice: '',
  };
}

class InquireXStore {
  constructor() {
    this.state = {
      user: null,
      reports: [],
      reportsLoaded: false,
      activeReportId: null,
      files: [],
      filesLoaded: false,
      favorites: [],
      notifications: [],
      preferences: { ...DEFAULT_PREFERENCES },
      liveSession: createEmptyLiveSession(),
      wsStats: {
        state: 'disconnected',
        readyStateText: 'CLOSED',
        connectedAt: null,
        lastActivityAt: null,
        attempts: 0,
        messagesReceived: 0,
        lastError: null,
      },
      draftConfig: {
        task: '',
        report_type: 'research_report',
        tone: 'Objective',
        report_source: 'web',
        max_search_results: 5,
        query_domains: '',
        source_urls: '',
        agent: 'Auto Agent',
        mcp_enabled: false,
        mcp_strategy: 'fast',
        mcp_config: '[]',
        showPlanPreview: false,
      },
    };
    this.listeners = new Set();
    this._loadPreferences();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(reason = 'update') {
    this.listeners.forEach((fn) => {
      try {
        fn(this.state, reason);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    });
  }

  _userSuffix() {
    const u = this.state.user;
    return u ? (u.id || u.email || 'default') : 'default';
  }

  _historyKey() {
    return `conversationHistory_${this._userSuffix()}`;
  }

  _favoritesKey() {
    return `inquirex_favorites_${this._userSuffix()}`;
  }

  _prefsKey() {
    return 'inquirex_preferences';
  }

  _reportHtmlKey(idOrTs) {
    return `reportHtml_${idOrTs}`;
  }

  _loadPreferences() {
    try {
      const raw = localStorage.getItem(this._prefsKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state.preferences = { ...DEFAULT_PREFERENCES, ...parsed };
        this.state.draftConfig.report_type = this.state.preferences.defaultReportType;
        this.state.draftConfig.tone = this.state.preferences.defaultTone;
        this.state.draftConfig.report_source = this.state.preferences.defaultReportSource;
        this.state.draftConfig.max_search_results = this.state.preferences.defaultMaxSearchResults;
      }
    } catch {}
  }

  updatePreferences(patch) {
    this.state.preferences = { ...this.state.preferences, ...patch };
    try {
      localStorage.setItem(this._prefsKey(), JSON.stringify(this.state.preferences));
    } catch {}
    this.notify('preferences');
  }

  updateDraftConfig(patch) {
    this.state.draftConfig = { ...this.state.draftConfig, ...patch };
    this.notify('draft');
  }

  setUser(user) {
    this.state.user = user;
    this._loadFavorites();
    this.notify('user');
  }

  _loadFavorites() {
    try {
      const raw = localStorage.getItem(this._favoritesKey());
      const arr = raw ? JSON.parse(raw) : [];
      this.state.favorites = Array.isArray(arr) ? arr : [];
    } catch {
      this.state.favorites = [];
    }
  }

  toggleFavorite(reportId) {
    const idx = this.state.favorites.indexOf(reportId);
    if (idx === -1) {
      this.state.favorites = [reportId, ...this.state.favorites];
    } else {
      this.state.favorites = this.state.favorites.filter((id) => id !== reportId);
    }
    try {
      localStorage.setItem(this._favoritesKey(), JSON.stringify(this.state.favorites));
    } catch {}
    this.notify('favorites');
    return this.state.favorites.includes(reportId);
  }

  isFavorite(reportId) {
    return this.state.favorites.includes(reportId);
  }

  addNotification(title, message, level = 'info') {
    const item = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      level,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.state.notifications = [item, ...this.state.notifications].slice(0, 20);
    this.notify('notifications');
  }

  markAllNotificationsRead() {
    this.state.notifications = this.state.notifications.map((n) => ({ ...n, read: true }));
    this.notify('notifications');
  }

  _readLocalHistory() {
    const keys = [this._historyKey(), 'conversationHistory_default', 'conversationHistory'];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((entry, idx) => {
            const id = entry.id || entry.timestamp || `local_${idx}`;
            let reportHtml = entry.reportHtml || '';
            if (!reportHtml && entry.reportKey) {
              try {
                reportHtml = localStorage.getItem(entry.reportKey) || '';
              } catch {}
            }
            return {
              id: String(id),
              prompt: entry.prompt || 'Untitled Research',
              reportHtml,
              reportMarkdown: entry.reportMarkdown || '',
              links: entry.links || {},
              images: Array.isArray(entry.images) ? entry.images : [],
              metrics: entry.metrics || {},
              subqueries: entry.subqueries || [],
              sources: entry.sources || [],
              logs: entry.logs || [],
              chatMessages: entry.chatMessages || [],
              config: entry.config || {},
              timestamp: entry.timestamp || new Date().toISOString(),
              sourceOrigin: 'local',
            };
          });
        }
      } catch {}
    }
    return [];
  }

  async loadReports() {
    const localItems = this._readLocalHistory();
    let backendItems = [];

    try {
      const apiReports = await fetchBackendReports();
      backendItems = apiReports.map((r) => {
        const ordered = Array.isArray(r.orderedData) ? r.orderedData : [];
        const metaEntry = ordered.find((x) => x && x.type === 'metadata') || {};
        return {
          id: String(r.id),
          prompt: r.question || metaEntry.prompt || 'Research Report',
          reportMarkdown: typeof r.answer === 'string' ? r.answer : '',
          reportHtml: metaEntry.reportHtml || '',
          links: metaEntry.links || {},
          images: metaEntry.images || [],
          metrics: metaEntry.metrics || {},
          subqueries: metaEntry.subqueries || [],
          sources: metaEntry.sources || [],
          logs: metaEntry.logs || [],
          chatMessages: Array.isArray(r.chatMessages) ? r.chatMessages : [],
          config: metaEntry.config || {},
          timestamp: r.timestamp
            ? new Date(typeof r.timestamp === 'number' ? r.timestamp : r.timestamp).toISOString()
            : new Date().toISOString(),
          sourceOrigin: 'backend',
        };
      });
    } catch (err) {
      console.warn('Could not load backend /api/reports:', err);
    }

    // Merge backend + local reports without duplication
    const mergedMap = new Map();
    [...backendItems, ...localItems].forEach((item) => {
      const existing = mergedMap.get(item.id);
      if (!existing) {
        mergedMap.set(item.id, item);
      } else {
        mergedMap.set(item.id, {
          ...existing,
          ...item,
          reportHtml: item.reportHtml || existing.reportHtml,
          reportMarkdown: item.reportMarkdown || existing.reportMarkdown,
          links: Object.keys(item.links || {}).length ? item.links : existing.links,
          images: (item.images || []).length ? item.images : existing.images,
          chatMessages: (item.chatMessages || []).length ? item.chatMessages : existing.chatMessages,
        });
      }
    });

    const sorted = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    this.state.reports = sorted;
    this.state.reportsLoaded = true;
    if (!this.state.activeReportId && sorted.length > 0) {
      this.state.activeReportId = sorted[0].id;
    }
    this.notify('reports');
    return sorted;
  }

  async saveCompletedResearch(sessionSnapshot) {
    const timestampIso = new Date().toISOString();
    const reportId = `res_${Date.now()}`;
    const elapsedSec =
      sessionSnapshot.startedAt && sessionSnapshot.endedAt
        ? Math.max(1, Math.round((sessionSnapshot.endedAt - sessionSnapshot.startedAt) / 1000))
        : 0;

    const record = {
      id: reportId,
      prompt: sessionSnapshot.task || 'Research Report',
      reportHtml: sessionSnapshot.html || '',
      reportMarkdown: sessionSnapshot.markdown || '',
      links: sessionSnapshot.downloadLinks || {},
      images: sessionSnapshot.images || [],
      subqueries: sessionSnapshot.subqueries || [],
      sources: sessionSnapshot.scrapedSources || [],
      logs: sessionSnapshot.logs || [],
      config: sessionSnapshot.config || {},
      chatMessages: [],
      metrics: {
        elapsedSec,
        scrapedCount: (sessionSnapshot.scrapedSources || []).length,
        subqueriesCount: (sessionSnapshot.subqueries || []).length,
        agentName: sessionSnapshot.activeAgentName || sessionSnapshot.config?.agent || 'Auto Agent',
      },
      timestamp: timestampIso,
    };

    this.state.reports = [record, ...this.state.reports];
    this.state.activeReportId = reportId;
    this._persistLocalReports();

    // Persist to existing FastAPI ReportStore
    try {
      await upsertBackendReport({
        id: reportId,
        question: record.prompt,
        answer: record.reportMarkdown || record.reportHtml,
        orderedData: [
          {
            type: 'metadata',
            links: record.links,
            images: record.images,
            metrics: record.metrics,
            subqueries: record.subqueries,
            sources: record.sources,
            logs: record.logs.slice(-60),
            config: record.config,
            reportHtml: record.reportHtml,
          },
        ],
        chatMessages: [],
        timestamp: Date.now(),
      });
    } catch (err) {
      console.warn('Could not persist report to /api/reports:', err);
    }

    this.notify('reports');
    return record;
  }

  async appendReportChat(reportId, userMsg, assistantMsg) {
    this.state.reports = this.state.reports.map((r) => {
      if (r.id !== reportId) return r;
      const updatedMsgs = [...(r.chatMessages || [])];
      if (userMsg) updatedMsgs.push(userMsg);
      if (assistantMsg) updatedMsgs.push(assistantMsg);
      return { ...r, chatMessages: updatedMsgs };
    });
    this._persistLocalReports();
    const target = this.getReportById(reportId);
    if (target) {
      try {
        await upsertBackendReport({
          id: target.id,
          question: target.prompt,
          answer: target.reportMarkdown || target.reportHtml,
          orderedData: [
            {
              type: 'metadata',
              links: target.links,
              images: target.images,
              metrics: target.metrics,
              subqueries: target.subqueries,
              sources: target.sources,
              config: target.config,
              reportHtml: target.reportHtml,
            },
          ],
          chatMessages: target.chatMessages,
          timestamp: Date.now(),
        });
      } catch {}
    }
    this.notify('chat');
  }

  async deleteReport(reportId) {
    const target = this.getReportById(reportId);
    const targetPrompt = target?.prompt ? String(target.prompt).trim() : '';
    const targetTs = target?.timestamp ? Date.parse(target.timestamp) : NaN;

    // Identify exact match plus any local/backend duplicate copy from same run
    const removedReports = this.state.reports.filter((r) => {
      if (r.id === reportId) return true;
      if (targetPrompt && String(r.prompt || '').trim() === targetPrompt && !Number.isNaN(targetTs)) {
        const rTs = Date.parse(r.timestamp);
        if (!Number.isNaN(rTs) && Math.abs(rTs - targetTs) < 5000) return true;
      }
      return false;
    });
    const removedIds = new Set(removedReports.map((r) => r.id));
    removedIds.add(reportId);

    this.state.reports = this.state.reports.filter((r) => !removedIds.has(r.id));
    if (removedIds.has(this.state.activeReportId)) {
      this.state.activeReportId = this.state.reports[0]?.id || null;
    }

    // Remove from favorites if pinned
    if (this.state.favorites.some((fid) => removedIds.has(fid))) {
      this.state.favorites = this.state.favorites.filter((fid) => !removedIds.has(fid));
      try {
        localStorage.setItem(this._favoritesKey(), JSON.stringify(this.state.favorites));
      } catch {}
    }

    // Clear stale local HTML caches
    removedReports.forEach((r) => {
      [r.timestamp, r.id].filter(Boolean).forEach((k) => {
        try {
          localStorage.removeItem(this._reportHtmlKey(k));
        } catch {}
      });
    });

    // Clear matching notifications and idle/completed liveSession holding the deleted topic
    if (targetPrompt) {
      this.state.notifications = (this.state.notifications || []).filter(
        (n) => !String(n.message || '').includes(targetPrompt.slice(0, 60))
      );
      if (
        this.state.liveSession &&
        this.state.liveSession.status !== 'running' &&
        this.state.liveSession.status !== 'connecting' &&
        this.state.liveSession.status !== 'reconnecting' &&
        String(this.state.liveSession.task || '').trim() === targetPrompt
      ) {
        this.state.liveSession = createEmptyLiveSession();
      }
      if (String(this.state.draftConfig?.task || '').trim() === targetPrompt) {
        this.state.draftConfig = { ...this.state.draftConfig, task: '' };
      }
    }

    this._persistLocalReports();
    for (const delId of removedIds) {
      try {
        await deleteBackendReport(delId);
      } catch {}
    }
    this.notify('reports');
  }

  async clearAllLocalHistory() {
    this.state.reports.forEach((r) => {
      [r.timestamp, r.id].filter(Boolean).forEach((k) => {
        try {
          localStorage.removeItem(this._reportHtmlKey(k));
        } catch {}
      });
    });
    this.state.reports = [];
    this.state.activeReportId = null;
    this.state.favorites = [];
    this.state.notifications = [];
    if (
      this.state.liveSession &&
      this.state.liveSession.status !== 'running' &&
      this.state.liveSession.status !== 'connecting' &&
      this.state.liveSession.status !== 'reconnecting'
    ) {
      this.state.liveSession = createEmptyLiveSession();
    }
    try {
      localStorage.setItem(this._favoritesKey(), '[]');
    } catch {}
    this._persistLocalReports();
    this.notify('reports');
  }

  _persistLocalReports() {
    try {
      const trimmed = this.state.reports.slice(0, 25).map((entry, idx) => {
        const reportKey = this._reportHtmlKey(entry.timestamp || entry.id);
        if (idx < 8 && entry.reportHtml) {
          try {
            localStorage.setItem(reportKey, entry.reportHtml);
          } catch {}
        }
        return {
          id: entry.id,
          prompt: entry.prompt,
          links: entry.links || {},
          images: entry.images || [],
          metrics: entry.metrics || {},
          subqueries: entry.subqueries || [],
          sources: entry.sources || [],
          reportMarkdown: idx < 8 ? entry.reportMarkdown || '' : '',
          config: entry.config || {},
          reportKey,
          timestamp: entry.timestamp,
        };
      });
      const json = JSON.stringify(trimmed);
      localStorage.setItem(this._historyKey(), json);
      localStorage.setItem('conversationHistory', json);
      // Keep legacy default key in sync so deleted reports cannot resurrect on reload
      localStorage.setItem('conversationHistory_default', json);
    } catch (e) {
      console.warn('localStorage history save warning:', e);
    }
  }

  getReportById(id) {
    return this.state.reports.find((r) => r.id === id) || null;
  }

  getActiveReport() {
    if (this.state.activeReportId) {
      const found = this.getReportById(this.state.activeReportId);
      if (found) return found;
    }
    return this.state.reports[0] || null;
  }

  setActiveReportId(id) {
    this.state.activeReportId = id;
    this.notify('activeReport');
  }

  async loadFiles() {
    try {
      const files = await fetchUploadedFiles();
      this.state.files = files;
      this.state.filesLoaded = true;
      this.notify('files');
      return files;
    } catch (err) {
      console.warn('Could not load files:', err);
      this.state.filesLoaded = true;
      return [];
    }
  }

  resetLiveSession(task = '', config = null) {
    this.state.liveSession = {
      ...createEmptyLiveSession(),
      status: task ? 'connecting' : 'idle',
      task,
      config,
      stage: task ? 1 : 0,
      stageLabel: task ? 'Initializing research session' : 'Idle',
      startedAt: task ? Date.now() : null,
    };
    this.notify('liveSession');
  }

  updateLiveSession(patch) {
    this.state.liveSession = { ...this.state.liveSession, ...patch };
    this.notify('liveSession');
  }

  updateWsStats(stats) {
    this.state.wsStats = { ...stats };
    this.notify('wsStats');
  }
}

export const store = new InquireXStore();
