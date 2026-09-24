import { AdminShell } from "@/components/admin/AdminShell";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries";
import { CategoryManager } from "./CategoryManager";

export const metadata = { title: "Yönetim · Kategoriler", robots: { index: false } };

export default async function AdminCategoriesPage() {
  return (
    <AdminShell>
      <Categories />
    </AdminShell>
  );
}

async function Categories() {
  const supabase = await createClient();
  const categories = await getCategories();
  const counts = await Promise.all(
    categories.map(async (c) => {
      const { count } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("category_id", c.id);
      return count ?? 0;
    }),
  );
  return <CategoryManager categories={categories.map((c, i) => ({ ...c, listings: counts[i] }))} />;
}
