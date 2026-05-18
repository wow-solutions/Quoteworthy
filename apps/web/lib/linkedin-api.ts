// LinkedIn UGC Posts API — publish a text post from the member's personal
// profile. Requires w_member_social scope (App #1 has it).
//
// Endpoint: POST https://api.linkedin.com/v2/ugcPosts
// Auth: Bearer <access_token>
// Header: X-Restli-Protocol-Version: 2.0.0
//
// Response: 201 Created. The new post URN is returned via the `x-restli-id`
// header (and is sometimes mirrored in the body's `id` field). We treat the
// header as authoritative.
//
// Errors of interest:
//   401 → token expired or revoked → caller should refresh once and retry
//   403 → insufficient scope → user must re-auth with the right product
//   422 → content rejected (length, links policy, banned terms)
//   429 → rate limited
//
// Server-only — never import into a client bundle. The access_token is a
// secret pulled from Supabase Vault.

import { z } from "zod";

const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

export type PublishResult = {
  /** URN of the new post, e.g. "urn:li:share:7308428281234567890" */
  urn: string;
  /** Public URL viewable in the feed */
  url: string;
};

const ResponseBodySchema = z.object({
  id: z.string().optional(),
});

/**
 * Publish a text-only post to the member's personal LinkedIn feed.
 *
 * `sub` is the LinkedIn member's OIDC `sub` claim (from /v2/userinfo).
 * `text` is the post body, plain text. LinkedIn enforces a 3000-char limit
 * but we don't pre-trim here — let the API reject if too long and surface
 * the 422 to the caller.
 */
export async function publishMemberPost(
  accessToken: string,
  sub: string,
  text: string,
): Promise<PublishResult> {
  const payload = {
    author: `urn:li:person:${sub}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  let res: Response;
  try {
    res = await fetch(UGC_POSTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "x-restli-protocol-version": "2.0.0",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new LinkedInApiError("LinkedIn publish failed (network)", undefined, undefined, err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LinkedInApiError(
      `LinkedIn /v2/ugcPosts returned ${res.status}: ${body.slice(0, 300)}`,
      res.status,
      body,
    );
  }

  // URN comes back in the x-restli-id header (and sometimes in body.id).
  let urn = res.headers.get("x-restli-id") ?? "";
  if (!urn) {
    const body = await res.json().catch(() => null);
    const parsed = ResponseBodySchema.safeParse(body);
    if (parsed.success && parsed.data.id) {
      urn = parsed.data.id;
    }
  }
  if (!urn) {
    throw new LinkedInApiError(
      `LinkedIn returned 2xx but no post URN`,
      res.status,
    );
  }

  return {
    urn,
    url: `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`,
  };
}
