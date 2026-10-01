"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AttributeDef } from "../../../shared/attributes.ts";
import { CONDITIONS, CONDITION_INFO } from "../../../shared/constants.ts";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { api } from "@/lib/api/client";
import { resultsHref, toApiQuery, type WebParams } from "@/lib/search";
import { cn } from "@/lib/cn";

export type FilterCategory = { slug: string; name: string; nameEn: string | null; count?: number };

type Props = {
  base: string;
  params: WebParams;
  categorySlug?: string;
  parent?: FilterCategory | null;
  subcategories: FilterCategory[];
  attributes: AttributeDef[];
  regions: { name: string; side: string }[];
};

type Draft = Record<string, string>;

function toDraft(params: WebParams): Draft {
  const d: Draft = {};
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v.join(",") : v;
    if (value && k !== "sayfa") d[k] = value;
  }
  return d;
}

function useLabel() {
  const { locale, t } = useLocale();
  return {
    t,
    locale,
    attr: (a: AttributeDef) => (locale === "en" && a.labelEn ? a.labelEn : a.label),
    option: (o: { label: string; label_en?: string }) => (locale === "en" && o.label_en ? o.label_en : t(o.label)),
    cat: (c: FilterCategory) => (locale === "en" && c.nameEn ? c.nameEn : c.name),
  };
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <fieldset className="border-b border-border py-4 last:border-b-0">
      <legend className="contents">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between text-left text-[14px] font-semibold">
          {title}
          <Icon name={open ? "up" : "down"} className="h-4 w-4 text-muted" />
        </button>
      </legend>
      {open ? <div className="mt-3">{children}</div> : null}
    </fieldset>
  );
}

function CheckList({
  name,
  options,
  selected,
  onToggle,
  limit = 6,
}: {
  name: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
}) {
  const { t } = useLocale();
  const [all, setAll] = useState(false);
  const visible = all ? options : options.slice(0, limit);
  return (
    <div className="space-y-0.5">
      {visible.map((o) => (
        <label key={o.value} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1 text-[14px] hover:bg-brand-soft">
          <input
            type="checkbox"
            name={name}
            value={o.value}
            checked={selected.includes(o.value)}
            onChange={() => onToggle(o.value)}
            className="h-[18px] w-[18px] accent-[var(--accent)]"
          />
          <span className="min-w-0 flex-1 truncate">{o.label}</span>
        </label>
      ))}
      {options.length > limit ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 px-1 text-[13px] font-semibold text-accent">
          {all ? t("Daha az göster") : t(`${options.length - limit} seçenek daha`)}
        </button>
      ) : null}
    </div>
  );
}

function Range({
  minName,
  maxName,
  draft,
  set,
  unit,
  commit,
}: {
  minName: string;
  maxName: string;
  draft: Draft;
  set: (k: string, v: string) => void;
  unit?: string | null;
  commit: () => void;
}) {
  const { t } = useLocale();
  const input =
    "h-10 w-full min-w-0 rounded-field border border-border-strong bg-surface px-3 text-[14px] tabular focus:border-accent focus:outline-none";
  return (
    <div className="flex items-center gap-2">
      <input
        inputMode="decimal"
        aria-label={t("En az")}
        placeholder={t("En az")}
        value={draft[minName] ?? ""}
        onChange={(e) => set(minName, e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={input}
      />
      <span className="text-subtle">–</span>
      <input
        inputMode="decimal"
        aria-label={t("En çok")}
        placeholder={t("En çok")}
        value={draft[maxName] ?? ""}
        onChange={(e) => set(maxName, e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={input}
      />
      {unit ? <span className="flex-shrink-0 text-[13px] text-muted">{unit}</span> : null}
    </div>
  );
}

function FilterFields({ props, draft, setDraft, commit }: { props: Props; draft: Draft; setDraft: (d: Draft) => void; commit: (d?: Draft) => void }) {
  const L = useLabel();
  const set = (k: string, v: string) => setDraft({ ...draft, [k]: v });
  const toggleList = (k: string, v: string) => {
    const list = (draft[k] ?? "").split(",").filter(Boolean);
    const next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    const d = { ...draft, [k]: next.join(",") };
    setDraft(d);
    commit(d);
  };
  const setAndCommit = (k: string, v: string) => {
    const d = { ...draft, [k]: v };
    setDraft(d);
    commit(d);
  };

  return (
    <div>
      {props.subcategories.length || props.parent ? (
        <Section title={L.t("Kategori")}>
          <ul className="space-y-0.5">
            {props.parent ? (
              <li>
                <Link href={resultsHref(`/kategori/${props.parent.slug}`, props.params)} className="flex min-h-9 items-center gap-1.5 px-1 text-[14px] text-muted hover:text-text">
                  <Icon name="back" className="h-3.5 w-3.5" />
                  {L.cat(props.parent)}
                </Link>
              </li>
            ) : null}
            {props.subcategories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={resultsHref(`/kategori/${c.slug}`, props.params)}
                  className="flex min-h-9 items-center justify-between gap-2 rounded-md px-1 text-[14px] hover:bg-brand-soft"
                >
                  <span className="truncate">{L.cat(c)}</span>
                  {c.count ? <span className="text-[12px] text-subtle tabular">{c.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={L.t("Fiyat")}>
        <Range minName="min" maxName="max" draft={draft} set={set} commit={() => commit()} />
        <div className="mt-2.5 flex gap-1.5">
          {["", "TL", "€"].map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => setAndCommit("birim", c)}
              aria-pressed={(draft.birim ?? "") === c}
              className={cn(
                "h-8 rounded-pill border px-3 text-[13px] font-medium",
                (draft.birim ?? "") === c ? "border-brand bg-brand text-on-brand" : "border-border-strong hover:bg-brand-soft",
              )}
            >
              {c || L.t("Tümü")}
            </button>
          ))}
        </div>
      </Section>

      <Section title={L.t("Konum")}>
        <CheckList
          name="sehir"
          options={props.regions.map((r) => ({ value: r.name, label: r.name }))}
          selected={(draft.sehir ?? "").split(",").filter(Boolean)}
          onToggle={(v) => toggleList("sehir", v)}
          limit={8}
        />
      </Section>

      <Section title={L.t("Ürün durumu")}>
        <CheckList
          name="durum"
          options={CONDITIONS.map((c) => ({ value: c, label: L.locale === "en" ? CONDITION_INFO[c].en : c }))}
          selected={(draft.durum ?? "").split(",").filter(Boolean)}
          onToggle={(v) => toggleList("durum", v)}
        />
      </Section>

      {props.attributes.map((a) => {
        const key = `a.${a.key}`;
        if (a.type === "select" || a.type === "multiselect") {
          return (
            <Section key={a.key} title={L.attr(a)} defaultOpen={a.required || Boolean(draft[key])}>
              <CheckList
                name={key}
                options={a.options.map((o) => ({ value: o.value, label: L.option(o) }))}
                selected={(draft[key] ?? "").split(",").filter(Boolean)}
                onToggle={(v) => toggleList(key, v)}
              />
            </Section>
          );
        }
        if (a.type === "number" || a.type === "year") {
          return (
            <Section key={a.key} title={L.attr(a)} defaultOpen={Boolean(draft[`${key}.min`] || draft[`${key}.max`])}>
              <Range minName={`${key}.min`} maxName={`${key}.max`} draft={draft} set={set} unit={a.unit} commit={() => commit()} />
            </Section>
          );
        }
        if (a.type === "boolean") {
          return (
            <label key={a.key} className="flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-border text-[14px]">
              <input
                type="checkbox"
                checked={draft[key] === "1"}
                onChange={(e) => setAndCommit(key, e.target.checked ? "1" : "")}
                className="h-[18px] w-[18px] accent-[var(--accent)]"
              />
              {L.attr(a)}
            </label>
          );
        }
        return null;
      })}

      <Section title={L.t("İlan tarihi")} defaultOpen={Boolean(draft.tarih)}>
        <div className="space-y-0.5" role="radiogroup">
          {[
            ["", "Tümü"],
            ["1", "Son 24 saat"],
            ["7", "Son 7 gün"],
            ["30", "Son 30 gün"],
          ].map(([v, label]) => (
            <label key={v || "all"} className="flex min-h-9 cursor-pointer items-center gap-2.5 px-1 text-[14px]">
              <input type="radio" name="tarih" checked={(draft.tarih ?? "") === v} onChange={() => setAndCommit("tarih", v)} className="h-[18px] w-[18px] accent-[var(--accent)]" />
              {L.t(label)}
            </label>
          ))}
        </div>
      </Section>

      <Section title={L.t("Diğer")}>
        {[
          ["pazarlik", "Pazarlığa açık"],
          ["magaza", "Yalnızca mağazalar"],
          ["vitrin", "Yalnızca vitrin ilanları"],
        ].map(([k, label]) => (
          <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2.5 px-1 text-[14px]">
            <input
              type="checkbox"
              checked={draft[k] === "1"}
              onChange={(e) => setAndCommit(k, e.target.checked ? "1" : "")}
              className="h-[18px] w-[18px] accent-[var(--accent)]"
            />
            {L.t(label)}
          </label>
        ))}
      </Section>
    </div>
  );
}

function hrefFor(base: string, params: WebParams, draft: Draft) {
  const keep: WebParams = {};
  if (params.q) keep.q = params.q;
  if (params.sirala) keep.sirala = params.sirala;
  return resultsHref(base, keep, Object.fromEntries(Object.entries(draft).filter(([k]) => k !== "q" && k !== "sirala")));
}

/** Desktop sidebar: every change applies at once. */
export function FiltersSidebar(props: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [draft, setDraft] = useState(() => toDraft(props.params));
  const current = useMemo(() => JSON.stringify(toDraft(props.params)), [props.params]);
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setDraft(toDraft(props.params));
  }
  const commit = (d: Draft = draft) => start(() => router.push(hrefFor(props.base, props.params, d), { scroll: false }));
  return <FilterFields props={props} draft={draft} setDraft={setDraft} commit={commit} />;
}

/** Phones: a sheet with a live result count; nothing changes until "show results". */
export function FiltersButton(props: Props & { activeCount: number }) {
  const { t } = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(props.params));
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const q = toApiQuery({ ...draft, q: props.params.q as string | undefined }, props.categorySlug, 1);
      q.delete("facets");
      api
        .get<{ total: number }>(`/listings?${q}`, ctrl.signal)
        .then((r) => setCount(r.total))
        .catch(() => setCount(null));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [draft, open, props.categorySlug, props.params.q]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(toDraft(props.params));
          setOpen(true);
        }}
        className="flex h-10 items-center gap-2 rounded-button border border-border-strong px-3.5 text-[14px] font-semibold"
      >
        <Icon name="sliders" className="h-4 w-4" />
        {t("Filtrele")}
        {props.activeCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] text-on-accent">{props.activeCount}</span> : null}
      </button>
      <Sheet
        title="Filtrele"
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft({})}>
              {t("Temizle")}
            </Button>
            <Button
              full
              onClick={() => {
                setOpen(false);
                router.push(hrefFor(props.base, props.params, draft));
              }}
            >
              {count == null ? t("Sonuçları göster") : t(`${count.toLocaleString("tr-TR")} sonucu göster`)}
            </Button>
          </>
        }
      >
        <div className="px-5">
          <FilterFields props={props} draft={draft} setDraft={setDraft} commit={() => {}} />
        </div>
      </Sheet>
    </>
  );
}

export function SortSelect({ base, params }: { base: string; params: WebParams }) {
  const { t } = useLocale();
  const router = useRouter();
  const value = (params.sirala as string) ?? "";
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      <span className="hidden sm:inline">{t("Sırala")}</span>
      <select
        value={value}
        onChange={(e) => router.push(resultsHref(base, params, { sirala: e.target.value || undefined }))}
        aria-label={t("Sırala")}
        className="h-10 rounded-button border border-border-strong bg-surface px-3 text-[14px] font-medium text-text"
      >
        <option value="">{t("En yeni")}</option>
        <option value="artan">{t("Fiyat: düşükten yükseğe")}</option>
        <option value="azalan">{t("Fiyat: yüksekten düşüğe")}</option>
      </select>
    </label>
  );
}
