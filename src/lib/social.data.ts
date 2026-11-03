import { latestPosts, SOCIAL_BUCKET, SOCIAL_LIMITS, type SocialPost } from "./social";

// Latest posts for the home, read on every request. Any failure (no Supabase
// env, missing table, network) means "no posts": the section is not shown.
export async function getLatestSocialPosts(): Promise<SocialPost[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_")) {
    return [];
  }
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const columns = "id, network, post_url, video_path, poster_path, caption, created_at";
    const [ig, tt] = await Promise.all(
      (["instagram", "tiktok"] as const).map((network) =>
        supabase
          .from("social_posts")
          .select(columns)
          .eq("network", network)
          .order("created_at", { ascending: false })
          .limit(SOCIAL_LIMITS[network]),
      ),
    );
    if (ig.error || tt.error) return [];
    return latestPosts([...(ig.data ?? []), ...(tt.data ?? [])] as SocialPost[]);
  } catch {
    return [];
  }
}

/** Public URL of a file in the social bucket. */
export function socialFileUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SOCIAL_BUCKET}/${path}`;
}
