"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { SeasonId } from "@/lib/seasons";
import "./seasons.css";

// Each season lives in its own module, so a visit only downloads the
// decoration that is switched on. A module exports two parts:
//  - Ambient: fills the hero behind the content (place after <Crumbs>).
//  - Companion: the character beside the photo (place inside its wrapper).
type DecorModule = { Ambient: ComponentType; Companion: ComponentType };
type Loader = () => Promise<DecorModule>;

const LOADERS: Record<SeasonId, Loader> = {
  halloween: () => import("./decor/Halloween"),
  navidad: () => import("./decor/Navidad"),
  noviembre: () => import("./decor/Noviembre"),
  carnaval: () => import("./decor/Carnaval"),
  "semana-santa": () => import("./decor/SemanaSanta"),
  "san-valentin": () => import("./decor/Corazones"),
  "amor-amistad": () => import("./decor/Corazones"),
};

const AMBIENT = Object.fromEntries(
  Object.entries(LOADERS).map(([id, load]) => [id, dynamic(() => load().then((m) => m.Ambient))]),
) as Record<SeasonId, ComponentType>;

const COMPANION = Object.fromEntries(
  Object.entries(LOADERS).map(([id, load]) => [id, dynamic(() => load().then((m) => m.Companion))]),
) as Record<SeasonId, ComponentType>;

export default function SeasonDecor({
  season,
  part,
}: {
  season: SeasonId;
  part: "ambient" | "companion";
}) {
  const Part = (part === "ambient" ? AMBIENT : COMPANION)[season];
  return <Part />;
}
