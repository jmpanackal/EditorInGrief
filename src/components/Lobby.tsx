import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  NORMAL_TIMER_MAX,
  NORMAL_TIMER_MIN,
  QUICKFIRE_SECONDS,
  computeTimerSeconds,
  type RoundSettings,
} from '@shared/types';
import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { SourceUpload } from './SourceUpload';
import { Toggle } from './ui/Toggle';

const TIMER_PRESETS = [60, 90, 120, 180] as const;

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

  const setTimer = (partial: Partial<RoundSettings>) => room.setRoundSettings(partial);

  const autoEstimate = state.pendingSource
    ? computeTimerSeconds(state.pendingSource.wordCount)
    : null;
  const timerLocked = settings.quickFire;
  const usingAuto = settings.timerSeconds == null;
  const effectiveNormal = settings.timerSeconds ?? autoEstimate ?? NORMAL_TIMER_MIN;

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px] animate-fade-up">
      {/* Left: edition hero + host controls */}
      <div className="flex flex-col gap-5">
        {/* Edition tag hero */}
        <div className="card p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-stretch">
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="kicker text-[11px]">Edition number</div>
            <div className="font-display text-6xl sm:text-7xl font-black tracking-[0.1em] text-grief mt-1 select-all leading-none">
              {state.code}
            </div>
            <p className="text-sm text-ink2 mt-3">Cry it from the rooftops — voice chat, text, or the QR block.</p>
            <button className="btn-secondary text-sm mt-3" onClick={copy}>
              {copied ? '✓ Copied!' : 'Copy join link'}
            </button>
          </div>
          <div className="shrink-0 grid place-items-center">
            <div className="bg-papercard p-2.5 rounded-[3px] border-2 border-ink">
              <QRCodeSVG value={joinUrl} size={116} bgColor="#faf8f1" fgColor="#1a1a1a" />
            </div>
            <span className="kicker text-[10px] mt-2">Scan to enlist</span>
          </div>
        </div>

        {/* Round source — any player may stage a screenshot */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="kicker text-xs">Front-page source</div>
            <span className="flex-1" />
            {!state.pendingSource && <span className="badge">wire photo</span>}
          </div>
          <SourceUpload room={room} />
          {!state.pendingSource && (
            <p className="text-xs text-ink3">
              No upload? We’ll pull a stock photo from the wire (seed bank).
            </p>
          )}
        </div>

        {room.isHost ? (
          <div className="card p-5 flex flex-col gap-4">
            <div className="kicker text-xs">Editor’s desk</div>

            {/* Voting */}
            <SettingRow
              title="Enable voting"
              hint="Off by default — just for laughs"
              control={<Toggle checked={state.votingEnabled} onChange={room.setVoting} aria-label="Enable voting" />}
            />
            {/* Quick-fire */}
            <SettingRow
              title="⚡ Quick-fire"
              hint={`Uses a fixed ${QUICKFIRE_SECONDS}s deadline (custom timer ignored)`}
              control={
                <Toggle
                  checked={settings.quickFire}
                  onChange={(v) => setTimer({ quickFire: v })}
                  aria-label="Quick-fire mode"
                />
              }
            />
            {/* Round timer */}
            <div className={`px-3.5 py-3 rounded-[3px] card-inset flex flex-col gap-3 ${timerLocked ? 'opacity-55' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold">Round timer</div>
                  <div className="text-xs text-ink3">
                    {timerLocked
                      ? `Quick-fire locks this to ${QUICKFIRE_SECONDS}s.`
                      : usingAuto
                        ? autoEstimate != null
                          ? `Auto from word count → ~${formatSecs(autoEstimate)} (host override wins if set).`
                          : 'Auto from word count / OCR (min 60s). Set a custom time to override.'
                        : `Custom ${formatSecs(settings.timerSeconds!)} — overrides OCR auto-scale.`}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="segmented-item"
                  data-active={String(usingAuto && !timerLocked)}
                  disabled={timerLocked}
                  onClick={() => setTimer({ timerSeconds: null })}
                >
                  Auto
                </button>
                {TIMER_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="segmented-item"
                    data-active={String(!usingAuto && settings.timerSeconds === s && !timerLocked)}
                    disabled={timerLocked}
                    onClick={() => setTimer({ timerSeconds: s })}
                  >
                    {formatSecs(s)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="kicker text-[10px]" htmlFor="timer-custom">Custom</label>
                <div className="flex items-center gap-1">
                  <input
                    id="timer-custom"
                    type="number"
                    min={NORMAL_TIMER_MIN}
                    max={NORMAL_TIMER_MAX}
                    step={15}
                    disabled={timerLocked}
                    className="field !py-1.5 !px-2 w-20 text-center tabular-nums"
                    value={usingAuto ? '' : settings.timerSeconds ?? ''}
                    placeholder={String(effectiveNormal)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setTimer({ timerSeconds: null });
                        return;
                      }
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setTimer({ timerSeconds: n });
                    }}
                    aria-label="Custom round timer in seconds"
                  />
                  <span className="text-xs text-ink3">sec ({NORMAL_TIMER_MIN}–{NORMAL_TIMER_MAX})</span>
                </div>
              </div>
            </div>

            {/* Redaction limit stepper */}
            <SettingRow
              title="Redaction limit"
              hint="Cap edits per round (0 = unlimited)"
              control={
                <div className="flex items-center gap-1">
                  <button className="btn-secondary w-9 h-9 !px-0 !py-0 text-lg" onClick={() => setLimit(limit - 1)} disabled={limit <= 0}>−</button>
                  <span className="w-10 text-center tabular-nums font-display font-bold text-lg">{limit === 0 ? '∞' : limit}</span>
                  <button className="btn-secondary w-9 h-9 !px-0 !py-0 text-lg" onClick={() => setLimit(limit + 1)}>+</button>
                </div>
              }
            />

            <button className="btn-primary text-lg py-3.5 mt-1" disabled={!canStart} onClick={() => room.startRound()}>
              Start Editing →
            </button>
          </div>
        ) : (
          <div className="card p-6 flex flex-col items-center gap-3 text-center">
            <div className="stamp stamp-ink animate-stamp-in">Hold the press</div>
            <div className="font-display font-bold text-lg mt-1">Awaiting the Editor…</div>
            <p className="text-sm text-ink2">They’re setting the next story. You can still file a screenshot above!</p>
            <div className="flex items-center justify-center gap-2 text-xs mt-1 flex-wrap">
              {settings.quickFire && <span className="pill">⚡ Quick-fire · {QUICKFIRE_SECONDS}s</span>}
              {!settings.quickFire && settings.timerSeconds != null && (
                <span className="pill">{formatSecs(settings.timerSeconds)} deadline</span>
              )}
              {!settings.quickFire && settings.timerSeconds == null && (
                <span className="pill">Auto timer</span>
              )}
              {settings.maxRedactions != null && <span className="pill">max {settings.maxRedactions} edits</span>}
              {state.votingEnabled && <span className="pill">Voting on</span>}
            </div>
          </div>
        )}
      </div>

      {/* Right: newsroom roster */}
      <div className="card p-5 h-fit">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-ink/25">
          <div className="kicker text-xs">The Newsroom</div>
          <span className="badge">{state.players.filter((p) => p.connected).length} on the floor</span>
        </div>
        <PlayerList players={state.players} meId={room.playerId} />
        <p className="text-xs text-ink3 mt-3 italic">Any staffer may file a screenshot for the next edition.</p>
      </div>
    </div>
  );
}

function formatSecs(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function SettingRow({ title, hint, control }: { title: string; hint: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-[3px] card-inset">
      <div className="min-w-0">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-ink3">{hint}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
