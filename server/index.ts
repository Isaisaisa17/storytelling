import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { Rooms, type Peer } from './rooms.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(express.static(resolve('dist/client')));
  app.get('/', (_req, res) => res.sendFile(resolve('dist/client/index.html')));
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const rooms = new Rooms();
  server.on('upgrade', (req, socket, head) => {
    // Browsers must use the same host, including when TLS terminates at a proxy.
    let sameOrigin = true;
    if (req.headers.origin) {
      try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch { sameOrigin = false; }
    }
    if (req.url !== '/ws' || !sameOrigin) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    const peer: Peer = { send(message) {
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; }
        ws.send(JSON.stringify(message));
      }
    } };
    let alive = true;
    let budget = 80;
    let last = Date.now();
    ws.on('pong', () => { alive = true; });
    const heartbeat = setInterval(() => {
      if (!alive) { ws.terminate(); return; }
      alive = false; ws.ping();
    }, 15000);
    ws.on('message', raw => {
      const now = Date.now();
      budget = Math.min(80, budget + (now - last) / 100); last = now;
      if (budget < 1) { peer.send({ type: 'error', code: 'RATE_LIMITED' }); return; }
      budget--;
      try { rooms.handle(peer, JSON.parse(raw.toString())); }
      catch { peer.send({ type: 'error', code: 'INVALID_MESSAGE' }); }
    });
    ws.on('error', () => ws.terminate());
    ws.on('close', () => { clearInterval(heartbeat); rooms.disconnect(peer); });
  });
  return { server, wss, rooms };
}

if (process.env.NODE_ENV !== 'test') {
  const { server, wss } = createApp();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => console.log(`Storytelling listening on ${port}`));
  const shutdown = () => { for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(() => process.exit(0)); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
