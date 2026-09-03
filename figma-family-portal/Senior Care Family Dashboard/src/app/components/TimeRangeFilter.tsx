const ranges = ["Dzień", "Tydzień", "Miesiąc"] as const;
export type TimeRange = (typeof ranges)[number];

export function TimeRangeFilter({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-card p-1.5 ring-1 ring-border">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-full px-5 py-2 transition-all ${
            value === r
              ? "bg-sage text-primary-foreground shadow-sm"
              : "text-slate-soft hover:text-slate"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
