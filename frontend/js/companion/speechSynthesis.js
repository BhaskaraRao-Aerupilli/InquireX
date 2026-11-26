/**
 * InquireX Modular Text-to-Speech Service
 * Chunked browser SpeechSynthesis implementation with generation guards,
 * play/pause/resume/stop/replay controls, voice & speed selection,
 * and smooth boundary-synchronized cadence envelopes for the orb & equalizer.
 */

export function normalizeMarkdownForSpeech(rawText) {
  let text = String(rawText || '');
  // Replace code fences verbally instead of reading raw punctuation aloud
  text = text.replace(/```[\s\S]*?```/g, ' Please refer to the code snippet displayed below. ');
  text = text.replace(/`([^`]+)`/g, '$1');
  // Markdown links -> spoken label
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1');
  // Raw URLs -> skipped for natural audio clarity
  text = text.replace(/https?:\/\/[^\s)]+/gi, '');
  // Headings, emphasis, blockquotes, lists
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/[*_~>-]{1,3}/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function splitIntoSpeakableChunks(text, maxLen = 210) {
  const clean = normalizeMarkdownForSpeech(text);
  if (!clean) return [];

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxLen) {
        current = trimmed;
      } else {
        // Hard-wrap overly long clauses on word boundaries
        const words = trimmed.split(/\s+/);
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export class SpeechSynthesisService {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.state = 'idle'; // 'idle' | 'speaking' | 'paused'
    this.muted = false;
    this.rate = 1.04;
    this.voiceURI = '';
    this.lastText = '';
    this.lastMessageId = null;
    this.playbackGen = 0;
    this.energyLevel = 0;
    this.cadenceTimer = null;

    if (this.isSupported() && typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        this.handlers.onVoicesChanged?.(this.getVoices());
      });
    }
  }

  isSupported() {
    return typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  getVoices() {
    if (!this.isSupported()) return [];
    const list = window.speechSynthesis.getVoices() || [];
    // Prefer English/local voices sorted nicely while preserving full list
    return [...list].sort((a, b) => {
      const aEn = a.lang?.startsWith('en') ? 0 : 1;
      const bEn = b.lang?.startsWith('en') ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted && this.state !== 'idle') {
      this.stop();
    } else {
      this._emitState();
    }
  }

  setRate(rate) {
    this.rate = Math.max(0.75, Math.min(1.6, Number(rate) || 1.0));
  }

  setVoiceURI(uri) {
    this.voiceURI = String(uri || '');
  }

  speak(text, { messageId = null } = {}) {
    this.lastText = text || '';
    this.lastMessageId = messageId;

    if (this.muted || !this.isSupported()) {
      this._setState('idle');
      return false;
    }

    const chunks = splitIntoSpeakableChunks(text);
    if (chunks.length === 0) {
      this._setState('idle');
      return false;
    }

    // Cancel active audio cleanly before starting new utterance chain
    this.playbackGen += 1;
    const gen = this.playbackGen;
    window.speechSynthesis.cancel();

    this._setState('speaking');
    this._startCadenceLoop(gen);

    const voices = this.getVoices();
    const chosenVoice =
      voices.find((v) => v.voiceURI === this.voiceURI) ||
      voices.find((v) => v.default && v.lang?.startsWith('en')) ||
      voices.find((v) => v.lang?.startsWith('en')) ||
      null;

    const speakChunk = (idx) => {
      if (gen !== this.playbackGen || this.muted) return;
      if (idx >= chunks.length) {
        this._finish(gen);
        return;
      }

      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      utt.rate = this.rate;
      if (chosenVoice) utt.voice = chosenVoice;

      utt.onboundary = () => {
        if (gen !== this.playbackGen || this.state !== 'speaking') return;
        // Boost waveform energy synchronously on real word boundaries
        this.energyLevel = 0.52 + Math.random() * 0.43;
      };

      utt.onstart = () => {
        if (gen !== this.playbackGen) return;
        this.energyLevel = 0.65;
      };

      utt.onend = () => {
        if (gen !== this.playbackGen) return;
        speakChunk(idx + 1);
      };

      utt.onerror = () => {
        if (gen !== this.playbackGen) return;
        this._finish(gen);
      };

      window.speechSynthesis.speak(utt);
    };

    speakChunk(0);
    return true;
  }

  pause() {
    if (!this.isSupported() || this.state !== 'speaking') return;
    window.speechSynthesis.pause();
    this.energyLevel = 0;
    this.handlers.onAmplitude?.(0);
    this._setState('paused');
  }

  resume() {
    if (!this.isSupported() || this.state !== 'paused') return;
    window.speechSynthesis.resume();
    this._setState('speaking');
  }

  stop() {
    this.playbackGen += 1;
    this._stopCadenceLoop();
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this.energyLevel = 0;
    this.handlers.onAmplitude?.(0);
    this._setState('idle');
  }

  replay() {
    if (!this.lastText) return false;
    return this.speak(this.lastText, { messageId: this.lastMessageId });
  }

  _startCadenceLoop(gen) {
    this._stopCadenceLoop();
    this.cadenceTimer = setInterval(() => {
      if (gen !== this.playbackGen) {
        this._stopCadenceLoop();
        return;
      }
      if (this.state !== 'speaking') {
        this.energyLevel = 0;
        this.handlers.onAmplitude?.(0);
        return;
      }
      // Smoothly decay or subtly pulse while voice is actively outputting audio
      if (this.energyLevel < 0.25) {
        this.energyLevel = 0.3 + Math.random() * 0.25;
      } else {
        this.energyLevel = Math.max(0.18, this.energyLevel * 0.82);
      }
      this.handlers.onAmplitude?.(this.energyLevel);
    }, 65);
  }

  _stopCadenceLoop() {
    if (this.cadenceTimer) {
      clearInterval(this.cadenceTimer);
      this.cadenceTimer = null;
    }
  }

  _finish(gen) {
    if (gen !== this.playbackGen) return;
    this._stopCadenceLoop();
    this.energyLevel = 0;
    this.handlers.onAmplitude?.(0);
    this._setState('idle');
  }

  _setState(next) {
    this.state = next;
    this._emitState();
  }

  _emitState() {
    this.handlers.onStateChange?.({
      state: this.state,
      messageId: this.lastMessageId,
      muted: this.muted,
    });
  }

  dispose() {
    this.stop();
  }
}
