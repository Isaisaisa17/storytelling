export const CARDS = [1, 2, 3, 5, 8, 13, 20] as const;
export type Card = typeof CARDS[number];
export type ErrorCode = 'INVALID_MESSAGE' | 'INVALID_ROOM' | 'ROOM_NOT_FOUND' | 'INVALID_NICKNAME' | 'NICKNAME_TAKEN' | 'NOT_MEMBER' | 'STALE_ROUND' | 'ROUND_REVEALED' | 'WAIT_NEXT_ROUND' | 'INVALID_VOTE' | 'VOTES_MISSING' | 'PARTICIPANT_NOT_FOUND' | 'RATE_LIMITED' | 'SERVER_ERROR';
export interface Credentials { room: string; participantId: string; token: string }
export interface Participant { id: string; nickname: string; connected: boolean; waiting: boolean }
export type Result = { kind: 'discussion'; votes: { nickname: string; vote: Card }[] } | { kind: 'agreement'; votes: Card[]; mean: number };
export interface Snapshot {
  room: string; roundId: string; selfId: string; participants: Participant[];
  missing: number; ownVote: Card | null; revealed: boolean; result: Result | null;
}
export type Action =
  | { type: 'create'; nickname: string }
  | { type: 'join'; room: string; nickname: string }
  | ({ type: 'resume' } & Credentials)
  | { type: 'vote'; roundId: string; vote: Card }
  | { type: 'reveal'; roundId: string }
  | { type: 'reset'; roundId: string }
  | { type: 'remove'; participantId: string }
  | { type: 'leave' };
export type ServerMessage = { type: 'welcome'; credentials: Credentials } | { type: 'state'; state: Snapshot } | { type: 'error'; code: ErrorCode } | { type: 'left' } | { type: 'removed' };
