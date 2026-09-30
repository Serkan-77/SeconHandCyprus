// Categories and attribute definitions, cached in memory (they change only
// through the admin panel, which invalidates the cache) and served to the web
// and mobile clients in one cacheable document.
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/pool.ts";
import { effectiveAttributes, type AttributeDef } from "../../../shared/attributes.ts";
import { REGIONS } from "../../../shared/constants.ts";

export type CategoryNode = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  nameEn: string | null;
  icon: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type Taxonomy = {
  categories: CategoryNode[];
  attributes: AttributeDef[];
  byId: Map<number, CategoryNode>;
  bySlug: Map<string, CategoryNode>;
  /** Root → category. */
  chain(id: number): CategoryNode[];
  /** The category and every category below it. */
  subtree(id: number): number[];
  children(id: number | null): CategoryNode[];
  attributesFor(id: number): AttributeDef[];
  etag: string;
};

const TTL_MS = 60_000;
let cached: { at: number; value: Taxonomy } | null = null;
let loading: Promise<Taxonomy> | null = null;

export function invalidateTaxonomy() {
  cached = null;
}

export async function getTaxonomy(db: Db): Promise<Taxonomy> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  loading ??= load(db).finally(() => (loading = null));
  const value = await loading;
  cached = { at: Date.now(), value };
  return value;
}

async function load(db: Db): Promise<Taxonomy> {
  // Reference data is public; read it as the anonymous role.
  const [categories, rows] = await db.begin(async (sql) => {
    await sql`select set_config('app.role', 'anon', true)`;
    const c = await sql<CategoryNode[]>`
      select id, parent_id, slug, name, name_en, icon, description, sort_order, is_active
      from categories order by sort_order, name`;
    const a = await sql<
      (Omit<AttributeDef, "min" | "max" | "group"> & { minValue: number | null; maxValue: number | null; groupName: string })[]
    >`
      select id, category_id, key, label, label_en, type, unit, options, required, filterable, highlight,
             min_value, max_value, max_length, placeholder, help, group_name, sort_order, is_active
      from category_attributes order by sort_order, id`;
    return [c, a] as const;
  });
  const attributes: AttributeDef[] = rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    key: r.key,
    label: r.label,
    labelEn: r.labelEn,
    type: r.type,
    unit: r.unit,
    options: r.options,
    required: r.required,
    filterable: r.filterable,
    highlight: r.highlight,
    min: r.minValue,
    max: r.maxValue,
    maxLength: r.maxLength,
    placeholder: r.placeholder,
    help: r.help,
    group: r.groupName,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
  const byId = new Map(categories.map((c) => [c.id, c]));
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const chainCache = new Map<number, CategoryNode[]>();
  const attrCache = new Map<number, AttributeDef[]>();
  const chain = (id: number) => {
    let hit = chainCache.get(id);
    if (hit) return hit;
    hit = [];
    let cur = byId.get(id);
    for (let guard = 0; cur && guard < 10; guard++) {
      hit.unshift(cur);
      cur = cur.parentId == null ? undefined : byId.get(cur.parentId);
    }
    chainCache.set(id, hit);
    return hit;
  };
  const children = (id: number | null) => categories.filter((c) => c.parentId === id);
  const subtree = (id: number) => {
    const out: number[] = [];
    const stack = [id];
    while (stack.length && out.length < 1000) {
      const next = stack.pop()!;
      out.push(next);
      for (const c of children(next)) stack.push(c.id);
    }
    return out;
  };
  const etag = createHash("sha1").update(JSON.stringify([categories, attributes])).digest("base64url").slice(0, 16);
  return {
    categories,
    attributes,
    byId,
    bySlug,
    chain,
    children,
    subtree,
    attributesFor(id: number) {
      let hit = attrCache.get(id);
      if (!hit) {
        hit = effectiveAttributes(attributes, chain(id).map((c) => c.id));
        attrCache.set(id, hit);
      }
      return hit;
    },
    etag,
  };
}

export async function taxonomyRoutes(app: FastifyInstance) {
  app.get("/taxonomy", async (req, reply) => {
    const t = await getTaxonomy(app.deps.db);
    const etag = `"tx-${t.etag}"`;
    reply.header("cache-control", "public, max-age=60, stale-while-revalidate=600");
    reply.header("etag", etag);
    if (req.headers["if-none-match"] === etag) return reply.status(304).send();
    // Hidden overrides are internal detail; clients get the effective model.
    return {
      categories: t.categories.filter((c) => c.isActive),
      attributes: t.attributes,
      regions: REGIONS,
    };
  });

  app.get("/categories/:id/attributes", async (req) => {
    const t = await getTaxonomy(app.deps.db);
    const raw = (req.params as { id: string }).id;
    const category = /^\d+$/.test(raw) ? t.byId.get(Number(raw)) : t.bySlug.get(raw);
    if (!category) return { attributes: [] };
    return { attributes: t.attributesFor(category.id) };
  });
}
