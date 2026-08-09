"use client";

export default function NodeP2PGraph3D({ role = "send", status = "idle", speedBps = 0 }) {
  const isTransferring = status === "transferring";
  const isConnected = status === "connected" || isTransferring;

  return (
    <div className="relative w-full py-4 px-2 my-2 flex items-center justify-between bg-stone-900/40 rounded-2xl border border-white/8 backdrop-blur-md">
      {/* Sender Node */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            role === "send"
              ? "bg-gradient-to-tr from-amber-600 to-orange-500 shadow-[0_0_22px_rgba(245,158,11,0.55)] scale-105 border border-amber-400"
              : "bg-stone-800 border border-stone-700 text-stone-400"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <span className="text-[11px] font-medium text-stone-300">
          {role === "send" ? "This Device" : "Sender Node"}
        </span>
      </div>

      {/* P2P Connection Line */}
      <div className="relative flex-1 mx-4 h-8 flex items-center justify-center">
        {/* Base Line */}
        <div className="absolute inset-x-0 h-1 bg-stone-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${
              isConnected
                ? "bg-gradient-to-r from-amber-500 via-rose-400 to-orange-400 shadow-[0_0_10px_#f59e0b]"
                : "bg-stone-700"
            }`}
          />
        </div>

        {/* Animated Energy Beam */}
        {isConnected && (
          <div className="absolute inset-0 flex items-center overflow-hidden">
            <div
              className={`w-20 h-1.5 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-white shadow-[0_0_15px_#f59e0b] ${
                isTransferring ? "animate-warp-beam" : "animate-pulse"
              }`}
            />
          </div>
        )}

        {/* Status Badge */}
        <div className="relative z-10 px-3 py-1 rounded-full bg-stone-950/90 border border-amber-500/25 text-[10px] font-semibold tracking-wider uppercase text-amber-300 shadow-lg flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isTransferring
                ? "bg-amber-400 animate-ping"
                : isConnected
                ? "bg-lime-400"
                : "bg-rose-400 animate-pulse"
            }`}
          />
          {isTransferring
            ? "P2P Streaming"
            : isConnected
            ? "Link Ready"
            : status === "connecting"
            ? "Connecting..."
            : "Direct WebRTC"}
        </div>
      </div>

      {/* Receiver Node */}
      <div className="flex flex-col items-center gap-1 z-10">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
            role === "receive"
              ? "bg-gradient-to-tr from-rose-600 to-pink-500 shadow-[0_0_22px_rgba(251,113,133,0.55)] scale-105 border border-rose-400"
              : "bg-stone-800 border border-stone-700 text-stone-400"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <span className="text-[11px] font-medium text-stone-300">
          {role === "receive" ? "This Device" : "Receiver Node"}
        </span>
      </div>
    </div>
  );
}
