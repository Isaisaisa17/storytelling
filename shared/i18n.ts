import type { ErrorCode } from './protocol.js';
export const en = {
  planningPoker: 'Planning poker',
  language: 'Language', tagline: 'A little perspective. A shared estimate.',
  intro: 'Make room for a good discussion.', introText: 'Pick a card, share your perspective, and find your team’s next estimate. No accounts needed.',
  nickname: 'Your nickname', nicknamePlaceholder: 'e.g. Alex', roomName: 'Room name', roomPlaceholder: 'happy-otter-maple',
  create: 'Create a room', join: 'Join a room', or: 'or join your team',
  privacy: 'Votes stay private until everyone is ready. Rooms live only until the server restarts.',
  connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected — reconnecting…',
  room: 'Team room', copy: 'Copy invite link', copied: 'Link copied', copyFailed: 'Copy this link to invite your team:',
  leave: 'Leave room', leaveConfirm: 'Leave this room? Your vote and membership will be removed.',
  team: 'At the table', people: 'participants', person: 'participant', you: 'you', offline: 'offline', waiting: 'next round',
  remove: 'Remove {name}', removeConfirm: 'Remove {name} from the room? Their vote will also be removed.',
  choose: 'What’s your estimate?', chooseText: 'Trust your first instinct. You can change your card until the reveal.',
  selected: 'Your card: {vote}', cardLabel: 'Vote {vote}',
  missing: '{count} votes still missing', missingOne: '1 vote still missing', allReady: 'Everyone is ready', hidden: 'Your team’s cards stay hidden until the reveal.',
  reveal: 'Reveal cards', newRound: 'New round', resetConfirm: 'Start a new round? All votes and results will be cleared.',
  waitingTitle: 'You’ve got a seat for the next round.', waitingText: 'This round has already been revealed. Start a new round when your team is ready.',
  discussion: 'Discussion time', discussionText: 'Different perspectives are worth exploring. Let the lowest and highest estimates start the conversation.',
  agreement: 'Team average', agreementText: 'Your estimates are close. Here’s the team’s average.',
  mean: 'Average estimate', anonymous: 'Anonymous cards', results: 'Round results', noVotes: 'No votes remain in this round.',
  removed: 'You were removed from the room. You can join again with a nickname.',
  cancel: 'Cancel', confirm: 'Confirm', confirmation: 'Please confirm', footer: 'Small cards. Better conversations.',
  errors: {
    INVALID_MESSAGE: 'That action could not be understood. Please try again.',
    INVALID_ROOM: 'Enter a room name such as happy-otter-maple.',
    ROOM_NOT_FOUND: 'This room does not exist. Check the name, or create a new room.',
    INVALID_NICKNAME: 'Use a nickname of 1–32 characters without control characters.',
    NICKNAME_TAKEN: 'That nickname is already in use in this room.',
    NOT_MEMBER: 'Your membership has expired. Please join again. The server may have restarted.',
    STALE_ROUND: 'A new round has started. Please choose your card again.',
    ROUND_REVEALED: 'This round has already been revealed.',
    WAIT_NEXT_ROUND: 'You can vote when the next round starts.',
    INVALID_VOTE: 'Choose one of the available cards.', VOTES_MISSING: 'Everyone must vote before the reveal.',
    PARTICIPANT_NOT_FOUND: 'That participant has already left.', RATE_LIMITED: 'Too many actions. Wait a moment and try again.',
    SERVER_ERROR: 'Something went wrong. Please try again.'
  } satisfies Record<ErrorCode, string>,
};
type Dictionary = { [K in keyof typeof en]: K extends 'errors' ? Record<ErrorCode, string> : string };
export const de: Dictionary = {
  planningPoker: 'Planning Poker',
  language: 'Sprache', tagline: 'Neue Perspektiven. Eine gemeinsame Schätzung.',
  intro: 'Raum für gute Diskussionen.', introText: 'Wählt eine Karte, teilt eure Perspektiven und findet die nächste Schätzung als Team. Ganz ohne Konto.',
  nickname: 'Dein Spitzname', nicknamePlaceholder: 'z. B. Alex', roomName: 'Raumname', roomPlaceholder: 'happy-otter-maple',
  create: 'Raum erstellen', join: 'Raum beitreten', or: 'oder zum Team dazukommen',
  privacy: 'Stimmen bleiben bis zur Aufdeckung geheim. Ein Serverneustart löscht alle Räume.',
  connected: 'Verbunden', connecting: 'Verbindung wird hergestellt…', disconnected: 'Getrennt — Verbindung wird wiederhergestellt…',
  room: 'Teamraum', copy: 'Einladungslink kopieren', copied: 'Link kopiert', copyFailed: 'Kopiere diesen Link, um dein Team einzuladen:',
  leave: 'Raum verlassen', leaveConfirm: 'Diesen Raum verlassen? Deine Stimme und Mitgliedschaft werden entfernt.',
  team: 'Am Tisch', people: 'Teilnehmende', person: 'teilnehmende Person', you: 'du', offline: 'offline', waiting: 'nächste Runde',
  remove: '{name} entfernen', removeConfirm: '{name} aus dem Raum entfernen? Die Stimme wird ebenfalls entfernt.',
  choose: 'Wie schätzt du den Aufwand?', chooseText: 'Vertraue deinem ersten Gefühl. Bis zur Aufdeckung kannst du deine Karte ändern.',
  selected: 'Deine Karte: {vote}', cardLabel: 'Mit {vote} abstimmen',
  missing: '{count} Stimmen fehlen noch', missingOne: '1 Stimme fehlt noch', allReady: 'Alle sind bereit', hidden: 'Die Karten deines Teams bleiben bis zur Aufdeckung geheim.',
  reveal: 'Karten aufdecken', newRound: 'Neue Runde', resetConfirm: 'Eine neue Runde starten? Alle Stimmen und Ergebnisse werden gelöscht.',
  waitingTitle: 'Dein Platz in der nächsten Runde ist bereit.', waitingText: 'Diese Runde wurde bereits aufgedeckt. Startet eine neue Runde, sobald euer Team bereit ist.',
  discussion: 'Diskussionsrunde', discussionText: 'Verschiedene Perspektiven lohnen sich. Beginnt das Gespräch mit der niedrigsten und der höchsten Schätzung.',
  agreement: 'Durchschnitt', agreementText: 'Eure Schätzungen liegen nah beieinander. Hier ist der Durchschnitt des Teams.',
  mean: 'Durchschnittliche Schätzung', anonymous: 'Anonyme Karten', results: 'Rundenergebnis', noVotes: 'In dieser Runde sind keine Stimmen mehr vorhanden.',
  removed: 'Du wurdest aus dem Raum entfernt. Du kannst mit einem Spitznamen erneut beitreten.',
  cancel: 'Abbrechen', confirm: 'Bestätigen', confirmation: 'Bitte bestätigen', footer: 'Kleine Karten. Gute Gespräche.',
  errors: {
    INVALID_MESSAGE: 'Diese Aktion wurde nicht verstanden. Bitte versuche es erneut.',
    INVALID_ROOM: 'Gib einen Raumnamen wie happy-otter-maple ein.',
    ROOM_NOT_FOUND: 'Dieser Raum existiert nicht. Prüfe den Namen oder erstelle einen neuen Raum.',
    INVALID_NICKNAME: 'Verwende einen Spitznamen mit 1–32 Zeichen ohne Steuerzeichen.',
    NICKNAME_TAKEN: 'Dieser Spitzname wird in diesem Raum bereits verwendet.',
    NOT_MEMBER: 'Deine Mitgliedschaft ist abgelaufen. Bitte tritt erneut bei. Möglicherweise wurde der Server neu gestartet.',
    STALE_ROUND: 'Eine neue Runde hat begonnen. Bitte wähle deine Karte erneut.',
    ROUND_REVEALED: 'Diese Runde wurde bereits aufgedeckt.',
    WAIT_NEXT_ROUND: 'Du kannst in der nächsten Runde abstimmen.',
    INVALID_VOTE: 'Wähle eine der verfügbaren Karten.', VOTES_MISSING: 'Vor der Aufdeckung müssen alle abstimmen.',
    PARTICIPANT_NOT_FOUND: 'Diese Person hat den Raum bereits verlassen.', RATE_LIMITED: 'Zu viele Aktionen. Warte kurz und versuche es erneut.',
    SERVER_ERROR: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'
  },
};
export type Language = 'en' | 'de';
export const dictionaries = { en, de };
export function detectLanguage(saved: string | null, preferred: readonly string[]): Language {
  if (saved === 'en' || saved === 'de') return saved;
  return preferred[0]?.toLowerCase().split('-')[0] === 'de' ? 'de' : 'en';
}
export function formatMean(mean: number, language: Language) {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }).format(mean);
}
export function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
