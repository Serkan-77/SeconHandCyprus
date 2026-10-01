// Writes the fake Supabase Storage tree used by the rehearsal:
//   <dir>/listing-images/<uid>/<file>, <dir>/avatars/<uid>/avatar.jpg
// Matches the paths in 10-seed.sql. kayip.jpg is deliberately missing and
// bozuk.jpg is not an image.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../api/package.json", import.meta.url));
const sharp = require("sharp");

const dir = process.argv[2];
if (!dir) throw new Error("usage: make-images.mjs <dir>");

const SELLER = "00000000-0000-4000-a000-000000000002";
const STORE = "00000000-0000-4000-a000-000000000005";

async function img(file, format, width, height, hue) {
  const target = path.join(dir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: hue, g: 120, b: 255 - hue } },
  })
    [format]()
    .withMetadata({ exif: { IFD0: { Copyright: "rehearsal", Artist: "should be stripped" } } })
    .toBuffer();
  writeFileSync(target, buf);
}

await img(`listing-images/${SELLER}/koltuk-1.jpg`, "jpeg", 1600, 1200, 30);
await img(`listing-images/${SELLER}/koltuk-2.png`, "png", 900, 1200, 90);
await img(`listing-images/${SELLER}/iphone.webp`, "webp", 1000, 1000, 150);
await img(`listing-images/${STORE}/para.jpg`, "jpeg", 2400, 1600, 200);
await img(`listing-images/${STORE}/cim.jpg`, "jpeg", 800, 600, 250);
await img(`avatars/${SELLER}/avatar.jpg`, "jpeg", 600, 600, 60);
mkdirSync(path.join(dir, "listing-images", STORE), { recursive: true });
writeFileSync(path.join(dir, `listing-images/${STORE}/bozuk.jpg`), "this is not an image");
console.log(`storage written to ${dir}`);
