"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sounds } from "./sounds";

const log = (...args) => console.log("[warp]", ...args);

// 64KB safe WebRTC chunk size across all modern browsers (prevents RTCError / SCTP drop)
const CHUNK_SIZE = 64 * 1024;
const BUFFER_LIMIT = 8 * 1024 * 1024; // 8MB
const CONNECT_TIMEOUT_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 6;
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 25000;

// Reliable Google and Cloudflare STUN configuration (fast ICE resolution, no dead TURN stalls)
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  sdpSemantics: "unified-plan",
};

const FATAL_ERROR_TYPES = [
  "peer-unavailable",
  "invalid-id",
  "unavailable-id",
  "ssl-unavailable",
  "browser-incompatible",
];

// Clean 6-digit numeric PIN: impossible to confuse or misread between devices
function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function waitForDrain(dc, myRunId, runIdRef) {
  return new Promise((resolve) => {
    if (!dc || dc.bufferedAmount <= BUFFER_LIMIT || myRunId !== runIdRef.current) {
      resolve();
      return;
    }
    let timer;
    const handler = () => {
      clearTimeout(timer);
      dc.removeEventListener("bufferedamountlow", handler);
      resolve();
    };
    // Fallback timeout prevents hanging if bufferedamountlow is missed
    timer = setTimeout(handler, 100);
    dc.addEventListener("bufferedamountlow", handler, { once: true });
  });
}

export function useTransfer() {
  const [status, setStatus] = useState("idle");
  const [statusText, setStatusText] = useState("");
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const overallReceivedBytesRef = useRef(0);
  const totalBytesRef = useRef(0);
  const fileMetaRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectTimeoutRef = useRef(null);
  const settledRef = useRef(false);
  const dataChannelActiveRef = useRef(false);
  const heartbeatSendRef = useRef(null);
  const heartbeatWatchdogRef = useRef(null);
  const lastPongRef = useRef(0);
  const objectUrlsRef = useRef([]);
  const runIdRef = useRef(0);
  const speedSampleRef = useRef({ time: 0, bytes: 0 });

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

  const updateSpeed = useCallback((bytesTransferred, totalBytes) => {
    const now = performance.now();
    const sample = speedSampleRef.current;
    const elapsed = now - sample.time;
    if (elapsed < 300) return;
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

  const cleanup = useCallback(() => {
    runIdRef.current += 1;
    clearHeartbeat();
    if (peerRef.current?._onVisible) {
      document.removeEventListener("visibilitychange", peerRef.current._onVisible);
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    try { connRef.current?.close?.(); } catch (e) {}
    try { peerRef.current?.destroy?.(); } catch (e) {}
    peerRef.current = null;
    connRef.current = null;
    dataChannelActiveRef.current = false;
  }, [clearHeartbeat]);

  useEffect(() => {
    return () => {
      cleanup();
      revokeAllObjectUrls();
    };
  }, []);

  const ensurePeer = useCallback((id, onUnrecoverable) => {
    return new Promise((resolve, reject) => {
      let settled = false;
      setStatusText("Connecting to P2P signaling network...");
      import("peerjs")
        .then((mod) => {
          const Peer = mod.default?.Peer || (typeof mod.default === "function" ? mod.default : mod.Peer || mod);
          if (typeof Peer !== "function") {
            throw new Error("PeerJS client could not be loaded");
          }
          const peer = id
            ? new Peer(id, { config: RTC_CONFIG, debug: 2 })
            : new Peer({ config: RTC_CONFIG, debug: 2 });
          peerRef.current = peer;

          const onVisible = () => {
            if (document.visibilityState === "visible" && peer.disconnected && !peer.destroyed) {
              peer.reconnect();
            }
          };
          document.addEventListener("visibilitychange", onVisible);
          peer._onVisible = onVisible;

          peer.on("disconnected", () => {
            if (peer.destroyed) return;
            reconnectAttemptsRef.current += 1;
            if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
              if (!dataChannelActiveRef.current) {
                onUnrecoverable?.(new Error("Lost signaling server. Please retry."));
              }
              return;
            }
            setReconnecting(true);
            const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000);
            setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, delay);
          });

          peer.on("open", (assignedId) => {
            reconnectAttemptsRef.current = 0;
            setReconnecting(false);
            setStatusText("Signal network ready.");
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
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
    });
  }, []);

  const startHeartbeat = useCallback((conn) => {
    clearHeartbeat();
    lastPongRef.current = Date.now();
    heartbeatSendRef.current = setInterval(() => {
      try { conn.send({ type: "ping" }); } catch (e) {}
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatWatchdogRef.current = setInterval(() => {
      // Don't kill active transfers just because ping/pong is queued behind binary chunks
      if (Date.now() - lastPongRef.current > HEARTBEAT_TIMEOUT_MS) {
        setStatus((s) => {
          if (s === "transferring") {
            return s;
          }
          if (s === "connected") {
            setErrorMsg((m) => m || "Connection dropped (no response from peer).");
            clearHeartbeat();
            return "error";
          }
          return s;
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [clearHeartbeat]);

  const sendFilesOverConnection = useCallback(
    async (conn, files, myRunId) => {
      resetSpeedTracking();
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      let sentBeforeCurrent = 0;
      const dc = conn.dataChannel;
      if (dc) dc.bufferedAmountLowThreshold = BUFFER_LIMIT / 2;

      try {
        for (let i = 0; i < files.length; i++) {
          if (myRunId !== runIdRef.current) return;
          const file = files[i];
          setStatus("transferring");
          setStatusText(`Sending: ${file.name}`);
          setFileMeta({ name: file.name, size: file.size, index: i, total: files.length });
          conn.send({ type: "meta", name: file.name, size: file.size, mime: file.type || "application/octet-stream", index: i, total: files.length, totalBytes });

          let offset = 0;
          while (offset < file.size) {
            if (myRunId !== runIdRef.current) return;
            await waitForDrain(dc, myRunId, runIdRef);
            if (myRunId !== runIdRef.current) return;
            const buf = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
            conn.send(buf);
            offset += buf.byteLength;
            lastPongRef.current = Date.now();
            const overallSent = sentBeforeCurrent + offset;
            setProgress(Math.min(100, Math.round((overallSent / totalBytes) * 100)));
            updateSpeed(overallSent, totalBytes);
          }
          conn.send({ type: "file-done" });
          sentBeforeCurrent += file.size;
        }
        conn.send({ type: "all-done" });
        setStatus("done");
        setStatusText("All files delivered!");
        setProgress(100);
        setEtaSeconds(0);
        sounds.complete();
        clearHeartbeat();
      } catch (e) {
        log("send loop error", e);
        if (myRunId === runIdRef.current) {
          setStatus("error");
          setStatusText("");
          setErrorMsg(e?.message || "Transfer error. Please retry.");
          sounds.error();
          clearHeartbeat();
        }
      }
    },
    [clearHeartbeat, updateSpeed, resetSpeedTracking]
  );

  // SENDER (Clean 1-to-1)
  const startSending = useCallback(
    async (fileOrFiles) => {
      cleanup();
      const myRunId = runIdRef.current;
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : Array.from(fileOrFiles);

      setRole("send");
      setStatus("waiting");
      setStatusText("Registering on P2P network...");
      setErrorMsg("");
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;

      const shortCode = randomCode();

      const fail = (msg) => {
        if (myRunId !== runIdRef.current) return;
        setStatus("error");
        setStatusText("");
        setErrorMsg(msg);
        sounds.error();
      };

      try {
        const { peer } = await ensurePeer(shortCode, (err) => fail(err.message));
        if (myRunId !== runIdRef.current) return;

        setCode(shortCode);
        setStatusText("Waiting for receiver...");

        peer.on("connection", (conn) => {
          if (myRunId !== runIdRef.current) return;
          log("Incoming connection from receiver:", conn.peer);
          if (connRef.current && connRef.current !== conn) {
            try { connRef.current.close(); } catch (e) {}
          }
          connRef.current = conn;
          setStatus("connected");
          setStatusText("Receiver connected! Opening stream...");
          sounds.connect();

          const attachPcListeners = () => {
            const pc = conn.peerConnection;
            if (pc) {
              pc.oniceconnectionstatechange = () => {
                log("Sender ICE state:", pc.iceConnectionState);
                if (pc.iceConnectionState === "failed") {
                  log("Sender ICE failed, attempting restart...");
                  try { pc.restartIce(); } catch (e) {}
                }
              };
            }
          };
          attachPcListeners();
          setTimeout(attachPcListeners, 500);

          let streamStarted = false;
          let openWatchdog = null;
          let openTimeout = null;

          const onOpen = () => {
            if (streamStarted || myRunId !== runIdRef.current) return;
            streamStarted = true;
            if (openWatchdog) clearInterval(openWatchdog);
            if (openTimeout) clearTimeout(openTimeout);
            dataChannelActiveRef.current = true;
            setStatusText("P2P Stream Active!");
            startHeartbeat(conn);
            sendFilesOverConnection(conn, files, myRunId);
          };

          if (conn.open || conn.dataChannel?.readyState === "open") {
            onOpen();
          } else {
            conn.on("open", onOpen);
            conn.dataChannel?.addEventListener("open", onOpen);
          }

          // Active watchdog to catch immediate or delayed dataChannel readyState changes
          openWatchdog = setInterval(() => {
            if (streamStarted || myRunId !== runIdRef.current) {
              if (openWatchdog) clearInterval(openWatchdog);
              return;
            }
            if (conn.open || conn.dataChannel?.readyState === "open") {
              onOpen();
            } else if (conn.dataChannel && !conn.dataChannel.onopen) {
              conn.dataChannel.addEventListener("open", onOpen);
            }
          }, 150);

          // If receiver connects via signaling but direct data channel cannot open within 15s
          openTimeout = setTimeout(() => {
            if (!streamStarted && myRunId === runIdRef.current) {
              if (openWatchdog) clearInterval(openWatchdog);
              log("Sender stream open timed out, reverting to waiting state");
              setStatus("waiting");
              setStatusText("Receiver disconnected or timed out. Waiting for receiver...");
            }
          }, 15000);

          conn.on("data", (data) => {
            lastPongRef.current = Date.now();
            if (data?.type === "ping") { try { conn.send({ type: "pong" }); } catch (e) {} }
          });
          conn.on("close", () => {
            if (openWatchdog) clearInterval(openWatchdog);
            if (openTimeout) clearTimeout(openTimeout);
            clearHeartbeat();
            if (myRunId !== runIdRef.current) return;
            setStatus((s) => (s === "done" ? s : "error"));
          });
        });

        peer.on("error", (err) => {
          if (myRunId !== runIdRef.current) return;
          if (err?.type === "unavailable-id") {
            log("ID unavailable, retrying with new code...");
            startSending(fileOrFiles);
            return;
          }
          if (FATAL_ERROR_TYPES.includes(err?.type)) fail(err?.message || "Connection error");
        });
      } catch (err) {
        fail(err?.message || "Could not start session");
      }
    },
    [ensurePeer, cleanup, startHeartbeat, clearHeartbeat, sendFilesOverConnection]
  );

  // RECEIVER
  const handleIncomingData = useCallback(
    (data) => {
      lastPongRef.current = Date.now();
      if (data && typeof data === "object" && !(data instanceof ArrayBuffer) && !(data instanceof Uint8Array) && data.type) {
        if (data.type === "meta") {
          const meta = { name: data.name, size: data.size, mime: data.mime, index: data.index ?? 0, total: data.total ?? 1 };
          fileMetaRef.current = meta;
          totalBytesRef.current = data.totalBytes || data.size;
          receivedChunksRef.current = [];
          receivedBytesRef.current = 0;
          setFileMeta(meta);
          setStatus("transferring");
          setStatusText(`Receiving: ${data.name}`);
          if (meta.index === 0) resetSpeedTracking();
        } else if (data.type === "file-done") {
          const meta = fileMetaRef.current;
          const blob = new Blob(receivedChunksRef.current, { type: meta?.mime || "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          setReceivedFiles((prev) => [...prev, { name: meta?.name || "file", url, size: meta?.size || blob.size }]);
          overallReceivedBytesRef.current += meta?.size || 0;
          receivedChunksRef.current = [];
          receivedBytesRef.current = 0;
        } else if (data.type === "all-done") {
          setStatus("done");
          setStatusText("Download complete!");
          setProgress(100);
          setEtaSeconds(0);
          sounds.complete();
          clearHeartbeat();
        }
        return;
      }
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
      cleanup();
      const myRunId = runIdRef.current;
      let cleanCode = targetCode.trim().toLowerCase();
      try {
        const url = new URL(cleanCode);
        cleanCode = url.searchParams.get("code") || cleanCode;
      } catch (e) {}
      cleanCode = cleanCode.replace(/[^a-z0-9]/g, "");

      if (!cleanCode) {
        setStatus("error");
        setErrorMsg("Please enter a valid transfer code.");
        sounds.error();
        return;
      }

      setRole("receive");
      setStatus("connecting");
      setStatusText(`Locating sender [${cleanCode}]...`);
      setErrorMsg("");
      setReconnecting(false);
      settledRef.current = false;
      receivedChunksRef.current = [];
      receivedBytesRef.current = 0;
      overallReceivedBytesRef.current = 0;
      totalBytesRef.current = 0;
      revokeAllObjectUrls();
      setReceivedFiles([]);

      const fail = (msg) => {
        if (myRunId !== runIdRef.current || settledRef.current) return;
        settledRef.current = true;
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setStatus("error");
        setStatusText("");
        setErrorMsg(msg);
        sounds.error();
      };

      try {
        const { peer } = await ensurePeer(null, (err) => fail(err.message));
        if (myRunId !== runIdRef.current) return;

        setStatusText(`Connecting to sender [${cleanCode}]...`);

        log("Initiating connection to sender:", cleanCode);
        const conn = peer.connect(cleanCode, { reliable: true });
        connRef.current = conn;

        const attachReceiverPc = () => {
          const pc = conn.peerConnection;
          if (pc) {
            pc.oniceconnectionstatechange = () => {
              log("Receiver ICE state:", pc.iceConnectionState);
              if (pc.iceConnectionState === "failed" && !settledRef.current) {
                fail("Direct P2P connection could not be established. Please retry or check network.");
              }
            };
          }
        };
        attachReceiverPc();
        setTimeout(attachReceiverPc, 500);

        const progressTimer = setTimeout(() => {
          if (!settledRef.current && myRunId === runIdRef.current) {
            setStatusText(`Still waiting for sender [${cleanCode}]... Ensure sender tab is open.`);
          }
        }, 6000);

        connectTimeoutRef.current = setTimeout(() => {
          clearTimeout(progressTimer);
          if (!receiverStreamStarted && myRunId === runIdRef.current && !settledRef.current) {
            if (receiverWatchdog) clearInterval(receiverWatchdog);
            fail(`Could not connect to sender [${cleanCode}]. Verify the 6-digit code on the sender screen.`);
          }
        }, 12000);

        let receiverStreamStarted = false;
        let receiverWatchdog = null;

        const onOpen = () => {
          clearTimeout(progressTimer);
          if (receiverStreamStarted || myRunId !== runIdRef.current || settledRef.current) return;
          receiverStreamStarted = true;
          settledRef.current = true;
          dataChannelActiveRef.current = true;
          if (receiverWatchdog) clearInterval(receiverWatchdog);
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          setStatus("connected");
          setStatusText("Connected! Streaming...");
          sounds.connect();
          startHeartbeat(conn);
        };

        if (conn.open || conn.dataChannel?.readyState === "open") {
          onOpen();
        } else {
          conn.on("open", onOpen);
          conn.dataChannel?.addEventListener("open", onOpen);
        }

        receiverWatchdog = setInterval(() => {
          if (receiverStreamStarted || myRunId !== runIdRef.current || settledRef.current) {
            if (receiverWatchdog) clearInterval(receiverWatchdog);
            return;
          }
          if (conn.open || conn.dataChannel?.readyState === "open") {
            onOpen();
          } else if (conn.dataChannel && !conn.dataChannel.onopen) {
            conn.dataChannel.addEventListener("open", onOpen);
          }
        }, 150);

        conn.on("data", (data) => {
          if (myRunId !== runIdRef.current) return;
          if (data?.type === "ping") { try { conn.send({ type: "pong" }); } catch (e) {} return; }
          if (data?.type === "pong") return;
          handleIncomingData(data);
        });

        conn.on("error", (err) => {
          log("conn error (receiver)", err);
          if (receiverWatchdog) clearInterval(receiverWatchdog);
          if (myRunId !== runIdRef.current) return;
          clearTimeout(progressTimer);
          setStatus("error");
          setStatusText("");
          setErrorMsg(err?.message || "Could not connect. Check the code.");
          sounds.error();
          clearHeartbeat();
        });

        conn.on("close", () => {
          if (receiverWatchdog) clearInterval(receiverWatchdog);
          clearHeartbeat();
          clearTimeout(progressTimer);
          if (myRunId !== runIdRef.current) return;
          setStatus((s) => {
            if (s !== "done") {
              setErrorMsg((m) => m || "Connection closed by sender.");
              return "error";
            }
            return s;
          });
        });

        peer.on("error", (err) => {
          log("peer error (receiver):", err?.type, err?.message);
          if (myRunId !== runIdRef.current) return;
          clearTimeout(progressTimer);
          if (err?.type === "peer-unavailable") {
            fail(`Sender with code [${cleanCode}] not found. Ensure the sender is currently on the pairing screen.`);
          } else {
            fail(err?.message || "Connection failed. Please check the code and retry.");
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
    setStatusText("");
    setRole(null);
    setCode("");
    setProgress(0);
    setFileMeta(null);
    setErrorMsg("");
    setReceivedFiles([]);
    setReconnecting(false);
    setSpeedBps(0);
    setEtaSeconds(null);
    settledRef.current = false;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    overallReceivedBytesRef.current = 0;
    totalBytesRef.current = 0;
    fileMetaRef.current = null;
    reconnectAttemptsRef.current = 0;
  }, [cleanup, revokeAllObjectUrls]);

  return {
    status,
    statusText,
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
