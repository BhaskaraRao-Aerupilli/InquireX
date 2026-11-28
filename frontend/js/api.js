/**
 * InquireX API & WebSocket Communication Layer
 * Strictly preserves existing FastAPI HTTP routes and /ws message contracts.
 */

export async function fetchCurrentUser() {
  const res = await fetch('/auth/me', { credentials: 'include' });
  if (res.status === 401) {
    return { unauthenticated: true, user: null };
  }
  if (!res.ok) {
    throw new Error(`Auth check failed (${res.status})`);
  }
  const user = await res.json();
  return { unauthenticated: false, user };
}

export async function fetchBackendReports() {
  const res = await fetch('/api/reports', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch reports (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.reports) ? data.reports : [];
}

export async function upsertBackendReport(reportPayload) {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(reportPayload),
  });
  if (!res.ok) throw new Error(`Failed to save report (${res.status})`);
  return res.json();
}

export async function deleteBackendReport(reportId) {
  const res = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete report (${res.status})`);
  }
  return true;
}

export async function fetchReportStorageStatus() {
  const res = await fetch('/api/reports/storage-status', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch storage status (${res.status})`);
  return res.json();
}

export async function migrateLocalReportsToSupabase() {
  const res = await fetch('/api/reports/migrate-local', {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Migration failed (${res.status})`);
  return data;
}

export async function fetchUploadedFiles() {
  const res = await fetch('/files/', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch files (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.files) ? data.files : [];
}

export async function uploadDocumentFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/upload/', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function deleteUploadedFile(filename) {
  const res = await fetch(`/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  return res.json();
}

export async function sendFollowUpChatHttp(reportText, messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      report: reportText,
      messages: messages,
    }),
  });
  if (!res.ok) throw new Error(`Chat request failed (${res.status})`);
  return res.json();
}

export async function fetchAgentDiscovery() {
  const res = await fetch('/.well-known/agent-discovery.json', { credentials: 'include' });
  if (!res.ok) throw new Error(`Agent discovery check failed (${res.status})`);
  return res.json();
}

export async function fetchAudioVoices() {
  const res = await fetch('/api/audio/voices', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch studio voices (${res.status})`);
  return res.json();
}

export async function generateAudioBriefing(payload, { signal } = {}) {
  const res = await fetch('/api/audio/briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Audio briefing failed (${res.status})`);
  }
  return data;
}

export async function checkPathExists(url) {
  if (!url || url === '#' || url.includes('undefined')) return false;
  try {
    const res = await fetch(url, { method: 'HEAD', credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Managed WebSocket Client for /ws
 * Preserves "start {json}", "stop", "chat {json}", and "ping" -> "pong".
 */
export class ResearchSocketClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.socket = null;
    this.isActiveTask = false;
    this.pendingStartPayload = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.stats = {
      state: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
      readyStateText: 'CLOSED',
      connectedAt: null,
      lastActivityAt: null,
      attempts: 0,
      messagesReceived: 0,
      lastError: null,
    };
  }

  _emitStats() {
    if (this.socket) {
      const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
      this.stats.readyStateText = states[this.socket.readyState] || 'UNKNOWN';
    } else {
      this.stats.readyStateText = 'CLOSED';
    }
    this.handlers.onStats?.({ ...this.stats });
  }

  _buildUri() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  connect(startPayload = null) {
    if (startPayload) {
      this.pendingStartPayload = startPayload;
      this.isActiveTask = true;
      this.reconnectAttempts = 0;
    }

    this._clearTimers();
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (startPayload && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(`start ${JSON.stringify(startPayload)}`);
        this.pendingStartPayload = null;
        return;
      }
      this.dispose(false);
    }

    this.stats.attempts += 1;
    this.stats.state = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
    this.stats.lastError = null;
    this._emitStats();

    try {
      this.socket = new WebSocket(this._buildUri());
    } catch (err) {
      this.stats.state = 'error';
      this.stats.lastError = err.message;
      this._emitStats();
      this.handlers.onError?.(err.message);
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.stats.state = 'connected';
      this.stats.connectedAt = Date.now();
      this.stats.lastActivityAt = Date.now();
      this.stats.lastError = null;
      this._emitStats();

      // Heartbeat ping every 25s
      this.heartbeatTimer = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          try {
            this.socket.send('ping');
          } catch {}
        }
      }, 25000);

      // Send pending start command once (never resend automatically on reconnect mid-run)
      if (this.pendingStartPayload) {
        const payload = this.pendingStartPayload;
        this.pendingStartPayload = null;
        this.socket.send(`start ${JSON.stringify(payload)}`);
      }

      this.handlers.onOpen?.();
    };

    this.socket.onmessage = (event) => {
      this.stats.lastActivityAt = Date.now();
      if (event.data === 'pong') {
        this._emitStats();
        return;
      }

      this.stats.messagesReceived += 1;
      this._emitStats();

      try {
        const parsed = JSON.parse(event.data);
        this.handlers.onMessage?.(parsed);
      } catch (err) {
        console.warn('Non-JSON WebSocket message received:', event.data);
      }
    };

    this.socket.onerror = () => {
      this.stats.state = 'error';
      this.stats.lastError = 'WebSocket transport error';
      this._emitStats();
      this.handlers.onError?.('Connection interrupted. Check server status.');
    };

    this.socket.onclose = (event) => {
      this._clearTimers();
      this.stats.connectedAt = null;

      if (this.isActiveTask && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts += 1;
        this.stats.state = 'reconnecting';
        this._emitStats();
        const delay = Math.min(10000, 1500 * this.reconnectAttempts);
        this.handlers.onReconnecting?.(this.reconnectAttempts, this.maxReconnectAttempts, delay);
        this.reconnectTimer = setTimeout(() => {
          if (this.isActiveTask) this.connect(null);
        }, delay);
      } else {
        this.stats.state = 'disconnected';
        this._emitStats();
        this.handlers.onClose?.(event, this.isActiveTask);
      }
    };
  }

  stopResearch() {
    this.isActiveTask = false;
    this.pendingStartPayload = null;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      try {
        this.socket.send('stop');
      } catch (e) {
        console.warn('Could not send stop command:', e);
      }
    }
    this._emitStats();
  }

  sendChat(payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(`chat ${JSON.stringify(payload)}`);
      return true;
    }
    return false;
  }

  markTaskFinished() {
    this.isActiveTask = false;
    this.pendingStartPayload = null;
  }

  _clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  dispose(clearActive = true) {
    if (clearActive) {
      this.isActiveTask = false;
      this.pendingStartPayload = null;
    }
    this._clearTimers();
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.stats.state = 'disconnected';
    this.stats.connectedAt = null;
    this._emitStats();
  }
}
