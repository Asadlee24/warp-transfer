"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sounds } from "./sounds";

const CHUNK_SIZE = 64 * 1024; // 64KB
const BUFFER_LIMIT = 8 * 1024 * 1024; // pause sending above 8MB buffered

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

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const receivedChunksRef = useRef([]);
  const receivedBytesRef = useRef(0);
  const fileRef = useRef(null);
  const fileMetaRef = useRef(null);

  const cleanup = useCallback(() => {
    if (peerRef.current?._onVisible) {
      document.removeEventListener("visibilitychange", peerRef.current._onVisible);
    }
    connRef.current?.close?.();
    peerRef.current?.destroy?.();
    peerRef.current = null;
    connRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const ensurePeer = useCallback((id) => {
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
          // Signaling socket dropped (common when iOS backgrounds the tab).
          // Try to recover automatically instead of failing the transfer.
          if (!peer.destroyed) {
            setTimeout(() => {
              if (!peer.destroyed) peer.reconnect();
            }, 500);
          }
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
      fileRef.current = file;
      const shortCode = randomCode();

      try {
        const { peer } = await ensurePeer(shortCode);
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
          setStatus("error");
          setErrorMsg(err?.message || "Connection error");
          sounds.error();
        });
      } catch (err) {
        setStatus("error");
        setErrorMsg(err?.message || "Could not start session");
        sounds.error();
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
      receivedChunksRef.current = [];
      receivedBytesRef.current = 0;

      try {
        const { peer } = await ensurePeer(null);
        const conn = peer.connect(targetCode.trim().toLowerCase(), {
          reliable: true,
        });
        connRef.current = conn;

        conn.on("open", () => {
          setStatus("connected");
          sounds.connect();
        });

        conn.on("data", (data) => {
          handleIncomingData(data);
        });

        conn.on("error", (err) => {
          setStatus("error");
          setErrorMsg(err?.message || "Could not connect. Check the code.");
          sounds.error();
        });

        conn.on("close", () => {
          setStatus((s) => (s === "done" ? s : "error"));
        });

        peer.on("error", (err) => {
          setStatus("error");
          setErrorMsg(err?.message || "Could not connect. Check the code.");
          sounds.error();
        });
      } catch (err) {
        setStatus("error");
        setErrorMsg(err?.message || "Could not connect");
        sounds.error();
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
    startSending,
    startReceiving,
    reset,
  };
}
