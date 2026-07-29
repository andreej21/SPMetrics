"use client";

import { useRef, useState } from "react";

type Point = { day: string; revenue: number; orders: number };

// Single-series revenue area chart. One axis, thin 2px line, recessive grid,
// crosshair + tooltip on hover (dataviz spec). Revenue is in minor units.
export default function RevenueChart({ points }: { points: Point[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const W = 1000;
  const H = 240;
  const padX = 8;
  const padTop = 16;
  const padBottom = 8;

  const max = Math.max(1, ...points.map((p) => p.revenue));
  const n = points.length;
  const x = (i: number) => (n <= 1 ? padX : padX + (i * (W - padX * 2)) / (n - 1));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - padBottom} L${x(0).toFixed(1)},${H - padBottom} Z`;

  const total = points.reduce((s, p) => s + p.revenue, 0);
  const fmt = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(c / 100);

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width; // 0..1
    const i = Math.round(rel * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  }

  if (total === 0) {
    return <p className="muted" style={{ padding: "24px 0" }}>No revenue in this range yet.</p>;
  }

  const hiPt = hi != null ? points[hi] : null;

  return (
    <div ref={wrapRef} className="chart" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 220, display: "block" }}>
        <defs>
          <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* recessive gridlines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={padX} x2={W - padX} y1={padTop + g * (H - padTop - padBottom)} y2={padTop + g * (H - padTop - padBottom)} stroke="var(--grid)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#revfill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hiPt && (
          <>
            <line x1={x(hi!)} x2={x(hi!)} y1={padTop} y2={H - padBottom} stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hi!)} cy={y(hiPt.revenue)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      {/* axis labels */}
      <div className="chart-axis">
        <span>{points[0]?.day.slice(5)}</span>
        <span>{points[Math.floor(n / 2)]?.day.slice(5)}</span>
        <span>{points[n - 1]?.day.slice(5)}</span>
      </div>

      {/* tooltip */}
      {hiPt && (
        <div
          className="chart-tip"
          style={{ left: `calc(${(hi! / Math.max(1, n - 1)) * 100}% )` }}
        >
          <div className="tip-day">{hiPt.day}</div>
          <div className="tip-rev">{fmt(hiPt.revenue)}</div>
          <div className="tip-ord muted">{hiPt.orders} order{hiPt.orders === 1 ? "" : "s"}</div>
        </div>
      )}
    </div>
  );
}
