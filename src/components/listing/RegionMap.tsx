// A small, honest location indicator: a simplified outline of Cyprus with a
// dot at the listing's region centre. No third-party map tiles (no tracking,
// no extra CSP hosts) and no fake street detail: the exact address is never
// known to us, only the region the seller chose.

const OUTLINE: [number, number][] = [
  [32.27, 35.1], [32.4, 34.75], [32.7, 34.64], [33.02, 34.56], [33.06, 34.68], [33.37, 34.72], [33.63, 34.82],
  [33.64, 34.93], [34.08, 34.97], [33.94, 35.12], [34.02, 35.3], [34.59, 35.69], [34.2, 35.52], [33.9, 35.36],
  [33.55, 35.36], [33.32, 35.34], [33.05, 35.36], [32.93, 35.4], [32.92, 35.2], [32.73, 35.18], [32.55, 35.17],
  [32.42, 35.05],
];

const W = 320;
const H = 150;
const LON = [32.2, 34.7];
const LAT = [34.5, 35.78];

function project([lon, lat]: [number, number]) {
  return [((lon - LON[0]) / (LON[1] - LON[0])) * W, ((LAT[1] - lat) / (LAT[1] - LAT[0])) * H];
}

export function RegionMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const path = OUTLINE.map((p, i) => `${i ? "L" : "M"}${project(p).map((n) => n.toFixed(1)).join(" ")}`).join("") + "Z";
  const [x, y] = project([lng, lat]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <path d={path} className="fill-brand-soft stroke-border-strong" strokeWidth="1.2" />
      <circle cx={x} cy={y} r="16" className="fill-accent/15" />
      <circle cx={x} cy={y} r="5.5" className="fill-accent stroke-surface" strokeWidth="2" />
    </svg>
  );
}
