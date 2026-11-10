import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Action, Credentials, ServerMessage, Snapshot } from '../shared/protocol.js';
process.env.NODE_ENV = 'test';
const { createApp } = await import('../server/index.js');
async function start() {
  const app = createApp(); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const port = (app.server.address() as AddressInfo).port;
  return { ...app, url: `http://127.0.0.1:${port}`, wsUrl: `ws://127.0.0.1:${port}/ws`,
    async stop() { for (const ws of app.wss.clients) ws.terminate(); app.wss.close(); await new Promise<void>(resolve => app.server.close(() => resolve())); } };
}
async function client(url: string) {
  const ws = new WebSocket(url); const messages: ServerMessage[] = [];
  ws.on('message', raw => messages.push(JSON.parse(raw.toString()) as ServerMessage));
  await once(ws, 'open');
  async function wait(predicate: (m: ServerMessage) => boolean, from = 0) {
    const end = Date.now() + 3000;
    while (Date.now() < end) {
      const message = messages.slice(from).find(predicate); if (message) return message;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`Timed out waiting for message: ${JSON.stringify(messages)}`);
  }
  return { ws, messages, wait,
    async act(action: Action) {
      const from = messages.length; ws.send(JSON.stringify(action));
      return wait(m => m.type === 'state' || m.type === 'error' || m.type === 'removed' || m.type === 'left', from);
    },
    state() { return (messages.filter(m => m.type === 'state').at(-1) as { state: Snapshot }).state; },
    credentials() { return (messages.find(m => m.type === 'welcome') as { credentials: Credentials }).credentials; },
    async close() { ws.close(); await once(ws, 'close'); }
  };
}
test('HTTP health and real WebSocket voting, privacy, reconnect, reset, removal, isolation and server restart', async () => {
  const app = await start();
  try {
    const health = await fetch(`${app.url}/health`); assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: 'ok' });
    const a = await client(app.wsUrl); const b = await client(app.wsUrl); const other = await client(app.wsUrl);
    await a.act({ type: 'create', nickname: 'Alex' });
    await b.act({ type: 'join', room: a.state().room, nickname: 'Bea' });
    await other.act({ type: 'create', nickname: 'Other' });
    const roundId = a.state().roundId;
    await a.act({ type: 'vote', roundId, vote: 8 });
    await b.wait(m => m.type === 'state' && m.state.missing === 1);
    assert.equal(b.state().ownVote, null); assert.equal(b.state().result, null);
    assert.ok(b.state().participants.every(p => !('vote' in p) && !('hasVoted' in p)));
    await b.act({ type: 'vote', roundId, vote: 13 }); await a.act({ type: 'reveal', roundId });
    await b.wait(m => m.type === 'state' && m.state.revealed);
    assert.deepEqual(b.state().result, { kind: 'agreement', votes: [8, 13], mean: 10.5 });
    assert.equal(other.state().revealed, false);
    const credentials = b.credentials(); await b.close();
    await a.wait(m => m.type === 'state' && m.state.participants.some(p => p.nickname === 'Bea' && !p.connected));
    const resumed = await client(app.wsUrl); await resumed.act({ type: 'resume', ...credentials });
    assert.equal(resumed.state().ownVote, 13); assert.equal(resumed.state().revealed, true);
    await a.act({ type: 'reset', roundId }); await resumed.wait(m => m.type === 'state' && m.state.roundId !== roundId);
    assert.equal(resumed.state().missing, 2); assert.equal(resumed.state().ownVote, null);
    const stale = await resumed.act({ type: 'vote', roundId, vote: 20 }); assert.deepEqual(stale, { type: 'error', code: 'STALE_ROUND' });
    await a.act({ type: 'remove', participantId: resumed.state().selfId }); await resumed.wait(m => m.type === 'removed');
    assert.equal(a.state().missing, 1);
    await a.close(); await resumed.close(); await other.close();
    assert.equal(app.rooms.rooms.size, 2); // Disconnects preserve rooms.
    const fresh = await start();
    try {
      const c = await client(fresh.wsUrl); const response = await c.act({ type: 'resume', ...credentials });
      assert.deepEqual(response, { type: 'error', code: 'NOT_MEMBER' }); assert.equal(fresh.rooms.rooms.size, 0); await c.close();
    } finally { await fresh.stop(); }
  } finally { await app.stop(); }
});
test('invalid JSON is structured; foreign WebSocket browser origins are rejected', async () => {
  const app = await start();
  try {
    const c = await client(app.wsUrl); c.ws.send('{broken');
    assert.deepEqual(await c.wait(m => m.type === 'error'), { type: 'error', code: 'INVALID_MESSAGE' }); await c.close();
    const foreign = new WebSocket(app.wsUrl, { origin: 'https://unrelated.example' });
    await once(foreign, 'error'); assert.notEqual(foreign.readyState, WebSocket.OPEN);
  } finally { await app.stop(); }
});
