"use client";

import { useSyncExternalStore } from "react";

export type ListingDraft = {
  /** Storage paths of photos already uploaded to the listing-images bucket. */
  photos: string[];
  title: string;
  /** Category slug. */
  category: string;
  categoryName: string;
  condition: string;
  description: string;
  price: string;
  currency: "TL" | "€";
  city: string;
  district: string;
  negotiable: boolean;
  /**
   * Idempotency key of the submission (P1-10): created on the first "send",
   * reused by retries so a lost response or a double click cannot create the
   * listing twice. Any change to the draft makes it a new submission.
   */
  submissionKey: string;
};

export const emptyDraft: ListingDraft = {
  photos: [],
  title: "",
  category: "",
  categoryName: "",
  condition: "Az kullanılmış",
  description: "",
  price: "",
  currency: "TL",
  city: "Girne",
  district: "",
  negotiable: false,
  submissionKey: "",
};

/** The draft after a change; a content change drops the submission key. */
export function applyDraftPatch(draft: ListingDraft, patch: Partial<ListingDraft>): ListingDraft {
  return { ...draft, ...patch, submissionKey: patch.submissionKey ?? "" };
}

const STORAGE_KEY = "kie-wizard-draft";
const listeners = new Set<() => void>();
let snapshot: ListingDraft = emptyDraft;
let hydrated = false;

function hydrateFromStorage() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      snapshot = { ...emptyDraft, ...parsed, photos: Array.isArray(parsed.photos) ? parsed.photos : [] };
    }
  } catch {
    // ignore — start from an empty draft
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  hydrateFromStorage();
  return snapshot;
}

function getServerSnapshot() {
  return emptyDraft;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function persist() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore — sessionStorage may be unavailable
  }
}

export function setWizardDraft(patch: Partial<ListingDraft>) {
  snapshot = applyDraftPatch(snapshot, patch);
  persist();
  notify();
}

export function resetWizardDraft() {
  snapshot = emptyDraft;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function useWizardDraft() {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { draft, setDraft: setWizardDraft, resetDraft: resetWizardDraft };
}
