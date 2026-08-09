export default function Logo({ size = 44 }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-600 via-cyan-500 to-teal-400 blur-lg opacity-60 animate-pulse" />
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]"
      >
        <defs>
          <linearGradient id="warpGrad" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        <circle cx="10" cy="24" r="6" fill="url(#warpGrad)" />
        <circle cx="38" cy="24" r="6" fill="url(#warpGrad)" opacity="0.9" />
        <path
          d="M16 24H32"
          stroke="url(#warpGrad)"
          strokeWidth="3"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        <path
          d="M26 17L33 24L26 31"
          stroke="url(#warpGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
