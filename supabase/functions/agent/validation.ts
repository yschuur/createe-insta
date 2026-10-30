export function postUrl(input: unknown) {
  if (typeof input !== "string") throw new Error("Postlink ontbreekt.");
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    !["www.instagram.com", "instagram.com"].includes(u.hostname) ||
    !/^\/(p|reel)\/[\w-]+\/?$/.test(u.pathname)
  )
    throw new Error("Ongeldige Instagram-postlink.");
  return `https://www.instagram.com${u.pathname.replace(/\/$/, "")}/`;
}
export function editor(input: any) {
  if (
    !input ||
    !Number.isFinite(input.humor) ||
    input.humor < 0 ||
    input.humor > 100 ||
    !["Alle drie", "Speels", "Sarcastisch", "Woordgrap"].includes(
      input.style,
    ) ||
    !["Kort", "Ultrakort", "Medium"].includes(input.length) ||
    !["Nederlands", "Engels"].includes(input.language) ||
    typeof input.instructions !== "string" ||
    input.instructions.length > 2000
  )
    throw new Error("Ongeldige editorinstellingen.");
  return input;
}
export const categoryTags: Record<string, string> = {
  Golf: "golf",
  Padel: "padel",
  Golfhumor: "golfhumor",
  Padelhumor: "padelhumor",
  Sportkleding: "sportswear",
};
export function validateCategory(value: unknown): string {
  if (typeof value !== "string" || !(value in categoryTags))
    throw new Error("Ongeldige categorie.");
  return value;
}
