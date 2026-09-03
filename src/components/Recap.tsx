import { useState } from 'react';
import type { RoundRecap } from '@shared/types';
import type { RoomApi } from '../state/useRoom';
import { dateline } from '../lib/format';
import { canvasToBlob, composeFrontPage, downloadBlob } from '../lib/frontPage';
import { ExpandableImage } from './ExpandableImage';

/**
 * End-of-game recap: a themed, scrollable gallery of every round — the original
 * screenshot beside every player's redacted result — plus a one-tap export that
 * composes the whole run into a shareable newspaper front-page PNG (client-side;
 * see lib/frontPage). Rendered on the scoreboard once at least one round is done.
 */
export function Recap({ room }: { room: RoomApi }) {
  const rounds = room.history;
  const [busy, setBusy] = useState<null | 'download'>(null);
  const [note, setNote] = useState<string | null>(null);

  if (rounds.length === 0) return null;

  const code = room.state?.code ?? '----';

  const runExport = async () => {
    if (busy) return;
    setBusy('download');
    setNote(null);
    try {
      const canvas = await composeFrontPage(rounds, { code, date: dateline() });
      const blob = await canvasToBlob(canvas);
      const filename = `redactionist-gazette-${code}.png`;
      downloadBlob(blob, filename);
      setNote('Saved to your device.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not build the front page.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="kicker text-[11px]">The Morgue — full run</div>
          <div className="font-display font-black text-2xl leading-tight">Every edit, every edition</div>
          <p className="text-sm text-ink2 mt-0.5">
            {rounds.length} stor{rounds.length === 1 ? 'y' : 'ies'} · look back at the whole run, then take home the front page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" disabled aria-label="Sharing is not available yet">
            ↗ Share (soon)
          </button>
          <button className="btn-primary" disabled={busy !== null} onClick={runExport}>
            {busy === 'download' ? 'Composing…' : '⬇ Download front page'}
          </button>
        </div>
      </div>
      {note && <p className="text-xs text-ink2 -mt-2 italic">{note}</p>}

      <div className="hr-thin" />

      <div className="flex flex-col gap-6">
        {rounds.map((r) => (
          <RoundBlock key={r.roundId} recap={r} fallbackName={(pid) => room.state?.players.find((p) => p.id === pid)?.nickname} />
        ))}
      </div>

      {/* PHASE 4 TODO: permanent shareable links (upload PNG to object storage). */}
      <p className="text-[11px] text-ink3 italic">
        Permanent shareable links to your gazette are coming in a future edition.
      </p>
    </div>
  );
}

function RoundBlock({
  recap,
  fallbackName,
}: {
  recap: RoundRecap;
  fallbackName: (playerId: string) => string | undefined;
}) {
  const topVotes = recap.submissions.reduce((m, s) => Math.max(m, s.votesCount), 0);
  const nameOf = (pid: string) =>
    recap.players.find((p) => p.id === pid)?.nickname ?? fallbackName(pid) ?? 'Anon';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="kicker text-xs whitespace-nowrap">Story No. {recap.roundNumber}</div>
        <div className="hr-thin flex-1" />
        {recap.votingEnabled && <span className="badge">votes counted</span>}
        <span className="badge">{recap.submissions.length} edit{recap.submissions.length === 1 ? '' : 's'}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Original reference clipping */}
        <figure className="rounded-[2px] border-2 border-dashed border-ink bg-papercard overflow-hidden">
          <div className="bg-paper2 grid place-items-center">
            <ExpandableImage src={recap.source.imageUrl} alt={`Original source for story ${recap.roundNumber}`} className="w-full h-32 object-contain" />
          </div>
          <figcaption className="px-2 py-1.5 border-t-2 border-dashed border-ink">
            <div className="text-sm font-bold truncate">Original</div>
            <div className="kicker text-[9px]">the wire photo</div>
          </figcaption>
        </figure>

        {/* Every player's redaction */}
        {recap.submissions.map((s) => {
          const winner = recap.votingEnabled && s.votesCount > 0 && s.votesCount === topVotes;
          return (
            <figure
              key={s.id}
              className={`relative rounded-[2px] border-2 overflow-hidden bg-papercard ${winner ? 'border-grief shadow-clip' : 'border-ink'}`}
            >
              {winner && (
                <span className="absolute top-1 right-1 z-10 stamp !px-1.5 !py-0.5 text-[10px]">★ Winner</span>
              )}
              <div className="bg-paper2 grid place-items-center">
                <ExpandableImage src={s.editedImageUrl} alt={`${nameOf(s.playerId)}'s redaction for story ${recap.roundNumber}`} className="w-full h-32 object-contain" />
              </div>
              <figcaption className={`px-2 py-1.5 border-t-2 ${winner ? 'border-grief' : 'border-ink'}`}>
                <div className="text-sm font-bold truncate">{nameOf(s.playerId)}</div>
                <div className={`kicker text-[9px] ${winner ? 'text-grief' : ''}`}>
                  {recap.votingEnabled ? `${s.votesCount} vote${s.votesCount === 1 ? '' : 's'}` : 'redaction'}
                </div>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
