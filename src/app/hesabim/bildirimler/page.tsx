import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/queries";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { deleteNotification, markAllNotificationsRead } from "@/lib/actions/account";

export const metadata = { title: "Bildirimler" };

const kindIcon: Record<string, IconName> = {
  message: "chat",
  price: "heart",
  listing: "check",
  rating: "star",
  account: "shield",
  announcement: "bell",
};

export default async function NotificationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/giris-gerekli?returnTo=/hesabim/bildirimler");
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", viewer.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">Bildirim merkezi</h1>
          <p className="mt-2 text-[13px] text-muted">
            {unread ? `${unread} okunmamış bildirimin var.` : "Tüm bildirimlerini okudun."}
          </p>
        </div>
        {unread ? (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="text-xs font-medium text-accent">
              Tümünü okundu işaretle
            </button>
          </form>
        ) : null}
      </div>

      {notifications && notifications.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border">
          {notifications.map((n) => {
            const body = (
              <>
                <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon name={kindIcon[n.kind] ?? "bell"} className="h-[18px] w-[18px]" />
                  {!n.read_at ? (
                    <i className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <b className={cn("text-[13px]", n.read_at && "font-medium")}>{n.title}</b>
                  {n.body ? <p className="mt-1 text-xs leading-relaxed text-muted">{n.body}</p> : null}
                </div>
                <span className="flex-shrink-0 text-[10px] text-muted">{timeAgo(n.created_at)}</span>
              </>
            );
            return (
              <div
                key={n.id}
                className={cn("group flex items-start gap-3.5 border-b border-border p-5 last:border-0", !n.read_at && "bg-bg")}
              >
                {n.link ? (
                  <Link href={n.link} className="flex min-w-0 flex-1 items-start gap-3.5">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">{body}</div>
                )}
                <form action={deleteNotification.bind(null, n.id)}>
                  <button type="submit" aria-label="Bildirimi sil" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-text">
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex h-[100px] w-[100px] -rotate-6 items-center justify-center rounded-[35px] bg-brand-soft text-brand">
            <Icon name="bell" className="h-11 w-11 rotate-6" />
          </span>
          <h2 className="text-xl font-semibold">Henüz bildirimin yok.</h2>
          <p className="max-w-xs text-sm text-muted">Mesajların ve ilanlarınla ilgili gelişmeler burada görünecek.</p>
        </div>
      )}
    </div>
  );
}
