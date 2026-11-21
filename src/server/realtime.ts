import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  parseCookies,
  resolveUserFromTokenOrCookie,
  SESSION_COOKIE_NAME,
} from './auth.ts';

interface ClientSocket {
  ws: WebSocket;
  userId?: string;
}

const clients = new Set<ClientSocket>();

export function setupRealtimeServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const client: ClientSocket = { ws };
    clients.add(client);

    try {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const tokenParam = url.searchParams.get('token') || undefined;
      const cookies = parseCookies(req.headers.cookie);
      const cookieToken = cookies[SESSION_COOKIE_NAME];
      const resolved = await resolveUserFromTokenOrCookie(tokenParam, cookieToken);
      if (resolved && resolved.profile.accountStatus === 'active') {
        client.userId = resolved.profile.id;
      }
    } catch {
      // Unauthenticated public listener
    }

    ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
        if (msg.type === 'auth' && typeof msg.token === 'string') {
          const resolved = await resolveUserFromTokenOrCookie(msg.token, undefined);
          if (resolved && resolved.profile.accountStatus === 'active') {
            client.userId = resolved.profile.id;
            ws.send(JSON.stringify({ type: 'authenticated' }));
          } else {
            client.userId = undefined;
          }
        } else if (msg.type === 'logout') {
          client.userId = undefined;
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(client);
    });

    ws.on('error', () => {
      clients.delete(client);
    });
  });
}

export function broadcastPublicEvent(type: string, payload: Record<string, unknown>): void {
  const message = JSON.stringify({ type, payload, ts: Date.now() });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function sendUserEvent(
  userId: string,
  type: string,
  payload: Record<string, unknown>
): void {
  const message = JSON.stringify({ type, payload, ts: Date.now() });
  for (const client of clients) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}
