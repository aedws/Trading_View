"use client";

type Point = { x: number; y: number };

type Props = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Optional band: upper / lower of same length as values. Plotted as filled area. */
  band?: { upper: number[]; lower: number[]; color?: string };
  /** Optional reference line at y = 0 (or the given value) */
  zeroLine?: number;
  /** Optional secondary lines drawn under the main line */
  overlays?: { values: number[]; color: string; dashed?: boolean }[];
  /** y-axis lower/upper override */
  yMin?: number;
  yMax?: number;
};

export default function Sparkline({
  values,
  width = 320,
  height = 80,
  color = "#3b82f6",
  band,
  zeroLine,
  overlays,
  yMin,
  yMax,
}: Props) {
  const valid = values.filter((v) => isFinite(v));
  if (valid.length < 2) {
    return (
      <div
        className="text-[10px] text-gray-600 flex items-center justify-center border border-dashed border-border-soft rounded"
        style={{ width: "100%", height }}
      >
        데이터 부족
      </div>
    );
  }
  const allValues = [
    ...valid,
    ...(band ? band.upper.filter((v) => isFinite(v)) : []),
    ...(band ? band.lower.filter((v) => isFinite(v)) : []),
    ...(overlays ?? []).flatMap((o) => o.values.filter((v) => isFinite(v))),
  ];
  const finiteScale = allValues.filter((v) => Number.isFinite(v));
  let lo = Number.isFinite(Number(yMin))
    ? (yMin as number)
    : Math.min(...finiteScale);
  let hi = Number.isFinite(Number(yMax))
    ? (yMax as number)
    : Math.max(...finiteScale);
  if (zeroLine !== undefined) {
    lo = Math.min(lo, zeroLine);
    hi = Math.max(hi, zeroLine);
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  const PAD_X = 2;
  const PAD_Y = 2;
  const W = width - PAD_X * 2;
  const H = height - PAD_Y * 2;

  function toPoints(arr: number[]): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (!isFinite(arr[i])) continue;
      const x = PAD_X + (i / (arr.length - 1 || 1)) * W;
      const y = PAD_Y + (1 - (arr[i] - lo) / span) * H;
      pts.push({ x, y });
    }
    return pts;
  }

  const linePoints = toPoints(values);
  const lineD = linePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  let bandD = "";
  if (band) {
    const upPts = toPoints(band.upper);
    const lowPts = toPoints(band.lower);
    if (upPts.length > 1 && lowPts.length === upPts.length) {
      bandD =
        upPts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" ") +
        " " +
        lowPts
          .slice()
          .reverse()
          .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" ") +
        " Z";
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      {bandD && (
        <path d={bandD} fill={(band?.color ?? color) + "22"} stroke="none" />
      )}
      {zeroLine !== undefined &&
        (() => {
          const y =
            PAD_Y + (1 - (zeroLine - lo) / span) * H;
          return (
            <line
              x1={PAD_X}
              x2={width - PAD_X}
              y1={y}
              y2={y}
              stroke="#374151"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          );
        })()}
      {(overlays ?? []).map((o, idx) => {
        const pts = toPoints(o.values);
        const d = pts
          .map((p, i) =>
            `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
          )
          .join(" ");
        return (
          <path
            key={idx}
            d={d}
            fill="none"
            stroke={o.color}
            strokeWidth={1}
            strokeDasharray={o.dashed ? "3 2" : undefined}
          />
        );
      })}
      <path d={lineD} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
