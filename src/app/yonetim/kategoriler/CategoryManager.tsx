"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { Icon, type IconName } from "@/components/icons";
import { deleteCategory, saveCategory } from "@/lib/actions/admin";

const iconChoices: IconName[] = ["sofa", "phone", "shirt", "car", "appliance", "baby", "bike", "book", "camera", "grid", "bag", "spark"];

type Row = { id: number; name: string; slug: string; icon: IconName; sortOrder: number; listings: number };

export function CategoryManager({ categories }: { categories: Row[] }) {
  const [editing, setEditing] = useState<(Omit<Row, "id" | "slug" | "listings"> & { id?: number }) | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Kategori yönetimi</h1>
          <p className="mt-1.5 text-xs text-muted">{categories.length} kategori.</p>
        </div>
        <Button
          full={false}
          icon={<Icon name="plus" className="h-4 w-4" />}
          onClick={() => {
            setError("");
            setEditing({ name: "", icon: "grid", sortOrder: categories.length + 1 });
          }}
        >
          Kategori ekle
        </Button>
      </div>

      {error && !editing ? <FormError>{error}</FormError> : null}

      <div className="overflow-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="bg-bg text-[10px] text-muted">
              <th className="p-3 font-medium">Sıra</th>
              <th className="p-3 font-medium">Ad</th>
              <th className="p-3 font-medium">Adres</th>
              <th className="p-3 font-medium">İlan sayısı</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-border last:border-0">
                <td className="p-3">{cat.sortOrder}</td>
                <td className="p-3 font-medium">
                  <span className="flex items-center gap-2">
                    <Icon name={cat.icon} className="h-4 w-4 text-muted" />
                    {cat.name}
                  </span>
                </td>
                <td className="p-3 text-muted">/{cat.slug}</td>
                <td className="p-3 text-muted">{cat.listings}</td>
                <td className="p-3">
                  <span className="flex gap-3">
                    <button
                      onClick={() => {
                        setError("");
                        setEditing({ id: cat.id, name: cat.name, icon: cat.icon, sortOrder: cat.sortOrder });
                      }}
                      className="text-[11px] font-medium text-accent"
                    >
                      Düzenle
                    </button>
                    <button
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteCategory(cat.id);
                          setError(result.error ?? "");
                        })
                      }
                      className="text-[11px] font-medium text-muted hover:text-danger"
                    >
                      Sil
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title={editing?.id ? "Kategori düzenle" : "Kategori ekle"} open={editing !== null} onClose={() => setEditing(null)}>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              startTransition(async () => {
                const result = await saveCategory({
                  id: editing.id,
                  name: String(form.get("name") ?? ""),
                  icon: editing.icon,
                  sortOrder: Number(form.get("order") ?? 0),
                });
                if (result.error) setError(result.error);
                else {
                  setError("");
                  setEditing(null);
                }
              });
            }}
            className="flex flex-col gap-4"
          >
            <Field label="Kategori adı" name="name" defaultValue={editing.name} required minLength={2} />
            <Field label="Sıra" name="order" type="number" defaultValue={editing.sortOrder} />
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">İkon</legend>
              <div className="grid grid-cols-6 gap-2">
                {iconChoices.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={icon}
                    aria-pressed={editing.icon === icon}
                    onClick={() => setEditing({ ...editing, icon })}
                    className={
                      "grid h-11 place-items-center rounded-lg border " +
                      (editing.icon === icon ? "border-brand bg-brand text-on-brand" : "border-border")
                    }
                  >
                    <Icon name={icon} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </fieldset>
            {error ? <FormError>{error}</FormError> : null}
            <Button type="submit" disabled={pending}>
              Kaydet
            </Button>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
