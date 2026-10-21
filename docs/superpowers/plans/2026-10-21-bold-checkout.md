# Pago en línea con Bold + domicilio por barrio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el cliente escoja la forma de entrega y el barrio (con el domicilio calculado por el servidor) y pague en la web con Bold o por QR/WhatsApp, con confirmación por webhook y un correo de aviso al restaurante.

**Architecture:** el checkout manda el carrito (ids + selecciones) a `POST /api/checkout`. El servidor recalcula precios y domicilio con módulos puros (`pricing`, `delivery-zones`), crea el pedido con service role y, si es Bold, crea un `payment_attempt` y devuelve la configuración firmada para `BoldCheckout`. La confirmación llega por `POST /api/bold/webhook`, con la consulta a la API de Bold como respaldo en la página del pedido. Ambos caminos pasan por una sola función `confirmAttempt`, que además manda el correo.

**Tech Stack:** Next.js 16 App Router (Route Handlers), next-intl 4, Supabase (service role), Zustand, Tailwind v4, Node 24 `node:test` con type stripping (sin dependencias nuevas), Web Crypto / `node:crypto`, Resend vía `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-21-bold-checkout-design.md`

## Global Constraints

- Leer el documento correspondiente de `node_modules/next/dist/docs/` antes de escribir código de Next (Route Handlers: `01-app/01-getting-started/15-route-handlers.md`; variables de entorno: `01-app/02-guides/environment-variables.md`).
- **Sin dependencias nuevas** y **sin cambios en `package-lock.json`**. Este archivo ya tiene cambios ajenos y nunca se incluye en los commits. Tampoco van en los commits `scripts/configure-cajas.mjs` ni los archivos sueltos de `public/`.
- El botón principal dice **«Pagar»** / **«Pay»** (con el monto), **nunca «Bold»**. El secundario: «Pagar por QR (WhatsApp)» / «Pay by QR (WhatsApp)».
- Todo texto visible en `src/messages/es.json` **y** `en.json`. Sin emojis en la interfaz, solo íconos de lucide; el mensaje de WhatsApp conserva sus emojis.
- Marca: `#8b0031` (vino tinto), `#f3c78b` (dorado), `#fdf8f0` (crema); títulos en Fredoka, texto en Geist. Precios con `toLocaleString("es-CO")`.
- `BOLD_SECRET_KEY` y `RESEND_API_KEY` solo en el servidor (archivos importados por Route Handlers o Server Components; nunca en `"use client"`).
- Firma de integridad: `sha256hex("{boldOrderId}{amount}{COP}{secret}")`. Webhook: `hmacSha256hex(secret, base64(rawBody)) === header "x-bold-signature"`.
- `bold_order_id`: `^[A-Za-z0-9_-]{1,60}$`, único. Monto mínimo de Bold: 1000 COP, en enteros.
- Remitente del correo: `ORDER_NOTIFY_FROM`, por defecto `Crooki <noreply@crookibakebar.com>`.
- Pruebas: `npm test` → `node --test "src/**/*.test.ts"` (Node 24 ejecuta TS quitando los tipos). Por eso los **módulos puros** (`bold`, `pricing`, `delivery-zones*`, `checkout/schema`, `checkout/price-cart`, `payments.confirm`) se importan entre sí con ruta relativa **con extensión `.ts`** (`tsconfig`: `"allowImportingTsExtensions": true`, válido porque ya tiene `noEmit`). Solo usan `@/` en `import type`. No usan `enum` ni `namespace`. El resto de la app los importa como siempre (`@/lib/pricing`).
- Nada se sube a `main` sin el OK del usuario (skill `/publicar`).

## Review Focus

1. **Carrito guardado con precios viejos** (Zustand `persist`): el servidor recalcula y el total cambia. El cliente debe ver el total nuevo antes de pagar, no un error mudo → prueba en la Task 5 (`priceCart` devuelve el total del servidor) + la Task 8 (la interfaz muestra el `total` devuelto y avisa si cambió).
2. **Producto agotado o borrado** (`available = false` o id inexistente) en el carrito → 409 con la lista de productos, y la interfaz pide quitarlos → prueba en la Task 5.
3. **Webhook duplicado o fuera de orden** (Bold reintenta; un `SALE_REJECTED` llega después de un `SALE_APPROVED`) → el pedido sigue `paid` y no se manda un segundo correo → prueba en la Task 7.
4. **Monto del webhook distinto al del intento** → no se marca como pagado → prueba en la Task 7.
5. **Helado con más salsas incluidas que `included_salsas_count`**, o caja con un número de galletas distinto a `box_cookie_count` → 400 → prueba en la Task 5.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/bold.ts` | Puro: id del intento, firma de integridad, verificación del webhook, `isBoldConfigured`. |
| `src/lib/pricing.ts` | Puro: precio unitario y nombre de línea de simple, combo, caja y helado. Lo usan los configuradores y el servidor. |
| `src/lib/delivery-zones.data.ts` | Generado: lista de barrios con precio. |
| `src/lib/delivery-zones.ts` | Puro: `getZone`, `searchZones` y reglas de entrega (merch, fuera de la ciudad, consultar). |
| `scripts/import_delivery_zones.py` | Genera `delivery-zones.data.ts` desde el Excel del usuario. |
| `supabase/migrations/20261021000000_bold_payments.sql` | Columnas nuevas de `orders`, `payment_attempts` y RPC `create_order_v2`. |
| `src/lib/checkout/schema.ts` | Puro: tipos y validación del cuerpo de `/api/checkout`. |
| `src/lib/checkout/price-cart.ts` | Puro: carrito + catálogo → líneas, subtotal, domicilio, total y errores. |
| `src/lib/checkout/catalog.ts` | Servidor: carga de Supabase los productos y las filas de combos y cajas que pide el carrito. |
| `src/lib/payments.ts` | Servidor: `createAttempt` y `confirmAttempt` (único camino para marcar un pedido como pagado). |
| `src/lib/bold-status.ts` | Servidor: consulta `payment-voucher`. |
| `src/lib/notify.ts` | Servidor: correo por Resend. |
| `src/app/api/checkout/route.ts` | Crear pedido (QR o Bold). |
| `src/app/api/checkout/retry/route.ts` | Intento nuevo para un pedido existente. |
| `src/app/api/bold/webhook/route.ts` | Webhook. |
| `src/components/order/CheckoutClient.tsx` | Interfaz del checkout (se reescribe en buena parte). |
| `src/components/order/FulfillmentPicker.tsx`, `ZoneCombobox.tsx`, `useBoldCheckout.ts` | Piezas del checkout. |
| `src/app/[locale]/pedido/[id]/page.tsx` + `src/components/order/OrderPaymentActions.tsx` | Estados de pago y reintento. |
| `src/lib/whatsapp.ts` | El mensaje incluye entrega, barrio, domicilio y pagado. |
| `src/app/[locale]/admin/page.tsx` | Etiquetas de pago y entrega; los pedidos Bold sin pagar no cuentan como pendientes. |

---

### Task 1: Pruebas + utilidades de Bold

**Files:**
- Modify: `package.json` (script `"test": "node --test \"src/**/*.test.ts\""`), `tsconfig.json` (`"allowImportingTsExtensions": true`), `.env.example`
- Create: `src/lib/bold.ts`, `src/lib/bold.test.ts`

**Interfaces:**
- Produces:
  - `integritySignature(boldOrderId: string, amount: number, currency: "COP", secret: string): string`: sha256 hex.
  - `verifyWebhookSignature(rawBody: string, header: string | null, secret: string): boolean`: comparación con `timingSafeEqual`; da `false` si falta el header o si el largo es distinto.
  - `newBoldOrderId(orderId: string, now?: number): string` → `CRK-{orderId.slice(0,8).toUpperCase()}-{now.toString(36).toUpperCase()}`.
  - `isBoldConfigured(env?: NodeJS.ProcessEnv): boolean`: requiere `BOLD_IDENTITY_KEY` y `BOLD_SECRET_KEY` no vacías.
  - `BOLD_MIN_AMOUNT = 1000`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `src/lib/bold.test.ts` (`import { test } from "node:test"; import assert from "node:assert/strict"; import {...} from "./bold.ts"`):
  - `integritySignature("inv0334", 39400, "COP", "kgfq2nN0o52XqnuXZWIN2F") === "620a64c6eab8858d0f96d4f818a1d77be5e9b9eb9dc681f527de1af54fc1b739"` (ejemplo de la documentación de Bold).
  - `verifyWebhookSignature('{"type":"SALE_APPROVED"}', "9937c5df6b43b00bf829a5682bb5646e0e078bd5542629ec9b7452a47bd57e55", "test-secret") === true`; con un byte cambiado en el body → `false`; con header `null` → `false`; con header `"abc"` → `false` (sin lanzar error).
  - `newBoldOrderId("3f2a9c1e-aaaa-bbbb-cccc-000000000000", 1700000000000)` cumple `/^CRK-3F2A9C1E-[0-9A-Z]+$/` y mide 60 caracteres o menos.
  - `isBoldConfigured({ BOLD_IDENTITY_KEY: "a", BOLD_SECRET_KEY: "" }) === false`; con las dos → `true`.
- [ ] **Step 2: Correr `npm test`** → FAIL (módulo no encontrado).
- [ ] **Step 3: Implementar `src/lib/bold.ts`** con `node:crypto` (`createHash`, `createHmac`, `timingSafeEqual`). La base64 se toma del body crudo en UTF-8: `Buffer.from(rawBody, "utf8").toString("base64")`.
- [ ] **Step 4: Correr `npm test`** → PASS. Agregar a `.env.example`: `BOLD_IDENTITY_KEY=`, `BOLD_SECRET_KEY=`, `RESEND_API_KEY=`, `ORDER_NOTIFY_EMAIL=`, `ORDER_NOTIFY_FROM="Crooki <noreply@crookibakebar.com>"`.
- [ ] **Step 5: Commit** `feat(payments): Bold signature helpers and node test runner` (solo los 5 archivos).

### Task 2: Precio por línea compartido

**Files:**
- Create: `src/lib/pricing.ts`, `src/lib/pricing.test.ts`
- Modify: `src/components/menu/ComboConfigurator.tsx:56`, `BoxConfigurator.tsx:43-55`, `HeladoConfigurator.tsx:44-52`, `src/components/order/CheckoutClient.tsx` (cálculo de `productName`, líneas 72-91)

**Interfaces:**
- Produces (con `import type` de `@/lib/types`):
  - `comboUnitPrice(basePrice: number, cookieExtra: number): number`
  - `boxUnitPrice(basePrice: number, cookies: {quantity: number; extraPrice: number}[], giftCard: GiftCardChoice, giftCardPrice: number | null, giftCardCakePrice: number | null): number`
  - `heladoUnitPrice(basePrice: number, salsas: {quantity: number; extraPrice: number}[]): number`
  - `lineDisplayName(baseName: string, sel: { combo?: {cookieName: string; includedSalsaName?: string}; box?: {cookies: {cookieName: string; quantity: number}[]; giftCard: GiftCardChoice}; helado?: {salsas: {salsaName: string; quantity: number}[]} }): string`: produce exactamente los formatos de hoy (`"{base} · {cookie} + Salsa {salsa}"`, `"{base} · 2× A + 1× B · Gift card"` / `" · Gift card + vela"`, `"{base} · 1× S"`).

- [ ] **Step 1: Pruebas que fallan:** `comboUnitPrice(12000, 2000) === 14000`; `boxUnitPrice(30000, [{quantity:2, extraPrice:1000},{quantity:4, extraPrice:0}], "card_and_cake", 3000, 5000) === 37000`; con `"none"` → `32000`; `heladoUnitPrice(9000, [{quantity:2, extraPrice:1500}]) === 12000`; tres casos de `lineDisplayName` con las cadenas exactas de arriba.
- [ ] **Step 2: `npm test`** → FAIL.
- [ ] **Step 3: Implementar** y reemplazar los cálculos en los tres configuradores y en `CheckoutClient` por estas funciones, sin cambiar el comportamiento.
- [ ] **Step 4: `npm test`** → PASS; `npm run build` → OK.
- [ ] **Step 5: Commit** `refactor(pricing): share line price and name rules`.

### Task 3: Barrios y reglas de entrega

**Files:**
- Create: `scripts/import_delivery_zones.py`, `src/lib/delivery-zones.data.ts` (generado), `src/lib/delivery-zones.ts`, `src/lib/delivery-zones.test.ts`

**Interfaces:**
- Produces:
  - `type DeliveryZone = { id: string; name: string; sector: string; fee: number | null }` (`fee: null` = «Consultar»).
  - `DELIVERY_ZONES: DeliveryZone[]` (en `.data.ts`) + la zona especial `OUTSIDE_CITY_ZONE_ID = "fuera-de-cartagena"` con `fee: null`, nombre «Fuera de Cartagena (envío nacional)».
  - `getZone(id: string): DeliveryZone | undefined`
  - `searchZones(query: string, limit?: number): DeliveryZone[]`: sin tildes ni mayúsculas, busca por `name`.
  - `type Fulfillment = "delivery" | "pickup" | "dine_in"`
  - `allowedFulfillments(cart: { hasMerch: boolean }): Fulfillment[]` → `["delivery"]` si hay merch; si no, los tres.
  - `zoneAllowed(zoneId: string, cart: { hasFood: boolean }): boolean`: la zona de fuera de la ciudad solo se permite si `!hasFood`.
  - `onlinePaymentAllowed(zone: DeliveryZone | undefined, fulfillment: Fulfillment): boolean` → `true` si no es domicilio; si es domicilio, `zone?.fee != null`.

- [ ] **Step 1: Script.** `python scripts/import_delivery_zones.py "<ruta al xlsx>"` lee la hoja «Tarifas por barrio» (columnas: Localidad, UCG, Barrio, Distancia, Cómo se midió, Tarifa, Origen) con openpyxl. `id` = slug ASCII del barrio, más `-ucg{N}` si el nombre se repite. `name` = barrio, más ` ({sector})` si se repite, donde sector = «UCG N» o «Rural/Norte». `fee` = entero o `null`. Ordena por nombre y escribe `src/lib/delivery-zones.data.ts` con un aviso de archivo generado. Fuente: `C:\Users\cesar\Documents\Tarifas-domicilio-Crooki.xlsx`. El usuario va a revisar los precios: el script se vuelve a correr antes de publicar.
- [ ] **Step 2: Pruebas que fallan** sobre los datos reales: `getZone("bocagrande")?.fee === 8500`; `getZone("crespo")?.fee === 11000`; `getZone("los-ejecutivos")?.fee === 10000`; `getZone("serena-del-mar")?.fee === 20000`; `getZone("tierra-bomba")?.fee === null`; todos los `id` son únicos; `searchZones("getsemani")[0].name === "Getsemaní"`; `allowedFulfillments({hasMerch:true})` es `["delivery"]`; `zoneAllowed("fuera-de-cartagena", {hasFood:true}) === false`; `onlinePaymentAllowed(getZone("tierra-bomba"), "delivery") === false`; `onlinePaymentAllowed(undefined, "pickup") === true`.
- [ ] **Step 3: `npm test`** → FAIL. **Step 4:** implementar `delivery-zones.ts` (importa `./delivery-zones.data.ts`). **Step 5:** `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(delivery): per-barrio delivery fees and fulfillment rules`.

### Task 4: Migración de base de datos

**Files:**
- Create: `supabase/migrations/20261021000000_bold_payments.sql`

**Interfaces:**
- Produces (SQL):
  - `orders`: columnas de §6.1 del spec (`fulfillment`, `delivery_zone`, `delivery_fee`, `recipient_phone`, `payment_method`, `payment_status`, `paid_at`) con sus `CHECK` y valores por defecto (`delivery`, `0`, `qr`, `unpaid`). `customer_address` sigue siendo `NOT NULL`.
  - `payment_attempts(id uuid pk default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade, bold_order_id text not null unique, amount integer not null, status text not null default 'created' check (status in ('created','approved','rejected')), bold_payment_id text, created_at timestamptz default now(), updated_at timestamptz default now())`, índice en `order_id`, RLS activado **sin políticas** (solo service role).
  - `public.create_order_v2(p_order jsonb, p_items jsonb) returns uuid`: `SECURITY DEFINER`, `search_path = public, pg_temp`. Inserta el pedido y sus ítems en una transacción, con las mismas validaciones de tamaño del RPC actual. `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO service_role` (**no** a anon).
  - No toca `create_public_order`.

- [ ] **Step 1: Escribir la migración** (comentarios con el mismo estilo que `20260517100000_create_public_order_rpc.sql`).
- [ ] **Step 2: Verificar que es aditiva:** revisar que no tenga `DROP` ni `ALTER COLUMN … NOT NULL` sobre columnas existentes (`grep -nE "DROP|SET NOT NULL"` → solo `DROP POLICY/FUNCTION IF EXISTS` propios, si los hay).
- [ ] **Step 3: El usuario la aplica** en el SQL Editor de Supabase (`tkwppmivlryoxoxtcmlj`). Se comprueba con `select column_name from information_schema.columns where table_name='orders'` y `select to_regclass('public.payment_attempts')`. **Esperar su confirmación** antes de la Task 6.
- [ ] **Step 4: Actualizar los tipos** en `src/lib/types.ts`: `Order` gana los campos nuevos; se agregan `PaymentStatus`, `PaymentMethod` y `Fulfillment` (reexporta el de `delivery-zones`).
- [ ] **Step 5: Commit** `feat(db): payment fields, payment_attempts and create_order_v2`.

### Task 5: Validación y precio del carrito en el servidor

**Files:**
- Create: `src/lib/checkout/schema.ts`, `src/lib/checkout/price-cart.ts`, `src/lib/checkout/price-cart.test.ts`, `src/lib/checkout/catalog.ts`

**Interfaces:**
- Consumes: Task 2 (`*UnitPrice`, `lineDisplayName`), Task 3 (`getZone`, `allowedFulfillments`, `zoneAllowed`, `onlinePaymentAllowed`).
- Produces:
  - `type CheckoutItemInput = { productId: string; quantity: number; combo?: { cookieId: string; includedSalsaId?: string }; box?: { cookies: {cookieId: string; quantity: number}[]; giftCard: GiftCardChoice }; helado?: { salsas: {salsaId: string; quantity: number}[] } }`
  - `type CheckoutInput = { locale: "es" | "en"; customer: { name: string; email: string; phone: string }; fulfillment: Fulfillment; delivery?: { zoneId: string; address: string; recipientPhone: string; city?: string }; notes: string; paymentMethod: "bold" | "qr"; acceptedPolicy: true; items: CheckoutItemInput[] }`
  - `parseCheckoutInput(body: unknown): { ok: true; value: CheckoutInput } | { ok: false; error: string }`: largo máximo 200 por campo de texto (1000 en notas), 1–100 ítems, cantidad 1–50, email con `@`, `acceptedPolicy === true`. `delivery` es obligatorio si `fulfillment === "delivery"`, y `city` es obligatorio si la zona es la de fuera de la ciudad.
  - `type Catalog = { products: Map<string, CatalogProduct>; comboCookies: Map<string /*comboId:cookieId*/, number>; comboSalsas: Map<string /*comboId:salsaId*/, number>; boxCookies: Map<string /*boxId:cookieId*/, number> }`, con `CatalogProduct = { id; name_es; name_en; price; available; isMerch: boolean; includes_salsa?; box_cookie_count?; gift_card_price?; gift_card_cake_price?; included_salsas_count? }`.
  - `priceCart(input: CheckoutInput, catalog: Catalog): { ok: true; lines: {product_id: string; product_name: string; quantity: number; unit_price: number}[]; subtotal: number; deliveryFee: number; total: number; zone?: DeliveryZone; hasMerch: boolean } | { ok: false; status: 400 | 409; error: string; unavailable?: string[] }`
  - `loadCatalog(supabase, productIds: string[]): Promise<Catalog>` (en `catalog.ts`; consulta `products` con `categories(kind)` y las tablas `combo_cookies`, `combo_salsas`, `box_cookies` filtradas por esos ids).

- [ ] **Step 1: Pruebas que fallan** (`price-cart.test.ts`, con un `Catalog` armado en la prueba):
  - Simple ×2 de $5.000 + domicilio a `bocagrande` → `subtotal 10000, deliveryFee 8500, total 18500`.
  - `pickup` → `deliveryFee 0`, y no exige `delivery`.
  - Combo con una galleta que no es del combo → `ok:false, status:400`.
  - Caja con 5 galletas cuando `box_cookie_count = 6` → 400.
  - Helado con 3 salsas cuando `included_salsas_count = 2` → 400 (*Review Focus 5*).
  - Producto con `available:false` o un id que no está en el catálogo → `status:409`, `unavailable` con el id (*Review Focus 2*).
  - El carrito trae un `unit_price` viejo: no hay forma de enviarlo, porque `CheckoutItemInput` no tiene precio; la prueba comprueba que el total sale del catálogo (*Review Focus 1*).
  - Carrito con merch + `pickup` → 400. Carrito con comida + `fuera-de-cartagena` → 400.
  - `paymentMethod:"bold"` + zona `tierra-bomba` → 400. Con `"qr"` → ok, con `deliveryFee 0` y `zone.fee === null`.
  - Combo: `product_name` usa el nombre en el idioma de `locale`, con el formato de `lineDisplayName`.
- [ ] **Step 2: `npm test`** → FAIL. **Step 3:** implementar `schema.ts` y `price-cart.ts` (puros; imports de valores relativos con `.ts` solo en las pruebas). **Step 4:** implementar `catalog.ts` (servidor, usa `createAdminClient`). **Step 5:** `npm test` → PASS; `npm run build` → OK.
- [ ] **Step 6: Commit** `feat(checkout): server-side cart validation and pricing`.

### Task 6: `POST /api/checkout` + intentos de pago

**Files:**
- Create: `src/lib/payments.ts`, `src/app/api/checkout/route.ts`, `src/app/api/checkout/retry/route.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5.
- Produces:
  - `createAttempt(supabase, order: { id: string; total: number; locale: "es"|"en"; customer: {name; email; phone} }): Promise<BoldClientConfig>` inserta en `payment_attempts`, marca `orders.payment_status = 'awaiting_payment'` y devuelve `BoldClientConfig = { orderId: string /*bold_order_id*/; amount: string; currency: "COP"; apiKey: string; integritySignature: string; description: string /*"Pedido Crooki #XXXXXXXX"*/; redirectionUrl: string; customerData: string /*JSON {email, fullName, phone, dialCode:"+57"}*/ }`.
  - `redirectionUrl = ${NEXT_PUBLIC_SITE_URL}${locale==="en" ? "/en" : ""}/pedido/${orderId}`.
  - Respuesta de `POST /api/checkout` (200): `{ orderId: string; total: number; whatsappUrl?: string; bold?: BoldClientConfig }`. Errores: `{ error, unavailable? }` con 400/409/503 (503 = Bold pedido pero `!isBoldConfigured()`).
  - `POST /api/checkout/retry` con `{ orderId }` → `{ bold: BoldClientConfig }`. Solo si el pedido es `payment_method='bold'` y `payment_status <> 'paid'`; si no, 409.

- [ ] **Step 1:** implementar el handler: `parseCheckoutInput` → `loadCatalog` → `priceCart` → `rpc("create_order_v2")` con el cliente admin. Campos: `customer_address` = dirección (o `""` si no es domicilio; si es fuera de la ciudad, `"{city} · {address}"`), `delivery_zone` = `zone.name`, `delivery_fee`, `recipient_phone`, `fulfillment`, `payment_method`, `payment_status` = `'unpaid'`. Si es QR → `whatsappUrl` con `buildWhatsAppOrderUrl` (la Task 9 lo amplía; hasta entonces se usa la firma actual). Si es Bold → `createAttempt`.
- [ ] **Step 2: Verificación manual** con `npm run dev` y `.env.local` (Supabase + llaves de **prueba** de Bold): `curl -s -X POST localhost:3001/api/checkout -H "content-type: application/json" -d @<scratchpad>/checkout-pickup.json` → 200 con `bold.integritySignature` de 64 caracteres hex. Con `paymentMethod:"qr"` → `whatsappUrl`. Con un `productId` inexistente → 409. Los pedidos llevan `customer.name = "PRUEBA"`.
- [ ] **Step 3:** `npm run build` y `npm run lint` → sin errores nuevos.
- [ ] **Step 4: Commit** `feat(api): checkout and payment-retry endpoints`.

### Task 7: Confirmación del pago (webhook + respaldo + correo)

**Files:**
- Create: `src/lib/payments.confirm.ts` (puro), `src/lib/payments.confirm.test.ts`, `src/lib/bold-status.ts`, `src/lib/notify.ts`, `src/app/api/bold/webhook/route.ts`
- Modify: `src/lib/payments.ts` (agregar `confirmAttempt`)

**Interfaces:**
- Produces:
  - Puro: `decideConfirmation(attempt: {status: string; amount: number}, order: {payment_status: string}, event: {kind: "approved" | "rejected"; amount?: number}): { attempt: "approved" | "rejected" | "unchanged"; order: "paid" | "rejected" | "unchanged"; notify: boolean; doubleCharge: boolean }`.
    - aprobado + monto igual + pedido no pagado → `attempt approved, order paid, notify true`
    - aprobado + monto distinto → todo `unchanged`, `notify false` (*Review Focus 4*)
    - aprobado + pedido ya `paid` por **otro** intento → `attempt approved, order unchanged, doubleCharge true, notify false`
    - aprobado + este intento ya `approved` → todo `unchanged`, `notify false` (*Review Focus 3*)
    - rechazado + pedido `paid` → `order unchanged` (*Review Focus 3*); rechazado + pedido no pagado → `attempt rejected, order rejected`
  - `confirmAttempt(supabase, boldOrderId: string, event: {kind; amount?; paymentId?}): Promise<void>` aplica `decideConfirmation`, escribe `orders.paid_at`, `payment_attempts.bold_payment_id` y `updated_at`; con `notify` llama a `sendPaidOrderEmail`; con `doubleCharge`, `console.error` + `orders.notes` agrega «⚠ Posible cobro doble: revisar en Bold».
  - `fetchBoldStatus(boldOrderId: string): Promise<{ status: "APPROVED"|"REJECTED"|"FAILED"|"VOIDED"|"PROCESSING"|"PENDING"|"NO_TRANSACTION_FOUND"; total?: number; transactionId?: string } | null>`: `GET https://payments.api.bold.co/v2/payment-voucher/{id}`, header `Authorization: x-api-key ${BOLD_IDENTITY_KEY}`, `cache: "no-store"`, timeout de 5 s; `null` si hay error.
  - `sendPaidOrderEmail(order: Order & { order_items: OrderItem[] }, boldPaymentId?: string): Promise<void>`: si faltan `RESEND_API_KEY` u `ORDER_NOTIFY_EMAIL`, no hace nada. `POST https://api.resend.com/emails` con `from` = `ORDER_NOTIFY_FROM` (o el valor por defecto), `to` = `ORDER_NOTIFY_EMAIL` (puede ser una lista separada por comas), asunto `Pedido pagado #XXXXXXXX — $total`, y en el texto la entrega, el barrio, la dirección, los teléfonos, los ítems, el domicilio, el total y la ref de Bold. Los errores se registran, nunca se lanzan.
  - Webhook: `POST` → `const raw = await request.text()`; si `!verifyWebhookSignature(raw, request.headers.get("x-bold-signature"), BOLD_SECRET_KEY)` → 401. `SALE_APPROVED` → `confirmAttempt(ref, {kind:"approved", amount: data.amount.total, paymentId: data.payment_id})`; `SALE_REJECTED` → `{kind:"rejected"}`; los demás tipos → solo log. `ref = data.metadata.reference`. Siempre responde 200 si la firma es válida, aunque no encuentre el intento (se registra en el log).

- [ ] **Step 1: Pruebas que fallan** de `decideConfirmation` (los cinco casos de arriba). **Step 2:** `npm test` → FAIL. **Step 3:** implementar. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** implementar `bold-status.ts`, `notify.ts`, `confirmAttempt` y el webhook.
- [ ] **Step 6: Verificación manual del webhook:** firmar un payload de ejemplo con el secreto de prueba (`node -e` con `createHmac`) y hacer `curl` a `localhost:3001/api/bold/webhook` → 200, y el pedido queda `paid`. Repetir el mismo curl → sin segundo correo (revisar en el log). Con una firma mala → 401. Después, con un túnel (`cloudflared tunnel --url http://localhost:3001`), hacer una compra de prueba y usar «Probar el webhook» de Bold apuntando a `{tunel}/api/bold/webhook`.
- [ ] **Step 7: Commit** `feat(payments): Bold webhook, status fallback and paid-order email`.

### Task 8: Checkout — interfaz

**Files:**
- Create: `src/components/order/FulfillmentPicker.tsx`, `src/components/order/ZoneCombobox.tsx`, `src/components/order/useBoldCheckout.ts`
- Modify: `src/components/order/CheckoutClient.tsx`, `src/messages/es.json`, `src/messages/en.json`

**Interfaces:**
- Consumes: Task 3 (`searchZones`, `getZone`, `allowedFulfillments`, `zoneAllowed`, `onlinePaymentAllowed`, `OUTSIDE_CITY_ZONE_ID`), Task 6 (contrato de `/api/checkout`).
- Produces:
  - `useBoldCheckout(): { ready: boolean; failed: boolean; open(config: BoldClientConfig): void }`: inyecta una sola vez `<script src="https://checkout.bold.co/library/boldPaymentButton.js">`, escucha `boldCheckoutLoaded` y `boldCheckoutLoadFailed`, y `open` hace `new window.BoldCheckout(config).open()`. Declarar el tipo global de `BoldCheckout` en el mismo archivo.
  - `<FulfillmentPicker value onChange options: Fulfillment[] />`: radiogroup accesible con tres tarjetas e íconos (`Bike`, `ShoppingBag`, `UtensilsCrossed`).
  - `<ZoneCombobox value onChange allowOutsideCity: boolean />`: combobox ARIA (input + listbox) que muestra hasta 8 resultados con el precio (`$8.500`) o «Valor por confirmar»; `onChange(zoneId)`.
  - La página server de checkout le pasa `boldEnabled: boolean` (`isBoldConfigured()`) a `CheckoutClient`.

- [ ] **Step 1: Textos** (ES y EN): `checkout.fulfillment_title` («¿Cómo recibes tu pedido?» / «How do you want your order?»), `fulfillment_delivery` («Domicilio» / «Delivery»), `fulfillment_pickup` («Recoger en el local» / «Pick up at the shop»), `fulfillment_dine_in` («Comer en el local» / «Eat at the shop»), `zone` («Barrio» / «Neighborhood»), `zone_placeholder`, `zone_no_results`, `zone_fee_tbd` («Valor por confirmar» / «Fee to be confirmed»), `outside_city_city` («Ciudad» / «City»), `delivery_fee` («Domicilio» / «Delivery»), `subtotal`, `pay` («Pagar {amount}» / «Pay {amount}»), `pay_qr` («Pagar por QR (WhatsApp)» / «Pay by QR (WhatsApp)»), `pay_qr_only_note` («Para este destino confirmamos el domicilio por WhatsApp» / …), `merch_delivery_only` («La mercancía se entrega a domicilio» / …), `price_changed` («Actualizamos los precios de tu pedido. Revisa el total antes de pagar.» / …), `unavailable` («Algunos productos ya no están disponibles: {names}» / …), `pay_unavailable` («El pago en línea no está disponible en este momento» / …), `error_generic` (reemplaza el `toast` fijo de hoy), `back_to_menu`.
- [ ] **Step 2: Componentes** `FulfillmentPicker`, `ZoneCombobox` y `useBoldCheckout`.
- [ ] **Step 3: `CheckoutClient`**, con el orden de bloques de §5.1 del spec. La dirección y el teléfono de quien recibe solo aparecen con domicilio, y la ciudad solo con la zona de fuera de la ciudad. El resumen muestra subtotal + domicilio + total (en el navegador es solo una vista previa con `getZone(...).fee`). El botón «Pagar» se muestra solo si `boldEnabled && onlinePaymentAllowed(...)` y el total es de al menos 1000; queda desactivado mientras `!ready`; si `failed`, muestra `pay_unavailable`.
  - Pagar: `POST /api/checkout` con `paymentMethod:"bold"`. Si `res.total !== totalPreview`, avisa con `price_changed`, actualiza el total mostrado y **no** abre Bold hasta otro toque. Si no hay cambio: `clearCart()` y luego `open(res.bold)`.
  - QR: igual que hoy (`window.open("", "_blank")` sincrónico antes del `fetch`) y después `waWindow.location.href = res.whatsappUrl`, `clearCart()` y `router.push(/pedido/{id})`.
  - 409 → `toast` con `unavailable` y los nombres de los productos.
- [ ] **Step 4: Verificación:** `npm run build`, `npm run lint`. Abrir `localhost:3001/pedido` en escritorio y en 390 px, en ES y EN: las tres formas de entrega, el buscador de barrio («getse» → Getsemaní $8.500), Tierra Bomba (solo QR), carrito con merch (solo domicilio y opción «Fuera de Cartagena»). Guardar las capturas en el scratchpad.
- [ ] **Step 5: Commit** `feat(checkout): fulfillment, barrio picker and online payment`.

### Task 9: Página del pedido + WhatsApp

**Files:**
- Modify: `src/app/[locale]/pedido/[id]/page.tsx`, `src/lib/whatsapp.ts`, `src/messages/es.json`, `src/messages/en.json`
- Create: `src/components/order/OrderPaymentActions.tsx` (cliente: «Intentar de nuevo» → `POST /api/checkout/retry` → `useBoldCheckout().open`)

**Interfaces:**
- Consumes: Tasks 6 y 7 (`fetchBoldStatus`, `confirmAttempt`), Task 8 (`useBoldCheckout`).
- Produces: `buildWhatsAppOrderUrl(order: WhatsAppOrder)` con `WhatsAppOrder` ampliado: `fulfillment`, `delivery_zone`, `delivery_fee`, `payment_status`, `bold_payment_id?`. Las líneas nuevas del mensaje: `*Entrega:* Domicilio · {barrio}` / `Recoger en el local` / `Comer en el local`, `*Domicilio:* $X` (si es mayor que 0) y, si está pagado, `✅ *Pagado en línea* · ref {bold_payment_id}`. Se omiten dirección y teléfono de quien recibe si no es domicilio.

- [ ] **Step 1:** en la página, si `payment_method='bold'` y `payment_status <> 'paid'`, buscar el último `payment_attempts` del pedido. Si existe, llamar `fetchBoldStatus`; con `APPROVED` → `confirmAttempt(..., {kind:"approved", amount: total})` y volver a leer el pedido. Con `REJECTED`/`FAILED` → `{kind:"rejected"}`.
- [ ] **Step 2:** mostrar los cuatro estados de la tabla §5.3 del spec. Textos nuevos en `confirmation.*`: `paid_title` («¡Pago recibido!» / «Payment received!»), `paid_body`, `send_receipt` («Enviar comprobante por WhatsApp» / «Send receipt via WhatsApp»), `confirming_title`, `confirming_body`, `failed_title` («El pago no se completó» / «The payment didn't go through»), `retry` («Intentar de nuevo» / «Try again»), `pay_qr`, `summary`, `customer`, `address`, `notes`, `delivery_fee`, `fulfillment_*`. Se reemplazan los textos fijos «Resumen», «Cliente», «Dirección», «Notas» y el emoji de `whatsapp_auto_sent_title`.
- [ ] **Step 3: Verificación** con las llaves de prueba: compra aprobada (VISA `4111111111111111`) → redirige y muestra «¡Pago recibido!» (por webhook de prueba o por consulta); rechazada (`4970110000000062`) → «El pago no se completó» → «Intentar de nuevo» abre Bold con un `bold_order_id` nuevo. Capturas en escritorio y 390 px, ES y EN.
- [ ] **Step 4: Commit** `feat(order): payment states, retry and WhatsApp receipt`.

### Task 10: Admin

**Files:**
- Modify: `src/app/[locale]/admin/page.tsx`, `src/messages/es.json`, `src/messages/en.json`

- [ ] **Step 1:** en la lista de pedidos, agregar una etiqueta de pago (`admin.pay_paid` «Pagado», `pay_awaiting` «Sin pagar · no preparar», `pay_rejected` «Pago rechazado», `pay_qr` «QR / WhatsApp») y una línea de entrega (`fulfillment_*` + barrio + domicilio).
- [ ] **Step 2:** el contador «Pendientes» y el resaltado de pendientes excluyen `payment_method='bold' AND payment_status <> 'paid'`; esos pedidos se muestran atenuados al final.
- [ ] **Step 3: Verificación** con `npm run build` y una captura del admin con un pedido de prueba de cada estado.
- [ ] **Step 4: Commit** `feat(admin): payment and fulfillment labels`.

### Task 11: Legal, limpieza y entrega

- [ ] **Step 1:** con la skill `/legal`, agregar a la política de datos (ES oficial + EN, `src/content/legal.ts` + `politicas/*.md`) que los pagos en línea los procesa Bold y que Crooki no guarda datos de tarjetas.
- [ ] **Step 2:** borrar los pedidos «PRUEBA» de Supabase (con el usuario: `delete from orders where customer_name = 'PRUEBA'`; los `payment_attempts` se borran en cascada).
- [ ] **Step 3:** volver a correr `scripts/import_delivery_zones.py` con el Excel **revisado por el usuario** y hacer commit de `delivery-zones.data.ts`.
- [ ] **Step 4:** `npm test`, `npm run build` y `npm run lint` en verde. Revisión completa del branch (`superpowers:requesting-code-review` + `security-review`).
- [ ] **Step 5:** entrada en `vault/Decisions.md`. El vault no está en este PC: dejar el texto en el resumen final para el usuario.
- [ ] **Step 6:** publicar **solo con el OK del usuario** (`/publicar`). Después: Remberto carga las variables en Vercel, se registra el webhook en panel.bold.co con `https://www.crookibakebar.com/api/bold/webhook`, se cambian las llaves de prueba por las de producción y se hace una compra real pequeña ($1.000) para verificar.
