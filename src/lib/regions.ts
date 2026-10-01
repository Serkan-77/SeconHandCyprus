import { REGIONS, REGION_NAMES } from "../../shared/constants.ts";

export const regions = REGIONS;
export const regionNames: string[] = REGION_NAMES;

export const REGION_COOKIE = "kie-region";

/** The region whose centre is closest (only the region is kept, never coordinates). */
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
