import { permanentRedirect } from "next/navigation";

// The listing form used to span several URLs (/ilan-ver/fotograflar, …,
// /ilan-ver/reddedildi?id=…). Rejection notifications still link to the last
// one; everything now lives on /ilan-ver and /hesabim/ilanlar/<id>.
export default async function OldSellRoute({
  params,
  searchParams,
}: {
  params: Promise<{ old: string[] }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ old }, { id }] = await Promise.all([params, searchParams]);
  if (old[0] === "reddedildi" && id && /^[0-9a-f-]{36}$/i.test(id)) permanentRedirect(`/hesabim/ilanlar/${id}`);
  permanentRedirect("/ilan-ver");
}
