import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { RoomInvite } from './RoomInvite';
import { RoundDownload } from './Recap';
import { ExpandableImage } from './ExpandableImage';
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

  return (
    <div className="grid gap-4 md:grid-cols-[300px_1fr] md:flex-1 md:min-h-0 animate-fade-up">
      {/* Newsroom left — same column order as lobby, with invite chrome. */}
      <div className="order-2 md:order-1 flex flex-col gap-2 md:min-h-0 md:overflow-y-auto">
        <div className="card p-5 h-fit">
          <div className="kicker text-xs mb-3 pb-2 border-b border-ink/25">
            {voting ? 'Standings' : 'The Newsroom'}
          </div>
          <PlayerList
            players={state.players}
            meId={room.playerId}
            showScores={voting}
            canRemove={room.isHost}
            onRemove={room.removePlayer}
          />
          {!voting && (
            <p className="text-xs text-ink3 mt-3 italic">
              Scoring is off. Flip on voting in the newsroom to keep score.
            </p>
          )}
        </div>
        <RoomInvite code={state.code} />
      </div>

      {/* The Verdict — sole main content: this round’s gallery + download + CTAs. */}
      <div className="order-1 md:order-2 card p-5 flex flex-col md:min-h-0 md:overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap shrink-0">
          <div className="text-center flex-1 min-w-[12rem]">
            <div className="kicker text-[11px] flex items-center justify-center gap-2">
              <span className="hr-thin flex-1" /> The Verdict <span className="hr-thin flex-1" />
            </div>
            <div className="font-display font-black text-2xl mt-1">
              Story No. {state.roundNumber} — Final
            </div>
          </div>
          {latestRecap && <RoundDownload recap={latestRecap} code={state.code} />}
        </div>

        {/* One-line round toast + optional silly award */}
        <div className="shrink-0 mb-4 rounded-[3px] border border-ink/20 bg-paper2/80 px-3 py-2 text-center">
          <p className="text-sm text-ink2 font-slab">{toastParts.join(' · ')}</p>
          {winnerNick && (
            <p className="mt-1 font-display font-black text-grief text-sm sm:text-base">
              Crowd favorite: {winnerNick}
            </p>
          )}
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

        {room.isHost && (
          <div className="flex flex-wrap gap-2 mt-6 justify-end shrink-0">
            <button className="btn-primary" onClick={room.returnToLobby}>
              Play again →
            </button>
          </div>
        )}
        {!room.isHost && (
          <p className="text-ink3 text-sm mt-6 italic shrink-0">
            Waiting for the host to play again…
          </p>
        )}
      </div>
    </div>
  );
}

type VerdictItem = {
  id: string;
  src: string;
  alt: string;
  label: string;
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
      votes: voting ? s.votesCount : undefined,
      isWinner,
    };
  });

  const singleEdit = playerItems.length === 1;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-4">
      {/* Single submission: wide before/after row fills Verdict width. */}
      {singleEdit && (
        <div
          className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-start"
          data-verdict="before-after"
        >
          <VerdictClip
            src={originalSrc}
            alt="Original source image"
            label="Original"
            dashed
            featured
          />
          <VerdictClip
            key={playerItems[0].id}
            {...playerItems[0]}
            submissionId={playerItems[0].id}
            reactionMap={reactions[playerItems[0].id]}
            meId={meId}
            onReact={onReact}
          />
        </div>
      )}

      {/* Multi: Original alone on top, edits in 2-col below. */}
      {!singleEdit && (
        <>
          <div className="w-full flex justify-center shrink-0" data-verdict="original">
            <div className="w-full max-w-2xl">
              <VerdictClip
                src={originalSrc}
                alt="Original source image"
                label="Original"
                dashed
                featured
              />
            </div>
          </div>

          {playerItems.length >= 2 && (
            <div
              className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 content-start items-start [&>*:last-child:nth-child(odd)]:sm:col-span-2 [&>*:last-child:nth-child(odd)]:sm:max-w-[calc(50%-0.375rem)] [&>*:last-child:nth-child(odd)]:sm:justify-self-center"
              data-verdict="edits"
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
          )}
        </>
      )}
    </div>
  );
}

function VerdictClip({
  src,
  alt,
  label,
  votes,
  isWinner = false,
  dashed = false,
  featured = false,
  submissionId,
  reactionMap,
  meId,
  onReact,
}: Omit<VerdictItem, 'id'> & {
  submissionId?: string;
  reactionMap?: Record<string, string[]>;
  meId?: string | null;
  onReact?: (submissionId: string, emoji: VerdictReactionEmoji) => void;
}) {
  const showReactions = !!submissionId && !!onReact && !featured;

  return (
    <div
      className={`relative rounded-[3px] overflow-hidden bg-papercard min-w-0 ${
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
      <ExpandableImage
        src={src}
        alt={alt}
        className="w-full h-auto object-contain bg-paper2"
      />
      <div
        className={`px-3 py-2.5 flex items-center gap-2 border-t-2 ${
          featured
            ? 'border-dashed border-grief bg-grief/5'
            : dashed
              ? 'border-dashed border-ink'
              : 'border-ink'
        }`}
      >
        <span
          className={`truncate min-w-0 shrink ${
            featured
              ? 'font-display font-black tracking-wide uppercase text-sm'
              : 'font-display font-bold text-base sm:text-lg'
          }`}
        >
          {label}
        </span>
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
                  className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-sm leading-none transition-colors ${
                    mine
                      ? 'border-grief bg-grief/10'
                      : 'border-ink/20 bg-papercard hover:border-ink/50'
                  }`}
                  aria-label={`React ${emoji}`}
                  aria-pressed={mine}
                  title={emoji}
                >
                  <span aria-hidden>{emoji}</span>
                  {count > 0 && (
                    <span className="tabular-nums text-[11px] font-bold text-ink2">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {votes !== undefined && (
          <span
            className={`tabular-nums font-display font-black text-base sm:text-lg text-grief shrink-0 ${
              showReactions ? '' : 'ml-auto'
            }`}
          >
            ♥{votes}
          </span>
        )}
      </div>
    </div>
  );
}
