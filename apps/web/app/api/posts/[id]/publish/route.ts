import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  readLinkedInToken,
  updateSecret,
  VaultError,
  type LinkedInToken,
} from "@/lib/vault";
import { publishMemberPost, LinkedInApiError } from "@/lib/linkedin-api";
import {
  refreshAccessToken,
  fetchUserInfo,
  LinkedInOAuthError,
} from "@/lib/linkedin-oauth";

// POST /api/posts/[id]/publish
//
// Publishes a draft post to the brand's connected LinkedIn personal account.
// (ADR-0017 D6, deliverable 9.3)
//
// Flow:
//   1. Auth + RLS-scoped post fetch
//   2. Refuse if already published, or no LinkedIn connection on the brand
//   3. Read tokens from Vault. If expires_at is past (with 60s buffer):
//      refresh via refresh_token, write new tokens back to Vault
//   4. If user_sub missing from Vault (token issued before that field
//      existed), fetch /v2/userinfo and patch Vault
//   5. POST to LinkedIn /v2/ugcPosts
//   6. UPDATE posts row: status=published, external_post_id, external_post_url,
//      published_at
//   7. Return { url, urn } for the UI

const ParamsSchema = z.object({ id: z.string().uuid() });

const REFRESH_BUFFER_MS = 60_000; // refresh if expiring within 1 minute

type ErrorBody = { error: string; needsReconnect?: boolean };

function jsonError(body: ErrorBody, status: number): Response {
  return NextResponse.json(body, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const rawParams = await context.params;
  const parsed = ParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return jsonError({ error: "Invalid post id" }, 400);
  }
  const postId = parsed.data.id;

  // 1. Auth + post (RLS-scoped, returns only posts whose brand belongs to user)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError({ error: "Not signed in" }, 401);

  const { data: post } = await supabase
    .from("posts")
    .select("id, brand_id, content_text, status, platform")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return jsonError({ error: "Post not found" }, 404);
  if (post.status === "published") {
    return jsonError({ error: "Post already published" }, 409);
  }
  if (post.platform !== "linkedin") {
    return jsonError({ error: `Platform ${post.platform} not yet supported` }, 400);
  }
  if (!post.content_text || !post.content_text.trim()) {
    return jsonError({ error: "Post content is empty" }, 400);
  }

  // 2. LinkedIn token row (service-role read — RLS allows user-scoped but
  // we'll also need to update it on refresh)
  const service = createServiceRoleClient();
  const { data: tokenRow } = await service
    .from("brand_oauth_tokens")
    .select("id, vault_secret_id, expires_at, status")
    .eq("brand_id", post.brand_id)
    .eq("platform", "linkedin")
    .maybeSingle();

  if (!tokenRow || !tokenRow.vault_secret_id) {
    return jsonError(
      { error: "LinkedIn is not connected for this brand", needsReconnect: true },
      400,
    );
  }
  if (tokenRow.status !== "active") {
    return jsonError(
      { error: `LinkedIn connection status is ${tokenRow.status}`, needsReconnect: true },
      400,
    );
  }

  // 3. Read token from Vault
  let token: LinkedInToken;
  try {
    token = await readLinkedInToken(tokenRow.vault_secret_id);
  } catch (err) {
    const msg = err instanceof VaultError ? err.message : "Vault read failed";
    return jsonError({ error: msg }, 500);
  }

  // 4. Refresh if near expiry
  const expiresMs = new Date(token.expires_at).getTime();
  if (Number.isFinite(expiresMs) && expiresMs - Date.now() < REFRESH_BUFFER_MS) {
    if (!token.refresh_token) {
      return jsonError(
        { error: "LinkedIn token expired and no refresh token available", needsReconnect: true },
        401,
      );
    }
    try {
      const refreshed = await refreshAccessToken(token.refresh_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      token = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: newExpiresAt,
        scope: refreshed.scope,
        user_sub: token.user_sub,
      };
      await updateSecret(tokenRow.vault_secret_id, { ...token });
      await service
        .from("brand_oauth_tokens")
        .update({ expires_at: newExpiresAt })
        .eq("id", tokenRow.id);
    } catch (err) {
      const msg = err instanceof LinkedInOAuthError ? err.message : "Token refresh failed";
      return jsonError({ error: msg, needsReconnect: true }, 401);
    }
  }

  // 5. Backfill user_sub for tokens issued before that field existed
  let sub = token.user_sub;
  if (!sub) {
    try {
      const userInfo = await fetchUserInfo(token.access_token);
      sub = userInfo.sub;
      token = { ...token, user_sub: sub };
      await updateSecret(tokenRow.vault_secret_id, { ...token });
    } catch (err) {
      const msg = err instanceof LinkedInOAuthError ? err.message : "Failed to fetch LinkedIn profile";
      return jsonError({ error: msg, needsReconnect: true }, 401);
    }
  }

  // 6. Publish
  let urn: string;
  let url: string;
  try {
    const result = await publishMemberPost(token.access_token, sub, post.content_text);
    urn = result.urn;
    url = result.url;
  } catch (err) {
    const msg = err instanceof LinkedInApiError ? err.message : "LinkedIn publish failed";
    const status = err instanceof LinkedInApiError && err.status === 401 ? 401 : 502;
    return jsonError(
      { error: msg, needsReconnect: status === 401 },
      status,
    );
  }

  // 7. Update post row
  const publishedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("posts")
    .update({
      status: "published",
      external_post_id: urn,
      external_post_url: url,
      published_at: publishedAt,
    })
    .eq("id", postId);

  if (updateErr) {
    // Post was published on LinkedIn but DB update failed — log and still
    // return success URL so the user can verify and we don't double-post.
    console.error("Post published but DB update failed:", updateErr.message);
  }

  return NextResponse.json({
    success: true,
    urn,
    url,
    published_at: publishedAt,
  });
}
