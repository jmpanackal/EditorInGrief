import { QRCodeSVG } from 'qrcode.react';
import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';

export function Lobby({ room }: { room: RoomApi }) {
  const state = room.state!;
  const settings = state.roundSettings;
  const joinUrl = `${window.location.origin}/?code=${state.code}`;
  const canStart = state.players.filter((p) => p.connected).length >= 1;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      {/* Room code + share */}
      <div className="card p-5 flex flex-col gap-4">
        <div>
          <div className="text-sm text-white/50">Room code — share it however you like</div>
          <div className="text-5xl sm:text-6xl font-black tracking-[0.2em] text-grief mt-1 select-all">{state.code}</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={joinUrl} size={104} />
          </div>
          <div className="text-sm text-white/60">
            Scan to join, or open the app and enter the code.
            <div className="mt-2">
              <button className="btn-secondary text-xs" onClick={() => navigator.clipboard?.writeText(joinUrl)}>
                Copy join link
              </button>
            </div>
          </div>
        </div>

        {room.isHost ? (
          <div className="mt-2 flex flex-col gap-3">
            <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-panel2 border border-white/10">
              <span className="text-sm">Enable voting <span className="text-white/40">(off by default — just for laughs)</span></span>
              <input
                type="checkbox"
                checked={state.votingEnabled}
                onChange={(e) => room.setVoting(e.target.checked)}
                className="w-5 h-5 accent-grief"
              />
            </label>

            {/* Quick-fire mode */}
            <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-panel2 border border-white/10">
              <span className="text-sm">⚡ Quick-fire <span className="text-white/40">(short fixed timer for fast pacing)</span></span>
              <input
                type="checkbox"
                checked={settings.quickFire}
                onChange={(e) => room.setRoundSettings({ quickFire: e.target.checked })}
                className="w-5 h-5 accent-grief"
              />
            </label>

            {/* Stroke limit */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-panel2 border border-white/10">
              <div className="text-sm">
                Redaction limit
                <span className="text-white/40 block text-xs">Cap edits per round (0 = unlimited)</span>
              </div>
              <input
                type="number"
                min={0}
                max={99}
                value={settings.maxRedactions ?? 0}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  room.setRoundSettings({ maxRedactions: Number.isFinite(n) && n > 0 ? n : null });
                }}
                className="field w-20 text-center"
              />
            </div>

            <button className="btn-primary text-lg py-3" disabled={!canStart} onClick={() => room.startRound()}>
              Start round →
            </button>
            <p className="text-xs text-white/40 text-center">
              A random source is pulled from the seed bank. (Upload flow arrives in Phase 3.)
            </p>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2 text-center text-white/60 text-sm py-3 rounded-lg bg-panel2 border border-white/10">
            <div>Waiting for the host to start the round…</div>
            <div className="flex items-center justify-center gap-2 text-xs">
              {settings.quickFire && <span className="pill bg-amber-500/20 text-amber-300 border-amber-500/40">⚡ Quick-fire</span>}
              {settings.maxRedactions != null && <span className="pill">max {settings.maxRedactions} edits</span>}
              {state.votingEnabled && <span className="pill">voting on</span>}
            </div>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="card p-5">
        <div className="text-sm text-white/50 mb-3">Players ({state.players.length})</div>
        <PlayerList players={state.players} meId={room.playerId} />
      </div>
    </div>
  );
}
