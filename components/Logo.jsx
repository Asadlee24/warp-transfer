export default function Logo({ size = 44 }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 blur-lg opacity-55 animate-pulse" />
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_14px_rgba(245,158,11,0.75)]"
      >
        <defs>
          <linearGradient id="warpGrad" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        {/* Left node */}
        <circle cx="10" cy="24" r="6" fill="url(#warpGrad)" />
        {/* Right node */}
        <circle cx="38" cy="24" r="6" fill="url(#warpGrad)" opacity="0.9" />
        {/* Connection line */}
        <path
          d="M16 24H32"
          stroke="url(#warpGrad)"
          strokeWidth="3"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        {/* Arrow */}
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
