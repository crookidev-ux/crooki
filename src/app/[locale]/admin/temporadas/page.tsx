import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import SeasonCard from "@/components/admin/SeasonCard";
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900">Temporadas</h1>
        <p className="text-gray-500 mt-1">
          Decora la página de inicio para una fecha especial. Solo puede haber una activa: al encender
          otra, la anterior se apaga.
        </p>
      </div>

      {error || !data ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No se pudo leer el ajuste de temporadas. Revisa que la migración
          <code className="mx-1">20261027000000_site_settings_season.sql</code>
          esté aplicada en Supabase.
        </div>
      ) : (
        <div
          className="mb-6 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold"
          style={{ backgroundColor: active ? "#8b0031" : "#f3f4f6", color: active ? "#fff" : "#4b5563" }}
        >
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          {active ? `Hoy se ve: ${SEASON_NAMES_ES[active]}` : "Hoy se ve: ninguna temporada"}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {SEASON_IDS.map((id) => (
          <SeasonCard key={id} season={id} active={active === id} disabled={!!error || !data} />
        ))}
      </div>
    </div>
  );
}
