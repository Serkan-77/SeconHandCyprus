// Category tree helpers over the /taxonomy document (server and client).
import { effectiveAttributes, type AttributeDef } from "../../shared/attributes.ts";
import type { Category } from "./api/types";

export type CategoryNode = Category & { children: CategoryNode[] };

export function buildTree(categories: Category[]): CategoryNode[] {
  const byId = new Map<number, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId == null ? null : byId.get(node.parentId);
    if (parent) parent.children.push(node);
    else if (node.parentId == null) roots.push(node);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Root → category. */
export function chainOf(categories: Category[], id: number): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: Category[] = [];
  let cur = byId.get(id);
  for (let i = 0; cur && i < 10; i++) {
    out.unshift(cur);
    cur = cur.parentId == null ? undefined : byId.get(cur.parentId);
  }
  return out;
}

export function childrenOf(categories: Category[], id: number | null) {
  return categories.filter((c) => c.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function attributesFor(categories: Category[], defs: AttributeDef[], id: number) {
  return effectiveAttributes(defs, chainOf(categories, id).map((c) => c.id));
}

export function categoryLabel(c: { name: string; nameEn?: string | null }, locale: "tr" | "en") {
  return locale === "en" && c.nameEn ? c.nameEn : c.name;
}
