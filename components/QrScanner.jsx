"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function extractCode(text) {
  if (!text) return null;
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get("code");
    if (fromQuery) return fromQuery.trim().toLowerCase();
  } catch {
    // not a URL — fall through and treat the raw text as the code
  }
  const trimmed = text.trim().toLowerCase();
  if (/^[a-z0-9]{4,8}$/.test(trimmed)) return trimmed;
  return null;
}

export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const { default: jsQR } = await import("jsqr");
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        const tick = () => {
          const video = videoRef.current;
          if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height);
          if (result?.data) {
            const code = extractCode(result.data);
            if (code) {
              stop();
              onResult(code);
              return;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        setError(
          err?.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access to scan a code."
            : "Couldn't access the camera on this device."
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [onResult, stop]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm text-center">
        <p className="text-gray-700 font-medium mb-3">Scan the sender&apos;s QR code</p>
        {error ? (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        ) : (
          <div className="rounded-xl overflow-hidden bg-black mb-4 aspect-square">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <button
          onClick={() => {
            stop();
            onClose();
          }}
          className="px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
