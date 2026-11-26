/**
 * InquireX Animated AI Companion Orb Controller
 * Smoothly updates orb state transitions ('idle', 'listening', 'thinking', 'speaking', 'error'),
 * real-time audio amplitude scaling (--ix-mic-level / --ix-voice-level),
 * and equalizer bars with zero innerHTML teardown.
 */

import { escapeHtml } from '../ui.js';

const STATE_ICONS = {
  idle: 'fa-atom',
  listening: 'fa-microphone',
  thinking: 'fa-sparkles',
  speaking: 'fa-volume-high',
  error: 'fa-triangle-exclamation',
};

const STATE_LABELS = {
  idle: 'Ready — Ask anything or tap Mic',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Error occurred',
};

const EQ_HARMONICS = [0.42, 0.72, 0.95, 0.65, 1.0, 0.78, 0.88, 0.56, 0.92, 0.68, 0.82, 0.45];

export function renderCompanionOrbHtml({ compact = false, orbId = 'ixCmpOrb', eqId = 'ixCmpEq' } = {}) {
  return `
    <div class="ix-cmp-orb-wrap" ${compact ? 'style="width:96px; height:96px; margin:4px auto;"' : ''}>
      <button
        type="button"
        id="${escapeHtml(orbId)}"
        class="ix-cmp-orb ${compact ? 'compact' : ''} is-idle"
        aria-label="InquireX AI Companion Orb — Toggle Voice Input"
        title="Click to start or stop voice input"
      >
        <span class="ix-cmp-orb-halo" aria-hidden="true"></span>
        <span class="ix-cmp-orb-ring" aria-hidden="true"></span>
        <span class="ix-cmp-orb-ring-inner" aria-hidden="true"></span>
        <span class="ix-cmp-orb-waves" aria-hidden="true">
          <span class="ix-cmp-orb-wave w1"></span>
          <span class="ix-cmp-orb-wave w2"></span>
        </span>
        <span class="ix-cmp-orb-core">
          <span class="ix-cmp-orb-core-gradient" aria-hidden="true"></span>
          <i class="fa-solid fa-atom" data-orb-icon></i>
        </span>
      </button>
    </div>

    <div class="ix-cmp-equalizer" id="${escapeHtml(eqId)}" aria-hidden="true">
      ${EQ_HARMONICS.map(() => `<span class="ix-cmp-eq-bar"></span>`).join('')}
    </div>
  `;
}

export class AICompanionOrbController {
  constructor(rootEl, { orbSelector = '.ix-cmp-orb', eqSelector = '.ix-cmp-equalizer', statusSelector = '[data-cmp-status]' } = {}) {
    this.rootEl = rootEl;
    this.orbEl = rootEl?.querySelector(orbSelector) || null;
    this.eqEl = rootEl?.querySelector(eqSelector) || null;
    this.statusEl = rootEl?.querySelector(statusSelector) || null;
    this.iconEl = this.orbEl?.querySelector('[data-orb-icon]') || null;
    this.eqBars = this.eqEl ? Array.from(this.eqEl.querySelectorAll('.ix-cmp-eq-bar')) : [];
    this.currentState = 'idle';
  }

  setState(nextState, customStatusText = '') {
    const state = STATE_LABELS[nextState] ? nextState : 'idle';
    this.currentState = state;
    if (this.orbEl) {
      this.orbEl.classList.remove('is-idle', 'is-listening', 'is-thinking', 'is-speaking', 'is-error');
      this.orbEl.classList.add(`is-${state}`);
    }
    if (this.iconEl) {
      this.iconEl.className = `fa-solid ${STATE_ICONS[state] || 'fa-atom'}`;
    }
    if (this.eqEl) {
      this.eqEl.classList.toggle('active', state === 'listening' || state === 'speaking');
      if (state !== 'listening' && state !== 'speaking') {
        this.setAmplitude(0);
      }
    }
    if (this.statusEl) {
      this.statusEl.textContent = customStatusText || STATE_LABELS[state];
    }
  }

  setAmplitude(level) {
    const clamped = Math.max(0, Math.min(1, Number(level) || 0));
    if (this.orbEl) {
      if (this.currentState === 'listening') {
        this.orbEl.style.setProperty('--ix-mic-level', clamped.toFixed(3));
        this.orbEl.style.setProperty('--ix-voice-level', '0');
      } else if (this.currentState === 'speaking') {
        this.orbEl.style.setProperty('--ix-voice-level', clamped.toFixed(3));
        this.orbEl.style.setProperty('--ix-mic-level', '0');
      } else {
        this.orbEl.style.setProperty('--ix-mic-level', '0');
        this.orbEl.style.setProperty('--ix-voice-level', '0');
      }
    }

    if (this.eqBars.length) {
      this.eqBars.forEach((bar, i) => {
        if (clamped <= 0.02) {
          bar.style.height = '5px';
        } else {
          const mod = EQ_HARMONICS[i % EQ_HARMONICS.length];
          const jitter = 0.8 + ((Date.now() % 7) * 0.04);
          const px = Math.round(5 + clamped * mod * jitter * 18);
          bar.style.height = `${Math.min(24, px)}px`;
        }
      });
    }
  }
}
