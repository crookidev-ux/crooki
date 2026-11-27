# Modalidades, mínimos y precio por volumen en productos de Navidad

Fecha: 2026-11-26 · Estado: **aprobado por Cesar e implementado en local (sin publicar)** · Autor: agente `desarrollador-apps`

## Decisiones de Cesar (2026-11-26)
- En `chocobomba` el mínimo de 12 es **por modalidad** (12 «con empaque» y aparte 12 «sin empaque»; 6 + 6 no vale). El servidor lo valida por línea producto+opción.
- **No hay oferta sobre modalidades:** el servidor ignora `sale_price` cuando el producto tiene opciones, el admin desactiva el campo y el script de datos limpia la oferta de estos 5 productos.
- El tope de **50 por línea** se mantiene.
- La tarjeta del brownie muestra **«$10.000»** (el precio de su única modalidad), no «Desde $8.900».
- Se renombran a **«Chocobomba (pedido desde 12)»** / *Hot chocolate bomb (orders from 12)* y **«Caja de chocobombas»** / *Hot chocolate bomb box*. Los slugs `chocobomba` y `chocobombas` no cambian.

## Implementación (2026-11-26)
- Migración: `supabase/migrations/20261126000000_product_options.sql`. Datos: `supabase/data/20261126_navidad_opciones_datos.sql`. Ninguno de los dos se ha ejecutado.
- En la tienda y en el admin, la modalidad se llama **«presentación»** («Elige la presentación» / *Choose an option*).
- **Falla cerrada sin la tabla:** si `product_options` no existe (error `PGRST205`/`42P01`, `src/lib/missing-table.ts`), la tienda, el checkout y el admin siguen como hoy. Los 5 productos quedan en $0 («Consultar») y el checkout responde 409. Cualquier otro error de la base sigue fallando la petición.
- El admin muestra la sección y la nota solo en productos de Navidad y solo si la tabla existe. Al guardar opciones por primera vez, el producto queda en $0 hasta que las opciones se guardan, y luego pasa al precio «Desde».

---

## 1. Resumen para Cesar

- Cada producto puede tener **modalidades** (por ejemplo «Caja x2», «Caja x4»), cada una con su precio, su **mínimo** y, si quieres, un **precio más bajo a partir de cierta cantidad** (el brownie: $10.000, y desde 12 unidades $8.900 c/u).
- En la página del producto el cliente elige la modalidad, la cantidad arranca en el mínimo y no baja de ahí, y el precio cambia solo cuando llega a la cantidad del descuento. La tarjeta del catálogo dice «Desde $X».
- Debajo puede ir una nota con botón de WhatsApp: «Descuento a partir de 12 cajas, escríbenos».
- **El cobro lo calcula siempre el servidor** con los precios de la base: aunque alguien manipule el navegador, no puede pagar menos, saltarse el mínimo ni elegir una modalidad de otro producto.
- El pedido guarda la modalidad en el nombre de la línea («Chocobomba · Sin empaque ni instrucciones x12»), así que la ve cocina en el admin, en el correo, en el WhatsApp y en «Mi pedido», sin tocar la tabla de pedidos.
- En el admin, el formulario del producto tiene una sección nueva, «Modalidades y precios», con los textos en ES y EN.
- Hay que hacerlo en este orden: (1) correr el SQL de la tabla, (2) publicar el código, (3) correr el SQL con los datos de los 5 productos. Si se cargan los datos antes de publicar, la web vieja vendería esos productos al precio más bajo y sin mínimo.

---

## 2. Modelo de datos

### Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Modalidades | Tabla nueva `product_options` (1 producto → N opciones) | Es el mismo patrón de `box_cookies`/`combo_cookies`. El escalón va en la opción misma, sin una tabla de precios aparte (con un solo escalón por opción alcanza). |
| Brownie | **1 opción** («Unidad») con escalón; el selector se oculta cuando hay 1 sola opción | Así hay una sola ruta de cobro. Poner columnas de escalón en `products` crearía una segunda ruta y más pruebas sin que el negocio gane nada. |
| Nota de mayoristas | `products.note_es` / `products.note_en` (texto libre, nulos) + botón fijo de WhatsApp en la UI | Lo edita la operadora sin depender de nosotros. El enlace no va dentro del texto, así no hay HTML que escapar. |
| `products.price` en productos con opciones | Se **sincroniza** con el precio más bajo de las opciones: lo hace el admin al guardar y el script de datos | Así siguen funcionando sin cambios todas las reglas de «precio 0 = Consultar» (`orderable`, `AddToOrder`, `NavidadCard`, JSON-LD, orden del inicio). **El checkout nunca cobra `products.price` si el producto tiene opciones.** |
| Oferta (`sale_price`) en productos con opciones | El servidor la **ignora** y el admin desactiva el campo cuando hay opciones | Combinar oferta, modalidad y escalón no lo pidió nadie, y es ambiguo. Ver la pregunta 1. |
| Mínimo | Se valida **por línea producto+opción**. El servidor rechaza dos líneas con el mismo producto+opción | El carrito ya junta líneas iguales, así que dos líneas repetidas solo pueden venir de una petición manipulada. Rechazarlas evita trucos con el mínimo o el escalón. |

### SQL de migración propuesto (NO creado)
Archivo sugerido: `supabase/migrations/20261126000000_product_options.sql`

```sql
-- Modalidades por producto (p. ej. «Caja x2», «Sin empaque»), con mínimo
-- de unidades y un escalón opcional de precio por volumen.
-- El checkout (src/lib/checkout/price-cart.ts) cobra SOLO desde aquí cuando
-- el producto tiene opciones; products.price queda como «desde» para mostrar.

CREATE TABLE IF NOT EXISTS public.product_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label_es      text NOT NULL CHECK (length(btrim(label_es)) BETWEEN 1 AND 120),
  label_en      text NOT NULL DEFAULT '' CHECK (length(label_en) <= 120),
  price         integer NOT NULL CHECK (price > 0),
  min_qty       integer NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  bulk_min_qty  integer NULL,
  bulk_price    integer NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- El escalón va completo o no va; empieza por encima del mínimo y baja el precio.
  CONSTRAINT product_options_bulk_check CHECK (
    (bulk_min_qty IS NULL AND bulk_price IS NULL)
    OR (bulk_min_qty > min_qty AND bulk_price > 0 AND bulk_price < price)
  )
);

CREATE INDEX IF NOT EXISTS idx_product_options_product
  ON public.product_options(product_id, display_order);

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_options public read" ON public.product_options;
CREATE POLICY "product_options public read" ON public.product_options
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_options admin write" ON public.product_options;
CREATE POLICY "product_options admin write" ON public.product_options
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Nota de pedidos al por mayor (la UI le agrega el botón de WhatsApp).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS note_es text NULL CHECK (note_es IS NULL OR length(note_es) <= 300),
  ADD COLUMN IF NOT EXISTS note_en text NULL CHECK (note_en IS NULL OR length(note_en) <= 300);

-- Verificación (correr aparte):
--   select policyname, cmd, roles from pg_policies where tablename = 'product_options';
--   -- como anon: insert into product_options(...) → debe fallar por RLS.

-- Reversa:
--   DROP TABLE IF EXISTS public.product_options;
--   ALTER TABLE public.products DROP COLUMN IF EXISTS note_es, DROP COLUMN IF EXISTS note_en;
```

Nota: `order_items` **no cambia**. La modalidad queda en `product_name`, igual que hoy las galletas del combo o de la caja (`lineDisplayName`, `src/lib/pricing.ts:47`). `create_order_v2` copia `product_name` hasta 500 caracteres (`20261021000000_bold_payments.sql`, el `INSERT INTO order_items`).

### Datos reales observados (lectura de producción, 2026-11-26)
Los 5 productos están en `share-box`, `price = 0`, `sale_price = null`, `name_en = ''`, `description_en = ''`. Algunos `name_es` tienen un espacio al final («Chocobomba », «Chocobombas », «Christmas brownie », «Mini cookies rellenas »). `chocobomba` no tiene descripción en ES. La tabla `product_options` no existe todavía.

---

## 3. Archivos a tocar

### Servidor y cobro (lo crítico)
| Archivo | Cambio |
|---|---|
| `src/lib/pricing.ts:47` | Nueva función pura `optionUnitPrice(opt, qty)` = `qty >= bulk_min_qty ? bulk_price : price`, compartida por el carrito y el servidor. `lineDisplayName` acepta `option?: { label }` → `"Nombre · Modalidad"`. Recortar los espacios del nombre del producto (`trim`). |
| `src/lib/checkout/schema.ts:10` (`CheckoutItemInput`) | `optionId?: string`. |
| `src/lib/checkout/schema.ts:103-149` (`parseItem`) | Leer `optionId` con `text()` (máx. 200 caracteres) y contarlo como configuración en `kinds`, así una opción junto con combo, caja o helado se rechaza. |
| `src/lib/checkout/catalog.ts:76-97` | Cargar `product_options` de los `ids` en el mismo `Promise.all` que las tablas intermedias (`unwrap` lanza un error si Supabase falla; no se traga nada). Validar el dinero con `toMoney`: una fila inválida se descarta. Si el producto tiene opciones pero todas son inválidas, queda no disponible. |
| `src/lib/checkout/price-cart.ts:35` (`Catalog`) | `options: Map<productId, CatalogOption[]>`. |
| `src/lib/checkout/price-cart.ts:78` (`orderable`) | Con opciones, exige al menos una opción válida en lugar de `price > 0`. |
| `src/lib/checkout/price-cart.ts:199-203` (rama `plain`) | Si el producto tiene opciones: (a) sin `optionId` → **409** `unavailable` (carritos viejos, y el cliente ya muestra «no disponible»); (b) un `optionId` que no está en las opciones **de ese producto** → 400; (c) `quantity < min_qty` → 400 `minimum N`; (d) unidad = `optionUnitPrice` con los valores de la base, **sin oferta**; (e) nombre con la modalidad en el idioma del cliente. Si el producto no tiene opciones y llega `optionId` → 400. Las opciones solo valen en productos `plain`. |
| `src/lib/checkout/price-cart.ts:219` (`priceCart`) | Rechazar con 400 dos líneas con el mismo `productId+optionId`. |
| `src/lib/checkout/order-payload.ts` | Sin cambios (`product_name` ya trae la modalidad). |
| `src/app/api/checkout/route.ts:78` | Sin cambios. El mínimo de Bold ($1.000) está muy por debajo de cualquier línea con opción. |
| `retry` / `switch-to-qr` | Sin verificar: confirmar al implementar que vuelven a llamar a `priceCart` y no reutilizan precios del cliente. |

### Tienda
| Archivo | Cambio |
|---|---|
| `src/lib/types.ts:59` (`Product`) | `product_options?: ProductOption[]`, `note_es?`, `note_en?`. |
| `src/lib/types.ts:159` (`CartItem`) | `option?: { id, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price }` (copia para la vista previa; el servidor recalcula). |
| `src/lib/navidad.ts:86` y `:109` | `select("*, product_images(*), product_options(*)")` y ordenar las opciones por `display_order`. |
| `src/store/cart.ts` | `addOption(product, option, qty)` con `lineId = ${id}#opt#${optionId}` y cantidad `max(min_qty, qty)`. `updateQuantity` (`:163`) en líneas con opción: no baja de `min_qty` (la papelera sí quita la línea) y recalcula `unitPrice` con `optionUnitPrice`. `lineUnitPrice` (`:56`) usa la opción. **No hace falta subir la `version` del persist**: el campo es opcional y los carritos viejos se leen igual. |
| `src/components/navidad/AddToOrder.tsx` | Recibe `options` y `note`. Con 2 o más opciones muestra un `fieldset`/`legend` con radios nativos (tarjetas de al menos 44 px: etiqueta + precio). La cantidad arranca en el `min_qty` de la opción elegida y vuelve a él al cambiar de opción; «−» se desactiva en el mínimo (`:71`). Muestra «$10.000 c/u · Total $120.000» y el aviso del escalón («Desde 12 unidades: $8.900 c/u»), y un `aria-live` cuando se alcanza. Nota + botón de WhatsApp con texto prellenado (reusa `WHATSAPP_URL`, `:12`). Llama a `addOption` en lugar de `addItem` (`:59`). |
| `src/app/[locale]/(store)/navidad/[slug]/page.tsx:126-132` | Con opciones, oculta el `PriceTag` fijo (el precio lo muestra `AddToOrder` según la opción) y pasa `product_options` y la nota del idioma (`note_en` vacío → ES). |
| `src/components/navidad/NavidadCard.tsx:37` | Con 2 o más opciones: chip «Desde $X» (`navidad.from_price`) en lugar de `PriceTag`. |
| `src/lib/navidad-seo.ts:22` | Mejora: `AggregateOffer` con `lowPrice`/`highPrice` cuando hay opciones. |
| `src/components/order/CartDrawer.tsx:72-160` y `CheckoutClient.tsx:74, :764-798` | Mostrar la modalidad bajo el nombre (como hoy con `box`); `toItemInput` agrega `optionId`; el «−» del cajón se desactiva en el mínimo. |
| `src/messages/es.json` y `en.json` (bloque `navidad`, `:298`) | Claves nuevas: `option_legend` («Elige la modalidad» / «Choose an option»), `from_price` («Desde {price}» / «From {price}»), `unit_price` («{price} c/u» / «{price} each»), `line_total`, `bulk_hint` («Desde {qty} unidades: {price} c/u» / «From {qty} units: {price} each»), `bulk_reached`, `min_qty` («Mínimo {min} unidades» / «Minimum {min} units»), `note_cta` («Escríbenos por WhatsApp» / «Message us on WhatsApp»). |

### Admin
| Archivo | Cambio |
|---|---|
| `src/app/[locale]/admin/productos/[id]/editar/page.tsx:23` | Agregar `product_options(*)` al `select`. |
| `src/components/admin/ProductFormClient.tsx` | Sección «Modalidades y precios»: filas con etiqueta ES, etiqueta EN, precio, mínimo y escalón opcional («desde N unidades → $P»), y botones Agregar / Quitar (orden = orden de las filas). La nota ES/EN va en los paneles de idioma (`:731`, `:760`). Validación igual a los CHECK antes de enviar. Al haber opciones: el campo «Precio» queda de solo lectura y se guarda el mínimo de las opciones; «Precio de oferta» (`:824`) se desactiva con una explicación. **Guardado:** a diferencia de `saveConfig` (`:448`, que borra y luego inserta), aquí primero `upsert` (con id: `crypto.randomUUID()` para las nuevas) y **después** se borran las que ya no están. Así el producto nunca queda un momento sin opciones, que con el precio sincronizado lo dejaría vendible a $8.700 sin mínimo. Cada error de Supabase se muestra. |

### Proceso del repo
- Bóveda `vault/Decisions.md`: la ruta no existe en este PC (pendiente conocido); registrar la decisión donde Cesar indique.
- `graphify update .` al terminar.

### Riesgos
| Riesgo | Prioridad | Mitigación |
|---|---|---|
| Cargar los datos antes de publicar el código: el código viejo vende con `products.price` (el mínimo de las opciones), sin mínimo ni modalidad | **Crítico** | Orden obligatorio: migración → publicar → script de datos. |
| Guardado del admin a medias (borrar y luego insertar) | Importante | Primero `upsert`, después borrar; mostrar el error y reintentar al guardar. |
| Carritos guardados en localStorage con estos productos como línea simple | Bajo | Hoy no existen (precio 0 = no se pueden pedir). Si pasara, el servidor responde 409 y el cliente muestra «no disponible». Sin verificar si `CheckoutClient` quita la línea sola; revisarlo al implementar. |
| Precio de la vista previa distinto al del servidor (el admin cambió el precio con el carrito abierto) | Bajo | Ya existe el aviso `price_changed` (`CheckoutClient.tsx:398` en Bold). En QR no hay aviso (pendiente conocido de [[project-promos]]). |
| La modalidad queda en el idioma del cliente (si compra en EN, cocina la ve en inglés) | Mejora | Ya pasa hoy con combos y cajas. Opción: escribir siempre la etiqueta en ES en `product_name`. |
| Caché | Bajo | Las páginas de Navidad son dinámicas (cliente con cookies, sin `revalidate`); el checkout lee la base en cada pedido. |
| Tope de 50 por línea (`cart-limits.ts:3`) | Bajo | Alcanza para 12–50; más de 50 → WhatsApp (pregunta 2). |

---

## 4. Casos de prueba

Tests nuevos en `src/lib/checkout/price-cart.test.ts` (catálogo con opciones en `makeCatalog`), `schema.test.ts`, `src/lib/pricing.test.ts` y `src/store/cart.test.ts` (`npm test`).

**Camino normal**
1. `chocobomba` «con empaque» ×12 → unidad 10.000, subtotal 120.000, nombre «Chocobomba · Rellena decorada con empaque e instrucciones».
2. `chocobombas` «Caja x6» ×1 → 62.500.
3. Brownie ×11 → 10.000 c/u (110.000); ×12 → 8.900 c/u (106.800); ×13 → 8.900.
4. Dos líneas de chocobomba, una por modalidad, ×12 cada una → OK (10.000 y 8.700).

**Bordes y abuso**
5. Chocobomba ×11 → 400 `minimum 12`.
6. Chocobomba 6 «con empaque» + 6 «sin empaque» → 400 (mínimo por modalidad, decisión de Cesar).
7. Mismo producto+opción en dos líneas (6 + 6) → 400 por línea duplicada.
8. `optionId` de otro producto (opción de `chocobombas` enviada con `chocobomba`) → 400.
9. `optionId` inexistente → 400. Producto con opciones sin `optionId` → 409 `unavailable`.
10. `optionId` en un producto sin opciones, o junto con `combo`/`box`/`helado` → 400 (en `schema.test.ts` y `price-cart.test.ts`).
11. Precio manipulado: el cuerpo trae `unitPrice: 1`, `price: 1` o `total: 1` → se descarta en `parseCheckoutInput` y el cobro sale del catálogo (ya hay un test parecido para productos simples: extenderlo).
12. Oferta activa (`sale_price` 5.000) en un producto con opciones → se cobra el precio de la opción, no la oferta.
13. Opción con dinero inválido en la base (precio negativo, `bulk_price >= price`) → se descarta en `catalog.ts`. Si no queda ninguna opción, el producto queda no disponible (409).
14. Cantidad 51 → 400 (tope actual). Chocobomba ×50 → OK.
15. Bold: un total de opción por encima de $1.000 pasa la regla del mínimo.
16. Carrito: `addOption` arranca en el mínimo; `updateQuantity` no baja de `min_qty`; el total cambia a 8.900 c/u al pasar de 11 a 12; un carrito viejo sin `option` sigue cargando.

**Manual (navegador, escritorio y 390 px):** elegir la modalidad con el teclado (flechas en los radios), el «−» desactivado en 12, el aviso del escalón leído por el lector de pantalla, la nota con WhatsApp, la tarjeta «Desde $8.700». Pedido «PRUEBA» por QR → ver la modalidad en el admin, el correo, el WhatsApp y «Mi pedido» → borrarlo.

---

## 5. Preguntas abiertas para Cesar

Respondidas el 2026-11-26: ver «Decisiones de Cesar» al inicio.

---

## 6. Tamaño y orden de implementación

Unas **600 líneas en unos 18 archivos**: unas 200 de pruebas, unas 160 de admin, unas 150 de tienda, unas 70 de servidor y unas 45 de SQL. Esfuerzo: 1 día de trabajo de agente más la revisión.

1. Migración (Cesar la corre en Supabase; se verifica la RLS con anon).
2. Servidor: `pricing.ts`, `schema.ts`, `catalog.ts`, `price-cart.ts` + pruebas (TDD: los casos 1–15 primero).
3. Tienda: tipos, `navidad.ts`, carrito, `AddToOrder`, página, tarjeta, cajón, resumen del checkout y mensajes ES/EN.
4. Admin: sección de modalidades, nota y guardado con `upsert` y después borrado.
5. Build, lint, tipos, `npm test`, revisión visual en local (escritorio y 390 px), pedido PRUEBA, `/auditoria-seguridad` enfocada en el cobro, y el OK de Cesar → publicar.
6. **Después de publicar:** Cesar corre el script de datos (sección 7) y se revisan en vivo los 5 productos.

---

## 7. Script de datos propuesto (NO ejecutado)

Correr en el SQL Editor de Supabase **después** de publicar el código. Se puede correr varias veces: reemplaza las opciones de estos 5 productos.

```sql
BEGIN;

-- Opciones (price/bulk en pesos enteros)
DELETE FROM public.product_options
WHERE product_id IN (SELECT id FROM public.products
  WHERE slug IN ('chocobomba','cinnamon-roll','mini-cookies-rellenas','chocobombas','christmas-brownie'));

INSERT INTO public.product_options
  (product_id, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price, display_order)
SELECT p.id, v.label_es, v.label_en, v.price, v.min_qty, v.bulk_min_qty, v.bulk_price, v.ord
FROM (VALUES
  ('chocobomba', 'Rellena decorada con empaque e instrucciones', 'Filled and decorated, with packaging and instructions', 10000, 12, NULL::int, NULL::int, 0),
  ('chocobomba', 'Sin empaque ni instrucciones', 'No packaging or instructions', 8700, 12, NULL, NULL, 1),
  ('cinnamon-roll', 'Caja x1', 'Box of 1', 15000, 1, NULL, NULL, 0),
  ('cinnamon-roll', 'Caja x2', 'Box of 2', 28000, 1, NULL, NULL, 1),
  ('mini-cookies-rellenas', 'Caja x15 variadas', 'Box of 15, assorted', 45000, 1, NULL, NULL, 0),
  ('mini-cookies-rellenas', 'Caja x20 variadas', 'Box of 20, assorted', 59900, 1, NULL, NULL, 1),
  ('chocobombas', 'Caja x2', 'Box of 2', 23000, 1, NULL, NULL, 0),
  ('chocobombas', 'Caja x4', 'Box of 4', 42000, 1, NULL, NULL, 1),
  ('chocobombas', 'Caja x6', 'Box of 6', 62500, 1, NULL, NULL, 2),
  ('chocobombas', 'Caja x8', 'Box of 8', 81900, 1, NULL, NULL, 3),
  ('christmas-brownie', 'Unidad', 'Each', 10000, 1, 12, 8900, 0)
) AS v(slug, label_es, label_en, price, min_qty, bulk_min_qty, bulk_price, ord)
JOIN public.products p ON p.slug = v.slug;

-- «Desde» para tarjeta/JSON-LD = opción más barata; el checkout no lo usa.
UPDATE public.products p
SET price = o.min_price
FROM (SELECT product_id, min(price) AS min_price FROM public.product_options GROUP BY product_id) o
WHERE o.product_id = p.id
  AND p.slug IN ('chocobomba','cinnamon-roll','mini-cookies-rellenas','chocobombas','christmas-brownie');

-- Nombres sin espacio final + textos EN + nota de mayoristas
UPDATE public.products SET name_es = btrim(name_es)
WHERE slug IN ('chocobomba','mini-cookies-rellenas','chocobombas','christmas-brownie');

UPDATE public.products SET name_en = 'Hot chocolate bomb' WHERE slug = 'chocobomba';
UPDATE public.products SET name_en = 'Cinnamon roll',
  description_en = E'Christmas box with a cinnamon roll,\ncream cheese frosting and sprinkles'
  WHERE slug = 'cinnamon-roll';
UPDATE public.products SET name_en = 'Filled mini cookies',
  description_en = E'Christmas box of filled mini cookies\n(Klim brigadeiro, Kinder, chocolate chip,\ncaramel, Milo and red velvet Nutella)',
  note_es = 'Descuento a partir de 12 cajas, escríbenos',
  note_en = 'Discount from 12 boxes, message us'
  WHERE slug = 'mini-cookies-rellenas';
UPDATE public.products SET name_en = 'Hot chocolate bombs',
  description_en = E'The best hot chocolate\nDecorated chocolate bombs\nfilled with marshmallows and cocoa\nInstructions for use\nTo/from card',
  note_es = 'Descuento a partir de 12 cajas, escríbenos',
  note_en = 'Discount from 12 boxes, message us'
  WHERE slug = 'chocobombas';
UPDATE public.products SET name_en = 'Christmas brownie',
  description_en = E'Milo brownie decorated with chocolate\nand sprinkles, with a card and ribbon'
  WHERE slug = 'christmas-brownie';

-- Control: deben salir 11 opciones y 5 productos con price > 0
SELECT p.slug, p.price, count(o.*) AS opciones
FROM public.products p LEFT JOIN public.product_options o ON o.product_id = p.id
WHERE p.slug IN ('chocobomba','cinnamon-roll','mini-cookies-rellenas','chocobombas','christmas-brownie')
GROUP BY p.slug, p.price;

COMMIT;
```

Pendiente: la descripción ES de `chocobomba` está vacía (la debe escribir la operadora o Cesar). Las traducciones EN conviene que las revise `traductor-i18n` antes de correrlas. En «Mini cookies» interpreté «red Nutella» como *red velvet Nutella*: **sin verificar**, confírmalo.
