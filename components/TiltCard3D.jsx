"use client";

import { useRef, useState } from "react";

export default function TiltCard3D({ children, className = "" }) {
  const cardRef = useRef(null);
  const [style, setStyle] = useState({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    glowX: 50,
    glowY: 50,
  });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;

    const glowX = (x / rect.width) * 100;
    const glowY = (y / rect.height) * 100;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`,
      glowX,
      glowY,
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      glowX: 50,
      glowY: 50,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: style.transform,
        transition: "transform 0.15s ease-out",
        transformStyle: "preserve-3d",
      }}
      className={`relative overflow-hidden rounded-3xl border border-amber-900/30 bg-stone-950/60 backdrop-blur-2xl shadow-[0_25px_55px_rgba(0,0,0,0.6)] ${className}`}
    >
      {/* Warm Cursor Light Reflection */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-50"
        style={{
          background: `radial-gradient(600px circle at ${style.glowX}% ${style.glowY}%, rgba(245, 158, 11, 0.2), rgba(251, 113, 133, 0.1) 40%, transparent 80%)`,
        }}
      />
      {/* Top Border Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
