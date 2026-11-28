/**
 * InquireX Studio Audio Briefing Controller
 * Progressive multi-segment neural audio player:
 *  - Unlocks HTML5 <audio> synchronously inside user click gesture
 *  - Plays Part 0 immediately while pre-fetching Parts 1..N into memory Blobs
 *  - Supports gapless transitions, timeline scrubbing across parts, -15s/+15s skip,
 *    live playbackRate changes without restarting, and Web Speech fallback
 */

import { showToast } from './ui.js';
import { generateAudioBriefing } from './api.js';
import { splitIntoSpeakableChunks } from './companion/speechSynthesis.js';

export const DEFAULT_STUDIO_VOICES = [
  { id: 'en-US-AndrewNeural', label: 'Andrew (US · Executive Anchor)' },
  { id: 'en-US-AvaNeural', label: 'Ava (US · Clear Analyst)' },
  { id: 'en-US-AriaNeural', label: 'Aria (US · Broadcast Host)' },
  { id: 'en-US-GuyNeural', label: 'Guy (US · Editorial Narrator)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (UK · Executive Brief)' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK · Analytical)' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja (IN · Clear Studio)' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat (IN · Executive Brief)' },
  { id: 'gemini:Kore', label: 'Kore (Gemini Native Studio)' },
];

export function formatAudioTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function createSilentWavBlobUrl() {
  const buf = new ArrayBuffer(44 + 160);
  const v = new DataView(buf);
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + 160, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  writeStr(36, 'data');
  v.setUint32(40, 160, true);
  for (let i = 44; i < 44 + 160; i += 1) v.setUint8(i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class AudioBriefingController {
  constructor() {
    this.audio = null;
    this.status = 'idle'; // 'idle' | 'generating' | 'playing' | 'paused' | 'error'
    this.rate = 1.0;
    this.mode = 'executive';
    this.voice = 'en-US-AndrewNeural';
    this.voiceLabel = 'Andrew (US · Executive Anchor)';
    this.engine = '';
    this.title = '';
    this.script = '';
    this.wordCount = 0;
    this.currentTime = 0;
    this.duration = 0;
    this.audioUrl = null;
    this.downloadUrl = null;
    this.filename = 'inquirex_briefing.mp3';
    this.error = null;
    this.playbackNote = '';

    this._gen = 0;
    this._abortCtrl = null;
    this._silentUrl = null;
    this._partUrls = [];
    this._partDurations = [];
    this._partBlobs = new Map();
    this._partFetches = new Map();
    this._partIdx = 0;
    this._speechChunks = [];
    this._speechIdx = 0;
    this._fallbackTimer = null;
    this._listeners = new Set();
  }

  get isPlaying() {
    return this.status === 'playing';
  }

  subscribe(fn) {
    if (typeof fn === 'function') this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  getState() {
    return {
      status: this.status,
      isPlaying: this.isPlaying,
      rate: this.rate,
      mode: this.mode,
      voice: this.voice,
      voiceLabel: this.voiceLabel,
      engine: this.engine,
      title: this.title,
      script: this.script,
      wordCount: this.wordCount,
      currentTime: this.currentTime,
      duration: this.duration,
      audioUrl: this.audioUrl,
      downloadUrl: this.downloadUrl,
      filename: this.filename,
      error: this.error,
      playbackNote: this.playbackNote,
    };
  }

  _emit() {
    const snap = this.getState();
    this._listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch (err) {
        console.warn('AudioBriefing listener error:', err);
      }
    });
  }

  _revokeAllBlobUrls() {
    if (this._silentUrl) {
      try {
        URL.revokeObjectURL(this._silentUrl);
      } catch {}
      this._silentUrl = null;
    }
    this._partBlobs.forEach((blobUrl) => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    });
    this._partBlobs.clear();
    this._partFetches.clear();
  }

  _cleanupPlaybackOnly({ resetPosition = true } = {}) {
    if (this._abortCtrl) {
      try {
        this._abortCtrl.abort();
      } catch {}
      this._abortCtrl = null;
    }
    if (this._fallbackTimer) {
      clearInterval(this._fallbackTimer);
      this._fallbackTimer = null;
    }
    if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.onloadedmetadata = null;
        this.audio.ontimeupdate = null;
        this.audio.onended = null;
        this.audio.onerror = null;
        this.audio.removeAttribute('src');
        this.audio.load();
      } catch {}
      this.audio = null;
    }
    this._revokeAllBlobUrls();
    this._partUrls = [];
    this._partDurations = [];
    this._partIdx = 0;
    if (resetPosition) {
      this.currentTime = 0;
    }
  }

  _unlockGestureAudio() {
    if (typeof Audio === 'undefined') return;
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      this._silentUrl = createSilentWavBlobUrl();
      audio.src = this._silentUrl;
      audio.muted = true;
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          audio.pause();
          audio.muted = false;
        }).catch(() => {
          audio.muted = false;
        });
      } else {
        audio.muted = false;
      }
      this.audio = audio;
    } catch {
      this.audio = null;
    }
  }

  _sumArray(arr, endExclusive = arr.length) {
    let total = 0;
    for (let i = 0; i < endExclusive; i += 1) {
      total += Number(arr[i] || 0);
    }
    return total;
  }

  _recomputeDuration() {
    this.duration = Math.max(1, this._sumArray(this._partDurations));
  }

  async _fetchPartBlobUrl(idx, myGen, signal) {
    if (this._partBlobs.has(idx)) {
      return this._partBlobs.get(idx);
    }
    if (this._partFetches.has(idx)) {
      return this._partFetches.get(idx);
    }
    const url = this._partUrls[idx];
    if (!url) return null;

    const promise = (async () => {
      const res = await fetch(url, { credentials: 'include', signal });
      if (!res.ok) throw new Error(`Audio part ${idx} HTTP ${res.status}`);
      const blob = await res.blob();
      if (myGen !== this._gen || signal?.aborted) return null;
      const blobUrl = URL.createObjectURL(blob);
      this._partBlobs.set(idx, blobUrl);
      return blobUrl;
    })();

    this._partFetches.set(idx, promise);
    try {
      return await promise;
    } finally {
      this._partFetches.delete(idx);
    }
  }

  _prefetchNextPart(idx, myGen, signal) {
    const next = idx + 1;
    if (next < this._partUrls.length && !this._partBlobs.has(next) && !this._partFetches.has(next)) {
      this._fetchPartBlobUrl(next, myGen, signal).catch(() => {});
    }
  }

  async loadAndPlay({ reportId = '', title = '', content = '', mode = this.mode, voice = this.voice } = {}) {
    const myGen = ++this._gen;
    this._cleanupPlaybackOnly();

    // Synchronously capture browser user-gesture token before async fetch
    this._unlockGestureAudio();

    const ctrl = new AbortController();
    this._abortCtrl = ctrl;

    this.mode = mode || 'executive';
    this.voice = voice || 'en-US-AndrewNeural';
    this.title = title || 'Research Report';
    this.error = null;
    this.playbackNote = '';
    this.audioUrl = null;
    this.downloadUrl = null;
    this.engine = '';
    this.duration = 0;
    this.currentTime = 0;
    this.status = 'generating';
    this._emit();

    try {
      const meta = await generateAudioBriefing(
        {
          report_id: reportId,
          title: this.title,
          content,
          mode: this.mode,
          voice: this.voice,
        },
        { signal: ctrl.signal }
      );
      if (myGen !== this._gen || ctrl.signal.aborted) return;

      this.script = meta.script || '';
      this.wordCount = Number(meta.word_count || 0);
      this.voiceLabel = meta.voice_label || this.voice;
      this.engine = meta.engine || '';
      this.duration = Number(meta.estimated_seconds || 0);
      this.audioUrl = meta.audio_url || null;
      this.downloadUrl = meta.download_url || null;
      this.filename = meta.filename || 'inquirex_briefing.mp3';

      const parts = Array.isArray(meta.part_urls) && meta.part_urls.length > 0
        ? meta.part_urls
        : meta.audio_url
        ? [meta.audio_url]
        : [];

      if (meta.audio_available && parts.length > 0) {
        this._partUrls = parts;
        const weights = Array.isArray(meta.part_weights) && meta.part_weights.length === parts.length
          ? meta.part_weights
          : parts.map(() => 1);
        const totalWeight = Math.max(1, this._sumArray(weights));
        const est = Math.max(5, Number(meta.estimated_seconds || parts.length * 10));
        this._partDurations = weights.map((w) => Math.max(1.5, (Number(w) / totalWeight) * est));
        this._recomputeDuration();
        await this._playPart(0, 0, myGen, ctrl.signal, true);
      } else {
        this._startSpeechFallback(this.script, myGen);
      }
    } catch (err) {
      if (err?.name === 'AbortError' || myGen !== this._gen) return;
      this.error = err?.message || 'Unable to generate audio briefing.';
      const fallbackText = String(content || '').trim();
      if (fallbackText && typeof window.speechSynthesis !== 'undefined') {
        this.script = fallbackText.slice(0, 6000);
        this.wordCount = this.script.split(/\s+/).filter(Boolean).length;
        this.engine = 'browser_fallback';
        this.duration = Math.max(5, Math.round((this.wordCount / 150) * 60));
        this._startSpeechFallback(this.script, myGen);
        showToast('Using browser speech synthesis fallback for audio briefing.', 'info');
        return;
      }
      this.status = 'error';
      showToast(this.error, 'error');
      this._emit();
    }
  }

  async _playPart(idx, offsetSeconds, myGen, signal, shouldAutoplay = true) {
    if (myGen !== this._gen || signal?.aborted) return;
    if (idx < 0 || idx >= this._partUrls.length) return;

    this._partIdx = idx;
    this._prefetchNextPart(idx, myGen, signal);

    let srcUrl;
    try {
      srcUrl = await this._fetchPartBlobUrl(idx, myGen, signal);
    } catch (err) {
      if (err?.name === 'AbortError' || myGen !== this._gen) return;
      srcUrl = this._partUrls[idx];
    }
    if (!srcUrl || myGen !== this._gen || signal?.aborted) return;

    const audio = this.audio || new Audio();
    this.audio = audio;
    audio.muted = false;
    audio.preload = 'auto';
    audio.src = srcUrl;
    audio.playbackRate = this.rate;

    audio.onloadedmetadata = () => {
      if (myGen !== this._gen) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this._partDurations[idx] = audio.duration;
        this._recomputeDuration();
        if (offsetSeconds > 0 && offsetSeconds < audio.duration) {
          audio.currentTime = offsetSeconds;
        }
        this._emit();
      }
    };

    audio.ontimeupdate = () => {
      if (myGen !== this._gen || this._partIdx !== idx) return;
      const base = this._sumArray(this._partDurations, idx);
      this.currentTime = Math.min(this.duration, base + (audio.currentTime || 0));
      this._emit();
    };

    audio.onended = () => {
      if (myGen !== this._gen || this._partIdx !== idx) return;
      if (idx + 1 < this._partUrls.length) {
        this._playPart(idx + 1, 0, myGen, signal, true);
      } else {
        this.status = 'paused';
        this.currentTime = this.duration;
        this.playbackNote = 'Briefing finished — press Play to replay';
        this._emit();
      }
    };

    audio.onerror = () => {
      if (myGen !== this._gen) return;
      if (this.script && typeof window.speechSynthesis !== 'undefined') {
        this._startSpeechFallback(this.script, myGen);
      } else {
        this.status = 'error';
        this.error = 'Audio stream playback failed.';
        this._emit();
      }
    };

    if (!shouldAutoplay) {
      this.status = 'paused';
      this._emit();
      return;
    }

    try {
      await audio.play();
      if (myGen !== this._gen) {
        audio.pause();
        return;
      }
      this.playbackNote = '';
      this.status = 'playing';
      this._emit();
    } catch (err) {
      if (myGen !== this._gen) return;
      this.status = 'paused';
      this.playbackNote = 'Briefing ready — press Play to listen';
      this._emit();
      showToast('Audio briefing ready — press Play on the studio player.', 'info');
    }
  }

  _startSpeechFallback(text, myGen) {
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
      this.status = 'error';
      this.error = 'Speech playback is unsupported in this browser.';
      this._emit();
      return;
    }

    const chunks = splitIntoSpeakableChunks(text, 220);
    if (!chunks.length) {
      this.status = 'idle';
      this._emit();
      return;
    }

    this._speechChunks = chunks;
    this._speechIdx = 0;
    this.engine = 'browser_fallback';
    this.playbackNote = '';
    this.status = 'playing';
    this._emit();

    const voices = window.speechSynthesis.getVoices() || [];
    const chosenVoice =
      voices.find((v) => /natural|online|google/i.test(v.name || '') && v.lang?.startsWith('en')) ||
      voices.find((v) => v.lang?.startsWith('en')) ||
      null;

    if (this._fallbackTimer) clearInterval(this._fallbackTimer);
    this._fallbackTimer = setInterval(() => {
      if (myGen !== this._gen || this.status !== 'playing') return;
      const est = (this._speechIdx / Math.max(1, this._speechChunks.length)) * Math.max(1, this.duration);
      this.currentTime = Math.min(this.duration, Math.max(this.currentTime + 0.25 * this.rate, est));
      this._emit();
    }, 250);

    const speakNext = (idx) => {
      if (myGen !== this._gen) return;
      if (idx >= chunks.length) {
        this.stop();
        return;
      }
      this._speechIdx = idx;
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      utt.rate = this.rate;
      if (chosenVoice) utt.voice = chosenVoice;
      utt.onend = () => {
        if (myGen !== this._gen || this.status === 'paused' || this.status === 'idle') return;
        speakNext(idx + 1);
      };
      utt.onerror = () => {
        if (myGen !== this._gen) return;
        this.stop();
      };
      window.speechSynthesis.speak(utt);
    };

    speakNext(0);
  }

  togglePlayPause() {
    if (this.status === 'playing') {
      this.pause();
    } else if (this.status === 'paused') {
      this.resume();
    }
  }

  pause() {
    if (this.status !== 'playing') return;
    if (this.audio) {
      this.audio.pause();
    } else if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.pause();
    }
    this.playbackNote = '';
    this.status = 'paused';
    this._emit();
  }

  resume() {
    if (this.status !== 'paused') return;
    if (this.audio) {
      if (this.duration > 0 && this.currentTime >= this.duration - 0.2 && this._partUrls.length > 0) {
        this._playPart(0, 0, this._gen, this._abortCtrl?.signal, true);
        return;
      }
      this.audio.playbackRate = this.rate;
      this.audio.play().catch(() => {});
    } else if (typeof window.speechSynthesis !== 'undefined') {
      window.speechSynthesis.resume();
    }
    this.playbackNote = '';
    this.status = 'playing';
    this._emit();
  }

  seek(targetSeconds) {
    if (!this._partUrls.length) return;
    const clamped = Math.max(0, Math.min(this.duration || 0, Number(targetSeconds) || 0));
    let acc = 0;
    let targetIdx = this._partUrls.length - 1;
    let offset = 0;
    for (let i = 0; i < this._partUrls.length; i += 1) {
      const segDur = Number(this._partDurations[i] || 0);
      if (clamped <= acc + segDur || i === this._partUrls.length - 1) {
        targetIdx = i;
        offset = Math.max(0, Math.min(segDur, clamped - acc));
        break;
      }
      acc += segDur;
    }

    this.currentTime = clamped;
    if (targetIdx === this._partIdx && this.audio) {
      this.audio.currentTime = offset;
      this._emit();
    } else {
      const autoplay = this.status === 'playing';
      this._playPart(targetIdx, offset, this._gen, this._abortCtrl?.signal, autoplay);
    }
  }

  skip(deltaSeconds) {
    if (!this._partUrls.length) return;
    this.seek((this.currentTime || 0) + Number(deltaSeconds || 0));
  }

  setRate(rate) {
    this.rate = Math.max(0.75, Math.min(2.0, Number(rate) || 1.0));
    if (this.audio) {
      this.audio.playbackRate = this.rate;
    }
    this._emit();
  }

  stop() {
    this._gen += 1;
    this._cleanupPlaybackOnly({ resetPosition: true });
    this.playbackNote = '';
    this.status = 'idle';
    this._emit();
  }

  destroy() {
    this.stop();
    this._listeners.clear();
  }
}
