"use client";

type Item = {
  label: string;
  value: number;
  color?: string;
};

export default function Bars({
  items,
  height = 80,
  zeroLine = false,
  formatValue,
}: {
  items: Item[];
  height?: number;
  zeroLine?: boolean;
  formatValue?: (v: number) => string;
}) {
  if (items.length === 0) return null;
  const lo = zeroLine
    ? Math.min(0, ...items.map((i) => i.value))
    : Math.min(...items.map((i) => i.value));
  const hi = zeroLine
    ? Math.max(0, ...items.map((i) => i.value))
    : Math.max(...items.map((i) => i.value));
  const span = hi - lo || 1;
  const width = 100;
  const barW = width / items.length;
  const PAD = 1;

  function y(v: number) {
    return ((hi - v) / span) * (height - 14);
  }
  const yZero = y(0);

  return (
    <div className="w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {zeroLine && (
          <line
            x1={0}
            x2={width}
            y1={yZero}
            y2={yZero}
            stroke="#374151"
            strokeWidth={0.4}
            strokeDasharray="0.6 0.6"
          />
        )}
        {items.map((it, i) => {
          const top = y(Math.max(0, it.value));
          const bot = y(Math.min(0, it.value));
          const h = Math.max(0.5, bot - top);
          return (
            <g key={i}>
              <rect
                x={i * barW + PAD}
                y={top}
                width={barW - 2 * PAD}
                height={h}
                fill={it.color ?? (it.value >= 0 ? "#22c55e" : "#ef4444")}
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>
      <div className="flex w-full text-[8px] text-gray-500 mt-0.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="text-center truncate"
            style={{ width: `${100 / items.length}%` }}
          >
            {it.label}
            {formatValue && (
              <div className="num text-[8px] text-gray-400">
                {formatValue(it.value)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
