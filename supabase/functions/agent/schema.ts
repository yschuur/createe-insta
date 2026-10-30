export function draftStatusToDb(status: string) {
  if (!["draft", "approved", "published"].includes(status))
    throw new Error("Ongeldige reactiestatus.");
  return status === "published" ? "posted" : status;
}
const styles: Record<string, string> = {
  playful: "Speels",
  sarcastic: "Sarcastisch",
  pun: "Woordgrap",
};
export function humorToDb(style: string) {
  return (
    (
      {
        Speels: "playful",
        Sarcastisch: "sarcastic",
        Woordgrap: "pun",
      } as Record<string, string>
    )[style] || style
  );
}
export function languageToDb(language: string) {
  return language === "Engels" ? "en" : "nl";
}
// Maps the existing schema supplied in the user's CSV to the browser contract.
export function draftView(row: any) {
  return {
    id: row.id,
    post_id: row.post_id,
    text: row.edited_text ?? row.generated_text,
    style: styles[row.humor_type] || row.humor_type,
    status: row.status === "posted" ? "published" : row.status,
  };
}
export function postView(
  row: any,
  categories: any[],
  analyses: any[],
  drafts: any[],
) {
  const analysis = analyses.find((a) => a.post_id === row.id);
  return {
    ...row,
    category:
      categories.find((c) => c.id === row.category_id)?.name ?? "Onbekend",
    timestamp: row.published_at,
    like_count: row.discovery_metadata?.like_count ?? null,
    comments_count: row.discovery_metadata?.comments_count ?? null,
    detected_language: analysis?.detected_language ?? "unknown",
    relevance: analysis?.relevance_score ?? 0,
    analysis: analysis?.summary ?? undefined,
    drafts: drafts.filter((d) => d.post_id === row.id).map(draftView),
  };
}
export function settingsView(row: any, categories: any[]) {
  return {
    editor: {
      humor: row?.default_humor_level ?? 65,
      language: ["en", "Engels"].includes(row?.preferred_language)
        ? "Engels"
        : "Nederlands",
      style: "Alle drie",
      length: "Kort",
      instructions: "",
    },
    categories: categories.length
      ? categories.filter((c) => c.enabled).map((c) => c.name)
      : ["Golf", "Padel", "Golfhumor", "Padelhumor", "Sportkleding"],
  };
}
export function analysisRecord(
  userId: string,
  postId: string,
  data: any,
  hasImage: boolean,
) {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    post_id: postId,
    summary: data.analysis,
    detected_language: data.language || "unknown",
    detected_topic: null,
    relevance_score: data.relevance,
    humorous_angles: [],
    analysis_sources: hasImage ? ["caption", "image"] : ["caption"],
    analysis_limitations: hasImage
      ? "Alleen de aangeleverde afbeelding of een los frame; geen volledige video bekeken."
      : "Alleen caption; geen beeld of video bekeken.",
    created_at: new Date().toISOString(),
  };
}
