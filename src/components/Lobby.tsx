import { useEffect, useRef, useState } from 'react';
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

/** Default when turning the redaction cap on from unlimited. */
const DEFAULT_REDACTION_CAP = 10;
const REDACTION_CAP_MIN = 1;
const REDACTION_CAP_MAX = 100;

/** Below this many connected players, Start prompts a "you sure?" confirm —
 * the game technically works solo, but reveal/voting need company to shine. */
const SOLO_WARNING_THRESHOLD = 2;

type LobbyTab = 'source' | 'settings';

function clampRedactionCap(n: number): number {
  return Math.max(REDACTION_CAP_MIN, Math.min(REDACTION_CAP_MAX, Math.floor(n)));
}

export function Lobby({ room }: { room: RoomApi }) {
  const state = room.state!;
  const settings = state.roundSettings;
  const connectedCount = state.players.filter((p) => p.connected).length;
  const [showSoloConfirm, setShowSoloConfirm] = useState(false);
  const [tab, setTab] = useState<LobbyTab>('source');
  const soloStartBtnRef = useRef<HTMLButtonElement | null>(null);
  // Remember last capped value so toggling Off→On restores a sensible number.
  const [lastCap, setLastCap] = useState(() =>
    settings.maxRedactions != null ? clampRedactionCap(settings.maxRedactions) : DEFAULT_REDACTION_CAP,
  );
  const startBtnRef = useRef<HTMLButtonElement | null>(null);

  const capped = settings.maxRedactions != null;
  const capValue = capped ? clampRedactionCap(settings.maxRedactions!) : lastCap;

  useEffect(() => {
    if (settings.maxRedactions != null) setLastCap(clampRedactionCap(settings.maxRedactions));
  }, [settings.maxRedactions]);

  const setRedactionCapped = (on: boolean) => {
    if (on) {
      const v = clampRedactionCap(lastCap || DEFAULT_REDACTION_CAP);
      setLastCap(v);
      room.setRoundSettings({ maxRedactions: v });
    } else {
      room.setRoundSettings({ maxRedactions: null });
    }
  };

  const setCapValue = (n: number) => {
    const v = clampRedactionCap(n);
    setLastCap(v);
    room.setRoundSettings({ maxRedactions: v });
  };

  const setSettings = (partial: Partial<RoundSettings>) => room.setRoundSettings(partial);

  const setMaxPlayers = (n: number) => {
    room.setMaxPlayers(Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n)));
  };

  // Under the new "always ≥2 candidates" shelf, a selection (real or a
  // wire-photo filler) is always literally IN pendingSources — see
  // gameStore.syncFillerSlots — so a single lookup covers both.
  const seedBank = useSeedBank();
  const selectedSource = state.selectedSourceId ? state.pendingSources.find((source) => source.id === state.selectedSourceId) : null;

  // Most-voted wins; host only breaks a tie among the leading images.
  const votedCounts = new Map<string, number>();
  for (const sid of Object.values(state.sourceVotes)) votedCounts.set(sid, (votedCounts.get(sid) ?? 0) + 1);
  const maxVotes = state.pendingSources.reduce(
    (max, source) => Math.max(max, votedCounts.get(source.id) ?? 0),
    0,
  );
  const leadingSources = state.pendingSources.filter((s) => (votedCounts.get(s.id) ?? 0) === maxVotes);
  const isVoteTie = leadingSources.length > 1;
  const uniqueWinner = maxVotes > 0 && leadingSources.length === 1 ? leadingSources[0] : null;
  const needsTiebreak = maxVotes > 0 && isVoteTie && !selectedSource;
  const canStart = connectedCount >= 1 && !needsTiebreak;

  const nextSource = uniqueWinner ?? selectedSource;
  const activeStoryId = uniqueWinner?.id ?? selectedSource?.id ?? null;
  const wordCount = nextSource?.wordCount ?? 0;
  const autoEstimate = wordCount > 0 ? computeTimerSeconds(wordCount) : null;
  const resolvedPreview = resolveRoundTimerSeconds(settings, wordCount);
  const lengthDisabled = settings.untimed;

  const handleStartClick = () => {
    if (connectedCount < SOLO_WARNING_THRESHOLD) { setShowSoloConfirm(true); return; }
    room.startRound();
  };

  /** After host picks a story, move focus to Start Editing (happy path). */
  const focusStartEditing = () => {
    requestAnimationFrame(() => startBtnRef.current?.focus());
  };

  // Prefer Start anyway so native Enter confirms when the solo dialog is open.
  useEffect(() => {
    if (!showSoloConfirm) return;
    requestAnimationFrame(() => soloStartBtnRef.current?.focus());
  }, [showSoloConfirm]);

  // Enter starts the round when the host isn't typing in a field.
  // Skip when a button already has focus — native Enter activates it.
  useEffect(() => {
    if (!room.isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        t instanceof HTMLButtonElement ||
        (t instanceof HTMLElement && (t.isContentEditable || t.closest('button')))
      ) {
        return;
      }
      if (showSoloConfirm) {
        e.preventDefault();
        setShowSoloConfirm(false);
        room.startRound();
        return;
      }
      if (!canStart) return;
      e.preventDefault();
      if (connectedCount < SOLO_WARNING_THRESHOLD) {
        setShowSoloConfirm(true);
        return;
      }
      room.startRound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [room, canStart, showSoloConfirm, connectedCount]);

  const ownerName = (playerId: string | null) => state.players.find((p) => p.id === playerId)?.nickname ?? 'Someone';
  const seedLabel = (id: string) => seedBank.find((s) => s.id === id)?.label ?? 'a wire photo';
  const describeSource = (source: NonNullable<typeof nextSource>) =>
    source.uploadedBy ? `filed by ${ownerName(source.uploadedBy)}` : `"${seedLabel(source.id)}"`;
  // On Round settings the shelf isn't visible — don't say "below".
  const nextStoryLabel = uniqueWinner
    ? `Most-voted — ${describeSource(uniqueWinner)}`
    : needsTiebreak
      ? 'Tied — host must Choose one'
      : selectedSource && isVoteTie
        ? `Host pick — ${describeSource(selectedSource)}`
        : selectedSource
          ? `Host's pick — ${describeSource(selectedSource)}`
          : tab === 'source'
            ? 'Random from the shelf'
            : 'Random from Source tab';

  const maxPlayersControl = room.isHost ? (
    <div
      className="flex items-center gap-1 shrink-0"
      aria-label={`${connectedCount} of ${state.maxPlayers} players`}
    >
      <span className="font-display font-black text-xl md:text-2xl text-grief leading-none tabular-nums">
        {connectedCount}
      </span>
      <span className="font-display font-bold text-sm md:text-base text-ink3 leading-none">/</span>
      <button
        type="button"
        className="btn-secondary w-7 h-7 md:w-8 md:h-8 !px-0 !py-0 text-base leading-none"
        onClick={() => setMaxPlayers(state.maxPlayers - 1)}
        disabled={state.maxPlayers <= Math.max(MIN_PLAYERS, connectedCount)}
        aria-label="Decrease max players"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center tabular-nums font-display font-black text-xl md:text-2xl text-ink3 leading-none">
        {state.maxPlayers}
      </span>
      <button
        type="button"
        className="btn-secondary w-7 h-7 md:w-8 md:h-8 !px-0 !py-0 text-base leading-none"
        onClick={() => setMaxPlayers(state.maxPlayers + 1)}
        disabled={state.maxPlayers >= MAX_PLAYERS}
        aria-label="Increase max players"
      >
        +
      </button>
    </div>
  ) : (
    <div
      className="flex items-baseline gap-0.5 shrink-0"
      aria-label={`${connectedCount} of ${state.maxPlayers} players`}
    >
      <span className="font-display font-black text-xl md:text-2xl text-grief leading-none">{connectedCount}</span>
      <span className="font-display font-bold text-sm md:text-base text-ink3 leading-none">/{state.maxPlayers}</span>
    </div>
  );

  const settingsPanel = (
    <div className={`flex flex-col gap-2.5 ${!room.isHost ? 'opacity-70' : ''}`}>
      {!room.isHost && (
        <p className="text-sm text-ink3 italic px-0.5">View only — only the host can change these.</p>
      )}
      <SettingRow
        icon="⏰"
        title="Timed round"
        hint={
          settings.untimed
            ? 'Off — file when ready, no time limit'
            : 'On — round length countdown applies'
        }
        control={
          <Toggle
            checked={!settings.untimed}
            onChange={(v) => setSettings({ untimed: !v })}
            disabled={!room.isHost}
            aria-label="Timed round"
          />
        }
      />

      <SettingRow
        icon="⏱️"
        title="Round length"
        className={lengthDisabled ? 'opacity-55' : undefined}
        hint={
          lengthDisabled
            ? 'Doesn’t apply while Timed round is off.'
            : settings.timerMode === 'auto'
              ? autoEstimate != null
                ? `Scales with text — about ${formatSecs(autoEstimate)} for this source.`
                : 'Scales with how much text is in the image.'
              : settings.timerMode === 'custom'
                ? `Host-picked length: ${formatSecs(settings.customSeconds)}.`
                : `${timerModeLabel(settings.timerMode)} — ${formatSecs(resolvedPreview)} per round.`
        }
        control={
          <div className="flex flex-wrap gap-1.5 justify-end" role="group" aria-label="Round length">
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
        }
        footer={
          settings.timerMode === 'custom' && !lengthDisabled ? (
            <div className="mt-2">
              <CustomTimePicker
                seconds={settings.customSeconds}
                onChange={(secs) => setSettings({ customSeconds: secs })}
                disabled={!room.isHost}
              />
            </div>
          ) : undefined
        }
      />

      <SettingRow
        icon="🗳️"
        title="Voting"
        hint={state.votingEnabled ? 'On — a ballot follows every round' : 'Off — just for laughs'}
        control={<Toggle checked={state.votingEnabled} onChange={room.setVoting} disabled={!room.isHost} aria-label="Enable voting" />}
      />

      <SettingRow
        icon="✂️"
        title="Redaction limit"
        hint={
          capped
            ? `Cap at ${capValue} redaction${capValue === 1 ? '' : 's'}`
            : 'Off — unlimited redactions'
        }
        control={
          <Toggle
            checked={capped}
            onChange={setRedactionCapped}
            disabled={!room.isHost}
            aria-label="Cap redactions"
          />
        }
        footer={
          capped ? (
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={REDACTION_CAP_MIN}
                max={REDACTION_CAP_MAX}
                step={1}
                value={capValue}
                disabled={!room.isHost}
                onChange={(e) => setCapValue(Number(e.target.value))}
                className="flex-1 min-w-0 h-2 accent-grief cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Maximum redactions"
                aria-valuemin={REDACTION_CAP_MIN}
                aria-valuemax={REDACTION_CAP_MAX}
                aria-valuenow={capValue}
              />
              <span className="w-9 shrink-0 text-right tabular-nums font-display font-bold text-lg leading-none">
                {capValue}
              </span>
            </div>
          ) : undefined
        }
      />
    </div>
  );

  const renderStartButton = () =>
    room.isHost ? (
      /* Wrapper stays overflow-visible so nothing clips the cue; the chase itself
         rides the padding-box edge (inner side of the black border). */
      <div className="relative flex-[1.15] min-w-0 min-h-[2.5rem] md:min-h-0 self-stretch overflow-visible">
        <button
          ref={startBtnRef}
          className="btn-primary relative isolate overflow-hidden w-full h-full text-[15px] sm:text-base md:text-lg !py-2 md:!py-3 !px-3 sm:!px-4 leading-tight whitespace-nowrap"
          disabled={!canStart}
          onClick={handleStartClick}
        >
          {/* Slow dual-dash perimeter — editorial ink tick, not a neon chase.
              pathLength=1 so dash pattern is size-independent; inset ~½ stroke.
              Speed: --outline-chase-duration in src/index.css (HMR-friendly). */}
          {activeStoryId ? (
            <svg
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full text-paper/28"
              aria-hidden="true"
            >
              <rect
                className="outline-chase"
                x={1}
                y={1}
                width="calc(100% - 2px)"
                height="calc(100% - 2px)"
                rx={3}
                ry={3}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.055 0.445 0.055 0.445"
              />
            </svg>
          ) : null}
          <span className="relative z-[2]">Start Editing →</span>
        </button>
      </div>
    ) : (
      <div className="flex-1 min-w-0 text-center px-2 py-2 md:py-2">
        <div className="text-sm font-bold text-ink3 uppercase tracking-wide">Not editing yet</div>
        <div className="text-sm text-ink3 italic">Waiting for the host to start…</div>
      </div>
    );

  return (
    // Locked to the remaining dvh (App sets overflow-hidden).
    // Mobile (<md): Gartic-style one screen — player rail / tab panel / Invite+Start bar.
    // Desktop (md+): 2-column Players + tabs (unchanged).
    <div className="flex flex-col md:grid md:grid-cols-[340px_1fr] gap-2 sm:gap-3 md:gap-4 animate-fade-up min-w-0 flex-1 min-h-0 h-full">
      {/* —— Mobile top: horizontal player rail + capacity stepper ——
          Content-sized only (never flex-1 / h-full) so it can’t leave a void
          above the tab panel. Cap at ~half viewport if the rail is crowded. */}
      <div className="md:hidden shrink-0 grow-0 card p-2 flex flex-col gap-1.5 min-w-0 max-h-[45%]">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="kicker text-[10px]">In the room</div>
            <h2 className="font-display font-black text-base leading-none tracking-tight mt-0.5">Players</h2>
          </div>
          {maxPlayersControl}
        </div>
        {/* No overflow-y clip here — rail badges (You / host crown) sit above the avatar.
            Horizontal scroll lives on the PlayerList rail itself. */}
        <div className="min-h-0">
          <PlayerList
            layout="rail"
            players={state.players}
            meId={room.playerId}
            canRemove={room.isHost}
            onRemove={room.removePlayer}
            maxPlayers={state.maxPlayers}
          />
        </div>
      </div>

      {/* —— Desktop left: content-sized roster, Invite snug underneath ——
          Do NOT flex-1 the Players card — that left a huge empty gap below
          the folded-seats row and shoved Invite to the column bottom. */}
      <div className="hidden md:flex flex-col gap-2 min-w-0 h-full min-h-0">
        <div className="card p-3 flex flex-col gap-2 shrink-0 grow-0 max-h-[50%] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-ink/25 shrink-0">
            <div className="min-w-0">
              <div className="kicker text-[10px]">In the room</div>
              <h2 className="font-display font-black text-xl leading-none tracking-tight mt-0.5">Players</h2>
            </div>
            {maxPlayersControl}
          </div>
          <div className="min-h-0 overflow-y-auto themed-scroll pr-0.5 -mr-0.5">
            <PlayerList
              players={state.players}
              meId={room.playerId}
              canRemove={room.isHost}
              onRemove={room.removePlayer}
              maxPlayers={state.maxPlayers}
            />
          </div>
          <p className="text-sm text-ink3 italic leading-snug shrink-0">
            Any staffer may file a screenshot for the next edition.
          </p>
        </div>
        <div className="shrink-0">
          <RoomInvite code={state.code} />
        </div>
      </div>

      {/* —— Middle (both): tabbed panel fills remaining height; content scrolls inside —— */}
      <div className="flex flex-col gap-2 min-w-0 flex-1 min-h-0 md:h-full">
        <div className="flex flex-col min-w-0 min-h-0 flex-1 overflow-hidden">
          <div className="flex shrink-0" role="tablist">
            <TabButton label="Source" longLabel="Source Material" active={tab === 'source'} onClick={() => setTab('source')} />
            <TabButton label="Settings" longLabel="Round settings" active={tab === 'settings'} onClick={() => setTab('settings')} />
          </div>

          <div className="card !rounded-tl-none -mt-px p-2 sm:p-3 flex flex-col gap-2 min-w-0 flex-1 min-h-0 overflow-y-auto themed-scroll">
            {tab === 'source' ? (
              <SourceUpload room={room} onHostChose={focusStartEditing} />
            ) : (
              settingsPanel
            )}
          </div>
        </div>

        {/* Bottom action bar — always visible; no page scroll needed.
            One Start control (ref / Enter focus). Invite joins the bar on mobile only. */}
        <div className="shrink-0 flex flex-col gap-1">
          <p className="text-xs sm:text-sm md:text-base text-ink2 text-center px-1 leading-snug">
            📰 <b>Next story:</b> {nextStoryLabel}
          </p>
          <div className="card overflow-visible p-1.5 md:p-2 shadow-clip flex items-stretch gap-1.5 md:gap-1.5 min-h-0">
            <div className="flex-[1.25] min-w-0 md:hidden self-stretch overflow-visible">
              <RoomInvite code={state.code} compact />
            </div>
            {renderStartButton()}
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
                ref={soloStartBtnRef}
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
function TabButton({
  label,
  longLabel,
  active,
  onClick,
}: {
  label: string;
  longLabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative px-3 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base font-slab font-bold uppercase tracking-wide border-2 rounded-t-[4px] transition-colors -mb-px ${
        active
          ? 'bg-papercard border-ink border-b-papercard text-ink z-10'
          : 'bg-paper2 border-ink/30 border-b-ink text-ink3 hover:text-ink hover:bg-paper3'
      }`}
    >
      <span className="sm:hidden">{label}</span>
      <span className="hidden sm:inline">{longLabel}</span>
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

/** Shared shell so Voting / Timed round / Round length / Redaction share the same
 *  inset card rhythm. Label block + controls stay vertically centered. */
const ROUND_SETTING_CARD =
  'px-3.5 py-2.5 rounded-[3px] card-inset min-h-[7.5rem]';

function SettingRow({
  icon,
  title,
  hint,
  control,
  footer,
  className,
}: {
  icon?: string;
  title: string;
  hint: string;
  control: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${ROUND_SETTING_CARD} flex flex-col justify-center ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3 min-w-0">
          {icon && <span className="text-xl shrink-0" aria-hidden>{icon}</span>}
          <div className="min-w-0">
            <div className="text-base font-bold">{title}</div>
            <div className="text-sm text-ink3">{hint}</div>
          </div>
        </div>
        <div className="shrink-0 ml-auto">{control}</div>
      </div>
      {footer}
    </div>
  );
}
