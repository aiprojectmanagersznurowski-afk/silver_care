import { useState } from "react";
import StaffBoard from "./pages/StaffBoard";
import VoiceDictation from "./pages/VoiceDictation";
import ReportCorrection from "./pages/ReportCorrection";
import StaffAgenda from "./pages/StaffAgenda";
import type { StaffResident } from "./data/residents";

export type StaffScreen = "board" | "voice" | "reports" | "agenda";

export interface AppState {
  screen: StaffScreen;
  setScreen: (s: StaffScreen) => void;
  selectedResident: StaffResident | null;
  setSelectedResident: (r: StaffResident | null) => void;
}

const navItems: { id: StaffScreen; icon: string; label: string }[] = [
  { id: "board", icon: "⊞", label: "Pensjonariusze" },
  { id: "voice", icon: "⏺", label: "Nagranie" },
  { id: "reports", icon: "✎", label: "Raporty" },
  { id: "agenda", icon: "≡", label: "Agenda" },
];

const today = new Date().toLocaleDateString("pl-PL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function App() {
  const [screen, setScreen] = useState<StaffScreen>("board");
  const [selectedResident, setSelectedResident] = useState<StaffResident | null>(null);

  const appState: AppState = { screen, setScreen, selectedResident, setSelectedResident };

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100dvh",
        background: "#F2F2F7",
        fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Global header */}
      <header
        className="sticky top-0 z-50 flex-shrink-0"
        style={{
          background: "rgba(242,242,247,0.88)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.1)",
        }}
      >
        <div className="max-w-5xl mx-auto px-5">
          <div className="flex items-center justify-between py-3">
            <div>
              <p
                className="text-[10px] font-700 uppercase tracking-widest"
                style={{ color: "#8E8E93", letterSpacing: "0.12em" }}
              >
                Dom Opieki Senior
              </p>
              <h1 className="text-[18px] font-800" style={{ color: "#1C1C1E" }}>
                Panel Personelu
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[12px] font-600" style={{ color: "#1C1C1E" }}>
                  Anna Kowalczyk
                </p>
                <p className="text-[11px] capitalize" style={{ color: "#8E8E93" }}>
                  {today}
                </p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-700 text-[13px]"
                style={{ background: "#007AFF" }}
              >
                AK
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 pb-2">
            {navItems.map((item) => {
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-600 transition-all duration-150 active:scale-95"
                  style={{
                    background: active ? "#007AFF" : "transparent",
                    color: active ? "#fff" : "#8E8E93",
                    minHeight: 36,
                  }}
                >
                  <span className="text-[14px] leading-none">{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {screen === "board" && <StaffBoard appState={appState} />}
        {screen === "voice" && <VoiceDictation appState={appState} />}
        {screen === "reports" && <ReportCorrection appState={appState} />}
        {screen === "agenda" && <StaffAgenda />}
      </main>
    </div>
  );
}
