import {
  Drama,
  Ghost,
  Heart,
  HeartHandshake,
  PartyPopper,
  TreePalm,
  TreePine,
  type LucideIcon,
} from "lucide-react";
import type { SeasonId } from "@/lib/seasons";

// Same icon family as the hero badge's Cookie icon, so the badge keeps its
// look when a season replaces it.
const ICONS: Record<SeasonId, LucideIcon> = {
  "san-valentin": Heart,
  carnaval: Drama,
  "semana-santa": TreePalm,
  "amor-amistad": HeartHandshake,
  halloween: Ghost,
  noviembre: PartyPopper,
  navidad: TreePine,
};

export default function SeasonIcon({
  season,
  className = "w-4 h-4",
}: {
  season: SeasonId;
  className?: string;
}) {
  const Icon = ICONS[season];
  return <Icon className={className} aria-hidden="true" />;
}
