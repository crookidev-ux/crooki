---
name: legal
description: Cambia las políticas o los términos de Crooki (tratamiento de datos, cookies, Club Crooki) de forma consistente — edita ES (oficial) y EN en src/content/legal.ts, sincroniza politicas/*.md, revisa coherencia con lo que hace la web y muestra el resultado en local. Úsala cuando el usuario pida cambiar una política, una regla del Club o un texto legal, o escriba /legal.
---

# /legal (Crooki)

1. **Lee**:
   - `src/content/legal.ts`: tres documentos (`politica-de-datos`, `politica-de-cookies`, `terminos-club-crooki`), cada uno con `es` y `en`.
   - La memoria `project-legal-content`.
2. **Aplica el cambio**:
   - Usa el texto del usuario **tal cual** en español; es el oficial.
   - Si el término cambia (por ejemplo "sellos" → "Bonus"), pregunta si debe cambiar en **todo** el documento y en la política de datos.
   - Revisa los ejemplos y resúmenes que queden desactualizados (la sección "Cómo funciona" del Club).
3. **Inglés**: traducción de cortesía con el mismo significado y las mismas cifras (`COP $20,000`).
4. **Sincroniza** `politicas/*.md` con el texto en español: título `# <título>` + cuerpo, generado desde `legal.ts`, sin editarlo a mano por separado.
5. **Coherencia con la realidad**:
   - La política de cookies debe describir lo que la web hace hoy: solo cookies necesarias, sin analítica. Si alguien agregó GA o Meta, hay que actualizarla y agregar un banner de consentimiento.
   - La política de datos debe cubrir lo que pide el checkout.
6. **Verifica**: `npm run build` y revisa `/legal/<slug>` y `/en/legal/<slug>` en local.
7. **Publica** con `/publicar`, después del OK del usuario.
8. **Actualiza** la memoria `project-legal-content` si cambian reglas del Club o del uso de datos.

Formato del cuerpo: Markdown simple (`## `, listas `- ` y `1. `, `**negrita**`, `[texto](/ruta)`, URLs sueltas). Lo renderiza `src/components/legal/LegalMarkdown.tsx`.
