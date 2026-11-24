"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SeasonIcon from "@/components/seasons/SeasonIcon";
import { SEASON_NAMES_ES, seasonSaved, type SeasonId } from "@/lib/seasons";
import { Switch } from "./controls";

interface Props {
  season: SeasonId;
  active: boolean;
  disabled?: boolean;
}

// One card per season on /admin/temporadas. Only one season can be on: the
// setting is a single row, so switching one on replaces the previous one.
export default function SeasonCard({ season, active, disabled = false }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const name = SEASON_NAMES_ES[season];

  const handleToggle = async () => {
    if (saving || disabled) return;
    setSaving(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .update({ active_season: active ? null : season, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("id");

    if (!seasonSaved(error, data)) {
      toast.error(error ? `Error: ${error.message}` : "No se guardó: revisa tu sesión o el ajuste de temporadas.");
    } else {
      toast.success(active ? `${name} apagada` : `${name} activa en la página de inicio`);
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <div
      className="adm-card flex items-center gap-4 p-4"
      style={active ? { borderColor: "var(--adm-wine)", boxShadow: "inset 0 0 0 1px var(--adm-wine)" } : undefined}
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
          active ? "bg-[color:var(--adm-wine)] text-[color:var(--adm-gold)]" : "bg-[color:var(--adm-wine-50)] text-[color:var(--adm-wine)]"
        }`}
      >
        <SeasonIcon season={season} className="h-6 w-6" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        <p className="adm-sub">{active ? "Se ve en la página de inicio" : "Apagada"}</p>
      </div>

      <Switch checked={active} onChange={handleToggle} disabled={saving || disabled} label={`Activar ${name}`} />
    </div>
  );
}
