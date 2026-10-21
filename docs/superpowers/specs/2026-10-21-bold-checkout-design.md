# Pago en línea con Bold + domicilio por barrio — diseño

Fecha: 2026-10-21 · Proyecto: crooki-web · Estado: borrador para aprobación

## 1. Intención

Hoy el cliente arma el pedido en la web, el pedido se guarda en Supabase y se abre WhatsApp con el resumen. Por WhatsApp, Crooki le manda un QR de Bold para pagar. Queremos que el cliente pueda **pagar ahí mismo en la web** con el botón de pagos de Bold: el dinero llega directo a la cuenta de Bold de Crooki, el cliente no espera el QR y el equipo tiene un paso manual menos.

Para cobrar el valor completo, el checkout tiene que sumar el **domicilio**, que hoy no está en el total. El domicilio tiene **un precio por barrio**, que se calcula según la distancia desde el local (Centro Histórico, Calle 36 # 5-70).

## 2. Objetivos

1. El cliente escoge cómo recibe el pedido: **Domicilio**, **Recoger en el local** o **Comer en el local** (pide por la web para no hacer fila).
2. Con domicilio, el cliente escoge su **barrio** de una lista con buscador. El valor del domicilio se suma solo al total.
3. El cliente escoge cómo paga:
   - **«Pagar»**: abre la pasarela de Bold y paga en línea. **El botón dice solo «Pagar» / «Pay», sin mencionar a Bold** (decisión del usuario). Bold sí aparece dentro de su propia ventana de pago; eso no se puede quitar.
   - **«Pagar por QR»**: el flujo de hoy (se guarda el pedido, se abre WhatsApp y Crooki manda el QR de Bold).
4. El pedido queda en Supabase con su estado de pago. En el admin se ve si está **pagado**, **esperando el pago** o si el **pago fue rechazado**.
5. La confirmación de pago no depende de lo que diga el navegador: se confirma con el **webhook de Bold** (y, como respaldo, con la API de consulta de Bold).
6. Todo texto nuevo existe en **ES y EN**.

## 3. Lo que NO incluye

- No se reemplaza el flujo por WhatsApp: sigue existiendo como «Pagar por QR».
- No hay reembolsos ni anulaciones desde la web; se hacen en el panel de Bold.
- No se edita el precio por barrio desde el admin en esta versión (ver §6.2).
- No hay cuentas de cliente ni pagos guardados.
- No se toca el diseño general del sitio, solo el checkout y la página del pedido.

**Lo que haría que fracase aunque «funcione»:**
- Que un pedido aparezca como pagado sin que Bold lo haya confirmado.
- Que se pueda pagar un total distinto al real, por ejemplo alterando el precio en el navegador.
- Que la llave secreta de Bold quede expuesta en el navegador o en el repositorio.
- Que el checkout en celular quede más largo o confuso que hoy.

## 4. Estado actual (evidencia)

- `src/components/order/CheckoutClient.tsx`: el formulario pide nombre, email, teléfono, teléfono de quien recibe, dirección y notas. El **total lo calcula el navegador** (`useCartStore().total()`) y se manda tal cual al RPC `create_public_order`. El precio de cajas, combos y helados con extras también se calcula en el navegador (`BoxConfigurator.tsx:55`, `ComboConfigurator.tsx:56`, `HeladoConfigurator.tsx:52`).
- `supabase/migrations/20260517100000_create_public_order_rpc.sql`: `create_public_order(...)` es `SECURITY DEFINER`, inserta en `orders` + `order_items` con `status = 'pending'` y **exige dirección**. No recibe ni guarda `recipient_phone`: ese dato hoy solo viaja en el WhatsApp (bug menor, se corrige aquí).
- `src/app/[locale]/pedido/[id]/page.tsx`: página de confirmación. Lee el pedido con el cliente *service role* (el UUID funciona como token de acceso).
- `src/lib/whatsapp.ts`: arma el mensaje de WhatsApp.
- El admin (`src/app/[locale]/admin/page.tsx`) lista los pedidos con `status` (pending / confirmed / delivered / cancelled).
- No existe ninguna ruta `/api`, ni integración de pagos, ni variables de entorno de Bold.

## 5. Experiencia del cliente

### 5.1 Checkout (una sola página, como hoy)

Orden de los bloques en celular (390 px), de arriba hacia abajo:

1. **¿Cómo recibes tu pedido?**: tres opciones grandes (tarjetas o botones de radio con íconos de lucide; sin emojis).
   - Domicilio · Recoger en el local · Comer en el local
2. **Tus datos**: nombre, email y teléfono (como hoy).
3. Solo si es **Domicilio**: barrio (lista con buscador), dirección, teléfono de quien recibe y el valor del domicilio visible junto al barrio.
4. Notas (como hoy).
5. Aceptación de la política de datos (como hoy).
6. **Resumen**: productos + **Domicilio: $X** (si aplica) + **Total**.
7. Dos botones:
   - Principal (vino tinto): **«Pagar $XX.XXX»** / «Pay $XX,XXX».
   - Secundario (contorno): **«Pagar por QR (WhatsApp)»** / «Pay by QR (WhatsApp)».

Reglas:
- **Mercancía** (camisetas, gorras, tote bags; categoría de merch): según el usuario, toda la mercancía sale a domicilio. Si el carrito tiene mercancía, solo se ofrece **Domicilio**. *Interpretación mía:* también aplica a un carrito mixto, con galletas y mercancía; el usuario lo confirma al revisar.
- **Otra ciudad**: la lista de barrios incluye al final la opción «Fuera de Cartagena (envío nacional)», con «Valor por confirmar». Solo aparece si el carrito tiene **solo mercancía**, porque la comida no se envía fuera de la ciudad. Pide la ciudad y la dirección, y funciona como los barrios «Consultar» (solo «Pagar por QR»).
- Los barrios marcados «Consultar» (islas y lugares a más de 22 km) aparecen en la lista con la leyenda «Valor por confirmar». Con esos barrios **solo** se ofrece «Pagar por QR (WhatsApp)», porque el domicilio se acuerda por chat.
- Recoger o comer en el local: no se pide dirección ni teléfono de quien recibe, y no hay domicilio.
- El botón «Pagar» queda desactivado si el total es menor a $1.000, el mínimo de Bold. En la práctica no pasa, pero hay que validarlo.

### 5.2 Al tocar «Pagar»

1. El navegador manda el carrito y los datos al servidor (§7.2).
2. El servidor vuelve a calcular el total, crea el pedido como «esperando pago» y devuelve la configuración firmada para Bold.
3. Se abre la pasarela de Bold con `BoldCheckout.open()`. El cliente paga con los medios que tenga activos la cuenta: tarjeta, PSE, Nequi o botón Bancolombia.
4. El carrito se vacía solo cuando el pedido se creó bien. Si el cliente abandona el pago, el pedido queda «esperando pago» y puede reintentar desde la página del pedido.

### 5.3 Página del pedido (`/pedido/[id]`)

Bold redirige a `/{locale}/pedido/{id}?bold-order-id=…&bold-tx-status=…`. La página muestra el estado según la base de datos, no según la URL:

| Estado en la base de datos | Qué ve el cliente |
|---|---|
| `paid` | «¡Pago recibido!» + resumen + botón **principal** «Enviar comprobante por WhatsApp» (mensaje con el pedido completo + «✅ Pagado en línea · ref Bold …»). Hoy el restaurante se entera por el comprobante que llega al WhatsApp (dicho por el usuario), así que este botón es el paso principal y va arriba, bien visible. |
| `awaiting_payment` y la URL dice `approved` | «Estamos confirmando tu pago…». El servidor consulta la API de Bold (§7.4); si ya está aprobado, actualiza y muestra «pagado». Si no, sugiere recargar en un momento. |
| `awaiting_payment` o `rejected`, sin aprobación | «El pago no se completó» + botón «Intentar de nuevo» (vuelve a abrir Bold con un intento nuevo) + «Pagar por QR (WhatsApp)». |
| pedido por QR (`payment_method = 'qr'`) | Igual que hoy: aviso de WhatsApp + reenviar. |

### 5.4 Pagar por QR

Igual que hoy (se guarda el pedido y se abre WhatsApp en la misma acción del usuario para no bloquear la ventana emergente), pero el pedido pasa por el mismo endpoint del servidor (§7.2), con `payment_method = 'qr'`. Así el total y el domicilio también quedan calculados por el servidor y bien guardados. El mensaje de WhatsApp agrega la forma de entrega, el barrio y el domicilio.

## 6. Datos

### 6.1 Cambios en `orders` (migración nueva)

| Columna | Tipo | Notas |
|---|---|---|
| `fulfillment` | text, check in (`delivery`, `pickup`, `dine_in`), default `delivery` | Los pedidos viejos quedan como `delivery`. |
| `delivery_zone` | text null | El barrio escogido (nombre visible). |
| `delivery_fee` | numeric not null default 0 | |
| `recipient_phone` | text null | Corrige el bug de §4. |
| `payment_method` | text, check in (`bold`, `qr`), default `qr` | Los pedidos viejos quedan como `qr`. |
| `payment_status` | text, check in (`unpaid`, `awaiting_payment`, `paid`, `rejected`), default `unpaid` | `unpaid` = por QR, sin confirmar. |
| `paid_at` | timestamptz null | |

**Tabla nueva `payment_attempts`** (decisión mía, a partir de la revisión): cada vez que se abre Bold, sea el primer intento o un «Intentar de nuevo», se crea una fila nueva `{ id, order_id, bold_order_id unique, amount, status (created/approved/rejected), bold_payment_id, created_at, updated_at }`. El webhook y la consulta de respaldo buscan por `bold_order_id` en esta tabla. Así, si un intento viejo (un PSE pendiente o una pestaña abierta) se aprueba tarde, igual marca el pedido como pagado. Si llegan **dos** intentos aprobados para el mismo pedido, se registra como posible cobro doble y se muestra un aviso en el admin para reembolsar desde el panel de Bold. RLS: sin acceso público; solo `service_role`.

- `customer_address` es `TEXT NOT NULL` (verificado en `20260331000000_initial.sql`). Se mantiene así y se guarda una cadena vacía cuando no es domicilio.
- **La migración es solo aditiva**: columnas nuevas con valores por defecto y una tabla nueva. No toca ni borra `create_public_order`. Así se puede aplicar **antes** de publicar el código sin romper el checkout de hoy. El RPC viejo se elimina en una limpieza posterior.
- El `status` operativo actual (pending, confirmed, delivered, cancelled) **no cambia**: el estado de pago va aparte.
- Las escrituras de pago **solo** las hace el servidor con *service role*. El RPC público actual queda sin usar (o se elimina en una migración posterior).

### 6.2 Precios de domicilio por barrio

- La fuente es el Excel que preparó el usuario (`C:\Users\cesar\Documents\Tarifas-domicilio-Crooki.xlsx`, hoja «Tarifas por barrio»): unos 438 barrios y zonas, cada uno con su precio o «Consultar». **El usuario va a revisar y corregir esos valores antes de publicar.**
- En el código queda como un archivo estático versionado: `src/lib/delivery-zones.ts`, con `{ id, name, fee | null }`. Lo genera un script desde el Excel, `scripts/import-delivery-zones.mjs`, y el script queda en el repo. *Decisión mía:* así no hace falta una tabla nueva ni una pantalla de admin. Cambiar un precio implica regenerar el archivo y publicar. Si el usuario quiere editarlos desde el admin, eso queda para una fase 2.
- El servidor busca el precio por `id`; el navegador **nunca** manda el valor del domicilio.
- Los nombres repetidos entre sectores (p. ej. «El Progreso») llevan el sector entre paréntesis para distinguirlos.

## 7. Servidor e integración con Bold

Documentación consultada (2026-10-21): developers.bold.co, en las secciones de botón de pagos (integración manual y personalizada), llaves de integración, webhook, consulta de transacciones y ambiente de pruebas.

### 7.1 Variables de entorno

| Nombre | Dónde | Notas |
|---|---|---|
| `BOLD_IDENTITY_KEY` | servidor (el servidor la devuelve en la respuesta) | Llave de identidad. Es pública según Bold, pero no hace falta `NEXT_PUBLIC_`. |
| `BOLD_SECRET_KEY` | **solo servidor** | Firma de integridad y verificación del webhook. Nunca llega al navegador. |
| `NEXT_PUBLIC_SITE_URL` | ya existe | Se usa para armar `redirectionUrl` (debe ser https en producción). |

Hay que agregarlas a `.env.example` (sin valores). Primero se usan las **llaves de prueba** y después las de producción, siempre las dos del mismo ambiente.

### 7.2 `POST /api/checkout` (Route Handler, App Router)

Entrada (JSON): datos del cliente, `fulfillment`, `zoneId` (si es domicilio), `paymentMethod` (`bold` o `qr`), `locale` y los ítems del carrito **por id y selección**:

- producto simple: `{ productId, quantity }`
- combo: `{ productId, quantity, combo: { cookieId, includedSalsaId, additionalSalsas: [{salsaId, quantity}] } }`
- caja: `{ productId, quantity, box: { cookies: [{cookieId, quantity}], giftCard } }`
- helado: `{ productId, quantity, helado: { salsas: [{salsaId, quantity}] } }`

El servidor:
1. Valida los campos. Para domicilio exige dirección, teléfono de quien recibe y `zoneId`, y que el barrio tenga precio si `paymentMethod = 'bold'`.
2. **Recalcula cada precio unitario** con los precios de Supabase, con las mismas reglas que hoy usan los configuradores: precio base + `extra_price` de galletas y salsas + gift card. Esa lógica se saca a un módulo compartido, `src/lib/pricing.ts`, que usan tanto los configuradores como el servidor, para que nunca den números distintos.
3. Arma el nombre de cada línea como hoy (`productName` con las opciones) y suma el domicilio según `zoneId`.
4. Inserta el pedido y sus ítems (service role, en una transacción: un RPC nuevo `SECURITY DEFINER` que solo puede ejecutar `service_role`, o dos inserts con borrado si falla el segundo; queda a criterio de quien lo construya).
5. Si es `qr`: devuelve `{ orderId, whatsappUrl }`.
6. Si es `bold`: genera `bold_order_id`, calcula la firma y devuelve `{ orderId, bold: { orderId, amount, currency: "COP", apiKey, integritySignature, description, redirectionUrl, customerData } }`.

### 7.3 Identificador y firma

- `bold_order_id = "CRK-" + <8 primeros caracteres del uuid del pedido> + "-" + <marca de tiempo>`. Solo letras, números, `-` y `_`, máximo 60 caracteres, único (es la regla de Bold). Cada intento crea una fila en `payment_attempts` (§6.1).
- `integritySignature = SHA-256 hex de "{bold_order_id}{amount}{COP}{BOLD_SECRET_KEY}"`, sin separadores y en ese orden. Es un hash simple, **no** HMAC.
- `amount` va en pesos enteros, sin decimales.
- `description`: «Pedido Crooki #XXXXXXXX» (entre 2 y 100 caracteres).
- `redirectionUrl`: `{SITE_URL}/{locale-prefix}pedido/{orderId}` (con `localePrefix: "as-needed"`, el español va sin prefijo).
- `data-tax`: **no se envía** (decisión mía: es opcional y solo sirve para el reporte de impuestos de Bold). Si el usuario quiere que Bold reporte el impoconsumo, se agrega.

### 7.4 Confirmación del pago

**Webhook `POST /api/bold/webhook`** (se registra en panel.bold.co → Integraciones → Webhooks):
1. Lee el cuerpo **crudo** (`await request.text()`).
2. Verifica la firma: `HMAC-SHA256(key = BOLD_SECRET_KEY, msg = base64(cuerpo crudo))` en hex, comparado con el encabezado `x-bold-signature` (comparación en tiempo constante). Si no coincide, responde 401.
3. Con `SALE_APPROVED`: busca el pedido por `data.metadata.reference = bold_order_id`, comprueba que `data.amount.total` sea igual a `orders.total` y marca `payment_status = 'paid'`, `paid_at` y `bold_payment_id`. Si el monto no coincide, no lo marca como pagado y lo deja registrado en el log.
4. Con `SALE_REJECTED`: si el pedido no estaba pagado, marca `payment_status = 'rejected'`.
5. Es **idempotente**: si ya estaba `paid`, no hace nada. Responde 200 rápido (Bold espera menos de 2 s y reintenta si no recibe 200).
6. `VOID_APPROVED` (anulación): solo queda en el log en esta versión.

**Respaldo en la página del pedido**: si el pedido sigue `awaiting_payment`, el servidor consulta `GET https://payments.api.bold.co/v2/payment-voucher/{bold_order_id}` con `Authorization: x-api-key {BOLD_IDENTITY_KEY}`. Con `APPROVED` y el monto correcto, actualiza igual que el webhook. Bold avisa que la consulta puede tardar hasta 10 minutos en estar disponible.

**Modo de pruebas**: Bold **no envía webhooks** de ventas de prueba, solo con el botón «Probar el webhook» que aparece al final de una compra de prueba. Las pruebas se hacen con ese botón, apuntando a un túnel temporal hacia el servidor local (por ejemplo, `cloudflared`), y con la consulta de respaldo. Decisión mía: como el usuario no tiene acceso a los despliegues de prueba de Vercel, el túnel es la forma de probar el webhook antes de producción.

**Interruptor**: el botón «Pagar» solo aparece si `BOLD_IDENTITY_KEY` y `BOLD_SECRET_KEY` están configuradas. Sin ellas, el checkout ofrece solo «Pagar por QR (WhatsApp)». Así el código se puede publicar antes de que alguien cargue las llaves en Vercel, sin romper nada.

### 7.5 Carga del script de Bold

- `https://checkout.bold.co/library/boldPaymentButton.js` se carga **solo en el checkout y en la página del pedido**, con `next/script` y la estrategia que indique la documentación de Next 16 (`node_modules/next/dist/docs/`), o inyectándolo al montar el componente.
- Se espera el evento `boldCheckoutLoaded`. Con `boldCheckoutLoadFailed` aparece un aviso y se ofrece «Pagar por QR».
- Se usa el botón **propio** (`new BoldCheckout(config).open()`), no el botón renderizado por Bold, para que diga «Pagar» y tenga el estilo de Crooki.

### 7.6 Admin

- La lista de pedidos muestra una etiqueta de pago (Pagado · Esperando pago · Rechazado · QR) y la forma de entrega con el barrio y el domicilio.
- **Los pedidos con `payment_method = 'bold'` que no están pagados no cuentan como «pendientes»** y salen atenuados al final, con la etiqueta «Sin pagar, no preparar». Así el equipo no cocina pedidos abandonados. No se cancelan solos ni hay tareas programadas en esta versión (decisión mía).
- Hay un contador nuevo, «Pagados hoy». *Decisión mía, opcional:* si complica, queda solo la etiqueta.

### 7.6 b Aviso extra al restaurante

El usuario quiere un aviso extra, además del comprobante por WhatsApp, por si el cliente no lo manda. Hay que tener en cuenta que el WhatsApp automático exige la API de WhatsApp Business, con aprobación de Meta y plantillas, y es demasiado para esta versión.

- Al confirmarse un pago (desde el webhook o desde la consulta de respaldo, **una sola vez** por pedido), el servidor manda un **correo** al restaurante con el pedido, la forma de entrega, el barrio, la dirección, los teléfonos, el total y la referencia de Bold.
- Proveedor: **Resend** (plan gratis; con `fetch` a su API, sin dependencia nueva). Variables: `RESEND_API_KEY` y `ORDER_NOTIFY_EMAIL`. Si no están configuradas, no se manda el correo y el resto funciona igual.
- Bold también notifica las ventas en su app y su panel. Es otro aviso, aunque no lleva el detalle del pedido.
- Pendiente del usuario: crear la cuenta en Resend y decir a qué correo llegan los avisos.

### 7.7 Textos e idiomas

Todos los textos nuevos van en `src/messages/es.json` y `en.json`: forma de entrega, barrio, domicilio, botones, estados de pago y errores. Se aprovecha para traducir textos que hoy están fijos en español en el checkout y en la página del pedido («Volver al menú», «Resumen», «Cliente», «Dirección», «Notas» y el `toast` de error). Tono cálido y cercano. Sin emojis en la interfaz; el mensaje de WhatsApp conserva su estilo actual.

### 7.8 Legal

La política de datos debería mencionar que los pagos los procesa Bold y que Crooki no guarda datos de tarjetas. Se revisa con la skill `/legal` (ES oficial + EN, `legal.ts` y `politicas/*.md`).

## 8. Seguridad (resumen)

- El total y el domicilio se calculan **solo en el servidor**.
- La llave secreta solo vive en el servidor. La firma de integridad se genera en el servidor.
- El webhook verifica la firma y el monto, y es idempotente.
- El endpoint de checkout valida los tamaños (máx. 100 ítems, largo de los textos, como el RPC actual). *Opcional:* un límite de peticiones básico.
- La página del pedido sigue usando el UUID como token. No muestra datos de pago sensibles; Bold no envía datos de tarjeta completos.

## 9. Verificación

- `npm run build` y `npm run lint` sin errores nuevos. Los tipos pasan.
- Pruebas automáticas de: la firma de integridad (con el ejemplo de la documentación de Bold: `inv0334` + `39400` + `COP` + llave → el hash esperado), la verificación del webhook, el cálculo del precio por línea (simple, combo, caja y helado) y el precio por barrio.
- Prueba completa en **modo de pruebas de Bold** con las tarjetas de prueba: aprobada (VISA `4111111111111111`), rechazada (`4970110000000062`) y PSE con «BANCO QUE APRUEBA». Se verifica cómo llega la redirección, «Probar el webhook» y la consulta de respaldo.
- Revisión visual en local en escritorio y en celular (390 px), en ES y EN, con capturas.
- Nada se publica sin el OK del usuario (`/publicar`).

## 10. Dependencias externas y bloqueos

1. **Variables en Vercel**: el proyecto es de remcaro-rgb (Remberto), y el usuario se las manda a él para que las cargue: `BOLD_IDENTITY_KEY`, `BOLD_SECRET_KEY`, `RESEND_API_KEY` y `ORDER_NOTIFY_EMAIL`. `SUPABASE_SERVICE_ROLE_KEY` ya debe existir, porque la página del pedido la usa. Gracias al interruptor de §7.4, el código se puede publicar antes.
2. **Migración en Supabase de producción** (proyecto `tkwppmivlryoxoxtcmlj`): el usuario **tiene acceso** y la aplica antes de publicar el código. Es solo aditiva (§6.1).
3. **Pedidos de prueba**: van a la base real, con el nombre «PRUEBA» en el cliente, y se borran al terminar (decisión mía; el usuario no tiene base de pruebas).
4. **Webhook**: se registra en el panel de Bold con la URL de producción, una vez publicado.
5. **Revisión de los precios por barrio** por parte del usuario.
6. **Correo de avisos**: cuenta de Resend y correo de destino (§7.6 b).
7. Local: no hay `.env.local`. Para probar de punta a punta hace falta uno con Supabase (con cuidado: los pedidos de prueba quedan en la base real) y las llaves de prueba de Bold.

## 11. Lo que queda a criterio de quien lo construya

- La forma exacta del componente de selección de barrio (combobox accesible con búsqueda; ver patrones en `src/components/ui`).
- Si la inserción va con un RPC nuevo o con inserts directos con service role.
- Los detalles de estilo dentro de la marca (Fredoka/Geist, `#8b0031`, `#f3c78b`, `#fdf8f0`).
- El formato exacto del sufijo del `bold_order_id`.
