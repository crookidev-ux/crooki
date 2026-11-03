// Pure helpers for the home's "Síguenos" section (unit-tested with node:test).
export type SocialNetwork = "instagram" | "tiktok";

export type SocialPost = {
  id: string;
  network: SocialNetwork;
  post_url: string;
  video_path: string;
  poster_path: string;
  caption: string;
  created_at: string;
};

/** How many of each network the home shows (newest first). */
export const SOCIAL_LIMITS: Record<SocialNetwork, number> = { instagram: 6, tiktok: 4 };

export const SOCIAL_BUCKET = "social-media";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_CAPTION = 300;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

const INSTAGRAM_POST = /^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?$/;
const TIKTOK_VIDEO = /^\/@[A-Za-z0-9._-]+\/(video|photo)\/\d+\/?$/;
const TIKTOK_SHORT = /^\/[A-Za-z0-9]+\/?$/;

/**
 * The network of a pasted post link and the link without tracking query
 * strings, or null when it is not an Instagram post/reel or a TikTok video.
 */
export function parseSocialUrl(raw: string): { network: SocialNetwork; url: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  if ((host === "instagram.com" || host === "www.instagram.com") && INSTAGRAM_POST.test(path)) {
    return { network: "instagram", url: `https://www.instagram.com${path}` };
  }
  if ((host === "tiktok.com" || host === "www.tiktok.com" || host === "m.tiktok.com") && TIKTOK_VIDEO.test(path)) {
    return { network: "tiktok", url: `https://www.tiktok.com${path}` };
  }
  // Short share links from the app (vm./vt.tiktok.com/XXXX).
  if ((host === "vm.tiktok.com" || host === "vt.tiktok.com") && TIKTOK_SHORT.test(path)) {
    return { network: "tiktok", url: `https://${host}${path}` };
  }
  return null;
}

/** Newest first, at most SOCIAL_LIMITS per network, both networks interleaved by date. */
export function latestPosts(posts: SocialPost[]): SocialPost[] {
  const sorted = [...posts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const count: Record<SocialNetwork, number> = { instagram: 0, tiktok: 0 };
  return sorted.filter((p) => {
    if (count[p.network] >= SOCIAL_LIMITS[p.network]) return false;
    count[p.network] += 1;
    return true;
  });
}

/** Problem with a chosen video file, or null when it can be uploaded. */
export function videoFileProblem(file: { size: number; type: string }): "type" | "size" | null {
  if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > MAX_VIDEO_BYTES) return "size";
  return null;
}
