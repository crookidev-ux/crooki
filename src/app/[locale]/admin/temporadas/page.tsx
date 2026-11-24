import { Sparkles, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import SeasonCard from "@/components/admin/SeasonCard";
import { PageHeader } from "@/components/admin/ui";
import { SEASON_IDS, SEASON_NAMES_ES, parseActiveSeason } from "@/lib/seasons";

export default async function AdminSeasonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { supabase } = await requireAdmin(locale);

  const { data, error } = await supabase
    .from("site_settings")
    .select("active_season")
    .eq("id", 1)
    .maybeSingle();
  const active = parseActiveSeason(data?.active_season);

  return (
    <div className="adm-page">
      <PageHeader
        crumbs={[{ label: "Sitio web" }, { label: "Temporadas" }]}
        title="Temporadas"
        description="Decora la página de inicio para una fecha especial. Solo puede haber una activa: al encender otra, la anterior se apaga."
      />

      {error || !data ? (
        <div className="adm-alert warn" role="alert">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <b>No se pudo leer el ajuste de temporadas.</b>
            Revisa que la migración <code>20261027000000_site_settings_season.sql</code> esté aplicada en Supabase.
          </div>
        </div>
      ) : (
        <div className={`adm-alert ${active ? "info" : "warn"}`} role="status">
          <Sparkles aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>{active ? `Hoy se ve: ${SEASON_NAMES_ES[active]}` : "Hoy se ve: ninguna temporada"}</div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SEASON_IDS.map((id) => (
          <SeasonCard key={id} season={id} active={active === id} disabled={!!error || !data} />
        ))}
      </div>
    </div>
  );
}
