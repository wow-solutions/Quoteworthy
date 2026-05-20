import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { humanizeText, HumanizerError } from "@/lib/humanizer";
import type { Tables } from "@/lib/supabase/database.types";

// POST /api/posts/humanize
//
// Stateless transformation: takes raw text + optional brand_id (for voice
// calibration via brand_configs.voice_samples), returns rewritten text.
//
// Does NOT touch posts table. Caller (writer-client) holds undo state in memory.

const RequestSchema = z.object({
  text: z.string().min(1).max(30_000),
  brand_id: z.string().uuid().optional(),
});

type ErrorBody = { error: string };

function jsonError(body: ErrorBody, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError({ error: "Not signed in" }, 401);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      400,
    );
  }
  const { text, brand_id } = parsed.data;

  let config: Tables<"brand_configs"> | undefined;
  let language = "en";
  if (brand_id) {
    const { data: brand } = await supabase
      .from("brands")
      .select("id, primary_language")
      .eq("id", brand_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (brand) {
      language = brand.primary_language;
      const { data: cfg } = await supabase
        .from("brand_configs")
        .select("*")
        .eq("brand_id", brand_id)
        .maybeSingle();
      config = cfg ?? undefined;
    }
  }

  try {
    const result = await humanizeText(text, config, language);
    return Response.json({
      text: result.text,
      cache_read_tokens: result.usage.cache_read_input_tokens,
    });
  } catch (err) {
    if (err instanceof HumanizerError) {
      // Use 502 (bad upstream) for Claude failures; 500 only for our own misconfig.
      const status = err.status === 401 ? 500 : 502;
      return jsonError({ error: err.message }, status);
    }
    return jsonError({ error: "Humanize failed" }, 500);
  }
}
