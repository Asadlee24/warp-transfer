export default function Logo({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="warpGrad" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="24" r="6" fill="url(#warpGrad)" />
      <circle cx="38" cy="24" r="6" fill="url(#warpGrad)" opacity="0.85" />
      <path
        d="M16 24H32"
        stroke="url(#warpGrad)"
        strokeWidth="2.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <path
        d="M27 17L34 24L27 31"
        stroke="url(#warpGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
