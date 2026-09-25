// Fills a Supabase project with realistic demo data.
//
//   npm run seed
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and SEED_PASSWORD in
// .env.local. Re-running is safe: every account on the seed domain is deleted
// (with its listings, messages and photos) and created again.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !secret || !password) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY ve SEED_PASSWORD .env.local içinde olmalı.");
  process.exit(1);
}

const SEED_DOMAIN = "demo.kibrisikinciel.test";
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

// Deterministic pseudo-random so every run produces the same shape of data.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.floor(min + rand() * (max - min + 1));
const DAY = 86400000;
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600000).toISOString();

function must(result, label) {
  if (result.error) {
    console.error(`✗ ${label}:`, result.error.message);
    process.exit(1);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const people = [
  { key: "admin", name: "Yönetici", region: "Lefkoşa", role: "admin", bio: "Kıbrıs İkinci El moderasyon ekibi." },
  { key: "deniz", name: "Deniz A.", region: "Girne", bio: "Taşınma telaşında; evdeki güzel parçalara yeni ev arıyorum.", phone: "+905338112233", whatsapp: true, verified: true },
  { key: "ece", name: "Ece K.", region: "Lefkoşa", bio: "Fotoğraf ve kitap meraklısı. Hızlı yanıt veririm.", phone: "+905428223344", verified: true },
  { key: "mert", name: "Mert Y.", region: "Gazimağusa", bio: "Bisiklet, kamp ve outdoor ekipmanları.", phone: "+905338334455", whatsapp: true },
  { key: "selin", name: "Selin B.", region: "Girne", bio: "Bebek eşyaları temiz ve bakımlıdır." },
  { key: "can", name: "Can D.", region: "Larnaka", bio: "Elektronik ve oyun konsolları.", phone: "+35799445566", whatsapp: true, verified: true },
  { key: "ayse", name: "Ayşe T.", region: "Güzelyurt", bio: "Ev dekorasyonu ve vintage parçalar." },
  { key: "burak", name: "Burak Ö.", region: "İskele", bio: "Sahil evinden fazlalıklar.", phone: "+905488556677" },
  { key: "zeynep", name: "Zeynep Ç.", region: "Limasol", bio: "Minimal yaşam; az ama öz.", verified: true },
  { key: "emre", name: "Emre S.", region: "Lefkoşa", bio: "Öğrenciyim, mezuniyet öncesi eşyalarımı satıyorum." },
  { key: "hande", name: "Hande G.", region: "Baf", bio: "El yapımı ürünler ve hobi malzemeleri.", phone: "+35796667788", whatsapp: true },
  { key: "okan", name: "Okan E.", region: "Gazimağusa", bio: "Araç ve yedek parça." },
];

// ---------------------------------------------------------------------------
// Listings: [category, title, description, price, currency, condition, photo keywords, city district]
// ---------------------------------------------------------------------------

const catalog = {
  deniz: [
    ["mobilya", "Bouclé berjer", "Krem rengi bouclé kumaş, meşe ayaklı berjer. Taşındığım için satıyorum; leke ya da yırtık yok. Taşıma alıcıya aittir.", 4500, "TL", "Az kullanılmış", ["upholstered armchair", "armchair living room"], "Zeytinlik"],
    ["mobilya", "Masif meşe yemek masası", "6 kişilik, 180x90 cm masif meşe masa. Yüzeyinde birkaç küçük çizik var, fotoğraflarda görünüyor.", 12500, "TL", "Az kullanılmış", ["dining table wood", "wooden table"], "Karaoğlanoğlu"],
    ["ev-aletleri", "Nespresso kahve makinesi", "Kapsüllü kahve makinesi, süt köpürtücü hediye. Kireç temizliği yeni yapıldı.", 2200, "TL", "Az kullanılmış", ["espresso machine"], "Zeytinlik"],
    ["hobi", "Monstera saksı bitkisi", "1,2 m boyunda sağlıklı monstera, seramik saksısıyla birlikte.", 900, "TL", "Az kullanılmış", ["monstera deliciosa pot", "houseplant"], "Zeytinlik"],
  ],
  ece: [
    ["elektronik", "Aynasız fotoğraf makinesi", "24 MP aynasız gövde + 18-55 mm kit lens. Deklanşör sayısı 8.400. Kutusu, şarj aleti ve 2 batarya ile.", 12800, "TL", "Az kullanılmış", ["mirrorless camera", "digital camera"], "Gönyeli"],
    ["kitap", "Klasik roman seti (12 kitap)", "Türk ve dünya klasiklerinden 12 kitaplık set. Hepsi bir kez okundu, sayfalar temiz.", 650, "TL", "Az kullanılmış", ["books stack", "bookshelf books"], "Köşklüçiftlik"],
    ["hobi", "Plak çalar", "Kayış tahrikli pikap, dahili ön yükseltici. İğnesi yeni değişti.", 3900, "TL", "Az kullanılmış", ["turntable record player", "vinyl record"], "Gönyeli"],
    ["elektronik", "35 mm prime lens", "f/1.8 sabit lens, portre için ideal. Ön-arka kapak ve UV filtre ile.", 5200, "TL", "Az kullanılmış", ["camera lens"], "Gönyeli"],
  ],
  mert: [
    ["spor", "Şehir bisikleti", "28 jant, 7 vitesli şehir bisikleti. Sepet ve arka bagaj dahil. Lastikler yeni.", 6250, "TL", "Az kullanılmış", ["city bicycle", "bicycle basket"], "Sakarya"],
    ["spor", "Dağ bisikleti 29\"", "Hidrolik disk fren, ön amortisör. Hafif arazi kullanımı oldu, düzenli bakımlı.", 14500, "TL", "Az kullanılmış", ["mountain bike"], "Baykal"],
    ["spor", "4 kişilik kamp çadırı", "Çift katmanlı, su geçirmez çadır. İki kez kullanıldı, eksiksiz.", 2400, "TL", "Az kullanılmış", ["camping tent", "tent camping"], "Sakarya"],
    ["spor", "Kaykay (komple)", "Akçaağaç tabla, yeni rulmanlar. Başlangıç için harika.", 1100, "TL", "Yıpranmış", ["skateboard"], "Sakarya"],
  ],
  selin: [
    ["bebek", "Katlanır bebek arabası", "Tek elle katlanır, yatar koltuk. Yağmurluk ve ayak örtüsü hediye.", 3500, "TL", "Az kullanılmış", ["baby stroller", "pram"], "Alsancak"],
    ["bebek", "Ahşap mama sandalyesi", "Büyüdükçe ayarlanabilen ahşap mama sandalyesi, minderi yıkanmış.", 1800, "TL", "Az kullanılmış", ["high chair baby"], "Alsancak"],
    ["bebek", "Oto koltuğu 0-13 kg", "Isofix bazalı ana kucağı. Kaza geçirmedi.", 2600, "TL", "Az kullanılmış", ["child car seat", "baby car seat"], "Alsancak"],
    ["giyim", "Kışlık kadın mont (M)", "Kaz tüyü dolgulu, bir sezon giyildi. Kuru temizlemeden yeni geldi.", 1400, "TL", "Az kullanılmış", ["down jacket", "winter coat"], "Girne Merkez"],
  ],
  can: [
    ["elektronik", "Oyun konsolu + 2 kol", "Diskli sürüm, 2 kablosuz kol ve 3 oyun ile. Kutusunda.", 450, "€", "Az kullanılmış", ["PlayStation console", "game controller"], "Merkez"],
    ["elektronik", "27\" 4K monitör", "IPS panel, USB-C ile tek kablo bağlantı. Ölü piksel yok.", 220, "€", "Az kullanılmış", ["computer monitor", "computer desk"], "Merkez"],
    ["elektronik", "Kablosuz kulaklık (ANC)", "Aktif gürültü engelleme, 30 saat pil. Kılıfı ve kablosu mevcut.", 120, "€", "Az kullanılmış", ["headphones"], "Mackenzie"],
    ["elektronik", "Mekanik klavye", "Kahverengi switch, Türkçe Q dizilim, RGB aydınlatma.", 65, "€", "Az kullanılmış", ["mechanical keyboard", "computer keyboard"], "Merkez"],
  ],
  ayse: [
    ["mobilya", "Okuma köşesi berjeri", "Kadife kumaş, yeni gibi. Sadece vitrin olarak kullanıldı.", 250, "€", "Sıfır", ["velvet armchair", "reading chair"], "Merkez"],
    ["mobilya", "Rattan konsol", "El örmesi rattan kapaklı konsol, 120 cm.", 3200, "TL", "Az kullanılmış", ["rattan furniture", "sideboard furniture"], "Merkez"],
    ["ev-aletleri", "Retro buzdolabı", "Pastel yeşil retro tasarım, A+ enerji sınıfı. Sessiz çalışıyor.", 9800, "TL", "Az kullanılmış", ["refrigerator", "kitchen refrigerator"], "Merkez"],
    ["hobi", "Seramik vazo seti", "El yapımı üçlü seramik vazo seti.", 750, "TL", "Sıfır", ["ceramic vase", "pottery vases"], "Merkez"],
  ],
  burak: [
    ["spor", "SUP board (şişme)", "3,2 m şişme SUP, pompa, kürek ve çanta ile. 5 kez kullanıldı.", 7900, "TL", "Az kullanılmış", ["stand up paddle board", "paddleboard beach"], "Long Beach"],
    ["mobilya", "Bahçe oturma grubu", "Alüminyum iskelet, 4 sandalye + masa. Minderler yıkanabilir.", 8500, "TL", "Az kullanılmış", ["garden furniture", "patio furniture"], "Long Beach"],
    ["ev-aletleri", "Klima 12000 BTU", "Inverter split klima, montaj hariç. 2 yaşında.", 11000, "TL", "Az kullanılmış", ["air conditioner split"], "Boğaz"],
  ],
  zeynep: [
    ["giyim", "Deri çanta", "Hakiki deri omuz çantası, taba rengi. Faturası mevcut.", 95, "€", "Sıfır", ["leather handbag", "handbag"], "Germasogeia"],
    ["giyim", "Keten gömlek seti (3 adet)", "S beden, bej-beyaz-mavi keten gömlekler.", 40, "€", "Az kullanılmış", ["linen shirt", "shirts"], "Merkez"],
    ["mobilya", "Minimal çalışma masası", "Beyaz lake, 120x60 cm, kablo kanallı.", 110, "€", "Az kullanılmış", ["computer desk", "workspace"], "Merkez"],
  ],
  emre: [
    ["mobilya", "Kitaplık (5 raf)", "Ceviz renkli, 180 cm kitaplık. Söküp teslim edebilirim.", 1200, "TL", "Yıpranmış", ["bookcase", "shelves books"], "Kumsal"],
    ["elektronik", "Dizüstü bilgisayar 14\"", "16 GB RAM, 512 GB SSD. Pil sağlığı %88. Şarj aleti ile.", 18500, "TL", "Az kullanılmış", ["laptop computer"], "Kumsal"],
    ["kitap", "Üniversite hazırlık kitapları", "Matematik ve fen kitapları, işaretleme az.", 400, "TL", "Yıpranmış", ["textbooks", "mathematics books"], "Gönyeli"],
    ["ev-aletleri", "Mikrodalga fırın", "20 litre, ızgara fonksiyonlu.", 1300, "TL", "Az kullanılmış", ["microwave oven"], "Kumsal"],
  ],
  hande: [
    ["hobi", "Akrilik boya seti + tuval", "24 renk akrilik boya, 6 tuval ve fırça seti.", 35, "€", "Sıfır", ["acrylic paint tubes", "painting canvas easel"], "Kato Paphos"],
    ["hobi", "Dikiş makinesi", "Elektronik dikiş makinesi, 30 desen. Pedal ve aparatlarıyla.", 140, "€", "Az kullanılmış", ["sewing machine"], "Merkez"],
    ["giyim", "El örgüsü hırka", "Yün karışımlı, M beden, ekru.", 45, "€", "Sıfır", ["knitted cardigan", "knitting wool sweater"], "Merkez"],
  ],
  okan: [
    ["arac", "Scooter 125cc", "2019 model, 18.000 km. Muayenesi yeni, bakımları yapıldı.", 2900, "€", "Az kullanılmış", ["motor scooter", "scooter parked"], "Sakarya"],
    ["arac", "Araç çatı bagajı", "Aerodinamik 420 lt çatı bagajı, anahtarlı kilit.", 5500, "TL", "Az kullanılmış", ["roof box car", "car roof rack"], "Maraş"],
    ["arac", "Kış lastiği seti 205/55 R16", "4 adet, diş derinliği 6 mm.", 6000, "TL", "Az kullanılmış", ["car tires", "tyre wheel"], "Sakarya"],
  ],
};

// A few listings go through the moderation states so every admin screen has data.
const specialStatus = {
  "Retro buzdolabı": { status: "pending" },
  "Mikrodalga fırın": { status: "pending" },
  "Kış lastiği seti 205/55 R16": { status: "pending" },
  "Seramik vazo seti": { status: "pending" },
  "Mekanik klavye": { status: "rejected", reject_reason: "Fotoğraflar net değil. Ürünü gün ışığında, farklı açılardan tekrar çek." },
  "Keten gömlek seti (3 adet)": { status: "sold" },
  "Kaykay (komple)": { status: "sold" },
  "Üniversite hazırlık kitapları": { status: "sold" },
};
const featuredTitles = new Set(["Bouclé berjer", "Dağ bisikleti 29\"", "Oyun konsolu + 2 kol"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fallbackImages = ["public/images/demo-chair.jpg", "public/images/demo-camera.jpg", "public/images/demo-bicycle.jpg"];

// Creative Commons photos via the Openverse API, matched by keyword.
const UA = "KibrisIkinciElSeed/1.0 (demo data script)";
const photoCache = new Map();
const usedPhotos = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function commonsPhotos(keyword) {
  if (photoCache.has(keyword)) return photoCache.get(keyword);
  const api = new URL("https://api.openverse.org/v1/images/");
  api.searchParams.set("q", keyword);
  api.searchParams.set("page_size", "20");
  api.searchParams.set("mature", "false");
  let urls = [];
  for (let attempt = 0; attempt < 3 && urls.length === 0; attempt++) {
    try {
      const res = await fetch(api, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (res.status === 429) {
        await sleep(15000);
        continue;
      }
      const json = await res.json();
      const words = keyword.toLowerCase().split(" ");
      urls = (json.results ?? [])
        .filter((r) => (r.width ?? 0) >= 640 && /\.jpe?g($|\?)/i.test(r.url))
        .map((r) => ({ url: r.url, score: words.filter((w) => r.title?.toLowerCase().includes(w)).length }))
        .sort((x, y) => y.score - x.score)
        .map((r) => r.url);
    } catch {
      await sleep(2000);
    }
  }
  await sleep(1200);
  photoCache.set(keyword, urls);
  return urls;
}

async function fetchPhoto(keyword, lock) {
  try {
    const url = (await commonsPhotos(keyword)).find((u) => !usedPhotos.has(u));
    if (!url) throw new Error("no match");
    usedPhotos.add(url);
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) throw new Error("too small");
    return buf;
  } catch {
    return readFile(fallbackImages[lock % fallbackImages.length]);
  }
}

async function uploadPhoto(userId, keyword, lock) {
  const body = await fetchPhoto(keyword, lock);
  const path = `${userId}/seed-${lock}.jpg`;
  must(
    await supabase.storage.from("listing-images").upload(path, body, { contentType: "image/jpeg", upsert: true }),
    `upload ${path}`,
  );
  return path;
}

async function removeSeedUsers() {
  const doomed = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    doomed.push(...data.users.filter((u) => u.email?.endsWith(`@${SEED_DOMAIN}`)));
    if (data.users.length < 200) break;
  }
  // Anonymous seed tickets are not removed by the user cascade.
  await supabase.from("support_tickets").delete().eq("email", "ziyaretci@example.com");
  await supabase.from("support_tickets").delete().like("email", `%@${SEED_DOMAIN}`);
  await supabase.from("announcements").delete().eq("title", "Kıbrıs İkinci El yayında!");
  for (const user of doomed) {
    const { data: files } = await supabase.storage.from("listing-images").list(user.id, { limit: 1000 });
    if (files?.length) await supabase.storage.from("listing-images").remove(files.map((f) => `${user.id}/${f.name}`));
    await supabase.auth.admin.deleteUser(user.id);
  }
  return doomed.length;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("→ Eski demo verisi temizleniyor…");
console.log(`  ${await removeSeedUsers()} demo hesabı silindi.`);

console.log("→ Kullanıcılar oluşturuluyor…");
const ids = {};
for (const [i, p] of people.entries()) {
  const email = `${p.key}@${SEED_DOMAIN}`;
  const { user } = must(
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: p.name, region: p.region, phone: p.phone ?? "" },
    }),
    `createUser ${email}`,
  );
  ids[p.key] = user.id;
  const createdAt = ago(p.role === "admin" ? 400 : between(20, 900));
  // The number goes in first: changing it clears phone_verified (migration 0007).
  must(
    await supabase
      .from("profile_private")
      .update({ phone: p.phone ?? null, whatsapp_enabled: Boolean(p.whatsapp) })
      .eq("id", user.id),
    `contact ${email}`,
  );
  must(
    await supabase
      .from("profiles")
      .update({
        display_name: p.name,
        region: p.region,
        bio: p.bio,
        role: p.role ?? "user",
        // A reviewed number needs a number: no phone, no review.
        phone_verified: Boolean(p.verified && p.phone),
        created_at: createdAt,
      })
      .eq("id", user.id),
    `profile ${email}`,
  );
  process.stdout.write(`  ${i + 1}/${people.length} ${p.name}\r`);
}
console.log(`  ${people.length} kullanıcı hazır.            `);

const categories = must(await supabase.from("categories").select("id, slug"), "categories");
const categoryId = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

console.log("→ İlanlar ve fotoğraflar yükleniyor (biraz sürebilir)…");
const listings = [];
let lock = 1;
for (const [ownerKey, items] of Object.entries(catalog)) {
  const owner = people.find((p) => p.key === ownerKey);
  for (const [cat, title, description, price, currency, condition, keywords, district] of items) {
    const special = specialStatus[title] ?? { status: "active" };
    const createdDays = special.status === "pending" ? rand() * 1.5 : rand() * 40;
    const createdAt = ago(createdDays);
    const row = must(
      await supabase
        .from("listings")
        .insert({
          seller_id: ids[ownerKey],
          category_id: categoryId[cat],
          title,
          description,
          price,
          currency,
          city: owner.region,
          district,
          condition,
          negotiable: rand() > 0.45,
          status: special.status,
          reject_reason: special.reject_reason ?? null,
          featured: featuredTitles.has(title),
          view_count: special.status === "pending" ? 0 : between(4, 340),
          created_at: createdAt,
          published_at: special.status === "pending" ? null : createdAt,
        })
        .select("id, title, seller_id, status, slug")
        .single(),
      `listing ${title}`,
    );
    const photoCount = Math.min(keywords.length + between(0, 1), 3);
    const images = [];
    for (let i = 0; i < photoCount; i++) {
      images.push({ listing_id: row.id, path: await uploadPhoto(ids[ownerKey], keywords[i % keywords.length], lock++), position: i });
    }
    must(await supabase.from("listing_images").insert(images), `images ${title}`);
    listings.push(row);
    process.stdout.write(`  ${listings.length} ilan\r`);
  }
}
console.log(`  ${listings.length} ilan eklendi.   `);

const active = listings.filter((l) => l.status === "active");
const buyers = people.filter((p) => p.key !== "admin").map((p) => p.key);

console.log("→ Favoriler…");
const favorites = new Map();
for (const key of buyers) {
  for (let i = 0; i < between(2, 6); i++) {
    const l = pick(active);
    if (l.seller_id !== ids[key]) favorites.set(`${key}:${l.id}`, { user_id: ids[key], listing_id: l.id, created_at: ago(rand() * 20) });
  }
}
must(await supabase.from("favorites").insert([...favorites.values()]), "favorites");

console.log("→ Konuşmalar ve mesajlar…");
const scripts = [
  ["Merhaba, {t} hâlâ satılık mı?", "Merhaba, evet satılık. Dilersen gelip görebilirsin.", "Harika! Yarın 17.00 gibi uygun olur mu?", "Olur, konum atarım. Görüşmek üzere."],
  ["Merhaba, fiyatta biraz esneklik var mı?", "Merhaba, küçük bir indirim yapabilirim.", "Nakit alırsam son ne olur?", "Senin için %10 indirim yapayım.", "Anlaştık, teşekkürler!"],
  ["Selam, ürünün kutusu duruyor mu?", "Evet, kutusu ve faturası duruyor.", "Süper, hafta sonu bakabilir miyim?"],
  ["Merhaba, kargo ile gönderme şansınız var mı?", "Maalesef sadece elden teslim ediyorum.", "Anladım, Cumartesi uğrarım o zaman."],
  ["İyi akşamlar, ürün hangi semtte?", "İyi akşamlar, ilanda yazan semtteyim. Merkezi bir yerde buluşabiliriz.", "Tamamdır, yazışalım."],
];
const conversations = [];
const pairs = new Set();
// Make sure the showcase buyer (Ece) has a lively inbox.
const plannedPairs = [
  ["ece", "Bouclé berjer"],
  ["ece", "Şehir bisikleti"],
  ["ece", "Oyun konsolu + 2 kol"],
  ["deniz", "Aynasız fotoğraf makinesi"],
  ["deniz", "SUP board (şişme)"],
];
while (plannedPairs.length < 16) {
  const buyer = pick(buyers);
  const l = pick(active);
  if (l.seller_id !== ids[buyer]) plannedPairs.push([buyer, l.title]);
}
for (const [buyerKey, title] of plannedPairs) {
  const l = listings.find((x) => x.title === title && x.status === "active");
  if (!l || l.seller_id === ids[buyerKey] || pairs.has(`${buyerKey}:${l.id}`)) continue;
  pairs.add(`${buyerKey}:${l.id}`);
  const startDays = rand() * 12;
  const conv = must(
    await supabase
      .from("conversations")
      .insert({ listing_id: l.id, buyer_id: ids[buyerKey], seller_id: l.seller_id, created_at: ago(startDays) })
      .select("id, buyer_id, seller_id, listing_id")
      .single(),
    "conversation",
  );
  const script = pick(scripts);
  const length = between(2, script.length);
  let t = Date.now() - startDays * DAY;
  const messages = script.slice(0, length).map((body, i) => {
    t += between(3, 180) * 60000;
    const isLast = i === length - 1;
    return {
      conversation_id: conv.id,
      sender_id: i % 2 === 0 ? conv.buyer_id : conv.seller_id,
      body: body.replace("{t}", l.title.toLocaleLowerCase("tr-TR")),
      created_at: new Date(Math.min(t, Date.now() - 60000)).toISOString(),
      // Leave the newest message unread in roughly half of the chats.
      read_at: isLast && rand() > 0.5 ? null : new Date(Math.min(t + 120000, Date.now())).toISOString(),
    };
  });
  for (const m of messages) must(await supabase.from("messages").insert(m), "message");
  conversations.push({ ...conv, finished: length >= 4 });
}
console.log(`  ${conversations.length} konuşma.`);

console.log("→ Değerlendirmeler…");
const comments = [
  "Anlaştığımız gibi hızlı ve sorunsuz bir buluşmaydı, teşekkürler.",
  "Ürün açıklamadaki gibiydi, iletişim çok kolaydı.",
  "Zamanında geldi, çok nazikti. Tekrar alışveriş yaparım.",
  "Ürün tertemizdi, tavsiye ederim.",
  "Biraz geç kaldı ama ürün sorunsuz.",
  null,
];
const ratings = [];
for (const c of conversations.filter((c) => c.finished)) {
  // Both sides confirmed the meeting (needs migration 0006).
  const met = ago(rand() * 3);
  await supabase
    .from("conversations")
    .update({ buyer_confirmed_at: met, seller_confirmed_at: met, meeting_confirmed_at: met })
    .eq("id", c.id);
  ratings.push({ rater_id: c.buyer_id, ratee_id: c.seller_id, conversation_id: c.id, listing_id: c.listing_id, score: pick([5, 5, 5, 4, 4, 3]), comment: pick(comments), created_at: ago(rand() * 3) });
}
// Historic ratings (from sales outside the current conversations) so seller pages have depth.
for (let i = 0; i < 22; i++) {
  const rater = pick(buyers);
  const ratee = pick(buyers);
  if (rater === ratee) continue;
  ratings.push({ rater_id: ids[rater], ratee_id: ids[ratee], conversation_id: null, listing_id: null, score: pick([5, 5, 4, 4, 5, 3]), comment: pick(comments), created_at: ago(between(15, 300)) });
}
must(await supabase.from("ratings").insert(ratings), "ratings");

console.log("→ Moderasyon verisi…");
const byTitle = (t) => listings.find((l) => l.title === t);
must(
  await supabase.from("reports").insert([
    { reporter_id: ids.ece, listing_id: byTitle("Scooter 125cc").id, reason: "Sahte ya da yanıltıcı ilan", detail: "Aynı fotoğraflar başka bir sitede farklı fiyatla var.", status: "pending", created_at: ago(0.3) },
    { reporter_id: ids.selin, reported_user_id: ids.okan, reason: "Fiyat dışı ödeme talebi", detail: "Görmeden kapora göndermemi istedi.", status: "reviewing", created_at: ago(1.2) },
    { reporter_id: ids.emre, listing_id: byTitle("Klima 12000 BTU").id, reason: "Ürün satılmış / yayında değil", status: "pending", created_at: ago(2) },
    { reporter_id: ids.deniz, listing_id: byTitle("Kablosuz kulaklık (ANC)").id, reason: "Uygunsuz içerik", detail: "Açıklamada alakasız bağlantı vardı.", status: "resolved", resolution_note: "Satıcı açıklamayı düzeltti, uyarıldı.", resolved_at: ago(4), created_at: ago(5) },
  ]),
  "reports",
);
must(
  await supabase.from("verification_requests").insert([
    { user_id: ids.mert, kind: "phone", detail: "+905338334455", created_at: ago(0.5) },
    { user_id: ids.hande, kind: "phone", detail: "+35796667788", created_at: ago(1.1) },
    { user_id: ids.burak, kind: "phone", detail: "+905488556677", created_at: ago(2.4) },
  ]),
  "verifications",
);
must(
  await supabase.from("sanctions").insert({ user_id: ids.okan, kind: "warn", reason: "Alıcılardan kapora talep ettiği bildirildi.", created_by: ids.admin, created_at: ago(1) }),
  "sanctions",
);
must(
  await supabase.from("support_tickets").insert([
    { user_id: ids.emre, email: `emre@${SEED_DOMAIN}`, topic: "İlan sorunu", message: "İlanımın fotoğraf sırasını değiştiremiyorum, ilk fotoğrafı nasıl kapak yaparım?", created_at: ago(0.8) },
    { user_id: null, email: "ziyaretci@example.com", topic: "Diğer", message: "Mağazamızın ürünlerini toplu olarak ekleyebilir miyiz? İşletmeler için bir seçenek var mı?", created_at: ago(3) },
  ]),
  "support",
);

console.log("→ Duyuru ve bildirimler…");
const announcement = {
  audience: "Tüm kullanıcılar",
  title: "Kıbrıs İkinci El yayında!",
  body: "İlan vermek ücretsiz. Güvenli alışveriş ipuçları için Yardım sayfasına göz at.",
};
must(await supabase.from("announcements").insert({ ...announcement, recipients: buyers.length, created_by: ids.admin, created_at: ago(6) }), "announcement");
must(
  await supabase.from("notifications").insert([
    ...buyers.map((key) => ({ user_id: ids[key], kind: "announcement", title: announcement.title, body: announcement.body, link: null, read_at: rand() > 0.5 ? ago(5) : null, created_at: ago(6) })),
    ...active
      .filter(() => rand() > 0.6)
      .map((l) => ({ user_id: l.seller_id, kind: "listing", title: "İlanın yayına alındı", body: `${l.title} artık aramalarda görünüyor.`, link: `/ilan/${l.slug}`, read_at: ago(2), created_at: ago(between(3, 30)) })),
    { user_id: ids.can, kind: "listing", title: "İlanın yayınlanamadı", body: "Mekanik klavye: Fotoğraflar net değil.", link: `/ilan-ver/reddedildi?id=${byTitle("Mekanik klavye").id}`, read_at: null, created_at: ago(0.7) },
  ]),
  "notifications",
);

console.log("\n✓ Demo verisi hazır.\n");
console.log("  Giriş bilgileri (şifre: SEED_PASSWORD):");
console.log(`    Yönetici : admin@${SEED_DOMAIN}`);
console.log(`    Alıcı    : ece@${SEED_DOMAIN}`);
console.log(`    Satıcı   : deniz@${SEED_DOMAIN}`);
