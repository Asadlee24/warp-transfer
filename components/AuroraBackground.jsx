export default function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="aurora-blob animate-aurora1"
        style={{
          width: 500,
          height: 500,
          top: "-10%",
          left: "-5%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.55) 0%, rgba(124,58,237,0) 70%)",
        }}
      />
      <div
        className="aurora-blob animate-aurora2"
        style={{
          width: 550,
          height: 550,
          top: "20%",
          right: "-10%",
          background:
            "radial-gradient(circle, rgba(20,184,166,0.5) 0%, rgba(20,184,166,0) 70%)",
        }}
      />
      <div
        className="aurora-blob animate-aurora3"
        style={{
          width: 480,
          height: 480,
          bottom: "-15%",
          left: "20%",
          background:
            "radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0) 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
    </div>
  );
}
