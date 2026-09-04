import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildJoinUrl } from '../lib/roomUrl';

/** Letter-spaced display of a live room code, e.g. "Y 2 6 N". */
function spacedCode(code: string): string {
  return code.toUpperCase().trim().split('').join(' ');
}

/**
 * Primary invite control for the Newsroom: a large live room-code button that
 * copies the join link, plus a secondary QR opener. Kept out of the app header
 * so the masthead stays brand/nickname-only.
 */
export function RoomInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const joinUrl = buildJoinUrl(code);

  const copy = () => {
    const url = buildJoinUrl(code);
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  return (
    <>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="btn-primary flex-1 !py-3 !flex !flex-col items-center justify-center !gap-0.5 leading-tight"
          onClick={copy}
          title={joinUrl}
          aria-label={copied ? `Copied invite link for room ${code}` : `Copy invite link for room ${code}`}
        >
          <span className="kicker text-[10px] !text-paper/80 tracking-[0.18em]">
            {copied ? 'Link copied' : 'Invite link'}
          </span>
          <span className="font-display font-black text-2xl sm:text-3xl tracking-[0.28em] tabular-nums pl-[0.28em]">
            {spacedCode(code)}
          </span>
        </button>
        <button
          type="button"
          className="btn-secondary !px-4 min-h-[2.75rem] text-sm self-stretch"
          onClick={() => setShowQr(true)}
          aria-label="Show QR code"
        >
          ▦ QR
        </button>
      </div>

      {showQr && (
        <div
          className="fixed inset-0 z-50 bg-ink/70 p-4 grid place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Room QR code"
          onMouseDown={() => setShowQr(false)}
        >
          <div
            className="card w-full max-w-xs p-6 flex flex-col items-center gap-4 text-center shadow-clip"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="kicker text-xs">Scan to enlist</div>
            <div className="font-display text-4xl font-black tracking-[0.28em] text-grief pl-[0.28em]">
              {spacedCode(code)}
            </div>
            <div className="bg-papercard p-2.5 rounded-[3px] border-2 border-ink">
              <QRCodeSVG value={joinUrl} size={180} bgColor="#faf8f1" fgColor="#1a1a1a" />
            </div>
            <p className="text-xs text-ink3 break-all px-1">{joinUrl}</p>
            <p className="text-xs text-ink3">Scan with a phone camera to jump straight into the room.</p>
            <button type="button" className="btn-secondary w-full" onClick={() => setShowQr(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
