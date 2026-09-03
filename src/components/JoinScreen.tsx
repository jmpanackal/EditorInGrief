import { useEffect, useState } from 'react';
import type { RoomApi } from '../state/useRoom';

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
      <div className="w-full max-w-md animate-fade-up">
        {/* Hero */}
        <div className="text-center mb-7">
          <div className="text-5xl mb-2 animate-floaty">🖍️</div>
          <h1 className="font-display text-5xl font-bold tracking-tight">
            Editor in <span className="text-grief">Grief</span>
          </h1>
          <p className="text-white/60 mt-3 text-[15px]">
            Black out a screenshot to make it hilarious.<br />Redact, reveal, repeat.
          </p>
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-white/70">Your nickname</label>
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
            <button
              className="segmented-item flex-1"
              data-active={mode === 'join'}
              onClick={() => setMode('join')}
            >Join a room</button>
            <button
              className="segmented-item flex-1"
              data-active={mode === 'create'}
              onClick={() => setMode('create')}
            >Create a room</button>
          </div>

          {mode === 'join' ? (
            <>
              <div>
                <label className="text-sm font-semibold text-white/70">Room code</label>
                <input
                  className="field mt-1.5 tracking-[0.35em] uppercase text-center text-2xl font-bold font-display"
                  value={code}
                  maxLength={6}
                  placeholder="ABCD"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <button className="btn-primary py-3.5 text-lg" disabled={!canJoin || connecting} onClick={() => room.joinRoom(code, nick)}>
                {connecting ? 'Connecting…' : 'Join room →'}
              </button>
            </>
          ) : (
            <button className="btn-primary py-3.5 text-lg" disabled={!canCreate || connecting} onClick={() => room.createRoom(nick)}>
              {connecting ? 'Connecting…' : 'Create room →'}
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-white/45">
            <span className={`w-2 h-2 rounded-full ${room.status === 'open' ? 'bg-mint' : 'bg-gold animate-pulse'}`} />
            <span>{room.status === 'open' ? 'Connected' : room.status}</span>
            <span className="text-white/25">·</span>
            <span>Best played over voice chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}
