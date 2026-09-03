import { useState, useMemo } from "react";
import { staffResidents, statusConfig, type ReportStatus, type StaffResident } from "../data/residents";
import type { AppState } from "../App";

type FloorFilter = "all" | "1" | "2";
type StatusFilter = "all" | ReportStatus;

const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "brak_wpisu", label: "Brak wpisu" },
  { id: "robocza", label: "Robocza" },
  { id: "gotowy", label: "Gotowy" },
];

interface StaffBoardProps {
  appState: AppState;
}

function ResidentCard({
  resident,
  onVoice,
  onReport,
}: {
  resident: StaffResident;
  onVoice: () => void;
  onReport: () => void;
}) {
  const cfg = statusConfig[resident.status];
  const hasNote = resident.status !== "brak_wpisu";

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 6px 20px rgba(0,0,0,0.05)",
      }}
    >
      {/* Card top */}
      <div className="p-4 flex-1">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-800 text-[16px] flex-shrink-0"
            style={{ background: resident.avatarColor }}
          >
            {resident.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-700 leading-tight" style={{ color: "#1C1C1E" }}>
              {resident.name}
            </p>
            <p className="text-[12px] font-500 mt-0.5" style={{ color: "#8E8E93" }}>
              Sala {resident.room} · Łóżko {resident.bed} · {resident.age} lat
            </p>
            {/* Status badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: cfg.bg }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
              <span className="text-[11px] font-700" style={{ color: cfg.text }}>
                {cfg.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "0.5px", background: "rgba(0,0,0,0.07)" }} />

      {/* Actions */}
      <div className="flex">
        <button
          onClick={onVoice}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-700 transition-all active:bg-blue-50 active:scale-95"
          style={{ color: "#007AFF", minHeight: 48 }}
        >
          <MicIcon size={16} color="#007AFF" />
          Nagranie
        </button>
        {hasNote && (
          <>
            <div style={{ width: "0.5px", background: "rgba(0,0,0,0.07)" }} />
            <button
              onClick={onReport}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-600 transition-all active:scale-95"
              style={{ color: "#8E8E93", minHeight: 48 }}
            >
              <NoteIcon size={15} color="#8E8E93" />
              Podgląd
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MicIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="1" width="6" height="9" rx="3" stroke={color} strokeWidth="1.5" />
      <path d="M2.5 8C2.5 11.038 4.962 13.5 8 13.5C11.038 13.5 13.5 11.038 13.5 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="13.5" x2="8" y2="15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NoteIcon({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="5" y1="6" x2="11" y2="6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="5" y1="9" x2="9" y2="9" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function StaffBoard({ appState }: StaffBoardProps) {
  const [search, setSearch] = useState("");
  const [floor, setFloor] = useState<FloorFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return staffResidents.filter((r) => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.room.includes(search);
      const matchFloor = floor === "all" || r.floor === Number(floor);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchFloor && matchStatus;
    });
  }, [search, floor, statusFilter]);

  const counts = useMemo(
    () => ({
      brak_wpisu: staffResidents.filter((r) => r.status === "brak_wpisu").length,
      robocza: staffResidents.filter((r) => r.status === "robocza").length,
      gotowy: staffResidents.filter((r) => r.status === "gotowy").length,
    }),
    []
  );

  const goVoice = (r: StaffResident) => {
    appState.setSelectedResident(r);
    appState.setScreen("voice");
  };

  const goReport = (r: StaffResident) => {
    appState.setSelectedResident(r);
    appState.setScreen("reports");
  };

  return (
    <div className="max-w-5xl mx-auto px-5 pt-5 pb-10">
      {/* Summary strip */}
      <div className="flex gap-3 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {(["brak_wpisu", "robocza", "gotowy"] as ReportStatus[]).map((s) => {
          const cfg = statusConfig[s];
          return (
            <div
              key={s}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
              style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              <span className="text-[22px] font-800" style={{ color: cfg.dot }}>
                {counts[s]}
              </span>
              <span className="text-[12px] font-600" style={{ color: "#8E8E93" }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* Search */}
        <div
          className="flex items-center gap-2 px-4 rounded-full"
          style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.1)",
            height: 40,
            minWidth: 180,
            flex: "1 1 180px",
            maxWidth: 280,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#8E8E93" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#8E8E93" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            className="flex-1 text-[13px] bg-transparent outline-none"
            style={{ color: "#1C1C1E" }}
            placeholder="Szukaj pensjonariusza…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "#C7C7CC", fontSize: 16, lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>

        {/* Floor filter */}
        <div className="flex rounded-full overflow-hidden" style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)" }}>
          {(["all", "1", "2"] as FloorFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className="px-4 text-[12px] font-600 transition-all"
              style={{
                height: 40,
                background: floor === f ? "#007AFF" : "transparent",
                color: floor === f ? "#fff" : "#8E8E93",
              }}
            >
              {f === "all" ? "Wszystkie piętra" : `Piętro ${f}`}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded-full overflow-hidden" style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)" }}>
          {statusFilters.map((sf) => (
            <button
              key={sf.id}
              onClick={() => setStatusFilter(sf.id)}
              className="px-3.5 text-[12px] font-600 transition-all"
              style={{
                height: 40,
                background: statusFilter === sf.id ? "#007AFF" : "transparent",
                color: statusFilter === sf.id ? "#fff" : "#8E8E93",
              }}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-[17px] font-700" style={{ color: "#1C1C1E" }}>Brak wyników</p>
          <p className="text-[14px] mt-1" style={{ color: "#8E8E93" }}>Zmień kryteria wyszukiwania</p>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {filtered.map((r) => (
            <ResidentCard
              key={r.id}
              resident={r}
              onVoice={() => goVoice(r)}
              onReport={() => goReport(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
