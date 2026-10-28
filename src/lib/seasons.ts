// Seasonal home decoration: the admin switches one season on by hand (or
// none) and the home hero dresses up for it. Only a greeting changes in the
// copy — seasons never promise products.

export const SEASON_IDS = [
  "san-valentin",
  "carnaval",
  "semana-santa",
  "amor-amistad",
  "halloween",
  "noviembre",
  "navidad",
] as const;

export type SeasonId = (typeof SEASON_IDS)[number];

export const SEASON_NAMES_ES: Record<SeasonId, string> = {
  "san-valentin": "San Valentín",
  carnaval: "Carnaval de Barranquilla",
  "semana-santa": "Semana Santa",
  "amor-amistad": "Amor y Amistad",
  halloween: "Halloween",
  noviembre: "Fiestas de Noviembre",
  navidad: "Navidad",
};

export function parseActiveSeason(value: unknown): SeasonId | null {
  return typeof value === "string" && (SEASON_IDS as readonly string[]).includes(value)
    ? (value as SeasonId)
    : null;
}

// Supabase returns no error when an update matches zero rows (row missing,
// or RLS blocked it), so a save only counts if a row came back.
export function seasonSaved(error: unknown, rows: unknown[] | null): boolean {
  return !error && Array.isArray(rows) && rows.length > 0;
}
