// A small, honest location indicator: a simplified outline of Cyprus with a
// dot at the listing's region centre. No third-party map tiles (no tracking,
// no extra CSP hosts) and no fake street detail: the exact address is never
// known to us, only the region the seller chose.

const OUTLINE: [number, number][] = [
  [32.28, 35.1], [32.36, 35.06], [32.43, 35.05], [32.5, 35.12], [32.56, 35.16], [32.68, 35.18], [32.8, 35.17],
  [32.88, 35.19], [32.93, 35.25], [32.92, 35.33], [32.94, 35.39], [33.05, 35.36], [33.2, 35.35], [33.32, 35.34],
  [33.45, 35.33], [33.6, 35.36], [33.8, 35.39], [33.98, 35.43], [34.12, 35.47], [34.28, 35.54], [34.42, 35.62],
  [34.59, 35.7], [34.48, 35.63], [34.3, 35.53], [34.12, 35.43], [34.0, 35.38], [33.94, 35.3], [33.93, 35.2],
  [33.95, 35.1], [34.0, 35.02], [34.08, 34.97], [34.0, 34.96], [33.84, 34.97], [33.68, 34.95], [33.62, 34.87],
  [33.5, 34.8], [33.33, 34.72], [33.17, 34.69], [33.04, 34.66], [32.98, 34.6], [32.94, 34.57], [32.85, 34.64],
  [32.72, 34.66], [32.6, 34.68], [32.45, 34.73], [32.37, 34.8], [32.32, 34.9], [32.3, 35.0],
];

export const MAP_W = 320;
export const MAP_H = 150;
const W = MAP_W;
const H = MAP_H;
const LON = [32.2, 34.7];
const LAT = [34.5, 35.78];

export function project([lon, lat]: [number, number]) {
  return [((lon - LON[0]) / (LON[1] - LON[0])) * W, ((LAT[1] - lat) / (LAT[1] - LAT[0])) * H];
}

/** SVG path of the island outline in map coordinates. */
export const CYPRUS_PATH = OUTLINE.map((p, i) => `${i ? "L" : "M"}${project(p).map((n) => n.toFixed(1)).join(" ")}`).join("") + "Z";

export function RegionMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const path = CYPRUS_PATH;
  const [x, y] = project([lng, lat]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <path d={path} className="fill-brand-soft stroke-border-strong" strokeWidth="1.2" />
      <circle cx={x} cy={y} r="16" className="fill-accent/15" />
      <circle cx={x} cy={y} r="5.5" className="fill-accent stroke-surface" strokeWidth="2" />
    </svg>
  );
}
