"use client";

export default function NodeP2PGraph3D({ role = "send", status = "idle", speedBps = 0 }) {
  const isTransferring = status === "transferring";
  const isConnected = status === "connected" || isTransferring;

  return (
    <div className="relative w-full py-4 px-2 my-2 flex items-center justify-between bg-slate-900/40 rounded-2xl border border-white/10 backdrop-blur-md">
      {/* Sender Node */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            role === "send"
              ? "bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-[0_0_20px_rgba(139,92,246,0.6)] scale-105 border border-violet-400"
              : "bg-slate-800 border border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-xl">📱</span>
        </div>
        <span className="text-[11px] font-medium text-slate-300">
          {role === "send" ? "This Device" : "Sender Node"}
        </span>
      </div>

      {/* Dynamic P2P Laser Connection Line */}
      <div className="relative flex-1 mx-4 h-8 flex items-center justify-center">
        {/* Base Line */}
        <div className="absolute inset-x-0 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${
              isConnected
                ? "bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 shadow-[0_0_10px_#06b6d4]"
                : "bg-slate-700"
            }`}
          />
        </div>

        {/* Animated Speed Energy Rays */}
        {isConnected && (
          <div className="absolute inset-0 flex items-center overflow-hidden">
            <div
              className={`w-20 h-1.5 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-white shadow-[0_0_15px_#38bdf8] ${
                isTransferring ? "animate-warp-beam" : "animate-pulse"
              }`}
            />
          </div>
        )}

        {/* Status Badge in Center */}
        <div className="relative z-10 px-3 py-1 rounded-full bg-slate-950/90 border border-cyan-500/30 text-[10px] font-semibold tracking-wider uppercase text-cyan-300 shadow-lg flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isTransferring
                ? "bg-cyan-400 animate-ping"
                : isConnected
                ? "bg-emerald-400"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          {isTransferring
            ? "P2P Stream Active"
            : isConnected
            ? "Encrypted Link Ready"
            : status === "connecting"
            ? "Handshaking..."
            : "Direct WebRTC"}
        </div>
      </div>

      {/* Receiver Node */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            role === "receive"
              ? "bg-gradient-to-tr from-cyan-600 to-teal-500 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-105 border border-cyan-400"
              : "bg-slate-800 border border-slate-700 text-slate-400"
          }`}
        >
          <span className="text-xl">💻</span>
        </div>
        <span className="text-[11px] font-medium text-slate-300">
          {role === "receive" ? "This Device" : "Receiver Node"}
        </span>
      </div>
    </div>
  );
}
