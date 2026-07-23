"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import AuroraBackground from "@/components/AuroraBackground";
import Logo from "@/components/Logo";
import QrScanner from "@/components/QrScanner";
import { useTransfer } from "@/lib/useTransfer";
import { getMuted, setMuted as persistMuted } from "@/lib/sounds";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 1) return "";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds) {
  if (seconds === null || seconds === undefined) return "";
  if (seconds <= 0) return "almost done";
  if (seconds < 60) return `${seconds}s left`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s left`;
}

function ProgressBar({ value }) {
  return (
    <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-blue-500 to-teal-500 transition-all duration-200"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function TransferStats({ progress, speedBps, etaSeconds }) {
  const speed = formatSpeed(speedBps);
  const eta = formatEta(etaSeconds);
  return (
    <div className="flex items-center justify-between text-gray-400 text-xs mt-2">
      <span>{progress}%</span>
      <span>
        {speed}
        {speed && eta ? " · " : ""}
        {eta}
      </span>
    </div>
  );
}

function Tabs({ tab, setTab, disabled }) {
  return (
    <div className="flex gap-2 p-1 rounded-xl bg-gray-100 w-fit mx-auto mb-8">
      {["send", "receive"].map((t) => (
        <button
          key={t}
          disabled={disabled}
          onClick={() => setTab(t)}
          className={`px-6 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
            tab === t
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {t}
        </button>
      ))}
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
      className="fixed top-5 right-5 w-9 h-9 rounded-full bg-white/80 border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors z-10"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

export default function Home() {
  const [tab, setTab] = useState("send");
  const [dragOver, setDragOver] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef(null);
  const autoConnectedRef = useRef(false);

  const {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      startSending(files);
    },
    [startSending]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const busy = status !== "idle";

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — ignore silently
    }
  }, [code]);

  const handleScanResult = useCallback(
    (scannedCode) => {
      setScannerOpen(false);
      setInputCode(scannedCode);
      startReceiving(scannedCode);
    },
    [startReceiving]
  );

  const shareUrl = siteOrigin && code ? `${siteOrigin}/?code=${code}` : "";
  const qrUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(
        shareUrl
      )}`
    : "";

  return (
    <main className="relative min-h-screen flex flex-col items-center px-4 py-14">
      <AuroraBackground />
      <MuteToggle />

      <header className="flex items-center gap-3 mb-2">
        <Logo size={38} />
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-blue-600 to-teal-500 bg-clip-text text-transparent">
          Warp
        </h1>
      </header>
      <p className="text-gray-500 text-sm mb-10 text-center max-w-md">
        Instant browser-to-browser file transfer. No upload, no size limit,
        no account.
      </p>

      <Tabs tab={tab} setTab={(t) => { reset(); setTab(t); }} disabled={busy && status !== "error"} />

      <div className="glass w-full max-w-md rounded-2xl p-6 md:p-8">
        {tab === "send" && (
          <>
            {status === "idle" && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                  dragOver
                    ? "border-teal-400 bg-teal-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="text-gray-700 font-medium mb-1">
                  Drop files here
                </p>
                <p className="text-gray-400 text-sm">or click to browse (multiple files supported)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            )}

            {status === "waiting" && (
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-3">Share this code</p>
                <div className="code-char text-4xl font-bold tracking-widest bg-gradient-to-r from-violet-600 to-teal-500 bg-clip-text text-transparent mb-4">
                  {code}
                </div>
                <button
                  onClick={copyCode}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm mb-5 transition-colors"
                >
                  {copied ? "Copied ✓" : "Copy code"}
                </button>

                {qrUrl && (
                  <div className="flex flex-col items-center mb-5">
                    <Image
                      src={qrUrl}
                      alt="QR code to open the receive link"
                      width={140}
                      height={140}
                      unoptimized
                      className="rounded-lg border border-gray-200"
                    />
                    <p className="text-gray-400 text-xs mt-2">
                      Scan on the other device to auto-fill the code
                    </p>
                  </div>
                )}

                <p className="text-gray-400 text-xs mb-6">
                  Waiting for the receiver to connect…
                </p>
                <p className="text-amber-600/70 text-xs mb-2">
                  Keep this tab open and in view — switching apps can drop
                  the connection on some phones.
                </p>
                <div className="animate-pulse text-gray-400 text-xs">
                  {reconnecting ? "● reconnecting…" : "● listening"}
                </div>
              </div>
            )}

            {(status === "connected" || status === "transferring") && (
              <div>
                <p className="text-gray-500 text-sm mb-1 truncate">
                  Sending {fileMeta?.name || ""}
                </p>
                {fileMeta?.total > 1 && (
                  <p className="text-gray-400 text-xs mb-2">
                    File {fileMeta.index + 1} of {fileMeta.total}
                  </p>
                )}
                <ProgressBar value={progress} />
                <TransferStats
                  progress={progress}
                  speedBps={speedBps}
                  etaSeconds={etaSeconds}
                />
              </div>
            )}

            {status === "done" && (
              <div className="text-center">
                <p className="text-teal-600 font-medium mb-1">
                  Transfer complete ✓
                </p>
                <p className="text-gray-400 text-xs mb-5">
                  {fileMeta?.total > 1
                    ? `${fileMeta.total} files delivered successfully`
                    : "File delivered successfully"}
                </p>
                <button
                  onClick={reset}
                  className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
                >
                  Send more files
                </button>
              </div>
            )}

            {status === "error" && (
              <div className="text-center">
                <p className="text-red-500 font-medium mb-1">
                  Something went wrong
                </p>
                <p className="text-gray-400 text-xs mb-5">{errorMsg}</p>
                <button
                  onClick={reset}
                  className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </>
        )}

        {tab === "receive" && (
          <>
            {status === "idle" && (
              <div>
                <p className="text-gray-500 text-sm mb-3 text-center">
                  Enter the code you were given
                </p>
                <input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="e.g. h4k9zq"
                  maxLength={6}
                  className="code-char w-full text-center text-2xl tracking-widest bg-gray-50 border border-gray-200 rounded-xl py-3 mb-4 outline-none focus:border-teal-400 text-gray-900 transition-colors"
                />
                <button
                  disabled={inputCode.trim().length < 4}
                  onClick={() => startReceiving(inputCode)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-teal-500 text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                >
                  Connect
                </button>
                <button
                  onClick={() => setScannerOpen(true)}
                  className="w-full py-2.5 mt-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
                >
                  📷 Scan QR code instead
                </button>
              </div>
            )}

            {status === "connecting" && (
              <p className="text-gray-500 text-sm text-center animate-pulse">
                {reconnecting ? "Reconnecting…" : "Connecting…"}
              </p>
            )}

            {(status === "connected" || status === "transferring") && (
              <div>
                <p className="text-gray-500 text-sm mb-1 truncate">
                  Receiving {fileMeta?.name || "file"}{" "}
                  {fileMeta?.size ? `(${formatBytes(fileMeta.size)})` : ""}
                </p>
                {fileMeta?.total > 1 && (
                  <p className="text-gray-400 text-xs mb-2">
                    File {fileMeta.index + 1} of {fileMeta.total}
                  </p>
                )}
                <ProgressBar value={progress} />
                <TransferStats
                  progress={progress}
                  speedBps={speedBps}
                  etaSeconds={etaSeconds}
                />
              </div>
            )}

            {status === "done" && (
              <div className="text-center">
                <p className="text-teal-600 font-medium mb-1">Ready ✓</p>
                <p className="text-gray-400 text-xs mb-4">
                  {receivedFiles.length > 1
                    ? `${receivedFiles.length} files received`
                    : "1 file received"}
                </p>
                <div className="flex flex-col gap-2 mb-4">
                  {receivedFiles.map((f, i) => (
                    <a
                      key={i}
                      href={f.url}
                      download={f.name}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-teal-400 transition-colors text-left"
                    >
                      <span className="text-gray-700 text-sm truncate">{f.name}</span>
                      <span className="text-gray-400 text-xs whitespace-nowrap">
                        {formatBytes(f.size)} · Download
                      </span>
                    </a>
                  ))}
                </div>
                <button
                  onClick={reset}
                  className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
                >
                  Receive more files
                </button>
              </div>
            )}

            {status === "error" && (
              <div className="text-center">
                <p className="text-red-500 font-medium mb-1">
                  Couldn&apos;t connect
                </p>
                <p className="text-gray-400 text-xs mb-2">{errorMsg}</p>
                <p className="text-gray-400 text-xs mb-5">
                  Make sure the sender&apos;s tab is still open and in the
                  foreground, and the code was typed correctly.
                </p>
                <button
                  onClick={reset}
                  className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-gray-400 text-xs mt-4 max-w-sm text-center">
        Files transfer directly between browsers over an encrypted
        connection — nothing is stored on a server. Keep both tabs open
        until the transfer finishes.
      </p>

      <footer className="mt-16 text-gray-400 text-xs flex items-center gap-4">
        <span>
          Built by{" "}
          <a
            href="https://asad-lee-portfolio.vercel.app"
            className="text-gray-600 hover:text-gray-900 transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            Asad Lee
          </a>
        </span>
        <a
          href="https://www.instagram.com/asadleeafridi?igsh=bDRmMGd1c3o1NzBl&utm_source=qr"
          target="_blank"
          rel="noreferrer"
          className="text-gray-600 hover:text-gray-900 transition-colors"
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
