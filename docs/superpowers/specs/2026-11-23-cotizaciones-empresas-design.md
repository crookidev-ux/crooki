# Cotizaciones para empresas (`/empresas`) — diseño

Aprobado por Cesar el 2026-11-23. Propuestas de `disenador-web` y `estratega-marketing`.

## Intención
Crooki tiene un catálogo institucional (regalos corporativos y productos navideños). Hoy el sitio no lo muestra. Queremos que la gente descubra el servicio desde el inicio y pida una cotización sin fricción, por WhatsApp. Es urgente por la temporada de fin de año.

## Objetivos / no objetivos
- **Sí:** un bloque en el inicio; la página `/empresas` con su formulario que abre WhatsApp con el mensaje armado; el enlace en el footer; todo en ES y EN.
- **No:** guardar las cotizaciones en Supabase, un panel de admin, ni Turnstile (no hay servidor de por medio).
- **Antiobjetivo:** un mensaje de «¡Recibido!» falso, o un bloque que se vea pegado o perdido.

## Opciones de diseño consideradas
- **A, franja vino con foto (elegida).** Reutiliza el lenguaje visual del Hero: migas, foto inclinada, etiqueta con ícono y botones en píldora.
- **B, tarjeta crema (descartada).** Quedaría al lado de About, que también es crema, y se perdería.
- **Formulario → WhatsApp (elegido)** en lugar de guardar en la base de datos. Es más simple, no maneja datos personales en el servidor y la venta se cierra en el chat de todos modos.

## Diseño
- **Inicio:** `BusinessSection` va entre `AboutSection` y `SocialSection`, sobre fondo vino `#8b0031`.
  - Usa `Crumbs`, una foto girada, una etiqueta y un CTA tipo píldora de 44 px o más.
  - Con `season === "navidad"` muestra `SeasonIcon` y el título navideño.
- **Página `/empresas`:**
  1. Encabezado vino, como Merch.
  2. Qué ofrecemos: tarjetas sacadas del catálogo real.
  3. Cómo funciona: 3 pasos.
  4. Formulario sobre fondo crema.
  5. Preguntas frecuentes, con respuestas de Cesar.
- **Formulario:**
  - Obligatorios: empresa, nombre, ocasión, cantidad y fecha.
  - Opcionales: ciudad o lugar, presupuesto por unidad, personalización y comentarios.
  - No pide el celular, porque WhatsApp ya lo trae.
  - Botón: «Continuar en WhatsApp». Luego muestra «Abriendo WhatsApp…» y un enlace de respaldo.
  - Lleva una línea Ley 1581 con enlace a la política de datos.
- **Mensaje:** `buildBusinessQuoteUrl()` en `src/lib/whatsapp.ts`.
  - Reutiliza `WHATSAPP_NUMBER`, va siempre en español y termina con «(Origen: web /empresas)».
  - Cada campo se recorta. Lleva prueba con `node:test`.
- **Otros:** el enlace en «Explora» del footer, la ruta en el sitemap y en `alternatesFor`, y los textos en el namespace `business` de `src/messages/{es,en}.json`.

## Queda al constructor
- La ruta en EN (`/en/business` si next-intl lo permite sin romper nada; si no, `/en/empresas`).
- La foto del bloque. Si no hay fotos reales a tiempo, se usa la mejor disponible del catálogo.

## Decisiones tomadas (2026-11-23, después de leer el catálogo)
- **Catálogo:** `docs/Crooki_Institucional_Navidad2026.pdf`, de 25 páginas y 22 productos navideños con precio. No tiene helados, así que los helados quedan fuera de `/empresas`.
- **Descarga:** se publica la copia reparada (7,6 MB) como `public/catalogo-empresas-navidad-2026.pdf`, con el botón «Descargar catálogo (PDF, 7,6 MB)». Es una decisión propuesta por Claude a la que Cesar no se opuso. Los precios quedan públicos.
- **Productos destacados:** 5 o 6, con foto extraída del PDF en webp y su precio. La foto de las cajas de la pág. 2 va en el bloque del inicio.
- **Personalización, logo, condiciones, fechas, factura y envíos:** según Cesar, «que las empresas pregunten por WhatsApp al cotizar».
  - Las preguntas frecuentes solo dicen lo que el catálogo confirma: todo trae tarjeta «de/para»; hay descuento desde 12 unidades (Perfect duo desde 15); la Chocobomba suelta tiene un mínimo de 12; hay precios especiales para empresas.
  - Todo lo demás se responde con «pregúntanos por WhatsApp».
  - En el formulario, una casilla opcional «Quiero preguntar por personalización con nuestro logo» agrega una línea al mensaje. No promete nada.
- **Formulario:** se agrega el campo «Producto de interés», con los productos del catálogo más la opción «Aún no sé».

## Pendiente de Cesar
- El catálogo PDF y las fotos reales: caja corporativa, surtido navideño y cajas apiladas.
- Las respuestas para las preguntas frecuentes:
  - pedido mínimo;
  - anticipación y fecha límite de Navidad;
  - logo o personalización, y su costo;
  - factura con NIT y forma de pago;
  - envíos fuera de Cartagena;
  - si los helados entran (límite de 6 km).
- Si el Header lleva el enlace todo el año o solo en Navidad. Propuesta: solo en Navidad.
