import type { Player, Submission } from '../../shared/types';
import type { RoomApi } from '../state/useRoom';
import { PlayerList } from './PlayerList';
import { RoomInvite } from './RoomInvite';
import { RoundDownload } from './Recap';
import { ExpandableImage } from './ExpandableImage';

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
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap shrink-0">
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

        {!round || !state.currentSource ? (
          <div className="text-ink3 py-6 text-center italic">No copy filed this round.</div>
        ) : (
          <VerdictGallery
            originalSrc={state.currentSource.imageUrl}
            results={results}
            players={state.players}
            voting={voting}
            topVotes={topVotes}
          />
        )}

        {room.isHost && (
          <div className="flex flex-wrap gap-2 mt-6 justify-end shrink-0">
            <button className="btn-primary" onClick={() => room.startRound()}>
              Next round →
            </button>
            <button className="btn-secondary" onClick={room.returnToLobby}>
              Back to lobby
            </button>
          </div>
        )}
        {!room.isHost && <p className="text-ink3 text-sm mt-6 italic shrink-0">Awaiting the Host’s next move…</p>}
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
}: {
  originalSrc: string;
  results: Submission[];
  players: Player[];
  voting: boolean;
  topVotes: number;
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-4">
      {/* Original on its own full-width row — never a sibling in the edits grid. */}
      <div className="w-full flex justify-center shrink-0" data-verdict="original">
        <div className="w-full max-w-xl">
          <VerdictClip
            src={originalSrc}
            alt="Original source image"
            label="Original"
            dashed
            featured
          />
        </div>
      </div>

      {/* Edits-only grid — starts on the row below Original. */}
      {playerItems.length > 0 && (
        <div
          className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 content-start items-start"
          data-verdict="edits"
        >
          {playerItems.map((item) => (
            <VerdictClip key={item.id} {...item} />
          ))}
        </div>
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
}: Omit<VerdictItem, 'id'>) {
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
        className={`px-2.5 py-1.5 flex items-center justify-between text-sm border-t-2 ${
          featured
            ? 'border-dashed border-grief bg-grief/5'
            : dashed
              ? 'border-dashed border-ink'
              : 'border-ink'
        }`}
      >
        <span className={`truncate font-semibold ${featured ? 'font-display font-black tracking-wide uppercase text-[13px]' : ''}`}>
          {label}
        </span>
        {votes !== undefined && (
          <span className="tabular-nums font-display font-black text-grief">♥{votes}</span>
        )}
      </div>
    </div>
  );
}
