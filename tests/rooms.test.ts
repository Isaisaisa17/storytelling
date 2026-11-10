import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rooms, type Peer } from '../server/rooms.js';
import { CARDS, type Card, type Credentials, type ErrorCode, type ServerMessage, type Snapshot } from '../shared/protocol.js';

class Client implements Peer {
  credentials?: Credentials;
  messages: ServerMessage[] = [];
  constructor(readonly rooms: Rooms) {}
  send(message: ServerMessage) { this.messages.push(structuredClone(message)); }
  act(action: unknown) { this.rooms.handle(this, action); }
  get state(): Snapshot { return (this.messages.filter(m => m.type === 'state').at(-1) as { state: Snapshot }).state; }
  get error() { const m = this.messages.at(-1); return m?.type === 'error' ? m.code : undefined; }
  vote(vote: Card) { this.act({ type: 'vote', vote, roundId: this.state.roundId }); }
  reveal() { this.act({ type: 'reveal', roundId: this.state.roundId }); }
  reset() { this.act({ type: 'reset', roundId: this.state.roundId }); }
}
function setup() {
  const rooms = new Rooms(); const a = new Client(rooms); const b = new Client(rooms);
  a.act({ type: 'create', nickname: 'Alex' });
  b.act({ type: 'join', room: a.state.room, nickname: 'Bea' });
  return { rooms, a, b };
}
test('every pair uses deck positions for discussion threshold and correct means', () => {
  for (const low of CARDS) for (const high of CARDS) {
    const { a, b } = setup(); a.vote(low); b.vote(high); a.reveal();
    const result = a.state.result!;
    assert.equal(result.kind, Math.abs(CARDS.indexOf(low) - CARDS.indexOf(high)) >= 2 ? 'discussion' : 'agreement');
    if (result.kind === 'agreement') {
      assert.equal(result.mean, (low + high) / 2); assert.deepEqual(result.votes, [low, high].sort((a,b) => a-b));
      assert.ok(!JSON.stringify(result).includes('nickname'));
    } else assert.deepEqual(result.votes, [{ nickname: 'Alex', vote: low }, { nickname: 'Bea', vote: high }]);
  }
});
test('arithmetic mean rounds to at most two decimals', () => {
  const { rooms, a, b } = setup(); const c = new Client(rooms);
  c.act({ type: 'join', room: a.state.room, nickname: 'Chris' });
  a.vote(3); b.vote(3); c.vote(5); c.reveal();
  assert.equal(a.state.result?.kind, 'agreement');
  assert.equal((a.state.result as { mean: number }).mean, 3.67);
});
test('snapshots do not expose others’ votes, credentials or individual voting flags', () => {
  const { a, b } = setup(); a.vote(20);
  assert.equal(b.state.ownVote, null); assert.equal(b.state.missing, 1); assert.equal(b.state.result, null);
  assert.deepEqual(Object.keys(b.state.participants[0]).sort(), ['connected', 'id', 'nickname', 'waiting']);
  assert.deepEqual(Object.keys(b.state).sort(), ['room', 'roundId', 'selfId', 'participants', 'missing', 'ownVote', 'revealed', 'result'].sort());
  assert.ok(!JSON.stringify(b.state).includes('token'));
  b.reveal(); assert.equal(b.error, 'VOTES_MISSING');
  a.vote(3); assert.equal(a.state.ownVote, 3); assert.equal(b.state.ownVote, null);
  b.vote(5); b.reveal(); assert.equal(a.state.revealed, true);
  a.vote(8); assert.equal(a.error, 'ROUND_REVEALED'); assert.equal(a.state.ownVote, 3);
});
test('case insensitive unique normalized nicknames and input validation', () => {
  const { rooms, a } = setup(); const c = new Client(rooms);
  c.act({ type: 'join', room: a.state.room, nickname: '  ALEX  ' }); assert.equal(c.error, 'NICKNAME_TAKEN');
  c.act({ type: 'join', room: a.state.room, nickname: 'Ａｌｅｘ' }); assert.equal(c.error, 'NICKNAME_TAKEN');
  for (const nickname of ['', 'x'.repeat(33), '\n', 'Hi\u0000']) { c.act({ type: 'create', nickname }); assert.equal(c.error, 'INVALID_NICKNAME'); }
  for (const value of [null, [], 5, {}, { type: 'unknown' }]) { c.act(value); assert.ok(c.error); }
  c.act({ type: 'join', nickname: 'New', room: '../bad' }); assert.equal(c.error, 'INVALID_ROOM');
  c.act({ type: 'join', nickname: 'New', room: 'missing-room-name' }); assert.equal(c.error, 'ROOM_NOT_FOUND');
  assert.equal(rooms.rooms.size, 1);
});
test('unrevealed arrivals count; revealed arrivals wait; reset admits everyone and rejects stale actions', () => {
  const { rooms, a, b } = setup(); a.vote(3); b.vote(5);
  const c = new Client(rooms); c.act({ type: 'join', room: a.state.room, nickname: 'Chris' });
  assert.equal(a.state.missing, 1); a.reveal(); assert.equal(a.error, 'VOTES_MISSING');
  c.vote(3); a.reveal();
  const d = new Client(rooms); d.act({ type: 'join', room: a.state.room, nickname: 'Dee' });
  assert.equal(d.state.participants.find(p => p.id === d.state.selfId)?.waiting, true);
  assert.equal(d.state.missing, 0); d.vote(20); assert.equal(d.error, 'ROUND_REVEALED');
  const previousRound = a.state.roundId; d.reset();
  assert.equal(a.state.revealed, false); assert.equal(a.state.result, null); assert.equal(a.state.missing, 4);
  assert.ok(a.state.participants.every(p => !p.waiting)); assert.equal(a.state.ownVote, null);
  a.act({ type: 'vote', roundId: previousRound, vote: 20 }); assert.equal(a.error, 'STALE_ROUND');
  a.act({ type: 'reset', roundId: previousRound }); assert.equal(a.error, 'STALE_ROUND');
  assert.equal(a.state.missing, 4);
});
test('disconnect preserves votes, blocks reveal for absent nonvoters, and credentials resume across connections', () => {
  const { rooms, a, b } = setup(); a.vote(8);
  const ac = { ...a.credentials! }; const bc = { ...b.credentials! };
  rooms.disconnect(a); rooms.disconnect(b);
  const resumed = new Client(rooms); resumed.act({ type: 'resume', ...ac });
  assert.equal(resumed.state.ownVote, 8); assert.equal(resumed.state.missing, 1);
  assert.equal(resumed.state.participants.find(p => p.nickname === 'Bea')?.connected, false);
  resumed.reveal(); assert.equal(resumed.error, 'VOTES_MISSING');
  const b2 = new Client(rooms); b2.act({ type: 'resume', ...bc }); b2.vote(13); resumed.reveal();
  const tab = new Client(rooms); tab.act({ type: 'resume', ...ac }); assert.equal(tab.state.ownVote, 8); assert.equal(tab.state.revealed, true);
  rooms.disconnect(resumed); assert.equal(tab.state.participants.find(p => p.nickname === 'Alex')?.connected, true);
});
test('membership checked for every action; forged and removed credentials rejected', () => {
  const { rooms, a, b } = setup(); const spy = new Client(rooms);
  spy.act({ type: 'resume', ...a.credentials, token: 'x'.repeat(64) }); assert.equal(spy.error, 'NOT_MEMBER');
  spy.act({ type: 'vote', vote: 1, roundId: a.state.roundId }); assert.equal(spy.error, 'NOT_MEMBER');
  spy.credentials = a.credentials; spy.act({ type: 'reset', roundId: a.state.roundId }); assert.equal(spy.error, 'NOT_MEMBER');
  const old = { ...b.credentials! }; a.act({ type: 'remove', participantId: b.state.selfId });
  assert.equal(b.messages.at(-1)?.type, 'removed'); assert.equal(a.state.participants.length, 1);
  const replacement = new Client(rooms); replacement.act({ type: 'resume', ...old }); assert.equal(replacement.error, 'NOT_MEMBER');
});
test('removals delete votes and recompute revealed results; final leave deletes room', () => {
  const { rooms, a, b } = setup(); const c = new Client(rooms); c.act({ type: 'join', room: a.state.room, nickname: 'Chris' });
  a.vote(1); b.vote(20); c.vote(1); a.reveal(); assert.equal(a.state.result?.kind, 'discussion');
  a.act({ type: 'remove', participantId: b.state.selfId });
  assert.deepEqual(a.state.result, { kind: 'agreement', votes: [1, 1], mean: 1 });
  a.act({ type: 'remove', participantId: c.state.selfId });
  a.act({ type: 'leave' }); assert.equal(rooms.rooms.size, 0); assert.equal(a.messages.at(-1)?.type, 'left');
});
test('disconnected members can be removed and their outstanding votes stop counting', () => {
  const { rooms, a, b } = setup(); const id = b.state.selfId; rooms.disconnect(b); a.vote(5);
  a.act({ type: 'remove', participantId: id }); assert.equal(a.state.missing, 0); a.reveal(); assert.equal(a.state.revealed, true);
});
test('room isolation and generated names are unique', () => {
  const rooms = new Rooms(); const names = new Set<string>();
  for (let i = 0; i < 500; i++) { const c = new Client(rooms); c.act({ type: 'create', nickname: 'Same name' }); names.add(c.state.room); }
  assert.equal(names.size, 500);
  const { a, b } = setup(); const outsider = new Client(a.rooms); outsider.act({ type: 'create', nickname: 'Alex' });
  const count = b.messages.length; outsider.vote(20); assert.equal(b.messages.length, count);
  a.act({ type: 'remove', participantId: outsider.state.selfId }); assert.equal(a.error, 'PARTICIPANT_NOT_FOUND');
});
test('simultaneous votes, reveal, reset and stale votes execute in arrival order', async () => {
  const { a, b } = setup(); const roundId = a.state.roundId;
  await Promise.all([Promise.resolve().then(() => a.vote(3)), Promise.resolve().then(() => b.vote(5)), Promise.resolve().then(() => a.reveal())]);
  assert.deepEqual(a.state.result, { kind: 'agreement', votes: [3, 5], mean: 4 });
  await Promise.all([Promise.resolve().then(() => a.reset()), Promise.resolve().then(() => b.act({ type: 'vote', roundId, vote: 20 }))]);
  assert.equal(b.error, 'STALE_ROUND'); assert.equal(a.state.missing, 2); assert.equal(a.state.result, null);
});
test('invalid cards rejected without mutation', () => {
  const { a } = setup();
  for (const vote of [0, 4, 21, '5', null, {}, true]) {
    a.act({ type: 'vote', vote, roundId: a.state.roundId }); assert.equal(a.error, 'INVALID_VOTE' satisfies ErrorCode); assert.equal(a.state.ownVote, null);
  }
});
