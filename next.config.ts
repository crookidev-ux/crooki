import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next.js dev mode (React refresh) needs eval; production never gets it.
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

// Cloudflare Turnstile (anti-bot check on the checkout): script + iframe.
const TURNSTILE = "https://challenges.cloudflare.com";

// Content-Security-Policy, enforced since 2026-11-04. It was Report-Only first;
// a test payment in Bold's window (test keys) showed no violations in our page.
// Bold's window is an iframe from checkout.bold.co with its own policy, so what
// it loads inside (reCAPTCHA, Clarity, Segment, its APIs, an eval() it blocks
// itself) is governed by Bold, not by this list. 'unsafe-inline'
// in script-src is needed because Next.js injects inline bootstrap scripts and
// the JSON-LD tag; removing it requires nonces through the proxy (see
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Fonts come from next/font (self hosted) and images go through next/image
// (/_next/image), so both are 'self'. If a new third-party script is added,
// add its origin here or it will be blocked.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${BOLD} ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE} ${BOLD}`,
  `media-src 'self' blob: ${SUPABASE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} ${BOLD} ${TURNSTILE}`,
  `frame-src ${BOLD} ${TURNSTILE}`,
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
  { key: "Content-Security-Policy", value: csp },
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
