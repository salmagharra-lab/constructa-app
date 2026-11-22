"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const SEEN_KEY = "constructa-tomato-splash";
const DURATION_MS = 2800;
const COUNT = 18;

type Tomato = { id: number; left: number; size: number; delay: number; drift: number; spin: number };

function TomatoIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <ellipse cx="32" cy="37" rx="26" ry="23" fill="#dc2626" />
      <ellipse cx="22" cy="30" rx="7" ry="5" fill="#f87171" opacity="0.7" />
      <path d="M32 16c-4-6-10-6-14-4 4 1 7 3 9 6-5-1-10 1-12 4 5 0 9 0 12 2-2 3-2 6-1 9 3-3 5-6 6-9 1 3 3 6 6 9 1-3 1-6-1-9 3-2 7-2 12-2-2-3-7-5-12-4 2-3 5-5 9-6-4-2-10-2-14 4z" fill="#16a34a" />
      <rect x="30" y="8" width="4" height="10" rx="2" fill="#15803d" />
    </svg>
  );
}

/** Red tomatoes pop up once each time the app is opened (once per browser session). */
export default function TomatoSplash() {
  const t = useTranslations("common");
  const [tomatoes, setTomatoes] = useState<Tomato[] | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked: still show the splash.
    }
    setTomatoes(
      Array.from({ length: COUNT }, (_, id) => ({
        id,
        left: 4 + Math.random() * 88,
        size: 40 + Math.random() * 44,
        delay: Math.random() * 0.9,
        drift: (Math.random() - 0.5) * 120,
        spin: (Math.random() - 0.5) * 720,
      })),
    );
    const timer = setTimeout(() => setTomatoes(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!tomatoes) return null;

  return (
    <div
      className="tomato-splash fixed inset-0 z-50 overflow-hidden bg-red-50/80 backdrop-blur-[2px]"
      onClick={() => setTomatoes(null)}
      role="presentation"
    >
      <div className="absolute inset-x-0 top-1/3 text-center" aria-hidden>
        <div className="tomato-hero mx-auto inline-block">
          <TomatoIcon size={140} />
        </div>
      </div>
      {tomatoes.map((tomato) => (
        <span
          key={tomato.id}
          className="tomato-pop absolute bottom-0"
          style={
            {
              left: `${tomato.left}%`,
              animationDelay: `${tomato.delay}s`,
              "--drift": `${tomato.drift}px`,
              "--spin": `${tomato.spin}deg`,
            } as React.CSSProperties
          }
        >
          <TomatoIcon size={tomato.size} />
        </span>
      ))}
      <button
        type="button"
        onClick={() => setTomatoes(null)}
        className="absolute end-4 top-4 grid size-12 place-items-center rounded-full bg-white text-2xl shadow"
        aria-label={t("close")}
      >
        ×
      </button>
    </div>
  );
}
