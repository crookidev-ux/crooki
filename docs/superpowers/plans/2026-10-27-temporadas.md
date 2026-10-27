# Temporadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decoración de temporada (7 temporadas) en el hero de la página de inicio, encendida a mano desde una página nueva del admin.

**Architecture:** Una fila `site_settings` en Supabase guarda la temporada activa (o ninguna). La página de inicio lee la tabla en el servidor, le pasa el id al `Hero`, y un componente cliente carga solo la decoración (CSS + SVG) de esa temporada. El admin edita modo y fechas con el cliente Supabase del navegador, como `CategoryVisibilityToggle`.

**Tech Stack:** Next.js 16.2.1 (App Router, `[locale]`), next-intl, Tailwind 4, Supabase (`@supabase/ssr`), pruebas con `node --test` (TypeScript nativo, ver `src/lib/pricing.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-27-temporadas-design.md`

## Global Constraints

- Leer `node_modules/next/dist/docs/` antes de usar `next/dynamic` o `searchParams` (AGENTS.md: esta versión de Next tiene cambios).
- Sin dependencias nuevas. Animación solo con CSS + SVG en línea.
- Nunca ofrecer producto: solo saludos. Título, subtítulo y botones del hero no cambian.
- Toda decoración: `aria-hidden="true"`, `pointer-events: none`; solo el personaje clicable tiene `pointer-events: auto` y nunca se superpone a texto ni botones (escritorio y 390 px).
- `prefers-reduced-motion: reduce` → sin animación, decoración quieta y visible.
- Paleta: vino tinto `#8b0031`, crema `#f3c78b`, blanco, oscuro `#2a0010`; Navidad añade un verde `#1f6b43`; Fiestas de Noviembre usa rojo/amarillo/verde de la bandera de Cartagena.
- Intensidad máxima = boceto aprobado `.superpowers/brainstorm/20661-1793143100/content/hero-temporadas.html` (ignorar sus textos).
- Saludos en `src/messages/es.json` y `en.json`; textos del admin solo en español.
- Trabajo en la rama `feat/temporadas`; commits locales. Push solo con OK de Cesar (`/publicar`).
- La migración se aplica en Supabase real solo con OK explícito de Cesar.

## Review Focus

- Fila de ajustes ausente, valor desconocido o error de lectura → la home se ve como hoy → test de `parseActiveSeason` (Task 1) y verificación en Task 6.
- Personaje clicable sobre los botones en celular → capturas a 390 px de las 7 (Task 6).
- Encender una temporada con otra activa → queda solo la nueva (una sola fila garantiza esto).
- Admin sin sesión → redirige a login (`requireAdmin`).
- `/en` con temporada activa → saludo en inglés.

---

> **CAMBIO 2026-10-27:** activación solo manual (ver spec, sección final). Se eliminó la lógica de fechas.

### Task 1: Tipos y tabla de ajustes

**Files:**
- Create: `src/lib/seasons.ts`, `src/lib/seasons.test.ts`
- Create: `supabase/migrations/20261027000000_site_settings_season.sql`
- Create: `src/lib/seasons.data.ts`

**Interfaces:**
- Produces:
  - `type SeasonId = "san-valentin" | "carnaval" | "semana-santa" | "amor-amistad" | "halloween" | "noviembre" | "navidad"`
  - `const SEASON_IDS: readonly SeasonId[]` (ese orden)
  - `const SEASON_NAMES_ES: Record<SeasonId, string>` (nombres para el admin)
  - `parseActiveSeason(value: unknown): SeasonId | null`
  - Tabla `site_settings(id smallint primary key default 1 check (id = 1), active_season text check (active_season in (...7 ids)), updated_at timestamptz not null default now())` con la fila `id=1, active_season=null` sembrada. RLS: SELECT público; UPDATE `auth.role() = 'authenticated'` (como `supabase/schema.sql:83`).
  - `getActiveSeason(): Promise<SeasonId | null>` (servidor; guardas como `getProducts`; error → `null`)

- [ ] Tests: `parseActiveSeason("halloween") === "halloween"`, `parseActiveSeason("pascua") === null`, `parseActiveSeason(null) === null`, `parseActiveSeason(3) === null`; `SEASON_IDS.length === 7`.
- [ ] `node --test src/lib/seasons.test.ts` falla → implementar → `npm test` pasa.
- [ ] Pedir OK para aplicar la migración en Supabase real; verificar la fila.
- [ ] Commit `feat(seasons): season types and site_settings table`.

### Task 3: Base de la decoración + Halloween y Navidad

**Files:**
- Create: `src/components/seasons/SeasonDecor.tsx` (cliente)
- Create: `src/components/seasons/SeasonIcon.tsx`
- Create: `src/components/seasons/seasons.css`
- Create: `src/components/seasons/decor/HalloweenDecor.tsx`, `src/components/seasons/decor/NavidadDecor.tsx`
- Create: `src/components/seasons/decor/Peekaboo.tsx` (personaje que se esconde al clic)

**Interfaces:**
- Consumes: `SeasonId` (Task 1).
- Produces:
  - `<SeasonDecor season={SeasonId} />`: carga con `next/dynamic` (`ssr: true`) solo el componente de esa temporada desde un mapa `Record<SeasonId, () => Promise<...>>`; `amor-amistad` usa el mismo componente que `san-valentin`. Se monta como hijo directo de la `<section>` del hero (que ya es `relative overflow-hidden`).
  - `<SeasonIcon season={SeasonId} className?: string />`: SVG de 16×16, `aria-hidden`, en `#f3c78b` (como el icono `Cookie` actual).
  - `<Peekaboo className: string; children: ReactNode />`: `<button type="button" tabIndex={-1} aria-hidden="true">`; al clic se oculta (clase `sz-hide`) 1.6 s y vuelve.
  - Clases CSS con prefijo `sz-` y keyframes en `seasons.css`; bloque `@media (prefers-reduced-motion: reduce)` que pone `animation: none` en `.sz-anim`.

- [ ] **Step 1: Implement** `SeasonDecor`, `SeasonIcon` (las 7 variantes), `Peekaboo`, `seasons.css` y las decoraciones de Halloween y Navidad tal como el spec y el boceto (Halloween: velo radial más oscuro en los bordes, 3 murciélagos, 1 telaraña en la esquina superior derecha, fantasma `Peekaboo` junto a la foto, calabaza con brillo; Navidad: ~35 copos con posiciones fijas (sin `Math.random` en el render, para evitar error de hidratación), 3 bolas colgando, elfo `Peekaboo`). En celular (`< md`) ocultar el murciélago chico y reducir la nieve a ~20 copos.
- [ ] **Step 2: Run** `npm run lint` y `npx tsc --noEmit` → sin errores.
- [ ] **Step 3: Commit** `feat(seasons): decoration layer with Halloween and Christmas`.

### Task 4: Las otras cuatro decoraciones

**Files:**
- Create: `src/components/seasons/decor/NoviembreDecor.tsx`, `CarnavalDecor.tsx`, `SemanaSantaDecor.tsx`, `CorazonesDecor.tsx` (San Valentín y Amor y Amistad)
- Modify: `src/components/seasons/SeasonDecor.tsx` (mapa)

**Interfaces:**
- Consumes: `Peekaboo`, clases `sz-` (Task 3).

- [ ] **Step 1: Implement**, según la tabla del spec: Noviembre (banderines rojo/amarillo/verde, confeti, 2 fuegos artificiales pequeños a los lados, buscapié `Peekaboo` que salta); Carnaval (serpentinas, confeti, Marimonda `Peekaboo`, sombrero de Congo con flores); Semana Santa (ramos de palma en esquinas, luz cálida, movimiento casi nulo, **sin** `Peekaboo`); Corazones (corazones subiendo despacio, cupido `Peekaboo`, sobres).
- [ ] **Step 2: Run** `npm run lint` y `npx tsc --noEmit` → sin errores.
- [ ] **Step 3: Commit** `feat(seasons): Noviembre, Carnaval, Semana Santa and hearts decorations`.

### Task 5: Hero, saludos y página del admin

**Files:**
- Modify: `src/app/[locale]/page.tsx` (leer temporada, pasarla al Hero; previsualización en desarrollo)
- Modify: `src/components/home/Hero.tsx` (prop `season`, etiqueta, `<SeasonDecor>`)
- Modify: `src/messages/es.json`, `src/messages/en.json` (namespace `seasons`)
- Create: `src/app/[locale]/admin/temporadas/page.tsx`
- Create: `src/components/admin/SeasonCard.tsx` (cliente)
- Modify: `src/components/admin/AdminNav.tsx` (enlace "Temporadas", icono `Sparkles` de lucide)

**Interfaces:**
- Consumes: `getActiveSeason`, `parseActiveSeason`, `SEASON_IDS`, `SEASON_NAMES_ES` (Task 1); `SeasonDecor`, `SeasonIcon` (Tasks 3–4).
- Produces: `Hero({ locale, season }: { locale: string; season: SeasonId | null })`.

- [ ] **Step 1: Mensajes.** Añadir a ambos JSON el namespace `seasons` con claves = `SeasonId`. ES: `"¡Feliz San Valentín!"`, `"¡Quien lo vive es quien lo goza!"`, `"Feliz Semana Santa"`, `"¡Feliz Amor y Amistad!"`, `"¡Feliz Halloween!"`, `"¡Felices Fiestas de Independencia!"`, `"¡Feliz Navidad!"`. EN: `"Happy Valentine's Day!"`, `"Live it to love it!"`, `"Happy Holy Week"`, `"Happy Love & Friendship Day!"`, `"Happy Halloween!"`, `"Happy Independence Festivities!"`, `"Merry Christmas!"`.
- [ ] **Step 2: Página de inicio.** `HomePage` lee `getActiveSeason()` en paralelo con `getProducts()`. Solo si `process.env.NODE_ENV !== "production"`, el parámetro `?temporada=<SeasonId>` (o `?temporada=ninguna`) reemplaza el resultado, para las capturas.
- [ ] **Step 3: Hero.** Con `season`: la etiqueta muestra `<SeasonIcon>` + `t("seasons.<id>")` en lugar de `Cookie` + `hero.badge`; `<SeasonDecor>` después de `<Crumbs>`. Sin `season`: idéntico a hoy.
- [ ] **Step 4: Admin.** `admin/temporadas/page.tsx` con `requireAdmin`, lee `site_settings`, muestra "Hoy se ve: <nombre>" o "Ninguna" y 7 `SeasonCard` (icono grande, nombre, interruptor con el estilo de `CategoryVisibilityToggle`). Encender → `update({ active_season: id }).eq("id", 1)`; apagar la activa → `active_season: null`. Toasts de `sonner` y `router.refresh()`.
- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` → todo en verde.
- [ ] **Step 6: Commit** `feat(seasons): seasonal hero greeting and admin page`.

### Task 6: Verificación visual y cierre

**Files:**
- Modify: `vault/Decisions.md` si existe; si no (ver memoria `project-vault-unavailable`), avisar a Cesar.

- [ ] **Step 1:** `npm run dev`; capturas con Playwright de `/es?temporada=<id>` para las 7 + `ninguna`, en 1280 px y 390 px, guardadas en el scratchpad. Revisar en cada una: ningún adorno sobre título, texto o botones; sin scroll horizontal; personaje clicable funciona; `/en` muestra el saludo en inglés.
- [ ] **Step 2:** Con `prefers-reduced-motion: reduce` (Playwright `emulateMedia`), confirmar que nada se mueve.
- [ ] **Step 3:** Admin `/es/admin/temporadas`: encender Halloween → la home lo muestra; encender Navidad → Halloween se apaga; apagar → home como hoy. Dejar en "Ninguna" al terminar (la base es la real).
- [ ] **Step 4:** Simular tabla inaccesible (renombrar temporalmente el `from("seasons")` o cortar env en local) → la home carga como hoy. Revertir.
- [ ] **Step 5:** `graphify update .`
- [ ] **Step 6:** Mostrar capturas a Cesar y esperar OK antes de `/publicar`.
