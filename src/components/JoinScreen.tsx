import { useEffect, useState } from 'react';
import type { RoomApi } from '../state/useRoom';
import { dateline } from '../lib/format';

export function JoinScreen({ room }: { room: RoomApi }) {
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'join' | 'create'>('join');

  // Prefill code from a shared join link (?code=ABCD).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) { setCode(c.toUpperCase()); setMode('join'); }
  }, []);

  const nick = nickname.trim();
  const canCreate = nick.length > 0;
  const canJoin = nick.length > 0 && code.trim().length >= 3;
  const connecting = room.status !== 'open';

  return (
    <div className="min-h-full grid place-items-center p-5">
      <div className="w-full max-w-lg animate-fade-up">
        {/* Masthead */}
        <div className="text-center mb-6">
          <div className="kicker text-[11px] flex items-center justify-center gap-2">
            <span className="hr-thin flex-1" />
            <span>Vol. I</span>
            <span>·</span>
            <span>Late Edition</span>
            <span>·</span>
            <span>One Thin Dime</span>
            <span className="hr-thin flex-1" />
          </div>
          <h1 className="font-display font-black text-5xl sm:text-6xl leading-none my-2 tracking-tight">
            Editor in <span className="text-grief">Grief</span>
          </h1>
          <div className="hr-double my-2" />
          <p className="kicker text-[11px]">{dateline()} · The Redactionist’s Gazette</p>
        </div>

        {/* Lede */}
        <p className="text-center text-ink2 mb-5 text-[15px] leading-snug">
          Black out a screenshot to make it hilarious.<br />
          <span className="italic">Redact, reveal, repeat — extra, extra!</span>
        </p>

        <div className="card p-6 flex flex-col gap-4 shadow-clip">
          <div>
            <label className="kicker text-[11px]">Your byline</label>
            <input
              className="field mt-1.5"
              value={nickname}
              maxLength={20}
              placeholder="e.g. RedactionRacoon"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          {/* Segmented join/create */}
          <div className="segmented w-full">
            <button className="segmented-item flex-1" data-active={mode === 'join'} onClick={() => setMode('join')}>Join a Room</button>
            <button className="segmented-item flex-1" data-active={mode === 'create'} onClick={() => setMode('create')}>Start Game</button>
          </div>

          {mode === 'join' ? (
            <>
              <div>
                <label className="kicker text-[11px]">Edition no.</label>
                <input
                  className="field mt-1.5 tracking-[0.35em] uppercase text-center text-2xl font-bold font-display"
                  value={code}
                  maxLength={6}
                  placeholder="ABCD"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <button className="btn-primary py-3.5 text-lg" disabled={!canJoin || connecting} onClick={() => room.joinRoom(code, nick)}>
                {connecting ? 'Connecting…' : 'Join Game →'}
              </button>
            </>
          ) : (
            <button className="btn-primary py-3.5 text-lg" disabled={!canCreate || connecting} onClick={() => room.createRoom(nick)}>
              {connecting ? 'Connecting…' : 'Start Game →'}
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-ink3">
            <span className={`w-2 h-2 rounded-full ${room.status === 'open' ? 'bg-grief' : 'bg-ink3 animate-pulse'}`} />
            <span className="uppercase tracking-wide font-semibold">{room.status === 'open' ? 'On the wire' : room.status}</span>
            <span>·</span>
            <span>Best played over voice chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}
