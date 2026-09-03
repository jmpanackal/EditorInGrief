# Editor in Grief

A browser-based, **Jackbox-style multiplayer party game**. Someone shares a
screenshot of something cringy or ridiculous (a LinkedIn post, a tweet, a YouTube
comment, a news headline). Every player **redacts** it — blacks out parts of the
image — to create a new, funnier version. Then everyone's edits are revealed one
at a time and read aloud over voice chat. Optionally, vote for the best.

It's a standalone web app — **no installs, no accounts** — and it works equally
well on **phones and desktops**.

> **The core idea:** every source is an *image*, and you can only **remove**
> (paint black over pixels), never add. The result looks like the original
> because it *is* the original image with parts covered — real document-redaction
> style. This makes the mechanic identical for every kind of source.

---

## Run it

Requirements: Node 18+ (built and tested on Node 22 / npm 10).

```bash
npm install
npm run dev
```

`npm run dev` starts **two** things together (via `concurrently`):

- the **Vite client** on `http://localhost:5173`
- the local **realtime WebSocket server** on port `8787`

Open `http://localhost:5173`, create a room, and share the 4-letter code.

Other useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Client + realtime server together (main dev command) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run start` | Serve the production build and realtime game from one process |
| `npm run seed` | Regenerate the seed-bank source images (`/public/seed`) |
| `npm run dev:server` / `npm run dev:client` | Run either half on its own |

### Play across multiple devices on a LAN

1. Run `npm run dev` on the **host** computer.
2. Note the **Network** URL Vite prints (e.g. `http://192.168.1.42:5173`).
3. On phones / other computers **on the same Wi-Fi**, open that URL in a browser.
4. One person creates a room; everyone else enters the code (or scans the QR).

The client automatically points its WebSocket at the same hostname it was loaded
from (`ws://<host>:8787/ws`), so LAN play works with no extra config. If a device
can't connect, allow Node through the host's firewall for ports `5173` and `8787`.

### Deploy to Render (free hobby hosting)

The repository is configured for a **single Render Web Service**: it builds the
Vite client, serves it on Render's assigned `PORT`, and upgrades multiplayer
connections at `/ws` on the same HTTPS URL. No environment variables are needed.

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository. Render reads
   [`render.yaml`](./render.yaml) and creates the free web service.
3. Wait for the deploy to finish, open the generated `https://…onrender.com`
   address, and share it with your friends.

Render's free service sleeps after 15 minutes without HTTP or WebSocket traffic,
so the first visit after a quiet spell can take roughly a minute to wake it.
Active games stay awake. The room data and uploaded images are deliberately
in-memory; a server restart, redeploy, or sleep clears them, while the committed
seed bank remains available.

To emulate the deployed app locally:

```bash
npm run build
npm run start
```

Then open `http://localhost:8787`.

---

## How to play

1. **Lobby** — the host creates a room and gets a shareable code + QR. Players
   join from any browser with the code and a nickname. The host can toggle
   **voting** (off by default — rounds are just for laughs).
2. **Round** — a source image is pushed to everyone at once. A countdown timer
   (auto-scaled to the source's length) starts, and each player redacts their own
   copy independently with the box/brush tools.
3. **Submit** — submit early, or you're auto-submitted with whatever you have when
   the timer hits `0`.
4. **Reveal** — submissions are shown one at a time, **synced to every device**
   (fully remote; nobody is ahead). Hold "compare original" to see the source.
5. **Scoreboard** — if voting was on, votes are tallied into running scores;
   otherwise it's just a gallery of the results. Host plays another round or
   returns to the lobby.

### The redaction editor

- **Box** tool — drag to draw a filled black rectangle (fastest for whole lines).
- **Brush** tool — freehand painting with an adjustable **thickness** slider (for
  letter-level precision).
- **Undo** removes the **last shape** (one rectangle or one full brush stroke),
  not the last pixel.
- **Reset** clears all redactions back to the original.
- **Submit** flattens the canvas to a single **PNG** — that's what everyone sees
  at the reveal.
- Works with **touch and mouse**, sized for phones and responsive up to desktop.

Internally the editor keeps a **list of shapes** in image-space and re-renders,
with committed shapes baked onto an offscreen cache — so it stays fast after
dozens of edits, and undo is instant.

---

## Project status

This repo delivers **Phases 1–3** of the MVP. Phase 4 has clear seams for
persistence and permanent sharing.

| Phase | Scope | Status |
| --- | --- | --- |
| **1** | Redaction canvas (box + brush, thickness, undo-last-shape, reset, submit → flattened PNG) | ✅ Done |
| **2** | Lobby + realtime round sync, hand-seeded bank of ~18 source images, full game loop across tabs/devices | ✅ Done |
| **3** | Per-round **upload** flow + **OCR** (Tesseract.js) word-count → timer scaling | ✅ Done (in-memory) |
| **4** | **Persistent** bank + session/round **history** browsing + **voting/scoring** persistence | 🔜 Voting UI works in-session; persistence stubbed |

### Confirmed product decisions

- **Persistence/realtime:** local-only / **in-memory** for now. No Supabase /
  PartyKit / cloud backend yet. A tiny in-repo `ws` server holds room state and
  broadcasts full-state snapshots. The client talks to it through a small
  `Transport` interface so a hosted backend can be dropped in later.
- **Reveal:** **fully remote** — synced to each player's own device via shared
  game state. No shared-TV / big-screen mode.
- **Voting/scoring:** **optional and OFF by default** — rounds are just for laughs
  unless the host enables voting in the lobby.
- **Responsive:** playable on desktops *and* phones.

### Round timer

```
timer_seconds = clamp(30 + 0.45 * word_count, 45, 150)
```

`word_count` currently comes from each seed source's mock metadata. In Phase 3 it
will come from OCR at upload time. It only affects pacing.

---

## Architecture

```
EditorInGrief/
├─ index.html
├─ vite.config.ts            # Vite; server.host:true for LAN access; @shared alias
├─ tailwind.config.js
├─ shared/
│  └─ types.ts               # Isomorphic domain model + message protocol (client & server)
├─ server/
│  ├─ index.ts               # ws WebSocket server; wires messages -> GameStore -> broadcast
│  └─ gameStore.ts           # In-memory authoritative game state + rules (SWAP SEAM for a DB)
├─ scripts/
│  └─ generate-seed.mjs      # Renders ~18 mock-post source images -> /public/seed
├─ public/seed/              # Generated seed sources (*.svg) + manifest.json
└─ src/
   ├─ App.tsx                # Phase state machine (lobby -> round -> reveal -> scoreboard)
   ├─ state/useRoom.ts       # Owns the connection + RoomState snapshot; exposes actions
   ├─ transport/
   │  ├─ Transport.ts        # The ONLY seam between UI and backend
   │  └─ WebSocketTransport.ts
   └─ components/
      ├─ RedactionEditor.tsx # The core mechanic (canvas, box/brush, undo, PNG flatten)
      ├─ JoinScreen.tsx  Lobby.tsx  RoundView.tsx  Reveal.tsx  Scoreboard.tsx
      ├─ Countdown.tsx  PlayerList.tsx
```

### Data model

The shapes in `shared/types.ts` mirror the eventual persistence schema so a real
backend swaps in cleanly:

- **sources**: `id, uploadedBy, imageUrl, ocrText?, wordCount, createdAt, timesUsed`
- **sessions**: `id, createdAt, players[]`
- **rounds**: `id, sessionId, sourceId, timerSeconds, startedAt, submissions[], …`
- **submissions**: `id, roundId, playerId, editedImageUrl, votesCount`

Every source and every result (winning or not) is preserved in memory during a
session so the bank grows — the persistence layer in Phase 4 just needs to
outlive the process.

### Seed bank

Since we can't source real screenshots, `npm run seed` renders ~18 mock social /
news posts (LinkedIn cringe, tweets, YouTube comments, fake headlines) as
self-contained **SVG** "screenshots" plus a `manifest.json` with mock word counts.
SVG keeps the generator dependency-free and cross-platform (no native `canvas`
build), and same-origin SVGs draw onto the editor canvas without tainting it, so
submissions still flatten to real PNGs. The generated files are committed so the
app runs immediately after `npm install`.

### Seams for Phases 3–4 (look for `TODO` / interface boundaries)

- **Hosted backend:** implement `Transport` (see `src/transport/Transport.ts`) and
  point the app at it — no UI changes needed.
- **Persistence:** replace `server/gameStore.ts` with a datastore-backed store of
  the same shape.
- **Upload + OCR:** add an upload step in the pre-round window that creates a
  `Source` (data-URL image), runs Tesseract.js for `wordCount`/`ocrText`, and
  feeds it into the existing `startRound` path.

---

## Known limitations (Phases 1–2)

- **In-memory only.** Restarting the server clears all rooms, sessions, and the
  grown bank. History browsing (Phase 4) isn't built yet.
- **Uploads are temporary.** Uploaded sources and OCR results are available for
  the current room only; a restart or Render sleep clears them.
- Submissions are broadcast as PNG data URLs inside the full-state snapshot. Fine
  for a party-sized group; a hosted backend would move images to object storage.
- Reconnect is best-effort (identity is cached in `localStorage` and the client
  auto-rejoins), but there's no long-term session recovery across server restarts.
- LAN play may require allowing Node through the host firewall for ports
  `5173`/`8787`.
