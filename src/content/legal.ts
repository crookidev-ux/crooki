// Legal documents shown under /legal. The Spanish text is the official
// version (source: /politicas/*.md); English is a courtesy translation.
// Body uses a small Markdown subset rendered by components/legal/LegalMarkdown.

export type LegalSlug =
  | "politica-de-datos"
  | "politica-de-cookies"
  | "terminos-club-crooki";

type LegalDoc = {
  slug: LegalSlug;
  es: { title: string; body: string };
  en: { title: string; body: string };
};

export const legalDocs: LegalDoc[] = [
  {
    slug: "politica-de-datos",
    es: {
      title: "Política de Tratamiento de Datos Personales",
      body: `**Crooki Bake Bar** · Versión 1.1 · Vigente desde: 22 de octubre de 2026.

Esta política explica cómo Crooki recolecta, usa, guarda y protege los datos personales de sus clientes, incluidos quienes hacen pedidos en www.crookibakebar.com y quienes se inscriben en el Club Crooki, y cómo pueden ejercer sus derechos. Se expide conforme a la Ley 1581 de 2012, el Decreto 1074 de 2015 (Capítulo 25) y la Ley 2300 de 2023.

## 1. Responsable del tratamiento

- **Razón social:** Crooki Bake Bar
- **NIT:** 1007802103-9
- **Domicilio:** Centro Historico Calle 36 # 5-70, Cartagena de Indias, Colombia
- **Correo para datos personales:** holacrooki@gmail.com
- **Teléfono / WhatsApp:** +573027190084

## 2. Datos que recolectamos

- **Identificación y contacto:** nombre, número de celular y, de forma opcional, correo electrónico.
- **Fecha de cumpleaños** (día y mes), opcional, para el beneficio de cumpleaños.
- **Historial en el Club:** fechas y valores de compra, Bonus acumulados, premios canjeados y mensajes recibidos.
- **Pedidos en el sitio web:** nombre, correo electrónico, teléfono / WhatsApp, forma de entrega (domicilio, recoger o comer en el local), barrio y dirección de entrega, teléfono de quien recibe el pedido, comentarios del pedido y los productos y valores pedidos.

Crooki no solicita datos sensibles (salud, religión, orientación, datos biométricos, entre otros) a través del Club ni del sitio web. **Los pagos en línea los procesa directamente Bold** (pasarela de pagos de Bold.co): los datos de tu tarjeta, cuenta o medio de pago se ingresan en la ventana segura de Bold y **Crooki no los recibe ni los guarda**. Crooki solo conserva el estado del pago (aprobado o rechazado), el valor y la referencia de la transacción.

## 3. Finalidades

Los datos se usan únicamente para:

1. Recibir, preparar y entregar los pedidos hechos en el sitio web, y contactar al cliente y a quien recibe el pedido por WhatsApp o teléfono para confirmarlo y coordinar la entrega.
2. Inscribir al cliente en el Club, registrar sus Bonus y entregar sus premios.
3. Enviarle por WhatsApp, SMS o correo información sobre su tarjeta, beneficios, promociones, lanzamientos y su beneficio de cumpleaños.
4. Analizar hábitos de compra para agrupar clientes y ofrecer beneficios acordes a cada grupo.
5. Medir los resultados del programa y mejorar productos y servicio.
6. Atender consultas, peticiones, quejas y reclamos.
7. Cumplir obligaciones legales y requerimientos de autoridades.

Crooki no vende, alquila ni cede los datos a terceros para fines comerciales propios de esos terceros.

## 4. Autorización

El cliente autoriza el tratamiento de manera previa, expresa e informada al inscribirse, marcando la casilla de aceptación del formulario de registro. Crooki conserva la prueba de cada autorización.

Al hacer un pedido en el sitio web, el cliente autoriza el tratamiento marcando la casilla de aceptación de esta política antes de enviar el pedido. Si el cliente registra el teléfono de otra persona para recibir el pedido, declara que cuenta con su autorización para compartirlo con Crooki con ese fin.

Inscribirse en el Club es voluntario y no es condición para comprar en Crooki. Aceptar los mensajes comerciales es una autorización independiente que el cliente puede revocar en cualquier momento.

## 5. Derechos del titular

- Conocer, actualizar y rectificar sus datos.
- Solicitar prueba de la autorización otorgada.
- Ser informado sobre el uso que se ha dado a sus datos.
- Revocar la autorización y pedir la supresión de sus datos, cuando no exista un deber legal de conservarlos.
- Acceder gratuitamente a sus datos.
- Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber acudido a Crooki.

## 6. Consultas y reclamos

Las solicitudes se envían al correo holacrooki@gmail.com indicando nombre, número de celular registrado, la solicitud y un medio de respuesta.

- **Consultas:** respuesta en máximo 10 días hábiles, prorrogables por 5 días hábiles más informando el motivo.
- **Reclamos:** respuesta en máximo 15 días hábiles, prorrogables por 8 días hábiles más informando el motivo.

Para dejar de recibir mensajes basta con responder **BAJA** al WhatsApp del Club; la solicitud se aplica de inmediato.

## 7. Mensajes comerciales

- Solo se envían a clientes que los autorizaron, por los canales que autorizaron.
- Horario: lunes a viernes de 8:00 a.m. a 5:00 p.m. y sábados de 8:00 a.m. a 3:00 p.m. No se envían domingos ni festivos.
- Máximo un mensaje al día por cliente, por un solo canal en la semana, y máximo cuatro al mes.

## 8. Encargados y transmisión de datos

Para operar el Club, Crooki usa la plataforma **Novu App** y el servicio de **WhatsApp Business**, que tratan los datos por cuenta de Crooki como encargados. Sus servidores pueden estar fuera de Colombia; en ese caso los datos se transmiten bajo un contrato o cláusulas que obligan al encargado a protegerlos con los estándares de la ley colombiana y a usarlos solo para las finalidades de esta política. La política de privacidad de Novu App puede consultarse en https://www.novuapp.ai/privacidad.

Los pedidos del sitio web se guardan en **Supabase**, el servicio de base de datos del sitio, y el sitio se aloja en **Vercel**. Ambos actúan como encargados, pueden tener servidores fuera de Colombia y están sujetos a las mismas condiciones descritas en el párrafo anterior.

Para los pagos en línea, Crooki usa **Bold** (Bold.co), que actúa como pasarela de pagos según su propia política de privacidad: https://bold.co/legal/privacidad-datos-personales. Para enviar al equipo de Crooki el aviso de cada pedido pagado, el sitio usa **Resend**, un servicio de correo que actúa como encargado en las mismas condiciones descritas arriba.

El acceso interno a la base de datos se limita al consultor y a las socias. El personal de caja solo registra Bonus y canjes.

## 9. Seguridad y conservación

Crooki aplica medidas técnicas y administrativas razonables para evitar la pérdida, el uso no autorizado o el acceso indebido a los datos, como usuarios con contraseña personal y acceso restringido a la plataforma.

Los datos de los pedidos del sitio web se conservan durante el tiempo necesario para gestionar el pedido y cumplir las obligaciones legales, contables y tributarias de Crooki.

Los datos del Club se conservan mientras el cliente pertenezca al Club. Si no registra compras en 24 meses o solicita su retiro, sus datos se suprimen, salvo lo que la ley obligue a conservar.

## 10. Menores de edad

Los menores de 18 años solo pueden inscribirse con autorización de su padre, madre o representante legal. Crooki no envía mensajes comerciales a menores.

## 11. Cambios a esta política

Cualquier cambio importante se comunicará a los socios del Club por los canales autorizados antes de aplicarse. La versión vigente estará disponible en www.crookibakebar.com/legal y en el local.`,
    },
    en: {
      title: "Personal Data Processing Policy",
      body: `**Crooki Bake Bar** · Version 1.1 · Effective: October 22, 2026.

This policy explains how Crooki collects, uses, stores and protects the personal data of its customers, including those who order on www.crookibakebar.com and Club Crooki members, and how they can exercise their rights. It is issued under Law 1581 of 2012, Decree 1074 of 2015 (Chapter 25) and Law 2300 of 2023.

## 1. Data controller

- **Business name:** Crooki Bake Bar
- **NIT (tax ID):** 1007802103-9
- **Address:** Centro Historico Calle 36 # 5-70, Cartagena de Indias, Colombia
- **Personal data email:** holacrooki@gmail.com
- **Phone / WhatsApp:** +573027190084

## 2. Data we collect

- **Identification and contact:** name, mobile number and, optionally, email address.
- **Birthday** (day and month), optional, for the birthday benefit.
- **Club history:** purchase dates and amounts, Bonus earned, rewards redeemed and messages received.
- **Website orders:** name, email, phone / WhatsApp, delivery method (delivery, pickup or dine-in), neighborhood and delivery address, phone number of the person receiving the order, order notes and the products and amounts ordered.

Crooki does not request sensitive data (health, religion, orientation, biometric data, among others) through the Club or the website. **Online payments are processed directly by Bold** (the Bold.co payment gateway): your card, account or payment method details are entered in Bold's secure window and **Crooki does not receive or store them**. Crooki only keeps the payment status (approved or declined), the amount and the transaction reference.

## 3. Purposes

Data is used only to:

1. Receive, prepare and deliver orders placed on the website, and contact the customer and the person receiving the order by WhatsApp or phone to confirm it and arrange delivery.
2. Enroll the customer in the Club, record their Bonus and deliver their rewards.
3. Send them information by WhatsApp, SMS or email about their card, benefits, promotions, launches and their birthday benefit.
4. Analyze purchasing habits to group customers and offer benefits suited to each group.
5. Measure program results and improve products and service.
6. Handle inquiries, requests, complaints and claims.
7. Comply with legal obligations and requests from authorities.

Crooki does not sell, rent or transfer data to third parties for those third parties' own commercial purposes.

## 4. Authorization

The customer authorizes processing in a prior, express and informed manner when enrolling, by ticking the acceptance box on the registration form. Crooki keeps proof of each authorization.

When placing an order on the website, the customer authorizes processing by ticking the box accepting this policy before submitting the order. If the customer provides another person's phone number to receive the order, they confirm they have that person's permission to share it with Crooki for that purpose.

Joining the Club is voluntary and is not a condition for buying at Crooki. Accepting marketing messages is a separate authorization that the customer may revoke at any time.

## 5. Data subject rights

- Access, update and correct their data.
- Request proof of the authorization given.
- Be informed about how their data has been used.
- Revoke the authorization and request deletion of their data, when there is no legal duty to keep it.
- Access their data free of charge.
- File complaints with the Superintendence of Industry and Commerce (SIC), after first contacting Crooki.

## 6. Inquiries and claims

Requests are sent to holacrooki@gmail.com stating name, registered mobile number, the request and a way to reply.

- **Inquiries:** answered within 10 business days, extendable by 5 more business days with notice of the reason.
- **Claims:** answered within 15 business days, extendable by 8 more business days with notice of the reason.

To stop receiving messages, simply reply **BAJA** to the Club's WhatsApp; the request is applied immediately.

## 7. Marketing messages

- Sent only to customers who authorized them, through the channels they authorized.
- Hours: Monday to Friday 8:00 a.m. to 5:00 p.m. and Saturdays 8:00 a.m. to 3:00 p.m. No messages on Sundays or public holidays.
- At most one message per day per customer, through a single channel per week, and at most four per month.

## 8. Processors and data transmission

To run the Club, Crooki uses the **Novu App** platform and the **WhatsApp Business** service, which process data on Crooki's behalf as processors. Their servers may be located outside Colombia; in that case data is transmitted under a contract or clauses requiring the processor to protect it to the standards of Colombian law and to use it only for the purposes of this policy. Novu App's privacy policy is available at https://www.novuapp.ai/privacidad.

Website orders are stored in **Supabase**, the site's database service, and the site is hosted on **Vercel**. Both act as processors, may have servers outside Colombia and are subject to the same conditions described in the previous paragraph.

For online payments, Crooki uses **Bold** (Bold.co), which acts as a payment gateway under its own privacy policy: https://bold.co/legal/privacidad-datos-personales. To send the Crooki team the notice of each paid order, the site uses **Resend**, an email service that acts as a processor under the same conditions described above.

Internal access to the database is limited to the consultant and the partners. Checkout staff only record Bonus and redemptions.

## 9. Security and retention

Crooki applies reasonable technical and administrative measures to prevent loss, unauthorized use or improper access to data, such as personal password-protected users and restricted access to the platform.

Website order data is kept for as long as needed to handle the order and to meet Crooki's legal, accounting and tax obligations.

Club data is kept while the customer remains a Club member. If no purchases are recorded in 24 months or the customer asks to leave, their data is deleted, except what the law requires to be kept.

## 10. Minors

Minors under 18 may only enroll with authorization from their father, mother or legal guardian. Crooki does not send marketing messages to minors.

## 11. Changes to this policy

Any significant change will be communicated to Club members through the authorized channels before it takes effect. The current version will be available at www.crookibakebar.com/legal and in store.`,
    },
  },
  {
    slug: "politica-de-cookies",
    es: {
      title: "Política de Cookies",
      body: `**Crooki Bake Bar** · Versión 1.1 · Vigente desde: 22 de octubre de 2026.

Esta política explica qué son las cookies, cuáles usa www.crookibakebar.com y cómo puedes controlarlas. Complementa nuestra [Política de Tratamiento de Datos Personales](/legal/politica-de-datos), conforme a la Ley 1581 de 2012.

## 1. Qué son las cookies

Las cookies son pequeños archivos que un sitio web guarda en tu navegador o celular cuando lo visitas. Sirven para que el sitio funcione y recuerde tus preferencias. Algunos sitios también usan tecnologías similares, como el almacenamiento local del navegador.

## 2. Qué cookies usamos

Hoy www.crookibakebar.com solo usa cookies y almacenamiento **necesarios** para que el sitio funcione:

- **Idioma:** recuerda si prefieres ver el sitio en español o en inglés.
- **Carrito de compras:** guarda en el almacenamiento local de tu navegador los productos que agregas al carrito, para que no se pierdan si recargas la página. Esta información queda en tu dispositivo y no se nos envía hasta que haces el pedido.
- **Sesión de administración:** solo para el personal autorizado de Crooki que ingresa al panel de administración.

Estas cookies no requieren tu autorización porque sin ellas el sitio no funcionaría correctamente.

**No usamos cookies analíticas ni publicitarias** (como Google Analytics o el Píxel de Meta) y no compartimos información de tu navegación con terceros para hacer publicidad.

## 3. Enlaces a otros sitios

El sitio tiene enlaces a WhatsApp, Instagram, TikTok y Google Maps. Al abrirlos sales de www.crookibakebar.com y esos servicios pueden usar sus propias cookies según sus políticas:

- Google: https://policies.google.com/privacy
- Meta (WhatsApp e Instagram): https://www.facebook.com/privacy/policy
- TikTok: https://www.tiktok.com/legal/privacy-policy

Al pagar en línea se abre la ventana de pago de **Bold**, que puede usar sus propias cookies según su política: https://bold.co/legal/privacidad-datos-personales

## 4. Cómo controlar las cookies

Puedes borrar o bloquear las cookies y el almacenamiento local desde la configuración de Chrome, Safari, Firefox o Edge. Si lo haces, el sitio puede olvidar tu idioma o los productos de tu carrito.

## 5. Duración

La cookie de idioma y la de sesión de administración son de corta duración. Los productos del carrito se guardan en tu navegador hasta que haces el pedido, los eliminas o borras los datos del navegador.

## 6. Contacto

Si tienes preguntas sobre esta política o quieres ejercer tus derechos sobre tus datos, escríbenos a holacrooki@gmail.com.

## 7. Cambios

Si en el futuro empezamos a usar cookies analíticas o publicitarias, actualizaremos esta política y su fecha de vigencia, y te pediremos tu autorización antes de activarlas.`,
    },
    en: {
      title: "Cookie Policy",
      body: `**Crooki Bake Bar** · Version 1.1 · Effective: October 22, 2026.

This policy explains what cookies are, which ones www.crookibakebar.com uses and how you can control them. It complements our [Personal Data Processing Policy](/legal/politica-de-datos), under Law 1581 of 2012.

## 1. What cookies are

Cookies are small files a website stores in your browser or phone when you visit it. They help the site work and remember your preferences. Some sites also use similar technologies, such as the browser's local storage.

## 2. Cookies we use

Today www.crookibakebar.com only uses cookies and storage that are **necessary** for the site to work:

- **Language:** remembers whether you prefer to see the site in Spanish or English.
- **Shopping cart:** saves the products you add to your cart in your browser's local storage, so they are not lost if you reload the page. This information stays on your device and is not sent to us until you place your order.
- **Admin session:** only for authorized Crooki staff who sign in to the admin panel.

These cookies do not require your authorization because the site would not work properly without them.

**We do not use analytics or advertising cookies** (such as Google Analytics or the Meta Pixel) and we do not share your browsing information with third parties for advertising.

## 3. Links to other sites

The site links to WhatsApp, Instagram, TikTok and Google Maps. When you open them you leave www.crookibakebar.com, and those services may use their own cookies under their own policies:

- Google: https://policies.google.com/privacy
- Meta (WhatsApp and Instagram): https://www.facebook.com/privacy/policy
- TikTok: https://www.tiktok.com/legal/privacy-policy

When you pay online, the **Bold** payment window opens, and it may use its own cookies under its own policy: https://bold.co/legal/privacidad-datos-personales

## 4. How to control cookies

You can delete or block cookies and local storage from the settings of Chrome, Safari, Firefox or Edge. If you do, the site may forget your language or the products in your cart.

## 5. Duration

The language cookie and the admin session cookie are short-lived. Cart products stay in your browser until you place your order, remove them or clear your browser data.

## 6. Contact

If you have questions about this policy or want to exercise your data rights, write to us at holacrooki@gmail.com.

## 7. Changes

If we start using analytics or advertising cookies in the future, we will update this policy and its effective date, and ask for your authorization before enabling them.`,
    },
  },
  {
    slug: "terminos-club-crooki",
    es: {
      title: "Términos y Condiciones del Club Crooki",
      body: `**Programa de fidelización de Crooki Bake Bar** · Versión 1.0 · Vigente desde: 7 de Octubre de 2026.

## Cómo funciona

El Club Crooki es una tarjeta digital de Bonus que se guarda en Apple Wallet o Google Wallet. No hay tarjeta física. Para inscribirte, escanea el código QR en el local y agrega la tarjeta a tu celular.

- **Ganar Bonus:** recibes 1 Bonus por visita al local con una compra mínima de $20.000. Al pagar, muestra la tarjeta del Club desde tu Wallet.
- **Recompensa:** al completar 8 Bonus eliges uno gratis: una galleta clásica, un crunchy brownie, un cinnamon roll o un helado mediano con cualquier salsa.

## Términos

1. Recibes 1 Bonus por visita al local de Crooki con una compra mínima de $20.000 en una misma factura. Las compras menores a $20.000 no suman Bonus, y se otorga máximo 1 Bonus por visita sin importar el valor de la compra.
2. Los pedidos por Rappi u otras plataformas de domicilio no suman Bonus.
3. Al acumular 8 Bonus obtienes una recompensa a elegir: galleta clásica, crunchy brownie, cinnamon roll o helado mediano con cualquier salsa.
4. Cada Bonus es válido por 3 meses desde la fecha en que lo ganaste. Las recompensas deben reclamarse dentro de los 30 días siguientes a completar la tarjeta.
5. Los Bonus y las recompensas no se pueden cambiar, devolver, reemplazar ni canjear por dinero.
6. La recompensa no es acumulable con otras promociones o descuentos.
7. La tarjeta es personal: no se puede transferir ni combinar con otras tarjetas. Solo se permite una tarjeta por persona.
8. El programa no aplica para socias ni empleados de Crooki.
9. Crooki puede anular Bonus o tarjetas cuando haya fraude o mal uso del programa.
10. Crooki puede modificar o terminar el programa avisando con 30 días de anticipación por los canales autorizados. Los premios ya ganados se respetarán.
11. Crooki es responsable del tratamiento de tus datos, conforme a su [Política de Tratamiento de Datos](/legal/politica-de-datos). La plataforma Novu App los procesa por cuenta de Crooki para operar el Club.`,
    },
    en: {
      title: "Club Crooki Terms and Conditions",
      body: `**Crooki Bake Bar loyalty program** · Version 1.0 · Effective: October 7, 2026.

## How it works

Club Crooki is a digital Bonus card saved in Apple Wallet or Google Wallet. There is no physical card. To join, scan the QR code in store and add the card to your phone.

- **Earning Bonus:** you get 1 Bonus per store visit with a minimum purchase of COP $20,000. When paying, show your Club card from your Wallet.
- **Reward:** after collecting 8 Bonus you choose one free item: a classic cookie, a crunchy brownie, a cinnamon roll or a medium ice cream with any sauce.

## Terms

1. You get 1 Bonus per visit to the Crooki store with a minimum purchase of COP $20,000 on a single receipt. Purchases under COP $20,000 do not earn Bonus, and a maximum of 1 Bonus is given per visit regardless of the purchase amount.
2. Orders through Rappi or other delivery platforms do not earn Bonus.
3. After collecting 8 Bonus you get a reward of your choice: classic cookie, crunchy brownie, cinnamon roll or medium ice cream with any sauce.
4. Each Bonus is valid for 3 months from the date you earned it. Rewards must be claimed within 30 days of completing the card.
5. Bonus and rewards cannot be exchanged, returned, replaced or redeemed for cash.
6. The reward cannot be combined with other promotions or discounts.
7. The card is personal: it cannot be transferred or combined with other cards. Only one card per person.
8. The program does not apply to Crooki partners or employees.
9. Crooki may cancel Bonus or cards in case of fraud or misuse of the program.
10. Crooki may modify or end the program with 30 days' notice through the authorized channels. Rewards already earned will be honored.
11. Crooki is the controller of your data, under its [Personal Data Processing Policy](/legal/politica-de-datos). The Novu App platform processes it on Crooki's behalf to run the Club.`,
    },
  },
];

export function getLegalDoc(slug: string) {
  return legalDocs.find((d) => d.slug === slug);
}
