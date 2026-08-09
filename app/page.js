"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import WarpBackground3D from "@/components/WarpBackground3D";
import TiltCard3D from "@/components/TiltCard3D";
import NodeP2PGraph3D from "@/components/NodeP2PGraph3D";
import Logo from "@/components/Logo";
import QrScanner from "@/components/QrScanner";
import { useTransfer } from "@/lib/useTransfer";
import { getMuted, setMuted as persistMuted, sounds } from "@/lib/sounds";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 1) return "0 B/s";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds) {
  if (seconds === null || seconds === undefined) return "Calculating...";
  if (seconds <= 0) return "Finishing...";
  if (seconds < 60) return `${seconds}s left`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s left`;
}

function GlowingCircularProgress({ value, speedBps, etaSeconds }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center my-6">
      <div className="relative w-44 h-44 flex items-center justify-center">
        {/* Ambient Glowing Aura */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/25 via-rose-400/20 to-orange-400/20 blur-xl animate-pulse-glow" />

        <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_18px_rgba(245,158,11,0.45)]">
          {/* Background Track */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="stroke-stone-800"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Animated Warm Arc */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="stroke-[url(#progressGrad)] transition-all duration-300 ease-out"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
          <defs>
            <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-extrabold bg-gradient-to-r from-amber-400 via-rose-400 to-orange-400 bg-clip-text text-transparent">
            {value}%
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-amber-400 uppercase mt-0.5">
            {formatSpeed(speedBps)}
          </span>
        </div>
      </div>

      <div className="mt-3 text-xs font-medium text-stone-400 bg-stone-900/60 px-3 py-1 rounded-full border border-stone-700/60 shadow-inner">
        ETA: <span className="text-stone-200 font-semibold">{formatEta(etaSeconds)}</span>
      </div>
    </div>
  );
}

function MuteToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(getMuted());
  }, []);

  const toggle = () => {
    const next = !muted;
    setMutedState(next);
    persistMuted(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      className="fixed top-5 right-5 w-10 h-10 rounded-2xl bg-stone-900/80 border border-stone-700/60 shadow-lg flex items-center justify-center text-stone-300 hover:text-white hover:border-amber-500/50 hover:scale-105 transition-all z-50 backdrop-blur-xl"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        {muted ? (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        ) : (
          <>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </>
        )}
      </svg>
    </button>
  );
}

export default function Home() {
  const [tab, setTab] = useState("send");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const autoConnectedRef = useRef(false);

  const {
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
    receiverCount,
    startSending,
    startReceiving,
    reset,
  } = useTransfer();

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    const params = new URLSearchParams(window.location.search);
    const codeFromLink = params.get("code");
    if (codeFromLink && !autoConnectedRef.current) {
      autoConnectedRef.current = true;
      setTab("receive");
      setInputCode(codeFromLink);
    }
  }, []);

  useEffect(() => {
    if (status === "done") {
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ["#f59e0b", "#fb7185", "#f97316", "#fbbf24"],
        });
      }).catch(() => {});
    }
  }, [status]);

  const handleFilesSelect = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartSending = useCallback(() => {
    if (!selectedFiles.length) return;
    startSending(selectedFiles);
  }, [selectedFiles, startSending]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFilesSelect(e.dataTransfer.files);
    },
    [handleFilesSelect]
  );

  const busy = status !== "idle";

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [code]);

  const copyShareLink = useCallback(async () => {
    const shareUrl = `${siteOrigin}/?code=${code}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [siteOrigin, code]);

  const handleScanResult = useCallback(
    (scannedCode) => {
      setScannerOpen(false);
      setInputCode(scannedCode);
      startReceiving(scannedCode);
    },
    [startReceiving]
  );

  const downloadAll = useCallback((files) => {
    files.forEach((f, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = f.url;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350);
    });
  }, []);

  const shareUrl = siteOrigin && code ? `${siteOrigin}/?code=${code}` : "";
  const qrUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(shareUrl)}`
    : "";

  const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between px-4 py-10 selection:bg-amber-500 selection:text-black">
      {/* 3D Warm Particle Background */}
      <WarpBackground3D speeding={status === "transferring"} active={busy} />
      <MuteToggle />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
        {/* Brand Header */}
        <header className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-3 mb-3 animate-float">
            <Logo size={46} />
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight shimmer-text drop-shadow-[0_0_30px_rgba(245,158,11,0.4)]">
              Warp 3D
            </h1>
          </div>
          <p className="text-stone-400 text-sm md:text-base max-w-md font-medium">
            Multi-Receiver P2P Transfer. Encrypted, direct stream, zero servers.
          </p>
        </header>

        {/* Mode Selector Tabs */}
        <div className="flex p-1.5 rounded-2xl bg-stone-900/80 border border-stone-700/50 backdrop-blur-xl mb-6 shadow-2xl border-pulse">
          {["send", "receive"].map((t) => (
            <button
              key={t}
              disabled={busy && status !== "error"}
              onClick={() => {
                reset();
                setSelectedFiles([]);
                setTab(t);
              }}
              className={`px-8 py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                tab === t
                  ? "bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 text-white shadow-[0_0_22px_rgba(245,158,11,0.5)]"
                  : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/40"
              } ${busy && status !== "error" ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {t === "send" ? "Send Files" : "Receive Files"}
            </button>
          ))}
        </div>

        {/* 3D Glassmorphism Interactive Card */}
        <TiltCard3D className="w-full p-6 md:p-8">
          {/* Realtime P2P Node Link Diagram */}
          <NodeP2PGraph3D role={role || tab} status={status} speedBps={speedBps} receiverCount={receiverCount} />

          {/* Multi-Receiver Badge */}
          {role === "send" && receiverCount > 0 && (
            <div className="mb-4 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-between shadow-inner">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Multi-Receiver Stream Active
              </span>
              <span className="bg-amber-500 text-black px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                {receiverCount} Device{receiverCount > 1 ? "s" : ""} Connected
              </span>
            </div>
          )}

          {/* Status Banner */}
          {statusText && (
            <div className="mb-5 px-4 py-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center text-xs font-semibold text-amber-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              {statusText}
            </div>
          )}

          {/* SENDER VIEW */}
          {tab === "send" && (
            <>
              {status === "idle" && (
                <div className="flex flex-col gap-4">
                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group cursor-pointer rounded-2xl border-2 border-dashed p-8 md:p-10 text-center transition-all duration-300 flex flex-col items-center justify-center ${
                      dragOver
                        ? "border-amber-400 bg-amber-950/30 scale-[1.02]"
                        : "border-stone-700/80 bg-stone-900/30 hover:border-amber-500/60 hover:bg-stone-900/60"
                    }`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600/25 to-rose-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border border-amber-500/20">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-amber-400">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="text-stone-200 font-bold text-base md:text-lg mb-1">
                      Drop files here
                    </p>
                    <p className="text-stone-400 text-xs md:text-sm">
                      or click to browse from device — multiple files supported
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFilesSelect(e.target.files)}
                    />
                  </div>

                  {/* Selected File List */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center justify-between text-xs text-stone-400 font-medium px-1">
                        <span>Selected ({selectedFiles.length} files)</span>
                        <span>Total: {formatBytes(totalSelectedSize)}</span>
                      </div>
                      <div className="max-h-44 overflow-y-auto flex flex-col gap-2 pr-1">
                        {selectedFiles.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-stone-900/80 border border-stone-800 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400 shrink-0">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <span className="text-stone-200 font-medium truncate">
                                {file.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-stone-400 text-[11px]">
                                {formatBytes(file.size)}
                              </span>
                              <button
                                onClick={() => removeFile(i)}
                                className="text-stone-500 hover:text-rose-400 text-base font-bold transition-colors w-5 h-5 flex items-center justify-center"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleStartSending}
                        className="w-full mt-3 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 text-white font-bold text-sm glow-button shadow-xl flex items-center justify-center gap-2"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        Start Multi-Receiver Transfer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {status === "waiting" && (
                <div className="text-center py-4 flex flex-col items-center">
                  <p className="text-stone-400 text-xs uppercase tracking-widest font-semibold mb-2">
                    Pairing Code (Share with multiple devices)
                  </p>
                  <div className="code-char text-5xl md:text-6xl font-extrabold tracking-widest bg-gradient-to-r from-amber-400 via-rose-400 to-orange-400 bg-clip-text text-transparent glow-text-amber my-3">
                    {code}
                  </div>

                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={copyCode}
                      className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-bold transition-all shadow-md"
                    >
                      {copied ? "Copied" : "Copy Code"}
                    </button>
                    <button
                      onClick={copyShareLink}
                      className="px-5 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Copy Link
                    </button>
                  </div>

                  {qrUrl && (
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-stone-900/80 border border-stone-800 mb-4 shadow-2xl">
                      <Image
                        src={qrUrl}
                        alt="QR Code"
                        width={150}
                        height={150}
                        unoptimized
                        className="rounded-xl border border-stone-700"
                      />
                      <p className="text-stone-400 text-[11px] mt-2.5 font-medium">
                        Multiple devices can scan & download simultaneously
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-stone-400 text-xs animate-pulse font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {reconnecting ? "Re-establishing signal..." : "Listening for incoming receivers..."}
                  </div>
                </div>
              )}

              {(status === "connected" || status === "transferring") && (
                <div className="flex flex-col items-center">
                  <p className="text-stone-300 font-bold text-sm text-center truncate max-w-xs mb-1">
                    Streaming {fileMeta?.name || "Files"}
                  </p>
                  {fileMeta?.total > 1 && (
                    <span className="text-stone-400 text-xs font-medium">
                      File {fileMeta.index + 1} of {fileMeta.total}
                    </span>
                  )}
                  <GlowingCircularProgress
                    value={progress}
                    speedBps={speedBps}
                    etaSeconds={etaSeconds}
                  />
                </div>
              )}

              {status === "done" && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center mx-auto mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-amber-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-amber-400 font-bold text-xl mb-1">
                    Multi-Stream Delivered!
                  </h3>
                  <p className="text-stone-400 text-xs mb-6">
                    All files delivered directly to connected devices over encrypted P2P stream.
                  </p>
                  <button
                    onClick={() => {
                      reset();
                      setSelectedFiles([]);
                    }}
                    className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-bold transition-all shadow-lg"
                  >
                    Send More Files
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-400/40 flex items-center justify-center mx-auto mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-rose-400">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <h3 className="text-rose-400 font-bold text-lg mb-1">
                    Connection Issue
                  </h3>
                  <p className="text-stone-400 text-xs mb-6 max-w-xs mx-auto">
                    {errorMsg || "Could not complete transfer."}
                  </p>
                  <button
                    onClick={() => {
                      reset();
                      setSelectedFiles([]);
                    }}
                    className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-bold transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </>
          )}

          {/* RECEIVER VIEW */}
          {tab === "receive" && (
            <>
              {status === "idle" && (
                <div className="flex flex-col gap-4 py-2">
                  <p className="text-stone-300 text-xs font-bold text-center uppercase tracking-widest">
                    Enter Sender Code
                  </p>
                  <input
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toLowerCase())}
                    placeholder="e.g. h4k9zq"
                    maxLength={6}
                    className="code-char w-full text-center text-3xl font-extrabold tracking-widest glass-input rounded-2xl py-4 text-amber-300 outline-none transition-all placeholder:text-stone-700"
                  />
                  <button
                    disabled={inputCode.trim().length < 4}
                    onClick={() => startReceiving(inputCode)}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 text-white font-bold text-sm glow-button disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shadow-xl flex items-center justify-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                    Connect and Download
                  </button>
                  <button
                    onClick={() => setScannerOpen(true)}
                    className="w-full py-3 rounded-2xl bg-stone-900/80 border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <polyline points="23 7 23 1 17 1" />
                      <line x1="16" y1="8" x2="23" y2="1" />
                      <polyline points="1 17 1 23 7 23" />
                      <line x1="8" y1="16" x2="1" y2="23" />
                      <polyline points="23 17 23 23 17 23" />
                      <line x1="16" y1="16" x2="23" y2="23" />
                      <polyline points="1 7 1 1 7 1" />
                      <line x1="8" y1="8" x2="1" y2="1" />
                    </svg>
                    Scan QR Code
                  </button>
                </div>
              )}

              {status === "connecting" && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full border-4 border-amber-400/30 border-t-amber-400 animate-spin mx-auto mb-4" />
                  <p className="text-stone-300 text-sm font-semibold animate-pulse">
                    Connecting to sender node...
                  </p>
                </div>
              )}

              {(status === "connected" || status === "transferring") && (
                <div className="flex flex-col items-center">
                  <p className="text-stone-300 font-bold text-sm text-center truncate max-w-xs mb-1">
                    Receiving {fileMeta?.name || "File"}
                  </p>
                  <GlowingCircularProgress
                    value={progress}
                    speedBps={speedBps}
                    etaSeconds={etaSeconds}
                  />
                </div>
              )}

              {status === "done" && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-400/40 flex items-center justify-center mx-auto mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-amber-400">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-amber-400 font-bold text-xl mb-1">
                    Received Successfully
                  </h3>
                  <p className="text-stone-400 text-xs mb-4">
                    {receivedFiles.length} file(s) ready to save.
                  </p>

                  {receivedFiles.length > 1 && (
                    <button
                      onClick={() => downloadAll(receivedFiles)}
                      className="w-full py-3 mb-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold glow-button shadow-lg"
                    >
                      Save All ({receivedFiles.length} Files)
                    </button>
                  )}

                  <div className="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto">
                    {receivedFiles.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        download={f.name}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-stone-900/90 border border-stone-800 hover:border-amber-400/50 transition-all text-left group"
                      >
                        <span className="text-stone-200 text-xs font-medium truncate group-hover:text-amber-300">
                          {f.name}
                        </span>
                        <span className="text-amber-400 text-[11px] font-semibold whitespace-nowrap bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1">
                          {formatBytes(f.size)}
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </span>
                      </a>
                    ))}
                  </div>

                  <button
                    onClick={reset}
                    className="text-stone-400 hover:text-stone-200 text-xs font-medium transition-colors"
                  >
                    Receive More Files
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-400/40 flex items-center justify-center mx-auto mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-rose-400">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <h3 className="text-rose-400 font-bold text-lg mb-1">
                    Connection Failed
                  </h3>
                  <p className="text-stone-400 text-xs mb-6 max-w-xs mx-auto">
                    {errorMsg || "Make sure sender tab is open and code is correct."}
                  </p>
                  <button
                    onClick={reset}
                    className="px-6 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-bold transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </>
          )}
        </TiltCard3D>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-10 text-stone-500 text-xs flex flex-col sm:flex-row items-center gap-3">
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Direct Encrypted Multi-WebRTC — No Server Storage
        </span>
        <span className="hidden sm:inline">·</span>
        <span>
          Built by{" "}
          <a
            href="https://asad-lee-portfolio.vercel.app"
            className="text-amber-400 hover:underline font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            Asad Lee
          </a>
        </span>
        <span className="hidden sm:inline">·</span>
        <a
          href="https://www.instagram.com/asadleeafridi?igsh=bDRmMGd1c3o1NzBl&utm_source=qr"
          target="_blank"
          rel="noreferrer"
          className="text-stone-400 hover:text-stone-200 font-medium"
        >
          Instagram
        </a>
      </footer>

      {scannerOpen && (
        <QrScanner
          onResult={handleScanResult}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </main>
  );
}
