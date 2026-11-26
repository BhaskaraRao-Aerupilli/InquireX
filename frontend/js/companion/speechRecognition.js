/**
 * InquireX Speech Recognition & Microphone Volume Meter Service
 * Hybrid architecture:
 *  - When backend Whisper transcription (/api/companion/transcribe) is available and
 *    MediaRecorder is supported, records microphone audio with real-time AnalyserNode
 *    volume metering and smart silence endpointing — eliminating Chromium/WebView
 *    webkitSpeechRecognition "network" errors completely.
 *  - Falls back automatically to Web Speech API (SpeechRecognition) when backend
 *    transcription is unconfigured.
 * Automatically stops all mic tracks on end, permission denial, error, cap, or tab blur.
 */

import { transcribeCompanionAudio } from './companionApi.js';

export class SpeechRecognitionService {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.backendSttAvailable = false;
    this.recognition = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.volumeRaf = null;
    this.isRecording = false;
    this.safetyTimer = null;
    this.speechDetected = false;
    this.lastSpeechAt = 0;
    this.recordingStartedAt = 0;
    this._stopRequested = false;

    this._onVisibility = () => {
      if (document.hidden && this.isRecording) {
        this.stop('Background tab activated — microphone paused.');
      }
    };
  }

  setBackendSttAvailable(available) {
    this.backendSttAvailable = Boolean(available);
  }

  hasWebSpeech() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  hasMediaRecorder() {
    return Boolean(
      typeof window.MediaRecorder !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  isSupported() {
    return (this.backendSttAvailable && this.hasMediaRecorder()) || this.hasWebSpeech() || this.hasMediaRecorder();
  }

  async start() {
    if (this.isRecording) return true;

    if (!this.isSupported()) {
      this.handlers.onError?.(
        'unsupported',
        'Voice input is not supported in this browser. Type your question below instead.'
      );
      return false;
    }

    // Prefer MediaRecorder + Backend Whisper whenever MediaRecorder + backend STT are available
    if (this.backendSttAvailable && this.hasMediaRecorder()) {
      return this._startMediaRecorderFlow();
    }
    if (this.hasWebSpeech()) {
      return this._startWebSpeechFlow();
    }
    if (this.hasMediaRecorder()) {
      return this._startMediaRecorderFlow();
    }

    this.handlers.onError?.('unsupported', 'Microphone recording is unavailable in this browser.');
    return false;
  }

  async _acquireMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;
      return stream;
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      this.cleanupAudio();
      this.handlers.onError?.(
        denied ? 'permission-denied' : 'mic-error',
        denied
          ? 'Microphone permission was denied. Allow mic access in browser settings or type below.'
          : 'Could not access microphone device. Check your audio input and try again.'
      );
      return null;
    }
  }

  async _startMediaRecorderFlow() {
    const stream = await this._acquireMicrophone();
    if (!stream) return false;

    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const mimeType = preferredTypes.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';

    try {
      this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      this.cleanupAudio();
      this.handlers.onError?.('mic-error', 'Browser could not initialize audio recorder.');
      return false;
    }

    this.recordedChunks = [];
    this._stopRequested = false;
    this.speechDetected = false;
    this.recordingStartedAt = Date.now();
    this.lastSpeechAt = Date.now();

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.recordedChunks.push(ev.data);
      }
    };

    this.mediaRecorder.onerror = () => {
      this._teardown();
      this.handlers.onError?.('mic-error', 'Audio recording encountered a device error.');
    };

    this.mediaRecorder.onstop = async () => {
      const chunks = [...this.recordedChunks];
      const recMime = this.mediaRecorder?.mimeType || mimeType || 'audio/webm';
      const hadSpeech = this.speechDetected || chunks.reduce((s, b) => s + b.size, 0) > 2048;
      this.mediaRecorder = null;
      this._teardown();

      if (this._stopRequested === 'cancelled') {
        return;
      }

      if (!hadSpeech || chunks.length === 0) {
        this.handlers.onError?.('no-speech', 'No speech detected. Tap the microphone and try again.');
        return;
      }

      const blob = new Blob(chunks, { type: recMime });
      if (blob.size < 400) {
        this.handlers.onError?.('no-speech', 'Recording too short. Speak slightly longer or type your question.');
        return;
      }

      try {
        this.handlers.onTranscribing?.(true);
        const ext = recMime.includes('ogg') ? 'ogg' : recMime.includes('mp4') ? 'm4a' : 'webm';
        const res = await transcribeCompanionAudio(blob, `voice_query.${ext}`);
        this.handlers.onTranscribing?.(false);
        const text = (res?.text || '').trim();
        if (!text) {
          this.handlers.onError?.('no-speech', 'Could not hear clear words in that recording. Please try again.');
          return;
        }
        this.handlers.onTranscript?.(text, true);
        this.handlers.onComplete?.(text);
      } catch (err) {
        this.handlers.onTranscribing?.(false);
        this.handlers.onError?.('transcribe-failed', err?.message || 'Voice transcription failed.');
      }
    };

    this.isRecording = true;
    document.addEventListener('visibilitychange', this._onVisibility);
    this._startVolumeMeter(stream, { enableSilenceVad: true });
    this.mediaRecorder.start(250);
    this.handlers.onStateChange?.(true);

    this.safetyTimer = setTimeout(() => {
      if (this.isRecording) {
        this.stop('Maximum recording length reached — processing audio.');
      }
    }, 35000);

    return true;
  }

  async _startWebSpeechFlow() {
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await this._acquireMicrophone();
      if (!stream) return false;
      this._startVolumeMeter(stream, { enableSilenceVad: false });
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalTranscript = '';

    rec.onstart = () => {
      this.isRecording = true;
      document.addEventListener('visibilitychange', this._onVisibility);
      this.handlers.onStateChange?.(true);
      this.safetyTimer = setTimeout(() => {
        if (this.isRecording) {
          this.stop('Maximum single recording duration reached.');
        }
      }, 35000);
    };

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript || '';
        if (res.isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + text.trim();
        } else {
          interim += text;
        }
      }
      const combined = `${finalTranscript}${interim ? (finalTranscript ? ' ' : '') + interim.trim() : ''}`.trim();
      this.handlers.onTranscript?.(combined, Boolean(finalTranscript && !interim));
    };

    rec.onerror = (event) => {
      const code = event?.error || 'unknown';
      const messages = {
        'not-allowed': 'Microphone permission denied. Please enable microphone access or use text input.',
        'service-not-allowed': 'Speech recognition service blocked by browser policy.',
        'audio-capture': 'No microphone detected. Check your hardware connection.',
        'no-speech': 'No speech was detected. Tap the microphone to try again.',
        network: 'Browser Web Speech service is unavailable in this environment.',
        aborted: '',
      };
      const friendly = messages[code] ?? `Voice input stopped (${code}).`;
      this._teardown();
      if (friendly) {
        this.handlers.onError?.(code, friendly);
      }
    };

    rec.onend = () => {
      const wasActive = this.isRecording;
      this._teardown();
      if (wasActive) {
        this.handlers.onComplete?.(finalTranscript.trim());
      }
    };

    this.recognition = rec;
    try {
      rec.start();
      return true;
    } catch {
      this._teardown();
      this.handlers.onError?.('start-failed', 'Could not start speech recognition.');
      return false;
    }
  }

  stop(reasonMessage = '', cancel = false) {
    if (cancel) {
      this._stopRequested = 'cancelled';
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    } else if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      try {
        rec.stop();
      } catch {}
      this._teardown();
    } else {
      this._teardown();
    }
    if (reasonMessage) {
      this.handlers.onNotice?.(reasonMessage);
    }
  }

  _startVolumeMeter(stream, { enableSilenceVad = false } = {}) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser || !this.isRecording) return;
        this.analyser.getByteTimeDomainData(dataArray);
        let sumSq = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const centered = (dataArray[i] - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const normalized = Math.min(1, rms * 4.2);
        this.handlers.onVolume?.(normalized);

        if (enableSilenceVad) {
          const now = Date.now();
          if (normalized >= 0.08) {
            this.speechDetected = true;
            this.lastSpeechAt = now;
          } else if (this.speechDetected && now - this.lastSpeechAt > 1700) {
            // Auto-endpoint cleanly after user pauses ~1.7s post-speech
            this.stop();
            return;
          } else if (!this.speechDetected && now - this.recordingStartedAt > 10000) {
            this.stop('No speech detected.');
            return;
          }
        }

        this.volumeRaf = requestAnimationFrame(tick);
      };
      this.volumeRaf = requestAnimationFrame(tick);
    } catch {
      // Ignore AudioContext fallback limitations gracefully
    }
  }

  cleanupAudio() {
    if (this.volumeRaf) {
      cancelAnimationFrame(this.volumeRaf);
      this.volumeRaf = null;
    }
    this.analyser = null;
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }
    this.handlers.onVolume?.(0);
  }

  _teardown() {
    const wasRecording = this.isRecording;
    this.isRecording = false;
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.cleanupAudio();
    if (wasRecording) {
      this.handlers.onStateChange?.(false);
    }
  }

  dispose() {
    this.stop('', true);
  }
}
