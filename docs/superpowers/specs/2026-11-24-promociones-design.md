# Promociones: precio de oferta + etiquetas (Entrega 1)

Fecha: 2026-11-24 · Aprobado por Cesar en el chat («usa tus agentes y vamos a darle sin parar», opción B).
Urgencia: Black Friday es el viernes 2026-11-27. Debe poder publicarse antes.

## Por qué
Hoy la web no muestra ninguna promoción (no hay nada de Black Friday). Cesar quiere que el admin ponga un precio rebajado, que el precio normal se vea tachado (inicio, menú, merch y luego Navidad) y que el producto lleve una etiqueta visible sobre la foto (cinta negra y dorada para Black Friday).

## Decisiones (de Cesar)
- **Opción B:** el precio normal (`price`) no se toca. El admin pone un **precio de oferta** y, si quiere, una **fecha/hora de fin**. Mientras la oferta está activa se **cobra** el precio de oferta y se muestra `price` tachado; al vencer, todo vuelve solo al precio normal.
- **Varias etiquetas**, fijas en código (no creables desde el admin), con diseño propio y ES/EN: `black_friday` (cinta negra y dorada), `oferta` (vino Crooki), `navidad` (verde/rojo), `nuevo`, `mas_vendido`, `edicion_limitada`.
- El precio tachado y las etiquetas aplican también a la futura categoría Navidad (Entrega 2), así que el componente es reutilizable.

## Reglas
- Oferta activa ⇔ `sale_price` no nulo, `0 < sale_price < price` y (`sale_ends_at` nulo o `> ahora`).
- Etiquetas de oferta (`black_friday`, `oferta`) solo se muestran mientras la oferta está activa. Las demás se muestran siempre que estén asignadas.
- El servidor es el único que decide el precio cobrado (`src/lib/checkout/*`). Un solo helper compartido calcula el precio efectivo, usado por el cobro y por la interfaz.
- Combos/cajas/helados: la oferta rebaja el precio base; los extras y tarjetas no cambian.
- La fecha de fin se ingresa en hora de Colombia (America/Bogota).
- Inicio: los productos con oferta activa salen primero en «Nuestros sabores».

## Fuera de alcance
Cupones, porcentajes automáticos, ofertas por categoría completa, etiquetas creadas desde el admin.

## Migración
La corre Cesar en el SQL Editor de Supabase **antes** de publicar el código (el código nuevo selecciona columnas nuevas; sin migración el cobro fallaría).
