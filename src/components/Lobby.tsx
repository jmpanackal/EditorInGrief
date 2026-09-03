import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CUSTOM_TIMER_MAX,
  CUSTOM_TIMER_MIN,
  TIMER_LONG_SECONDS,
  TIMER_NORMAL_SECONDS,
  TIMER_QUICK_SECONDS,
  computeTimerSeconds,
  resolveRoundTimerSeconds,
  timerModeLabel,
  type RoundSettings,
  type TimerMode,
} from '@shared/types';
import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { SourceUpload } from './SourceUpload';
import { Toggle } from './ui/Toggle';

const LENGTH_OPTIONS: { mode: TimerMode; label: string; sub: string }[] = [
  { mode: 'quick', label: 'Quick', sub: formatSecs(TIMER_QUICK_SECONDS) },
  { mode: 'normal', label: 'Normal', sub: formatSecs(TIMER_NORMAL_SECONDS) },
  { mode: 'long', label: 'Long', sub: formatSecs(TIMER_LONG_SECONDS) },
  { mode: 'auto', label: 'Auto', sub: 'by text' },
  { mode: 'custom', label: 'Custom', sub: 'pick' },
];

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

  const setSettings = (partial: Partial<RoundSettings>) => room.setRoundSettings(partial);

  const wordCount = state.pendingSource?.wordCount ?? 0;
  const autoEstimate = state.pendingSource
    ? computeTimerSeconds(state.pendingSource.wordCount)
    : null;
  const resolvedPreview = resolveRoundTimerSeconds(settings, wordCount);
  const lengthDisabled = settings.untimed;

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

            <SettingRow
              title="Enable voting"
              hint="Off by default — just for laughs"
              control={<Toggle checked={state.votingEnabled} onChange={room.setVoting} aria-label="Enable voting" />}
            />

            <SettingRow
              title="No time limit"
              hint="Finish when everyone has filed — no countdown"
              control={
                <Toggle
                  checked={settings.untimed}
                  onChange={(v) => setSettings({ untimed: v })}
                  aria-label="No time limit"
                />
              }
            />

            {/* Round length */}
            <div className={`px-3.5 py-3 rounded-[3px] card-inset flex flex-col gap-3 ${lengthDisabled ? 'opacity-55' : ''}`}>
              <div className="min-w-0">
                <div className="text-sm font-bold">Round length</div>
                <div className="text-xs text-ink3">
                  {lengthDisabled
                    ? 'Doesn’t apply while there’s no time limit.'
                    : settings.timerMode === 'auto'
                      ? autoEstimate != null
                        ? `Scales with how much text is in the image — about ${formatSecs(autoEstimate)} for this source.`
                        : 'Scales with how much text is in the image (usually about 1–3½ minutes).'
                      : settings.timerMode === 'custom'
                        ? `Host-picked deadline: ${formatSecs(settings.customSeconds)}.`
                        : `${timerModeLabel(settings.timerMode)} — ${formatSecs(resolvedPreview)} per round.`}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Round length">
                {LENGTH_OPTIONS.map(({ mode, label, sub }) => (
                  <button
                    key={mode}
                    type="button"
                    className="segmented-item !px-2.5 flex flex-col items-center leading-tight gap-0.5"
                    data-active={String(settings.timerMode === mode && !lengthDisabled)}
                    disabled={lengthDisabled}
                    onClick={() => setSettings({ timerMode: mode })}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] font-semibold normal-case tracking-normal opacity-80">{sub}</span>
                  </button>
                ))}
              </div>

              {settings.timerMode === 'custom' && !lengthDisabled && (
                <CustomTimePicker
                  seconds={settings.customSeconds}
                  onChange={(secs) => setSettings({ customSeconds: secs })}
                />
              )}
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
              {settings.untimed ? (
                <span className="pill">No time limit</span>
              ) : (
                <span className="pill">
                  {timerModeLabel(settings.timerMode)}
                  {settings.timerMode !== 'auto' ? ` · ${formatSecs(resolvedPreview)}` : ''}
                </span>
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

function CustomTimePicker({
  seconds,
  onChange,
}: {
  seconds: number;
  onChange: (secs: number) => void;
}) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  const commit = (m: number, s: number) => {
    const total = Math.max(CUSTOM_TIMER_MIN, Math.min(CUSTOM_TIMER_MAX, m * 60 + s));
    onChange(total);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="kicker text-[10px]">Time</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={Math.floor(CUSTOM_TIMER_MAX / 60)}
          className="field !py-1.5 !px-2 w-14 text-center tabular-nums"
          value={mins}
          aria-label="Minutes"
          onChange={(e) => {
            const m = Math.max(0, Math.min(10, Math.floor(Number(e.target.value) || 0)));
            commit(m, secs);
          }}
        />
        <span className="font-display font-bold text-lg">:</span>
        <input
          type="number"
          min={0}
          max={59}
          step={5}
          className="field !py-1.5 !px-2 w-14 text-center tabular-nums"
          value={secs}
          aria-label="Seconds"
          onChange={(e) => {
            const raw = Math.floor(Number(e.target.value) || 0);
            const s = Math.max(0, Math.min(59, raw));
            commit(mins, s);
          }}
        />
      </div>
      <span className="text-xs text-ink3">
        ({formatSecs(CUSTOM_TIMER_MIN)}–{formatSecs(CUSTOM_TIMER_MAX)})
      </span>
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
