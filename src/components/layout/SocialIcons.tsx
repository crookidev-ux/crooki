// Brand marks and profile links for Instagram and TikTok (lucide has no brand icons).

export const INSTAGRAM_URL =
  "https://www.instagram.com/crookibakebar?igsh=MWJjcnJoazB5ZmxkaQ==";
export const TIKTOK_URL =
  "https://www.tiktok.com/@crookibakebar?_r=1&_t=ZS-95JY49t8jcO";

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 8.2a7 7 0 0 1-4.1-1.3v7.8a6 6 0 1 1-6-6v3.2a2.8 2.8 0 1 0 2 2.7V2h3a4.1 4.1 0 0 0 5.1 4.1V8.2Z" />
    </svg>
  );
}
