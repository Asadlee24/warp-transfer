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
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-600/30 via-cyan-400/30 to-emerald-400/30 blur-xl animate-pulse-glow" />

        <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
          {/* Background Track */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Animated Neon Arc */}
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
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-extrabold bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            {value}%
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-cyan-400 uppercase mt-0.5">
            {formatSpeed(speedBps)}
          </span>
        </div>
      </div>

      <div className="mt-3 text-xs font-medium text-slate-400 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-700/60 shadow-inner">
        ⏱️ ETA: <span className="text-slate-200 font-semibold">{formatEta(etaSeconds)}</span>
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
      className="fixed top-5 right-5 w-10 h-10 rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-lg flex items-center justify-center text-slate-300 hover:text-white hover:border-cyan-500/50 hover:scale-105 transition-all z-50 backdrop-blur-xl"
    >
      {muted ? "🔇" : "🔊"}
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

  // Trigger confetti burst on completion
  useEffect(() => {
    if (status === "done") {
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#a855f7", "#38bdf8", "#34d399", "#f43f5e"],
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
      // fallback copy
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
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(
        shareUrl
      )}`
    : "";

  const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-between px-4 py-10 selection:bg-cyan-500 selection:text-black">
      {/* 3D WebGL Hyperspace Particle Tunnel Background */}
      <WarpBackground3D speeding={status === "transferring"} active={busy} />
      <MuteToggle />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
        {/* Brand Header */}
        <header className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Logo size={46} />
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]">
              Warp 3D
            </h1>
          </div>
          <p className="text-slate-400 text-sm md:text-base max-w-md font-medium">
            Ultra-fast browser-to-browser P2P file portal. Encrypted, zero servers, infinite size.
          </p>
        </header>

        {/* Mode Selector Tabs */}
        <div className="flex p-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-xl mb-6 shadow-2xl">
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
                  ? "bg-gradient-to-r from-violet-600 via-cyan-600 to-teal-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              } ${busy && status !== "error" ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {t === "send" ? "⚡ Send Files" : "📥 Receive Files"}
            </button>
          ))}
        </div>

        {/* 3D Glassmorphism Interactive Card */}
        <TiltCard3D className="w-full p-6 md:p-8">
          {/* Realtime P2P Node Link Diagram */}
          <NodeP2PGraph3D role={role || tab} status={status} speedBps={speedBps} />

          {/* Dynamic Telemetry Status Banner */}
          {statusText && (
            <div className="mb-5 px-4 py-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-center text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
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
                        ? "border-cyan-400 bg-cyan-950/40 scale-[1.02]"
                        : "border-slate-700/80 bg-slate-900/40 hover:border-cyan-500/60 hover:bg-slate-900/70"
                    }`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-cyan-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <span className="text-3xl">📁</span>
                    </div>
                    <p className="text-slate-200 font-bold text-base md:text-lg mb-1">
                      Drag & Drop files here
                    </p>
                    <p className="text-slate-400 text-xs md:text-sm">
                      or click to browse from device (multiple files supported)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFilesSelect(e.target.files)}
                    />
                  </div>

                  {/* Selected File List Queue */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
                        <span>Selected ({selectedFiles.length} files)</span>
                        <span>Total: {formatBytes(totalSelectedSize)}</span>
                      </div>
                      <div className="max-h-44 overflow-y-auto flex flex-col gap-2 pr-1">
                        {selectedFiles.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="text-base">📄</span>
                              <span className="text-slate-200 font-medium truncate">
                                {file.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-400 text-[11px]">
                                {formatBytes(file.size)}
                              </span>
                              <button
                                onClick={() => removeFile(i)}
                                className="text-slate-500 hover:text-red-400 text-base font-bold transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleStartSending}
                        className="w-full mt-3 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-cyan-500 to-teal-400 text-white font-bold text-sm glow-button shadow-xl flex items-center justify-center gap-2"
                      >
                        🚀 Initialize P2P Warp Stream
                      </button>
                    </div>
                  )}
                </div>
              )}

              {status === "waiting" && (
                <div className="text-center py-4 flex flex-col items-center">
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">
                    Pairing Code
                  </p>
                  <div className="code-char text-5xl md:text-6xl font-extrabold tracking-widest bg-gradient-to-r from-violet-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent glow-text-cyan my-3">
                    {code}
                  </div>

                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={copyCode}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all shadow-md"
                    >
                      {copied ? "Copied Code ✓" : "Copy Code"}
                    </button>
                    <button
                      onClick={copyShareLink}
                      className="px-5 py-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all shadow-md"
                    >
                      🔗 Copy Direct Link
                    </button>
                  </div>

                  {qrUrl && (
                    <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-900/80 border border-slate-800 mb-4 shadow-2xl">
                      <Image
                        src={qrUrl}
                        alt="QR Code"
                        width={150}
                        height={150}
                        unoptimized
                        className="rounded-xl border border-slate-700"
                      />
                      <p className="text-slate-400 text-[11px] mt-2.5 font-medium">
                        Scan with camera to auto-connect mobile browser
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-slate-400 text-xs animate-pulse font-medium">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    {reconnecting ? "Re-establishing signal..." : "Listening for incoming receiver..."}
                  </div>
                </div>
              )}

              {(status === "connected" || status === "transferring") && (
                <div className="flex flex-col items-center">
                  <p className="text-slate-300 font-bold text-sm text-center truncate max-w-xs mb-1">
                    Sending {fileMeta?.name || "Files"}
                  </p>
                  {fileMeta?.total > 1 && (
                    <span className="text-slate-400 text-xs font-medium">
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
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto mb-3 text-3xl">
                    ✓
                  </div>
                  <h3 className="text-emerald-400 font-bold text-xl mb-1">
                    Transfer Completed!
                  </h3>
                  <p className="text-slate-400 text-xs mb-6">
                    All files delivered directly over encrypted P2P stream.
                  </p>
                  <button
                    onClick={() => {
                      reset();
                      setSelectedFiles([]);
                    }}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all shadow-lg"
                  >
                    Send More Files
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center mx-auto mb-3 text-2xl text-rose-400">
                    ✕
                  </div>
                  <h3 className="text-rose-400 font-bold text-lg mb-1">
                    Connection Issue
                  </h3>
                  <p className="text-slate-400 text-xs mb-6 max-w-xs mx-auto">
                    {errorMsg || "Could not complete transfer."}
                  </p>
                  <button
                    onClick={() => {
                      reset();
                      setSelectedFiles([]);
                    }}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all"
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
                  <p className="text-slate-300 text-xs font-bold text-center uppercase tracking-widest">
                    Enter Sender Code
                  </p>
                  <input
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toLowerCase())}
                    placeholder="e.g. h4k9zq"
                    maxLength={6}
                    className="code-char w-full text-center text-3xl font-extrabold tracking-widest glass-input rounded-2xl py-4 text-cyan-300 outline-none transition-all placeholder:text-slate-600"
                  />
                  <button
                    disabled={inputCode.trim().length < 4}
                    onClick={() => startReceiving(inputCode)}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-cyan-500 to-teal-400 text-white font-bold text-sm glow-button disabled:opacity-30 disabled:cursor-not-allowed transition-opacity shadow-xl"
                  >
                    ⚡ Connect & Download
                  </button>
                  <button
                    onClick={() => setScannerOpen(true)}
                    className="w-full py-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    📷 Scan QR Code
                  </button>
                </div>
              )}

              {status === "connecting" && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin mx-auto mb-4" />
                  <p className="text-slate-300 text-sm font-semibold animate-pulse">
                    Connecting to sender node...
                  </p>
                </div>
              )}

              {(status === "connected" || status === "transferring") && (
                <div className="flex flex-col items-center">
                  <p className="text-slate-300 font-bold text-sm text-center truncate max-w-xs mb-1">
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
                  <div className="w-16 h-16 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center mx-auto mb-3 text-3xl">
                    ✓
                  </div>
                  <h3 className="text-teal-400 font-bold text-xl mb-1">
                    Received Successfully!
                  </h3>
                  <p className="text-slate-400 text-xs mb-4">
                    {receivedFiles.length} file(s) delivered directly to browser.
                  </p>

                  {receivedFiles.length > 1 && (
                    <button
                      onClick={() => downloadAll(receivedFiles)}
                      className="w-full py-3 mb-3 rounded-xl bg-gradient-to-r from-violet-600 to-teal-400 text-white text-xs font-bold glow-button shadow-lg"
                    >
                      Download All ({receivedFiles.length} Files)
                    </button>
                  )}

                  <div className="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto">
                    {receivedFiles.map((f, i) => (
                      <a
                        key={i}
                        href={f.url}
                        download={f.name}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-400/50 transition-all text-left group"
                      >
                        <span className="text-slate-200 text-xs font-medium truncate group-hover:text-cyan-300">
                          {f.name}
                        </span>
                        <span className="text-cyan-400 text-[11px] font-semibold whitespace-nowrap bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                          {formatBytes(f.size)} · Save ⬇
                        </span>
                      </a>
                    ))}
                  </div>

                  <button
                    onClick={reset}
                    className="text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
                  >
                    Receive More Files
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center mx-auto mb-3 text-2xl text-rose-400">
                    ✕
                  </div>
                  <h3 className="text-rose-400 font-bold text-lg mb-1">
                    Connection Failed
                  </h3>
                  <p className="text-slate-400 text-xs mb-6 max-w-xs mx-auto">
                    {errorMsg || "Ensure sender tab is active and code is typed accurately."}
                  </p>
                  <button
                    onClick={reset}
                    className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </>
          )}
        </TiltCard3D>
      </div>

      {/* Footer Info */}
      <footer className="relative z-10 mt-10 text-slate-500 text-xs flex flex-col sm:flex-row items-center gap-3">
        <span>🔒 Direct Encrypted WebRTC Stream — No File Storage</span>
        <span className="hidden sm:inline">•</span>
        <span>
          Built by{" "}
          <a
            href="https://asad-lee-portfolio.vercel.app"
            className="text-cyan-400 hover:underline font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            Asad Lee
          </a>
        </span>
        <span className="hidden sm:inline">•</span>
        <a
          href="https://www.instagram.com/asadleeafridi?igsh=bDRmMGd1c3o1NzBl&utm_source=qr"
          target="_blank"
          rel="noreferrer"
          className="text-slate-400 hover:text-slate-200 font-medium"
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
