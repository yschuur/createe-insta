import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function api(
  action: string,
  payload: Record<string, unknown> = {},
) {
  if (!supabase)
    throw new Error(
      "Configureer eerst de publieke Supabase-variabelen in .env.",
    );
  const { data, error } = await supabase.functions.invoke("agent", {
    body: { action, ...payload },
  });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (data.error) throw new Error(data.error);
  return data;
}
