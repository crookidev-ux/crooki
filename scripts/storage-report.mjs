// Monthly check of Supabase Storage: how much each bucket holds and which
// files nothing references (candidates to back up and delete).
// Read-only. Usage: node --env-file=.env.local scripts/storage-report.mjs
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function api(path, body) {
  const res = await fetch(URL + path, body ? { method: "POST", headers: H, body: JSON.stringify(body) } : { headers: H });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function walk(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const items = await api(`/storage/v1/object/list/${bucket}`, { prefix, limit: 1000, offset });
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...(await walk(bucket, path)));
      else out.push({ path, size: it.metadata?.size ?? 0 });
    }
    if (items.length < 1000) return out;
  }
}

const mark = (bucket) => `/storage/v1/object/public/${bucket}/`;
const used = {
  "product-images": new Set(
    (await api("/rest/v1/product_images?select=url"))
      .map((r) => r.url)
      .filter((u) => u.includes(mark("product-images")))
      .map((u) => decodeURIComponent(u.split(mark("product-images"))[1])),
  ),
  "social-media": new Set(
    (await api("/rest/v1/social_posts?select=video_path,poster_path")).flatMap((r) => [r.video_path, r.poster_path]),
  ),
};

const mb = (n) => (n / 1e6).toFixed(1);
for (const bucket of Object.keys(used)) {
  const files = await walk(bucket);
  const unused = files.filter((f) => !used[bucket].has(f.path));
  const total = files.reduce((s, f) => s + f.size, 0);
  console.log(`${bucket}: ${files.length} archivos, ${mb(total)} MB`);
  console.log(`  sin usar: ${unused.length} archivos, ${mb(unused.reduce((s, f) => s + f.size, 0))} MB`);
  for (const f of unused.slice(0, 20)) console.log(`    ${f.path} (${mb(f.size)} MB)`);
}
