import { requireAdmin } from "@/lib/admin-auth";
import SocialPostForm from "@/components/admin/SocialPostForm";
import SocialPostDelete from "@/components/admin/SocialPostDelete";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { Clapperboard, TriangleAlert } from "lucide-react";
import { InstagramIcon, TikTokIcon } from "@/components/layout/SocialIcons";
import { latestPosts, SOCIAL_LIMITS, type SocialPost } from "@/lib/social";
import { socialFileUrl } from "@/lib/social.data";

export default async function AdminSocialPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);

  const { data, error } = await supabase
    .from("social_posts")
    .select("id, network, post_url, video_path, poster_path, caption, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const posts = (data as SocialPost[] | null) ?? [];
  const shown = new Set(latestPosts(posts).map((p) => p.id));

  return (
    <div className="adm-page flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: "Sitio web" }, { label: "Videos de redes" }]}
        title="Videos de redes"
        description={`Los videos se ven en la sección «Síguenos» del inicio, sin sonido y en bucle. Se muestran los últimos ${SOCIAL_LIMITS.instagram} de Instagram y los últimos ${SOCIAL_LIMITS.tiktok} de TikTok.`}
      />

      {error ? (
        <div className="adm-alert warn" role="alert">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <b>No se pudo leer la lista de posts.</b>
            Revisa que la migración <code>20261103000000_social_posts.sql</code> esté aplicada en Supabase.
          </div>
        </div>
      ) : (
        <SocialPostForm />
      )}

      <section aria-labelledby="social-published">
        <h2 id="social-published" className="mb-3 text-lg font-semibold">Publicados</h2>
        {posts.length === 0 ? (
          <div className="adm-card">
            <EmptyState icon={Clapperboard}>Todavía no hay videos. Agrega el primero arriba.</EmptyState>
          </div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {posts.map((p) => (
              <li key={p.id} className="adm-card flex flex-col overflow-hidden">
                {/* Admin-only thumbnail; plain img keeps the poster as uploaded. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={socialFileUrl(p.poster_path)} alt="" className={`w-full aspect-[9/16] object-cover ${shown.has(p.id) ? "" : "opacity-40"}`} />
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[32px] items-center gap-1.5 text-sm font-semibold text-[color:var(--adm-wine)] hover:underline">
                    {p.network === "instagram" ? <InstagramIcon className="w-3.5 h-3.5" /> : <TikTokIcon className="w-3.5 h-3.5" />}
                    {p.network === "instagram" ? "Instagram" : "TikTok"}
                  </a>
                  {p.caption && <p className="line-clamp-2 text-sm text-[color:var(--adm-ink-2)]">{p.caption}</p>}
                  <p className="adm-sub">
                    {new Date(p.created_at).toLocaleDateString("es-CO")}
                    {!shown.has(p.id) && " · ya no se muestra"}
                  </p>
                  <div className="mt-auto">
                    <SocialPostDelete id={p.id} videoPath={p.video_path} posterPath={p.poster_path} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
