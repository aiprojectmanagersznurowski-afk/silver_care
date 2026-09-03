import { useState } from "react";
import { MessageCircle, X, Send, StickyNote, MessageSquareText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

type Tab = "chat" | "notes";

const messages = [
  {
    id: 1,
    from: "staff",
    name: "Dana (Opiekunka)",
    img: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=100",
    text: "Dzień dobry! Katarzyna dobrze spała i była zadowolona z sesji rehabilitacji. 😊",
    time: "9:20",
  },
  {
    id: 2,
    from: "me",
    name: "Ty",
    text: "To wspaniałe wieści, dziękuję Dano!",
    time: "9:34",
  },
  {
    id: 3,
    from: "staff",
    name: "Dana (Opiekunka)",
    img: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=100",
    text: "Cieszy się na masaż o 14:00. Prześlę zdjęcia po zakończeniu.",
    time: "9:36",
  },
];

const notes = [
  { id: 1, text: "Proszę przypomnieć mamie o okularach do czytania podczas obiadu.", author: "Ty", time: "Wczoraj" },
  { id: 2, text: "Wieczorami woli herbatę rumiankową.", author: "Ty", time: "Pon" },
];

export function CommunicationWidget() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [draft, setDraft] = useState("");

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[540px] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[1.5rem] bg-card shadow-2xl ring-1 ring-border sm:max-w-[calc(100vw-3rem)]">
          {/* header */}
          <div className="flex items-center justify-between bg-sage px-5 py-4 text-primary-foreground">
            <div className="leading-tight">
              <p className="text-[1.1rem]">Zespół opieki</p>
              <p className="flex items-center gap-1.5 text-[0.78rem] opacity-90">
                <span className="h-2 w-2 rounded-full bg-[#a7e0b0]" /> Willowbrook · dostępny
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* tabs */}
          <div className="flex gap-1 border-b border-border p-2">
            {(
              [
                { id: "chat", label: "Czat", icon: MessageSquareText },
                { id: "notes", label: "Notatki", icon: StickyNote },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 transition-colors ${
                  tab === t.id ? "bg-sage-soft text-sage-deep" : "text-slate-soft hover:bg-muted/60"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {tab === "chat"
              ? messages.map((m) =>
                  m.from === "me" ? (
                    <div key={m.id} className="flex flex-col items-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-sage px-4 py-2.5 text-primary-foreground">
                        <p className="text-[0.92rem] leading-relaxed">{m.text}</p>
                      </div>
                      <span className="mt-1 text-[0.7rem] text-slate-soft">{m.time}</span>
                    </div>
                  ) : (
                    <div key={m.id} className="flex gap-2.5">
                      <Avatar className="mt-0.5 h-8 w-8">
                        <AvatarImage src={m.img} alt={m.name} />
                        <AvatarFallback>{m.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
                          <p className="text-[0.92rem] leading-relaxed text-slate">{m.text}</p>
                        </div>
                        <span className="ml-1 mt-1 block text-[0.7rem] text-slate-soft">
                          {m.name} · {m.time}
                        </span>
                      </div>
                    </div>
                  )
                )
              : notes.map((n) => (
                  <div key={n.id} className="rounded-2xl bg-[#f6efe0] p-4 ring-1 ring-[#e8dcc0]">
                    <p className="text-[0.92rem] leading-relaxed text-slate">{n.text}</p>
                    <p className="mt-2 text-[0.72rem] text-slate-soft">
                      {n.author} · {n.time}
                    </p>
                  </div>
                ))}
          </div>

          {/* composer */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-2xl bg-input-background px-3 py-2">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={tab === "chat" ? "Napisz do zespołu opieki…" : "Zostaw notatkę dla personelu…"}
                className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-[0.92rem] text-slate outline-none placeholder:text-slate-soft"
              />
              <button
                onClick={() => setDraft("")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage text-primary-foreground transition-transform hover:scale-105"
              >
                <Send className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sage text-primary-foreground shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
      </button>
    </div>
  );
}
