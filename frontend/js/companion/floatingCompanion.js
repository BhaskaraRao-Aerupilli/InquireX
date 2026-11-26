/**
 * InquireX Floating AI Companion Widget
 * Persistent compact voice & text assistant launcher available across workspace views
 * (automatically hidden when the full-page AI Companion view is open).
 */

import { companion } from './companionController.js';
import { renderCompanionOrbHtml, AICompanionOrbController } from './orbController.js';
import { escapeHtml, markdownToHtml } from '../ui.js';

export class FloatingCompanionWidget {
  constructor(onOpenFullPage) {
    this.onOpenFullPage = onOpenFullPage;
    this.root = null;
    this.orbCtrl = null;
    this.hiddenForRoute = false;
    this.unsubState = null;
    this.unsubAmp = null;
  }

  mount() {
    if (this.root) return;
    const host = document.createElement('div');
    host.id = 'ixFloatingCompanionHost';
    document.body.appendChild(host);
    this.root = host;

    this.renderShell();

    this.unsubState = companion.subscribe((_state, reason) => {
      this.syncUI(reason);
    });
    this.unsubAmp = companion.subscribeAmplitude((lvl) => {
      if (companion.state.floatingOpen && !this.hiddenForRoute) {
        this.orbCtrl?.setAmplitude(lvl);
      }
    });

    this.onKey = (e) => {
      if (e.key === 'Escape' && companion.state.floatingOpen && !this.hiddenForRoute) {
        if (companion.state.isRecording) companion.stt.stop();
        else if (companion.state.ttsState !== 'idle') companion.stopAudio();
        else companion.setFloatingOpen(false);
      }
    };
    document.addEventListener('keydown', this.onKey);
  }

  syncRoute(routeId) {
    this.hiddenForRoute = routeId === 'companion';
    if (this.root) {
      this.root.classList.toggle('ix-hidden', this.hiddenForRoute);
    }
    if (!this.hiddenForRoute) {
      this.syncUI('route');
    }
  }

  renderShell() {
    const s = companion.state;
    this.root.innerHTML = `
      <button
        type="button"
        id="ixCmpFabBtn"
        class="ix-cmp-fab ${s.floatingOpen ? 'ix-hidden' : ''}"
        aria-label="Open AI Companion Assistant"
        title="Ask InquireX AI Companion"
      >
        <span class="ix-cmp-fab-orb"><i class="fa-solid fa-atom"></i></span>
        <span>AI Companion</span>
      </button>

      <section
        id="ixCmpDrawer"
        class="ix-cmp-drawer ${s.floatingOpen ? '' : 'ix-hidden'} ${s.floatingMinimized ? 'minimized' : ''}"
        role="dialog"
        aria-label="InquireX Floating AI Companion"
      >
        <header class="ix-cmp-drawer-header">
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            <span class="ix-ws-dot ${s.orbState === 'speaking' || s.orbState === 'listening' ? 'connected' : ''}" id="ixCmpFabStatusDot"></span>
            <strong style="font-size:var(--text-sm); color:var(--text-primary);">AI Companion</strong>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <button type="button" id="ixCmpDrawerMute" class="ix-icon-btn ix-icon-btn-sm" title="Mute / Unmute Voice">
              <i class="fa-solid ${s.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
            </button>
            <button type="button" id="ixCmpDrawerExpand" class="ix-icon-btn ix-icon-btn-sm" title="Maximize to full page">
              <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
            </button>
            <button type="button" id="ixCmpDrawerMin" class="ix-icon-btn ix-icon-btn-sm" title="Minimize">
              <i class="fa-solid fa-minus"></i>
            </button>
            <button type="button" id="ixCmpDrawerClose" class="ix-icon-btn ix-icon-btn-sm" title="Close (Esc)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <div class="ix-cmp-drawer-body" id="ixCmpDrawerBody">
          <div style="text-align:center;">
            ${renderCompanionOrbHtml({ compact: true, orbId: 'ixCmpMiniOrb', eqId: 'ixCmpMiniEq' })}
            <div class="ix-cmp-status-line" style="margin-bottom:4px;">
              <span data-cmp-mini-status>${escapeHtml(s.statusLabel)}</span>
            </div>
          </div>
          <div id="ixCmpDrawerFeed" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>

        <footer class="ix-cmp-drawer-footer">
          <div style="display:flex; gap:6px; flex-wrap:wrap;" id="ixCmpDrawerQuickBar">
            <button type="button" class="ix-topic-pill" id="ixCmpDrawerBrief" style="padding:3px 9px;">Brief Report</button>
            <button type="button" id="ixCmpDrawerStopSpeak" class="ix-btn ix-btn-danger ix-btn-sm ${s.ttsState === 'idle' ? 'ix-hidden' : ''}">Stop Voice</button>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button
              type="button"
              id="ixCmpDrawerMic"
              class="ix-icon-btn ${s.isRecording ? 'ix-btn-danger' : ''}"
              title="Voice Input"
              ${s.micSupported ? '' : 'disabled'}
            >
              <i class="fa-solid ${s.isRecording ? 'fa-microphone-slash' : 'fa-microphone'}"></i>
            </button>
            <input
              type="text"
              id="ixCmpDrawerInput"
              class="ix-input"
              style="height:34px; font-size:var(--text-xs);"
              placeholder="Ask InquireX anything..."
              value="${escapeHtml(s.draftText)}"
            />
            <button type="button" id="ixCmpDrawerSend" class="ix-btn ix-btn-primary ix-btn-sm" style="height:34px;">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </footer>
      </section>
    `;

    this.orbCtrl = new AICompanionOrbController(this.root.querySelector('#ixCmpDrawerBody'), {
      orbSelector: '#ixCmpMiniOrb',
      eqSelector: '#ixCmpMiniEq',
      statusSelector: '[data-cmp-mini-status]',
    });

    this.bindEvents();
    this.syncFeed();
  }

  bindEvents() {
    this.root.querySelector('#ixCmpFabBtn')?.addEventListener('click', () => companion.setFloatingOpen(true));
    this.root.querySelector('#ixCmpDrawerClose')?.addEventListener('click', () => companion.setFloatingOpen(false));
    this.root.querySelector('#ixCmpDrawerMin')?.addEventListener('click', () => {
      companion.setFloatingMinimized(!companion.state.floatingMinimized);
    });
    this.root.querySelector('#ixCmpDrawerExpand')?.addEventListener('click', () => {
      companion.setFloatingOpen(false);
      this.onOpenFullPage?.();
    });
    this.root.querySelector('#ixCmpDrawerMute')?.addEventListener('click', () => companion.setMuted(!companion.state.muted));
    this.root.querySelector('#ixCmpDrawerBrief')?.addEventListener('click', () => companion.briefActiveReport());
    this.root.querySelector('#ixCmpDrawerStopSpeak')?.addEventListener('click', () => companion.stopAudio());
    this.root.querySelector('#ixCmpMiniOrb')?.addEventListener('click', () => companion.toggleMicrophone());
    this.root.querySelector('#ixCmpDrawerMic')?.addEventListener('click', () => companion.toggleMicrophone());

    const inputEl = this.root.querySelector('#ixCmpDrawerInput');
    const submit = () => {
      const val = (inputEl?.value || '').trim();
      if (!val) return;
      companion.sendMessage(val);
      if (inputEl) inputEl.value = '';
    };
    this.root.querySelector('#ixCmpDrawerSend')?.addEventListener('click', submit);
    inputEl?.addEventListener('input', () => companion.setDraftText(inputEl.value));
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }

  syncFeed() {
    const feed = this.root?.querySelector('#ixCmpDrawerFeed');
    if (!feed) return;
    const s = companion.state;
    const recent = s.messages.slice(-8);

    let html = recent
      .map((m) => {
        const isUser = m.role === 'user';
        return `
          <div class="ix-chat-bubble ${isUser ? 'user' : 'assistant'}">
            <div style="font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:2px;">
              ${isUser ? 'You' : 'AI Companion'}
            </div>
            <div>${isUser ? escapeHtml(m.content) : markdownToHtml(m.content)}</div>
            ${
              Array.isArray(m.actions) && m.actions.length > 0
                ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                     ${m.actions
                       .map(
                         (a) =>
                           `<button type="button" class="ix-btn ix-btn-primary ix-btn-sm" data-mini-action='${escapeHtml(
                             JSON.stringify(a)
                           )}'>${escapeHtml(a.label || 'Open')}</button>`
                       )
                       .join('')}
                   </div>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    if (s.isStreaming) {
      html += `
        <div class="ix-chat-bubble assistant" id="ixCmpMiniStreamBubble">
          <div style="font-size:11px; font-weight:600; color:var(--accent-primary); margin-bottom:2px;">AI Companion</div>
          <div id="ixCmpMiniStreamBody">${markdownToHtml(s.streamingText || '')}<span class="ix-cmp-cursor"></span></div>
        </div>
      `;
    }

    if (!html) {
      html = `<p class="ix-help" style="text-align:center; margin:8px 0;">Tap the orb or ask anything about your research workspace.</p>`;
    }

    feed.innerHTML = html;
    feed.querySelectorAll('[data-mini-action]').forEach((b) => {
      b.addEventListener('click', () => {
        try {
          companion.executeWorkspaceAction(JSON.parse(b.getAttribute('data-mini-action') || '{}'));
        } catch {}
      });
    });

    const body = this.root?.querySelector('#ixCmpDrawerBody');
    if (body) body.scrollTop = body.scrollHeight;
  }

  syncUI(reason) {
    if (!this.root) return;
    const s = companion.state;
    const fab = this.root.querySelector('#ixCmpFabBtn');
    const drawer = this.root.querySelector('#ixCmpDrawer');
    fab?.classList.toggle('ix-hidden', s.floatingOpen);
    drawer?.classList.toggle('ix-hidden', !s.floatingOpen);
    drawer?.classList.toggle('minimized', s.floatingMinimized);

    this.orbCtrl?.setState(s.orbState, s.statusLabel);

    const micBtn = this.root.querySelector('#ixCmpDrawerMic');
    if (micBtn) {
      micBtn.className = `ix-icon-btn ${s.isRecording ? 'ix-btn-danger' : ''}`;
      micBtn.innerHTML = `<i class="fa-solid ${s.isRecording ? 'fa-microphone-slash' : 'fa-microphone'}"></i>`;
    }

    const muteBtn = this.root.querySelector('#ixCmpDrawerMute');
    if (muteBtn) {
      muteBtn.innerHTML = `<i class="fa-solid ${s.muted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>`;
    }
    this.root.querySelector('#ixCmpDrawerStopSpeak')?.classList.toggle('ix-hidden', s.ttsState === 'idle');

    if (reason === 'draft') {
      const inp = this.root.querySelector('#ixCmpDrawerInput');
      if (inp && inp.value !== s.draftText) inp.value = s.draftText;
    }

    if (reason === 'stream-token') {
      const streamBody = this.root.querySelector('#ixCmpMiniStreamBody');
      if (streamBody) {
        streamBody.innerHTML = `${markdownToHtml(s.streamingText || '')}<span class="ix-cmp-cursor"></span>`;
        const body = this.root.querySelector('#ixCmpDrawerBody');
        if (body) body.scrollTop = body.scrollHeight;
      } else {
        this.syncFeed();
      }
    } else if (['stream-start', 'stream-end', 'clear', 'floating'].includes(reason)) {
      this.syncFeed();
    }
  }

  dispose() {
    this.unsubState?.();
    this.unsubAmp?.();
    document.removeEventListener('keydown', this.onKey);
    this.root?.remove();
    this.root = null;
  }
}
