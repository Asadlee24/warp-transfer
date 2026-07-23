import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Warp — Instant P2P File Transfer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.35), transparent 45%), radial-gradient(circle at 80% 30%, rgba(20,184,166,0.3), transparent 45%), radial-gradient(circle at 50% 90%, rgba(59,130,246,0.28), transparent 45%), #0a0a12",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #7c3aed, #3b82f6 55%, #14b8a6)",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: "white",
              display: "flex",
            }}
          >
            Warp
          </div>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 34,
            color: "rgba(255,255,255,0.7)",
            display: "flex",
          }}
        >
          Instant browser-to-browser file transfer
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 26,
            color: "rgba(255,255,255,0.45)",
            display: "flex",
          }}
        >
          No upload · No size limit · No account
        </div>
      </div>
    ),
    { ...size }
  );
}
