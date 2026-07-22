"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sounds } from "./sounds";

const CHUNK_SIZE = 64 * 1024; // 64KB
const BUFFER_LIMIT = 8 * 1024 * 1024; // pause sending above 8MB buffered
const CONNECT_TIMEOUT_MS = 25000;
const MAX_RECONNECT_ATTEMPTS = 6;

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

export function useTransfer() {
  const [status, setStatus] = useState("idle"); // idle | waiting | connecting | connected | transferring | done | error
  const [role, setRole] = useState(null); // 'send' | 'receive'
  const [code, setCode] = useState("");
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [receivedUrl, setReceivedUrl] = useState(null);
  const [receivedName, setReceivedName] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const fileRef = useRef(null);
  const fileMetaRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const connectTimeoutRef = useRef(null);
  const settledRef = useRef(false);

  const cleanup = useCallback(() => {
    if (peerRef.current?._onVisible) {
      document.removeEventListener("visibilitychange", peerRef.current._onVisible);
    }
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    connRef.current?.close?.();
    peerRef.current?.destroy?.();
    peerRef.current = null;
    connRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const ensurePeer = useCallback((id, onUnrecoverable) => {
    return new Promise((resolve, reject) => {
      import("peerjs").then(({ default: Peer }) => {
        const peer = id ? new Peer(id) : new Peer();
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
            onUnrecoverable?.(
              new Error(
                "Lost the connection and couldn't reconnect. Please start a new transfer."
              )
            );
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

        peer.on("open", (assignedId) => resolve({ peer, assignedId }));
        peer.on("error", (err) => reject(err));
      });
    });
  }, []);

  // --- SENDER ---
  const startSending = useCallback(
    async (file) => {
      setRole("send");
      setStatus("waiting");
      setErrorMsg("");
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
      fileRef.current = file;
      const shortCode = randomCode();

      const fail = (msg) => {
        setStatus("error");
        setErrorMsg(msg);
        sounds.error();
      };

      try {
        const { peer } = await ensurePeer(shortCode, (err) => fail(err.message));
        setCode(shortCode);

        peer.on("connection", (conn) => {
          connRef.current = conn;
          setStatus("connected");
          sounds.connect();

          conn.on("open", () => {
            sendFileOverConnection(conn, file);
          });

          conn.on("close", () => {
            setStatus((s) => (s === "done" ? s : "error"));
          });
        });

        peer.on("error", (err) => {
          if (FATAL_ERROR_TYPES.includes(err?.type)) {
            fail(err?.message || "Connection error");
          }
          // Non-fatal errors (network blips, server hiccups) are handled by
          // the automatic reconnect logic in ensurePeer.
        });
      } catch (err) {
        fail(err?.message || "Could not start session");
      }
    },
    [ensurePeer]
  );

  const sendFileOverConnection = (conn, file) => {
    setStatus("transferring");
    conn.send({
      type: "meta",
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
    });

    let offset = 0;

    const sendNextChunk = () => {
      const dc = conn.dataChannel;
      if (dc && dc.bufferedAmount > BUFFER_LIMIT) {
        setTimeout(sendNextChunk, 50);
        return;
      }

      if (offset >= file.size) {
        conn.send({ type: "done" });
        setStatus("done");
        setProgress(100);
        sounds.complete();
        return;
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const reader = new FileReader();
      reader.onload = (e) => {
        conn.send(e.target.result);
        offset += slice.size;
        setProgress(Math.min(100, Math.round((offset / file.size) * 100)));
        sendNextChunk();
      };
      reader.readAsArrayBuffer(slice);
    };

    sendNextChunk();
  };

  // --- RECEIVER ---
  const startReceiving = useCallback(
    async (targetCode) => {
      setRole("receive");
      setStatus("connecting");
      setErrorMsg("");
      setReconnecting(false);
      reconnectAttemptsRef.current = 0;
      receivedChunksRef.current = [];
      receivedBytesRef.current = 0;
      settledRef.current = false;

      const fail = (msg) => {
        if (settledRef.current) return;
        settledRef.current = true;
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setStatus("error");
        setErrorMsg(msg);
        sounds.error();
      };

      try {
        const { peer } = await ensurePeer(null, (err) => fail(err.message));
        const conn = peer.connect(targetCode.trim().toLowerCase(), {
          reliable: true,
        });
        connRef.current = conn;

        connectTimeoutRef.current = setTimeout(() => {
          fail(
            "Connection timed out. Make sure the sender's tab is still open and the code is correct."
          );
        }, CONNECT_TIMEOUT_MS);

        conn.on("open", () => {
          settledRef.current = true;
          if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
          setStatus("connected");
          sounds.connect();
        });

        conn.on("data", (data) => {
          handleIncomingData(data);
        });

        conn.on("error", (err) => {
          fail(err?.message || "Could not connect. Check the code.");
        });

        conn.on("close", () => {
          setStatus((s) => (s === "done" ? s : "error"));
        });

        peer.on("error", (err) => {
          if (FATAL_ERROR_TYPES.includes(err?.type)) {
            fail(err?.message || "Could not connect. Check the code.");
          }
        });
      } catch (err) {
        fail(err?.message || "Could not connect");
      }
    },
    [ensurePeer]
  );

  const handleIncomingData = (data) => {
    if (data && typeof data === "object" && !(data instanceof ArrayBuffer) && data.type) {
      if (data.type === "meta") {
        const meta = { name: data.name, size: data.size, mime: data.mime };
        fileMetaRef.current = meta;
        setFileMeta(meta);
        setStatus("transferring");
      } else if (data.type === "done") {
        const meta = fileMetaRef.current;
        const blob = new Blob(receivedChunksRef.current, {
          type: meta?.mime || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        setReceivedUrl(url);
        setReceivedName(meta?.name || "downloaded-file");
        setStatus("done");
        setProgress(100);
        sounds.complete();
      }
      return;
    }

    // binary chunk
    receivedChunksRef.current.push(data);
    receivedBytesRef.current += data.byteLength || data.size || 0;
    const meta = fileMetaRef.current;
    if (meta?.size) {
      setProgress(
        Math.min(100, Math.round((receivedBytesRef.current / meta.size) * 100))
      );
    }
  };

  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setRole(null);
    setCode("");
    setProgress(0);
    setFileMeta(null);
    setErrorMsg("");
    setReceivedUrl(null);
    setReceivedName(null);
    setReconnecting(false);
    reconnectAttemptsRef.current = 0;
    settledRef.current = false;
    receivedChunksRef.current = [];
    receivedBytesRef.current = 0;
    fileMetaRef.current = null;
  }, [cleanup]);

  return {
    status,
    role,
    code,
    progress,
    fileMeta,
    errorMsg,
    receivedUrl,
    receivedName,
    reconnecting,
    startSending,
    startReceiving,
    reset,
  };
}
