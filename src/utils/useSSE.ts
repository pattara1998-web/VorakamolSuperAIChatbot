import { useEffect, useRef, useState } from 'react';

interface SSEOptions {
  pageId?: string;
  enabled?: boolean;
  onMessage?: (event: string, data: any) => void;
  onNewMessage?: (data: { page_id: string; sender_id: string; role: string; text: string; timestamp: string }) => void;
  onButtonsUpdated?: (data: { page_id: string; buttons: any[] }) => void;
  onConnectionChanged?: (data: { page_id: string; is_connected: boolean }) => void;
  onDataUpdated?: (data: { collection: string }) => void;
}

/**
 * useSSE — Real-time Server-Sent Events hook (upgraded version).
 *
 * Improvements over the previous version:
 * - Callbacks are stored in refs so changing handlers never tears down /
 *   reconnects the EventSource (prevents reconnect loops).
 * - Reconnect only on error, with a 3-second backoff.
 * - Cleanup clears timers and closes the socket on unmount.
 */
export function useSSE(options: SSEOptions) {
  const { pageId, enabled = true } = options;
  const [connected, setConnected] = useState(false);

  // Keep latest callbacks in refs — avoids re-subscribing on every render
  const handlersRef = useRef<SSEOptions>(options);
  handlersRef.current = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectDelayRef = useRef(1500);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;

    if (typeof window === 'undefined' || !enabled) return;

    const connect = () => {
      if (disposedRef.current) return;

      // Close any previous socket before opening a new one
      eventSourceRef.current?.close();

      const url = pageId ? `/api/events?page_id=${encodeURIComponent(pageId)}` : '/api/events';
      const es = new EventSource(url);
      eventSourceRef.current = es;

      const safeParse = (e: MessageEvent): any => {
        try {
          return JSON.parse(e.data);
        } catch {
          return null;
        }
      };

      es.addEventListener('connected', (e: MessageEvent) => {
        setConnected(true);
        reconnectDelayRef.current = 1500; // healthy again -> reset backoff
        const data = safeParse(e);
        if (data) console.log('[SSE] Connected:', data.clientId);
      });

      es.onopen = () => setConnected(true);

      es.addEventListener('new_message', (e: MessageEvent) => {
        const data = safeParse(e);
        if (!data) return;
        const h = handlersRef.current;
        if (!h) return;
        h.onNewMessage?.(data);
        h.onMessage?.('new_message', data);
      });

      es.addEventListener('buttons_updated', (e: MessageEvent) => {
        const data = safeParse(e);
        if (!data) return;
        const h = handlersRef.current;
        if (!h) return;
        h.onButtonsUpdated?.(data);
        h.onMessage?.('buttons_updated', data);
      });

      es.addEventListener('connection_changed', (e: MessageEvent) => {
        const data = safeParse(e);
        if (!data) return;
        const h = handlersRef.current;
        if (!h) return;
        h.onConnectionChanged?.(data);
        h.onMessage?.('connection_changed', data);
      });

      es.addEventListener('data_updated', (e: MessageEvent) => {
        const data = safeParse(e);
        if (!data) return;
        const h = handlersRef.current;
        if (!h) return;
        h.onDataUpdated?.(data);
        h.onMessage?.('data_updated', data);
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!disposedRef.current) {
          // Auto-reconnect with backoff: quick first (1.5s), then up to 15s —
          // a dropped proxy connection recovers instantly without spam.
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 15000);
          reconnectTimerRef.current = setTimeout(connect, reconnectDelayRef.current);
        }
      };
    };

    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, [pageId, enabled]);

  return { connected };
}
