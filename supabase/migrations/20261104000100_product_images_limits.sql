-- Limit what can be stored in the public `product-images` bucket.
--
-- Why: the bucket had no size or type limit, so any admin session (or a
-- stolen one) could upload huge files or non-images (HTML, SVG with script)
-- that would then be served from our public Supabase URL. 5 MB and three
-- raster formats cover every product photo we use (the site serves webp).
-- The admin form (src/components/admin/ProductFormClient.tsx) applies the
-- same rules before uploading, so admins get a clear message instead of a
-- storage error.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'product-images';
