export type FilterOptions = {
  categories: { on: boolean; values: string[] };
  age: { on: boolean; hours: number };
  media: { on: boolean; values: string[] };
  hashtags: { on: boolean; value: string };
  keywords: { on: boolean; include: string; exclude: string };
  language: { on: boolean; value: string };
  relevance: { on: boolean; minimum: number };
  engagement: { on: boolean; minLikes: number; maxComments: number };
  handled: { on: boolean };
  sort: "newest" | "relevance" | "engagement";
};
export const defaultFilters: FilterOptions = {
  categories: { on: false, values: ["Golf"] },
  age: { on: false, hours: 24 },
  media: { on: false, values: ["IMAGE", "VIDEO", "CAROUSEL_ALBUM"] },
  hashtags: { on: false, value: "" },
  keywords: { on: false, include: "", exclude: "" },
  language: { on: false, value: "nl" },
  relevance: { on: false, minimum: 70 },
  engagement: { on: false, minLikes: 0, maxComments: 100 },
  handled: { on: false },
  sort: "newest",
};
const list = (s: string) =>
  s
    .toLocaleLowerCase()
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
export function parseFilters(raw: unknown): FilterOptions {
  if (raw == null) return structuredClone(defaultFilters);
  const f = raw as FilterOptions;
  for (const name of [
    "categories",
    "age",
    "media",
    "hashtags",
    "keywords",
    "language",
    "relevance",
    "engagement",
    "handled",
  ] as const)
    if (!f[name] || typeof f[name].on !== "boolean")
      throw new Error("Ongeldige filters.");
  if (
    !Array.isArray(f.categories.values) ||
    f.categories.values.length > 5 ||
    f.categories.values.some(
      (v) =>
        !["Golf", "Padel", "Golfhumor", "Padelhumor", "Sportkleding"].includes(
          v,
        ),
    ) ||
    !Array.isArray(f.media.values) ||
    f.media.values.some(
      (v) => !["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].includes(v),
    )
  )
    throw new Error("Ongeldige categorie of mediatype.");
  for (const [n, min, max] of [
    [f.age.hours, 1, 8760],
    [f.relevance.minimum, 0, 100],
    [f.engagement.minLikes, 0, 1000000000],
    [f.engagement.maxComments, 0, 1000000000],
  ])
    if (!Number.isFinite(n) || n < min || n > max)
      throw new Error("Ongeldige filtergrens.");
  for (const text of [f.hashtags.value, f.keywords.include, f.keywords.exclude])
    if (typeof text !== "string" || text.length > 1000)
      throw new Error("Filtertekst te lang.");
  if (
    !["nl", "en"].includes(f.language.value) ||
    !["newest", "relevance", "engagement"].includes(f.sort)
  )
    throw new Error("Ongeldige taal of sortering.");
  const tags = list(f.hashtags.value).map((t) => t.replace(/^#/, ""));
  if (tags.length > 5 || tags.some((t) => !/^\p{L}[\p{L}\p{N}_]*$/u.test(t)))
    throw new Error("Gebruik maximaal vijf hashtags, gescheiden door komma’s.");
  return f;
}
export function hashtagsFor(f: FilterOptions, fallback: string) {
  return f.hashtags.on
    ? [...new Set(list(f.hashtags.value).map((v) => v.replace(/^#/, "")))]
    : [fallback];
}
// Unknown dates, counts, language and relevance do not satisfy enabled filters.
export function matchesFilters(
  p: any,
  f: FilterOptions,
  now = Date.now(),
  cheapOnly = false,
) {
  const caption = (p.caption || "").toLocaleLowerCase();
  if (f.categories.on && !f.categories.values.includes(p.category))
    return false;
  if (f.age.on) {
    const timestamp = Date.parse(p.timestamp);
    if (
      !Number.isFinite(timestamp) ||
      timestamp < now - f.age.hours * 3600000 ||
      timestamp > now
    )
      return false;
  }
  if (f.media.on && !f.media.values.includes(p.media_type)) return false;
  if (
    f.keywords.on &&
    ((list(f.keywords.include).length > 0 &&
      !list(f.keywords.include).some((v) => caption.includes(v))) ||
      list(f.keywords.exclude).some((v) => caption.includes(v)))
  )
    return false;
  if (f.hashtags.on) {
    const present = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
    if (!hashtagsFor(f, "").some((t) => present.includes("#" + t)))
      return false;
  }
  if (
    f.engagement.on &&
    (typeof p.like_count !== "number" ||
      typeof p.comments_count !== "number" ||
      p.like_count < f.engagement.minLikes ||
      p.comments_count > f.engagement.maxComments)
  )
    return false;
  if (!cheapOnly) {
    if (f.language.on && p.detected_language !== f.language.value) return false;
    if (
      f.relevance.on &&
      (!p.analysis ||
        typeof p.relevance !== "number" ||
        p.relevance < f.relevance.minimum)
    )
      return false;
    if (f.handled.on && p.drafts?.length) return false;
  }
  return true;
}
export function filterPosts(posts: any[], f: FilterOptions, now = Date.now()) {
  const score = (p: any) =>
    f.sort === "relevance"
      ? (p.relevance ?? -1)
      : f.sort === "engagement"
        ? typeof p.like_count === "number" &&
          typeof p.comments_count === "number"
          ? p.like_count + p.comments_count
          : -1
        : Date.parse(p.timestamp) || 0;
  return posts
    .filter((p) => matchesFilters(p, f, now))
    .sort(
      (a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)),
    );
}
