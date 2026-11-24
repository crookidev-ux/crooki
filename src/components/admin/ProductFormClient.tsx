"use client";

import Image from "next/image";
import { useMemo, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Upload, X, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORY_KINDS,
  KIND_LABEL_ES,
  type CategoryKind,
  type CategoryRow,
  type Product,
  type ProductImage,
} from "@/lib/types";
import { isValidSlug, slugify } from "@/lib/slug";
import { MAX_PRODUCT_IMAGES, fitPhotos, moveItem } from "@/lib/product-photos";
import {
  PROMO_TAGS,
  bogotaLocalToIso,
  isSaleActive,
  isoToBogotaLocal,
  visibleTag,
  type PromoTag,
} from "@/lib/promo";

interface ReferenceProduct {
  id: string;
  name_es: string;
  name_en: string;
  price: number;
}

interface Props {
  locale: string;
  mode: "create" | "edit";
  product?: Product;
  categories: CategoryRow[];
  initialKind?: CategoryKind;
  initialCategory?: string;
  // Catalog of cookies/salsas the admin may include in a combo. Server pages
  // pass the full lists; we render checkboxes + per-row extra-price inputs.
  allGalletas?: ReferenceProduct[];
  allSalsas?: ReferenceProduct[];
}

// Accepted picks (PNG too); compressImage turns them into webp/jpeg, the only
// types the `product-images` bucket stores, at most 1 MB
// (supabase/migrations/20261124020000_product_images_1mb.sql).
// The extension comes from the real MIME type, never from the file name.
const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const MAX_IMAGE_BYTES = 1024 * 1024;
const BUCKET_URL_MARK = "/storage/v1/object/public/product-images/";

/** Storage path of a stored photo URL, or null if it isn't in our bucket. */
function storagePath(url: string): string | null {
  const i = url.indexOf(BUCKET_URL_MARK);
  return i === -1 ? null : decodeURIComponent(url.slice(i + BUCKET_URL_MARK.length));
}
const MAX_IMAGE_WIDTH = 1200;

// The site serves photos as stored (no Vercel optimizer, see next.config.ts),
// so every upload is shrunk here to <=1200 px webp (JPEG on browsers that
// can't encode webp). Returns null if the browser can't read the image.
async function compressImage(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const encode = (type: string) =>
      new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.8));
    let blob = await encode("image/webp");
    // Older Safari silently returns PNG for webp: fall back to JPEG.
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg");
    if (!blob) return null;
    const ext = IMAGE_EXT_BY_TYPE[blob.type];
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: blob.type });
  } catch {
    return null;
  }
}

// One photo in the form, in display order: already stored, or picked and not
// uploaded yet (uploaded on save, in this order).
type Photo =
  | { key: string; existing: ProductImage; preview: string }
  | { key: string; file: File; preview: string };

interface ComboPickerEntry {
  selected: boolean;
  extra: string;
}

// Checkbox + extra-price list shared by the combo and helado salsa sections.
function SalsaPickerList({
  allSalsas,
  picker,
  onToggle,
  onSetExtra,
}: {
  allSalsas: ReferenceProduct[];
  picker: Record<string, ComboPickerEntry>;
  onToggle: (id: string, defaultExtra: string) => void;
  onSetExtra: (id: string, value: string) => void;
}) {
  if (allSalsas.length === 0) {
    return <div className="text-sm text-gray-400">No hay salsas en el catálogo.</div>;
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
      {allSalsas.map((s) => {
        const entry = picker[s.id] ?? { selected: false, extra: String(s.price) };
        return (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <input
              type="checkbox"
              checked={entry.selected}
              onChange={() => onToggle(s.id, String(s.price))}
              className="w-4 h-4 rounded border-gray-300 cursor-pointer"
              style={{ accentColor: "#8b0031" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.name_es}</p>
              <p className="text-xs text-gray-400">
                Precio base: ${s.price.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">+ $</span>
              <input
                type="number"
                value={entry.extra}
                onChange={(e) => onSetExtra(s.id, e.target.value)}
                disabled={!entry.selected}
                min="0"
                step="100"
                className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right disabled:bg-gray-50 disabled:text-gray-300"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductFormClient({
  locale,
  mode,
  product,
  categories,
  initialKind = "menu",
  initialCategory,
  allGalletas = [],
  allSalsas = [],
}: Props) {
  const t = useTranslations("admin");
  const tPromo = useTranslations("promo");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>(() =>
    [...(product?.product_images ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .map((img) => ({ key: img.id, existing: img, preview: img.url })),
  );
  // Stored photos the admin removed: deleted (row + file) only when saving.
  const [removedPhotos, setRemovedPhotos] = useState<ProductImage[]>([]);

  // Determine kind from the product's category (edit) or the URL hint (create).
  const productKind: CategoryKind = useMemo(() => {
    const match = categories.find((c) => c.slug === product?.category);
    return (match?.kind as CategoryKind) ?? initialKind;
  }, [categories, product?.category, initialKind]);

  const [kind, setKind] = useState<CategoryKind>(productKind);

  const categoriesForKind = useMemo(
    () => categories.filter((c) => c.kind === kind).sort((a, b) => a.display_order - b.display_order),
    [categories, kind],
  );

  const [form, setForm] = useState({
    name_es: product?.name_es ?? "",
    name_en: product?.name_en ?? "",
    description_es: product?.description_es ?? "",
    description_en: product?.description_en ?? "",
    price: product?.price?.toString() ?? "",
    category:
      product?.category ??
      initialCategory ??
      categories.find((c) => c.kind === initialKind)?.slug ??
      "",
    available: product?.available ?? true,
    display_order: product?.display_order?.toString() ?? "0",
    sale_price: product?.sale_price != null ? String(product.sale_price) : "",
    sale_ends_local: isoToBogotaLocal(product?.sale_ends_at),
    promo_tag: (product?.promo_tag ?? "") as PromoTag | "",
  });

  // Christmas products have their own page: /navidad/<slug>. The slug follows
  // the Spanish name until the admin edits it (or the product already has one).
  const isNavidad = kind === "navidad";
  const [slugInput, setSlugInput] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product?.slug);
  const slug = slugTouched ? slugInput : slugify(form.name_es);

  const isCombo = form.category === "combos";
  const isBox = form.category === "cajas";
  // Helados reuse the combo salsa whitelist (combo_salsas keyed by the
  // helado's product id) to define which salsas the customer may add.
  const isHelado = form.category === "helados";

  const [includesSalsa, setIncludesSalsa] = useState<boolean>(
    product?.includes_salsa ?? false,
  );

  // Box-specific state
  const [boxCookieCount, setBoxCookieCount] = useState<string>(
    product?.box_cookie_count?.toString() ?? "2",
  );
  const [giftCardPrice, setGiftCardPrice] = useState<string>(
    product?.gift_card_price != null ? String(product.gift_card_price) : "",
  );
  const [giftCardCakePrice, setGiftCardCakePrice] = useState<string>(
    product?.gift_card_cake_price != null ? String(product.gift_card_cake_price) : "",
  );

  // Box cookie picker shares the same shape as the combo picker but reads its
  // initial state from `product.box_cookies`.
  const [boxCookiePicker, setBoxCookiePicker] = useState<Record<string, ComboPickerEntry>>(() => {
    const out: Record<string, ComboPickerEntry> = {};
    for (const g of allGalletas) {
      const existing = product?.box_cookies?.find((bc) => bc.cookie_id === g.id);
      out[g.id] = {
        selected: !!existing,
        extra: existing ? String(existing.extra_price) : "0",
      };
    }
    return out;
  });

  const toggleBoxCookie = (id: string) =>
    setBoxCookiePicker((p) => {
      const cur = p[id] ?? { selected: false, extra: "0" };
      return { ...p, [id]: { ...cur, selected: !cur.selected } };
    });

  const setBoxCookieExtra = (id: string, value: string) =>
    setBoxCookiePicker((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { selected: true, extra: "0" }), extra: value },
    }));

  // Map of product-id → { selected, extra-price string } for the cookie picker.
  const [cookiePicker, setCookiePicker] = useState<Record<string, ComboPickerEntry>>(() => {
    const out: Record<string, ComboPickerEntry> = {};
    for (const g of allGalletas) {
      const existing = product?.combo_cookies?.find((cc) => cc.cookie_id === g.id);
      out[g.id] = {
        selected: !!existing,
        extra: existing ? String(existing.extra_price) : "0",
      };
    }
    return out;
  });

  // Map of product-id → { selected, extra-price string } for the salsa picker.
  // When a salsa is checked for the first time, default extra = salsa's own
  // price (per spec: "take by default the price of the Salsa").
  const [salsaPicker, setSalsaPicker] = useState<Record<string, ComboPickerEntry>>(() => {
    const out: Record<string, ComboPickerEntry> = {};
    for (const s of allSalsas) {
      const existing = product?.combo_salsas?.find((cs) => cs.salsa_id === s.id);
      out[s.id] = {
        selected: !!existing,
        extra: existing ? String(existing.extra_price) : String(s.price),
      };
    }
    return out;
  });

  const toggleCookie = (id: string, defaultExtra = "0") =>
    setCookiePicker((p) => {
      const cur = p[id] ?? { selected: false, extra: defaultExtra };
      return { ...p, [id]: { ...cur, selected: !cur.selected } };
    });

  const setCookieExtra = (id: string, value: string) =>
    setCookiePicker((p) => ({ ...p, [id]: { ...(p[id] ?? { selected: true, extra: "0" }), extra: value } }));

  const toggleSalsa = (id: string, defaultExtra: string) =>
    setSalsaPicker((p) => {
      const cur = p[id] ?? { selected: false, extra: defaultExtra };
      return { ...p, [id]: { ...cur, selected: !cur.selected } };
    });

  const setSalsaExtra = (id: string, value: string) =>
    setSalsaPicker((p) => ({ ...p, [id]: { ...(p[id] ?? { selected: true, extra: "0" }), extra: value } }));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Reset so picking the same (rejected) file again still fires onChange.
    e.target.value = "";
    const files: File[] = [];
    for (const f of picked) {
      if (!IMAGE_EXT_BY_TYPE[f.type]) {
        toast.error(`«${f.name}» no es JPG, PNG ni WEBP. Conviértela e inténtalo de nuevo.`);
        continue;
      }
      const small = await compressImage(f);
      if (!small) {
        toast.error(`No pudimos leer «${f.name}». Prueba con otra foto.`);
        continue;
      }
      if (small.size > MAX_IMAGE_BYTES) {
        const mb = (small.size / (1024 * 1024)).toFixed(1);
        toast.error(`«${f.name}» pesa ${mb} MB. El máximo es 1 MB.`);
        continue;
      }
      files.push(small);
    }
    if (!files.length) return;

    const { accepted, dropped } = fitPhotos(photos.length, files);
    if (dropped > 0) toast.error(t("photos_dropped", { max: MAX_PRODUCT_IMAGES, dropped }));
    setPhotos((prev) => [
      ...prev,
      ...accepted.map((file, i) => ({
        key: `new-${Date.now()}-${i}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  };

  const movePhoto = (index: number, to: number) => setPhotos((prev) => moveItem(prev, index, to));

  const removePhoto = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    // Stored photos are only marked: Cancel keeps them, Save deletes them.
    if ("existing" in photo) setRemovedPhotos((prev) => [...prev, photo.existing]);
    else URL.revokeObjectURL(photo.preview);
    setPhotos((prev) => prev.filter((p) => p.key !== photo.key));
  };

  // Deletes the removed photos (row, then file so the bucket doesn't fill up),
  // uploads the new ones and saves every photo's position (index = display_order).
  const savePhotos = async (productId: string) => {
    const supabase = createClient();

    for (const img of removedPhotos) {
      const { error } = await supabase.from("product_images").delete().eq("id", img.id);
      if (error) {
        toast.error(`No se pudo quitar una foto: ${error.message}`);
        continue;
      }
      const path = storagePath(img.url);
      if (path) {
        const { error: fileError } = await supabase.storage.from("product-images").remove([path]);
        if (fileError) console.error("product-images remove", path, fileError);
      }
    }
    setRemovedPhotos([]);

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if ("existing" in photo) {
        if (photo.existing.display_order !== i) {
          const { error } = await supabase
            .from("product_images")
            .update({ display_order: i })
            .eq("id", photo.existing.id);
          if (error) toast.error(`No se pudo guardar el orden de las fotos: ${error.message}`);
        }
        continue;
      }
      const file = photo.file;
      const ext = IMAGE_EXT_BY_TYPE[file.type];
      if (!ext || file.size > MAX_IMAGE_BYTES) {
        toast.error(`«${file.name}» no se subió: solo WEBP o JPG de hasta 1 MB.`);
        continue;
      }
      const path = `products/${productId}/${Date.now()}-${i}.${ext}`;

      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) {
        toast.error(`Error subiendo imagen: ${error.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(data.path);

      const { error: rowError } = await supabase.from("product_images").insert({
        product_id: productId,
        url: publicUrl,
        display_order: i,
      });
      if (rowError) {
        // The 5-photo trigger (or RLS) refused it: don't leave the file orphaned.
        await supabase.storage.from("product-images").remove([data.path]);
        toast.error(
          rowError.hint === "max_product_images"
            ? t("photos_limit_db", { max: MAX_PRODUCT_IMAGES })
            : `Error guardando la foto: ${rowError.message}`,
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_es.trim()) {
      toast.error("El nombre en español es requerido");
      return;
    }
    const price = parseFloat(form.price) || 0;
    const salePrice = form.sale_price.trim() === "" ? null : Number(form.sale_price);
    if (salePrice !== null && !(Number.isInteger(salePrice) && salePrice >= 1 && salePrice < price)) {
      toast.error(t("sale_error_invalid"));
      return;
    }
    const saleEndsAt = bogotaLocalToIso(form.sale_ends_local);
    if (form.sale_ends_local && !saleEndsAt) {
      toast.error(t("sale_error_date"));
      return;
    }
    if (!form.category) {
      toast.error("La categoría es requerida");
      return;
    }
    if (isNavidad && !slug) {
      toast.error(t("slug_required"));
      return;
    }
    if (isNavidad && !isValidSlug(slug)) {
      toast.error(t("slug_error"));
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();
      const productData: Record<string, unknown> = {
        name_es: form.name_es,
        name_en: form.name_en,
        description_es: form.description_es,
        description_en: form.description_en,
        price,
        // The database re-checks 0 < sale_price < price (products_sale_price_check).
        sale_price: salePrice,
        sale_ends_at: salePrice === null ? null : saleEndsAt,
        promo_tag: form.promo_tag || null,
        category: form.category,
        available: form.available,
        display_order: parseInt(form.display_order) || 0,
        // Only meaningful for combos; harmless for other categories.
        includes_salsa: isCombo ? includesSalsa : false,
      };
      // Only Christmas products carry a slug, so menu/merch saves keep working
      // on a database without the navidad migration.
      if (isNavidad) productData.slug = slug;
      if (isBox) {
        const count = parseInt(boxCookieCount, 10);
        productData.box_cookie_count = Number.isFinite(count) && count >= 2 ? count : 2;
        productData.gift_card_price =
          giftCardPrice.trim() === "" ? null : parseFloat(giftCardPrice) || 0;
        productData.gift_card_cake_price =
          giftCardCakePrice.trim() === "" ? null : parseFloat(giftCardCakePrice) || 0;
      }

      let productId = product?.id;

      if (mode === "create") {
        const { data, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
      } else if (productId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);
        if (error) throw error;
      }

      if (productId) {
        setUploadingImages(true);
        await savePhotos(productId);
        setUploadingImages(false);
      }

      // Persist combo/helado configuration: replace-all strategy is simpler
      // and safe since the rows are pure metadata with no foreign-key
      // children. Combos persist both pickers; helados persist only the salsa
      // whitelist (stored in the same combo_salsas table).
      if ((isCombo || isHelado) && productId) {
        await supabase.from("combo_salsas").delete().eq("combo_id", productId);

        const salsaRows = Object.entries(salsaPicker)
          .filter(([, v]) => v.selected)
          .map(([salsaId, v], idx) => ({
            combo_id: productId,
            salsa_id: salsaId,
            extra_price: parseFloat(v.extra) || 0,
            display_order: idx,
          }));
        if (salsaRows.length > 0) {
          const { error: csErr } = await supabase.from("combo_salsas").insert(salsaRows);
          if (csErr) throw csErr;
        }
      }

      if (isCombo && productId) {
        await supabase.from("combo_cookies").delete().eq("combo_id", productId);

        const cookieRows = Object.entries(cookiePicker)
          .filter(([, v]) => v.selected)
          .map(([cookieId, v], idx) => ({
            combo_id: productId,
            cookie_id: cookieId,
            extra_price: parseFloat(v.extra) || 0,
            display_order: idx,
          }));
        if (cookieRows.length > 0) {
          const { error: ccErr } = await supabase.from("combo_cookies").insert(cookieRows);
          if (ccErr) throw ccErr;
        }
      }

      if (isBox && productId) {
        await supabase.from("box_cookies").delete().eq("box_id", productId);
        const boxRows = Object.entries(boxCookiePicker)
          .filter(([, v]) => v.selected)
          .map(([cookieId, v], idx) => ({
            box_id: productId,
            cookie_id: cookieId,
            extra_price: parseFloat(v.extra) || 0,
            display_order: idx,
          }));
        if (boxRows.length > 0) {
          const { error: bcErr } = await supabase.from("box_cookies").insert(boxRows);
          if (bcErr) throw bcErr;
        }
      }

      toast.success(mode === "create" ? "Producto creado exitosamente" : "Producto actualizado");
      router.push(`/${locale}/admin`);
    } catch (err: unknown) {
      console.error(err);
      // 23505 = unique violation: on a Christmas product, the slug is taken.
      const code = (err as { code?: string } | null)?.code;
      toast.error(code === "23505" && isNavidad ? t("slug_taken") : "Error al guardar el producto");
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      toast.error("Error al eliminar el producto");
    } else {
      // Its photo files would otherwise stay in the bucket forever.
      const paths = (product.product_images ?? [])
        .map((img) => storagePath(img.url))
        .filter((p): p is string => p !== null);
      if (paths.length) {
        const { error: fileError } = await supabase.storage.from("product-images").remove(paths);
        if (fileError) console.error("product-images remove", fileError);
      }
      toast.success("Producto eliminado");
      router.push(`/${locale}/admin`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <a
        href={`/${locale}/admin`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al panel
      </a>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black" style={{ color: "#8b0031" }}>
          {mode === "create" ? t("new_product") : t("edit_product")}
        </h1>
        {mode === "edit" && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-2 text-red-600 border border-red-200 px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t("delete")}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Spanish Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">{t("product_name")} *</label>
            <input
              type="text"
              value={form.name_es}
              onChange={(e) => setForm({ ...form, name_es: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
              placeholder="Caramelo Salado"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">{t("product_name_en")}</label>
            <input
              type="text"
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
              placeholder="Salted Caramel"
            />
          </div>
        </div>

        {/* Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">{t("product_description")}</label>
            <textarea
              value={form.description_es}
              onChange={(e) => setForm({ ...form, description_es: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all resize-none"
              placeholder="Galleta de masa suave con relleno de caramelo salado..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">{t("product_description_en")}</label>
            <textarea
              value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all resize-none"
              placeholder="Soft dough cookie with salted caramel filling..."
            />
          </div>
        </div>

        {/* Kind + Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Tipo</label>
            <div className="flex gap-2">
              {CATEGORY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    const first = categories.find((c) => c.kind === k);
                    if (first) setForm((f) => ({ ...f, category: first.slug }));
                  }}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-colors border"
                  style={{
                    backgroundColor: kind === k ? "#8b0031" : "transparent",
                    color: kind === k ? "#ffffff" : "#8b0031",
                    borderColor: kind === k ? "#8b0031" : "#e5e7eb",
                  }}
                >
                  {KIND_LABEL_ES[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Categoría *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-white"
              required
            >
              <option value="">Seleccionar categoría…</option>
              {categoriesForKind.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label_es}
                </option>
              ))}
            </select>
            {categoriesForKind.length === 0 && (
              <p className="text-xs text-red-600 mt-1">
                No hay categorías para este tipo. Crea una primero.
              </p>
            )}
          </div>
        </div>

        {/* Christmas product page address */}
        {isNavidad && (
          <div>
            <label htmlFor="slug" className="block text-sm font-semibold mb-1.5 text-gray-700">
              {t("slug")} *
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlugInput(e.target.value.toLowerCase());
              }}
              onBlur={() => setSlugInput(slugify(slug))}
              maxLength={80}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={slug !== "" && !isValidSlug(slug)}
              aria-describedby="slug_help"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 transition-all"
              placeholder="caja-navidena"
            />
            <p id="slug_help" className="text-xs text-gray-500 mt-1">
              {slug !== "" && !isValidSlug(slug) ? (
                <span className="text-red-600">{t("slug_error")}</span>
              ) : (
                <>
                  {t("slug_help")}{" "}
                  {slug && t("slug_preview", { url: `crookibakebar.com/navidad/${slug}` })}
                </>
              )}
            </p>
          </div>
        )}

        {/* Price + Order + Available */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">{t("product_price")} *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
              placeholder="1500"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">Orden de display</label>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
              min="0"
            />
          </div>
          <div className="flex flex-col justify-center">
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">{t("product_available")}</label>
            <label className="flex items-center gap-3 cursor-pointer mt-1">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                  className="sr-only"
                />
                <div
                  className="w-12 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: form.available ? "#8b0031" : "#d1d5db" }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: form.available ? "translateX(26px)" : "translateX(2px)" }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                {form.available ? "Disponible" : "Agotado"}
              </span>
            </label>
          </div>
        </div>

        {/* Promotion: sale price, optional end (Bogotá time) and ribbon tag */}
        <fieldset className="rounded-2xl border border-gray-200 p-4 md:p-5">
          <legend className="px-2 text-sm font-bold" style={{ color: "#8b0031" }}>
            {t("promo_section")}
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sale_price" className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("product_sale_price")}
              </label>
              <input
                id="sale_price"
                type="number"
                inputMode="numeric"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                placeholder="—"
                min="1"
                step="1"
                aria-describedby="sale_price_help"
              />
              <p id="sale_price_help" className="text-xs text-gray-500 mt-1">{t("sale_help")}</p>
            </div>
            <div>
              <label htmlFor="sale_ends" className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("product_sale_ends")}
              </label>
              <input
                id="sale_ends"
                type="datetime-local"
                value={form.sale_ends_local}
                onChange={(e) => setForm({ ...form, sale_ends_local: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-white"
                aria-describedby="sale_ends_help"
              />
              <p id="sale_ends_help" className="text-xs text-gray-500 mt-1">{t("sale_ends_help")}</p>
            </div>
            <div>
              <label htmlFor="promo_tag" className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("product_promo_tag")}
              </label>
              <select
                id="promo_tag"
                value={form.promo_tag}
                onChange={(e) => setForm({ ...form, promo_tag: e.target.value as PromoTag | "" })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all bg-white"
              >
                <option value="">{t("promo_tag_none")}</option>
                {PROMO_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tPromo(`tags.${tag}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(() => {
            const preview = {
              price: parseFloat(form.price) || 0,
              sale_price: form.sale_price.trim() === "" ? null : Number(form.sale_price),
              sale_ends_at: bogotaLocalToIso(form.sale_ends_local),
              promo_tag: form.promo_tag || null,
            };
            const notes: string[] = [];
            if (preview.sale_price !== null) {
              notes.push(t(isSaleActive(preview) ? "sale_status_active" : "sale_status_ended"));
            }
            if (preview.promo_tag && !visibleTag(preview)) notes.push(t("sale_tag_hidden"));
            return notes.length > 0 ? (
              <p className="mt-3 text-sm font-medium text-gray-700" aria-live="polite">
                {notes.join(" ")}
              </p>
            ) : null;
          })()}
        </fieldset>

        {/* Images */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <label className="block text-sm font-semibold text-gray-700">{t("product_images")}</label>
            <span className="text-xs font-semibold text-gray-500" aria-live="polite">
              {t("photos_count", { count: photos.length, max: MAX_PRODUCT_IMAGES })}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t("photos_order_help")}</p>

          {/* Every photo in display order; the first is the cover */}
          {photos.length > 0 && (
            <ol className="flex flex-wrap gap-3 mb-4">
              {photos.map((photo, i) => (
                <li key={photo.key} className="relative">
                  {"existing" in photo ? (
                    <Image
                      src={photo.preview}
                      alt=""
                      width={112}
                      height={112}
                      className="w-28 h-28 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <>
                      {/* Local blob: preview of a file not uploaded yet; next/image can't load it */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.preview}
                        alt=""
                        className="w-28 h-28 rounded-xl object-cover border-2 border-blue-300"
                      />
                    </>
                  )}
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-[#8b0031] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {t("photo_cover")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`${t("photo_remove")} ${i + 1}`}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                  >
                    <X aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                  <div className="mt-1.5 flex justify-between">
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`${t("photo_left")} (${i + 1})`}
                      className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronLeft aria-hidden="true" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(i, i + 1)}
                      disabled={i === photos.length - 1}
                      aria-label={`${t("photo_right")} (${i + 1})`}
                      className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ChevronRight aria-hidden="true" className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Upload zone (hidden once the product has its 5 photos) */}
          {photos.length < MAX_PRODUCT_IMAGES ? (
            <button
              type="button"
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload aria-hidden="true" className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <span className="block text-sm text-gray-500">{t("drag_drop")}</span>
              <span className="block text-xs text-gray-400 mt-1">JPG, PNG, WEBP · se comprimen solas</span>
            </button>
          ) : (
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {t("photos_full", { max: MAX_PRODUCT_IMAGES })}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/webp,image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Combo configuration — only when category=combos */}
        {isCombo && (
          <div className="rounded-2xl border border-gray-200 p-6 flex flex-col gap-6 bg-gray-50/50">
            <div>
              <h2 className="text-lg font-black mb-1" style={{ color: "#8b0031" }}>
                Configuración del Combo
              </h2>
              <p className="text-sm text-gray-500">
                Selecciona qué galletas y salsas el cliente puede elegir. Los precios extra
                se suman al precio base del combo.
              </p>
            </div>

            {/* Includes salsa toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={includesSalsa}
                  onChange={(e) => setIncludesSalsa(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className="w-12 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: includesSalsa ? "#8b0031" : "#d1d5db" }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: includesSalsa ? "translateX(26px)" : "translateX(2px)" }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700">
                Incluye una salsa (el cliente elige una sin costo adicional)
              </span>
            </label>

            {/* Cookie picker */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                Galletas disponibles
              </label>
              <p className="text-xs text-gray-500 mb-3">
                El cliente elegirá UNA. Marca las galletas elegibles y opcionalmente
                un precio extra por sabor (ej: $3.000 por sabor premium).
              </p>
              {allGalletas.length === 0 ? (
                <div className="text-sm text-gray-400">No hay galletas en el catálogo.</div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                  {allGalletas.map((g) => {
                    const entry = cookiePicker[g.id] ?? { selected: false, extra: "0" };
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={entry.selected}
                          onChange={() => toggleCookie(g.id)}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          style={{ accentColor: "#8b0031" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{g.name_es}</p>
                          <p className="text-xs text-gray-400">
                            Precio base: ${g.price.toLocaleString("es-CO")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">+ $</span>
                          <input
                            type="number"
                            value={entry.extra}
                            onChange={(e) => setCookieExtra(g.id, e.target.value)}
                            disabled={!entry.selected}
                            min="0"
                            step="100"
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right disabled:bg-gray-50 disabled:text-gray-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Salsa picker */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                Salsas disponibles
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Si &ldquo;Incluye una salsa&rdquo; está activo, el cliente elige su
                salsa incluida (sin costo) entre las marcadas.
              </p>
              <SalsaPickerList
                allSalsas={allSalsas}
                picker={salsaPicker}
                onToggle={toggleSalsa}
                onSetExtra={setSalsaExtra}
              />
            </div>
          </div>
        )}

        {/* Helado configuration — only when category=helados */}
        {isHelado && (
          <div className="rounded-2xl border border-gray-200 p-6 flex flex-col gap-6 bg-gray-50/50">
            <div>
              <h2 className="text-lg font-black mb-1" style={{ color: "#8b0031" }}>
                Configuración del Helado
              </h2>
              <p className="text-sm text-gray-500">
                Selecciona qué salsas el cliente puede agregar al helado. Los precios
                extra se suman al precio base. Por defecto el precio extra es el
                precio mismo de la salsa.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                Salsas disponibles
              </label>
              <SalsaPickerList
                allSalsas={allSalsas}
                picker={salsaPicker}
                onToggle={toggleSalsa}
                onSetExtra={setSalsaExtra}
              />
            </div>
          </div>
        )}

        {/* Cajas configuration — only when category=cajas */}
        {isBox && (
          <div className="rounded-2xl border border-gray-200 p-6 flex flex-col gap-6 bg-gray-50/50">
            <div>
              <h2 className="text-lg font-black mb-1" style={{ color: "#8b0031" }}>
                Configuración de la Caja
              </h2>
              <p className="text-sm text-gray-500">
                Define cuántas galletas trae la caja, qué galletas el cliente puede elegir
                y los add-ons opcionales (gift card, gift card + vela).
              </p>
            </div>

            {/* Cantidad de galletas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                  Cantidad de galletas *
                </label>
                <input
                  type="number"
                  value={boxCookieCount}
                  onChange={(e) => setBoxCookieCount(e.target.value)}
                  min={2}
                  step={1}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Mínimo 2.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                  Precio Gift Card (opcional)
                </label>
                <input
                  type="number"
                  value={giftCardPrice}
                  onChange={(e) => setGiftCardPrice(e.target.value)}
                  min={0}
                  step="100"
                  placeholder="dejar vacío para no ofrecer"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                  Precio Gift Card + Vela (opcional)
                </label>
                <input
                  type="number"
                  value={giftCardCakePrice}
                  onChange={(e) => setGiftCardCakePrice(e.target.value)}
                  min={0}
                  step="100"
                  placeholder="dejar vacío para no ofrecer"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                />
              </div>
            </div>

            {/* Cookie picker */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700">
                Galletas disponibles
              </label>
              <p className="text-xs text-gray-500 mb-3">
                El cliente elegirá {boxCookieCount || "N"} galletas (puede repetir sabores).
                Marca las elegibles y opcionalmente un precio extra por sabor.
              </p>
              {allGalletas.length === 0 ? (
                <div className="text-sm text-gray-400">No hay galletas en el catálogo.</div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                  {allGalletas.map((g) => {
                    const entry = boxCookiePicker[g.id] ?? { selected: false, extra: "0" };
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={entry.selected}
                          onChange={() => toggleBoxCookie(g.id)}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          style={{ accentColor: "#8b0031" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{g.name_es}</p>
                          <p className="text-xs text-gray-400">
                            Precio base: ${g.price.toLocaleString("es-CO")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">+ $</span>
                          <input
                            type="number"
                            value={entry.extra}
                            onChange={(e) => setBoxCookieExtra(g.id, e.target.value)}
                            disabled={!entry.selected}
                            min="0"
                            step="100"
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right disabled:bg-gray-50 disabled:text-gray-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-4 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "#8b0031" }}
          >
            {(loading || uploadingImages) && <Loader2 className="w-5 h-5 animate-spin" />}
            {uploadingImages ? "Subiendo imágenes..." : loading ? "Guardando..." : t("save")}
          </button>
          <a
            href={`/${locale}/admin`}
            className="px-8 flex items-center justify-center font-semibold border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            {t("cancel")}
          </a>
        </div>
      </form>
    </div>
  );
}
