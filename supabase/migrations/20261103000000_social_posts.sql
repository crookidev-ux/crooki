-- Latest Instagram / TikTok posts shown on the home page. The admin pastes the
-- post link and uploads the video itself (played muted on the site, so no
-- third-party player or cookies). The poster is the video's first frame,
-- captured in the admin's browser.

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL CHECK (network IN ('instagram', 'tiktok')),
  post_url TEXT NOT NULL CHECK (
    length(post_url) <= 500
    AND post_url ~ '^https://([a-z]+\.)?(instagram|tiktok)\.com/'
  ),
  video_path TEXT NOT NULL CHECK (video_path LIKE 'videos/%'),
  poster_path TEXT NOT NULL CHECK (poster_path LIKE 'posters/%'),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_network_created_idx
  ON public.social_posts (network, created_at DESC);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- The home page reads it for every visitor.
DROP POLICY IF EXISTS "Social posts public read" ON public.social_posts;
CREATE POLICY "Social posts public read" ON public.social_posts
  FOR SELECT USING (true);

-- Same rule as products and seasons: the admin is any signed-in user.
DROP POLICY IF EXISTS "Social posts authenticated insert" ON public.social_posts;
CREATE POLICY "Social posts authenticated insert" ON public.social_posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Social posts authenticated delete" ON public.social_posts;
CREATE POLICY "Social posts authenticated delete" ON public.social_posts
  FOR DELETE USING (auth.role() = 'authenticated');

REVOKE UPDATE, TRUNCATE ON public.social_posts FROM anon, authenticated;

-- Own bucket, so videos get their own size and type limits (product photos
-- live in 'product-images', which has none).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media', 'social-media', true, 52428800,
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Social media public read" ON storage.objects;
CREATE POLICY "Social media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'social-media');

DROP POLICY IF EXISTS "Social media authenticated upload" ON storage.objects;
CREATE POLICY "Social media authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'social-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Social media authenticated delete" ON storage.objects;
CREATE POLICY "Social media authenticated delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'social-media' AND auth.role() = 'authenticated');
