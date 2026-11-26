/**
 * InquireX Dedicated AI Companion View
 * Full-page voice & text experience featuring the centered multi-state animated Orb,
 * real-time audio reactivity, editable recognized transcript dock, TTS controls,
 * and streaming workspace-grounded responses underneath.
 */

import { store } from '../store.js';
import { companion } from '../companion/companionController.js';
import { renderCompanionOrbHtml, AICompanionOrbController } from '../companion/orbController.js';
import { escapeHtml, formatRelativeTime, markdownToHtml, showToast } from '../ui.js';

function getActionIcon(action) {
  switch (action?.type) {
    case 'start_research':
      return 'fa-bolt';
    case 'open_slides':
      return 'fa-display';
    case 'export_report':
      return 'fa-download';
    case 'open_report':
      return 'fa-file-lines';
    default:
      return 'fa-arrow-up-right-from-square';
  }
}

function renderMessageCard(msg, ttsState, speakingId) {
  const isUser = msg.role === 'user';
  const isError = Boolean(msg.error);
  const isThisSpeaking = speakingId === msg.id && (ttsState === 'speaking' || ttsState === 'paused');

  return `
    <article class="ix-cmp-msg ${isUser ? 'user' : 'assistant'}" data-msg-id="${escapeHtml(msg.id)}">
      <div class="ix-cmp-msg-head">
        <span class="ix-cmp-msg-role">
          <i class="fa-solid ${isUser ? 'fa-user' : isError ? 'fa-triangle-exclamation' : 'fa-robot'}" style="color:${
            isError ? 'var(--status-error)' : 'var(--accent-primary)'
          };"></i>
          <span>${isUser ? 'You' : 'InquireX AI Companion'}</span>
        </span>
        <span class="ix-help">${escapeHtml(formatRelativeTime(msg.timestamp))}</span>
      </div>

      <div class="ix-cmp-msg-body ${isUser ? '' : 'ix-prose'}">
        ${
          isError
            ? `<p style="color:var(--status-error); margin:0;">${escapeHtml(msg.content)}</p>`
            : isUser
            ? `<p style="margin:0; white-space:pre-wrap;">${escapeHtml(msg.content)}</p>`
            : markdownToHtml(msg.content)
        }
      </div>

      ${
        !isUser && Array.isArray(msg.sources) && msg.sources.length > 0
          ? `<div class="ix-cmp-msg-actions">
               ${msg.sources
                 .map(
                   (s) => `
                   <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="ix-topic-pill" style="text-decoration:none;">
                     <i class="fa-solid fa-globe" style="font-size:11px; color:var(--accent-primary);"></i>
                     <span class="ix-truncate" style="max-width:220px;">${escapeHtml(s.title || s.url)}</span>
                   </a>`
                 )
                 .join('')}
             </div>`
          : ''
      }

      ${
        !isUser && Array.isArray(msg.actions) && msg.actions.length > 0
          ? `<div class="ix-cmp-msg-actions">
               ${msg.actions
                 .map(
                   (act, idx) => `
                   <button type="button" class="ix-btn ix-btn-primary ix-btn-sm" data-cmp-action='${escapeHtml(
                     JSON.stringify(act)
                   )}' data-act-idx="${idx}">
                     <i class="fa-solid ${getActionIcon(act)}"></i>
                     <span>${escapeHtml(act.label || 'Run Action')}</span>
                   </button>`
                 )
                 .join('')}
             </div>`
          : ''
      }

      <div class="ix-cmp-msg-footer">
        ${
          isUser
            ? `<button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-cmp-edit="${escapeHtml(msg.id)}">
                 <i class="fa-regular fa-pen-to-square"></i> Edit &amp; Resend
               </button>`
            : isError
            ? `<button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-cmp-retry>
                 <i class="fa-solid fa-rotate-right"></i> Retry Request
               </button>`
            : `<button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-cmp-copy="${escapeHtml(msg.id)}">
                 <i class="fa-regular fa-copy"></i> Copy
               </button>
               ${
                 isThisSpeaking
                   ? `<button type="button" class="ix-btn ix-btn-secondary ix-btn-sm" data-cmp-toggle-tts>
                        <i class="fa-solid ${ttsState === 'paused' ? 'fa-play' : 'fa-pause'}"></i>
                        ${ttsState === 'paused' ? 'Resume' : 'Pause'}
                      </button>
                      <button type="button" class="ix-btn ix-btn-danger ix-btn-sm" data-cmp-stop-tts>
                        <i class="fa-solid fa-stop"></i> Stop
                      </button>`
                   : `<button type="button" class="ix-btn ix-btn-ghost ix-btn-sm" data-cmp-play="${escapeHtml(msg.id)}">
                        <i class="fa-solid fa-volume-high"></i> Speak / Replay
                      </button>`
               }`
        }
      </div>
    </article>
  `;
}

export function renderCompanionView(container, _ctx) {
  companion.initCapabilities();

  const state = companion.state;
  const activeReport = store.getActiveReport() || (store.state.reports || [])[0];
  const hasLive = store.state.liveSession && store.state.liveSession.status !== 'idle';

  container.innerHTML = `
    <div class="ix-view-enter ix-companion-page" id="ixCompanionPageRoot">
      <!-- Page Header -->
      <div class="ix-page-header" style="margin-bottom:0;">
        <div>
          <h1 class="ix-page-title">AI Companion</h1>
          <p class="ix-page-desc">
            Voice &amp; text copilot grounded in your InquireX reports, sources, documents, and live research agents.
          </p>
        </div>
        <div class="ix-page-actions">
          <span class="ix-badge" id="ixCmpProviderBadge">
            <i class="fa-solid fa-microchip"></i>
            ${escapeHtml(state.capabilities.provider)} / ${escapeHtml(state.capabilities.model)}
          </span>
          <button type="button" id="ixCmpMuteBtn" class="ix-btn ix-btn-secondary ix-btn-sm">
            <i class="fa-solid ${state.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
            <span>${state.muted ? 'Muted' : 'Voice On'}</span>
          </button>
          <button type="button" id="ixCmpClearBtn" class="ix-btn ix-btn-secondary ix-btn-sm">
            <i class="fa-regular fa-trash-can"></i> Clear Chat
          </button>
        </div>
      </div>

      <!-- Centered Animated AI Entity Stage -->
      <section class="ix-cmp-stage" id="ixCmpStage">
        <div class="ix-cmp-stage-top">
          <span class="ix-badge ${activeReport ? 'ix-badge-accent' : ''}" id="ixCmpContextBadge">
            <i class="fa-regular fa-file-lines"></i>
            ${activeReport ? `Context: ${escapeHtml((activeReport.prompt || 'Report').slice(0, 42))}` : 'General + Workspace Mode'}
          </span>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <select id="ixCmpDetailSelect" class="ix-select" style="width:auto; height:30px; font-size:var(--text-xs);" aria-label="Response depth">
              <option value="concise" ${state.detailLevel === 'concise' ? 'selected' : ''}>Concise Voice Reply</option>
              <option value="detailed" ${state.detailLevel === 'detailed' ? 'selected' : ''}>Detailed Explanation</option>
            </select>

            <select id="ixCmpHistoryLimitSelect" class="ix-select" style="width:auto; height:30px; font-size:var(--text-xs);" aria-label="Conversation memory turns">
              <option value="6" ${state.historyLimit === 6 ? 'selected' : ''}>Memory: 6 turns</option>
              <option value="10" ${state.historyLimit === 10 ? 'selected' : ''}>Memory: 10 turns</option>
              <option value="16" ${state.historyLimit === 16 ? 'selected' : ''}>Memory: 16 turns</option>
            </select>

            <select id="ixCmpRateSelect" class="ix-select" style="width:auto; height:30px; font-size:var(--text-xs);" aria-label="Speech playback speed">
              <option value="0.9" ${state.rate === 0.9 ? 'selected' : ''}>0.9x</option>
              <option value="1.04" ${Math.abs(state.rate - 1.04) < 0.05 ? 'selected' : ''}>1.0x</option>
              <option value="1.2" ${state.rate === 1.2 ? 'selected' : ''}>1.2x</option>
              <option value="1.4" ${state.rate === 1.4 ? 'selected' : ''}>1.4x</option>
            </select>
          </div>
        </div>

        ${renderCompanionOrbHtml({ compact: false, orbId: 'ixCmpPageOrb', eqId: 'ixCmpPageEq' })}

        <div class="ix-cmp-status-line" id="ixCmpStatusPill">
          <span class="ix-ws-dot ${
            state.orbState === 'error'
              ? 'error'
              : state.orbState === 'thinking'
              ? 'connecting'
              : state.orbState === 'listening' || state.orbState === 'speaking'
              ? 'connected'
              : ''
          }" id="ixCmpStatusDot"></span>
          <span data-cmp-status>${escapeHtml(state.statusLabel)}</span>
        </div>

        <div class="ix-cmp-quick-actions">
          <button type="button" class="ix-topic-pill" id="ixCmpBriefBtn">
            <i class="fa-solid fa-bolt" style="color:var(--accent-primary);"></i>
            <span>Brief Active Report</span>
          </button>
          <button type="button" class="ix-topic-pill ${hasLive ? '' : 'ix-hidden'}" id="ixCmpNarrateBtn">
            <i class="fa-solid fa-wave-square" style="color:var(--status-success);"></i>
            <span>Narrate Live Progress</span>
          </button>
          <button type="button" class="ix-topic-pill" data-cmp-prompt="Compare the main insights and limitations across my saved research reports.">
            <i class="fa-solid fa-scale-balanced" style="color:var(--accent-secondary);"></i>
            <span>Compare Reports</span>
          </button>
          <button type="button" class="ix-topic-pill" data-cmp-prompt="Start a detailed analytical research project on agentic RAG vs fine-tuning in enterprise AI.">
            <i class="fa-solid fa-rocket" style="color:var(--accent-primary);"></i>
            <span>Start Deep Research by Voice</span>
          </button>
        </div>
      </section>

      <!-- Voice / Editable Text Input Dock -->
      <section class="ix-cmp-controls-card" aria-label="Assistant controls">
        <div class="ix-cmp-input-row">
          <button
            type="button"
            id="ixCmpMicBtn"
            class="ix-btn ${state.isRecording ? 'ix-btn-danger' : 'ix-btn-secondary'} ix-btn-lg"
            title="${state.micSupported ? 'Start/Stop voice input' : 'Voice recognition unavailable in this browser'}"
            ${state.micSupported ? '' : 'disabled'}
          >
            <i class="fa-solid ${state.isRecording ? 'fa-microphone-slash' : 'fa-microphone'}"></i>
            <span class="ix-ws-status-text">${state.isRecording ? 'Stop Mic' : 'Speak'}</span>
          </button>

          <textarea
            id="ixCmpInput"
            class="ix-cmp-textarea"
            rows="1"
            placeholder="${
              state.micSupported
                ? 'Ask by voice or type here...'
                : 'Type a question for InquireX...'
            }"
          >${escapeHtml(state.draftText)}</textarea>

          <button type="button" id="ixCmpSendBtn" class="ix-btn ix-btn-primary ix-btn-lg" ${state.isStreaming ? 'disabled' : ''}>
            <i class="fa-solid fa-paper-plane"></i>
            <span>Send</span>
          </button>
        </div>

        <div class="ix-cmp-toolbar">
          <div class="ix-cmp-toolbar-group">
            <label class="ix-switch" title="Automatically speak AI responses aloud">
              <input type="checkbox" id="ixCmpAutoSpeakChk" ${state.autoSpeak ? 'checked' : ''} />
              <span class="ix-switch-track"></span>
              <span style="font-size:var(--text-xs); color:var(--text-secondary);">Auto-speak replies</span>
            </label>

            <label class="ix-switch" title="Turn off to review and edit recognized speech before sending">
              <input type="checkbox" id="ixCmpAutoSendChk" ${state.autoSendVoice ? 'checked' : ''} />
              <span class="ix-switch-track"></span>
              <span style="font-size:var(--text-xs); color:var(--text-secondary);">Auto-send voice</span>
            </label>

            <select id="ixCmpVoiceSelect" class="ix-select" style="width:auto; max-width:210px; height:28px; font-size:var(--text-xs);" aria-label="Speech voice">
              <option value="">Default System Voice</option>
              ${state.voices
                .slice(0, 20)
                .map(
                  (v) =>
                    `<option value="${escapeHtml(v.voiceURI)}" ${v.voiceURI === state.voiceURI ? 'selected' : ''}>${escapeHtml(
                      `${v.name} (${v.lang})`
                    )}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="ix-cmp-toolbar-group" id="ixCmpTransportControls">
            <button type="button" id="ixCmpStopGenBtn" class="ix-btn ix-btn-danger ix-btn-sm ${state.isStreaming ? '' : 'ix-hidden'}">
              <i class="fa-solid fa-square"></i> Stop Generating
            </button>
            <button type="button" id="ixCmpPauseAudioBtn" class="ix-btn ix-btn-secondary ix-btn-sm ${state.ttsState === 'idle' ? 'ix-hidden' : ''}">
              <i class="fa-solid ${state.ttsState === 'paused' ? 'fa-play' : 'fa-pause'}"></i>
              <span>${state.ttsState === 'paused' ? 'Resume' : 'Pause Voice'}</span>
            </button>
            <button type="button" id="ixCmpStopAudioBtn" class="ix-btn ix-btn-secondary ix-btn-sm ${state.ttsState === 'idle' ? 'ix-hidden' : ''}">
              <i class="fa-solid fa-volume-xmark"></i> Stop Voice
            </button>
            <button type="button" id="ixCmpReplayAudioBtn" class="ix-btn ix-btn-ghost ix-btn-sm ${state.messages.some((m) => m.role === 'assistant' && !m.error) && state.ttsState === 'idle' ? '' : 'ix-hidden'}">
              <i class="fa-solid fa-rotate-left"></i> Replay
            </button>
            <button type="button" id="ixCmpRetryBtn" class="ix-btn ix-btn-danger ix-btn-sm ${state.orbState === 'error' && state.lastFailedPrompt ? '' : 'ix-hidden'}">
              <i class="fa-solid fa-rotate-right"></i> Retry
            </button>
          </div>
        </div>
      </section>

      <!-- Readable Streaming & Multi-Turn Conversation Below Orb -->
      <section class="ix-cmp-thread" id="ixCmpThread" aria-live="polite"></section>
    </div>
  `;

  const orbCtrl = new AICompanionOrbController(container.querySelector('#ixCmpStage'), {
    orbSelector: '#ixCmpPageOrb',
    eqSelector: '#ixCmpPageEq',
    statusSelector: '[data-cmp-status]',
  });
  orbCtrl.setState(state.orbState, state.statusLabel);

  const inputEl = container.querySelector('#ixCmpInput');
  const threadEl = container.querySelector('#ixCmpThread');

  const autoResizeInput = () => {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(150, Math.max(44, inputEl.scrollHeight))}px`;
  };
  autoResizeInput();

  const renderStreamingAndMessages = () => {
    const s = companion.state;
    let html = '';

    if (s.messages.length === 0 && !s.isStreaming) {
      html = `
        <div class="ix-empty-state" style="padding:var(--space-6);">
          <div class="ix-empty-icon"><i class="fa-regular fa-comments"></i></div>
          <div class="ix-empty-title">Ask by voice or text</div>
          <div class="ix-empty-desc">
            Try asking about your reports, verifying sources, requesting a 30-second briefing, or launching a new InquireX research workflow.
          </div>
        </div>
      `;
    } else {
      html = s.messages.map((m) => renderMessageCard(m, s.ttsState, s.speakingMessageId)).join('');
      if (s.isStreaming) {
        html += `
          <article class="ix-cmp-msg assistant" id="ixCmpStreamingMsgCard">
            <div class="ix-cmp-msg-head">
              <span class="ix-cmp-msg-role">
                <i class="fa-solid fa-spinner fa-spin" style="color:var(--accent-primary);"></i>
                <span>InquireX AI Companion</span>
              </span>
              <span class="ix-badge ix-badge-accent">Streaming</span>
            </div>
            <div class="ix-cmp-msg-body ix-prose" id="ixCmpStreamingBody">
              ${markdownToHtml(s.streamingText || '')}<span class="ix-cmp-cursor"></span>
            </div>
          </article>
        `;
      }
    }

    if (threadEl) {
      threadEl.innerHTML = html;
      bindThreadActions();
    }
  };

  const updateStreamingBodyOnly = () => {
    const bodyEl = container.querySelector('#ixCmpStreamingBody');
    if (bodyEl) {
      bodyEl.innerHTML = `${markdownToHtml(companion.state.streamingText || '')}<span class="ix-cmp-cursor"></span>`;
    } else {
      renderStreamingAndMessages();
    }
  };

  const syncControlsAndOrb = (_state, reason) => {
    const s = companion.state;
    orbCtrl.setState(s.orbState, s.statusLabel);

    const statusDot = container.querySelector('#ixCmpStatusDot');
    if (statusDot) {
      statusDot.className = `ix-ws-dot ${
        s.orbState === 'error'
          ? 'error'
          : s.orbState === 'thinking'
          ? 'connecting'
          : s.orbState === 'listening' || s.orbState === 'speaking'
          ? 'connected'
          : ''
      }`;
    }

    const badgeEl = container.querySelector('#ixCmpProviderBadge');
    if (badgeEl) {
      badgeEl.innerHTML = `<i class="fa-solid fa-microchip"></i> ${escapeHtml(s.capabilities.provider)} / ${escapeHtml(s.capabilities.model)}`;
    }

    const micBtn = container.querySelector('#ixCmpMicBtn');
    if (micBtn) {
      micBtn.className = `ix-btn ${s.isRecording ? 'ix-btn-danger' : 'ix-btn-secondary'} ix-btn-lg`;
      micBtn.innerHTML = `<i class="fa-solid ${s.isRecording ? 'fa-microphone-slash' : 'fa-microphone'}"></i> <span class="ix-ws-status-text">${
        s.isRecording ? 'Stop Mic' : 'Speak'
      }</span>`;
    }

    const muteBtn = container.querySelector('#ixCmpMuteBtn');
    if (muteBtn) {
      muteBtn.innerHTML = `<i class="fa-solid ${s.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i> <span>${
        s.muted ? 'Muted' : 'Voice On'
      }</span>`;
    }

    const sendBtn = container.querySelector('#ixCmpSendBtn');
    if (sendBtn) sendBtn.disabled = s.isStreaming;

    container.querySelector('#ixCmpStopGenBtn')?.classList.toggle('ix-hidden', !s.isStreaming);
    const pauseAudioBtn = container.querySelector('#ixCmpPauseAudioBtn');
    if (pauseAudioBtn) {
      pauseAudioBtn.classList.toggle('ix-hidden', s.ttsState === 'idle');
      pauseAudioBtn.innerHTML = `<i class="fa-solid ${s.ttsState === 'paused' ? 'fa-play' : 'fa-pause'}"></i> <span>${
        s.ttsState === 'paused' ? 'Resume' : 'Pause Voice'
      }</span>`;
    }
    container.querySelector('#ixCmpStopAudioBtn')?.classList.toggle('ix-hidden', s.ttsState === 'idle');
    container
      .querySelector('#ixCmpReplayAudioBtn')
      ?.classList.toggle('ix-hidden', !(s.messages.some((m) => m.role === 'assistant' && !m.error) && s.ttsState === 'idle'));
    container.querySelector('#ixCmpRetryBtn')?.classList.toggle('ix-hidden', !(s.orbState === 'error' && s.lastFailedPrompt));

    if ((reason === 'draft' || reason === 'stream-start' || reason === 'clear') && inputEl && inputEl.value !== s.draftText) {
      inputEl.value = s.draftText;
      autoResizeInput();
    }

    if (reason === 'voices') {
      const voiceSel = container.querySelector('#ixCmpVoiceSelect');
      if (voiceSel) {
        voiceSel.innerHTML =
          `<option value="">Default System Voice</option>` +
          s.voices
            .slice(0, 20)
            .map(
              (v) =>
                `<option value="${escapeHtml(v.voiceURI)}" ${v.voiceURI === s.voiceURI ? 'selected' : ''}>${escapeHtml(
                  `${v.name} (${v.lang})`
                )}</option>`
            )
            .join('');
      }
    }

    if (reason === 'stream-token') {
      updateStreamingBodyOnly();
    } else if (['stream-start', 'stream-end', 'clear', 'tts', 'error'].includes(reason)) {
      renderStreamingAndMessages();
    }
  };

  function bindThreadActions() {
    threadEl?.querySelectorAll('[data-cmp-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          const action = JSON.parse(btn.getAttribute('data-cmp-action') || '{}');
          companion.executeWorkspaceAction(action);
        } catch {}
      });
    });
    threadEl?.querySelectorAll('[data-cmp-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const msg = companion.state.messages.find((m) => m.id === btn.getAttribute('data-cmp-copy'));
        if (!msg) return;
        try {
          await navigator.clipboard.writeText(msg.content);
          showToast('Response copied to clipboard.', 'success');
        } catch {
          showToast('Could not copy text cleanly.', 'error');
        }
      });
    });
    threadEl?.querySelectorAll('[data-cmp-play]').forEach((btn) => {
      btn.addEventListener('click', () => companion.playMessageAudio(btn.getAttribute('data-cmp-play')));
    });
    threadEl?.querySelectorAll('[data-cmp-toggle-tts]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (companion.state.ttsState === 'paused') companion.resumeAudio();
        else companion.pauseAudio();
      });
    });
    threadEl?.querySelectorAll('[data-cmp-stop-tts]').forEach((btn) => {
      btn.addEventListener('click', () => companion.stopAudio());
    });
    threadEl?.querySelectorAll('[data-cmp-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = companion.state.messages.find((m) => m.id === btn.getAttribute('data-cmp-edit'));
        if (msg && inputEl) {
          companion.setDraftText(msg.content);
          inputEl.value = msg.content;
          autoResizeInput();
          inputEl.focus();
        }
      });
    });
    threadEl?.querySelectorAll('[data-cmp-retry]').forEach((btn) => {
      btn.addEventListener('click', () => companion.retryLastMessage());
    });
  }

  renderStreamingAndMessages();

  // Wire UI Events
  container.querySelector('#ixCmpPageOrb')?.addEventListener('click', () => companion.toggleMicrophone());
  container.querySelector('#ixCmpMicBtn')?.addEventListener('click', () => companion.toggleMicrophone());
  container.querySelector('#ixCmpMuteBtn')?.addEventListener('click', () => companion.setMuted(!companion.state.muted));
  container.querySelector('#ixCmpClearBtn')?.addEventListener('click', () => companion.clearConversation());
  container.querySelector('#ixCmpBriefBtn')?.addEventListener('click', () => companion.briefActiveReport());
  container.querySelector('#ixCmpNarrateBtn')?.addEventListener('click', () => companion.narrateLiveResearch());
  container.querySelector('#ixCmpStopGenBtn')?.addEventListener('click', () => companion.stopGeneration());
  container.querySelector('#ixCmpStopAudioBtn')?.addEventListener('click', () => companion.stopAudio());
  container.querySelector('#ixCmpReplayAudioBtn')?.addEventListener('click', () => companion.replayLastAudio());
  container.querySelector('#ixCmpRetryBtn')?.addEventListener('click', () => companion.retryLastMessage());
  container.querySelector('#ixCmpPauseAudioBtn')?.addEventListener('click', () => {
    if (companion.state.ttsState === 'paused') companion.resumeAudio();
    else companion.pauseAudio();
  });

  container.querySelectorAll('[data-cmp-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-cmp-prompt');
      if (prompt) companion.sendMessage(prompt);
    });
  });

  container.querySelector('#ixCmpDetailSelect')?.addEventListener('change', (e) => companion.setDetailLevel(e.target.value));
  container.querySelector('#ixCmpHistoryLimitSelect')?.addEventListener('change', (e) => companion.setHistoryLimit(e.target.value));
  container.querySelector('#ixCmpRateSelect')?.addEventListener('change', (e) => companion.setRate(e.target.value));
  container.querySelector('#ixCmpVoiceSelect')?.addEventListener('change', (e) => companion.setVoiceURI(e.target.value));
  container.querySelector('#ixCmpAutoSpeakChk')?.addEventListener('change', (e) => companion.setAutoSpeak(e.target.checked));
  container.querySelector('#ixCmpAutoSendChk')?.addEventListener('change', (e) => companion.setAutoSendVoice(e.target.checked));

  const submitTyped = () => {
    const val = (inputEl?.value || '').trim();
    if (!val) return;
    companion.sendMessage(val);
    if (inputEl) {
      inputEl.value = '';
      autoResizeInput();
    }
  };

  container.querySelector('#ixCmpSendBtn')?.addEventListener('click', submitTyped);
  inputEl?.addEventListener('input', () => {
    companion.setDraftText(inputEl.value);
    autoResizeInput();
  });
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitTyped();
    }
  });

  const onEsc = (e) => {
    if (e.key === 'Escape') {
      if (companion.state.isRecording) companion.stt.stop();
      else if (companion.state.ttsState !== 'idle') companion.stopAudio();
      else if (companion.state.isStreaming) companion.stopGeneration();
    }
  };
  document.addEventListener('keydown', onEsc);

  const unsubState = companion.subscribe(syncControlsAndOrb);
  const unsubAmp = companion.subscribeAmplitude((lvl) => orbCtrl.setAmplitude(lvl));

  return () => {
    unsubState();
    unsubAmp();
    document.removeEventListener('keydown', onEsc);
  };
}
