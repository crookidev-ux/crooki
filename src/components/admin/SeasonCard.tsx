"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SeasonIcon from "@/components/seasons/SeasonIcon";
import { SEASON_NAMES_ES, seasonSaved, type SeasonId } from "@/lib/seasons";

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
      className="bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 transition-colors"
      style={{ borderColor: active ? "#8b0031" : "#f3f4f6" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: active ? "#8b0031" : "#fdf2f4", color: active ? "#f3c78b" : "#8b0031" }}
      >
        <SeasonIcon season={season} className="w-6 h-6" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{active ? "Se ve en la página de inicio" : "Apagada"}</p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none" title={`Activar ${name}`}>
        <div className="relative">
          <input
            type="checkbox"
            checked={active}
            onChange={handleToggle}
            disabled={saving || disabled}
            className="sr-only"
            aria-label={`Activar ${name}`}
          />
          <div
            className="w-12 h-6 rounded-full transition-colors"
            style={{ backgroundColor: active ? "#8b0031" : "#d1d5db", opacity: saving || disabled ? 0.6 : 1 }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: active ? "translateX(26px)" : "translateX(2px)" }}
            />
          </div>
        </div>
      </label>
    </div>
  );
}
