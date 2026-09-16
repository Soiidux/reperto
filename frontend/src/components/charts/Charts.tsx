export interface ChartDatum {
  label: string;
  value: number;
}

/** Vertical bar chart built from CSS flex columns — responsive, zero-dependency. */
export function BarChart({
  data,
  format = (v) => String(v),
  heightClass = "h-44",
  emptyText = "No data yet",
}: {
  data: ChartDatum[];
  format?: (value: number) => string;
  heightClass?: string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className={`flex items-end justify-between gap-2 ${heightClass}`}>
        {data.map((d) => (
          <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${format(d.value)}`}>
            <span className="text-[10px] font-semibold tabular-nums text-neutral-500">{format(d.value)}</span>
            <div
              className="w-full max-w-9 rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-2">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-neutral-400">
            {d.label}
          </span>
        ))}
      </div>
      {data.length === 0 && <p className="py-8 text-center text-sm text-neutral-400">{emptyText}</p>}
    </div>
  );
}

/** Horizontal bar list — good for a few labelled categories like "per doctor". */
export function HBarChart({
  data,
  format = (v) => String(v),
  emptyText = "No activity yet",
}: {
  data: ChartDatum[];
  format?: (value: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">{emptyText}</p>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-neutral-600">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-neutral-700">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  arrived: "#22c55e",
  completed: "#3b82f6",
  cancelled: "#ef4444",
  "no-show": "#94a3b8",
};

/** Donut chart via CSS conic-gradient + an inline legend. */
export function DonutChart({
  segments,
  centerLabel = "total",
  emptyText = "No appointments yet",
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  emptyText?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">{emptyText}</p>;
  }
  let acc = 0;
  const stops = segments.map((s) => {
    const from = (acc / total) * 100;
    acc += s.value;
    const to = (acc / total) * 100;
    return `${s.color} ${from}% ${to}%`;
  });

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative aspect-square w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-xl font-bold tabular-nums text-neutral-900">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">{centerLabel}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 truncate text-neutral-600 capitalize">{s.label}</span>
            <span className="font-semibold tabular-nums text-neutral-700">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const statusColor = (status: string) => STATUS_COLORS[status] ?? "#a1a1aa";

export const formatIndianRupees = (value: number) =>
  value >= 0 ? `₹${value.toLocaleString("en-IN")}` : "-";