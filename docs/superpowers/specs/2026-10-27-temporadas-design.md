# Temporadas (decoración de temporada en la página de inicio)

Fecha: 2026-10-27 · Autor: Claude (con Cesar)

## Intención

Cesar quiere que la página de inicio de Crooki se vista sola según la fecha
(Halloween, Navidad, fiestas locales…) y poder prender o apagar cada temporada
desde el admin. Debe **sentirse** la temporada, verse pro y coherente con la
marca, y **nunca** crear fricción para el cliente: no tapa botones, no frena la
carga, no estorba el pedido.

## Metas

- 7 temporadas: Navidad, Halloween, Fiestas de Noviembre de Cartagena, Carnaval
  de Barranquilla, Semana Santa, San Valentín y Amor y Amistad.
- Cada una se activa sola en sus fechas y se puede forzar a encendida o apagada
  desde el admin.
- Decoración animada, discreta, dibujada en SVG propio con la paleta Crooki,
  con 1 personaje que reacciona al clic (se esconde y vuelve a salir).

## No metas

- No cambia el título, el texto ni los botones del hero. No cambia menú, carrito,
  pago, merch, «Mi pedido», legales ni admin.
- No hay productos, precios ni categorías de temporada.
- No hay sonido.

## Anti-metas (sería un fracaso aunque funcione)

- **Ofrecer algo que no existe.** Nada de "edición limitada", "cajas para
  regalar", "especial de temporada" ni promesas de producto. Solo un saludo.
- Decoración encima de un botón, enlace o texto, o que intercepte clics/toques
  del contenido.
- Que empeore la carga en celular (sin librerías de animación, sin imágenes
  pesadas, sin cambio de diseño al cargar).
- Que se vea genérico o "sticker de internet": todo con la paleta de Crooki.
- Exagerado: la intensidad aprobada es la del boceto (3 murciélagos, 1 telaraña,
  1 fantasma, 1 calabaza; nieve suave + 3 bolas + 1 elfo).

## Lo que ve el cliente

Solo en la página de inicio (`src/app/[locale]/page.tsx`), dentro del hero
(`src/components/home/Hero.tsx`, fondo `#8b0031`). La capa decorativa va detrás
o a los lados del contenido, como las migas (`Crumbs`): `aria-hidden`,
`pointer-events: none` salvo el personaje clicable, que se ubica fuera de las
zonas de texto y botones (junto a la foto).

**Etiqueta del hero:** la pastilla superior (hoy `hero.badge` con icono de
galleta) se reemplaza por el saludo de la temporada activa, en ES y EN. Sin
temporada activa queda como hoy.

| Temporada | Elementos | Saludo ES / EN |
|---|---|---|
| Halloween | Fondo un poco más oscuro hacia los bordes (sigue siendo vino tinto); 3 murciélagos cruzando despacio; telaraña sutil en una esquina; fantasma flotando junto a la foto (clic: se esconde y vuelve); calabaza con luz que titila | ¡Feliz Halloween! / Happy Halloween! |
| Navidad | Nieve suave; 3 bolas de árbol colgando que se mecen (crema `#f3c78b`, blanco, un verde); elfo asomado junto a la foto (clic) | ¡Feliz Navidad! / Merry Christmas! |
| Fiestas de Noviembre | Banderines con los colores de la bandera de Cartagena (rojo, amarillo, verde); confeti; pequeños fuegos artificiales a los lados; buscapié que salta al clic | ¡Felices Fiestas de Independencia! / Happy Independence Festivities! |
| Carnaval de Barranquilla | Serpentinas; confeti de colores; Marimonda asomada junto a la foto (clic); sombrero de Congo con flores | ¡Quien lo vive es quien lo goza! / Live it to love it! |
| Semana Santa | Serena, por respeto: ramos de palma en las esquinas, luz cálida suave, casi sin movimiento, **sin personaje que salte** | Feliz Semana Santa / Happy Holy Week |
| San Valentín | Corazones flotando hacia arriba despacio; cupido que se asoma (clic); sobres de carta | ¡Feliz San Valentín! / Happy Valentine's Day! |
| Amor y Amistad | Mismos adornos que San Valentín | ¡Feliz Amor y Amistad! / Happy Love & Friendship Day! |

Referencia visual aprobada en intensidad: boceto
`.superpowers/brainstorm/20661-1793143100/content/hero-temporadas.html`
(los textos de ese boceto NO valen: ahí decía "edición limitada" y "cajas").

**Requisitos de calidad:**
- Celular (390 px) y escritorio; en celular menos elementos si estorban.
- `prefers-reduced-motion`: decoración quieta (sin caída ni vuelo), sigue visible.
- Solo CSS + SVG en línea; el componente de cada temporada se carga solo cuando
  esa temporada está activa (no se envía el código de las 7 a cada visita).
- Sin desplazamiento horizontal ni salto de diseño.

## Lo que ve el admin

Nueva página **Temporadas** en `AdminNav`, junto a Productos y Categorías
(`/[locale]/admin/temporadas`). Arriba, un aviso con lo que sale hoy y por qué
(p. ej. "Hoy se ve: Halloween — automática hasta el 31 de oct" o "Ninguna").
Debajo, 7 tarjetas, cada una con un dibujito, su nombre, sus fechas y un control
de tres posiciones con el estilo de `CategoryVisibilityToggle`:

- **Automática** (por defecto): se ve en sus fechas.
- **Encendida**: se ve ya, sin importar la fecha, hasta que la cambien. Solo una
  puede estar encendida; al encender otra, la anterior vuelve a Automática.
- **Apagada**: no se ve nunca, ni en sus fechas.

Las fechas fijas se pueden editar (día y mes de inicio y fin). Las móviles
(Carnaval, Semana Santa, Amor y Amistad) se calculan solas cada año y se
muestran calculadas para el año en curso.

Textos del admin solo en español, igual que el resto del admin hoy
(`AdminNav` mezcla `t()` y textos fijos; seguir esa costumbre).

## Fechas por defecto (hora de Colombia, `America/Bogota`)

| Temporada | Rango |
|---|---|
| San Valentín | 7–14 feb |
| Carnaval | sábado de Carnaval − 7 días → martes de Carnaval (sábado de Carnaval = Pascua − 50 días; martes = Pascua − 47) |
| Semana Santa | Domingo de Ramos (Pascua − 7) → Domingo de Resurrección |
| Amor y Amistad | lunes anterior al tercer sábado de septiembre → domingo siguiente |
| Halloween | 15–31 oct |
| Fiestas de Noviembre | 1–15 nov |
| Navidad | 1 dic → 6 ene (cruza el año) |

Los rangos son inclusivos de día completo.

## Reglas de prioridad

1. Si hay una temporada **Encendida**, se muestra esa.
2. Si no, entre las **Automáticas** cuya fecha incluye hoy, gana la que empezó más
   recientemente (p. ej. en 2027 Carnaval va del 30 ene al 9 feb y San Valentín del 7 al 14 feb: del 7 al 9 gana San Valentín).
3. Las **Apagadas** nunca cuentan.
4. Si no queda ninguna, el hero queda como hoy.

## Datos y seguridad

- Tabla nueva en Supabase (migración en `supabase/migrations/`) con una fila por
  temporada: identificador, modo (`auto` / `on` / `off`) y, para las de fecha
  fija, día/mes de inicio y fin editables. Lectura pública (la necesita la
  página de inicio); escritura solo para usuarios autenticados (el admin hoy es
  cualquier usuario con sesión, ver `src/lib/admin-auth.ts`). Las 7 filas se
  siembran en la migración.
- Si la tabla no existe o falla la lectura, la página de inicio sigue como hoy
  (sin temporada), igual que `getProducts` cae a datos de ejemplo.
- El cálculo de "qué temporada sale hoy" es una función pura con pruebas
  (Pascua, cruce de año en Navidad, coincidencias, Encendida/Apagada), al estilo
  de los `*.test.ts` de `src/lib/`.

## Idiomas

Saludos en `src/messages/es.json` y `en.json`. Nombres de temporada para el
admin en español.

## Proceso del repo

- Al terminar: entrada en `vault/Decisions.md` (el vault no existe en este PC;
  ver memoria — registrar en el lugar acordado o avisar).
- Migración: hay que aplicarla en Supabase real (`.env.local` apunta a
  producción); pedir OK antes.
- Mostrar en local con capturas (escritorio + 390 px) y esperar OK antes de push.

## Decisiones tomadas tras la revisión (llamadas de Claude)

- **Etiqueta del hero:** con temporada activa, el icono de galleta se reemplaza
  por un icono SVG pequeño de la temporada (calabaza, árbol, banderín, máscara,
  palma, corazón). Los saludos van **sin emoji** en el texto, para que las 7 se
  vean iguales de cuidadas. Sin temporada, la etiqueta queda como hoy.
- **Fechas editables:** solo día y mes, y valen para todos los años. Se permite
  cruzar el año (inicio > fin, como Navidad) y que se superpongan con otra (la
  regla de prioridad decide). Validación: fechas reales (no 31 de febrero).
- **Permisos:** escritura para `authenticated`, igual que productos y categorías
  hoy (`supabase/schema.sql:83`). **Hallazgo aparte, sin verificar:** si el
  registro de usuarios de Supabase está abierto, cualquiera podría crear cuenta
  y editar productos, categorías, pedidos y temporadas. Se revisa y corrige en
  una tarea separada para todas las tablas a la vez.

## Queda a criterio del constructor

- Nombres de tabla/columnas, estructura de componentes, cómo se dibuja cada SVG
  (siempre que respete paleta e intensidad aprobadas).
- Cuántos elementos quitar en celular para no estorbar.
- Cómo se forzar la previsualización de cada temporada en local para las
  capturas (p. ej. parámetro solo en desarrollo).

## Entrega (decisión de Cesar, 2026-10-27)

Las 7 temporadas en un solo lote, con capturas de cada una. No se corre por
Halloween 2026; se busca que Fiestas de Noviembre quede lista para el 1 de nov.

## CAMBIO (Cesar, 2026-10-27): activación solo manual

Reemplaza las secciones "Fechas por defecto", "Reglas de prioridad", las tres
posiciones del admin y las fechas editables. Ahora:

- No hay fechas ni activación automática. Cesar enciende una temporada con un
  interruptor en el admin y la apaga cuando quiera.
- Solo una activa a la vez: encender una apaga la anterior. Apagar la activa
  deja el hero como hoy.
- El aviso de arriba del admin dice "Hoy se ve: <temporada>" o "Ninguna".
- Datos: una sola fila de ajustes con la temporada activa (o ninguna).
