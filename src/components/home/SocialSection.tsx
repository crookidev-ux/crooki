import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { INSTAGRAM_URL, InstagramIcon, TIKTOK_URL, TikTokIcon } from "@/components/layout/SocialIcons";
import { socialFileUrl } from "@/lib/social.data";
import type { SocialPost } from "@/lib/social";
import SocialVideo from "./SocialVideo";

const BRAND = "#8b0031";

// "Síguenos": the latest Instagram and TikTok clips, uploaded in /admin/redes.
// Each card opens the original post. Hidden while there are no posts.
export default async function SocialSection({ locale, posts }: { locale: string; posts: SocialPost[] }) {
  if (posts.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "social" });

  return (
    <section aria-labelledby="social-title" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold tracking-widest uppercase" style={{ color: BRAND }}>
              @crookibakebar
            </p>
            <h2 id="social-title" className="text-3xl sm:text-4xl font-bold mt-1" style={{ color: BRAND }}>
              {t("title")}
            </h2>
            <p className="text-gray-600 mt-2 max-w-xl">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold hover:bg-[#fdf8f0] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              <InstagramIcon className="w-4 h-4" />
              Instagram
            </a>
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold hover:bg-[#fdf8f0] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              <TikTokIcon className="w-4 h-4" />
              TikTok
            </a>
          </div>
        </div>

        {/* Swipeable row on phones; the row scrolls inside itself, never the page. */}
        <ul className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-4 px-4 [scrollbar-width:thin]">
          {posts.map((post) => {
            const isIg = post.network === "instagram";
            const network = isIg ? "Instagram" : "TikTok";
            return (
              <li key={post.id} className="snap-start shrink-0 w-[62%] sm:w-[220px]">
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("open", { network })}
                  className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031] rounded-2xl"
                >
                  <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#fdf8f0] shadow-sm">
                    <SocialVideo src={socialFileUrl(post.video_path)} poster={socialFileUrl(post.poster_path)} />
                    <span
                      className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center"
                      style={{ color: BRAND }}
                      aria-hidden="true"
                    >
                      {isIg ? <InstagramIcon className="w-4 h-4" /> : <TikTokIcon className="w-4 h-4" />}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="mt-3 text-sm text-gray-700 line-clamp-2">{post.caption}</p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold group-hover:underline" style={{ color: BRAND }}>
                    {t("view_on", { network })}
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
