import { Moon, HeartPulse, Sparkle, ArrowRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

const heartData = [
  { t: "6a", bpm: 58 },
  { t: "8a", bpm: 64 },
  { t: "10a", bpm: 72 },
  { t: "12p", bpm: 68 },
  { t: "2p", bpm: 79 },
  { t: "4p", bpm: 74 },
  { t: "now", bpm: 71 },
];

export function HealthRingInsight() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-border">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate text-cream">
            <Sparkle className="h-[18px] w-[18px]" />
          </div>
          <div className="leading-tight">
            <h3 className="text-[1.15rem] text-slate">Dane z opaski zdrowia</h3>
            <p className="text-[0.78rem] text-slate-soft">Widżet premium</p>
          </div>
        </div>
        <span className="rounded-full bg-[#dceaf6] px-3 py-1 text-[0.75rem] text-[#3f74b0]">
          Połączono
        </span>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {/* Sleep */}
        <div className="rounded-2xl bg-[#eef2f7] p-5">
          <div className="mb-3 flex items-center gap-2 text-[#4f6f8f]">
            <Moon className="h-5 w-5" />
            <p className="text-[0.9rem]">Jakość snu</p>
          </div>
          <p style={{ fontFamily: "var(--font-display)" }} className="text-[1.9rem] text-slate">
            7h 20m
          </p>
          <p className="mt-1 text-[0.85rem] text-slate-soft">Spokojny · 92% efektywności</p>
          <div className="mt-3 flex h-2 gap-1 overflow-hidden rounded-full">
            <span className="flex-[3] bg-[#7fa4c4]" />
            <span className="flex-[5] bg-[#4f6f8f]" />
            <span className="flex-[2] bg-[#b9cbdd]" />
          </div>
        </div>

        {/* Heart rate */}
        <div className="rounded-2xl bg-[#faeeea] p-5">
          <div className="mb-1 flex items-center gap-2 text-[#c05a44]">
            <HeartPulse className="h-5 w-5" />
            <p className="text-[0.9rem]">Tętno</p>
          </div>
          <div className="flex items-end gap-1">
            <p style={{ fontFamily: "var(--font-display)" }} className="text-[1.9rem] text-slate">
              71
            </p>
            <p className="mb-1.5 text-[0.85rem] text-slate-soft">ud./min · na żywo</p>
          </div>
          <div className="-mx-2 mt-1 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={heartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c05a44" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c05a44" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#6b7772" }}
                  formatter={(v) => [`${v} ud./min`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="bpm"
                  stroke="#c05a44"
                  strokeWidth={2.5}
                  fill="url(#hr)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mx-4 mb-4 flex flex-col items-center gap-4 rounded-2xl bg-slate p-5 text-center text-cream sm:mx-6 sm:mb-6 sm:flex-row sm:items-center sm:text-left">
        <div className="flex-1">
          <p className="text-[1.05rem] text-cream">Nie masz jeszcze opaski?</p>
          <p className="text-[0.88rem] text-cream/70">
            Zapewnij bliskiej osobie całodobowe monitorowanie zdrowia z opaską Silver Care.
          </p>
        </div>
        <button className="flex w-full items-center justify-center gap-2 rounded-full bg-cream px-5 py-3 text-slate transition-transform hover:scale-[1.03] sm:w-auto">
          Kup opaskę <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
