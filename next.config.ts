import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// Our Supabase project (API, auth, storage: product photos and the
// social-media videos). Falls back to the wildcard when the env var is missing.
function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
}
const SUPABASE = supabaseOrigin();
const SUPABASE_WS = SUPABASE.replace(/^https:/, "wss:");

// Bold checkout: src/components/order/useBoldCheckout.ts loads
// https://checkout.bold.co/library/boldPaymentButton.js, which opens Bold's
// payment window (iframe) and calls Bold's APIs from the browser.
const BOLD = "https://checkout.bold.co https://*.bold.co";

// Content-Security-Policy is sent as **Report-Only** for now: the browser only
// logs what it would block and nothing breaks. The Bold checkout loads more
// third-party resources than we can list from our code alone (iframes, its own
// APIs, possibly anti-fraud scripts), and a wrong enforced CSP would stop
// people from paying. Plan: watch the console on / and /pedido (and a test
// payment) for violations, add what is missing, then switch the key to
// `Content-Security-Policy`. 'unsafe-inline' in script-src is needed because
// Next.js injects inline bootstrap scripts and the JSON-LD tag; removing it
// requires nonces through the proxy (see node_modules/next/dist/docs/01-app/
// 02-guides/content-security-policy.md). Fonts come from next/font (self
// hosted) and images go through next/image (/_next/image), so both are 'self'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${BOLD}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE} ${BOLD}`,
  `media-src 'self' blob: ${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} ${BOLD}`,
  `frame-src ${BOLD}`,
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${BOLD}`,
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
