"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sounds } from "./sounds";

const DEBUG = process.env.NEXT_PUBLIC_WARP_DEBUG === "1";
const log = (...args) => {
  if (DEBUG) console.log("[warp]", ...args);
};

const CHUNK_SIZE = 128 * 1024; // 128KB — fewer round trips, still safe across browsers
const BUFFER_LIMIT = 8 * 1024 * 1024; // pause sending above 8MB buffered
const CONNECT_TIMEOUT_MS = 25000;
const MAX_RECONNECT_ATTEMPTS = 6;
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 20000;

// STUN gets you through most home/office NATs for free. TURN is the fallback
// for restrictive networks (mobile carrier CGNAT, corporate firewalls) where
// a direct P2P path can't be found — without it those cases just hang forever
// instead of failing over. Open Relay is a public, no-signup TURN service;
// swap in a paid provider (Twilio, Metered) if you outgrow its limits.
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 4,
};

// Errors that mean "this session is truly over" — everything else we try to
// recover from automatically (signaling drops are common and recoverable).
const FATAL_ERROR_TYPES = [
  "peer-unavailable",
  "invalid-id",
  "unavailable-id",
  "ssl-unavailable",
  "browser-incompatible",
];

function randomCode(len = 6) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function waitForDrain(dc, myRunId, runIdRef) {
  return new Promise((resolve) => {
    if (!dc || dc.bufferedAmount <= BUFFER_LIMIT || myRunId !== runIdRef.current) {
      resolve();
      return;
    }
    const handler = () => {
      dc.removeEventListener("bufferedamountlow", handler);
      resolve();
    };
    dc.addEventListener("bufferedamountlow", handler);
  });
}

export function useTransfer() {
  const [status, setStatus] = useState("idle"); // idle | waiting | connecting | connected | transferring | done | error
  const [role, setRole] = useState(null); // 'send' | 'receive'
  const [code, setCode] = useState("");
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState(null); // current file: {name, size, mime, index, total}
  const [errorMsg, setErrorMsg] = useState("");
  const [receivedFiles, setReceivedFiles] = useState([]); // [{name, url, size}]
  const [reconnecting, setReconnecting] = useState(false);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const receivedChunksRef = useRef([]); // chunks for the file currently being received
  const receivedBytesRef = useRef(0); // bytes received for the current file
  const overallReceivedBytesRef = useRef(0); // bytes from files already completed
  const totalBytesRef = useRef(0); // sum of all files in this session
  const fileMetaRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectTimeoutRef = useRef(null);
  const settledRef = useRef(false);
  const dataChannelActiveRef = useRef(false); // true once the P2P DataChannel itself is open
  const heartbeatSendRef = useRef(null);
  const heartbeatWatchdogRef = useRef(null);
  const lastPongRef = useRef(0);
  const objectUrlsRef = useRef([]);
  const runIdRef = useRef(0); // guards against stale async callbacks from a previous session
  const speedSampleRef = useRef({ time: 0, bytes: 0 });

  // ---------- low-level helpers (declared first, everything else depends on these) ----------

  const clearHeartbeat = useCallback(() => {
    if (heartbeatSendRef.current) {
      clearInterval(heartbeatSendRef.current);
      heartbeatSendRef.current = null;
    }
    if (heartbeatWatchdogRef.current) {
      clearInterval(heartbeatWatchdogRef.current);
      heartbeatWatchdogRef.current = null;
    }
  }, []);

  // Samples throughput roughly twice a second and derives a smoothed
  // speed + remaining-time estimate from it.
  const updateSpeed = useCallback((bytesTransferred, totalBytes) => {
    const now = performance.now();
    const sample = speedSampleRef.current;
    const elapsed = now - sample.time;
    if (elapsed < 400) return; // avoid noisy updates
    const deltaBytes = bytesTransferred - sample.bytes;
    const bps = elapsed > 0 ? (deltaBytes / elapsed) * 1000 : 0;
    speedSampleRef.current = { time: now, bytes: bytesTransferred };
    setSpeedBps(bps);
    if (bps > 0 && totalBytes) {
      const remaining = totalBytes - bytesTransferred;
      setEtaSeconds(Math.max(0, Math.round(remaining / bps)));
    }
  }, []);

  const resetSpeedTracking = useCallback(() => {
    speedSampleRef.current = { time: performance.now(), bytes: 0 };
    setSpeedBps(0);
    setEtaSeconds(null);
  }, []);

  const revokeAllObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
  }, []);

  // Full teardown of whatever peer/connection currently exists. Always called
  // before creating a new one, so we never end up with two live PeerJS
  // instances racing each other (the root cause of a lot of "works only
  // sometimes" bugs).
  const cleanup = useCallback(() => {
    runIdRef.current += 1; // invalidate any in-flight async callbacks
    clearHeartbeat();
    if (peerRef.current?._onVisible) {
      document.removeEventListener("visibilitychange", peerRef.current._onVisible);
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    try {
      connRef.current?.close?.();
    } catch (e) {
      log("error closing connection", e);
    }
    try {
      peerRef.current?.destroy?.();
    } catch (e) {
      log("error destroying peer", e);
    }
    peerRef.current = null;
    connRef.current = null;
    dataChannelActiveRef.current = false;
  }, [clearHeartbeat]);

  // Unmount cleanup only.
  useEffect(() => {
    return () => {
      cleanup();
      revokeAllObjectUrls();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensurePeer = useCallback((id, onUnrecoverable) => {
    return new Promise((resolve, reject) => {
      let settled = false;
      import("peerjs").then(({ default: Peer }) => {
        const peer = id
          ? new Peer(id, { config: RTC_CONFIG, debug: DEBUG ? 2 : 0 })
          : new Peer({ config: RTC_CONFIG, debug: DEBUG ? 2 : 0 });
        peerRef.current = peer;

        const onVisible = () => {
          if (document.visibilityState === "visible" && peer.disconnected && !peer.destroyed) {
            log("tab visible again, reconnecting signaling");
            peer.reconnect();
          }
        };
        document.addEventListener("visibilitychange", onVisible);
        peer._onVisible = onVisible;

        peer.on("disconnected", () => {
          log("signaling disconnected");
          if (peer.destroyed) return;

          // If the P2P DataChannel is already up, the broker (signaling)
          // connection dropping doesn't affect an in-progress transfer —
          // that channel is direct, not routed through the broker. We still
          // try to bring signaling back for future messages, but we do NOT
          // fail an active transfer just because of this.
          reconnectAttemptsRef.current += 1;
          if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
            if (!dataChannelActiveRef.current) {
              onUnrecoverable?.(
                new Error(
                  "Lost the connection and couldn't reconnect. Please start a new transfer."
                )
              );
            } else {
              log("signaling reconnect exhausted but data channel is still active — ignoring");
            }
            return;
          }
          setReconnecting(true);
          const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000);
          setTimeout(() => {
            if (!peer.destroyed) peer.reconnect();
          }, delay);
        });

        peer.on("open", () => {
          reconnectAttemptsRef.current = 0;
          setReconnecting(false);
        });

        peer.on("open", (assignedId) => {
          log("peer open", assignedId);
          if (!settled) {
            settled = true;
            resolve({ peer, assignedId });
          }
        });

        peer.on("error", (err) => {
          log("peer error", err?.type, err?.message);
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      });
    });
  }, []);

  const startHeartbeat = useCallback(
    (conn) => {
      clearHeartbeat();
      lastPongRef.current = Date.now();

      heartbeatSendRef.current = setInterval(() => {
        try {
          conn.send({ type: "ping" });
        } catch (e) {
          log("heartbeat send failed", e);
        }
      }, HEARTBEAT_INTERVAL_MS);

      heartbeatWatchdogRef.current = setInterval(() => {
        if (Date.now() - lastPongRef.current > HEARTBEAT_TIMEOUT_MS) {
          log("heartbeat timeout — connection appears dead");
          setStatus((s) => {
            if (s === "connected" || s === "transferring") return "error";
            return s;
          });
          setErrorMsg(
            (m) => m || "Connection appears to have dropped (no response from the other side)."
          );
          clearHeartbeat();
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [clearHeartbeat]
  );

  // ---------- sender ----------

  const sendFilesOverConnection = useCallback(
    async (conn, files, myRunId) => {
      resetSpeedTracking();
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      let sentBeforeCurrent = 0;
      const dc = conn.dataChannel;
      if (dc) {
        dc.bufferedAmountLowThreshold = BUFFER_LIMIT / 2;
      }

      try {
        for (let i = 0; i < files.length; i++) {
          if (myRunId !== runIdRef.current) return;
          const file = files[i];
          setStatus("transferring");
          setFileMeta({ name: file.name, size: file.size, index: i, total: files.length });
          conn.send({
            type: "meta",
            name: file.name,
            size: file.size,
            mime: file.type || "application/octet-stream",
            index: i,
            total: files.length,
            totalBytes,
          });

          let offset = 0;
          while (offset < file.size) {
            if (myRunId !== runIdRef.current) return;
            await waitForDrain(dc, myRunId, runIdRef);
            if (myRunId !== runIdRef.current) return;
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const buf = await slice.arrayBuffer();
            conn.send(buf);
            offset += buf.byteLength;
            lastPongRef.current = Date.now(); // sending real data is proof of life too
            const overallSent = sentBeforeCurrent + offset;
            setProgress(Math.min(100, Math.round((overallSent / totalBytes) * 100)));
            updateSpeed(overallSent, totalBytes);
          }

          conn.send({ type: "file-done" });
          sentBeforeCurrent += file.size;
        }

        conn.send({ type: "all-done" });
        setStatus("done");
        setProgress(100);
        setEtaSeconds(0);
        sounds.complete();
        clearHeartbeat();
      } catch (e) {
        log("send loop error", e);
      }
    },
    [clearHeartbeat, updateSpeed, resetSpeedTracking]
  );

  const startSending = useCallback(
    async (fileOrFiles) => {
      cleanup(); // guarantee no leftover peer/connection from a previous attempt
      const myRunId = runIdRef.current;
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : Array.from(fileOrFiles);

      setRole("send");
      setStatus("waiting");
      setErrorMsg("");
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
      const shortCode = randomCode();

      const fail = (msg) => {
        if (myRunId !== runIdRef.current) return; // stale callback from an old session
        setStatus("error");
        setErrorMsg(msg);
        sounds.error();
      };

      try {
        const { peer } = await ensurePeer(shortCode, (err) => fail(err.message));
        if (myRunId !== runIdRef.current) return; // superseded while we were awaiting
        setCode(shortCode);
        log("sender ready, code:", shortCode, "files:", files.length);

        peer.on("connection", (conn) => {
          if (myRunId !== runIdRef.current) return;
          // Guard against a duplicate incoming connection racing an existing one.
          if (connRef.current && connRef.current.open) {
            log("rejecting duplicate incoming connection");
            conn.close();
            return;
          }
          connRef.current = conn;
          setStatus("connected");
          sounds.connect();
          log("incoming connection from", conn.peer);

          conn.on("open", () => {
            log("data channel open (sender)");
            dataChannelActiveRef.current = true;
            startHeartbeat(conn);
            sendFilesOverConnection(conn, files, myRunId);
          });

          conn.on("data", (data) => {
            lastPongRef.current = Date.now(); // any traffic at all proves the link is alive
            if (data?.type === "ping") {
              try {
                conn.send({ type: "pong" });
              } catch (e) {
                log("pong send failed", e);
              }
            }
          });

          conn.on("close", () => {
            log("data connection closed (sender)");
            clearHeartbeat();
            if (myRunId !== runIdRef.current) return;
            setStatus((s) => (s === "done" ? s : "error"));
          });

          conn.on("error", (err) => {
            log("data connection error (sender)", err);
          });
        });

        peer.on("error", (err) => {
          if (myRunId !== runIdRef.current) return;
          if (FATAL_ERROR_TYPES.includes(err?.type)) {
            fail(err?.message || "Connection error");
          }
        });
      } catch (err) {
        fail(err?.message || "Could not start session");
      }
    },
    [ensurePeer, cleanup, startHeartbeat, clearHeartbeat, sendFilesOverConnection]
  );

  // ---------- receiver ----------

  const handleIncomingData = useCallback(
    (data) => {
      if (data && typeof data === "object" && !(data instanceof ArrayBuffer) && data.type) {
        if (data.type === "meta") {
          const meta = {
            name: data.name,
            size: data.size,
            mime: data.mime,
            index: data.index ?? 0,
            total: data.total ?? 1,
          };
          fileMetaRef.current = meta;
          totalBytesRef.current = data.totalBytes || data.size;
          receivedChunksRef.current = [];
          receivedBytesRef.current = 0;
          setFileMeta(meta);
          setStatus("transferring");
          if (meta.index === 0) resetSpeedTracking();
        } else if (data.type === "file-done") {
          const meta = fileMetaRef.current;
          const blob = new Blob(receivedChunksRef.current, {
            type: meta?.mime || "application/octet-stream",
          });
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          setReceivedFiles((prev) => [
            ...prev,
            { name: meta?.name || "downloaded-file", url, size: meta?.size || blob.size },
          ]);
          overallReceivedBytesRef.current += meta?.size || 0;
          receivedChunksRef.current = [];
          receivedBytesRef.current = 0;
        } else if (data.type === "all-done") {
          setStatus("done");
          setProgress(100);
          setEtaSeconds(0);
          sounds.complete();
          clearHeartbeat();
        }
        return;
      }

      // binary chunk
      receivedChunksRef.current.push(data);
      receivedBytesRef.current += data.byteLength || data.size || 0;
      const overallBytes = overallReceivedBytesRef.current + receivedBytesRef.current;
      if (totalBytesRef.current) {
        setProgress(Math.min(100, Math.round((overallBytes / totalBytesRef.current) * 100)));
        updateSpeed(overallBytes, totalBytesRef.current);
      }
    },
    [clearHeartbeat, resetSpeedTracking, updateSpeed]
  );

  const startReceiving = useCallback(
    async (targetCode) => {
      cleanup(); // guarantee no leftover peer/connection from a previous attempt
      const myRunId = runIdRef.current;

      setRole("receive");
      setStatus("connecting");
      setErrorMsg("");
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
      receivedChunksRef.current = [];
      receivedBytesRef.current = 0;
      overallReceivedBytesRef.current = 0;
      totalBytesRef.current = 0;
      revokeAllObjectUrls();
      setReceivedFiles([]);
      settledRef.current = false;

      const fail = (msg) => {
        if (myRunId !== runIdRef.current) return;
        if (settledRef.current) return;
        settledRef.current = true;
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setStatus("error");
        setErrorMsg(msg);
        sounds.error();
      };

      try {
        const { peer } = await ensurePeer(null, (err) => fail(err.message));
        if (myRunId !== runIdRef.current) return;

        const conn = peer.connect(targetCode.trim().toLowerCase(), {
          reliable: true,
        });
        connRef.current = conn;
        log("connecting to", targetCode);

        connectTimeoutRef.current = setTimeout(() => {
          fail(
            "Connection timed out. Make sure the sender's tab is still open and the code is correct."
          );
        }, CONNECT_TIMEOUT_MS);

        conn.on("open", () => {
          if (myRunId !== runIdRef.current) return;
          settledRef.current = true;
          dataChannelActiveRef.current = true;
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          setStatus("connected");
          sounds.connect();
          startHeartbeat(conn);
          log("data channel open (receiver)");
        });

        conn.on("data", (data) => {
          if (myRunId !== runIdRef.current) return;
          lastPongRef.current = Date.now(); // any traffic at all proves the link is alive
          if (data?.type === "ping") {
            try {
              conn.send({ type: "pong" });
            } catch (e) {
              log("pong send failed", e);
            }
            return;
          }
          if (data?.type === "pong") {
            return;
          }
          handleIncomingData(data);
        });

        conn.on("error", (err) => {
          log("data connection error (receiver)", err);
          fail(err?.message || "Could not connect. Check the code.");
        });

        conn.on("close", () => {
          log("data connection closed (receiver)");
          clearHeartbeat();
          if (myRunId !== runIdRef.current) return;
          setStatus((s) => (s === "done" ? s : "error"));
        });

        peer.on("error", (err) => {
          if (myRunId !== runIdRef.current) return;
          if (FATAL_ERROR_TYPES.includes(err?.type)) {
            fail(err?.message || "Could not connect. Check the code.");
          }
        });
      } catch (err) {
        fail(err?.message || "Could not connect");
      }
    },
    [ensurePeer, cleanup, startHeartbeat, clearHeartbeat, handleIncomingData, revokeAllObjectUrls]
  );

  const reset = useCallback(() => {
    cleanup();
    revokeAllObjectUrls();
    setStatus("idle");
    setRole(null);
    setCode("");
    setProgress(0);
    setFileMeta(null);
    setErrorMsg("");
    setReceivedFiles([]);
    setReconnecting(false);
    setSpeedBps(0);
    setEtaSeconds(null);
    reconnectAttemptsRef.current = 0;
    settledRef.current = false;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    overallReceivedBytesRef.current = 0;
    totalBytesRef.current = 0;
    fileMetaRef.current = null;
  }, [cleanup, revokeAllObjectUrls]);

  return {
    status,
    role,
    code,
    progress,
    fileMeta,
    errorMsg,
    receivedFiles,
    reconnecting,
    speedBps,
    etaSeconds,
    startSending,
    startReceiving,
    reset,
  };
}
