
import * as I18n from "@/components/i18n/Localized";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Icon } from "@/components/icons";
import { getCategories } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kategoriler" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  const supabase = await createClient();
  const counts = await Promise.all(
    categories.map(async (c) => {
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("category_id", c.id);
      return count ?? 0;
    }),
  );
  return (
    <div className="mx-auto max-w-[1328px] px-4 pb-16 sm:px-6">
      <Breadcrumbs items={["Kategoriler"]} />
      <div className="mb-8">
        <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[32px]">Kategoriler</I18n.h1>
        <I18n.p className="mt-2 text-[13px] text-muted">
          Aradığın eşyaya en hızlı yoldan ulaş.
        </I18n.p>
      </div>
      <I18n.div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {categories.map((cat, i) => (
            <I18n.Link
              key={cat.slug}
              href={`/kategori/${cat.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border p-6 text-center text-sm transition hover:border-accent hover:bg-accent-soft"
            >
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-bg">
                <Icon name={cat.icon} className="h-7 w-7" strokeWidth={1.4} />
              </span>
              <I18n.b className="font-medium">{cat.name}</I18n.b>
              <I18n.small className="-mt-2 text-[11px] text-muted">{counts[i]} ilan</I18n.small>
            </I18n.Link>
          ))}
      </I18n.div>
    </div>
  );
}
