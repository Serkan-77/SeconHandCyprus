"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Field, controlClass } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";

export type AdminCategory = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  nameEn: string | null;
  icon: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  listingCount: number;
};

export type AdminAttribute = {
  id: number;
  categoryId: number | null;
  key: string;
  label: string;
  labelEn: string | null;
  type: "text" | "number" | "select" | "multiselect" | "boolean" | "year";
  unit: string | null;
  options: { value: string; label: string; label_en?: string }[];
  required: boolean;
  filterable: boolean;
  highlight: boolean;
  minValue: number | null;
  maxValue: number | null;
  maxLength: number | null;
  placeholder: string | null;
  help: string | null;
  groupName: string;
  sortOrder: number;
  isActive: boolean;
};

const TYPES = [
  ["select", "Tek seçim"],
  ["multiselect", "Çoklu seçim"],
  ["text", "Metin"],
  ["number", "Sayı"],
  ["year", "Yıl"],
  ["boolean", "Evet / hayır"],
] as const;
const GROUPS = ["Genel", "Teknik", "Ölçü & Malzeme", "Özellikler", "Durum", "Teslimat"];

const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function CategoryDialog({
  initial,
  categories,
  onClose,
}: {
  initial: Partial<AdminCategory> & { parentId: number | null };
  categories: AdminCategory[];
  onClose: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: initial.name ?? "",
    nameEn: initial.nameEn ?? "",
    slug: initial.slug ?? "",
    parentId: initial.parentId,
    icon: initial.icon ?? "grid",
    description: initial.description ?? "",
    sortOrder: initial.sortOrder ?? 0,
    isActive: initial.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(initial.id);
  return (
    <Modal title={editing ? "Kategoriyi düzenle" : "Kategori ekle"} open onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const body = { ...form, slug: editing ? undefined : form.slug || slugify(form.name), description: form.description || undefined, nameEn: form.nameEn || undefined };
            if (editing) await api.put(`/admin/categories/${initial.id}`, body);
            else await api.post("/admin/categories", body);
            toast.show("Kategori kaydedildi.");
            onClose();
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ad (Türkçe)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Field label="Ad (İngilizce)" optional value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </div>
        {editing ? (
          <p className="text-[13px] text-muted">
            {t("Adres:")} <code>/kategori/{initial.slug}</code> {t("(adres değiştirilemez)")}
          </p>
        ) : (
          <Field label="Adres" value={form.slug} placeholder={slugify(form.name)} onChange={(e) => setForm({ ...form, slug: e.target.value })} hint="Boş bırakırsan addan üretilir. Sonradan değiştirilemez." />
        )}
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          {t("Üst kategori")}
          <select value={form.parentId ?? ""} onChange={(e) => setForm({ ...form, parentId: e.target.value ? Number(e.target.value) : null })} className={controlClass}>
            <option value="">{t("— Ana kategori —")}</option>
            {categories
              .filter((c) => c.id !== initial.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? "— " : ""}
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Simge" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} hint="Örn. phone, sofa, laptop" />
          <Field label="Sıra" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
        </div>
        <Field label="Açıklama (SEO)" optional value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
          {t("Sitede görünsün")}
        </label>
        {error ? <FormError>{error}</FormError> : null}
        <Button type="submit" loading={busy}>
          {t("Kaydet")}
        </Button>
      </form>
    </Modal>
  );
}

function AttributeDialog({ initial, categoryId, onClose }: { initial: Partial<AdminAttribute>; categoryId: number | null; onClose: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial.id);
  const [form, setForm] = useState({
    key: initial.key ?? "",
    label: initial.label ?? "",
    labelEn: initial.labelEn ?? "",
    type: initial.type ?? "select",
    unit: initial.unit ?? "",
    options: initial.options ?? [],
    required: initial.required ?? false,
    filterable: initial.filterable ?? true,
    highlight: initial.highlight ?? false,
    min: initial.minValue ?? null,
    max: initial.maxValue ?? null,
    maxLength: initial.maxLength ?? null,
    placeholder: initial.placeholder ?? "",
    help: initial.help ?? "",
    group: initial.groupName ?? "Özellikler",
    sortOrder: initial.sortOrder ?? 50,
    isActive: initial.isActive ?? true,
  });
  const [optionText, setOptionText] = useState((initial.options ?? []).map((o) => (o.label_en ? `${o.label} | ${o.label_en}` : o.label)).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasOptions = form.type === "select" || form.type === "multiselect";
  const numeric = form.type === "number" || form.type === "year";

  return (
    <Modal title={editing ? "Alanı düzenle" : "Alan ekle"} open onClose={onClose} size="lg">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          // Existing option values are kept so stored listings keep matching.
          const previous = new Map((initial.options ?? []).map((o) => [o.label, o.value]));
          const options = hasOptions
            ? optionText
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const [label, labelEn] = line.split("|").map((s) => s.trim());
                  return { value: previous.get(label) ?? slugify(label), label, ...(labelEn ? { label_en: labelEn } : {}) };
                })
            : [];
          try {
            const body = { ...form, categoryId, options, key: form.key || slugify(form.label).replace(/-/g, "_"), unit: form.unit || undefined, labelEn: form.labelEn || undefined, placeholder: form.placeholder || undefined, help: form.help || undefined };
            if (editing) await api.put(`/admin/attributes/${initial.id}`, body);
            else await api.post("/admin/attributes", body);
            toast.show("Alan kaydedildi.");
            onClose();
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Etiket (Türkçe)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
          <Field label="Etiket (İngilizce)" optional value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })} />
          <Field
            label="Anahtar"
            value={form.key}
            disabled={editing}
            placeholder={slugify(form.label).replace(/-/g, "_")}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            hint="İlan verisinde saklanan ad; sonradan değiştirilemez."
          />
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("Tür")}
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AdminAttribute["type"] })} className={controlClass}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("Grup")}
            <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={controlClass}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <Field label="Sıra" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          {numeric ? (
            <>
              <Field label="Birim" optional value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="GB, cm, %" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="En az" type="number" value={form.min ?? ""} onChange={(e) => setForm({ ...form, min: e.target.value === "" ? null : Number(e.target.value) })} />
                <Field label="En çok" type="number" value={form.max ?? ""} onChange={(e) => setForm({ ...form, max: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </>
          ) : null}
          {form.type === "text" ? <Field label="En fazla karakter" type="number" value={form.maxLength ?? ""} onChange={(e) => setForm({ ...form, maxLength: e.target.value === "" ? null : Number(e.target.value) })} /> : null}
        </div>
        {hasOptions ? (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            {t("Seçenekler (her satıra bir tane; İngilizce için “Türkçe | English”)")}
            <textarea value={optionText} onChange={(e) => setOptionText(e.target.value)} rows={7} className={`${controlClass} py-2 font-mono text-[13px]`} />
          </label>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Yer tutucu" optional value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} />
          <Field label="Yardım metni" optional value={form.help} onChange={(e) => setForm({ ...form, help: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {(
            [
              ["required", "Zorunlu"],
              ["filterable", "Filtrelerde göster"],
              ["highlight", "Kartlarda öne çıkar"],
              ["isActive", "Etkin"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
              {t(l)}
            </label>
          ))}
        </div>
        {error ? <FormError>{error}</FormError> : null}
        <Button type="submit" loading={busy}>
          {t("Kaydet")}
        </Button>
      </form>
    </Modal>
  );
}

export function TaxonomyManager({ categories, attributes }: { categories: AdminCategory[]; attributes: AdminAttribute[] }) {
  const { t } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<number | null>(categories.find((c) => !c.parentId)?.id ?? null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [catDialog, setCatDialog] = useState<(Partial<AdminCategory> & { parentId: number | null }) | null>(null);
  const [attrDialog, setAttrDialog] = useState<Partial<AdminAttribute> | null>(null);
  const byParent = useMemo(() => {
    const m = new Map<number | null, AdminCategory[]>();
    for (const c of categories) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    for (const list of m.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));
    return m;
  }, [categories]);
  const current = categories.find((c) => c.id === selected) ?? null;
  const chain = useMemo(() => {
    const out: AdminCategory[] = [];
    let c = current;
    while (c) {
      out.unshift(c);
      c = c.parentId ? (categories.find((x) => x.id === c!.parentId) ?? null) : null;
    }
    return out;
  }, [current, categories]);
  const own = attributes.filter((a) => a.categoryId === (current?.id ?? null)).sort((a, b) => a.sortOrder - b.sortOrder);
  const inheritedLevels = [null, ...chain.slice(0, -1).map((c) => c.id)];
  const inherited = attributes.filter((a) => inheritedLevels.includes(a.categoryId) && a.isActive && !own.some((o) => o.key === a.key));

  function Tree({ parent, depth }: { parent: number | null; depth: number }) {
    return (
      <ul>
        {(byParent.get(parent) ?? []).map((c) => {
          const kids = byParent.get(c.id) ?? [];
          const expanded = open.has(c.id);
          return (
            <li key={c.id}>
              <div className={cn("flex items-center gap-1 rounded-button pr-2", selected === c.id ? "bg-brand text-on-brand" : "hover:bg-brand-soft")} style={{ paddingLeft: depth * 16 }}>
                <button
                  type="button"
                  aria-label={t(expanded ? "Daralt" : "Genişlet")}
                  onClick={() => setOpen((s) => new Set(s.has(c.id) ? [...s].filter((x) => x !== c.id) : [...s, c.id]))}
                  className={cn("grid h-8 w-8 place-items-center", !kids.length && "invisible")}
                >
                  <Icon name={expanded ? "down" : "chevron"} className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setSelected(c.id)} className="flex min-h-9 flex-1 items-center gap-2 text-left text-[14px]">
                  <Icon name={c.icon as IconName} className="h-4 w-4 opacity-70" />
                  <span className={cn("flex-1 truncate", !c.isActive && "line-through opacity-60")}>{c.name}</span>
                  <span className="text-[12px] opacity-60 tabular">{c.listingCount}</span>
                </button>
              </div>
              {expanded && kids.length ? <Tree parent={c.id} depth={depth + 1} /> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <section className="rounded-card border border-border p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-semibold">{t("Kategoriler")}</h2>
          <Button size="sm" variant="outline" onClick={() => setCatDialog({ parentId: null })} icon={<Icon name="plus" className="h-4 w-4" />}>
            {t("Ana kategori")}
          </Button>
        </div>
        <button type="button" onClick={() => setSelected(null)} className={cn("mb-1 flex min-h-9 w-full items-center gap-2 rounded-button px-3 text-left text-[14px]", selected === null ? "bg-brand text-on-brand" : "hover:bg-brand-soft")}>
          <Icon name="globe" className="h-4 w-4 opacity-70" />
          {t("Tüm kategorilerde geçerli alanlar")}
        </button>
        <Tree parent={null} depth={0} />
      </section>

      <section className="flex flex-col gap-5">
        {current ? (
          <div className="rounded-card border border-border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">{chain.map((c) => c.name).join(" › ")}</p>
                <h2 className="text-xl font-bold">{current.name}</h2>
                <p className="text-[13px] text-muted">
                  /kategori/{current.slug} · {t(`${current.listingCount} ilan`)} {current.isActive ? "" : `· ${t("gizli")}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setCatDialog(current)} icon={<Icon name="edit" className="h-4 w-4" />}>
                  {t("Düzenle")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCatDialog({ parentId: current.id })} icon={<Icon name="plus" className="h-4 w-4" />}>
                  {t("Alt kategori")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={async () => {
                    try {
                      await api.del(`/admin/categories/${current.id}`);
                      toast.show("Kategori silindi.");
                      setSelected(current.parentId);
                      router.refresh();
                    } catch (e) {
                      toast.show(errorMessage(e), { tone: "error" });
                    }
                  }}
                >
                  {t("Sil")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-card border border-border p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t(current ? "Bu kategorinin alanları" : "Tüm kategorilerde geçerli alanlar")}</h2>
            <Button size="sm" onClick={() => setAttrDialog({})} icon={<Icon name="plus" className="h-4 w-4" />}>
              {t("Alan ekle")}
            </Button>
          </div>
          {own.length ? (
            <ul className="divide-y divide-border">
              {own.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className={cn("font-medium", !a.isActive && "line-through opacity-60")}>{a.label}</span>{" "}
                    <code className="text-[12px] text-muted">{a.key}</code>
                    <span className="block text-[12px] text-muted">
                      {t(TYPES.find(([v]) => v === a.type)?.[1] ?? a.type)} · {t(a.groupName)}
                      {a.required ? ` · ${t("zorunlu")}` : ""}
                      {a.filterable ? ` · ${t("filtre")}` : ""}
                      {a.options.length ? ` · ${t(`${a.options.length} seçenek`)}` : ""}
                      {!a.isActive && inheritedLevels.length > 1 ? ` · ${t("miras alanı gizliyor")}` : ""}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setAttrDialog(a)}>
                    {t("Düzenle")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={async () => {
                      try {
                        await api.del(`/admin/attributes/${a.id}`);
                        router.refresh();
                      } catch (e) {
                        toast.show(errorMessage(e), { tone: "error" });
                      }
                    }}
                  >
                    {t("Sil")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">{t("Bu seviyede tanımlı alan yok.")}</p>
          )}
        </div>

        {current && inherited.length ? (
          <div className="rounded-card border border-border p-5">
            <h2 className="mb-1 font-semibold">{t("Üst kategorilerden gelen alanlar")}</h2>
            <p className="mb-3 text-[13px] text-muted">{t("Bu kategoride görünmesini istemediğin bir alanı gizleyebilirsin; üst kategoride değişmez.")}</p>
            <ul className="divide-y divide-border">
              {inherited.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-[14px]">
                    {a.label} <code className="text-[12px] text-muted">{a.key}</code>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.post("/admin/attributes", { categoryId: current.id, key: a.key, label: a.label, type: "text", isActive: false });
                        toast.show("Alan bu kategoride gizlendi.");
                        router.refresh();
                      } catch (e) {
                        toast.show(errorMessage(e), { tone: "error" });
                      }
                    }}
                  >
                    {t("Burada gizle")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {catDialog ? <CategoryDialog initial={catDialog} categories={categories} onClose={() => setCatDialog(null)} /> : null}
      {attrDialog ? <AttributeDialog initial={attrDialog} categoryId={current?.id ?? null} onClose={() => setAttrDialog(null)} /> : null}
    </div>
  );
}
