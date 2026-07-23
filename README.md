# Warp — Instant P2P File Transfer

Built by **Asad Lee**

Browser-to-browser file transfer over WebRTC. No upload, no server storage,
no account, no file size limit. Inspired by the idea behind [croc](https://github.com/schollz/croc)
(a CLI tool by schollz, MIT licensed) — reimplemented here as an original
web app so it can run entirely in the browser and deploy on Vercel.

## How it works

1. Sender picks a file → gets a short 6-character code.
2. Receiver types the code in.
3. Both browsers connect directly via WebRTC (using PeerJS's free public
   signaling broker just to introduce the two peers).
4. The file streams directly between the two browsers in 64KB chunks —
   it never touches any server.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 in two tabs (or two devices) to test send/receive.

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or just push this folder to a GitHub repo and import it on
[vercel.com/new](https://vercel.com/new) — no environment variables needed,
it works out of the box.

## Notes / limits

- Works on desktop and mobile browsers (Chrome, Safari, Firefox, Edge).
- Includes STUN + a free public TURN fallback (Open Relay), so transfers can
  work across restrictive networks (mobile data, corporate Wi-Fi), not just
  same-network. For heavy production use, swap Open Relay for a paid TURN
  provider (Twilio, Metered) — it's rate-limited.
- A ping/pong heartbeat runs once connected to detect a truly dead connection
  vs. a temporary signaling blip.
- Set `NEXT_PUBLIC_WARP_DEBUG=1` as an env var to get verbose console logging
  of signaling, ICE, and DataChannel events while debugging.
- Current build buffers the file in memory while receiving, so it's best
  suited for files up to a few hundred MB on mobile, and multi-GB on
  desktop. For guaranteed large-file support, swap the receive-side buffer
  for the File System Access API's streaming writer.
- **iOS/Android background tab limitation (by design, not a bug):** mobile
  browsers suspend a tab's JavaScript almost immediately after it leaves the
  foreground (screen off, app-switch, etc). No web app — this one included —
  can fully override that OS policy. The app auto-reconnects the signaling
  connection when a tab returns to the foreground, and an already-established
  DataChannel transfer keeps running even if signaling drops, but a transfer
  cannot make progress while its own tab is actually backgrounded. For
  reliable testing, use two separate devices, or two tabs within the same
  browser app rather than switching between two different apps on one phone.
