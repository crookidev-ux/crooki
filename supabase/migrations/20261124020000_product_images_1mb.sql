-- Keep the public `product-images` bucket from filling up.
--
-- Why: on 2026-11-24 the bucket held 216.7 MB, of which 209.8 MB (116 files)
-- were unused: heavy PNG/JPG originals kept after the 2026-11-19 webp
-- re-encode, and files of photos removed in the admin (the form deleted the
-- row but not the file). Those files were backed up outside the repo and
-- deleted; the 65 photos in use weigh 6.9 MB.
--
-- The admin (src/components/admin/ProductFormClient.tsx) compresses every
-- upload in the browser to <=1200 px webp (JPEG on browsers that can't
-- encode webp), typically 50-300 KB, and now deletes the file together with
-- the row. This caps what the bucket accepts so a heavy original can't get in
-- even by mistake. Applied on 2026-11-24 through the Storage API.

update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'product-images';

-- Rollback (previous limits, 20261104000100_product_images_limits.sql):
-- update storage.buckets
-- set file_size_limit = 5242880,
--     allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
-- where id = 'product-images';
