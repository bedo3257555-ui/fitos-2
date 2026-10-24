export function Sparkline({ data, color = "hsl(var(--primary))", width = 96, height = 32 }: { data: (number | null)[]; color?: string; width?: number; height?: number }) {
  const pts = data.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(pts[pts.length - 1].i)},${height} L${x(pts[0].i)},${height} Z`;
  const id = `sg-${Math.abs(Math.round(pts[0].v * 1000 + pts.length * 7))}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts[pts.length - 1].i)} cy={y(pts[pts.length - 1].v)} r="2.5" fill={color} />
    </svg>
  );
}
