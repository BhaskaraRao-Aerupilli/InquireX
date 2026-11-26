/**
 * InquireX AI Companion API Client
 * Connects cleanly to authenticated /api/companion/capabilities and /api/companion/stream SSE routes.
 */

export async function fetchCompanionCapabilities() {
  try {
    const res = await fetch('/api/companion/capabilities', { credentials: 'include' });
    if (!res.ok) {
      return {
        available: false,
        provider: 'unavailable',
        model: 'unavailable',
        web_search_enabled: false,
        default_history_limit: 10,
      };
    }
    return await res.json();
  } catch {
    return {
      available: false,
      provider: 'unreachable',
      model: 'unreachable',
      web_search_enabled: false,
      stt_backend_available: false,
      default_history_limit: 10,
    };
  }
}

export async function transcribeCompanionAudio(blob, filename = 'recording.webm') {
  const form = new FormData();
  form.append('file', blob, filename);

  const res = await fetch('/api/companion/transcribe', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    return { text: '' };
  }

  if (!res.ok) {
    let detail = `Transcription failed (${res.status})`;
    try {
      const errJson = await res.json();
      detail = errJson.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return await res.json();
}

export function createCompanionStreamRequest({
  message,
  history = [],
  mode = 'chat',
  detailLevel = 'concise',
  maxHistory = 10,
  workspaceContext = {},
  onStart,
  onToken,
  onAction,
  onSources,
  onDone,
  onError,
}) {
  const controller = new AbortController();
  let abortedByUser = false;

  const promise = (async () => {
    let response;
    try {
      response = await fetch('/api/companion/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          message,
          history,
          mode,
          detail_level: detailLevel,
          max_history: maxHistory,
          workspace_context: workspaceContext,
        }),
      });
    } catch (err) {
      if (err?.name === 'AbortError' || abortedByUser) {
        return { aborted: true };
      }
      onError?.('Network connection lost while contacting InquireX AI Companion.');
      return { aborted: false, error: true };
    }

    if (response.status === 401) {
      window.location.href = '/login';
      return { aborted: true };
    }

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const errJson = await response.json();
        detail = errJson.detail || detail;
      } catch {}
      onError?.(detail);
      return { aborted: false, error: true };
    }

    if (!response.body) {
      onError?.('Streaming is not supported in this browser environment.');
      return { aborted: false, error: true };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finishedDone = false;

    const handleFrame = (rawLine) => {
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith('data:')) return;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) return;

      let event;
      try {
        event = JSON.parse(jsonStr);
      } catch {
        return;
      }

      if (event.type === 'start') {
        onStart?.(event);
      } else if (event.type === 'token') {
        onToken?.(event.delta || '');
      } else if (event.type === 'action' && event.action) {
        onAction?.(event.action);
      } else if (event.type === 'sources' && Array.isArray(event.sources)) {
        onSources?.(event.sources);
      } else if (event.type === 'error') {
        finishedDone = true;
        onError?.(event.detail || 'Companion generation failed.');
      } else if (event.type === 'done') {
        finishedDone = true;
        onDone?.(event);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          handleFrame(line);
        }
      }
      if (buffer.trim()) {
        handleFrame(buffer);
      }
      if (!finishedDone && !abortedByUser) {
        onDone?.({ content: '', actions: [], sources: [] });
      }
    } catch (err) {
      if (err?.name === 'AbortError' || abortedByUser) {
        return { aborted: true };
      }
      onError?.('Stream interrupted before completion. Please retry.');
      return { aborted: false, error: true };
    }

    return { aborted: false, error: false };
  })();

  return {
    promise,
    abort() {
      abortedByUser = true;
      try {
        controller.abort();
      } catch {}
    },
  };
}
