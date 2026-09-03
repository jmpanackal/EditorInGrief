import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { SourceUpload } from './SourceUpload';
import { Toggle } from './ui/Toggle';

export function Lobby({ room }: { room: RoomApi }) {
  const state = room.state!;
  const settings = state.roundSettings;
  const joinUrl = `${window.location.origin}/?code=${state.code}`;
  const canStart = state.players.filter((p) => p.connected).length >= 1;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(joinUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => {},
    );
  };

  const limit = settings.maxRedactions ?? 0;
  const setLimit = (n: number) => {
    const v = Math.max(0, Math.min(99, Math.floor(n)));
    room.setRoundSettings({ maxRedactions: v > 0 ? v : null });
  };

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px] animate-fade-up">
      {/* Left: room hero + host controls */}
      <div className="flex flex-col gap-5">
        {/* Room code hero */}
        <div className="card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-stretch">
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="text-xs uppercase tracking-widest text-white/40 font-semibold">Room code</div>
            <div className="font-display text-6xl sm:text-7xl font-bold tracking-[0.12em] text-grief mt-1 select-all leading-none">
              {state.code}
            </div>
            <p className="text-sm text-white/55 mt-3">Share it however you like — voice chat, text, or the QR.</p>
            <button className="btn-secondary text-sm mt-3" onClick={copy}>
              {copied ? '✓ Copied!' : '🔗 Copy join link'}
            </button>
          </div>
          <div className="shrink-0 grid place-items-center">
            <div className="bg-white p-2.5 rounded-2xl shadow-lg">
              <QRCodeSVG value={joinUrl} size={116} />
            </div>
            <span className="text-[11px] text-white/40 mt-2">Scan to join</span>
          </div>
        </div>

        {/* Round source — any player may stage a screenshot */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-display font-semibold text-white/80">Round source</div>
            <span className="flex-1" />
            {!state.pendingSource && <span className="badge">seed bank</span>}
          </div>
          <SourceUpload room={room} />
          {!state.pendingSource && (
            <p className="text-xs text-white/40">
              No upload? A random screenshot is pulled from the seed bank.
            </p>
          )}
        </div>

        {room.isHost ? (
          <div className="card p-5 flex flex-col gap-4">
            <div className="text-sm font-display font-semibold text-white/80">Host settings</div>

            {/* Voting */}
            <SettingRow
              title="Enable voting"
              hint="Off by default — just for laughs"
              control={<Toggle checked={state.votingEnabled} onChange={room.setVoting} aria-label="Enable voting" />}
            />
            {/* Quick-fire */}
            <SettingRow
              title="⚡ Quick-fire"
              hint="Short fixed timer for fast pacing"
              control={
                <Toggle
                  tone="gold"
                  checked={settings.quickFire}
                  onChange={(v) => room.setRoundSettings({ quickFire: v })}
                  aria-label="Quick-fire mode"
                />
              }
            />
            {/* Redaction limit stepper */}
            <SettingRow
              title="Redaction limit"
              hint="Cap edits per round (0 = unlimited)"
              control={
                <div className="flex items-center gap-1">
                  <button className="btn-ghost w-9 h-9 !px-0 text-lg" onClick={() => setLimit(limit - 1)} disabled={limit <= 0}>−</button>
                  <span className="w-10 text-center tabular-nums font-semibold">{limit === 0 ? '∞' : limit}</span>
                  <button className="btn-ghost w-9 h-9 !px-0 text-lg" onClick={() => setLimit(limit + 1)}>+</button>
                </div>
              }
            />

            <button className="btn-primary text-lg py-3.5 mt-1" disabled={!canStart} onClick={() => room.startRound()}>
              Start round →
            </button>
          </div>
        ) : (
          <div className="card p-6 flex flex-col items-center gap-3 text-center">
            <div className="text-3xl animate-floaty">⏳</div>
            <div className="font-display font-semibold text-lg">Waiting for the host…</div>
            <p className="text-sm text-white/55">They’re setting up the next round. You can still upload a screenshot above!</p>
            <div className="flex items-center justify-center gap-2 text-xs mt-1">
              {settings.quickFire && <span className="pill bg-gold/15 text-gold border-gold/40">⚡ Quick-fire</span>}
              {settings.maxRedactions != null && <span className="pill">max {settings.maxRedactions} edits</span>}
              {state.votingEnabled && <span className="pill">🗳️ voting on</span>}
            </div>
          </div>
        )}
      </div>

      {/* Right: players */}
      <div className="card p-5 h-fit">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-display font-semibold text-white/80">Players</div>
          <span className="badge">{state.players.filter((p) => p.connected).length} online</span>
        </div>
        <PlayerList players={state.players} meId={room.playerId} />
        <p className="text-xs text-white/35 mt-3">Anyone here can upload a screenshot for the next round.</p>
      </div>
    </div>
  );
}

function SettingRow({ title, hint, control }: { title: string; hint: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl card-inset">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-white/45">{hint}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
