# Categoría Navidad con página por producto (Entrega 2)

Fecha: 2026-11-24 · Pedido por Cesar; arranca después de la Entrega 1 (`2026-11-24-promociones-design.md`), cuyo precio de oferta, precio tachado y etiquetas se reutilizan aquí.

## Por qué
Crooki quiere vender productos de Navidad (cajas, regalos) con más presencia que una tarjeta del menú: cada producto con su propia página, varias fotos y descripción, para que la gente los vea bien y compre desde ahí.

## Lo que pidió Cesar
- Una categoría de Navidad donde el admin **crea productos y sube fotos**.
- **Máximo 5 fotos por producto.**
- Cada producto tiene **su propia página** con descripción y selector de **unidades** («agregar las que quiera») → carrito.
- **Domicilios y pago iguales** a cualquier otro producto (mismo carrito, mismo checkout, misma regla de domicilio de la categoría).
- Precio tachado y etiquetas de la Entrega 1 también aquí.

- **Todo en español e inglés** (Cesar, 2026-11-24): textos de la interfaz en `es.json`/`en.json`, y en el admin cada producto pide nombre y descripción en ES y EN (`name_en`, `description_en`); `/en/navidad/[slug]` muestra la versión en inglés. El slug es el mismo en los dos idiomas.

## Decisiones tomadas por Claude (Cesar pidió avanzar sin parar; corregibles)
- **Tipo de categoría nuevo** `navidad` en `categories.kind` (además de `menu` y `merch`). El menú y merch ya filtran por su tipo, así que estos productos no se mezclan. El admin de categorías ofrece el tipo nuevo.
- **Rutas:** `/navidad` (catálogo de la categoría o categorías de tipo `navidad` visibles) y `/navidad/[slug]` (página del producto). Mismas rutas en `/en`.
- **Slug** por producto (`products.slug`, único, nulo permitido para los productos existentes), generado desde el nombre en español en el admin y editable. Si un producto cambia de slug, la vieja URL deja de existir (aceptado: catálogo de temporada).
- **5 fotos:** el admin no deja subir más de 5 y la base lo impide con un trigger (defensa del lado del servidor). Orden de fotos editable (la primera es la portada).
- **Página de producto:** galería (foto grande + miniaturas, deslizable en celular), nombre, etiqueta, precio con tachado, descripción (respeta saltos de línea), selector de cantidad (1–99) y «Agregar al pedido». Aviso de domicilio según la regla de la categoría y el horario de la tienda (reusar lo existente). Botón de volver al catálogo.
- **Navegación:** enlace «Navidad» en el Header y el footer solo cuando existe una categoría `navidad` visible; entradas en `sitemap.xml`.
- **SEO:** title/description por producto, canonical, hreflang, Open Graph con la primera foto, JSON-LD `Product` con `Offer` (precio efectivo, COP, disponibilidad) y `BreadcrumbList`.
- Producto agotado (`available=false`): la página se ve con «Agotado» y sin botón de agregar. Categoría oculta o producto inexistente: 404.

## Fuera de alcance
Variantes (tallas/sabores) dentro de la página, reseñas, stock por unidades, productos de Navidad configurables tipo caja (si se necesitan, se crean como cajas en el menú).

## Migración
Cesar la corre en el SQL Editor antes de publicar.
