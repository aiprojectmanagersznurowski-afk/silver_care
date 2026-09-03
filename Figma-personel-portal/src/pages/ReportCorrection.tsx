import { useEffect, useState } from "react";
import { staffResidents, statusConfig, type StaffResident } from "../data/residents";
import type { AppState } from "../App";

const defaultDraft =
  "Pensjonariusz w stabilnym stanie ogólnym. Leki podane zgodnie z planem. Apetyt dobry, zjadł wszystkie posiłki. Nastrój spokojny. Brak skarg. Aktywność fizyczna na poziomie odpowiednim do możliwości. Komunikatywny z personelem i innymi mieszkańcami.";

interface ReportCorrectionProps {
  appState: AppState;
}

function ResidentSidebar({
  selected,
  onSelect,
}: {
  selected: StaffResident;
  onSelect: (r: StaffResident) => void;
}) {
  const withNotes = staffResidents.filter((r) => r.status !== "brak_wpisu");
  return (
    <div
      className="flex flex-col gap-1 overflow-y-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {withNotes.map((r) => {
        const cfg = statusConfig[r.status];
        const isActive = r.id === selected.id;
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all active:scale-98"
            style={{
              background: isActive ? "#007AFF" : "transparent",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-700 text-[12px] flex-shrink-0"
              style={{ background: isActive ? "rgba(255,255,255,0.25)" : r.avatarColor }}
            >
              {r.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-700 truncate" style={{ color: isActive ? "#fff" : "#1C1C1E" }}>
                {r.name}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: isActive ? "rgba(255,255,255,0.7)" : cfg.dot }}
                />
                <span className="text-[10px] font-600 truncate" style={{ color: isActive ? "rgba(255,255,255,0.7)" : cfg.text }}>
                  {cfg.label}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function ReportCorrection({ appState }: ReportCorrectionProps) {
  const initial = appState.selectedResident?.status !== "brak_wpisu"
    ? appState.selectedResident ?? staffResidents.find((r) => r.status !== "brak_wpisu") ?? staffResidents[0]
    : staffResidents.find((r) => r.status !== "brak_wpisu") ?? staffResidents[0];

  const [selected, setSelected] = useState<StaffResident>(initial);
  const [text, setText] = useState(selected.draftText ?? defaultDraft);
  const [approved, setApproved] = useState(selected.status === "gotowy");
  const [saved, setSaved] = useState(false);
  const [approvedToast, setApprovedToast] = useState(false);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    setText(selected.draftText ?? defaultDraft);
    setApproved(selected.status === "gotowy");
  }, [selected.id]);

  const handleApprove = () => {
    setApproved(true);
    setApprovedToast(true);
    setTimeout(() => setApprovedToast(false), 2800);
  };

  const handleSaveDraft = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-5 pt-5 pb-10 flex gap-5" style={{ minHeight: "calc(100dvh - 120px)" }}>
      {/* Sidebar */}
      <div
        className="w-56 flex-shrink-0 rounded-2xl p-3 self-start sticky top-[136px]"
        style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", maxHeight: "calc(100dvh - 160px)", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <p className="text-[10px] font-700 uppercase tracking-widest px-2 mb-2" style={{ color: "#8E8E93", letterSpacing: "0.12em" }}>
          Raporty dziś
        </p>
        <ResidentSidebar selected={selected} onSelect={setSelected} />
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header card */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-800 text-[15px]"
              style={{ background: selected.avatarColor }}
            >
              {selected.initials}
            </div>
            <div>
              <p className="text-[18px] font-800" style={{ color: "#1C1C1E" }}>{selected.name}</p>
              <p className="text-[12px]" style={{ color: "#8E8E93" }}>
                Sala {selected.room} · Łóżko {selected.bed} · {selected.age} lat · Piętro {selected.floor}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div>
            {approved ? (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: "rgba(52,199,89,0.1)" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: "#34C759" }} />
                <span className="text-[12px] font-700" style={{ color: "#248A3D" }}>Raport gotowy</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: "rgba(255,149,0,0.12)" }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: "#FF9500" }} />
                <span className="text-[12px] font-700" style={{ color: "#9A5E00" }}>Wersja robocza</span>
              </div>
            )}
          </div>
        </div>

        {/* AI badge */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: "rgba(88,86,214,0.08)", border: "0.5px solid rgba(88,86,214,0.2)" }}
        >
          <span className="text-[14px]">✦</span>
          <p className="text-[12px] font-600" style={{ color: "#5856D6" }}>
            Tekst wygenerowany automatycznie przez AI na podstawie nagrania głosowego. Zweryfikuj i zatwierdź.
          </p>
        </div>

        {/* Text area */}
        <div
          className="rounded-2xl overflow-hidden flex-1"
          style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
        >
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
            <p className="text-[12px] font-700" style={{ color: "#8E8E93" }}>
              Raport dzienny · {new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="text-[11px]" style={{ color: "#C7C7CC" }}>{wordCount} słów</p>
          </div>
          <textarea
            className="w-full px-5 py-4 text-[15px] font-400 leading-relaxed bg-transparent outline-none resize-none"
            style={{ color: "#1C1C1E", minHeight: 240 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={approved}
            placeholder="Zacznij wpisywać raport…"
          />
        </div>

        {/* Action bar */}
        <div className="flex gap-3">
          {!approved && (
            <button
              onClick={handleSaveDraft}
              className="flex-shrink-0 px-6 py-4 rounded-2xl text-[14px] font-700 transition-all active:scale-95"
              style={{ background: "#F2F2F7", color: "#1C1C1E" }}
            >
              Zapisz wersję roboczą
            </button>
          )}
          <button
            onClick={approved ? undefined : handleApprove}
            disabled={approved}
            className="flex-1 py-4 rounded-2xl text-[14px] font-700 text-white transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{
              background: approved ? "#34C759" : "#007AFF",
              boxShadow: approved ? "0 4px 16px rgba(52,199,89,0.3)" : "0 4px 16px rgba(0,122,255,0.3)",
              cursor: approved ? "default" : "pointer",
              transition: "background 0.3s, box-shadow 0.3s",
            }}
          >
            {approved ? (
              <>
                <span>✓</span>
                Raport zatwierdzony i opublikowany
              </>
            ) : (
              "Zatwierdź raport — wyślij do rodziny"
            )}
          </button>
        </div>
      </div>

      {/* Toasts */}
      {saved && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-[13px] font-600"
          style={{ background: "#FF9500", boxShadow: "0 4px 20px rgba(255,149,0,0.4)", zIndex: 100 }}
        >
          ✎ Wersja robocza zapisana
        </div>
      )}
      {approvedToast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-[13px] font-600"
          style={{ background: "#34C759", boxShadow: "0 4px 20px rgba(52,199,89,0.4)", zIndex: 100 }}
        >
          ✓ Raport zatwierdzony i opublikowany dla rodziny
        </div>
      )}
    </div>
  );
}
