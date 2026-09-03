import { useEffect, useRef, useState } from "react";
import { staffResidents } from "../data/residents";
import type { AppState } from "../App";

interface VoiceDictationProps {
  appState: AppState;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function Waveform({ active }: { active: boolean }) {
  const bars = 28;
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 64 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="rounded-full flex-shrink-0"
          style={{
            width: 3,
            background: active ? "#007AFF" : "#D1D1D6",
            height: active ? undefined : 6,
            minHeight: 4,
            animation: active
              ? `wave ${0.6 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite alternate`
              : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          0% { height: 4px; }
          100% { height: ${Math.random() > 0.5 ? 52 : 36}px; }
        }
        ${Array.from({ length: bars }).map((_, i) => `
          div[data-bar="${i}"] {
            animation-duration: ${0.5 + (i % 7) * 0.09}s;
          }
        `).join("")}
      `}</style>
    </div>
  );
}

function AnimatedWaveform({ active }: { active: boolean }) {
  const bars = 32;
  const [heights, setHeights] = useState<number[]>(Array.from({ length: bars }, () => 6));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setHeights(Array.from({ length: bars }, () => 6));
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const animate = () => {
      setHeights((prev) =>
        prev.map((h) => {
          const target = 6 + Math.random() * 50;
          return h + (target - h) * 0.3;
        })
      );
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 64 }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="rounded-full flex-shrink-0 transition-all"
          style={{
            width: 3,
            height: Math.max(4, h),
            background: active
              ? `hsl(${210 + (h / 56) * 20}, 100%, ${50 + (h / 56) * 10}%)`
              : "#D1D1D6",
            transition: active ? "height 0.08s ease, background 0.3s" : "height 0.3s ease, background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

export default function VoiceDictation({ appState }: VoiceDictationProps) {
  const [selectedId, setSelectedId] = useState(
    appState.selectedResident?.id ?? staffResidents[0].id
  );
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saved, setSaved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = staffResidents.find((r) => r.id === selectedId) ?? staffResidents[0];

  useEffect(() => {
    if (recording) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [recording]);

  const toggleRecording = () => {
    if (recording) {
      setRecording(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setSeconds(0);
      setSaved(false);
      setRecording(true);
    }
  };

  const discard = () => {
    setRecording(false);
    setSeconds(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <div className="max-w-xl mx-auto px-5 pt-6 pb-10 flex flex-col items-center" style={{ minHeight: "calc(100dvh - 120px)" }}>
      {/* Resident selector */}
      <div className="w-full mb-8">
        <label className="block text-[11px] font-700 uppercase tracking-widest mb-2" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
          Pensjonariusz
        </label>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
        >
          <select
            className="w-full appearance-none px-5 py-4 text-[15px] font-600 bg-transparent outline-none pr-10"
            style={{ color: "#1C1C1E" }}
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setRecording(false); setSeconds(0); }}
          >
            {staffResidents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — Sala {r.room}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#8E8E93" }}>
            ▾
          </div>
        </div>
      </div>

      {/* Resident info chip */}
      <div className="flex items-center gap-3 mb-12">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-700 text-[13px]"
          style={{ background: selected.avatarColor }}
        >
          {selected.initials}
        </div>
        <div>
          <p className="text-[15px] font-700" style={{ color: "#1C1C1E" }}>{selected.name}</p>
          <p className="text-[12px]" style={{ color: "#8E8E93" }}>Sala {selected.room} · Piętro {selected.floor}</p>
        </div>
      </div>

      {/* Waveform */}
      <div className="w-full mb-8">
        <AnimatedWaveform active={recording} />
      </div>

      {/* Timer */}
      <p
        className="text-[42px] font-300 tabular-nums mb-10"
        style={{
          color: recording ? "#007AFF" : "#C7C7CC",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          transition: "color 0.3s",
        }}
      >
        {formatTime(seconds)}
      </p>

      {/* Mic button */}
      <button
        onClick={toggleRecording}
        className="flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 mb-6"
        style={{
          width: 96,
          height: 96,
          background: recording ? "#FF3B30" : "#007AFF",
          boxShadow: recording
            ? "0 0 0 12px rgba(255,59,48,0.15), 0 0 0 24px rgba(255,59,48,0.07), 0 8px 32px rgba(255,59,48,0.4)"
            : "0 8px 32px rgba(0,122,255,0.35)",
          transition: "background 0.3s ease, box-shadow 0.3s ease, transform 0.15s ease",
          animation: recording ? "micPulse 2s ease-in-out infinite" : "none",
        }}
      >
        {recording ? (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="white">
            <rect x="6" y="6" width="16" height="16" rx="3" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="9" y="2" width="10" height="16" rx="5" fill="white" />
            <path d="M4 14C4 20.075 8.477 25 14 25C19.523 25 24 20.075 24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="14" y1="25" x2="14" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 12px rgba(255,59,48,0.15), 0 0 0 24px rgba(255,59,48,0.07), 0 8px 32px rgba(255,59,48,0.4); }
          50% { box-shadow: 0 0 0 18px rgba(255,59,48,0.1), 0 0 0 36px rgba(255,59,48,0.04), 0 8px 40px rgba(255,59,48,0.5); }
        }
      `}</style>

      <p className="text-[13px] font-500 mb-8" style={{ color: "#8E8E93" }}>
        {recording ? "Naciśnij aby zakończyć nagranie" : seconds > 0 ? "Nagranie zatrzymane" : "Naciśnij aby rozpocząć nagranie"}
      </p>

      {/* Action buttons */}
      {seconds > 0 && !recording && (
        <div className="flex gap-3 w-full">
          <button
            onClick={discard}
            className="flex-1 py-4 rounded-2xl text-[14px] font-700 transition-all active:scale-95"
            style={{ background: "rgba(255,59,48,0.1)", color: "#FF3B30" }}
          >
            Odrzuć
          </button>
          <button
            onClick={() => { appState.setSelectedResident(selected); appState.setScreen("reports"); }}
            className="flex-1 py-4 rounded-2xl text-[14px] font-700 text-white transition-all active:scale-95"
            style={{ background: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.3)" }}
          >
            Zapisz i przejdź do raportu →
          </button>
        </div>
      )}

      {/* Saved toast */}
      {saved && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-[13px] font-600"
          style={{ background: "#34C759", boxShadow: "0 4px 20px rgba(52,199,89,0.4)", zIndex: 100 }}
        >
          ✓ Nagranie zapisane
        </div>
      )}
    </div>
  );
}
