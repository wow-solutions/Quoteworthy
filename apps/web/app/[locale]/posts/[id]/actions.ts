"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_CONTENT_LEN = 5000;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePostContent(
  postId: string,
  text: string,
): Promise<ActionResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Content cannot be empty" };
  if (trimmed.length > MAX_CONTENT_LEN) {
    return { ok: false, error: `Max ${MAX_CONTENT_LEN} characters` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: post } = await supabase
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status === "published") {
    return { ok: false, error: "Cannot edit a published post" };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      content_text: trimmed,
      detection_score: null,
      detection_breakdown: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/posts");
  return { ok: true };
}

export type BulkDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function bulkDeletePosts(
  postIds: string[],
): Promise<BulkDeleteResult> {
  if (postIds.length === 0) return { ok: true, deleted: 0 };
  if (postIds.length > 200) {
    return { ok: false, error: "Too many posts in one batch (max 200)" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // RLS filters to user's brands. Status filter prevents accidental published delete.
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .in("id", postIds)
    .neq("status", "published")
    .select("id");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/posts");
  return { ok: true, deleted: data?.length ?? 0 };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: post } = await supabase
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, error: "Post not found" };
  if (post.status === "published") {
    return { ok: false, error: "Cannot delete a published post" };
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/posts");
  return { ok: true };
}

