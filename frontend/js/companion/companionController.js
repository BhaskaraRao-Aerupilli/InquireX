/**
 * InquireX AI Companion Shared State Controller
 * Orchestrates voice input (STT), SSE streaming LLM responses, chunked TTS playback,
 * bounded multi-turn memory, orb reactivity, and InquireX workspace actions.
 */

import { store } from '../store.js';
import { showToast } from '../ui.js';
import { extractCitations } from '../postprocess.js';
import { exportReport, openSlideDeckModal } from '../exports.js';
import { fetchCompanionCapabilities, createCompanionStreamRequest } from './companionApi.js';
import { SpeechRecognitionService } from './speechRecognition.js';
import { SpeechSynthesisService } from './speechSynthesis.js';

function stripHtmlToPlainText(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, style, svg').forEach((el) => el.remove());
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

const PREFS_KEY = 'inquirex_companion_prefs';

class CompanionController {
  constructor() {
    this.listeners = new Set();
    this.amplitudeListeners = new Set();
    this.activeStreamRequest = null;

    const savedPrefs = this._loadPrefs();

    this.state = {
      orbState: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
      statusLabel: 'Ready — Ask anything or tap Mic',
      errorMessage: '',
      draftText: '',
      isRecording: false,
      micSupported: false,
      ttsSupported: false,
      ttsState: 'idle', // 'idle' | 'speaking' | 'paused'
      speakingMessageId: null,
      muted: Boolean(savedPrefs.muted),
      autoSpeak: savedPrefs.autoSpeak !== false,
      autoSendVoice: savedPrefs.autoSendVoice !== false,
      detailLevel: savedPrefs.detailLevel || 'concise',
      historyLimit: Number(savedPrefs.historyLimit) || 10,
      rate: Number(savedPrefs.rate) || 1.04,
      voiceURI: savedPrefs.voiceURI || '',
      voices: [],
      isStreaming: false,
      streamingText: '',
      streamingActions: [],
      streamingSources: [],
      lastFailedPrompt: '',
      lastFailedMode: 'chat',
      messages: [],
      capabilities: {
        available: true,
        provider: 'default',
        model: 'configured',
        web_search_enabled: false,
        default_history_limit: 10,
      },
      floatingOpen: false,
      floatingMinimized: false,
    };

    this.stt = new SpeechRecognitionService({
      onStateChange: (recording) => {
        this.state.isRecording = recording;
        if (recording) {
          this.state.errorMessage = '';
          this._syncOrbState('listening', 'Listening... speak now');
        } else if (this.state.orbState === 'listening') {
          this._recomputeOrbState();
        }
        this._emit('recording');
      },
      onVolume: (level) => {
        if (this.state.orbState === 'listening') {
          this._emitAmplitude(level);
        }
      },
      onTranscript: (text) => {
        this.state.draftText = text;
        this._emit('draft');
      },
      onTranscribing: (active) => {
        if (active) {
          this._syncOrbState('thinking', 'Transcribing voice...');
          this._emit('transcribing');
        }
      },
      onComplete: (finalText) => {
        const cleaned = (finalText || this.state.draftText || '').trim();
        this.state.draftText = cleaned;
        this._recomputeOrbState();
        this._emit('draft');
        if (cleaned && this.state.autoSendVoice) {
          this.sendMessage(cleaned);
        }
      },
      onNotice: (msg) => {
        showToast(msg, 'info');
      },
      onError: (code, msg) => {
        if (code === 'no-speech') {
          showToast(msg, 'info');
          this._recomputeOrbState();
        } else {
          this.state.errorMessage = msg;
          this._syncOrbState('error', msg);
          showToast(msg, 'warning');
        }
        this._emit('error');
      },
    });

    this.tts = new SpeechSynthesisService({
      onStateChange: ({ state, messageId, muted }) => {
        this.state.ttsState = state;
        this.state.speakingMessageId = state === 'idle' ? null : messageId;
        this.state.muted = muted;
        this._recomputeOrbState();
        this._emit('tts');
      },
      onAmplitude: (level) => {
        if (this.state.orbState === 'speaking') {
          this._emitAmplitude(level);
        }
      },
      onVoicesChanged: (voices) => {
        this.state.voices = voices;
        this._emit('voices');
      },
    });

    this.tts.setMuted(this.state.muted);
    this.tts.setRate(this.state.rate);
    this.tts.setVoiceURI(this.state.voiceURI);

    this.state.micSupported = this.stt.isSupported();
    this.state.ttsSupported = this.tts.isSupported();
    this.state.voices = this.tts.getVoices();
  }

  _loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _savePrefs() {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          muted: this.state.muted,
          autoSpeak: this.state.autoSpeak,
          autoSendVoice: this.state.autoSendVoice,
          detailLevel: this.state.detailLevel,
          historyLimit: this.state.historyLimit,
          rate: this.state.rate,
          voiceURI: this.state.voiceURI,
        })
      );
    } catch {}
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  subscribeAmplitude(fn) {
    this.amplitudeListeners.add(fn);
    return () => this.amplitudeListeners.delete(fn);
  }

  _emit(reason = 'update') {
    this.listeners.forEach((fn) => {
      try {
        fn(this.state, reason);
      } catch (err) {
        console.error('Companion subscriber error:', err);
      }
    });
  }

  _emitAmplitude(level) {
    this.amplitudeListeners.forEach((fn) => {
      try {
        fn(level, this.state.orbState);
      } catch {}
    });
  }

  _syncOrbState(orbState, customLabel = '') {
    this.state.orbState = orbState;
    const defaults = {
      idle: 'Ready — Ask anything or tap Mic',
      listening: 'Listening...',
      thinking: 'Thinking...',
      speaking: 'Speaking...',
      error: this.state.errorMessage || 'Error occurred — Retry',
    };
    this.state.statusLabel = customLabel || defaults[orbState] || defaults.idle;
  }

  _recomputeOrbState() {
    if (this.state.isRecording) {
      this._syncOrbState('listening', 'Listening...');
    } else if (this.state.isStreaming) {
      this._syncOrbState('thinking', 'Thinking...');
    } else if (this.state.ttsState === 'speaking') {
      this._syncOrbState('speaking', 'Speaking...');
    } else if (this.state.ttsState === 'paused') {
      this._syncOrbState('idle', 'Audio paused — Tap Play to resume');
    } else if (this.state.errorMessage) {
      this._syncOrbState('error', this.state.errorMessage);
    } else {
      this._syncOrbState('idle', 'Ready — Ask anything or tap Mic');
    }
  }

  async initCapabilities() {
    const caps = await fetchCompanionCapabilities();
    this.state.capabilities = caps;
    this.stt.setBackendSttAvailable(Boolean(caps.stt_backend_available));
    this.state.micSupported = this.stt.isSupported();
    this._emit('capabilities');
  }

  setDraftText(text) {
    this.state.draftText = String(text || '');
  }

  setDetailLevel(level) {
    this.state.detailLevel = level === 'detailed' ? 'detailed' : 'concise';
    this._savePrefs();
    this._emit('prefs');
  }

  setHistoryLimit(limit) {
    this.state.historyLimit = Math.max(4, Math.min(20, Number(limit) || 10));
    this._savePrefs();
    this._emit('prefs');
  }

  setAutoSpeak(enabled) {
    this.state.autoSpeak = Boolean(enabled);
    this._savePrefs();
    this._emit('prefs');
  }

  setAutoSendVoice(enabled) {
    this.state.autoSendVoice = Boolean(enabled);
    this._savePrefs();
    this._emit('prefs');
  }

  setMuted(muted) {
    this.state.muted = Boolean(muted);
    this.tts.setMuted(this.state.muted);
    this._savePrefs();
    this._emit('tts');
  }

  setRate(rate) {
    this.state.rate = Number(rate) || 1.0;
    this.tts.setRate(this.state.rate);
    this._savePrefs();
    if (this.state.ttsState === 'speaking') {
      this.tts.replay();
    }
    this._emit('prefs');
  }

  setVoiceURI(uri) {
    this.state.voiceURI = uri;
    this.tts.setVoiceURI(uri);
    this._savePrefs();
    this._emit('prefs');
  }

  setFloatingOpen(open) {
    this.state.floatingOpen = Boolean(open);
    if (open) this.state.floatingMinimized = false;
    this._emit('floating');
  }

  setFloatingMinimized(minimized) {
    this.state.floatingMinimized = Boolean(minimized);
    this._emit('floating');
  }

  async toggleMicrophone() {
    if (this.state.isRecording) {
      this.stt.stop();
      return;
    }

    // Interruption: cleanly stop current speech or active generation before listening
    if (this.state.ttsState !== 'idle') {
      this.tts.stop();
    }
    if (this.state.isStreaming) {
      this.stopGeneration();
    }

    this.state.errorMessage = '';
    await this.stt.start();
  }

  buildWorkspaceContext() {
    const app = window.inquirexApp;
    const reports = store.state.reports || [];
    const activeReport = store.getActiveReport() || reports[0] || null;
    const live = store.state.liveSession || {};

    let activeReportCtx = null;
    if (activeReport) {
      const textBody =
        activeReport.reportMarkdown && activeReport.reportMarkdown.trim()
          ? activeReport.reportMarkdown
          : stripHtmlToPlainText(activeReport.reportHtml || '');
      const citations = extractCitations(activeReport.reportHtml || '', activeReport.reportMarkdown || '');
      activeReportCtx = {
        id: activeReport.id,
        title: activeReport.prompt || 'Research Report',
        excerpt: textBody.slice(0, 4200),
        sources: citations.slice(0, 12),
      };
    }

    return {
      active_route: app?.currentRoute || 'companion',
      active_report: activeReportCtx,
      recent_reports: reports.slice(0, 6).map((r) => {
        const bodyText =
          r.reportMarkdown && r.reportMarkdown.trim()
            ? r.reportMarkdown
            : stripHtmlToPlainText(r.reportHtml || '');
        return {
          id: r.id,
          title: r.prompt || 'Untitled',
          report_type: r.config?.report_type || 'research_report',
          excerpt: bodyText.slice(0, 420),
          timestamp: r.timestamp,
        };
      }),
      files: (store.state.files || []).slice(0, 20),
      live_session: {
        status: live.status || 'idle',
        task: live.task || '',
        stage: live.stage || 0,
        stage_label: live.stageLabel || '',
        subqueries_count: (live.subqueries || []).length,
        sources_count: (live.scrapedSources || []).length,
        scraped_sources: (live.scrapedSources || []).slice(-8),
        recent_logs: (live.logs || []).slice(-6).map((l) => l.text || l.output || ''),
      },
    };
  }

  async sendMessage(rawText, { mode = 'chat' } = {}) {
    const text = String(rawText || this.state.draftText || '').trim();
    if (!text) return;

    // Duplicate concurrent request guard
    if (this.state.isStreaming) {
      return;
    }

    if (this.state.isRecording) {
      this.stt.stop();
    }
    if (this.state.ttsState !== 'idle') {
      this.tts.stop();
    }

    const userMsg = {
      id: `cmp_u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const boundedHistory = this.state.messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.error && m.content)
      .slice(-this.state.historyLimit)
      .map((m) => ({ role: m.role, content: m.content }));

    this.state.messages = [...this.state.messages, userMsg];
    this.state.draftText = '';
    this.state.errorMessage = '';
    this.state.isStreaming = true;
    this.state.streamingText = '';
    this.state.streamingActions = [];
    this.state.streamingSources = [];
    this.state.lastFailedPrompt = text;
    this.state.lastFailedMode = mode;
    this._syncOrbState('thinking', mode === 'brief' ? 'Preparing briefing...' : 'Thinking...');
    this._emit('stream-start');

    const req = createCompanionStreamRequest({
      message: text,
      history: boundedHistory,
      mode,
      detailLevel: this.state.detailLevel,
      maxHistory: this.state.historyLimit,
      workspaceContext: this.buildWorkspaceContext(),
      onToken: (delta) => {
        if (!this.state.isStreaming) return;
        this.state.streamingText += delta;
        this._emit('stream-token');
      },
      onAction: (action) => {
        this.state.streamingActions = [...this.state.streamingActions, action];
        this._emit('stream-token');
      },
      onSources: (sources) => {
        this.state.streamingSources = sources;
        this._emit('stream-token');
      },
      onError: (errMsg) => {
        this.activeStreamRequest = null;
        this.state.isStreaming = false;
        this.state.streamingText = '';
        this.state.errorMessage = errMsg;
        this.state.messages = [
          ...this.state.messages,
          {
            id: `cmp_err_${Date.now()}`,
            role: 'assistant',
            content: errMsg,
            error: errMsg,
            timestamp: new Date().toISOString(),
            actions: [],
            sources: [],
          },
        ];
        this._syncOrbState('error', errMsg);
        this._emit('stream-end');
      },
      onDone: (ev) => {
        this.activeStreamRequest = null;
        if (!this.state.isStreaming) return;

        const finalContent = (ev.content || this.state.streamingText || '').trim();
        const finalActions = ev.actions?.length ? ev.actions : this.state.streamingActions;
        const finalSources = ev.sources?.length ? ev.sources : this.state.streamingSources;

        const assistantMsg = {
          id: `cmp_a_${Date.now()}`,
          role: 'assistant',
          content: finalContent || 'I completed processing your request.',
          timestamp: new Date().toISOString(),
          actions: finalActions || [],
          sources: finalSources || [],
        };

        this.state.messages = [...this.state.messages, assistantMsg];
        this.state.isStreaming = false;
        this.state.streamingText = '';
        this.state.streamingActions = [];
        this.state.streamingSources = [];
        this._recomputeOrbState();
        this._emit('stream-end');

        if (this.state.autoSpeak && !this.state.muted && assistantMsg.content) {
          this.tts.speak(assistantMsg.content, { messageId: assistantMsg.id });
        }
      },
    });

    this.activeStreamRequest = req;
    await req.promise;
  }

  stopGeneration() {
    if (this.activeStreamRequest) {
      this.activeStreamRequest.abort();
      this.activeStreamRequest = null;
    }
    if (this.state.isStreaming) {
      const partial = this.state.streamingText.trim();
      this.state.isStreaming = false;
      if (partial) {
        this.state.messages = [
          ...this.state.messages,
          {
            id: `cmp_a_${Date.now()}`,
            role: 'assistant',
            content: `${partial}\n\n*(Generation stopped)*`,
            timestamp: new Date().toISOString(),
            actions: this.state.streamingActions || [],
            sources: this.state.streamingSources || [],
          },
        ];
      }
      this.state.streamingText = '';
      this.state.streamingActions = [];
      this.state.streamingSources = [];
      this._recomputeOrbState();
      this._emit('stream-end');
    }
  }

  retryLastMessage() {
    if (!this.state.lastFailedPrompt) return;
    // Remove trailing error card cleanly before retrying
    const msgs = [...this.state.messages];
    if (msgs.length && msgs[msgs.length - 1].error) {
      msgs.pop();
    }
    if (msgs.length && msgs[msgs.length - 1].role === 'user' && msgs[msgs.length - 1].content === this.state.lastFailedPrompt) {
      msgs.pop();
    }
    this.state.messages = msgs;
    this.state.errorMessage = '';
    this.sendMessage(this.state.lastFailedPrompt, { mode: this.state.lastFailedMode || 'chat' });
  }

  playMessageAudio(messageId) {
    const msg = this.state.messages.find((m) => m.id === messageId);
    if (!msg || !msg.content) return;
    if (this.state.muted) {
      this.setMuted(false);
    }
    this.tts.speak(msg.content, { messageId: msg.id });
  }

  pauseAudio() {
    this.tts.pause();
  }

  resumeAudio() {
    this.tts.resume();
  }

  stopAudio() {
    this.tts.stop();
  }

  replayLastAudio() {
    if (this.state.muted) {
      this.setMuted(false);
    }
    if (!this.tts.replay()) {
      const lastAssistant = [...this.state.messages].reverse().find((m) => m.role === 'assistant' && !m.error);
      if (lastAssistant) {
        this.tts.speak(lastAssistant.content, { messageId: lastAssistant.id });
      }
    }
  }

  clearConversation() {
    this.stopGeneration();
    this.tts.stop();
    if (this.state.isRecording) this.stt.stop();
    this.state.messages = [];
    this.state.streamingText = '';
    this.state.errorMessage = '';
    this._recomputeOrbState();
    this._emit('clear');
  }

  briefActiveReport() {
    const active = store.getActiveReport() || (store.state.reports || [])[0];
    if (!active) {
      showToast('No saved report found to brief. Start a research inquiry first!', 'info');
      return;
    }
    this.sendMessage(`Give me an executive voice briefing of my report "${active.prompt}".`, { mode: 'brief' });
  }

  narrateLiveResearch() {
    const ls = store.state.liveSession;
    if (!ls || ls.status === 'idle') {
      showToast('No active or recent live research run to narrate right now.', 'info');
      return;
    }
    this.sendMessage('What is the current live research status and what sources or findings exist so far?', {
      mode: 'narrate',
    });
  }

  async executeWorkspaceAction(action) {
    const app = window.inquirexApp;
    if (!action || !app) return;

    if (action.type === 'navigate' && action.route) {
      app.navigate(action.route);
      showToast(`Navigated to ${action.label || action.route}`, 'info');
      return;
    }

    if (action.type === 'open_report') {
      if (action.report_id && store.getReportById(action.report_id)) {
        store.setActiveReportId(action.report_id);
      }
      app.navigate('report-viewer');
      return;
    }

    if (action.type === 'open_slides') {
      const rep = (action.report_id && store.getReportById(action.report_id)) || store.getActiveReport();
      if (!rep) {
        showToast('No report available to generate slides.', 'warning');
        return;
      }
      store.setActiveReportId(rep.id);
      openSlideDeckModal(rep);
      return;
    }

    if (action.type === 'export_report') {
      const rep = store.getActiveReport() || (store.state.reports || [])[0];
      if (!rep) {
        showToast('No report loaded to export.', 'warning');
        return;
      }
      await exportReport(rep, action.format || 'md');
      return;
    }

    if (action.type === 'start_research' && action.task) {
      store.updateDraftConfig({
        task: action.task,
        report_type: action.report_type || 'research_report',
        tone: action.tone || 'Analytical',
      });
      app.navigate('new-research');
      showToast('Research configured — review parameters and press Start Research.', 'success');
    }
  }
}

export const companion = new CompanionController();
