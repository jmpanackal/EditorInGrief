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
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black">
            Editor in <span className="text-grief">Grief</span>
          </h1>
          <p className="text-white/60 mt-2">
            Black out a screenshot to make it hilarious. Redact, reveal, repeat.
          </p>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div>
            <label className="text-sm text-white/60">Your nickname</label>
            <input
              className="field mt-1"
              value={nickname}
              maxLength={20}
              placeholder="e.g. RedactionRacoon"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="flex rounded-lg overflow-hidden border border-white/10 text-sm">
            <button
              className={`flex-1 py-2 font-medium ${mode === 'join' ? 'bg-grief text-white' : 'bg-panel2 text-white/70'}`}
              onClick={() => setMode('join')}
            >Join a room</button>
            <button
              className={`flex-1 py-2 font-medium ${mode === 'create' ? 'bg-grief text-white' : 'bg-panel2 text-white/70'}`}
              onClick={() => setMode('create')}
            >Create a room</button>
          </div>

          {mode === 'join' ? (
            <>
              <div>
                <label className="text-sm text-white/60">Room code</label>
                <input
                  className="field mt-1 tracking-[0.3em] uppercase text-center text-xl font-bold"
                  value={code}
                  maxLength={6}
                  placeholder="ABCD"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <button className="btn-primary py-3" disabled={!canJoin || connecting} onClick={() => room.joinRoom(code, nick)}>
                {connecting ? 'Connecting…' : 'Join room'}
              </button>
            </>
          ) : (
            <button className="btn-primary py-3" disabled={!canCreate || connecting} onClick={() => room.createRoom(nick)}>
              {connecting ? 'Connecting…' : 'Create room'}
            </button>
          )}

          <div className="text-center text-xs text-white/40">
            Status:{' '}
            <span className={room.status === 'open' ? 'text-emerald-400' : 'text-amber-400'}>{room.status}</span>
            {' '}· Play over voice chat. Share the code however you like.
          </div>
        </div>
      </div>
    </div>
  );
}
