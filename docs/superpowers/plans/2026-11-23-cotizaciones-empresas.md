# Cotizaciones para empresas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** página `/empresas` con el catálogo navideño, un formulario que abre WhatsApp con la cotización armada, un bloque en el inicio y un enlace en el footer.

**Architecture:**
- Todo es estático y del lado del cliente. No hay tablas, API ni Turnstile, porque nada llega al servidor.
- Los datos del catálogo viven en un archivo TS. El armado del mensaje es una función pura en `src/lib/whatsapp.ts`, con prueba `node:test`.
- Los textos van en el namespace `business` de `src/messages/{es,en}.json`.

**Tech Stack:** Next.js 16.4 (App Router; lee `node_modules/next/dist/docs/` antes de usar APIs nuevas), next-intl 4, Tailwind, lucide-react, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-cotizaciones-empresas-design.md`

## Global Constraints
- **Ruta:** `/empresas` en los dos idiomas (`/en/empresas`). `routing.ts` no usa `pathnames`, igual que `/menu` y `/merch`. No agregar rutas traducidas.
- **Textos:** cada texto visible va en `es.json` y en `en.json`. Los nombres de producto del catálogo (Holiday gift, Share box…) son nombres propios y no se traducen.
- **Mensaje de WhatsApp:** siempre en español (lo lee la tienda), con `WHATSAPP_NUMBER`.
- **Botón:** «Continuar en WhatsApp». Nunca «Recibido» ni «Enviado».
- **Ley 1581:** línea bajo el botón: «Tus datos solo viajan en el mensaje de WhatsApp. Política de datos», con enlace a `/legal/politica-de-datos`.
- **Helados:** fuera de `/empresas`, porque el catálogo no los incluye.
- **FAQ:** solo lo que confirma el catálogo. Lo demás se responde con «pregúntanos por WhatsApp».
- **Imágenes:** webp, de 1200 px de ancho o menos, con `next/image`. `images.unoptimized` está activo, así que el tamaño final lo decide el archivo.
- **Botones:** píldora de 44 px de alto o más (`px-8 py-4 rounded-full`, como `Hero.tsx:51`). No usar `ui/button` en su tamaño por defecto (32 px).
- **Colores:** vino `#8b0031`, crema `#fdf8f0`, dorado `#f3c78b`.

## Review Focus
- **Comentario con saltos de línea, emojis o `&`/`#`:** el mensaje sale intacto, porque `encodeURIComponent` codifica todo. Se prueba en la Tarea 1.
- **Comentario de 5.000 caracteres:** se recorta a 500 para que la URL de `wa.me` no falle. Se prueba en la Tarea 1.
- **Cantidad 0, negativa o vacía, o fecha pasada:** el formulario no deja continuar y el error sale junto al campo. La cantidad mínima es 1 y la fecha mínima es hoy. Se verifica en la Tarea 4.
- **WhatsApp no se abre (bloqueador de ventanas o escritorio sin app):** aparece el enlace «¿No se abrió? Toca aquí» con la misma URL. Se verifica en la Tarea 4.
- **Con la temporada activa «navidad»:** el bloque del inicio cambia a título e ícono navideños. Con cualquier otra temporada o sin temporada, muestra «Para empresas». Se verifica en la Tarea 6 con `?temporada=navidad` y `?temporada=ninguna`.

---

### Task 1: Armar el mensaje de cotización

**Files:**
- Modify: `src/lib/whatsapp.ts` (agregar al final)
- Test: `src/lib/whatsapp.test.ts` (agregar al final)

**Interfaces:**
- Produces:
  ```ts
  export interface BusinessQuote {
    company: string; contact: string; occasion: string; product: string;
    quantity: number; date: string; // YYYY-MM-DD
    city?: string; budget?: string; logo: boolean; comments?: string;
  }
  export function buildBusinessQuoteMessage(q: BusinessQuote): string
  export function buildBusinessQuoteUrl(q: BusinessQuote): string
  ```

- [ ] **Step 1: Escribir las pruebas que fallan**
  1. `buildBusinessQuoteMessage` con todos los campos. El texto es exactamente:
     ```
     Hola Crooki, quiero cotizar para mi empresa.
     Empresa: Acme SAS
     Contacto: Ana Pérez
     Ocasión: Regalo de fin de año
     Producto: Holiday gift
     Cantidad: 30
     Fecha de entrega: 2026-12-15
     Ciudad o lugar: Bocagrande
     Presupuesto por unidad: 50.000
     Quiero preguntar por personalización con nuestro logo.
     Comentarios: Sin nueces
     (Origen: web /empresas)
     ```
  2. Sin los opcionales y con `logo: false`: el mensaje no trae las líneas de ciudad, presupuesto, logo ni comentarios.
  3. Un comentario de 600 caracteres sale recortado a 500, y cada uno de los otros campos de texto a 120.
  4. `buildBusinessQuoteUrl` empieza por `https://wa.me/${WHATSAPP_NUMBER}?text=`, y `decodeURIComponent` del parámetro devuelve exactamente el mensaje, incluso con `&`, `#`, `\n` y emoji en los comentarios.

- [ ] **Step 2:** `npm test` → FAIL (la función no existe).
- [ ] **Step 3: Implementar.** Recortar cada campo con `trim()` y luego `slice`. Omitir las líneas opcionales vacías. La URL usa el mismo patrón que `buildWhatsAppOrderUrl` (`whatsapp.ts:118-119`).
- [ ] **Step 4:** `npm test` → PASS, y las pruebas anteriores siguen pasando.
- [ ] **Step 5:** commit `feat(empresas): build the WhatsApp business quote message`.

### Task 2: Catálogo (datos, imágenes y PDF)

**Files:**
- Create: `src/lib/business-catalog.ts`
- Create: `public/images/empresas/*.webp` (7 imágenes)
- Create: `public/catalogo-empresas-navidad-2026.pdf`, una copia de `docs/Crooki_Institucional_Navidad2026.pdf` (7,6 MB, ya reparada)
- Modify: `.gitignore` → agregar `/docs/*.pdf`. El original queda local y la copia publicada vive en `public/`.

**Interfaces:**
- Produces:
  ```ts
  export interface BusinessProduct { id: string; name: string; price: string; image?: string; featured?: boolean }
  export const BUSINESS_PRODUCTS: BusinessProduct[]
  export const BUSINESS_CATALOG_PDF = "/catalogo-empresas-navidad-2026.pdf"
  export const BUSINESS_HERO_IMAGE = "/images/empresas/cajas-navidad.webp"
  ```
  - `price` es el texto que se muestra, por ejemplo `"$120.000"` o `"desde $41.000"`. Se escribe igual en los dos idiomas.

- [ ] **Step 1: Extraer las imágenes con PyMuPDF.** Usar un script en el scratchpad, no en el repo. Recortar la foto de cada página sin el texto superpuesto (o la página entera cuando la foto ocupa todo) y guardar en webp de 1200 px de ancho o menos, a calidad ~80:
  - `cajas-navidad.webp` (pág. 2, va en el inicio)
  - `holiday-gift.webp` (pág. 11)
  - `christmas-mug.webp` (pág. 9)
  - `share-box.webp` (pág. 8)
  - `cookie-box.webp` (pág. 15)
  - `mini-cookies.webp` (pág. 7)
  - `chocobombas.webp` (pág. 3)

  Revisar cada imagen a mano: que no tenga precio ni marca de agua y que pese 200 KB o menos.

- [ ] **Step 2: Escribir `BUSINESS_PRODUCTS`** con los 21 productos del catálogo, en el orden del PDF. Los 6 con imagen llevan `featured: true`.

  | id | nombre | precio |
  |---|---|---|
  | chocobombas | Chocobombas | desde $23.500 |
  | kit-casita | Kit armable | $56.000 |
  | cookie-kit | Cookie kit | $41.000 |
  | mini-cookies | Mini cookies | desde $45.000 |
  | share-box | Share box | $59.900 |
  | christmas-mug | Christmas mug | $35.000 |
  | fresas | Fresas navideñas | $89.900 |
  | holiday-gift | Holiday gift | $120.000 |
  | mini-brownies-12 | Mini brownies x12 | $36.000 |
  | cookies | Cookies | $6.500 c/u |
  | christmas-brownie | Christmas brownie | $10.000 c/u |
  | cookie-box | Cookie box | desde $41.000 |
  | perfect-duo | Perfect duo | $25.900 |
  | chocobomba | Chocobomba | $10.000 c/u |
  | mini-duo | Mini duo | $19.500 |
  | mini-gift | Mini gift | $18.500 |
  | mini-mix | Mini mix | $18.000 |
  | mini-brownies-8 | Mini brownies x8 | $18.000 |
  | brownie-cake | Brownie cake | $89.900 |
  | brownie-box | Brownie box | $48.000 |
  | cinnamon-roll | Cinnamon roll | desde $15.000 |

- [ ] **Step 3:** `git check-ignore docs/Crooki_Institucional_Navidad2026.pdf` → debe salir ignorado. `ls -la public/catalogo-empresas-navidad-2026.pdf` → 7563232 bytes.
- [ ] **Step 4:** commit `feat(empresas): Christmas business catalog data, photos and PDF`.

### Task 3: Textos ES/EN

**Files:** Modify `src/messages/es.json` y `src/messages/en.json`.

- [ ] **Step 1: Agregar la clave de navegación y los metadatos.**
  - `nav.business`: «Empresas» / «Business».
  - `meta.business_title`: «Regalos corporativos de Navidad» / «Corporate Christmas gifts».
  - `meta.business_description`:
    - ES: «Cajas, galletas, brownies y chocobombas navideñas para tu equipo y tus clientes. Descuento desde 12 unidades. Cotiza por WhatsApp con Crooki en Cartagena.»
    - EN: «Christmas boxes, cookies, brownies and hot chocolate bombs for your team and clients. Discounts from 12 units. Get a quote on WhatsApp from Crooki in Cartagena.»
- [ ] **Step 2: Agregar el namespace `business`** con estas claves (ES / EN):
  - `home_eyebrow`: «Para empresas» / «For business»
  - `home_eyebrow_navidad`: «Regalos de Navidad» / «Christmas gifts»
  - `home_title`: «Regala Crooki a tu equipo y a tus clientes» / «Give Crooki to your team and clients»
  - `home_subtitle`: «Cajas y detalles navideños con tarjeta de/para, y precios especiales por volumen.» / «Christmas boxes and treats with a gift card, and special volume pricing.»
  - `home_b1` / `home_b2` / `home_b3`:
    - ES: «Cajas listas para regalar» · «Descuento desde 12 unidades» · «Cotización por WhatsApp»
    - EN: «Ready-to-gift boxes» · «Discounts from 12 units» · «Quote on WhatsApp»
  - `home_cta`: «Cotizar para mi empresa» / «Get a business quote»
  - `home_image_alt`: «Cajas navideñas de Crooki» / «Crooki Christmas gift boxes»
  - `title`: «Regalos corporativos de Navidad» / «Corporate Christmas gifts»
  - `subtitle`: «Detalles deliciosos para tus clientes y tu equipo. Contamos con precios especiales para pedidos empresariales.» / «Delicious gifts for your clients and team, with special pricing for business orders.»
  - `download`: «Descargar catálogo (PDF, 7,6 MB)» / «Download catalog (PDF, 7.6 MB)»
  - `featured_title`: «Favoritos de la temporada» / «Season favorites»
  - `steps_title`: «Así de fácil» / «It's that easy»
  - `step1`: «Cuéntanos qué necesitas en el formulario.» / «Tell us what you need in the form.»
  - `step2`: «Te respondemos por WhatsApp con tu cotización.» / «We reply on WhatsApp with your quote.»
  - `step3`: «Preparamos y entregamos tus regalos.» / «We prepare and deliver your gifts.»
  - `form_title`: «Pide tu cotización» / «Request your quote»
  - Etiquetas del formulario:
    - `f_company`: Empresa / Company
    - `f_contact`: Tu nombre / Your name
    - `f_occasion`: Ocasión / Occasion
    - `f_product`: Producto de interés / Product of interest
    - `f_product_unsure`: Aún no sé / Not sure yet
    - `f_quantity`: Cantidad aproximada / Approximate quantity
    - `f_date`: Fecha de entrega / Delivery date
    - `f_city`: Ciudad o lugar de entrega (opcional) / City or delivery place (optional)
    - `f_budget`: Presupuesto por unidad (opcional) / Budget per unit (optional)
    - `f_logo`: Quiero preguntar por personalización con nuestro logo / I'd like to ask about customizing with our logo
    - `f_comments`: Comentarios (opcional) / Comments (optional)
  - Ocasiones:
    - `occ_yearend`: Regalo de fin de año / Year-end gift
    - `occ_event`: Evento / Event
    - `occ_meeting`: Reunión / Meeting
    - `occ_other`: Otra / Other
  - `submit`: «Continuar en WhatsApp» / «Continue on WhatsApp»
  - `opening`: «Abriendo WhatsApp…» / «Opening WhatsApp…»
  - `fallback`: «¿No se abrió? Toca aquí» / «Didn't open? Tap here»
  - `privacy`: «Tus datos solo viajan en el mensaje de WhatsApp. <link>Política de datos</link>» / «Your details only travel in the WhatsApp message. <link>Privacy policy</link>»
  - Errores:
    - `err_required`: «Completa este campo» / «Please fill in this field»
    - `err_quantity`: «Escribe una cantidad de 1 o más» / «Enter a quantity of 1 or more»
    - `err_date`: «Elige una fecha desde hoy» / «Pick a date from today on»
  - `faq_title`: «Preguntas frecuentes» / «FAQ»
  - Preguntas frecuentes (pregunta y respuesta, ES / EN):
    - `faq1_q`: «¿Tienen descuento por cantidad?» / «Do you offer volume discounts?»
    - `faq1_a`: «Sí, la mayoría de productos tiene descuento desde 12 unidades (el Perfect duo desde 15). Te damos el precio exacto en la cotización.» / «Yes, most products are discounted from 12 units (Perfect duo from 15). We give you the exact price in your quote.»
    - `faq2_q`: «¿Los regalos llevan tarjeta?» / «Do gifts include a card?»
    - `faq2_a`: «Sí, todos incluyen tarjeta de/para.» / «Yes, every gift includes a to/from card.»
    - `faq3_q`: «¿Pueden personalizarlos con nuestro logo?» / «Can you customize them with our logo?»
    - `faq3_a`: «Pregúntanos por WhatsApp al cotizar y te contamos las opciones.» / «Ask us on WhatsApp when you request your quote and we'll share the options.»
    - `faq4_q`: «¿Hacen factura, envíos y entregas con fecha?» / «Do you invoice, ship and deliver on a set date?»
    - `faq4_a`: «Escríbenos por WhatsApp con tu fecha y lugar de entrega y te confirmamos.» / «Message us on WhatsApp with your date and delivery place and we'll confirm.»
- [ ] **Step 3:** `node -e "for (const l of ['es','en']) { const m = require('./src/messages/' + l + '.json'); console.log(l, Object.keys(m.business).length) }"` → mismo número de claves en los dos idiomas.
- [ ] **Step 4:** commit `feat(empresas): ES/EN copy for the business page`.

### Task 4: Formulario de cotización

**Files:** Create `src/components/business/QuoteForm.tsx` (`"use client"`).

**Interfaces:**
- Consumes: `buildBusinessQuoteUrl`, `BusinessQuote` (Tarea 1), `BUSINESS_PRODUCTS` (Tarea 2) y el namespace `business` (Tarea 3).
- Produces: `export default function QuoteForm()`, sin props.

- [ ] **Step 1: Construir el formulario.**
  - Usa `Input`, `Label` y `Textarea` de `src/components/ui`, con el mismo patrón que `CheckoutClient.tsx:120-133`.
  - Etiquetas visibles en todos los campos.
  - Atributos por campo:
    - Empresa: `autoComplete="organization"`.
    - Nombre: `autoComplete="name"`.
    - Ocasión y producto: `<select>` nativos estilados como `Input`.
    - Cantidad: `type="number"`, `inputMode="numeric"`, `min=1`.
    - Fecha: `type="date"` con `min` = hoy en hora de Colombia.
    - Presupuesto: `inputMode="numeric"`.
    - Logo: casilla.
  - Obligatorios: empresa, nombre, ocasión, producto, cantidad y fecha.
  - Errores:
    - Se validan al enviar.
    - Cada error se asocia a su campo con `aria-describedby` y `aria-invalid`.
    - El foco pasa al primer campo con error.
  - En el mensaje, ocasión y producto van en español: la etiqueta ES de la ocasión y el nombre del producto. «Aún no sé» va como «Aún no sé».
  - Al enviar un formulario válido:
    1. `window.open(url, "_blank", "noopener")`.
    2. Mostrar «Abriendo WhatsApp…» y el enlace `fallback` (`<a href={url} target="_blank" rel="noopener noreferrer">`).
    3. No borrar el formulario.
  - Línea `privacy` con `t.rich` y enlace al `Link` de `/legal/politica-de-datos`.
- [ ] **Step 2:** `npx tsc --noEmit` y `npm run lint` → sin errores.
- [ ] **Step 3:** commit `feat(empresas): quote form that opens WhatsApp`.

### Task 5: Página `/empresas`

**Files:**
- Create: `src/app/[locale]/empresas/page.tsx`
- Modify: `src/app/sitemap.ts` (agregar `{ path: "/empresas", priority: 0.8 }`)

**Interfaces:**
- Consumes: `QuoteForm` (Tarea 4), `BUSINESS_PRODUCTS` y `BUSINESS_CATALOG_PDF` (Tarea 2).

- [ ] **Step 1: Página server.**
  - `generateMetadata` con `meta.business_title`, `meta.business_description` y `alternatesFor("/empresas", locale)`, igual que `merch/page.tsx:37-49`.
  - Secciones, en este orden:
    1. **Encabezado vino con `Crumbs`.** Copiar `merch/page.tsx:63-66`. Lleva el `h1` (`title`), el `subtitle` y un botón píldora dorado `download` (`<a href={BUSINESS_CATALOG_PDF} download>`).
    2. **«Favoritos de la temporada».** Grilla de los 6 `featured` (2 columnas en celular, 3 en escritorio). Cada tarjeta lleva foto (`next/image`, `alt` = nombre), nombre y precio.
    3. **«Así de fácil».** 3 pasos numerados en círculos vino.
    4. **Formulario** sobre fondo `#fdf8f0`, con `id="cotizar"`.
    5. **FAQ** con `<details>` nativos.
  - Un solo `h1`.
- [ ] **Step 2:** `npm run build` → compila y `/[locale]/empresas` aparece en la salida.
- [ ] **Step 3:** commit `feat(empresas): /empresas page with featured gifts, form and FAQ`.

### Task 6: Bloque del inicio y enlace en el footer

**Files:**
- Create: `src/components/home/BusinessSection.tsx` (server)
- Modify: `src/app/[locale]/page.tsx`. Insertar `<BusinessSection locale={locale} season={season} />` entre `<AboutSection>` y `<SocialSection>`.
- Modify: `src/components/layout/Footer.tsx:117-121`. Agregar `<Link href="/empresas">{t("business")}</Link>` después de Merch.

**Interfaces:**
- Consumes: `BUSINESS_HERO_IMAGE` (Tarea 2), `SeasonIcon` (`src/components/seasons/SeasonIcon.tsx`) y `SeasonId | null`.
- Produces: `BusinessSection({ locale, season }: { locale: string; season: SeasonId | null })`.

- [ ] **Step 1: Construir el bloque.**
  - Sección `relative overflow-hidden` con fondo `#8b0031` y `<Crumbs className="opacity-70" />`.
  - En escritorio, 2 columnas: el texto a la izquierda, la foto a la derecha en un marco girado como `Hero.tsx:72`. En celular va el texto, luego el CTA a todo el ancho y luego la foto.
  - Etiqueta:
    - Con `season === "navidad"`: `<SeasonIcon season="navidad" />` y `home_eyebrow_navidad`.
    - En los demás casos: el ícono `Gift` de lucide y `home_eyebrow`.
    - Va en color `#f3c78b`.
  - Título `h2`, subtítulo, los 3 beneficios con `Check` y el CTA píldora `Link href="/empresas"`.
  - CTA en fondo `#f3c78b` con texto `#8b0031`.
- [ ] **Step 2: Verificar en el navegador** (`npm run dev`, puerto 3001), en 390 px y 1440 px:
  - `/?temporada=navidad` → etiqueta navideña.
  - `/?temporada=ninguna` → «Para empresas».
  - `/en` → textos en inglés.
  - Footer → el enlace va a `/empresas`.

  Guardar las capturas en el scratchpad.
- [ ] **Step 3:** commit `feat(home): business gifts section and footer link`.

### Task 7: Verificación final y registro

- [ ] **Step 1:** `npm test`, `npm run lint`, `npx tsc --noEmit` y `npm run build` → todo en verde.
- [ ] **Step 2: Probar `/empresas` y `/en/empresas` a 360, 390, 768 y 1440 px.**
  1. Enviar el formulario vacío → errores en cada campo obligatorio.
  2. Cantidad 0 → `err_quantity`.
  3. Llenar todo y continuar → se abre `wa.me` con el mensaje esperado (revisar la URL en la nueva pestaña).
  4. El PDF descarga.
  5. Revisar con teclado (orden del foco y foco visible) y correr axe sin violaciones serias.
- [ ] **Step 3: Revisar la consola en `/empresas`.** No debe haber errores de CSP: el PDF es del mismo origen y no se agregan scripts externos.
- [ ] **Step 4: Dejar el registro.**
  - Agregar la entrada en `vault/Decisions.md` si el vault está disponible. Si no (ver memoria), dejarlo anotado en el resumen final.
  - Correr `graphify update .`.
- [ ] **Step 5:** mostrarle las capturas a Cesar y **esperar su OK antes de cualquier push**.

### Task 8: Movimiento y 3D de galletería premium (pedido por Cesar el 2026-11-23)

**Files:**
- Create: `src/components/business/Cookie3D.tsx` (`"use client"`)
- Create: `src/components/business/Tilt.tsx` (`"use client"`)
- Modify: `src/components/home/BusinessSection.tsx` y `src/app/[locale]/empresas/page.tsx`, solo para montar lo anterior.
- Dependencia nueva: `three` (y `@types/three` en dev).
  - **Por qué:** es la única forma de lograr una galleta 3D real con volumen e iluminación. No existe una alternativa nativa con esa calidad.
  - **Peso:** ~150 KB gz. Se carga solo en el cliente, con `next/dynamic` (`ssr: false`) y únicamente cuando el bloque entra en pantalla (`IntersectionObserver`). No suma al LCP.

**Interfaces:**
- Produces:
  - `Cookie3D({ className?: string; fallbackSrc: string; fallbackAlt: string })`
  - `Tilt({ children, className?: string, max?: number })`. `max` son los grados de inclinación; por defecto 8.

- [ ] **Step 1: `Cookie3D`, una galleta procedural en Three.js.**
  - Forma y textura:
    - Disco con borde irregular y superficie con relieve por ruido.
    - Color de galleta horneada.
    - Chips de chocolate en relieve.
    - Opcional: un hilo de relleno que asoma, como las galletas rellenas de Crooki.
  - Luz cálida de estudio y sombra suave.
  - Movimiento:
    - Gira lento en el eje Y y flota.
    - En escritorio se inclina siguiendo el puntero.
    - Se pausa cuando sale de pantalla o la pestaña no está visible.
  - Calidad y rendimiento:
    - `devicePixelRatio` máximo de 2.
    - Al desmontar libera geometrías, materiales y renderer.
  - Muestra la `fallbackSrc` (foto estática con `next/image`) cuando:
    - el usuario tiene activado `prefers-reduced-motion`;
    - no hay WebGL;
    - todavía no ha cargado.
  - El canvas lleva `aria-hidden="true"`. El `alt` va en la imagen de respaldo.
  - Se puede usar la skill `img2threejs` tomando como referencia `public/images/pistachio-dream.webp` o una galleta del catálogo.
- [ ] **Step 2: `Tilt`, inclinación 3D en CSS.**
  - Usa `perspective`, `rotateX/Y` según el puntero y un brillo que sigue al cursor.
  - Solo actúa con `pointer: fine`. Se apaga con `prefers-reduced-motion`.
  - Sin dependencias.
- [ ] **Step 3: Montar los componentes.**
  - **Inicio:** `BusinessSection` lleva `Cookie3D` junto a la foto de las cajas. La galleta 3D flota sobre la esquina de la foto, y unas migas caen con CSS.
  - **`/empresas`:** `Cookie3D` va en el encabezado y `Tilt` envuelve cada tarjeta de los favoritos.
  - **Entrada de las secciones:** suben con una animación CSS (`@keyframes` + `animation-timeline: view()` donde haya soporte, y sin animación donde no).
- [ ] **Step 4: Comprobar.**
  - Que no haya CLS: la caja de la galleta tiene tamaño fijo.
  - Que la animación vaya a 60 fps en escritorio y no trabe el scroll en 390 px.
  - Que con «reducir movimiento» se vea la foto estática.
  - `npm run build` OK.

## Fuera de este plan (pendiente de Cesar)
- El enlace en el Header solo durante Navidad. Requiere pasarle la temporada al Header, que es un componente cliente. Se hace después si lo pide.
- La fecha límite de pedidos de Navidad, cuando la confirme.
