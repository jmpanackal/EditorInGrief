import { useState } from 'react';
import type { RoundRecap } from '@shared/types';
import { dateline } from '../lib/format';
import { canvasToBlob, composeFrontPage, downloadBlob } from '../lib/frontPage';

/**
 * Download control for a single round’s front-page PNG (the latest Verdict).
 * Multi-round sessions still export only this round — no full-run morgue.
 */
export function RoundDownload({
  recap,
  code,
}: {
  recap: RoundRecap;
  code: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const runExport = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const canvas = await composeFrontPage([recap], { code, date: dateline() });
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, `redactionist-gazette-${code}-story-${recap.roundNumber}.png`);
      setNote('Saved to your device.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not build the front page.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button className="btn-secondary" disabled={busy} onClick={runExport}>
        {busy ? 'Composing…' : '⬇ Download'}
      </button>
      {note && <p className="text-xs text-ink2 italic">{note}</p>}
    </div>
  );
}
