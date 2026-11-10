import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { CARDS, type Action, type Card, type Credentials, type ErrorCode, type Result, type ServerMessage, type Snapshot } from '../shared/protocol.js';

type Member = { id: string; nickname: string; token: string; vote: Card | null; waiting: boolean; peers: Set<Peer> };
type Room = { name: string; roundId: string; members: Map<string, Member>; revealed: boolean; result: Result | null };
export interface Peer { send(message: ServerMessage): void; credentials?: Credentials }
class RoomError extends Error { constructor(public code: ErrorCode) { super(code); } }
const fail = (code: ErrorCode): never => { throw new RoomError(code); };
const words = [
  ['happy', 'quiet', 'bright', 'brave', 'gentle', 'sunny', 'clever', 'calm', 'kind', 'swift', 'lucky', 'cosy', 'merry', 'bold', 'jolly', 'warm'],
  ['otter', 'fox', 'panda', 'owl', 'badger', 'robin', 'tiger', 'koala', 'lynx', 'whale', 'finch', 'bear', 'hare', 'seal', 'deer', 'yak'],
  ['maple', 'cedar', 'river', 'meadow', 'willow', 'birch', 'ocean', 'fern', 'pine', 'grove', 'hill', 'lake', 'moss', 'brook', 'elm', 'oak'],
];
export class Rooms {
  readonly rooms = new Map<string, Room>();
  private name(): string {
    for (let attempt = 0; ; attempt++) {
      const base = words.map(list => list[randomInt(list.length)]).join('-');
      const name = attempt < 32 ? base : `${base}-${randomBytes(4).toString('hex')}`;
      if (!this.rooms.has(name)) return name;
    }
  }
  private nickname(value: unknown) {
    if (typeof value !== 'string') return fail('INVALID_NICKNAME');
    const name = value.trim().normalize('NFKC');
    if (!name || name.length > 32 || /[\p{Cc}\p{Cf}]/u.test(name)) return fail('INVALID_NICKNAME');
    return name;
  }
  private membership(peer: Peer): [Room, Member] {
    const c = peer.credentials;
    const room = c && this.rooms.get(c.room);
    const member = room && room.members.get(c!.participantId);
    if (!room || !member || member.token !== c!.token || !member.peers.has(peer)) return fail('NOT_MEMBER');
    return [room, member];
  }
  snapshot(room: Room, member: Member): Snapshot {
    return { room: room.name, roundId: room.roundId, selfId: member.id,
      participants: [...room.members.values()].map(m => ({ id: m.id, nickname: m.nickname, connected: m.peers.size > 0, waiting: m.waiting })),
      missing: [...room.members.values()].filter(m => !m.waiting && m.vote === null).length,
      ownVote: member.vote, revealed: room.revealed, result: room.result };
  }
  private broadcast(room: Room) {
    for (const member of room.members.values()) for (const peer of member.peers) peer.send({ type: 'state', state: this.snapshot(room, member) });
  }
  disconnect(peer: Peer) {
    if (!peer.credentials) return;
    const room = this.rooms.get(peer.credentials.room);
    room?.members.get(peer.credentials.participantId)?.peers.delete(peer);
    peer.credentials = undefined;
    if (room) this.broadcast(room);
  }
  private remove(room: Room, member: Member, type: 'left' | 'removed') {
    for (const peer of member.peers) { peer.credentials = undefined; peer.send({ type }); }
    room.members.delete(member.id);
    // A revealed result is immutable for the round, except removed votes must disappear.
    if (room.revealed) room.result = this.result(room);
    if (room.members.size === 0) this.rooms.delete(room.name);
    else this.broadcast(room);
  }
  private result(room: Room): Result {
    const entries = [...room.members.values()].filter(m => !m.waiting && m.vote !== null);
    const votes = entries.map(m => m.vote!);
    const indices = votes.map(v => CARDS.indexOf(v));
    if (votes.length && Math.max(...indices) - Math.min(...indices) >= 2)
      return { kind: 'discussion', votes: entries.map(m => ({ nickname: m.nickname, vote: m.vote! })) };
    return { kind: 'agreement', votes: votes.sort((a, b) => a - b), mean: votes.length ? Math.round(votes.reduce((a, b) => a + b, 0) / votes.length * 100) / 100 : 0 };
  }
  // All actions execute synchronously in one Node event loop: no await between validation and mutation.
  handle(peer: Peer, input: unknown) {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('INVALID_MESSAGE');
      const action = input as Action;
      if (['create', 'join', 'resume'].includes(action.type)) {
        if (peer.credentials) return fail('INVALID_MESSAGE');
        if (action.type === 'resume') {
          if (typeof action.room !== 'string' || typeof action.participantId !== 'string' || typeof action.token !== 'string' || !/^[a-f0-9]{64}$/.test(action.token)) return fail('NOT_MEMBER');
          const room = this.rooms.get(action.room);
          const member = room?.members.get(action.participantId);
          if (!room || !member || action.token.length !== member.token.length || !timingSafeEqual(Buffer.from(action.token), Buffer.from(member.token))) return fail('NOT_MEMBER');
          peer.credentials = { room: room.name, participantId: member.id, token: member.token };
          member.peers.add(peer);
          peer.send({ type: 'welcome', credentials: peer.credentials });
          this.broadcast(room); return;
        }
        if (action.type !== 'create' && action.type !== 'join') return fail('INVALID_MESSAGE');
        const nickname = this.nickname(action.nickname);
        let room: Room;
        if (action.type === 'create') {
          room = { name: this.name(), roundId: randomUUID(), members: new Map(), revealed: false, result: null };
          this.rooms.set(room.name, room);
        } else {
          if (typeof action.room !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+){2,3}$/.test(action.room)) return fail('INVALID_ROOM');
          const found = this.rooms.get(action.room);
          if (!found) return fail('ROOM_NOT_FOUND');
          room = found;
        }
        if ([...room.members.values()].some(m => m.nickname.toLowerCase() === nickname.toLowerCase())) return fail('NICKNAME_TAKEN');
        const member: Member = { id: randomUUID(), token: randomBytes(32).toString('hex'), nickname, vote: null, waiting: room.revealed, peers: new Set([peer]) };
        room.members.set(member.id, member);
        peer.credentials = { room: room.name, participantId: member.id, token: member.token };
        peer.send({ type: 'welcome', credentials: peer.credentials });
        this.broadcast(room); return;
      }
      const [room, member] = this.membership(peer);
      switch (action.type) {
        case 'vote':
        case 'reveal':
        case 'reset': {
          if (action.roundId !== room.roundId) return fail('STALE_ROUND');
          if (action.type === 'reset') {
            room.roundId = randomUUID(); room.revealed = false; room.result = null;
            for (const m of room.members.values()) { m.vote = null; m.waiting = false; }
          } else {
            if (room.revealed) return fail('ROUND_REVEALED');
            if (member.waiting) return fail('WAIT_NEXT_ROUND');
            if (action.type === 'vote') {
              if (!CARDS.includes(action.vote)) return fail('INVALID_VOTE');
              member.vote = action.vote;
            } else {
              if ([...room.members.values()].some(m => !m.waiting && m.vote === null)) return fail('VOTES_MISSING');
              room.revealed = true; room.result = this.result(room);
            }
          }
          this.broadcast(room); break;
        }
        case 'remove': {
          const target = room.members.get(action.participantId);
          if (!target) return fail('PARTICIPANT_NOT_FOUND');
          this.remove(room, target, 'removed'); break;
        }
        case 'leave': this.remove(room, member, 'left'); break;
        default: fail('INVALID_MESSAGE');
      }
    } catch (error) {
      peer.send({ type: 'error', code: error instanceof RoomError ? error.code : 'SERVER_ERROR' });
    }
  }
}
