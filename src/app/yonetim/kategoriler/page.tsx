import { TaxonomyManager, type AdminAttribute, type AdminCategory } from "@/components/admin/TaxonomyManager";
import { apiServer } from "@/lib/api/server";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Kategoriler ve alanlar" };

export default async function AdminCategories() {
  const [{ t }, data] = await Promise.all([getI18n(), apiServer<{ categories: AdminCategory[]; attributes: AdminAttribute[] }>("/admin/categories")]);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Kategoriler ve alanlar")}</h1>
        <p className="mt-1 text-[14px] text-muted">
          {t("Alt kategoriler üst kategorinin alanlarını miras alır. Değişiklikler ilan formuna, filtrelere ve ilan sayfalarına bir dakika içinde yansır.")}
        </p>
      </div>
      <TaxonomyManager categories={data.categories} attributes={data.attributes} />
    </>
  );
}
