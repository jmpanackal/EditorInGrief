import { useEffect, useState, type MouseEvent } from 'react';
import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { RoomInvite } from './RoomInvite';
import { RoundDownload } from './Recap';
import { ExpandableImage } from './ExpandableImage';
import { copyImageFromUrl, type CopyImageResult } from '../lib/copyImage';
import {
  formatRoundDuration,
  timerModeLabel,
  VERDICT_REACTION_EMOJIS,
  type Player,
  type Submission,
  type VerdictReactionEmoji,
} from '../../shared/types';

export function Scoreboard({ room }: { room: RoomApi }) {
  const state = room.state!;
  const round = state.currentRound;
  const voting = state.votingEnabled;

  const results = round ? [...round.submissions].sort((a, b) => b.votesCount - a.votesCount) : [];
  const topVotes = results[0]?.votesCount ?? 0;

  // Latest finished round for download — history upserts the current scoreboard round.
  const latestRecap =
    room.history.length > 0
      ? room.history[room.history.length - 1]
      : null;

  const filed = results.length;
  const durationLabel = round
    ? formatRoundDuration(round.timerSeconds, round.untimed)
    : null;
  const modeLabel = round
    ? round.untimed
      ? 'No limit'
      : timerModeLabel(round.timerMode)
    : null;

  const winner =
    voting && topVotes > 0
      ? results.find((s) => s.votesCount === topVotes)
      : undefined;
  const winnerNick = winner
    ? state.players.find((p) => p.id === winner.playerId)?.nickname
    : undefined;

  const toastParts = [
    `${filed} filed`,
    voting ? 'voting on' : 'voting off',
    modeLabel && durationLabel
      ? round?.untimed
        ? modeLabel
        : `${modeLabel} · ${durationLabel}`
      : null,
  ].filter(Boolean);

  const playAgainControl = room.isHost ? (
    <div className="relative flex-[1.15] min-w-0 min-h-[2.5rem] md:min-h-0 self-stretch overflow-visible">
      <button
        type="button"
        className="btn-primary w-full h-full text-[15px] sm:text-base md:text-lg !py-2 md:!py-3 !px-3 sm:!px-4 leading-tight whitespace-nowrap"
        onClick={room.returnToLobby}
      >
        Play again →
      </button>
    </div>
  ) : (
    <div className="flex-1 min-w-0 text-center px-2 py-2 md:py-2">
      <div className="text-sm font-bold text-ink3 uppercase tracking-wide">Holding copy</div>
      <div className="text-sm text-ink3 italic">Waiting for the host to play again…</div>
    </div>
  );

  return (
    // Locked to the remaining dvh (App sets overflow-hidden for scoreboard).
    // Mobile (<md): Lobby-style one screen — player rail / scrollable edition / Invite+Play bar.
    // Desktop (md+): 2-column Players + edition (Invite under roster) — same visual language as Lobby.
    <div className="flex flex-col md:grid md:grid-cols-[340px_1fr] gap-2 sm:gap-3 md:gap-4 animate-fade-up min-w-0 flex-1 min-h-0 h-full">
      {/* —— Mobile top: compact horizontal player rail —— */}
      <div className="md:hidden shrink-0 grow-0 card px-2 py-1 flex flex-col gap-0.5 min-w-0 max-h-[45%]">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span className="kicker text-[9px] leading-none">{voting ? 'Standings' : 'In the room'}</span>
            <span className="font-display font-black text-sm leading-none tracking-tight">
              {voting ? 'Scores' : 'Players'}
            </span>
          </div>
        </div>
        <div className="min-h-0">
          <PlayerList
            layout="rail"
            players={state.players}
            meId={room.playerId}
            maxPlayers={state.maxPlayers}
            showScores={voting}
            canRemove={room.isHost}
            onRemove={room.removePlayer}
          />
        </div>
      </div>

      {/* —— Desktop left: roster + Invite (same shell as Lobby) —— */}
      <div className="hidden md:flex flex-col gap-2 min-w-0 h-full min-h-0">
        <div className="card p-3 flex flex-col gap-2 shrink-0 grow-0 max-h-[50%] min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-ink/25 shrink-0">
            <div className="min-w-0">
              <div className="kicker text-[10px]">{voting ? 'Standings' : 'In the room'}</div>
              <h2 className="font-display font-black text-xl leading-none tracking-tight mt-0.5">
                {voting ? 'Scores' : 'Players'}
              </h2>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto themed-scroll pr-0.5 -mr-0.5">
            <PlayerList
              players={state.players}
              meId={room.playerId}
              maxPlayers={state.maxPlayers}
              showScores={voting}
              canRemove={room.isHost}
              onRemove={room.removePlayer}
            />
          </div>
        </div>
        <div className="shrink-0">
          <RoomInvite code={state.code} />
        </div>
      </div>

      {/* —— Middle: edition scrolls; bottom bar always visible —— */}
      <div className="flex flex-col gap-2 min-w-0 flex-1 min-h-0 md:h-full">
        {/* Single-edit tightens gaps; height-capped clips keep md from needing a
            dead scrollbar. overflow-y-auto stays so mobile stack can still scroll. */}
        <div
          className={`card p-3 sm:p-4 flex flex-col min-w-0 flex-1 min-h-0 overflow-y-auto themed-scroll ${
            filed === 1 ? 'gap-1.5 sm:gap-2' : 'gap-2'
          }`}
        >
          {/* 3-col header: title centered (Today’s Story scale); download desktop-only on the right */}
          <div
            className={`shrink-0 grid grid-cols-[1fr_auto_1fr] items-start gap-2 ${
              filed === 1 ? 'mb-0' : 'mb-1'
            }`}
          >
            <div aria-hidden className="min-w-0" />
            <header className="text-center px-2">
              <div className="kicker text-[10px] sm:text-[11px] flex items-center justify-center gap-2">
                <span className="hr-thin w-6 sm:w-8" />
                Story No. {state.roundNumber}
                <span className="hr-thin w-6 sm:w-8" />
              </div>
              <h1 className="font-display font-black text-lg sm:text-2xl leading-none tracking-tight mt-1">
                Final Edition
              </h1>
              <div className="hr-double my-1 sm:my-1.5 mx-auto w-14 sm:w-24" />
              {winnerNick && (
                <p className="font-display font-black text-grief text-sm">
                  Crowd favorite: {winnerNick}
                </p>
              )}
              <p className="mt-1 text-xs sm:text-sm text-ink3 font-slab tracking-wide">
                {toastParts.join(' · ')}
              </p>
            </header>
            <div className="hidden md:block justify-self-end min-w-0">
              {latestRecap && <RoundDownload recap={latestRecap} code={state.code} />}
            </div>
          </div>

          {!round || !state.currentSource ? (
            <div className="text-ink3 py-6 text-center italic">No copy filed this round.</div>
          ) : (
            <VerdictGallery
              originalSrc={state.currentSource.imageUrl}
              results={results}
              players={state.players}
              voting={voting}
              topVotes={topVotes}
              reactions={round.reactions ?? {}}
              meId={room.playerId}
              onReact={room.react}
            />
          )}
        </div>

        {/* Bottom action bar — Invite (mobile) + Play again (Lobby Start Editing sizing) */}
        <div className="shrink-0 card overflow-visible p-1.5 md:p-2 shadow-clip flex items-stretch gap-1.5 md:gap-1.5 min-h-0">
          <div className="flex-[1.25] min-w-0 md:hidden self-stretch overflow-visible">
            <RoomInvite code={state.code} compact />
          </div>
          {playAgainControl}
        </div>
      </div>
    </div>
  );
}

type VerdictItem = {
  id: string;
  src: string;
  alt: string;
  label: string;
  editCount?: number;
  votes?: number;
  isWinner?: boolean;
  dashed?: boolean;
  featured?: boolean;
};

function VerdictGallery({
  originalSrc,
  results,
  players,
  voting,
  topVotes,
  reactions,
  meId,
  onReact,
}: {
  originalSrc: string;
  results: Submission[];
  players: Player[];
  voting: boolean;
  topVotes: number;
  reactions: Record<string, Record<string, string[]>>;
  meId: string | null;
  onReact: (submissionId: string, emoji: VerdictReactionEmoji) => void;
}) {
  const playerItems: VerdictItem[] = results.map((s) => {
    const p = players.find((pl) => pl.id === s.playerId);
    const isWinner = voting && s.votesCount > 0 && s.votesCount === topVotes;
    return {
      id: s.id,
      src: s.editedImageUrl,
      alt: `${p?.nickname ?? 'Player'}'s redaction`,
      label: p?.nickname ?? '—',
      editCount: s.editCount ?? 0,
      votes: voting ? s.votesCount : undefined,
      isWinner,
    };
  });

  const editCount = playerItems.length;

  // Single-edit on md+: Original + edit side-by-side so the wide middle column
  // isn't wasted. Mobile stays stacked. Both clips share the Original height
  // cap so a tall submission doesn't force a dead middle scrollbar.
  if (editCount === 1) {
    const only = playerItems[0]!;
    return (
      <div
        className="flex flex-col md:grid md:grid-cols-2 gap-2 md:gap-3 items-start md:items-stretch w-full max-w-6xl mx-auto md:min-h-0 md:flex-1"
        data-verdict="gallery"
      >
        <div className="w-full min-w-0 md:min-h-0" data-verdict="original">
          <VerdictClip
            src={originalSrc}
            alt="Original source image"
            label="Original"
            dashed
            featured
          />
        </div>
        <div className="w-full min-w-0 md:min-h-0" data-verdict="edits">
          <VerdictClip
            key={only.id}
            {...only}
            submissionId={only.id}
            reactionMap={reactions[only.id]}
            meId={meId}
            onReact={onReact}
            heightCapped
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full flex justify-center" data-verdict="original">
        <div
          className={`w-full flex flex-col mx-auto ${
            editCount === 2 ? 'max-w-5xl' : 'max-w-3xl'
          }`}
        >
          <VerdictClip
            src={originalSrc}
            alt="Original source image"
            label="Original"
            dashed
            featured
          />
        </div>
      </div>

      {editCount > 0 && (
        <div className="w-full" data-verdict="edits">
          <div
            className={`w-full grid gap-3 content-start items-start ${
              editCount === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-5xl mx-auto'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {playerItems.map((item) => (
              <VerdictClip
                key={item.id}
                {...item}
                submissionId={item.id}
                reactionMap={reactions[item.id]}
                meId={meId}
                onReact={onReact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VerdictClip({
  src,
  alt,
  label,
  editCount,
  votes,
  isWinner = false,
  dashed = false,
  featured = false,
  heightCapped = false,
  submissionId,
  reactionMap,
  meId,
  onReact,
}: Omit<VerdictItem, 'id'> & {
  submissionId?: string;
  reactionMap?: Record<string, string[]>;
  meId?: string | null;
  onReact?: (submissionId: string, emoji: VerdictReactionEmoji) => void;
  /** Match Original max-h (single-edit gallery) so tall edits don't overflow. */
  heightCapped?: boolean;
}) {
  const showReactions = !!submissionId && !!onReact && !featured;
  const capHeight = featured || heightCapped;

  return (
    <div
      className={`group/clip relative rounded-[3px] overflow-hidden bg-papercard min-w-0 ${
        featured
          ? 'border-[3px] border-dashed border-grief shadow-clip'
          : dashed
            ? 'border-2 border-dashed border-ink'
            : isWinner
              ? 'border-2 border-grief shadow-clip'
              : 'border-2 border-ink'
      }`}
    >
      {featured && (
        <span className="absolute top-2 left-2 z-10 stamp !px-2.5 !py-1 text-[12px] animate-stamp-in">
          Original
        </span>
      )}
      {isWinner && !featured && (
        <span className="absolute top-2 left-2 z-10 stamp !px-2 !py-0.5 text-[11px] animate-stamp-in">
          Extra!
        </span>
      )}
      {/* Same ♥ badge as lobby source-shelf voting — compact overlay, top-right of image. */}
      {votes !== undefined && (
        <span
          className="absolute top-2 right-2 z-10 inline-flex items-center justify-center gap-0.5 min-w-[2.25rem] h-8 px-2 rounded-full bg-grief text-paper border-2 border-ink text-sm font-extrabold leading-none shadow-clip tabular-nums"
          aria-label={`${votes} votes`}
        >
          ♥ {votes}
        </span>
      )}
      <CopyImageButton
        src={src}
        filename={featured ? 'original.png' : `${slugFilename(label)}.png`}
        label={label}
        /* Sit below the ♥ badge when voting is on so top-right stays readable. */
        className={votes !== undefined ? 'top-12 right-2' : 'top-2 right-2'}
      />
      <ExpandableImage
        src={src}
        alt={alt}
        showHint
        // Featured / single-edit: cap height on md+ so Original + one submission
        // stay in the middle panel without a dead scrollbar. Mobile keeps a
        // softer cap (middle region may still scroll). Same max-h + object-contain
        // pattern as Lobby source previews (w-auto so aspect ratio holds).
        className={
          capHeight
            ? 'max-h-[min(48dvh,26rem)] md:max-h-[min(34dvh,18rem)] w-auto max-w-full mx-auto h-auto object-contain bg-paper2'
            : 'w-full h-auto object-contain bg-paper2'
        }
      />
      <div
        className={`px-3 py-2 flex items-center gap-2 border-t-2 shrink-0 ${
          featured
            ? 'border-dashed border-grief bg-grief/5'
            : dashed
              ? 'border-dashed border-ink'
              : 'border-ink'
        }`}
      >
        <div className="min-w-0 shrink flex flex-col gap-0.5">
          <span
            className={`truncate ${
              featured
                ? 'font-display font-black tracking-wide uppercase text-base sm:text-lg'
                : 'font-display font-black text-lg sm:text-xl'
            }`}
          >
            {label}
          </span>
          {/* Byline under nickname — clear of ♥ badge, EXTRA stamp, and reaction pills. */}
          {editCount != null && !featured && (
            <span className="kicker text-[10px] sm:text-[11px] text-ink3 tracking-wide tabular-nums">
              {editCount} edit{editCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {showReactions && (
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {VERDICT_REACTION_EMOJIS.map((emoji) => {
              const reactors = reactionMap?.[emoji] ?? [];
              const count = reactors.length;
              const mine = !!meId && reactors.includes(meId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact!(submissionId!, emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 leading-none transition-colors ${
                    mine
                      ? 'border-grief bg-grief/10'
                      : 'border-ink/20 bg-papercard hover:border-ink/50'
                  }`}
                  aria-label={`React ${emoji}`}
                  aria-pressed={mine}
                  title={emoji}
                >
                  <span aria-hidden className="text-lg">
                    {emoji}
                  </span>
                  {count > 0 && (
                    <span className="tabular-nums text-xs font-bold text-ink2">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function slugFilename(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'submission';
}

const COPY_FEEDBACK: Record<CopyImageResult, string> = {
  copied: 'Copied',
  downloaded: 'Saved',
  'url-copied': 'Link',
};

/** Small letterpress copy control — hover on fine pointers; always visible on touch. */
function CopyImageButton({
  src,
  filename,
  label,
  className = '',
}: {
  src: string;
  filename: string;
  /** Submitter nickname (or "Original") burned into the copied/saved PNG. */
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(t);
  }, [flash]);

  const onCopy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const result = await copyImageFromUrl(src, filename, label);
      setFlash(COPY_FEEDBACK[result]);
    } catch {
      setFlash('Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={busy}
      aria-label="Copy image"
      title="Copy image"
      className={`absolute z-20 px-2 py-1 text-[10px] sm:text-[11px] font-slab font-bold uppercase tracking-wide
        rounded-[2px] bg-papercard text-ink border-2 border-ink shadow-press
        hover:bg-paper2 active:translate-x-px active:translate-y-px active:shadow-none
        disabled:opacity-50 transition-opacity
        opacity-100
        [@media(hover:hover)_and_(pointer:fine)]:opacity-0
        [@media(hover:hover)_and_(pointer:fine)]:group-hover/clip:opacity-100
        [@media(hover:hover)_and_(pointer:fine)]:focus-visible:opacity-100
        [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/clip:opacity-100
        ${className}`}
    >
      {busy ? '…' : flash ?? 'Copy'}
    </button>
  );
}
