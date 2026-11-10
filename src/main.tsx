import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CARDS, type Action, type Credentials, type ErrorCode, type ServerMessage, type Snapshot } from '../shared/protocol';
import { detectLanguage, dictionaries, formatMean, interpolate, type Language } from '../shared/i18n';
import './style.css';

const storage = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Private browsing can disable storage. */ } },
  remove(key: string) { try { localStorage.removeItem(key); } catch { /* Keep working in memory. */ } },
};
function savedCredentials(): Credentials | null {
  try {
    const requested = new URLSearchParams(location.search).get('room');
    const active = JSON.parse(storage.get('storytelling.membership') || 'null');
    const c = requested ? JSON.parse(storage.get(`storytelling.membership.${requested}`) || 'null') || (active?.room === requested ? active : null) : active;
    return c && typeof c.room === 'string' && typeof c.participantId === 'string' && typeof c.token === 'string' ? c : null;
  } catch { return null; }
}
function App() {
  const [language, setLanguage] = useState<Language>(() => detectLanguage(storage.get('storytelling.language'), navigator.languages || [navigator.language]));
  const t = dictionaries[language];
  const [state, setState] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [ready, setReady] = useState(false);
  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState(new URLSearchParams(location.search).get('room') || '');
  const [error, setError] = useState<ErrorCode | 'removed' | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyLink, setCopyLink] = useState('');
  const [confirmation, setConfirmation] = useState<{ text: 'leaveConfirm' | 'resetConfirm' | 'removeConfirm'; name?: string; action: Action } | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const credentials = useRef<Credentials | null>(savedCredentials());
  const dialog = useRef<HTMLDialogElement>(null);

  function forgetMembership() {
    if (credentials.current) storage.remove(`storytelling.membership.${credentials.current.room}`);
    credentials.current = null;
    storage.remove('storytelling.membership');
  }

  useEffect(() => { document.documentElement.lang = language; storage.set('storytelling.language', language); }, [language]);
  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout>;
    let attempts = 0;
    function connect() {
      if (disposed) return;
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      socket.current = ws;
      ws.onopen = () => {
        if (disposed) { ws.close(); return; }
        attempts = 0; setStatus('connected');
        if (credentials.current) ws.send(JSON.stringify({ type: 'resume', ...credentials.current }));
        else setReady(true);
      };
      ws.onmessage = event => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'welcome') {
          credentials.current = message.credentials;
          storage.set('storytelling.membership', JSON.stringify(message.credentials));
          storage.set(`storytelling.membership.${message.credentials.room}`, JSON.stringify(message.credentials));
          const url = new URL(location.href); url.searchParams.set('room', message.credentials.room);
          history.replaceState(null, '', url); setRoom(message.credentials.room); setError(null);
        } else if (message.type === 'state') {
          setState(message.state); setReady(true); setPending(false);
        } else if (message.type === 'error') {
          setError(message.code); setPending(false); setReady(true);
          if (message.code === 'NOT_MEMBER') {
            forgetMembership(); setState(null);
          }
        } else {
          forgetMembership(); setState(null); setPending(false); setReady(true);
          setConfirmation(null); setError(message.type === 'removed' ? 'removed' : null);
          const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        setStatus('disconnected'); setReady(false); setPending(false);
        retry = setTimeout(connect, Math.min(500 * 2 ** attempts++, 8000));
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { disposed = true; clearTimeout(retry); socket.current?.close(); };
  }, []);
  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
    if (!confirmation && dialog.current?.open) dialog.current.close();
  }, [confirmation]);
  function send(action: Action) {
    if (!ready || socket.current?.readyState !== WebSocket.OPEN) return;
    setPending(true); setError(null); socket.current.send(JSON.stringify(action));
  }
  async function copyInvite() {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('room', state!.room); url.hash = '';
    try { await navigator.clipboard.writeText(url.href); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setCopyLink(url.href); }
  }
  const disabled = !ready || pending;
  const self = state?.participants.find(p => p.id === state.selfId);
  const result = state?.result;
  return <>
    <header className="site-header">
      <div className="brand"><span className="brand-icon" aria-hidden="true">s<span>✳</span></span><span>Storytelling</span></div>
      <label className="language"><span className="sr-only">{t.language}</span><select aria-label={t.language} value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="de">Deutsch</option></select></label>
    </header>
    <main>
      <div className={`connection ${status}`} role="status"><span aria-hidden="true" />{t[status]}</div>
      {error && <div className="notice" role="alert">{error === 'removed' ? t.removed : t.errors[error]}</div>}
      {!state ? <div className="landing">
        <section className="introduction">
          <p className="eyebrow">{t.planningPoker}</p><h1>{t.intro}</h1>
          <div className="illustration" aria-hidden="true"><span className="decor-card first">3<small>✳</small></span><span className="decor-card second">5<small>✳</small></span><span className="decor-card third">8<small>✳</small></span></div>
        </section>
        <form noValidate className="join-panel" onSubmit={e => { e.preventDefault(); send({ type: 'join', room: room.trim().toLowerCase(), nickname }); }}>
          <label htmlFor="nickname">{t.nickname}</label><input id="nickname" autoComplete="nickname" maxLength={32} required value={nickname} onChange={e => setNickname(e.target.value)} placeholder={t.nicknamePlaceholder} disabled={!ready} />
          <button className="primary" type="button" disabled={disabled || !nickname.trim()} onClick={() => send({ type: 'create', nickname })}>{t.create}<span aria-hidden="true">↗</span></button>
          <div className="divider"><span>{t.or}</span></div>
          <label htmlFor="room">{t.roomName}</label><input id="room" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={100} value={room} onChange={e => setRoom(e.target.value)} placeholder={t.roomPlaceholder} disabled={!ready} />
          <button className="secondary" disabled={disabled || !nickname.trim() || !room.trim()}>{t.join}<span aria-hidden="true">→</span></button>
        </form>
      </div> : <>
        <section className="room-header"><div><p className="eyebrow">{t.room}</p><h1 className="room-name">{state.room}</h1></div><div className="room-tools"><button className="secondary" disabled={!ready} onClick={copyInvite}>{copied ? t.copied : t.copy}</button><button className="text-button" disabled={disabled} onClick={() => setConfirmation({ text: 'leaveConfirm', action: { type: 'leave' } })}>{t.leave}</button></div></section>
        {copyLink && <div className="notice"><label htmlFor="invite">{t.copyFailed}</label><input id="invite" value={copyLink} readOnly onFocus={e => e.target.select()} /></div>}
        <div className="room-layout"><section className={`voting-panel ${state.revealed && result ? `result-${result.kind}` : ''}`}>
          {state.revealed ? <>
            {self?.waiting && <div className="waiting-message"><strong>{t.waitingTitle}</strong></div>}
            <h2 className="result-heading"><span className="result-symbol" aria-hidden="true">{result?.kind === 'discussion' ? '↔' : '✓'}</span>{result?.kind === 'discussion' ? t.discussion : t.agreement}</h2>
            {result?.kind === 'discussion' ? <ul className="discussion-votes">{result.votes.map(v => <li key={v.nickname}><span>{v.nickname}</span><strong>{v.vote}</strong></li>)}</ul> : result?.votes.length ? <><div className="mean" role="group" aria-label={t.mean}><strong>{formatMean(result.mean, language)}</strong></div><div className="anonymous-votes" role="group" aria-label={t.anonymous}>{result.votes.map((v, i) => <span key={i}>{v}</span>)}</div></> : <p>{t.noVotes}</p>}
          </> : <>
            <h2>{t.choose}</h2>
            <div className="cards" role="group" aria-label={t.choose}>{CARDS.map(card => <button key={card} className={`vote-card ${state.ownVote === card ? 'selected' : ''}`} aria-pressed={state.ownVote === card} aria-label={interpolate(t.cardLabel, { vote: card })} disabled={disabled || self?.waiting} onClick={() => send({ type: 'vote', roundId: state.roundId, vote: card })}><span>{card}</span></button>)}</div>
            <p className="sr-only" aria-live="polite">{state.ownVote !== null ? interpolate(t.selected, { vote: state.ownVote }) : '\u00a0'}</p>
            <div className="round-status" role="status"><span className="status-symbol" aria-hidden="true">{state.missing ? '◷' : '✓'}</span><div><strong>{state.missing ? interpolate(state.missing === 1 ? t.missingOne : t.missing, { count: state.missing }) : t.allReady}</strong></div></div>
          </>}
          <div className="round-actions">{!state.revealed && <button className="primary" disabled={disabled || state.missing !== 0 || self?.waiting} onClick={() => send({ type: 'reveal', roundId: state.roundId })}>{t.reveal}<span aria-hidden="true">↗</span></button>}<button className={state.revealed ? 'primary' : 'secondary'} disabled={disabled} onClick={() => setConfirmation({ text: 'resetConfirm', action: { type: 'reset', roundId: state.roundId } })}>{t.newRound}</button></div>
        </section><aside className="participants"><div className="participants-heading"><h2>{t.team}</h2><span>{state.participants.length}</span></div><ul>{state.participants.map(p => <li key={p.id}><span className="avatar" aria-hidden="true">{p.nickname.slice(0, 1).toUpperCase()}</span><div className="participant-name"><strong>{p.nickname} {p.id === state.selfId && <small>({t.you})</small>}</strong><span>{p.waiting ? t.waiting : !p.connected ? t.offline : '\u00a0'}</span></div><button className="remove" aria-label={interpolate(t.remove, { name: p.nickname })} disabled={disabled} onClick={() => setConfirmation({ text: 'removeConfirm', name: p.nickname, action: { type: 'remove', participantId: p.id } })}><span aria-hidden="true">×</span></button></li>)}</ul></aside></div>
      </>}
    </main>
    <dialog ref={dialog} aria-labelledby="confirmation-title" onCancel={() => setConfirmation(null)} onClose={() => setConfirmation(null)}><h2 id="confirmation-title">{t.confirmation}</h2><p>{confirmation && interpolate(t[confirmation.text], { name: confirmation.name || '' })}</p><div className="dialog-actions"><button autoFocus className="secondary" onClick={() => setConfirmation(null)}>{t.cancel}</button><button className="primary" disabled={disabled} onClick={() => { if (confirmation) send(confirmation.action); setConfirmation(null); }}>{t.confirm}</button></div></dialog>
  </>;
}
createRoot(document.getElementById('root')!).render(<App />);
