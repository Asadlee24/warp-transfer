"use client";

import { useCallback, useRef, useState } from "react";
import AuroraBackground from "@/components/AuroraBackground";
import Logo from "@/components/Logo";
import { useTransfer } from "@/lib/useTransfer";

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

export default function Home() {
  const [tab, setTab] = useState("send");
  const [dragOver, setDragOver] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const {
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
  } = useTransfer();

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      startSending(file);
    },
    [startSending]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [handleFile]
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

  return (
    <main className="relative min-h-screen flex flex-col items-center px-4 py-14">
      <AuroraBackground />

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
                  Drop a file here
                </p>
                <p className="text-gray-400 text-sm">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
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
                <p className="text-gray-500 text-sm mb-3 truncate">
                  Sending {fileMeta?.name || ""}
                </p>
                <ProgressBar value={progress} />
                <p className="text-gray-400 text-xs mt-2">{progress}%</p>
              </div>
            )}

            {status === "done" && (
              <div className="text-center">
                <p className="text-teal-600 font-medium mb-1">
                  Transfer complete ✓
                </p>
                <p className="text-gray-400 text-xs mb-5">
                  File delivered successfully
                </p>
                <button
                  onClick={reset}
                  className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
                >
                  Send another file
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
              </div>
            )}

            {status === "connecting" && (
              <p className="text-gray-500 text-sm text-center animate-pulse">
                {reconnecting ? "Reconnecting…" : "Connecting…"}
              </p>
            )}

            {(status === "connected" || status === "transferring") && (
              <div>
                <p className="text-gray-500 text-sm mb-3 truncate">
                  Receiving {fileMeta?.name || "file"}{" "}
                  {fileMeta?.size ? `(${formatBytes(fileMeta.size)})` : ""}
                </p>
                <ProgressBar value={progress} />
                <p className="text-gray-400 text-xs mt-2">{progress}%</p>
              </div>
            )}

            {status === "done" && (
              <div className="text-center">
                <p className="text-teal-600 font-medium mb-1">Ready ✓</p>
                <p className="text-gray-400 text-xs mb-5 truncate">
                  {receivedName}
                </p>
                <a
                  href={receivedUrl}
                  download={receivedName}
                  className="inline-block px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-teal-500 text-white text-sm font-medium mb-3"
                >
                  Download file
                </a>
                <br />
                <button
                  onClick={reset}
                  className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
                >
                  Receive another
                </button>
              </div>
            )}

            {status === "error" && (
              <div className="text-center">
                <p className="text-red-500 font-medium mb-1">
                  Couldn't connect
                </p>
                <p className="text-gray-400 text-xs mb-2">{errorMsg}</p>
                <p className="text-gray-400 text-xs mb-5">
                  Make sure the sender's tab is still open and in the
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
    </main>
  );
}
