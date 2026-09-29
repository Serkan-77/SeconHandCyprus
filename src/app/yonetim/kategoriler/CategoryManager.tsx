"use client";
import * as I18n from "@/components/i18n/Localized";


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
          <I18n.h1 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Kategori yönetimi</I18n.h1>
          <I18n.p className="mt-1.5 text-xs text-muted">{categories.length} kategori.</I18n.p>
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
              <I18n.th className="p-3 font-medium">Sıra</I18n.th>
              <I18n.th className="p-3 font-medium">Ad</I18n.th>
              <I18n.th className="p-3 font-medium">Adres</I18n.th>
              <I18n.th className="p-3 font-medium">İlan sayısı</I18n.th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <I18n.tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-b border-border last:border-0">
                <I18n.td className="p-3">{cat.sortOrder}</I18n.td>
                <td className="p-3 font-medium">
                  <I18n.span className="flex items-center gap-2">
                    <Icon name={cat.icon} className="h-4 w-4 text-muted" />
                    {cat.name}
                  </I18n.span>
                </td>
                <I18n.td className="p-3 text-muted">/{cat.slug}</I18n.td>
                <I18n.td className="p-3 text-muted">{cat.listings}</I18n.td>
                <td className="p-3">
                  <span className="flex gap-3">
                    <I18n.button
                      onClick={() => {
                        setError("");
                        setEditing({ id: cat.id, name: cat.name, icon: cat.icon, sortOrder: cat.sortOrder });
                      }}
                      className="text-[11px] font-medium text-accent"
                    >
                      Düzenle
                    </I18n.button>
                    <I18n.button
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
                    </I18n.button>
                  </span>
                </td>
              </tr>
            ))}
          </I18n.tbody>
        </table>
      </div>

      <Modal title={editing?.id ? "Kategori düzenle" : "Kategori ekle"} open={editing !== null} onClose={() => setEditing(null)}>
        {editing ? (
          <I18n.form
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
              <I18n.legend className="mb-2 text-[13px] font-semibold">İkon</I18n.legend>
              <I18n.div className="grid grid-cols-6 gap-2">
                {iconChoices.map((icon) => (
                  <I18n.button
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
                  </I18n.button>
                ))}
              </I18n.div>
            </fieldset>
            {error ? <FormError>{error}</FormError> : null}
            <Button type="submit" disabled={pending}>
              Kaydet
            </Button>
          </I18n.form>
        ) : null}
      </Modal>
    </>
  );
}
