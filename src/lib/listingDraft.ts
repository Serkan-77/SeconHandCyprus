// The listing being written, kept in this browser until it is published so a
// closed tab, a reload or a lost connection never loses the seller's work.
// Photos are already on the server (upload keys); everything else is local.
// No "@/" imports: tested directly with node --test.

export type DraftPhoto = { key: string; urls: { sm: string; md: string; lg: string } };

export type ListingDraft = {
  categoryId: number | null;
  photos: DraftPhoto[];
  title: string;
  condition: string;
  description: string;
  price: string;
  currency: "TL" | "€";
  negotiable: boolean;
  city: string;
  district: string;
  attributes: Record<string, unknown>;
  /**
   * Idempotency key of the submission (P1-10): created on the first
   * "publish", reused by retries so a lost response or a double click cannot
   * create the listing twice. Any change to the draft makes it a new submission.
   */
  submissionKey: string;
  updatedAt: number;
};

export const emptyDraft: ListingDraft = {
  categoryId: null,
  photos: [],
  title: "",
  condition: "",
  description: "",
  price: "",
  currency: "TL",
  negotiable: false,
  city: "",
  district: "",
  attributes: {},
  submissionKey: "",
  updatedAt: 0,
};

/** The draft after a change; a content change drops the submission key. */
export function applyDraftPatch(draft: ListingDraft, patch: Partial<ListingDraft>, now = Date.now()): ListingDraft {
  const next = { ...draft, ...patch, updatedAt: now };
  next.submissionKey = patch.submissionKey ?? "";
  return next;
}

/** A draft is worth offering to resume when the seller did more than pick a category. */
export function hasContent(d: ListingDraft) {
  return Boolean(d.photos.length || d.title.trim() || d.description.trim() || d.price.trim());
}

export function parseDraft(raw: string | null): ListingDraft {
  if (!raw) return emptyDraft;
  try {
    const d = JSON.parse(raw) as Partial<ListingDraft>;
    return {
      ...emptyDraft,
      ...d,
      photos: Array.isArray(d.photos) ? d.photos.filter((p) => p && typeof p.key === "string" && p.urls) : [],
      attributes: d.attributes && typeof d.attributes === "object" && !Array.isArray(d.attributes) ? d.attributes : {},
      currency: d.currency === "€" ? "€" : "TL",
    };
  } catch {
    return emptyDraft;
  }
}

export function draftStorageKey(userId: string) {
  return `kie-listing-draft:${userId}`;
}
