// One-off: re-encodes every product photo in the `product-images` bucket as a
// webp of at most 1200 px wide and points `product_images.url` at it.
// Why: since 2026-11-19 the site serves images without Vercel's optimizer
// (`images.unoptimized` in next.config.ts), so the stored files must already
// be web-sized. Originals are left in the bucket (nothing is deleted), so the
// change can be reverted by restoring the old URLs printed below.
// Usage: node scripts/compress-product-images.mjs [--dry]
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import sharp from "sharp"; // shortcut: comes with next; add it to devDependencies if next ever drops it
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const DRY = process.argv.includes("--dry");
const BUCKET = "product-images";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: rows, error } = await sb.from("product_images").select("id, url");
if (error) throw error;

let before = 0;
let after = 0;
for (const row of rows) {
  const i = row.url.indexOf(MARKER);
  if (i === -1 || row.url.endsWith(".web.webp")) {
    console.log("skip", row.url);
    continue;
  }
  const res = await fetch(row.url);
  if (!res.ok) {
    console.error("FAIL download", res.status, row.url);
    continue;
  }
  const input = Buffer.from(await res.arrayBuffer());
  const output = await sharp(input)
    .rotate() // apply EXIF orientation before it is stripped
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  before += input.length;
  after += output.length;

  const oldPath = decodeURIComponent(row.url.slice(i + MARKER.length));
  const newPath = oldPath.replace(/\.[^./]+$/, "") + ".web.webp";
  console.log(`${(input.length / 1024).toFixed(0)} KB -> ${(output.length / 1024).toFixed(0)} KB  ${oldPath}`);
  if (DRY) continue;

  const up = await sb.storage.from(BUCKET).upload(newPath, output, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
  });
  if (up.error) {
    console.error("FAIL upload", up.error.message, newPath);
    continue;
  }
  const newUrl = sb.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
  const upd = await sb.from("product_images").update({ url: newUrl }).eq("id", row.id);
  if (upd.error) console.error("FAIL update", upd.error.message, row.id);
  else console.log(`  old url (to revert): ${row.url}`);
}
console.log(`\nTotal: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB${DRY ? " (dry run)" : ""}`);
