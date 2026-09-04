import { useEffect, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { dateline } from '../lib/format';
import { parseJoinCodeFromLocation, syncRoomUrl } from '../lib/roomUrl';
import { HowToPlayCarousel } from './HowToPlayCarousel';

export function JoinScreen({ room }: { room: RoomApi }) {
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  // Default to Enter Lobby so the primary host path is highlighted — Join is
  // one tap away when you already have a code.
  const [mode, setMode] = useState<'join' | 'create'>('create');
  // True only when we arrived via a shared ?code= / ?room= link (not when someone
  // typed a code in manually) — drives the distinct "you're invited" framing
  // so it's obvious at a glance which flow you're in.
  const [invited, setInvited] = useState(false);

  // Prefill code from a shared join link (?code=ABCD or ?room=ABCD).
  useEffect(() => {
    const c = parseJoinCodeFromLocation();
    if (c) { setCode(c); setMode('join'); setInvited(true); }
  }, []);

  const nick = nickname.trim();
  const canCreate = nick.length > 0;
  const canJoin = nick.length > 0 && code.trim().length >= 3;
  const connecting = room.status !== 'open';

  /** Leave the invite layout for the organic Join / Start landing. */
  const backToHome = () => {
    setInvited(false);
    setMode('join');
    setCode('');
    room.clearError();
    syncRoomUrl(null);
  };

  /** Same URL cleanup, but land on Enter Lobby for hosts who give up on the invite. */
  const startFresh = () => {
    setInvited(false);
    setMode('create');
    setCode('');
    room.clearError();
    // Drop the stale invite code from the address bar so a later share/copy
    // cannot advertise the room we just abandoned.
    syncRoomUrl(null);
  };

  // Top-align (not vertically center) so the masthead sits higher in the
  // first viewport; App main already supplies outer padding.
  return (
    <div className="min-h-full grid justify-items-center content-start pt-1 sm:pt-2 md:pt-3">
      <div className="w-full max-w-7xl animate-fade-up">
        {/* Masthead */}
        <div className="text-center mb-5">
          <div className="kicker text-sm flex items-center justify-center gap-2">
            <span className="hr-thin flex-1" />
            <span>Vol. I</span>
            <span>·</span>
            <span>Late Edition</span>
            <span>·</span>
            <span>One Thin Dime</span>
            <span className="hr-thin flex-1" />
          </div>
          <h1 className="font-display font-black text-5xl sm:text-7xl leading-none my-2 tracking-tight">
            Editor in <span className="text-grief">Grief</span>
          </h1>
          <div className="hr-double my-2" />
          <p className="kicker text-sm">{dateline()} · The Redactionist’s Gazette</p>
        </div>

        <div className="grid gap-5 md:grid-cols-[3fr_2fr] items-stretch max-w-xl md:max-w-none mx-auto">
          {/* Join / create — a fixed min-height so switching Join↔Start (a
              different field count) never resizes this column, which would
              otherwise drag the stretched carousel's height around with it. */}
          <div className="flex flex-col gap-4 md:min-h-[27rem]">
            {invited ? (
              <>
                {/* Obvious escape from a dead invite — above the card so it
                    stays visible even when join fails with "room not found". */}
                <button
                  type="button"
                  className="btn-ghost self-start !px-2 !py-1.5 text-base text-ink2"
                  onClick={backToHome}
                >
                  ← Back to home
                </button>
                <p className="text-center text-ink2 text-lg leading-snug">
                  Someone's holding a spot for you at the desk.
                </p>
                <form
                  className="card p-6 flex flex-col gap-4 shadow-clip flex-1 justify-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canJoin || connecting) return;
                    room.joinRoom(code, nick);
                  }}
                >
                  <div className="text-center">
                    <div className="stamp stamp-ink animate-stamp-in">You're invited</div>
                  </div>
                  {/* Editable, not just a static display — if the invite is
                      stale (host's room already closed, a typo in the
                      shared link) there needs to be a way to fix the code
                      in place instead of a dead end. */}
                  <div>
                    <label className="kicker text-sm">Edition no.</label>
                    <input
                      className="field mt-2 py-3 tracking-[0.35em] uppercase text-center text-3xl font-bold font-display"
                      value={code}
                      maxLength={6}
                      placeholder="ABCD"
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="kicker text-sm">Your byline</label>
                    <input
                      className="field mt-2 py-3 text-lg"
                      value={nickname}
                      maxLength={20}
                      placeholder="e.g. RedactionRacoon"
                      autoFocus
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-primary py-3.5 text-xl" disabled={!canJoin || connecting}>
                    {connecting ? 'Connecting…' : 'Join Lobby →'}
                  </button>
                  {room.error && (
                    <p className="text-center text-grief font-slab font-semibold text-sm leading-snug" role="alert">
                      {room.error}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-2 text-sm text-ink3">
                    <span className={`w-2 h-2 rounded-full ${room.status === 'open' ? 'bg-grief' : 'bg-ink3 animate-pulse'}`} />
                    <span className="uppercase tracking-wide font-semibold">{room.status === 'open' ? 'On the wire' : room.status}</span>
                  </div>
                  {/* Explicitly names the "room's gone" case, not just "not
                      your invite" — that phrasing reads as a dead end if
                      the invite WAS yours but the room disappeared. */}
                  <button type="button" className="btn-ghost text-sm self-center" onClick={startFresh}>
                    Room gone, or wrong code? Enter a new lobby instead
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-center text-ink2 text-lg leading-snug">
                  Edit the post by redacting text<br />
                  <span className="italic">Redact, reveal, repeat — extra, extra!</span>
                </p>

                <form
                  className="card p-6 flex flex-col gap-4 shadow-clip flex-1 justify-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mode === 'join') {
                      if (!canJoin || connecting) return;
                      room.joinRoom(code, nick);
                    } else {
                      if (!canCreate || connecting) return;
                      room.createRoom(nick);
                    }
                  }}
                >
                  <div>
                    <label className="kicker text-sm">Your byline</label>
                    <input
                      className="field mt-2 py-3 text-lg"
                      value={nickname}
                      maxLength={20}
                      placeholder="e.g. RedactionRacoon"
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </div>

                  {/* Segmented join/create — "Enter Lobby" (not "Start Game") so
                      hosts don't think play has begun before the waiting room. */}
                  <div className="segmented w-full text-lg">
                    <button type="button" className="segmented-item flex-1 !py-2.5" data-active={mode === 'create'} onClick={() => setMode('create')}>Enter Lobby</button>
                    <button type="button" className="segmented-item flex-1 !py-2.5" data-active={mode === 'join'} onClick={() => setMode('join')}>Join a Room</button>
                  </div>

                  {mode === 'join' ? (
                    <>
                      <div>
                        <label className="kicker text-sm">Edition no.</label>
                        <input
                          className="field mt-2 py-3 tracking-[0.35em] uppercase text-center text-3xl font-bold font-display"
                          value={code}
                          maxLength={6}
                          placeholder="ABCD"
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                        />
                      </div>
                      <button type="submit" className="btn-primary py-3.5 text-xl" disabled={!canJoin || connecting}>
                        {connecting ? 'Connecting…' : 'Join Lobby →'}
                      </button>
                    </>
                  ) : (
                    <button type="submit" className="btn-primary py-3.5 text-xl" disabled={!canCreate || connecting}>
                      {connecting ? 'Connecting…' : 'Enter Lobby →'}
                    </button>
                  )}

                  <div className="flex items-center justify-center gap-2 text-sm text-ink3">
                    <span className={`w-2 h-2 rounded-full ${room.status === 'open' ? 'bg-grief' : 'bg-ink3 animate-pulse'}`} />
                    <span className="uppercase tracking-wide font-semibold">{room.status === 'open' ? 'On the wire' : room.status}</span>
                    <span>·</span>
                    <span>Best played over voice chat</span>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* How to play — visible before you even join */}
          <HowToPlayCarousel />
        </div>
      </div>
    </div>
  );
}
