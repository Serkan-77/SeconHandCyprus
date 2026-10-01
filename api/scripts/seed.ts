// Development seed: demo accounts, listings across the category tree with
// photos, a conversation with a confirmed meeting and a rating.
//
//   SEED_ALLOW=1 SEED_PASSWORD=… npm --prefix api run seed
//
// Refuses to run unless SEED_ALLOW=1, NODE_ENV is not production and the
// database host is local. Only rows of the demo e-mail domain are replaced.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import sharp from "sharp";
import { hashPassword } from "../src/auth/passwords.ts";
import { newKey, processImage } from "../src/storage/images.ts";
import { LocalStore } from "../src/storage/store.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const DOMAIN = "demo.kibrisikincielcim.test";

const url = process.env.DATABASE_OWNER_URL ?? "";
const password = process.env.SEED_PASSWORD ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (process.env.SEED_ALLOW !== "1" || process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "db"].includes(host)) {
  console.error("Seed refused: needs SEED_ALLOW=1, a non-production NODE_ENV and a local DATABASE_OWNER_URL.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("SEED_PASSWORD (8+ characters) is required.");
  process.exit(1);
}

const sql = postgres(url, { max: 2, onnotice: () => {} });
const store = new LocalStore(process.env.UPLOAD_DIR ?? path.resolve(here, "../data/uploads"));
const demoPhotos = await Promise.all(
  ["demo-chair.jpg", "demo-bicycle.jpg", "demo-camera.jpg"].map((f) => readFile(path.resolve(here, "../../public/images", f))),
);

async function photo(ownerId: string, index: number, hue: number) {
  // Real photos, tinted so listings do not all look the same.
  const base = demoPhotos[index % demoPhotos.length];
  const input = await sharp(base).modulate({ hue, saturation: 1.05 }).jpeg({ quality: 88 }).toBuffer();
  const processed = await processImage(input, "listing");
  const key = newKey("listing");
  await store.putVariants(key, processed.variants);
  await sql`insert into uploads (owner_id, kind, key, width, height, bytes, attached_at)
            values (${ownerId}, 'listing', ${key}, ${processed.width}, ${processed.height}, ${processed.bytes}, now())`;
  return { key, width: processed.width, height: processed.height };
}

async function user(local: string, name: string, extra: Record<string, unknown> = {}) {
  const [u] = await sql<{ id: string }[]>`
    insert into auth.users (email, password_hash, email_verified_at, password_changed_at)
    values (${`${local}@${DOMAIN}`}, ${await hashPassword(password)}, now(), now()) returning id`;
  await sql`insert into profiles ${sql({ id: u.id, display_name: name, region: "Girne", ...extra })}`;
  await sql`insert into profile_private (id) values (${u.id})`;
  return u.id;
}

const LISTINGS: { cat: string; title: string; price: number; currency?: string; city: string; condition: string; attrs: Record<string, unknown>; desc: string; featured?: boolean }[] = [
  { cat: "cep-telefonu", title: "iPhone 13 128 GB, pil sağlığı %89", price: 21500, city: "Lefkoşa", condition: "Az kullanılmış", attrs: { brand: "apple", model: "iPhone 13", storage_gb: "128", battery_health: 89, sim: "sim-esim", screen_condition: "kusursuz", box: true }, desc: "Kılıfla kullanıldı, ekranda çizik yok. Kutusu ve kablosu var.", featured: true },
  { cat: "cep-telefonu", title: "Samsung Galaxy S21 256 GB", price: 14900, city: "Girne", condition: "Az kullanılmış", attrs: { brand: "samsung", model: "Galaxy S21", storage_gb: "256", ram_gb: "8", battery_health: 84 }, desc: "Arka kamerada hiçbir sorun yok, şarjı bir gün gidiyor." },
  { cat: "dizustu-bilgisayar", title: "MacBook Air M1 8/256, gümüş", price: 650, currency: "€", city: "Larnaka", condition: "Az kullanılmış", attrs: { brand: "apple", model: "MacBook Air M1", cpu: "Apple M1", ram_gb: "8", storage_gb: "256", storage_type: "ssd", screen_inch: 13.3, battery_condition: "iyi", charger: true }, desc: "Öğrenciyken kullandım, şarj döngüsü 210.", featured: true },
  { cat: "koltuk-kanepe", title: "Üçlü kanepe, gri kumaş", price: 7500, city: "Girne", condition: "Az kullanılmış", attrs: { sofa_type: "kanepe", seats: 3, material: "kumas", width_cm: 220, depth_cm: 95, height_cm: 85, delivery: ["Elden teslim"] }, desc: "Sigara içilmeyen evden. Taşınma nedeniyle satılık." },
  { cat: "koltuk-kanepe", title: "Ahşap kollu berjer", price: 2400, city: "Gazimağusa", condition: "Yıpranmış", attrs: { sofa_type: "berjer-tekli-koltuk", seats: 1, material: "ahsap", defects: "Sağ kolda küçük çizik" }, desc: "Döşemesi yenilenebilir, iskeleti sağlam." },
  { cat: "masa-sandalye", title: "Masif meşe yemek masası + 6 sandalye", price: 18000, city: "Lefkoşa", condition: "Az kullanılmış", attrs: { table_item: "masa-takimi", seats: 6, material: "ahsap", width_cm: 180, depth_cm: 90 }, desc: "Ağır ve sağlam, tek parça meşe." },
  { cat: "bisiklet", title: "Trek Marlin 5 dağ bisikleti, M kadro", price: 420, currency: "€", city: "Limasol", condition: "Az kullanılmış", attrs: { bike_type: "dag-bisikleti", wheel_inch: "29", frame_size: "m", brand: "Trek" }, desc: "Fren balataları yeni, zincir bakımlı.", featured: true },
  { cat: "bisiklet", title: "Çocuk bisikleti 20 jant", price: 1500, city: "İskele", condition: "Az kullanılmış", attrs: { bike_type: "cocuk-bisikleti", wheel_inch: "20" }, desc: "6-9 yaş için uygun." },
  { cat: "fotograf-kamera", title: "Sony A6000 + 16-50 mm objektif", price: 9800, city: "Girne", condition: "Az kullanılmış", attrs: { camera_item: "fotograf-makinesi", brand: "sony", shutter_count: 12500, box: true }, desc: "Ekstra batarya ve çanta hediye." },
  { cat: "klima-isitma", title: "12000 BTU inverter split klima", price: 11000, city: "Güzelyurt", condition: "Az kullanılmış", attrs: { climate_item: "split-klima", btu: "12000", inverter: true, energy_class: "a" }, desc: "İki yaz kullanıldı, sökümü alıcıya ait." },
  { cat: "beyaz-esya", title: "Bosch çamaşır makinesi 9 kg", price: 8500, city: "Lefkoşa", condition: "Az kullanılmış", attrs: { appliance_item: "camasir-makinesi", energy_class: "a", brand: "Bosch" }, desc: "Sorunsuz çalışıyor." },
  { cat: "ders-kitabi", title: "Calculus (Stewart) 8. baskı", price: 450, city: "Gazimağusa", condition: "Az kullanılmış", attrs: { author: "James Stewart", language: "ingilizce", course: "MATH101" }, desc: "Notlar kurşun kalemle, silinebilir." },
  { cat: "oyun-konsol", title: "PlayStation 5 + 2 kol", price: 17500, city: "Larnaka", condition: "Az kullanılmış", attrs: { platform: "playstation-5", gaming_item: "konsol" }, desc: "Disk sürücülü versiyon." },
  { cat: "kadin-giyim", title: "Mango trençkot, M beden", price: 900, city: "Girne", condition: "Sıfır", attrs: { size: "m", brand: "Mango", color: "Bej" }, desc: "Etiketi üzerinde, hiç giyilmedi." },
];

async function main() {
  await sql`delete from auth.users where email like ${"%@" + DOMAIN}`;
  const admin = await user("admin", "Yönetici Deniz", { role: "admin" });
  const store1 = await user("magaza", "Ahmet Kaya", { account_type: "store", store_name: "Girne İkinci El Ev", store_verified: true, store_hours: "Hafta içi 09:00–18:00", store_address: "Girne merkez" });
  const seller = await user("satici", "Elif Demir", { region: "Lefkoşa", bio: "Lefkoşa'da yaşıyorum, eşyalarıma iyi bakarım." });
  const buyer = await user("alici", "Can Yıldız");
  void admin;

  const cats = new Map((await sql<{ id: number; slug: string }[]>`select id, slug from categories`).map((c) => [c.slug, c.id]));
  const ids: string[] = [];
  for (const [i, l] of LISTINGS.entries()) {
    const owner = i % 3 === 0 ? store1 : seller;
    const [row] = await sql<{ id: string }[]>`
      insert into listings (seller_id, category_id, title, description, price, currency, city, condition, status, attributes, featured, created_at)
      values (${owner}, ${cats.get(l.cat)!}, ${l.title}, ${l.desc}, ${l.price}, ${l.currency ?? "TL"}, ${l.city}, ${l.condition}, 'active',
              ${sql.json(l.attrs as never)}, ${Boolean(l.featured)}, now() - make_interval(hours => ${i * 7}))
      returning id`;
    ids.push(row.id);
    for (let p = 0; p < 1 + (i % 3); p++) {
      const ph = await photo(owner, i + p, (i * 37 + p * 50) % 360);
      await sql`insert into listing_images (listing_id, path, position, width, height) values (${row.id}, ${ph.key}, ${p}, ${ph.width}, ${ph.height})`;
    }
  }
  // One listing waiting for moderation.
  await sql`update listings set status = 'pending', featured = false where id = ${ids[ids.length - 1]}`;

  const [conv] = await sql<{ id: string }[]>`
    insert into conversations (listing_id, buyer_id, seller_id) values (${ids[1]}, ${buyer}, ${seller}) returning id`;
  const lines: [string, string][] = [
    [buyer, "Merhaba, hâlâ satılık mı?"],
    [seller, "Merhaba, evet hâlâ satılık."],
    [buyer, "Yarın akşam Girne'de görebilir miyim?"],
    [seller, "Olur, 18:00'de limanda buluşalım."],
  ];
  for (const [i, [from, body]] of lines.entries()) {
    await sql`insert into messages (conversation_id, sender_id, body, created_at) values (${conv.id}, ${from}, ${body}, now() - make_interval(mins => ${(lines.length - i) * 30}))`;
  }
  await sql`update conversations set buyer_confirmed_at = now(), seller_confirmed_at = now() where id = ${conv.id}`;
  await sql`insert into ratings (rater_id, ratee_id, conversation_id, listing_id, score, comment) values (${buyer}, ${seller}, ${conv.id}, ${ids[1]}, 5, 'Çok ilgili ve dakik bir satıcı, ürün anlatıldığı gibiydi.')`;

  console.log(`Seeded ${LISTINGS.length} listings. Accounts: admin, magaza, satici, alici @${DOMAIN}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
