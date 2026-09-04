import { useState } from 'react';
import {
  CUSTOM_TIMER_MAX,
  CUSTOM_TIMER_MIN,
  MAX_PLAYERS,
  MIN_PLAYERS,
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
import { RoomInvite } from './RoomInvite';
import { SourceUpload } from './SourceUpload';
import { Toggle } from './ui/Toggle';
import { useSeedBank } from '../lib/seedBank';

const LENGTH_OPTIONS: { mode: TimerMode; label: string; sub: string }[] = [
  { mode: 'quick', label: 'Quick', sub: formatSecs(TIMER_QUICK_SECONDS) },
  { mode: 'normal', label: 'Normal', sub: formatSecs(TIMER_NORMAL_SECONDS) },
  { mode: 'long', label: 'Long', sub: formatSecs(TIMER_LONG_SECONDS) },
  { mode: 'auto', label: 'Auto', sub: 'by text' },
  { mode: 'custom', label: 'Custom', sub: 'pick' },
];

/** Below this many connected players, Start prompts a "you sure?" confirm —
 * the game technically works solo, but reveal/voting need company to shine. */
const SOLO_WARNING_THRESHOLD = 2;

type LobbyTab = 'source' | 'settings';

export function Lobby({ room }: { room: RoomApi }) {
  const state = room.state!;
  const settings = state.roundSettings;
  const connectedCount = state.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= 1;
  const [showSoloConfirm, setShowSoloConfirm] = useState(false);
  const [tab, setTab] = useState<LobbyTab>('source');

  const limit = settings.maxRedactions ?? 0;
  const setLimit = (n: number) => {
    const v = Math.max(0, Math.min(99, Math.floor(n)));
    room.setRoundSettings({ maxRedactions: v > 0 ? v : null });
  };

  const setSettings = (partial: Partial<RoundSettings>) => room.setRoundSettings(partial);

  const setMaxPlayers = (n: number) => {
    room.setMaxPlayers(Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)));
  };

  const handleStartClick = () => {
    if (connectedCount < SOLO_WARNING_THRESHOLD) { setShowSoloConfirm(true); return; }
    room.startRound();
  };

  // Under the new "always ≥2 candidates" shelf, a selection (real or a
  // wire-photo filler) is always literally IN pendingSources — see
  // gameStore.syncFillerSlots — so a single lookup covers both.
  const seedBank = useSeedBank();
  const selectedSource = state.selectedSourceId ? state.pendingSources.find((source) => source.id === state.selectedSourceId) : null;
  const wordCount = selectedSource?.wordCount ?? 0;
  const autoEstimate = wordCount > 0 ? computeTimerSeconds(wordCount) : null;
  const resolvedPreview = resolveRoundTimerSeconds(settings, wordCount);
  const lengthDisabled = settings.untimed;

  // What Start Editing will actually use — mirrors the server's pickSource
  // priority (explicit host pick > most-voted > random from the shelf) so
  // the host never has to guess what "Start" is about to do.
  const votedCounts = new Map<string, number>();
  for (const sid of Object.values(state.sourceVotes)) votedCounts.set(sid, (votedCounts.get(sid) ?? 0) + 1);
  const topVoted = state.pendingSources
    .map((s) => ({ source: s, votes: votedCounts.get(s.id) ?? 0 }))
    .filter((entry) => entry.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.source.createdAt - b.source.createdAt)[0]?.source;
  const ownerName = (playerId: string | null) => state.players.find((p) => p.id === playerId)?.nickname ?? 'Someone';
  const seedLabel = (id: string) => seedBank.find((s) => s.id === id)?.label ?? 'a wire photo';
  const describeSource = (source: NonNullable<typeof selectedSource>) =>
    source.uploadedBy ? `filed by ${ownerName(source.uploadedBy)}` : `"${seedLabel(source.id)}"`;
  // On Round settings the shelf isn't visible — don't say "below".
  const nextStoryLabel = selectedSource
    ? `Host's pick — ${describeSource(selectedSource)}`
    : topVoted
      ? `Most-voted — ${describeSource(topVoted)}`
      : tab === 'source'
        ? 'Random pick from the shelf below'
        : 'Random pick from the Source tab';

  return (
    <div className="grid gap-4 md:grid-cols-[340px_1fr] animate-fade-up">
      {/* Left: the newsroom roster — Gartic puts players on the left, settings
          on the right. On narrow screens the Host's actual task (source /
          settings) comes first instead; the roster follows. Both columns are
          sized to their own natural content (grid's default item sizing) —
          the right column is typically much taller, and earlier attempts to
          stretch/match the two via flex-1+min-h-0 chains caused a deeply
          nested min-height to silently overflow past an ancestor's box (see
          the source-material card below). max-h + overflow-y-auto locally
          (here, and on the card) is simpler and doesn't have that failure
          mode. */}
      <div className="order-2 md:order-1 flex flex-col gap-2">
        <div className="card p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-ink/25">
            <div className="kicker text-sm">The Newsroom</div>
            {/* Big, hard-to-miss occupancy readout — not a small pill. */}
            <div className="flex items-baseline gap-0.5">
              <span className="font-display font-black text-2xl text-grief leading-none">{connectedCount}</span>
              <span className="font-display font-bold text-base text-ink3 leading-none">/{state.maxPlayers}</span>
            </div>
          </div>

          {room.isHost && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[3px] card-inset">
              <div className="text-sm font-bold">Max players</div>
              <div className="flex items-center gap-1">
                <button className="btn-secondary w-9 h-9 !px-0 !py-0 text-lg" onClick={() => setMaxPlayers(state.maxPlayers - 1)} disabled={state.maxPlayers <= Math.max(MIN_PLAYERS, connectedCount)}>−</button>
                <span className="w-8 text-center tabular-nums font-display font-bold text-lg">{state.maxPlayers}</span>
                <button className="btn-secondary w-9 h-9 !px-0 !py-0 text-lg" onClick={() => setMaxPlayers(state.maxPlayers + 1)} disabled={state.maxPlayers >= MAX_PLAYERS}>+</button>
              </div>
            </div>
          )}

          {/* Scrolls once the roster (real + empty seats) runs past ~10 rows
              at this card size, instead of stretching the whole page taller. */}
          <div className="max-h-[26rem] overflow-y-auto themed-scroll pr-0.5 -mr-0.5">
            <PlayerList players={state.players} meId={room.playerId} canRemove={room.isHost} onRemove={room.removePlayer} maxPlayers={state.maxPlayers} />
          </div>
          <p className="text-sm text-ink3 italic leading-snug">Any staffer may file a screenshot for the next edition.</p>
        </div>

        {/* Live room code is the invite target (copies join link); QR is
            secondary. Kept under the roster so hosts reach for it right
            after seeing who's here — not buried under source/settings. */}
        <RoomInvite code={state.code} />
      </div>

      {/* Right: source + settings as folder tabs directly attached to the
          panel below (Gartic's Presets/Custom-Settings pattern), then a
          pinned Start bar. */}
      {/* A separate "waiting on host" banner used to live here — for anyone
          but the host it was pure extra height with nothing actionable in
          it, and on shorter screens that alone was enough to force a
          scroll. The Start-bar area below already swaps in an "Awaiting the
          Host…" line for non-hosts, so that's the one place this needs to
          say anything. */}
      <div className="order-1 md:order-2 flex flex-col gap-3">
        <div className="flex flex-col">
          <div className="flex" role="tablist">
            <TabButton label="Source Material" active={tab === 'source'} onClick={() => setTab('source')} />
            <TabButton label="Round settings" active={tab === 'settings'} onClick={() => setTab('settings')} />
          </div>

          {/* Fixed height at md+ (not just a cap) so the panel doesn't
              visibly resize when switching Source Material <-> Round
              Settings — the far shorter settings content just leaves
              blank space below instead of shrinking the box. Content
              taller than this (more filed screenshots) scrolls internally
              instead of growing the page.

              The height itself is viewport-responsive rather than a flat
              42rem: a flat value made BOTH tabs always claim the full
              height — fine on a tall window, but on a shorter one that's
              taller than everything else combined actually leaves room
              for, which is exactly what brought the page-level scrollbar
              back. min(42rem, 100dvh - ~18.5rem-for-everything-else) still
              gives every tab the identical height (still purely
              viewport-driven, not content-driven — the "no resize between
              tabs" guarantee is untouched), it just scales that shared
              height down on shorter windows instead of forcing a size
              that doesn't fit. ~18.5rem covers the header, main padding,
              tab bar, "Next story" line and Start bar; shorter shelf
              thumbnails keep the 2-card base state near the fold. */}
          <div className="card !rounded-tl-none -mt-px p-3 flex flex-col gap-2.5 md:h-[min(42rem,calc(100dvh_-_18.5rem))] md:overflow-y-auto themed-scroll">
            {tab === 'source' ? (
              // "Choose Today's Story" (inside SourceUpload's shelf) is
              // already the section title — an outer kicker here was just
              // repeating it.
              <SourceUpload room={room} />
            ) : (
              // Everyone sees the real settings panel now, not a condensed
              // pill summary for non-hosts — same layout, same "size never
              // changes between tabs" guarantee either way. Non-hosts just
              // get every control disabled (still legible/inspectable, not
              // interactive) since only the host can change these.
              <div className={`flex flex-col gap-2.5 ${!room.isHost ? 'opacity-70' : ''}`}>
                <SettingRow
                  icon="🗳️"
                  title="Voting"
                  hint={state.votingEnabled ? 'On — a ballot follows every round' : 'Off — just for laughs'}
                  control={<Toggle checked={state.votingEnabled} onChange={room.setVoting} disabled={!room.isHost} aria-label="Enable voting" />}
                />

                <SettingRow
                  icon="⏰"
                  title="Deadline"
                  hint={settings.untimed ? 'No deadline — file whenever ready' : 'Timed — a countdown applies'}
                  control={
                    <Toggle
                      checked={settings.untimed}
                      onChange={(v) => setSettings({ untimed: v })}
                      disabled={!room.isHost}
                      aria-label="No time limit"
                    />
                  }
                />

                <SettingRow
                  icon="✂️"
                  title="Redaction limit"
                  hint={limit === 0 ? 'Unlimited — no cap this round' : `${limit} redaction${limit === 1 ? '' : 's'} max this round`}
                  control={
                    <div className="flex items-center gap-1">
                      <button className="btn-secondary w-8 h-8 !px-0 !py-0 text-lg" onClick={() => setLimit(limit - 1)} disabled={!room.isHost || limit <= 0}>−</button>
                      <span className="w-8 text-center tabular-nums font-display font-bold text-lg" title={limit === 0 ? 'Unlimited' : undefined}>{limit === 0 ? '∞' : limit}</span>
                      <button className="btn-secondary w-8 h-8 !px-0 !py-0 text-lg" onClick={() => setLimit(limit + 1)} disabled={!room.isHost}>+</button>
                    </div>
                  }
                />

                {/* Round length */}
                <div className={`flex items-center gap-3 ${ROUND_SETTING_CARD} ${lengthDisabled ? 'opacity-55' : ''}`}>
                  <span className="text-xl shrink-0" aria-hidden>⏱️</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold">Round length</div>
                    <div className="text-sm text-ink3 truncate mb-2">
                      {lengthDisabled
                        ? 'Doesn’t apply while there’s no deadline.'
                        : settings.timerMode === 'auto'
                          ? autoEstimate != null
                            ? `Scales with text — about ${formatSecs(autoEstimate)} for this source.`
                            : 'Scales with how much text is in the image.'
                          : settings.timerMode === 'custom'
                            ? `Host-picked deadline: ${formatSecs(settings.customSeconds)}.`
                            : `${timerModeLabel(settings.timerMode)} — ${formatSecs(resolvedPreview)} per round.`}
                    </div>

                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Round length">
                      {LENGTH_OPTIONS.map(({ mode, label, sub }) => (
                        <button
                          key={mode}
                          type="button"
                          className="segmented-item !px-2.5 !py-1.5 flex flex-col items-center leading-tight gap-0.5"
                          data-active={String(settings.timerMode === mode && !lengthDisabled)}
                          disabled={lengthDisabled || !room.isHost}
                          onClick={() => setSettings({ timerMode: mode })}
                        >
                          <span>{label}</span>
                          <span className="text-[10px] font-semibold normal-case tracking-normal opacity-80">{sub}</span>
                        </button>
                      ))}
                    </div>

                    {settings.timerMode === 'custom' && !lengthDisabled && (
                      <div className="mt-2">
                        <CustomTimePicker
                          seconds={settings.customSeconds}
                          onChange={(secs) => setSettings({ customSeconds: secs })}
                          disabled={!room.isHost}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* mt-auto aligns this with the newsroom panel's bottom edge on
            mobile (where the tab panel above isn't flex-1). No longer
            sticky — the layout is height-bound now, so this never needs to
            float over scrolling content, and sticky was making it overlap
            the "Next story" line above it. */}
        <div className="mt-auto md:mt-0 shrink-0 flex flex-col gap-1.5">
          <p className="text-base text-ink2 text-center px-1 leading-snug">
            📰 <b>Next story:</b> {nextStoryLabel}
          </p>
          <div className="card p-2 shadow-clip flex items-center gap-2">
            {room.isHost ? (
              <button className="btn-primary text-lg py-3 flex-1" disabled={!canStart} onClick={handleStartClick}>
                Start Editing →
              </button>
            ) : (
              <span className="flex-1 text-center text-base text-ink3 italic">Awaiting the Host…</span>
            )}
          </div>
        </div>
      </div>

      {showSoloConfirm && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 p-4 grid place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm starting with few players"
          onMouseDown={() => setShowSoloConfirm(false)}
        >
          <div className="card w-full max-w-sm p-6 flex flex-col items-center gap-3 text-center shadow-clip" onMouseDown={(e) => e.stopPropagation()}>
            <div className="stamp stamp-ink animate-stamp-in text-sm">Hold on</div>
            <h2 className="font-display font-black text-xl mt-1">Fly solo?</h2>
            <p className="text-sm text-ink2">
              Editor in Grief is funnier with a full newsroom — right now it's just {connectedCount === 1 ? 'you' : `${connectedCount} of you`}.
              Start anyway?
            </p>
            <div className="flex items-center gap-2 mt-2 w-full">
              <button className="btn-secondary flex-1" onClick={() => setShowSoloConfirm(false)}>Wait for more</button>
              <button
                className="btn-primary flex-1"
                onClick={() => { setShowSoloConfirm(false); room.startRound(); }}
              >
                Start anyway →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A folder-tab attached to the panel below it (Gartic's Presets/Custom
 * Settings tabs): the active tab shares the panel's border and background
 * with no seam; inactive tabs sit slightly recessed. */
function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative px-5 py-2.5 text-base font-slab font-bold uppercase tracking-wide border-2 rounded-t-[4px] transition-colors -mb-px ${
        active
          ? 'bg-papercard border-ink border-b-papercard text-ink z-10'
          : 'bg-paper2 border-ink/30 border-b-ink text-ink3 hover:text-ink hover:bg-paper3'
      }`}
    >
      {label}
    </button>
  );
}

function CustomTimePicker({
  seconds,
  onChange,
  disabled,
}: {
  seconds: number;
  onChange: (secs: number) => void;
  disabled?: boolean;
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
          className="field !py-1.5 !px-2 w-14 text-center tabular-nums disabled:opacity-50"
          value={mins}
          aria-label="Minutes"
          disabled={disabled}
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
          className="field !py-1.5 !px-2 w-14 text-center tabular-nums disabled:opacity-50"
          value={secs}
          aria-label="Seconds"
          disabled={disabled}
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

/** Shared shell so Voting / Deadline / Redaction match Round length’s taller
 *  card (title + hint + mode pills). Content stays vertically centered. */
const ROUND_SETTING_CARD =
  'px-3.5 py-2.5 rounded-[3px] card-inset min-h-[7.5rem]';

function SettingRow({ icon, title, hint, control }: { icon?: string; title: string; hint: string; control: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${ROUND_SETTING_CARD}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="text-xl shrink-0" aria-hidden>{icon}</span>}
        <div className="min-w-0">
          <div className="text-base font-bold">{title}</div>
          <div className="text-sm text-ink3">{hint}</div>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
