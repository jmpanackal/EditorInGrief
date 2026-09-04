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
 * `compact` — single-row height for mobile lobby chrome where vertical space is tight.
 */
export function RoomInvite({ code, compact = false }: { code: string; compact?: boolean }) {
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
      <div className={`flex items-stretch gap-1.5 ${compact ? 'h-full' : 'gap-2'}`}>
        <button
          type="button"
          className={`btn-primary flex-1 min-w-0 !flex items-center justify-center leading-none ${
            compact
              ? '!py-2 !px-2.5 !flex-row !gap-1.5 h-full min-h-[2.5rem]'
              : '!py-3 !flex-col !gap-0.5'
          }`}
          onClick={copy}
          title={joinUrl}
          aria-label={copied ? `Copied invite link for room ${code}` : `Copy invite link for room ${code}`}
        >
          <span className={`kicker !text-paper/80 shrink-0 ${compact ? 'text-[9px] tracking-[0.12em]' : 'text-[10px] tracking-[0.18em]'}`}>
            {copied ? 'Copied' : 'Invite'}
          </span>
          <span
            className={`font-display font-black tabular-nums whitespace-nowrap ${
              compact
                ? 'text-[15px] tracking-[0.14em] pl-[0.14em]'
                : 'text-2xl sm:text-3xl tracking-[0.28em] pl-[0.28em]'
            }`}
          >
            {spacedCode(code)}
          </span>
        </button>
        <button
          type="button"
          className={`btn-secondary self-stretch shrink-0 ${
            compact ? '!px-2.5 !py-2 text-xs leading-none h-full min-h-[2.5rem]' : '!px-4 min-h-[2.75rem] text-sm'
          }`}
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
