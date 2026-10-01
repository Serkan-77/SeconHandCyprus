"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { highlightFacts, specificationGroups, validateAttributes, type AttributeDef } from "@shared/attributes";
import { CONDITIONS, CONDITION_INFO, LIMITS, type Condition } from "@shared/constants";
import { priceSchema } from "@shared/schemas";
import { Icon } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormError, Notice } from "@/components/ui/FormError";
import { controlClass } from "@/components/ui/Field";
import { MediaImage } from "@/components/ui/MediaImage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AttributeFields } from "@/components/sell/AttributeFields";
import { CategoryPicker } from "@/components/sell/CategoryPicker";
import { PhotoManager } from "@/components/sell/PhotoManager";
import { api } from "@/lib/api/client";
import { ApiRequestError, errorMessage } from "@/lib/api/errors";
import type { Category, Region } from "@/lib/api/types";
import { applyDraftPatch, draftStorageKey, emptyDraft, hasContent, parseDraft, type ListingDraft } from "@/lib/listingDraft";
import { attributesFor, categoryLabel, chainOf, childrenOf } from "@/lib/taxonomy";
import { formatLocalized } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { SHELL } from "@/lib/layout";
import { ListingCard } from "@/components/ListingCard";
import type { ListingCard as Card } from "@/lib/api/types";

const STEPS = ["Kategori", "Fotoğraflar", "Ürün bilgileri", "Fiyat ve konum", "Önizleme"] as const;
const DELIVERY_GROUP = "Teslimat";

type Props = {
  userId: string;
  categories: Category[];
  attributes: AttributeDef[];
  regions: Region[];
  defaultCity: string | null;
  restricted: boolean;
};

export function SellWizard({ userId, categories, attributes, regions, defaultCity, restricted }: Props) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const storageKey = draftStorageKey(userId);
  // Rendered client-only (see SellWizardClient), so the saved draft can be
  // read while initialising state. A saved draft is offered, not restored silently.
  const [saved] = useState<ListingDraft>(() => {
    try {
      return parseDraft(window.localStorage.getItem(storageKey));
    } catch {
      return emptyDraft;
    }
  });
  const [draft, setDraftState] = useState<ListingDraft>(() => ({ ...emptyDraft, city: defaultCity ?? "" }));
  const [resumeOffer, setResumeOffer] = useState<ListingDraft | null>(() => (hasContent(saved) ? saved : null));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState<{ id: string; slug: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // Autosave.
  useEffect(() => {
    if (resumeOffer || done) return;
    try {
      if (hasContent(draft) || draft.categoryId) window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {}
  }, [draft, resumeOffer, done, storageKey]);

  const set = (patch: Partial<ListingDraft>) => setDraftState((d) => applyDraftPatch(d, patch));
  const setAttr = (key: string, value: unknown) =>
    setDraftState((d) => {
      const next = { ...d.attributes };
      if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) delete next[key];
      else next[key] = value;
      return applyDraftPatch(d, { attributes: next });
    });

  const defs = useMemo(() => (draft.categoryId ? attributesFor(categories, attributes, draft.categoryId) : []), [categories, attributes, draft.categoryId]);
  const detailDefs = defs.filter((d) => d.group !== DELIVERY_GROUP);
  const requiredDefs = detailDefs.filter((d) => d.required);
  const optionalDefs = detailDefs.filter((d) => !d.required);
  const deliveryDefs = defs.filter((d) => d.group === DELIVERY_GROUP);
  const chain = draft.categoryId ? chainOf(categories, draft.categoryId) : [];

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!draft.categoryId) e.category = t("Bir kategori seç.");
      else if (childrenOf(categories.filter((c) => c.isActive), draft.categoryId).length) e.category = t("Bir alt kategori seç.");
    }
    if (s === 1 && !draft.photos.length) e.photos = t("En az 1 fotoğraf ekle.");
    if (s === 2) {
      const title = draft.title.trim();
      if (title.length < LIMITS.titleMin) e.title = t("Başlık en az 3 karakter olmalı.");
      else if (title.length > LIMITS.titleMax) e.title = t("Başlık en fazla 120 karakter olabilir.");
      if (!draft.condition) e.condition = t("Ürün durumunu seç.");
      if (draft.description.length > LIMITS.descriptionMax) e.description = t("Açıklama en fazla 5000 karakter olabilir.");
      const { errors: attrErrors } = validateAttributes(detailDefs, draft.attributes);
      for (const [k, v] of Object.entries(attrErrors)) e[`attr.${k}`] = t(v);
    }
    if (s === 3) {
      const price = priceSchema.safeParse(normalizePrice(draft.price));
      if (!price.success) e.price = t(price.error.issues[0]?.message ?? "Geçerli bir fiyat gir.");
      if (!draft.city) e.city = t("Bölge seç.");
      if (draft.district.length > LIMITS.districtMax) e.district = t("Semt en fazla 60 karakter olabilir.");
      const { errors: attrErrors } = validateAttributes(deliveryDefs, draft.attributes);
      for (const [k, v] of Object.entries(attrErrors)) e[`attr.${k}`] = t(v);
    }
    return e;
  }

  function go(to: number) {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = validate(s);
        if (Object.keys(e).length) {
          setErrors(e);
          setStep(s);
          requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true], [data-error=true]")?.focus());
          return;
        }
      }
    }
    setErrors({});
    setSubmitError("");
    setStep(to);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function publish() {
    for (let s = 0; s < 4; s++) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    const key = draft.submissionKey || crypto.randomUUID();
    if (!draft.submissionKey) set({ submissionKey: key });
    setPublishing(true);
    setSubmitError("");
    try {
      const { values } = validateAttributes(defs, draft.attributes);
      const { listing } = await api.post<{ listing: { id: string; slug: string } }>("/listings", {
        title: draft.title.trim(),
        categoryId: draft.categoryId,
        condition: draft.condition,
        description: draft.description.trim(),
        price: normalizePrice(draft.price),
        currency: draft.currency,
        city: draft.city,
        district: draft.district.trim(),
        negotiable: draft.negotiable,
        submissionKey: key,
        attributes: values,
        photos: draft.photos.map((p) => p.key),
      });
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
      setDone(listing);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiRequestError && e.fields) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.fields)) mapped[k.startsWith("attributes.") ? `attr.${k.slice(11)}` : k] = v;
        setErrors(mapped);
      }
      setSubmitError(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  }

  if (restricted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Notice tone="warning">{t("Hesabın kısıtlıyken yeni ilan veremezsin.")}</Notice>
        <LinkButton href="/hesap-kisitlandi" variant="outline" className="mt-4">
          {t("Ayrıntılar")}
        </LinkButton>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="check" className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">{t("İlanın incelemeye gönderildi")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {t("Ekibimiz kısa bir kontrol yapıp yayına alacak. Yayına girince bildirim göndereceğiz.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LinkButton href={`/ilan/${done.slug}`}>{t("İlanı görüntüle")}</LinkButton>
          <LinkButton href="/hesabim/ilanlar" variant="outline">
            {t("İlanlarım")}
          </LinkButton>
          <Button
            variant="ghost"
            onClick={() => {
              setDone(null);
              setDraftState({ ...emptyDraft, city: defaultCity ?? "" });
              setStep(0);
            }}
          >
            {t("Yeni ilan ver")}
          </Button>
        </div>
      </div>
    );
  }

  if (resumeOffer) {
    const cat = resumeOffer.categoryId ? categories.find((c) => c.id === resumeOffer.categoryId) : null;
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <div className="rounded-card border border-border p-6">
          <h1 className="text-xl font-bold">{t("Yarım kalan bir ilanın var")}</h1>
          <p className="mt-2 text-[14px] text-muted">{t("Kaldığın yerden devam edebilir ya da baştan başlayabilirsin.")}</p>
          <div className="mt-4 flex items-center gap-3 rounded-button bg-bg p-3">
            <span className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-brand-soft">
              {resumeOffer.photos[0] ? <MediaImage urls={resumeOffer.photos[0].urls} alt="" max="sm" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{resumeOffer.title || t("Başlıksız ilan")}</span>
              <span className="block truncate text-[13px] text-muted">
                {cat ? categoryLabel(cat, locale) : t("Kategori seçilmedi")} · {t(`${resumeOffer.photos.length} fotoğraf`)}
              </span>
            </span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setDraftState(resumeOffer);
                setResumeOffer(null);
                const firstIncomplete = [0, 1, 2, 3].find((s) => !stepLooksDone(resumeOffer, s)) ?? 4;
                setStep(firstIncomplete);
              }}
            >
              {t("Devam et")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  window.localStorage.removeItem(storageKey);
                } catch {}
                setResumeOffer(null);
                setDraftState({ ...emptyDraft, city: defaultCity ?? "" });
              }}
            >
              {t("Baştan başla")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const priceNumber = Number(normalizePrice(draft.price));

  const facts = highlightFacts(detailDefs, draft.attributes, locale, 2);
  const previewCard: Card = {
    id: "preview",
    refNo: 0,
    slug: "",
    title: draft.title.trim() || t("Başlık burada görünecek"),
    price: Number.isFinite(priceNumber) ? priceNumber : 0,
    currency: draft.currency,
    city: draft.city || t("Bölge"),
    district: draft.district || null,
    condition: draft.condition,
    status: "active",
    featured: false,
    negotiable: draft.negotiable,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    category: null,
    image: draft.photos[0]?.urls ?? null,
    photoCount: draft.photos.length,
    facts,
    factsEn: facts,
    seller: { id: "", name: "", isStore: false, storeVerified: false },
  };
  const summary = [
    chain.length ? chain.map((c) => categoryLabel(c, locale)).join(" › ") : "",
    draft.photos.length ? t(`${draft.photos.length} fotoğraf`) : "",
    draft.title.trim(),
    draft.price ? `${Number.isFinite(priceNumber) ? formatLocalized("formatPrice", [priceNumber, draft.currency], locale) : draft.price}${draft.city ? ` · ${draft.city}` : ""}` : "",
    "",
  ];
  const STEP_HINT = [
    "Doğru kategori, alıcıların seni filtrelerle bulmasını sağlar.",
    "İlk fotoğraf kapak olur; ürünün tamamını göstersin.",
    "Alıcıların ilk soracağı şeyler.",
    "Bölge ve fiyat, alıcıların ilk filtresi.",
    "İlan alıcılara böyle görünecek.",
  ];

  return (
    <div ref={top} className="scroll-mt-32 pb-32">
      <div className={cn(SHELL, "grid gap-8 pt-5 sm:pt-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_320px] xl:gap-12")}>
        {/* Stepper */}
        <aside className="hidden lg:block">
          <div className="sticky top-[150px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("Yeni ilan")}</p>
            <ol className="relative mt-4" aria-label={t("İlerleme")}>
              <span className="absolute bottom-5 left-[17px] top-5 w-px bg-border" aria-hidden />
              {STEPS.map((label, i) => {
                const doneStep = i < step;
                const current = i === step;
                return (
                  <li key={label} className="relative">
                    <button
                      type="button"
                      onClick={() => go(i)}
                      disabled={i > step + 1}
                      aria-current={current ? "step" : undefined}
                      className="group flex w-full items-start gap-3 py-2.5 text-left disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          "relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[14px] font-bold tabular ring-4 ring-surface",
                          current ? "bg-brand text-on-brand" : doneStep ? "bg-accent text-on-accent" : "border border-border-strong bg-surface text-muted",
                        )}
                      >
                        {doneStep ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className="min-w-0 pt-1">
                        <span className={cn("block text-[15px]", current ? "font-bold" : doneStep ? "font-semibold" : "text-muted")}>{t(label)}</span>
                        {summary[i] && doneStep ? <span className="block truncate text-[12.5px] text-muted">{summary[i]}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
              <Icon name="check" className="h-4 w-4 text-success" />
              {t("Taslağın bu cihazda otomatik kaydediliyor.")}
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          {/* Step header (all sizes); segmented progress on phones */}
          <div className="lg:hidden">
            <div className="flex gap-1" aria-hidden>
              {STEPS.map((label, i) => (
                <span key={label} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-accent" : i === step ? "bg-brand" : "bg-border")} />
              ))}
            </div>
          </div>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted lg:mt-0" aria-live="polite">
            {t(`Adım ${step + 1} / ${STEPS.length}`)}
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.025em] sm:text-[36px]">{t(step === 0 ? "Ne satıyorsun?" : STEPS[step])}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{t(STEP_HINT[step])}</p>

      <div className="mt-7">
        {step === 0 ? (
          <section>
            {errors.category ? <p className="mt-3 text-[13px] font-medium text-danger" data-error="true">{errors.category}</p> : null}
            <div className="mt-4">
              <CategoryPicker
                categories={categories}
                value={draft.categoryId}
                onSelect={(id) => {
                  // Attributes of the old category that the new one lacks are dropped.
                  const keep = new Set(attributesFor(categories, attributes, id).map((a) => a.key));
                  set({ categoryId: id, attributes: Object.fromEntries(Object.entries(draft.attributes).filter(([k]) => keep.has(k))) });
                  setErrors({});
                  setStep(1);
                  top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <p className="mb-4 text-[14px] text-muted">{t("Gün ışığında, ürünün tamamını ve varsa kusurlarını gösteren fotoğraflar en hızlı satar.")}</p>
            <PhotoManager photos={draft.photos} onChange={(photos) => set({ photos })} error={errors.photos} />
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-col gap-6">
            <p className="-mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[13px] font-medium">
              <Icon name="grid" className="h-3.5 w-3.5" />
              {chain.map((c) => categoryLabel(c, locale)).join(" › ")}
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-[13px] font-semibold">
                {t("Başlık")} <span className="text-danger">*</span>
              </label>
              <input
                id="title"
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                maxLength={LIMITS.titleMax}
                placeholder={t("Örn. Az kullanılmış 3'lü kanepe, gri")}
                aria-invalid={Boolean(errors.title)}
                className={controlClass}
              />
              <p className={cn("flex justify-between text-[12px]", errors.title ? "font-medium text-danger" : "text-muted")}>
                <span>{errors.title ?? t("Marka, model ve en önemli özelliği yaz.")}</span>
                <span className="tabular">{draft.title.length}/{LIMITS.titleMax}</span>
              </p>
            </div>

            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">
                {t("Durum")} <span className="text-danger">*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
                {CONDITIONS.map((c) => (
                  <label
                    key={c}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-card border p-3.5 transition",
                      draft.condition === c ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="radio"
                        name="condition"
                        value={c}
                        checked={draft.condition === c}
                        onChange={() => set({ condition: c })}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      {locale === "en" ? CONDITION_INFO[c as Condition].en : c}
                    </span>
                    <span className="text-[12px] leading-snug text-muted">{locale === "en" ? CONDITION_INFO[c as Condition].hintEn : CONDITION_INFO[c as Condition].hint}</span>
                  </label>
                ))}
              </div>
              {errors.condition ? <p className="mt-2 text-[12px] font-medium text-danger">{errors.condition}</p> : null}
            </fieldset>

            {requiredDefs.length ? (
              <AttributeFields defs={requiredDefs} values={draft.attributes} onChange={setAttr} errors={prefixed(errors)} />
            ) : null}

            {optionalDefs.length ? (
              <details className="group rounded-card border border-border" open={optionalDefs.some((d) => draft.attributes[d.key] !== undefined || errors[`attr.${d.key}`])}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">
                  <span>
                    {t("Daha fazla özellik")}
                    <span className="ml-2 text-[13px] font-normal text-muted">{t("Alıcılar filtrelerken bunları kullanır")}</span>
                  </span>
                  <Icon name="down" className="h-4 w-4 text-muted transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-border p-4">
                  <AttributeFields defs={optionalDefs} values={draft.attributes} onChange={setAttr} errors={prefixed(errors)} />
                </div>
              </details>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="flex justify-between text-[13px] font-semibold">
                {t("Açıklama")}
                <span className="font-normal text-subtle">{t("İsteğe bağlı")}</span>
              </label>
              <textarea
                id="description"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={6}
                maxLength={LIMITS.descriptionMax}
                placeholder={t("Ne kadar kullanıldı, neden satılıyor, kutusu/faturası var mı, varsa kusurları…")}
                aria-invalid={Boolean(errors.description)}
                className={cn(controlClass, "min-h-36 resize-y py-2.5 leading-relaxed")}
              />
              <p className={cn("flex justify-between text-[12px]", errors.description ? "font-medium text-danger" : "text-muted")}>
                <span>{errors.description ?? t("Telefon numarası, IBAN ya da dış bağlantı yazma; iletişim uygulama içinden olur.")}</span>
                <span className="tabular">{draft.description.length}/{LIMITS.descriptionMax}</span>
              </p>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="price" className="text-[13px] font-semibold">
                  {t("Fiyat")} <span className="text-danger">*</span>
                </label>
                <input
                  id="price"
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set({ price: e.target.value.replace(/[^\d.,]/g, "") })}
                  placeholder="0"
                  aria-invalid={Boolean(errors.price)}
                  className={cn(controlClass, "text-lg font-semibold tabular")}
                />
                {errors.price ? <p className="text-[12px] font-medium text-danger">{errors.price}</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">{t("Para birimi")}</span>
                <div className="flex h-11 gap-1 rounded-field border border-border-strong p-1" role="radiogroup">
                  {(["TL", "€"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={draft.currency === c}
                      onClick={() => set({ currency: c })}
                      className={cn("min-w-14 rounded-[7px] px-3 text-[15px] font-semibold", draft.currency === c ? "bg-brand text-on-brand" : "hover:bg-brand-soft")}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="-mt-2 flex cursor-pointer items-center gap-2.5 text-[14px]">
              <input type="checkbox" checked={draft.negotiable} onChange={(e) => set({ negotiable: e.target.checked })} className="h-[18px] w-[18px] accent-[var(--accent)]" />
              {t("Pazarlığa açığım")}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="city" className="text-[13px] font-semibold">
                  {t("Bölge")} <span className="text-danger">*</span>
                </label>
                <select id="city" value={draft.city} onChange={(e) => set({ city: e.target.value })} aria-invalid={Boolean(errors.city)} className={controlClass}>
                  <option value="">{t("Seç")}</option>
                  <optgroup label={t("Kuzey Kıbrıs")}>
                    {regions.filter((r) => r.side === "north").map((r) => (
                      <option key={r.name}>{r.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label={t("Güney Kıbrıs")}>
                    {regions.filter((r) => r.side === "south").map((r) => (
                      <option key={r.name}>{r.name}</option>
                    ))}
                  </optgroup>
                </select>
                {errors.city ? <p className="text-[12px] font-medium text-danger">{errors.city}</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="district" className="flex justify-between text-[13px] font-semibold">
                  {t("Semt / köy")}
                  <span className="font-normal text-subtle">{t("İsteğe bağlı")}</span>
                </label>
                <input
                  id="district"
                  value={draft.district}
                  onChange={(e) => set({ district: e.target.value })}
                  maxLength={LIMITS.districtMax}
                  placeholder={t("Örn. Alsancak")}
                  className={controlClass}
                />
              </div>
            </div>
            {deliveryDefs.length ? (
              <div className="rounded-card border border-border p-4">
                <h3 className="mb-4 font-semibold">{t("Teslimat")}</h3>
                <AttributeFields defs={deliveryDefs} values={draft.attributes} onChange={setAttr} errors={prefixed(errors)} />
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section>
            <article className="overflow-hidden rounded-[20px] border border-border">
              <div className={cn("grid h-[300px] gap-1.5 sm:h-[380px]", draft.photos.length >= 3 ? "grid-cols-3 grid-rows-2" : draft.photos.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
                {draft.photos.slice(0, 3).map((p, i) => (
                  <div key={p.key} className={cn("relative bg-brand-soft", draft.photos.length >= 3 && i === 0 && "col-span-2 row-span-2")}>
                    <MediaImage urls={p.urls} alt="" max="md" className="absolute inset-0" />
                  </div>
                ))}
              </div>
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  {draft.condition ? <span className="rounded-full bg-brand px-2.5 py-1 font-semibold text-on-brand">{locale === "en" ? CONDITION_INFO[draft.condition as Condition]?.en : draft.condition}</span> : null}
                  {draft.negotiable ? <span className="rounded-full border border-accent px-2.5 py-0.5 font-semibold text-accent">{t("Pazarlığa açık")}</span> : null}
                  <span className="text-muted">{chain.map((c) => categoryLabel(c, locale)).join(" › ")}</span>
                </div>
                <h2 className="mt-3 text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[30px]">{draft.title}</h2>
                <p className="mt-1 text-[28px] font-bold tracking-tight tabular">{Number.isFinite(priceNumber) ? formatLocalized("formatPrice", [priceNumber, draft.currency], locale) : "—"}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted">
                  <Icon name="pin" className="h-4 w-4" />
                  {draft.district ? `${draft.city}, ${draft.district}` : draft.city}
                </p>
                {specificationGroups(detailDefs, draft.attributes, locale).flatMap((g) => g.rows).length ? (
                  <dl className="mt-5 grid grid-cols-2 border-y border-border sm:grid-cols-4">
                    {specificationGroups(detailDefs, draft.attributes, locale)
                      .flatMap((g) => g.rows)
                      .slice(0, 4)
                      .map((r, i) => (
                        <div key={r.key} className={cn("py-3 pr-3", i > 0 && "sm:border-l sm:border-border sm:pl-4")}>
                          <dt className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">{r.label}</dt>
                          <dd className="mt-0.5 truncate font-semibold">{r.value}</dd>
                        </div>
                      ))}
                  </dl>
                ) : null}
                {draft.description.trim() ? <p className="mt-5 line-clamp-4 whitespace-pre-line text-[15px] leading-relaxed">{draft.description.trim()}</p> : null}
              </div>
            </article>

            <dl className="mt-5 divide-y divide-border rounded-[16px] border border-border text-[14px]">
              {[
                { step: 0, label: "Kategori", value: chain.map((c) => categoryLabel(c, locale)).join(" › ") },
                { step: 1, label: "Fotoğraflar", value: t(`${draft.photos.length} fotoğraf`) },
                { step: 2, label: "Özellikler", value: t(`${Object.keys(validateAttributes(detailDefs, draft.attributes).values).length} özellik girildi`) },
                { step: 3, label: "Fiyat ve konum", value: summary[3] },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-muted">{t(row.label)}</dt>
                  <dd className="flex min-w-0 items-center gap-3 text-right">
                    <span className="truncate font-medium">{row.value}</span>
                    <button type="button" onClick={() => go(row.step)} className="flex-shrink-0 text-[13px] font-semibold underline underline-offset-4 hover:text-accent">
                      {t("Düzenle")}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <Notice className="mt-5" icon="shield">
              {t("Yayınlamadan önce kısa bir inceleme yapıyoruz. İlanın kurallara uygunsa genellikle aynı gün yayına girer.")}{" "}
              <Link href="/kosullar" className="font-semibold underline underline-offset-2">
                {t("İlan kuralları")}
              </Link>
            </Notice>
            {submitError ? <FormError className="mt-4">{submitError}</FormError> : null}
          </section>
        ) : null}
      </div>

        </div>

        {/* Live preview */}
        <aside className="hidden xl:block" aria-label={t("Önizleme")}>
          <div className="sticky top-[150px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">{t("Alıcılar böyle görecek")}</p>
            <div className="pointer-events-none mt-4" aria-hidden>
              <ListingCard listing={previewCard} />
            </div>
            <ul className="mt-6 space-y-2.5 text-[13.5px]">
              {[
                { ok: Boolean(draft.categoryId), label: "Kategori seçildi" },
                { ok: draft.photos.length >= 3, label: "En az 3 fotoğraf" },
                { ok: draft.title.trim().length >= 10, label: "Açıklayıcı bir başlık" },
                { ok: Boolean(draft.price && draft.city), label: "Fiyat ve bölge" },
                { ok: draft.description.trim().length >= 40, label: "Kısa bir açıklama" },
              ].map((c) => (
                <li key={c.label} className={cn("flex items-center gap-2.5", c.ok ? "text-text" : "text-muted")}>
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full", c.ok ? "bg-success text-white" : "border border-border-strong")}>
                    {c.ok ? <Icon name="check" className="h-3 w-3" /> : null}
                  </span>
                  {t(c.label)}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {step > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className={cn(SHELL, "flex items-center gap-2 !px-0")}>
            <Button variant="secondary" onClick={() => go(step - 1)} icon={<Icon name="back" className="h-4 w-4" />}>
              {t("Geri")}
            </Button>
            <span className="hidden flex-1 text-center text-[12px] text-muted sm:block">{t("Taslağın bu cihazda otomatik kaydediliyor.")}</span>
            {step < 4 ? (
              <Button className="ml-auto" size="lg" onClick={() => go(step + 1)} iconEnd={<Icon name="arrow" className="h-4 w-4" />}>
                {t(`Devam: ${STEPS[step + 1]}`)}
              </Button>
            ) : (
              <Button className="ml-auto" size="lg" loading={publishing} onClick={publish}>
                {t("İlanı yayınla")}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Where to resume a saved draft: the first step that still needs work. */
function stepLooksDone(d: ListingDraft, s: number) {
  if (s === 0) return Boolean(d.categoryId);
  if (s === 1) return d.photos.length > 0;
  if (s === 2) return d.title.trim().length >= 3 && Boolean(d.condition);
  if (s === 3) return Boolean(d.price && d.city);
  return true;
}

/** "18.500" and "18500" are eighteen thousand five hundred; "1,5" is one and a half. */
export function normalizePrice(input: string) {
  return input.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
}

function prefixed(errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("attr.")).map(([k, v]) => [k.slice(5), v]));
}
