export const regions = [
  { name: "Lefkoşa", lat: 35.1856, lng: 33.3823 },
  { name: "Girne", lat: 35.3364, lng: 33.3199 },
  { name: "Gazimağusa", lat: 35.125, lng: 33.9417 },
  { name: "Güzelyurt", lat: 35.1983, lng: 32.9936 },
  { name: "İskele", lat: 35.2869, lng: 33.8911 },
  { name: "Larnaka", lat: 34.9167, lng: 33.6233 },
  { name: "Limasol", lat: 34.6841, lng: 33.0379 },
  { name: "Baf", lat: 34.7754, lng: 32.4245 },
] as const;

export const regionNames: string[] = regions.map((r) => r.name);

export const REGION_COOKIE = "kie-region";

export function nearestRegion(lat: number, lng: number) {
  let best: string = regions[0].name;
  let bestDistance = Infinity;
  for (const r of regions) {
    const d = (r.lat - lat) ** 2 + ((r.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = r.name;
    }
  }
  return best;
}
