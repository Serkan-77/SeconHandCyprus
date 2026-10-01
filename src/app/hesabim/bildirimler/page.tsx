import type { Metadata } from "next";
import { Notifications } from "@/components/account/Notifications";
import { apiServer } from "@/lib/api/server";
import type { Notification } from "@/lib/api/types";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  const { items } = await apiServer<{ items: Notification[] }>("/me/notifications?pageSize=100").catch(() => ({ items: [] as Notification[] }));
  return <Notifications initial={items} />;
}
