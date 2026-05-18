import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSecret, deleteSecret, VaultError } from "@/lib/vault";
import {
  decodeState,
  exchangeCodeForToken,
  fetchUserInfo,
  LinkedInOAuthError,
  type TokenResponse,
  type UserInfo,
} from "@/lib/linkedin-oauth";

// GET /api/auth/linkedin/callback?code=<...>&state=<...>
//
// LinkedIn redirects here after the user clicks Allow.
// (ADR-0017 D6, deliverable 9.2.5)
//
// 1. Read code+state from query (or error if LinkedIn returned one)
// 2. Verify state HMAC signature + timestamp (CSRF check, stateless — no
//    cookie needed; signature proves the state was issued by us)
// 3. Auth check + brand ownership re-verification
// 4. Exchange code → tokens
// 5. Fetch user profile (sub + name) for display
// 6. Store tokens in Vault → get secret_id
// 7. UPSERT brand_oauth_tokens (clean up old vault secret first if reconnect)
// 8. Redirect to /brands/[id]?linkedin=connected

function redirectToBrand(origin: string, brandId: string, params: Record<string, string>): Response {
  const url = new URL(`/brands/${brandId}`, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

function redirectToDashboard(origin: string, params: Record<string, string>): Response {
  const url = new URL("/dashboard", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const linkedInError = url.searchParams.get("error");
  const linkedInErrorDesc = url.searchParams.get("error_description");

  // LinkedIn returned an error (user denied, etc.)
  if (linkedInError) {
    return redirectToDashboard(url.origin, {
      linkedin_error: linkedInError,
      message: linkedInErrorDesc ?? "LinkedIn authorization failed",
    });
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state query param" },
      { status: 400 },
    );
  }

  // HMAC signature on the state token is the CSRF check.
  let payload: { brandId: string };
  try {
    payload = decodeState(state);
  } catch (err) {
    const msg = err instanceof LinkedInOAuthError ? err.message : "Bad state";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  // Re-verify auth + brand ownership (defense in depth)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", payload.brandId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Exchange code → tokens
  let tokens: TokenResponse;
  try {
    tokens = await exchangeCodeForToken(code);
  } catch (err) {
    const msg = err instanceof LinkedInOAuthError ? err.message : "Token exchange failed";
    return redirectToBrand(url.origin, payload.brandId, {
      linkedin_error: "token_exchange",
      message: msg,
    });
  }

  // Fetch user profile for account_handle display
  let userInfo: UserInfo;
  try {
    userInfo = await fetchUserInfo(tokens.access_token);
  } catch (err) {
    const msg = err instanceof LinkedInOAuthError ? err.message : "Failed to fetch profile";
    return redirectToBrand(url.origin, payload.brandId, {
      linkedin_error: "userinfo",
      message: msg,
    });
  }

  // Compute absolute expires_at from relative expires_in
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Build vault payload. user_sub is needed later when publishing posts —
  // capturing here avoids an extra /v2/userinfo call on every publish.
  const vaultPayload: Record<string, string> = {
    access_token: tokens.access_token,
    expires_at: expiresAt,
    scope: tokens.scope,
    user_sub: userInfo.sub,
  };
  if (tokens.refresh_token) {
    vaultPayload.refresh_token = tokens.refresh_token;
  }

  const service = createServiceRoleClient();

  // If reconnecting: delete old vault secret first to avoid orphans
  const { data: existing } = await service
    .from("brand_oauth_tokens")
    .select("vault_secret_id")
    .eq("brand_id", payload.brandId)
    .eq("platform", "linkedin")
    .maybeSingle();

  if (existing?.vault_secret_id) {
    await deleteSecret(existing.vault_secret_id).catch((err) => {
      console.error("Failed to delete old vault secret (continuing):", err);
    });
  }

  // Store new tokens in Vault
  let secretId: string;
  try {
    secretId = await createSecret(
      vaultPayload,
      `linkedin-brand-${payload.brandId}`,
      `LinkedIn OAuth token for brand ${payload.brandId}`,
    );
  } catch (err) {
    const msg = err instanceof VaultError ? err.message : "Vault write failed";
    return redirectToBrand(url.origin, payload.brandId, {
      linkedin_error: "vault",
      message: msg,
    });
  }

  // UPSERT brand_oauth_tokens
  const accountHandle = userInfo.name ?? userInfo.email ?? userInfo.sub;
  const scopes = tokens.scope.split(/\s+/).filter(Boolean);

  const { error: tokenErr } = await service
    .from("brand_oauth_tokens")
    .upsert(
      {
        brand_id: payload.brandId,
        platform: "linkedin",
        account_handle: accountHandle,
        vault_secret_id: secretId,
        scopes,
        connected_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: "active",
      },
      { onConflict: "brand_id,platform" },
    );

  if (tokenErr) {
    // Roll back vault secret if DB write failed
    await deleteSecret(secretId).catch(() => {});
    return redirectToBrand(url.origin, payload.brandId, {
      linkedin_error: "db",
      message: tokenErr.message,
    });
  }

  return redirectToBrand(url.origin, payload.brandId, { linkedin: "connected" });
}
