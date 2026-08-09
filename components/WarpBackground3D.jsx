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

    // 3D Particles setup
    const COUNT = 350;
    const particles = [];
    const fov = 300;

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * 1000 + 1,
        pz: 0,
        color:
          i % 4 === 0
            ? "#a855f7" // violet
            : i % 4 === 1
            ? "#06b6d4" // cyan
            : i % 4 === 2
            ? "#14b8a6" // teal
            : "#3b82f6", // blue
        size: Math.random() * 1.8 + 0.5,
      });
    }

    let speedFactor = 1;

    const render = () => {
      // Smooth mouse easing for parallax 3D effect
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const cx = width / 2 + (mouse.x - width / 2) * 0.15;
      const cy = height / 2 + (mouse.y - height / 2) * 0.15;

      // Target warp speed
      const targetSpeed = speeding ? 28 : active ? 6 : 2;
      speedFactor += (targetSpeed - speedFactor) * 0.08;

      // Fade canvas for motion trail
      ctx.fillStyle = speeding ? "rgba(10, 10, 20, 0.25)" : "rgba(12, 13, 24, 0.4)";
      ctx.fillRect(0, 0, width, height);

      // Draw glowing background grid & ambient light orbs
      const time = Date.now() * 0.001;
      const gradient = ctx.createRadialGradient(
        cx,
        cy,
        10,
        cx,
        cy,
        Math.max(width, height) * 0.8
      );
      gradient.addColorStop(0, speeding ? "rgba(139, 92, 246, 0.25)" : "rgba(99, 102, 241, 0.12)");
      gradient.addColorStop(0.5, speeding ? "rgba(20, 184, 166, 0.15)" : "rgba(20, 184, 166, 0.05)");
      gradient.addColorStop(1, "rgba(5, 7, 15, 0.95)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Render 3D particles with hyper-speed trails
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
          ctx.lineWidth = Math.max(0.5, p.size * k * (speeding ? 1.5 : 1));
          ctx.globalAlpha = alpha;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(px, py);
          ctx.stroke();

          // Particle head point glow
          if (!speeding) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(px, py, p.size * k * 0.6, 0, Math.PI * 2);
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
      style={{ background: "#060813" }}
    />
  );
}
