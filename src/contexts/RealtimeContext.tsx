import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getInMemoryToken } from '../lib/api';
import { useAuth } from './AuthContext';

interface RealtimeContextValue {
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  reconnect: () => undefined,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { profile, refreshSession } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const connect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = getInMemoryToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws${qs}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const wasReconnect = retryRef.current > 0;
      retryRef.current = 0;
      if (wasReconnect) {
        queryClient.invalidateQueries({ queryKey: ['home'] });
        queryClient.invalidateQueries({ queryKey: ['questions'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['one-voice'] });
        queryClient.invalidateQueries({ queryKey: ['saved'] });
        queryClient.invalidateQueries({ queryKey: ['drafts'] });
        queryClient.invalidateQueries({ queryKey: ['my-questions'] });
        queryClient.invalidateQueries({ queryKey: ['my-answers'] });
        queryClient.invalidateQueries({ queryKey: ['my-received'] });
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string;
          payload?: { questionId?: string; scope?: string };
        };

        switch (msg.type) {
          case 'question:created':
          case 'question:updated':
          case 'question:deleted':
            queryClient.invalidateQueries({ queryKey: ['home'] });
            queryClient.invalidateQueries({ queryKey: ['questions'] });
            queryClient.invalidateQueries({ queryKey: ['my-questions'] });
            queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
            if (msg.payload?.questionId) {
              queryClient.invalidateQueries({
                queryKey: ['question', msg.payload.questionId],
              });
            }
            break;
          case 'answer:created':
          case 'answer:updated':
          case 'answer:deleted':
          case 'reaction:updated':
            queryClient.invalidateQueries({ queryKey: ['home'] });
            queryClient.invalidateQueries({ queryKey: ['questions'] });
            queryClient.invalidateQueries({ queryKey: ['my-answers'] });
            queryClient.invalidateQueries({ queryKey: ['my-received'] });
            queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
            if (msg.payload?.questionId) {
              queryClient.invalidateQueries({
                queryKey: ['question', msg.payload.questionId],
              });
            }
            break;
          case 'notification:new':
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            break;
          case 'one_voice:updated':
            queryClient.invalidateQueries({ queryKey: ['one-voice'] });
            break;
          case 'user:synced':
            if (msg.payload?.scope === 'saved') {
              queryClient.invalidateQueries({ queryKey: ['saved'] });
              queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
            } else if (msg.payload?.scope === 'drafts') {
              queryClient.invalidateQueries({ queryKey: ['drafts'] });
            } else if (msg.payload?.scope === 'profile') {
              void refreshSession();
            }
            break;
        }
      } catch {
        // Ignore malformed packets
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      const delay = Math.min(15000, 1000 * Math.pow(2, retryRef.current));
      retryRef.current += 1;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  useEffect(() => {
    connect();

    const onOnline = () => {
      connect();
      queryClient.invalidateQueries();
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('online', onOnline);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const token = getInMemoryToken();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (profile && token) {
        wsRef.current.send(JSON.stringify({ type: 'auth', token }));
      } else if (!profile) {
        wsRef.current.send(JSON.stringify({ type: 'logout' }));
      }
    }
  }, [profile]);

  return (
    <RealtimeContext.Provider value={{ reconnect: connect }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
