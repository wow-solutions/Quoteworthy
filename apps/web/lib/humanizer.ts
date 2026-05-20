import Anthropic from "@anthropic-ai/sdk";
import { buildBrandContext } from "./claude";
import { HUMANIZER_BODY } from "./humanizer-prompt";
import type { Tables } from "./supabase/database.types";

// Rewrites text using the blader/humanizer skill (Wikipedia "Signs of AI writing"
// patterns + 2-pass audit). Wired to the "Очеловечить текст" button in the writer.
//
// Output override: the source skill emits a multi-section response (draft, audit
// bullets, final, summary). Our endpoint needs just the final text, so we append
// an explicit output contract that supersedes the skill's "Output Format" section.

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;

const OUTPUT_OVERRIDE = `

---

## OUTPUT CONTRACT (this supersedes the "Output Format" section above)

Internally perform the full 2-pass process (draft → "What makes this obviously AI?" audit → revised final). But return ONLY the revised final text as plain output. Do NOT include:

- The draft version
- The audit bullets
- A "Changes made" summary
- Any section headers, labels, or commentary
- Markdown quote blocks (> ...) wrapping the output
- Any preamble like "Here is the humanized text:"

Just the final humanized text, ready to publish as-is. Match the input's language (English in / English out, Spanish in / Spanish out).
`;

const HUMANIZER_SYSTEM = HUMANIZER_BODY + OUTPUT_OVERRIDE;

export class HumanizerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HumanizerError";
  }
}

export type HumanizeResult = {
  text: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

export async function humanizeText(
  text: string,
  brandConfig?: Tables<"brand_configs">,
  primaryLanguage: string = "en",
  opts?: { apiKey?: string; signal?: AbortSignal },
): Promise<HumanizeResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new HumanizerError("text is empty");
  if (trimmed.length > 30_000) throw new HumanizerError("text too long");

  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HumanizerError("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });

  // Voice calibration: if we have a brand_config, feed buildBrandContext as
  // the voice sample (matches the skill's "Voice Calibration" section, which
  // expects 2-3 paragraphs of the user's writing).
  let userText: string;
  if (brandConfig) {
    const brandContext = buildBrandContext(brandConfig, primaryLanguage);
    userText = [
      "Humanize the text below. Use the brand context as your voice-calibration sample — match the tone, sentence rhythm, vocabulary, and idiom of this brand.",
      "",
      "## Brand context (voice-calibration sample)",
      "",
      brandContext,
      "",
      "## Text to humanize",
      "",
      trimmed,
    ].join("\n");
  } else {
    userText = `Humanize this text:\n\n${trimmed}`;
  }

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: HUMANIZER_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userText }],
      },
      { signal: opts?.signal },
    );
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new HumanizerError(
        `Claude ${err.status}: ${err.message}`,
        err.status,
        err,
      );
    }
    if (err instanceof Error) {
      throw new HumanizerError(err.message, undefined, err);
    }
    throw new HumanizerError("Unknown error calling humanizer", undefined, err);
  }

  const rewritten = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!rewritten) {
    throw new HumanizerError("Humanizer returned no text content");
  }

  return {
    text: rewritten,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
