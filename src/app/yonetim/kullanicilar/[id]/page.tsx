
import * as I18n from "@/components/i18n/Localized";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { LinkButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { createClient } from "@/lib/supabase/server";
import { getSellerSummary, one, type ListingStatus } from "@/lib/queries";
import { formatDate, initials } from "@/lib/format";
import { accountStatus, reportStatus, sanctionLabel } from "@/lib/adminLabels";
import { SanctionButton } from "./SanctionButton";
import { DeleteRatingButton } from "./DeleteRatingButton";

export const metadata = { title: "Yönetim · Kullanıcı", robots: { index: false } };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell>
      <UserDetail id={id} />
    </AdminShell>
  );
}

async function UserDetail({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getSellerSummary(id);
  if (!user) notFound();
  const supabase = await createClient();
  const [{ data: contact }, { data: listings }, { data: sanctions }, { data: reports }, { data: ratings }] = await Promise.all([
    supabase.from("profile_private").select("email, phone").eq("id", id).maybeSingle(),
    supabase
      .from("listings")
      .select("id, title, price, currency, status, created_at")
      .eq("seller_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("sanctions").select("id, kind, reason, created_at, expires_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id, reason, status, created_at")
      .eq("reported_user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ratings")
      .select("id, score, comment, created_at, rater:profiles!ratings_rater_id_fkey(display_name)")
      .eq("ratee_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const status = accountStatus[user.status] ?? accountStatus.active;
  const history = [
    ...(sanctions ?? []).map((s) => ({
      at: s.created_at,
      text: `${sanctionLabel[s.kind] ?? s.kind}: ${s.reason}${s.expires_at ? ` (bitiş ${formatDate(s.expires_at)})` : ""}`,
    })),
    ...(listings ?? []).map((l) => ({ at: l.created_at, text: `İlan oluşturdu: ${l.title}` })),
    { at: user.createdAt, text: "Hesap oluşturuldu" },
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Kullanıcı detayı</I18n.h1>
        <div className="flex flex-wrap gap-2.5">
          <LinkButton href={`/yonetim/kullanicilar/${user.id}/duzenle`} full={false} className="min-h-10 text-xs">
            Düzenle / sil
          </LinkButton>
          <LinkButton href="/yonetim/kullanicilar" variant="outline" full={false} className="min-h-10 text-xs">
            Listeye dön
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <I18n.div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <Avatar initials={initials(user.displayName)} src={user.avatarUrl} large />
              <I18n.div className="min-w-0">
                <I18n.h2 className="text-lg font-semibold"><I18n.Raw>{user.displayName}</I18n.Raw></I18n.h2>
                <I18n.p className="truncate text-xs text-muted">{contact?.email ?? "—"}</I18n.p>
                {contact?.phone ? <I18n.p className="text-xs text-muted">{contact.phone}</I18n.p> : null}
              </I18n.div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
              <div>
                <I18n.strong className="block text-lg">{user.activeListings}</I18n.strong>
                <I18n.span className="text-muted">Aktif ilan</I18n.span>
              </div>
              <div>
                <I18n.strong className="block text-lg">{user.soldListings}</I18n.strong>
                <I18n.span className="text-muted">Satılan</I18n.span>
              </div>
              <div>
                <I18n.strong className="block text-lg">{new Date(user.createdAt).getFullYear()}</I18n.strong>
                <I18n.span className="text-muted">Üyelik yılı</I18n.span>
              </div>
            </div>
            <I18n.p className="mt-4 text-xs text-muted"><I18n.Formatted kind="ratingLabel" args={[user.ratingAvg, user.ratingCount]} /></I18n.p>
            <I18n.div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge kind={status.kind}>{status.label}</Badge>
              {user.statusUntil ? <I18n.span className="text-[11px] text-muted">bitiş <I18n.Formatted kind="formatDate" args={[user.statusUntil]} /></I18n.span> : null}
              {user.phoneVerified ? <Badge kind="neutral">Telefon elle incelendi</Badge> : null}
              {user.role === "admin" ? <Badge kind="neutral">Yönetici</Badge> : null}
              {user.accountType === "store" ? (
                <Badge kind="accent">{user.storeVerified ? "Onaylı mağaza" : "Mağaza"}: <I18n.Raw>{user.storeName}</I18n.Raw></Badge>
              ) : null}
            </I18n.div>
            {user.role !== "admin" ? <SanctionButton userId={user.id} status={user.status} /> : null}
          </I18n.div>

          <I18n.div className="rounded-xl border border-border bg-surface p-5">
            <I18n.h3 className="mb-3 text-sm font-semibold">Hakkındaki şikayetler</I18n.h3>
            {reports && reports.length ? (
              <I18n.ul className="flex flex-col gap-2 text-xs">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <I18n.Link href={`/yonetim/sikayetler/${r.id}`} className="text-accent">
                      {r.reason}
                    </I18n.Link>
                    <I18n.span className="flex items-center gap-2 text-muted">
                      <I18n.Formatted kind="formatDate" args={[r.created_at]} />
                      <Badge kind={reportStatus[r.status].kind}>{reportStatus[r.status].label}</Badge>
                    </I18n.span>
                  </li>
                ))}
              </I18n.ul>
            ) : (
              <I18n.p className="text-xs text-muted">Bu kullanıcı hakkında şikayet yok.</I18n.p>
            )}
          </I18n.div>
        </div>

        <div className="flex flex-col gap-6">
          <I18n.div className="rounded-xl border border-border bg-surface p-5">
            <I18n.h3 className="mb-3 text-sm font-semibold">İlanları</I18n.h3>
            {listings && listings.length ? (
              <I18n.ul className="flex flex-col divide-y divide-border text-xs">
                {listings.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                    <I18n.Link href={`/yonetim/ilanlar/${l.id}`} className="min-w-0 truncate hover:text-accent">
                      <I18n.Raw>{l.title}</I18n.Raw>
                    </I18n.Link>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <I18n.span className="text-muted"><I18n.Formatted kind="formatPrice" args={[l.price, l.currency]} /></I18n.span>
                      <ListingStatusBadge status={l.status as ListingStatus} />
                    </span>
                  </li>
                ))}
              </I18n.ul>
            ) : (
              <I18n.p className="text-xs text-muted">Henüz ilanı yok.</I18n.p>
            )}
          </I18n.div>
          <I18n.div className="rounded-xl border border-border bg-surface p-5">
            <I18n.h3 className="mb-3 text-sm font-semibold">Aldığı değerlendirmeler</I18n.h3>
            {ratings && ratings.length ? (
              <I18n.ul className="flex flex-col divide-y divide-border text-xs">
                {ratings.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                    <I18n.span className="min-w-0">
                      <I18n.b className="text-accent">{"★".repeat(r.score)}</I18n.b>{" "}
                      <I18n.span className="text-muted">
                        {(one(r.rater) as { display_name: string } | null)?.display_name ? <I18n.Raw>{(one(r.rater) as { display_name: string } | null)?.display_name}</I18n.Raw> : "Silinmiş kullanıcı"} ·{" "}
                        <I18n.Formatted kind="formatDate" args={[r.created_at]} />
                      </I18n.span>
                      {r.comment ? <I18n.span className="mt-1 block"><I18n.Raw>{r.comment}</I18n.Raw></I18n.span> : null}
                    </I18n.span>
                    <DeleteRatingButton id={r.id} />
                  </li>
                ))}
              </I18n.ul>
            ) : (
              <I18n.p className="text-xs text-muted">Henüz değerlendirme almamış.</I18n.p>
            )}
          </I18n.div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <I18n.h3 className="mb-3 text-sm font-semibold">İşlem geçmişi</I18n.h3>
            <I18n.ul className="flex flex-col gap-3 text-xs text-muted">
              {history.slice(0, 20).map((h, i) => (
                <I18n.li key={i}>
                  <I18n.Formatted kind="formatDate" args={[h.at]} /> · {h.text}
                </I18n.li>
              ))}
            </I18n.ul>
          </div>
        </div>
      </div>
    </>
  );
}
