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

- Works on desktop and mobile browsers (Chrome, Safari, Firefox).
- On mobile data (4G/5G), carrier-grade NAT can occasionally block the
  direct connection — for higher reliability add a TURN server (e.g. a
  free Metered.ca or Twilio TURN endpoint) to the PeerJS config in
  `lib/useTransfer.js`.
- Current build buffers the file in memory while receiving, so it's best
  suited for files up to a few hundred MB on mobile, and multi-GB on
  desktop. For guaranteed large-file support, swap the receive-side buffer
  for the File System Access API's streaming writer.
- Keep both browser tabs open and the screen on during transfer — mobile
  browsers throttle background tabs.
