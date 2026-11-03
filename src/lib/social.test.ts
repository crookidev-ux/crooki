import { test } from "node:test";
import assert from "node:assert/strict";
import { latestPosts, parseSocialUrl, videoFileProblem, type SocialPost } from "./social.ts";

test("Instagram posts and reels, without the share query string", () => {
  assert.deepEqual(parseSocialUrl("https://www.instagram.com/reel/DBx1_aB-cd/?igsh=MWJj"), {
    network: "instagram",
    url: "https://www.instagram.com/reel/DBx1_aB-cd/",
  });
  assert.deepEqual(parseSocialUrl("  https://instagram.com/p/CzYx12/ "), {
    network: "instagram",
    url: "https://www.instagram.com/p/CzYx12/",
  });
});

test("TikTok videos and short share links", () => {
  assert.deepEqual(parseSocialUrl("https://www.tiktok.com/@crookibakebar/video/7430000000000000000?_r=1&_t=x"), {
    network: "tiktok",
    url: "https://www.tiktok.com/@crookibakebar/video/7430000000000000000",
  });
  assert.deepEqual(parseSocialUrl("https://vm.tiktok.com/ZMabc123/"), {
    network: "tiktok",
    url: "https://vm.tiktok.com/ZMabc123/",
  });
});

test("anything else is rejected", () => {
  for (const bad of [
    "",
    "no es un enlace",
    "https://www.instagram.com/crookibakebar",
    "https://www.tiktok.com/@crookibakebar",
    "https://instagram.com.evil.com/p/abc/",
    "https://evil.com/https://www.instagram.com/p/abc/",
    "javascript:alert(1)",
    "ftp://www.tiktok.com/@a/video/1",
  ]) {
    assert.equal(parseSocialUrl(bad), null, bad);
  }
});

const post = (network: SocialPost["network"], day: number): SocialPost => ({
  id: `${network}-${day}`,
  network,
  post_url: "",
  video_path: "videos/x.mp4",
  poster_path: "posters/x.webp",
  caption: "",
  created_at: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`,
});

test("latestPosts keeps the newest 6 Instagram and 4 TikTok, newest first", () => {
  const all = [
    ...Array.from({ length: 8 }, (_, i) => post("instagram", i + 1)),
    ...Array.from({ length: 6 }, (_, i) => post("tiktok", i + 10)),
  ];
  const out = latestPosts(all);
  assert.equal(out.filter((p) => p.network === "instagram").length, 6);
  assert.equal(out.filter((p) => p.network === "tiktok").length, 4);
  assert.equal(out[0].id, "tiktok-15");
  assert.ok(!out.some((p) => p.id === "instagram-1" || p.id === "instagram-2"));
});

test("videoFileProblem checks type and the 50 MB limit", () => {
  assert.equal(videoFileProblem({ size: 10_000_000, type: "video/mp4" }), null);
  assert.equal(videoFileProblem({ size: 10_000_000, type: "video/quicktime" }), null);
  assert.equal(videoFileProblem({ size: 10_000_000, type: "image/gif" }), "type");
  assert.equal(videoFileProblem({ size: 60 * 1024 * 1024, type: "video/mp4" }), "size");
});
