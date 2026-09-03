import { useState } from "react";

interface AgendaTask {
  id: string;
  time: string;
  title: string;
  resident: string;
  room: string;
  category: "medication" | "meal" | "activity" | "care" | "medical" | "other";
  done: boolean;
}

const initialTasks: AgendaTask[] = [
  { id: "1", time: "07:00", title: "Podanie leków porannych", resident: "Wszyscy pensjonariusze", room: "—", category: "medication", done: true },
  { id: "2", time: "07:30", title: "Śniadanie", resident: "Wszyscy pensjonariusze", room: "Jadalnia", category: "meal", done: true },
  { id: "3", time: "09:00", title: "Fizjoterapia", resident: "Henryk Nowak", room: "102-B", category: "activity", done: true },
  { id: "4", time: "09:30", title: "Zmiana opatrunku", resident: "Jan Kowalczyk", room: "104-A", category: "care", done: true },
  { id: "5", time: "10:30", title: "Zajęcia plastyczne", resident: "Zofia Kowalska, Wanda W.", room: "Świetlica", category: "activity", done: true },
  { id: "6", time: "11:00", title: "Wizyta lekarza ogólnego", resident: "Stanisław Piotrowski", room: "Gabinet", category: "medical", done: true },
  { id: "7", time: "13:00", title: "Obiad", resident: "Wszyscy pensjonariusze", room: "Jadalnia", category: "meal", done: true },
  { id: "8", time: "14:00", title: "Podanie leków popołudniowych", resident: "Genowefa Kamińska", room: "204-B", category: "medication", done: false },
  { id: "9", time: "15:00", title: "Rehabilitacja ruchowa", resident: "Władysław Dąbrowski", room: "Sala gimnastyczna", category: "activity", done: false },
  { id: "10", time: "16:30", title: "Pielęgnacja skóry", resident: "Maria Wiśniewska", room: "103-A", category: "care", done: false },
  { id: "11", time: "18:30", title: "Kolacja", resident: "Wszyscy pensjonariusze", room: "Jadalnia", category: "meal", done: false },
  { id: "12", time: "20:00", title: "Podanie leków wieczornych", resident: "Wszyscy pensjonariusze", room: "—", category: "medication", done: false },
  { id: "13", time: "21:00", title: "Obchód wieczorny", resident: "Wszyscy pensjonariusze", room: "—", category: "care", done: false },
];

const categoryMeta: Record<AgendaTask["category"], { icon: string; color: string; label: string }> = {
  medication: { icon: "💊", color: "#AF52DE", label: "Leki" },
  meal: { icon: "🍽️", color: "#FF9500", label: "Posiłek" },
  activity: { icon: "🏃", color: "#30D158", label: "Aktywność" },
  care: { icon: "🤲", color: "#5AC8FA", label: "Pielęgnacja" },
  medical: { icon: "🩺", color: "#FF3B30", label: "Wizyta medyczna" },
  other: { icon: "📋", color: "#8E8E93", label: "Inne" },
};

const taskTypes: { id: AgendaTask["category"]; icon: string; label: string }[] = [
  { id: "medication", icon: "💊", label: "Podanie leków" },
  { id: "meal", icon: "🍽️", label: "Posiłek" },
  { id: "activity", icon: "🏃", label: "Ćwiczenia fizyczne" },
  { id: "care", icon: "🤲", label: "Pielęgnacja" },
  { id: "medical", icon: "🩺", label: "Wizyta lekarska" },
  { id: "other", icon: "📋", label: "Inne" },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}

const monthNames = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const dayNames = ["Pn","Wt","Śr","Cz","Pt","So","Nd"];

function MultiCalendar({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const toggleDay = (d: number) => {
    const key = `${year}-${month}-${d}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#F9F9FB" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:bg-gray-200" style={{ color: "#007AFF" }}>‹</button>
        <p className="text-[14px] font-700" style={{ color: "#1C1C1E" }}>{monthNames[month]} {year}</p>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:bg-gray-200" style={{ color: "#007AFF" }}>›</button>
      </div>
      <div className="grid grid-cols-7 px-2 pb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] font-700 py-1" style={{ color: "#8E8E93" }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const key = `${year}-${month}-${d}`;
          const isSelected = selected.has(key);
          const isToday = key === todayKey;
          return (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className="aspect-square flex items-center justify-center rounded-full text-[13px] font-600 transition-all active:scale-90 m-0.5"
              style={{
                background: isSelected ? "#007AFF" : isToday ? "rgba(0,122,255,0.12)" : "transparent",
                color: isSelected ? "#fff" : isToday ? "#007AFF" : "#1C1C1E",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[11px] font-600" style={{ color: "#007AFF" }}>
            Zaplanowano na {selected.size} {selected.size === 1 ? "dzień" : "dni"}
          </p>
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: AgendaTask) => void }) {
  const [taskType, setTaskType] = useState<AgendaTask["category"]>("medication");
  const [residentName, setResidentName] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  const handleAdd = () => {
    const meta = categoryMeta[taskType];
    onAdd({
      id: Date.now().toString(),
      time: taskTime,
      title: taskTypes.find((t) => t.id === taskType)?.label ?? "Zadanie",
      resident: residentName || "Wszyscy pensjonariusze",
      room: "—",
      category: taskType,
      done: false,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#fff", maxHeight: "90dvh" }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-[18px] font-800" style={{ color: "#1C1C1E" }}>Dodaj zadanie</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[18px] transition-all active:scale-90"
            style={{ background: "#F2F2F7", color: "#8E8E93" }}
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Task type — radio cards */}
          <div>
            <p className="text-[11px] font-700 uppercase tracking-widest mb-3" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
              Rodzaj zadania
            </p>
            <div className="grid grid-cols-3 gap-2">
              {taskTypes.map((t) => {
                const isActive = taskType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTaskType(t.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all active:scale-95"
                    style={{
                      background: isActive ? "#007AFF" : "#F2F2F7",
                      border: isActive ? "none" : "0.5px solid rgba(0,0,0,0.07)",
                      minHeight: 72,
                    }}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span
                      className="text-[11px] font-700 text-center leading-tight"
                      style={{ color: isActive ? "#fff" : "#3A3A3C" }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resident */}
          <div>
            <p className="text-[11px] font-700 uppercase tracking-widest mb-2" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
              Pensjonariusz (opcjonalnie)
            </p>
            <input
              className="w-full px-4 py-3 rounded-xl text-[14px] font-500 outline-none"
              style={{ background: "#F2F2F7", color: "#1C1C1E", border: "0.5px solid rgba(0,0,0,0.08)" }}
              placeholder="Wszyscy lub wpisz imię i nazwisko…"
              value={residentName}
              onChange={(e) => setResidentName(e.target.value)}
            />
          </div>

          {/* Time */}
          <div>
            <p className="text-[11px] font-700 uppercase tracking-widest mb-2" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
              Godzina
            </p>
            <input
              type="time"
              className="px-4 py-3 rounded-xl text-[14px] font-600 outline-none"
              style={{ background: "#F2F2F7", color: "#1C1C1E", border: "0.5px solid rgba(0,0,0,0.08)" }}
              value={taskTime}
              onChange={(e) => setTaskTime(e.target.value)}
            />
          </div>

          {/* Multi-select calendar */}
          <div>
            <p className="text-[11px] font-700 uppercase tracking-widest mb-2" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
              Zaplanuj na dni
            </p>
            <MultiCalendar selected={selectedDays} onChange={setSelectedDays} />
          </div>

          {/* Notes */}
          <div>
            <p className="text-[11px] font-700 uppercase tracking-widest mb-2" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
              Uwagi
            </p>
            <textarea
              className="w-full px-4 py-3 rounded-xl text-[14px] font-400 outline-none resize-none"
              style={{ background: "#F2F2F7", color: "#1C1C1E", border: "0.5px solid rgba(0,0,0,0.08)", minHeight: 72 }}
              placeholder="Dodatkowe informacje…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 py-5" style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
          <button
            onClick={handleAdd}
            className="w-full py-4 rounded-2xl text-[15px] font-700 text-white transition-all active:scale-95"
            style={{ background: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.3)" }}
          >
            Dodaj zadanie
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffAgenda() {
  const [tasks, setTasks] = useState<AgendaTask[]>(initialTasks);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const isPast = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m < currentMin;
  };

  const filtered = tasks.filter((t) => {
    if (filter === "pending") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  const toggleDone = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTask = (t: AgendaTask) => {
    setTasks((prev) => [...prev, t].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const pendingCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="max-w-3xl mx-auto px-5 pt-5 pb-10">
      {/* Summary + CTA */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-700 uppercase tracking-widest" style={{ color: "#8E8E93", letterSpacing: "0.1em" }}>
            Agenda dnia
          </p>
          <p className="text-[18px] font-800" style={{ color: "#1C1C1E" }}>
            {now.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-700 text-white transition-all active:scale-95"
          style={{ background: "#007AFF", boxShadow: "0 4px 14px rgba(0,122,255,0.3)" }}
        >
          <span className="text-[18px] leading-none">+</span>
          Dodaj zadanie
        </button>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-600" style={{ color: "#8E8E93" }}>Postęp dnia</span>
            <span className="text-[12px] font-700" style={{ color: "#1C1C1E" }}>{doneCount}/{tasks.length}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F2F2F7" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / tasks.length) * 100}%`, background: "#34C759" }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-[13px] font-700" style={{ color: "#34C759" }}>{doneCount} ✓</span>
          <span className="text-[13px]" style={{ color: "#D1D1D6" }}>·</span>
          <span className="text-[13px] font-700" style={{ color: "#FF9500" }}>{pendingCount} ⏳</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-full text-[12px] font-700 transition-all active:scale-95"
            style={{
              background: filter === f ? "#007AFF" : "#fff",
              color: filter === f ? "#fff" : "#8E8E93",
              border: filter === f ? "none" : "0.5px solid rgba(0,0,0,0.1)",
            }}
          >
            {f === "all" ? "Wszystkie" : f === "pending" ? "Do zrobienia" : "Ukończone"}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div
          className="absolute left-[52px] top-0 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, transparent, #D1D1D6 6%, #D1D1D6 94%, transparent)" }}
        />

        <div className="space-y-1.5">
          {filtered.map((task, i) => {
            const meta = categoryMeta[task.category];
            const past = isPast(task.time);

            return (
              <div key={task.id} className="flex items-center gap-0">
                {/* Time */}
                <div className="w-12 flex-shrink-0 flex justify-end pr-0">
                  <span className="text-[11px] font-600 tabular-nums" style={{ color: task.done ? "#C7C7CC" : "#8E8E93" }}>
                    {task.time}
                  </span>
                </div>

                {/* Dot */}
                <div className="flex-shrink-0 flex items-center justify-center px-3">
                  <div
                    className="w-3 h-3 rounded-full border-2 transition-all duration-300"
                    style={{
                      borderColor: task.done ? meta.color : "#D1D1D6",
                      background: task.done ? meta.color : "#fff",
                    }}
                  />
                </div>

                {/* Card */}
                <div
                  className="flex-1 rounded-2xl mb-1 overflow-hidden transition-all duration-200"
                  style={{
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    opacity: task.done ? 0.65 : 1,
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Category icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0"
                      style={{ background: `${meta.color}18` }}
                    >
                      {meta.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] font-700 leading-tight"
                        style={{
                          color: "#1C1C1E",
                          textDecoration: task.done ? "line-through" : "none",
                          textDecorationColor: "#C7C7CC",
                        }}
                      >
                        {task.title}
                      </p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "#8E8E93" }}>
                        {task.resident}
                        {task.room !== "—" && ` · ${task.room}`}
                      </p>
                    </div>

                    {/* Done toggle */}
                    <button
                      onClick={() => toggleDone(task.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all active:scale-90"
                      style={{
                        background: task.done ? "rgba(52,199,89,0.12)" : "#F2F2F7",
                        minWidth: 44,
                        minHeight: 44,
                      }}
                    >
                      {task.done ? (
                        <span style={{ color: "#34C759", fontSize: 16 }}>✓</span>
                      ) : (
                        <span style={{ color: "#C7C7CC", fontSize: 16 }}>○</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={addTask} />}
    </div>
  );
}
