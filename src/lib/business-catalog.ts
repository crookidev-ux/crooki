// Christmas 2026 business catalog (docs/Crooki_Institucional_Navidad2026.pdf),
// in the PDF's order. Names are proper names and prices are display text: both
// read the same in every locale.
export interface BusinessProduct {
  id: string;
  name: string;
  price: string;
  image?: string;
  featured?: boolean;
}

const img = (id: string) => `/images/empresas/${id}.webp`;

export const BUSINESS_PRODUCTS: BusinessProduct[] = [
  { id: "chocobombas", name: "Chocobombas", price: "desde $23.500", image: img("chocobombas"), featured: true },
  { id: "kit-casita", name: "Kit armable", price: "$56.000" },
  { id: "cookie-kit", name: "Cookie kit", price: "$41.000" },
  { id: "mini-cookies", name: "Mini cookies", price: "desde $45.000", image: img("mini-cookies"), featured: true },
  { id: "share-box", name: "Share box", price: "$59.900", image: img("share-box"), featured: true },
  { id: "christmas-mug", name: "Christmas mug", price: "$35.000", image: img("christmas-mug"), featured: true },
  { id: "fresas", name: "Fresas navideñas", price: "$89.900" },
  { id: "holiday-gift", name: "Holiday gift", price: "$120.000", image: img("holiday-gift"), featured: true },
  { id: "mini-brownies-12", name: "Mini brownies x12", price: "$36.000" },
  { id: "cookies", name: "Cookies", price: "$6.500 c/u" },
  { id: "christmas-brownie", name: "Christmas brownie", price: "$10.000 c/u" },
  { id: "cookie-box", name: "Cookie box", price: "desde $41.000", image: img("cookie-box"), featured: true },
  { id: "perfect-duo", name: "Perfect duo", price: "$25.900" },
  { id: "chocobomba", name: "Chocobomba", price: "$10.000 c/u" },
  { id: "mini-duo", name: "Mini duo", price: "$19.500" },
  { id: "mini-gift", name: "Mini gift", price: "$18.500" },
  { id: "mini-mix", name: "Mini mix", price: "$18.000" },
  { id: "mini-brownies-8", name: "Mini brownies x8", price: "$18.000" },
  { id: "brownie-cake", name: "Brownie cake", price: "$89.900" },
  { id: "brownie-box", name: "Brownie box", price: "$48.000" },
  { id: "cinnamon-roll", name: "Cinnamon roll", price: "desde $15.000" },
];

export const BUSINESS_CATALOG_PDF = "/catalogo-empresas-navidad-2026.pdf";
export const BUSINESS_HERO_IMAGE = "/images/empresas/cajas-navidad.webp";
