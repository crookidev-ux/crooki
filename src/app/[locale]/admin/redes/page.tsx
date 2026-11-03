import { requireAdmin } from "@/lib/admin-auth";
import SocialPostForm from "@/components/admin/SocialPostForm";
import SocialPostDelete from "@/components/admin/SocialPostDelete";
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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black text-gray-900">Redes sociales</h1>
        <p className="text-gray-500 mt-1">
          Los videos se ven en la sección «Síguenos» del inicio, sin sonido y en bucle. Se muestran los
          últimos {SOCIAL_LIMITS.instagram} de Instagram y los últimos {SOCIAL_LIMITS.tiktok} de TikTok.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudo leer la lista de posts. Revisa que la migración
          <code className="mx-1">20261103000000_social_posts.sql</code>
          esté aplicada en Supabase.
        </div>
      ) : (
        <SocialPostForm />
      )}

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Publicados</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay posts. Agrega el primero arriba.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {posts.map((p) => (
              <li key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {/* Admin-only thumbnail; plain img keeps the poster as uploaded. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={socialFileUrl(p.poster_path)} alt="" className={`w-full aspect-[9/16] object-cover ${shown.has(p.id) ? "" : "opacity-40"}`} />
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b0031] hover:underline">
                    {p.network === "instagram" ? <InstagramIcon className="w-3.5 h-3.5" /> : <TikTokIcon className="w-3.5 h-3.5" />}
                    {p.network === "instagram" ? "Instagram" : "TikTok"}
                  </a>
                  {p.caption && <p className="text-xs text-gray-600 line-clamp-2">{p.caption}</p>}
                  <p className="text-[11px] text-gray-400">
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
