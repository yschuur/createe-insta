export const categories = [
  "Golf",
  "Padel",
  "Golfhumor",
  "Padelhumor",
  "Sportkleding",
];
export type Post = {
  id: string;
  permalink: string;
  caption: string;
  category: string;
  timestamp: string | null;
  media_url?: string;
  thumbnail_url?: string;
  media_type?: string;
  relevance?: number;
  analysis?: string;
  drafts?: Draft[];
};
export type Draft = {
  id: string;
  text: string;
  style: string;
  status: "draft" | "approved" | "published";
};
export type Settings = {
  humor: number;
  style: string;
  length: string;
  language: string;
  instructions: string;
};
export const defaults: Settings = {
  humor: 65,
  style: "Alle drie",
  length: "Kort",
  language: "Nederlands",
  instructions: "",
};
export function instagramUrl(input: string) {
  try {
    const u = new URL(input);
    if (
      !["instagram.com", "www.instagram.com"].includes(u.hostname) ||
      !/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname) ||
      u.protocol !== "https:"
    )
      return null;
    return `https://www.instagram.com${u.pathname.replace(/\/$/, "")}/`;
  } catch {
    return null;
  }
}
export function stats(posts: Post[]) {
  const drafts = posts.flatMap((p) => p.drafts || []);
  return [
    posts.length,
    posts.filter((p) => p.analysis).length,
    drafts.length,
    drafts.filter((d) => d.status === "published").length,
  ];
}
