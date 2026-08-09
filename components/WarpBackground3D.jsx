"use client";

import { useEffect, useRef } from "react";

export default function WarpBackground3D({ speeding = false, active = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const mouse = { x: width / 2, y: height / 2, targetX: width / 2, targetY: height / 2 };
    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // 3D Particles — warm organic palette
    const COUNT = 400;
    const particles = [];
    const fov = 300;

    // Warm earthy color palette
    const colors = [
      "#f59e0b", // amber
      "#fb7185", // rose
      "#f97316", // orange
      "#fbbf24", // yellow-amber
      "#e11d48", // deep rose
      "#c2410c", // burnt orange
    ];

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * 1000 + 1,
        pz: 0,
        color: colors[i % colors.length],
        size: Math.random() * 1.8 + 0.4,
      });
    }

    let speedFactor = 1;

    const render = () => {
      // Smooth mouse easing
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const cx = width / 2 + (mouse.x - width / 2) * 0.15;
      const cy = height / 2 + (mouse.y - height / 2) * 0.15;

      // Target warp speed — faster base
      const targetSpeed = speeding ? 36 : active ? 9 : 2.5;
      speedFactor += (targetSpeed - speedFactor) * 0.09;

      // Fade canvas — darker for warm feel
      ctx.fillStyle = speeding ? "rgba(8, 5, 2, 0.22)" : "rgba(12, 8, 4, 0.4)";
      ctx.fillRect(0, 0, width, height);

      // Warm ambient radial gradient
      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.8);
      gradient.addColorStop(0, speeding ? "rgba(245, 158, 11, 0.2)" : "rgba(120, 60, 15, 0.1)");
      gradient.addColorStop(0.5, speeding ? "rgba(251, 113, 133, 0.12)" : "rgba(80, 30, 10, 0.05)");
      gradient.addColorStop(1, "rgba(5, 3, 1, 0.95)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Render 3D particles with speed trails
      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        p.pz = p.z;
        p.z -= speedFactor;

        if (p.z <= 0) {
          p.z = 1000;
          p.pz = 1000;
          p.x = (Math.random() - 0.5) * width * 2;
          p.y = (Math.random() - 0.5) * height * 2;
        }

        const k = fov / p.z;
        const px = p.x * k + cx;
        const py = p.y * k + cy;

        const pk = fov / p.pz;
        const prevX = p.x * pk + cx;
        const prevY = p.y * pk + cy;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const alpha = Math.min(1, (1000 - p.z) / 800);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.5, p.size * k * (speeding ? 1.6 : 1));
          ctx.globalAlpha = alpha;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(px, py);
          ctx.stroke();

          // Particle head glow dot
          if (!speeding) {
            ctx.fillStyle = "#fff8f0";
            ctx.beginPath();
            ctx.arc(px, py, p.size * k * 0.55, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [speeding, active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: "#0c0a09" }}
    />
  );
}
