# Crooki - Setup Guide

## Credentials Needed

### 1. Supabase (Backend & Auth)

Go to https://supabase.com → Create new project

Collect:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: Found in Settings → API → `anon public`
- **Service Role Key**: Found in Settings → API → `service_role secret`

Update `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

### 2. Run the Database Schema

In the Supabase dashboard → SQL Editor → paste the contents of `supabase/schema.sql` and run.

### 3. Create Storage Bucket

In Supabase dashboard → Storage → New bucket:
- Name: `product-images`
- Public: ✅ Yes

### 4. Create Admin User

In Supabase dashboard → Authentication → Users → Add user:
- Email: `admin@crooki.com`
- Password: (choose a secure password)

### 5. Upload Product Images

After setting up Supabase credentials, run:
```bash
node scripts/upload-images.mjs
```

This uploads all product photos from `public/images/` to Supabase Storage.

---

## Local Development

```bash
npm run dev
# Open http://localhost:3001
```

---

## GitHub Setup

```bash
# Create a new repo at github.com manually, then:
git remote add origin https://github.com/YOUR_USERNAME/crooki-web.git
git push -u origin main
```

**GitHub token needed:** Classic token with `repo` scope at https://github.com/settings/tokens

---

## Vercel Deployment

### Option A: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B: Vercel Dashboard
1. Go to https://vercel.com → New Project
2. Import from GitHub
3. Add Environment Variables (same as `.env.local`)
4. Change `NEXT_PUBLIC_SITE_URL` to your Vercel domain

### Environment Variables for Vercel:
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `NEXT_PUBLIC_SITE_URL` | https://your-domain.vercel.app |
| `BOLD_IDENTITY_KEY` | Bold → Integraciones → Llaves de integración (production keys in Production, test keys only in `.env.local`) |
| `BOLD_SECRET_KEY` | Same Bold environment as the identity key |
| `RESEND_API_KEY` | Resend → API Keys |
| `ORDER_NOTIFY_EMAIL` | Comma-separated emails that receive each new order |
| `ORDER_NOTIFY_FROM` | `Crooki <noreply@crookibakebar.com>` |

Without the two Bold keys the checkout only offers «Pagar por QR (WhatsApp)». Register the Bold webhook (production) at `https://<domain>/api/bold/webhook`.

---

## Admin Panel

Once deployed:
- URL: `https://your-domain/admin` (or `http://localhost:3001/admin`)
- Login: `admin@crooki.com` + password you set in Supabase Auth
- Create/edit products with photos
- View and manage orders
- Switch on a seasonal home decoration (`/admin/temporadas`): one season at a time, or none

### Seasonal decoration (Temporadas)

- Seven seasons: San Valentín, Carnaval de Barranquilla, Semana Santa, Amor y Amistad, Halloween, Fiestas de Noviembre, Navidad. Switched on **by hand** from the admin; there are no automatic dates.
- Stored in the single-row table `site_settings.active_season` (`supabase/migrations/20261027000000_site_settings_season.sql`, applied in production on 2026-10-28). Public read; only signed-in users can update.
- Only the hero changes: decoration behind/beside the content (`src/components/seasons/`) and a greeting in the badge (`seasons` namespace in `src/messages/*.json`). Seasons never promise products.
- Local preview without touching the setting: `http://localhost:3001/?temporada=<id>` or `?temporada=ninguna` (ignored in production).
- Design and plan: `docs/superpowers/specs/2026-10-27-temporadas-design.md`, `docs/superpowers/plans/2026-10-27-temporadas.md`.

---

## Routes

| Path | Description |
|------|-------------|
| `/` or `/es` | Home (Spanish) |
| `/en` | Home (English) |
| `/menu` | Full cookie menu |
| `/pedido` | Checkout |
| `/admin` | Admin dashboard |
| `/admin/login` | Admin login |
| `/admin/productos/nuevo` | Create product |
| `/admin/temporadas` | Seasonal home decoration |
