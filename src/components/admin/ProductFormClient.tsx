"use client";

import Image from "next/image";
import { useMemo, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Cookie, ExternalLink, ImagePlus, Loader2, Trash2, X } from "lucide-react";
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
  effectivePrice,
  isSaleActive,
  isoToBogotaLocal,
  visibleTag,
  type PromoTag,
} from "@/lib/promo";
import { PageHeader, money } from "./ui";
import { ConfirmButton, Switch } from "./controls";

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

// Checkbox + extra-price list shared by the combo, box and helado sections.
function PickerList({
  idPrefix,
  items,
  picker,
  defaultExtra,
  onToggle,
  onSetExtra,
  emptyText,
}: {
  idPrefix: string;
  items: ReferenceProduct[];
  picker: Record<string, ComboPickerEntry>;
  /** Extra price shown before the row is ever picked (salsas: their own price). */
  defaultExtra: (item: ReferenceProduct) => string;
  onToggle: (id: string, defaultExtra: string) => void;
  onSetExtra: (id: string, value: string) => void;
  emptyText: string;
}) {
  if (items.length === 0) return <p className="adm-help">{emptyText}</p>;
  return (
    <div className="adm-pick">
      {items.map((s) => {
        const entry = picker[s.id] ?? { selected: false, extra: defaultExtra(s) };
        const id = `${idPrefix}-${s.id}`;
        return (
          <div key={s.id}>
            <input
              id={id}
              type="checkbox"
              checked={entry.selected}
              onChange={() => onToggle(s.id, defaultExtra(s))}
            />
            <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
              <span className="block truncate text-sm font-medium">{s.name_es}</span>
              <span className="adm-sub">Precio base: {money(s.price)}</span>
            </label>
            <div className="adm-prefix">
              <span aria-hidden="true">+$</span>
              <input
                type="number"
                inputMode="numeric"
                value={entry.extra}
                onChange={(e) => onSetExtra(s.id, e.target.value)}
                disabled={!entry.selected}
                min="0"
                step="100"
                aria-label={`Precio extra de ${s.name_es}`}
                className="adm-input"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function ProductFormClient({
  mode,
  product,
  categories,
  initialKind = "menu",
  initialCategory,
  allGalletas = [],
  allSalsas = [],
}: Props) {
  const tPromo = useTranslations("promo");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  // Set after the first successful insert, so a retry after a partial failure
  // updates this product instead of creating a second one.
  const [savedId, setSavedId] = useState<string | undefined>(mode === "edit" ? product?.id : undefined);
  const isEdit = !!savedId;
  const [lang, setLang] = useState<"es" | "en">("es");
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

  type SetPicker = React.Dispatch<React.SetStateAction<Record<string, ComboPickerEntry>>>;
  const toggleIn = (set: SetPicker) => (id: string, defaultExtra: string) =>
    set((p) => {
      const cur = p[id] ?? { selected: false, extra: defaultExtra };
      return { ...p, [id]: { ...cur, selected: !cur.selected } };
    });
  const setExtraIn = (set: SetPicker) => (id: string, value: string) =>
    set((p) => ({ ...p, [id]: { ...(p[id] ?? { selected: true, extra: "0" }), extra: value } }));

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
    if (dropped > 0) toast.error(`Solo caben ${MAX_PRODUCT_IMAGES} fotos por producto: ${dropped} no se agregaron.`);
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
  // Returns how many steps failed. The form state then mirrors what is stored:
  // uploaded photos become stored ones and failed ones stay pending, so saving
  // again retries only what failed (no duplicates).
  const savePhotos = async (productId: string): Promise<number> => {
    const supabase = createClient();
    let failures = 0;

    const stillRemoved: ProductImage[] = [];
    for (const img of removedPhotos) {
      const { error } = await supabase.from("product_images").delete().eq("id", img.id);
      if (error) {
        failures++;
        stillRemoved.push(img);
        toast.error(`No se pudo quitar una foto: ${error.message}`);
        continue;
      }
      const path = storagePath(img.url);
      if (path) {
        const { error: fileError } = await supabase.storage.from("product-images").remove([path]);
        if (fileError) console.error("product-images remove", path, fileError);
      }
    }
    setRemovedPhotos(stillRemoved);

    const next: Photo[] = [];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if ("existing" in photo) {
        if (photo.existing.display_order !== i) {
          const { error } = await supabase
            .from("product_images")
            .update({ display_order: i })
            .eq("id", photo.existing.id);
          if (error) {
            failures++;
            toast.error(`No se pudo guardar el orden de las fotos: ${error.message}`);
            next.push(photo);
            continue;
          }
        }
        next.push({ ...photo, existing: { ...photo.existing, display_order: i } });
        continue;
      }
      const file = photo.file;
      const ext = IMAGE_EXT_BY_TYPE[file.type];
      if (!ext || file.size > MAX_IMAGE_BYTES) {
        failures++;
        toast.error(`«${file.name}» no se subió: solo WEBP o JPG de hasta 1 MB.`);
        next.push(photo);
        continue;
      }
      const path = `products/${productId}/${Date.now()}-${i}.${ext}`;

      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) {
        failures++;
        toast.error(`Error subiendo imagen: ${error.message}`);
        next.push(photo);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(data.path);

      const { data: row, error: rowError } = await supabase
        .from("product_images")
        .insert({ product_id: productId, url: publicUrl, display_order: i })
        .select()
        .single();
      if (rowError || !row) {
        failures++;
        // The 5-photo trigger (or RLS) refused it: don't leave the file orphaned.
        await supabase.storage.from("product-images").remove([data.path]);
        toast.error(
          rowError?.hint === "max_product_images"
            ? `La base de datos no permite más de ${MAX_PRODUCT_IMAGES} fotos por producto.`
            : `Error guardando la foto: ${rowError?.message ?? "sin respuesta"}`,
        );
        next.push(photo);
        continue;
      }
      URL.revokeObjectURL(photo.preview);
      const stored = row as ProductImage;
      next.push({ key: stored.id, existing: stored, preview: stored.url });
    }
    setPhotos(next);
    return failures;
  };

  // Combo / helado / box configuration: delete the old rows, insert the new
  // ones. Not atomic, so every step is checked and the message says which
  // part did not save; the form keeps the picks, so saving again retries.
  const saveConfig = async (productId: string): Promise<string | null> => {
    const supabase = createClient();
    const replace = async (
      table: "combo_salsas" | "combo_cookies" | "box_cookies",
      key: "combo_id" | "box_id",
      idColumn: "salsa_id" | "cookie_id",
      picker: Record<string, ComboPickerEntry>,
      what: string,
    ): Promise<string | null> => {
      const { error: delErr } = await supabase.from(table).delete().eq(key, productId);
      if (delErr) return `${what}: ${delErr.message}`;
      const rows = Object.entries(picker)
        .filter(([, v]) => v.selected)
        .map(([refId, v], idx) => ({
          [key]: productId,
          [idColumn]: refId,
          extra_price: parseFloat(v.extra) || 0,
          display_order: idx,
        }));
      if (rows.length === 0) return null;
      const { error } = await supabase.from(table).insert(rows);
      return error ? `${what}: ${error.message}` : null;
    };
    // Combos persist both pickers; helados only the salsa whitelist (stored
    // in the same combo_salsas table).
    if (isCombo || isHelado) {
      const err = await replace("combo_salsas", "combo_id", "salsa_id", salsaPicker, "las salsas");
      if (err) return err;
    }
    if (isCombo) {
      const err = await replace("combo_cookies", "combo_id", "cookie_id", cookiePicker, "las galletas del combo");
      if (err) return err;
    }
    if (isBox) {
      const err = await replace("box_cookies", "box_id", "cookie_id", boxCookiePicker, "las galletas de la caja");
      if (err) return err;
    }
    return null;
  };

  const listHref = `/admin/productos?kind=${kind}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_es.trim()) {
      setLang("es");
      toast.error("El nombre en español es obligatorio.");
      return;
    }
    const price = parseFloat(form.price) || 0;
    const salePrice = form.sale_price.trim() === "" ? null : Number(form.sale_price);
    if (salePrice !== null && !(Number.isInteger(salePrice) && salePrice >= 1 && salePrice < price)) {
      toast.error("El precio de oferta debe ser mayor que 0 y menor que el precio normal.");
      return;
    }
    const saleEndsAt = bogotaLocalToIso(form.sale_ends_local);
    if (form.sale_ends_local && !saleEndsAt) {
      toast.error("La fecha de fin de la oferta no es válida.");
      return;
    }
    if (!form.category) {
      toast.error("Elige una categoría.");
      return;
    }
    if (isNavidad && !slug) {
      toast.error("Los productos de Navidad necesitan una dirección de página.");
      return;
    }
    if (isNavidad && !isValidSlug(slug)) {
      toast.error("La dirección solo puede tener minúsculas, números y guiones (máx. 80).");
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

      let productId = savedId;
      if (!productId) {
        const { data, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        if (error) throw error;
        productId = data.id as string;
        setSavedId(productId);
        // The product exists now: a reload or a retry must edit it, not create another.
        window.history.replaceState(null, "", `/admin/productos/${productId}/editar`);
      } else {
        const { data, error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId)
          .select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("no_rows");
      }

      setUploadingImages(true);
      const photoFailures = await savePhotos(productId);
      setUploadingImages(false);
      const configError = await saveConfig(productId);

      if (photoFailures === 0 && !configError) {
        toast.success(mode === "create" ? "Producto creado" : "Cambios guardados");
        router.push(listHref);
        return;
      }
      const problems = [
        photoFailures > 0 && `${plural(photoFailures, "foto no se guardó", "fotos no se guardaron")}`,
        configError && `no se guardó la configuración de ${configError}`,
      ].filter(Boolean);
      toast.warning(`El producto se guardó, pero ${problems.join(" y ")}. Revisa y vuelve a guardar.`, {
        duration: 12000,
      });
    } catch (err: unknown) {
      console.error(err);
      // 23505 = unique violation: on a Christmas product, the slug is taken.
      const code = (err as { code?: string } | null)?.code;
      toast.error(
        code === "23505" && isNavidad
          ? "Ya existe otro producto con esa dirección. Cambia la dirección."
          : err instanceof Error && err.message === "no_rows"
            ? "No se guardó: revisa tu sesión."
            : "No se pudo guardar el producto. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  const handleDelete = async () => {
    if (!savedId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("products").delete().eq("id", savedId).select("id");

    if (error || !data?.length) {
      toast.error(error ? `No se pudo eliminar: ${error.message}` : "No se eliminó: revisa tu sesión.");
    } else {
      // Its photo files would otherwise stay in the bucket forever.
      const paths = [
        ...photos.flatMap((p) => ("existing" in p ? [p.existing] : [])),
        ...removedPhotos,
      ]
        .map((img) => storagePath(img.url))
        .filter((p): p is string => p !== null);
      if (paths.length) {
        const { error: fileError } = await supabase.storage.from("product-images").remove(paths);
        if (fileError) console.error("product-images remove", fileError);
      }
      toast.success("Producto eliminado");
      router.push(listHref);
    }
    setLoading(false);
  };

  // Live state of the sale, as the shop will show it.
  const preview = {
    price: parseFloat(form.price) || 0,
    sale_price: form.sale_price.trim() === "" ? null : Number(form.sale_price),
    sale_ends_at: bogotaLocalToIso(form.sale_ends_local),
    promo_tag: form.promo_tag || null,
  };
  const saleActive = isSaleActive(preview);
  const saleNotes: string[] = [];
  if (preview.sale_price !== null) {
    saleNotes.push(saleActive ? "Oferta activa: se cobra el precio de oferta." : "La oferta ya terminó: se cobra el precio normal.");
  }
  if (preview.promo_tag && !visibleTag(preview)) saleNotes.push("Esta etiqueta solo se muestra mientras la oferta esté activa.");
  const discount =
    saleActive && preview.price > 0 ? Math.round((1 - Number(preview.sale_price) / preview.price) * 100) : null;

  const busy = loading || uploadingImages;
  const saveLabel = uploadingImages ? "Subiendo fotos…" : loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear producto";
  const saveIcon = busy ? (
    <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-[18px] w-[18px]" />
  );
  const enMissing = !form.name_en.trim();
  const cover = photos[0];

  const langTab = (l: "es" | "en", label: string, ok: boolean) => (
    <button
      type="button"
      role="tab"
      id={`tab-${l}`}
      aria-selected={lang === l}
      aria-controls={`panel-${l}`}
      tabIndex={lang === l ? 0 : -1}
      onClick={() => setLang(l)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const other = l === "es" ? "en" : "es";
          setLang(other);
          document.getElementById(`tab-${other}`)?.focus();
        }
      }}
    >
      <span className={`adm-lang-dot${ok ? "" : " missing"}`} aria-hidden="true" />
      {label}
      {!ok && <span className="sr-only"> (falta el nombre)</span>}
    </button>
  );

  return (
    <div className="adm-page has-savebar">
      <PageHeader
        crumbs={[{ label: "Productos", href: listHref }, { label: isEdit ? "Editar" : "Nuevo" }]}
        title={isEdit ? form.name_es || "Editar producto" : "Nuevo producto"}
        actions={
          isEdit ? (
            <>
              {isNavidad && product?.slug && (
                <a href={`/navidad/${product.slug}`} target="_blank" rel="noopener noreferrer" className="adm-btn adm-hide-m">
                  <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />
                  Ver en la tienda
                </a>
              )}
              <ConfirmButton
                disabled={busy}
                title="¿Eliminar este producto?"
                body={
                  <>
                    «{form.name_es || "Este producto"}» y sus fotos se borran para siempre. Si solo se acabó, mejor
                    márcalo como agotado.
                  </>
                }
                confirmLabel="Sí, eliminar"
                onConfirm={handleDelete}
              >
                <Trash2 aria-hidden="true" className="h-[18px] w-[18px]" />
                Eliminar
              </ConfirmButton>
            </>
          ) : undefined
        }
      />

      <form id="product-form" onSubmit={handleSubmit} className="adm-form-grid">
        <div className="adm-form-grid-in">
          <div className="adm-stack">
            {/* Información */}
            <section className="adm-card" aria-labelledby="sec-info">
              <div className="adm-card-h">
                <h2 id="sec-info">Información</h2>
              </div>
              <div className="adm-card-b">
                <div role="tablist" aria-label="Idioma" className="adm-seg mb-3.5">
                  {langTab("es", "Español", !!form.name_es.trim())}
                  {langTab("en", "Inglés", !enMissing)}
                </div>
                <div role="tabpanel" id="panel-es" aria-labelledby="tab-es" hidden={lang !== "es"}>
                  <div className="adm-field">
                    <label htmlFor="name_es">Nombre *</label>
                    <input
                      id="name_es"
                      type="text"
                      value={form.name_es}
                      onChange={(e) => setForm({ ...form, name_es: e.target.value })}
                      className="adm-input"
                      placeholder="Caramelo Salado"
                      autoComplete="off"
                    />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="description_es">Descripción</label>
                    <textarea
                      id="description_es"
                      value={form.description_es}
                      onChange={(e) => setForm({ ...form, description_es: e.target.value })}
                      rows={4}
                      className="adm-input"
                      placeholder="Galleta de masa suave con relleno de caramelo salado…"
                      aria-describedby="description_es_help"
                    />
                    <span id="description_es_help" className="adm-help">
                      Se muestra en la tarjeta del menú. {form.description_es.length} caracteres.
                    </span>
                  </div>
                </div>
                <div role="tabpanel" id="panel-en" aria-labelledby="tab-en" hidden={lang !== "en"}>
                  <div className="adm-field">
                    <label htmlFor="name_en">Nombre en inglés</label>
                    <input
                      id="name_en"
                      type="text"
                      value={form.name_en}
                      onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                      className="adm-input"
                      placeholder="Salted Caramel"
                      autoComplete="off"
                      aria-describedby="name_en_help"
                    />
                    <span id="name_en_help" className="adm-help">
                      La web en inglés (/en) muestra este nombre. Si lo dejas vacío, el producto sale sin nombre allí.
                    </span>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="description_en">Descripción en inglés</label>
                    <textarea
                      id="description_en"
                      value={form.description_en}
                      onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                      rows={4}
                      className="adm-input"
                      placeholder="Soft dough cookie with salted caramel filling…"
                    />
                  </div>
                </div>
                {enMissing && lang === "es" && (
                  <p className="adm-help mt-2">
                    <span className="adm-badge warn">Falta inglés</span> Completa la pestaña «Inglés» para la web en inglés.
                  </p>
                )}
              </div>
            </section>

            {/* Precio y oferta */}
            <section className="adm-card adm-cq" aria-labelledby="sec-price">
              <div className="adm-card-h">
                <h2 id="sec-price">Precio y oferta</h2>
                {saleActive && <span className="adm-badge wine ml-auto">Oferta activa</span>}
              </div>
              <div className="adm-card-b">
                <div className="adm-row3">
                  <div className="adm-field">
                    <label htmlFor="price">Precio normal *</label>
                    <div className="adm-prefix">
                      <span aria-hidden="true">$</span>
                      <input
                        id="price"
                        type="number"
                        inputMode="numeric"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                        className="adm-input"
                        placeholder="18000"
                        min="0"
                        step="1"
                        required
                      />
                    </div>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="sale_price">Precio de oferta</label>
                    <div className="adm-prefix">
                      <span aria-hidden="true">$</span>
                      <input
                        id="sale_price"
                        type="number"
                        inputMode="numeric"
                        value={form.sale_price}
                        onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                        className="adm-input"
                        min="1"
                        step="1"
                        aria-describedby="sale_price_help"
                      />
                    </div>
                    <span id="sale_price_help" className="adm-help">
                      {discount !== null ? `${discount} % de descuento. ` : ""}Vacío = sin oferta. Debe ser menor que el
                      precio normal.
                    </span>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="sale_ends">La oferta termina</label>
                    <input
                      id="sale_ends"
                      type="datetime-local"
                      lang="es-CO"
                      value={form.sale_ends_local}
                      onChange={(e) => setForm({ ...form, sale_ends_local: e.target.value })}
                      className="adm-input"
                      aria-describedby="sale_ends_help"
                    />
                    <span id="sale_ends_help" className="adm-help">
                      Opcional, hora de Colombia. Al llegar se vuelve al precio normal.
                    </span>
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="promo_tag">Etiqueta</label>
                  <select
                    id="promo_tag"
                    value={form.promo_tag}
                    onChange={(e) => setForm({ ...form, promo_tag: e.target.value as PromoTag | "" })}
                    className="adm-input"
                  >
                    <option value="">Ninguna</option>
                    {PROMO_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {tPromo(`tags.${tag}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {saleNotes.length > 0 && (
                  <p className="text-sm font-medium" aria-live="polite">
                    {saleNotes.join(" ")}
                  </p>
                )}
              </div>
            </section>

            {/* Fotos */}
            <section className="adm-card" aria-labelledby="sec-photos">
              <div className="adm-card-h">
                <h2 id="sec-photos">Fotos</h2>
                <span className="adm-sub ml-auto" aria-live="polite">
                  {photos.length} de {MAX_PRODUCT_IMAGES} · la primera es la portada
                </span>
              </div>
              <div className="adm-card-b">
                {photos.length > 0 && (
                  <ol className="adm-photos">
                    {photos.map((photo, i) => (
                      <li key={photo.key} className="adm-photo">
                        {"existing" in photo ? (
                          <Image src={photo.preview} alt={`Foto ${i + 1}`} width={160} height={160} />
                        ) : (
                          <>
                            {/* Local blob: preview of a file not uploaded yet; next/image can't load it */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.preview} alt={`Foto ${i + 1} (sin subir)`} className="new" />
                          </>
                        )}
                        {i === 0 && <span className="adm-badge wine tag">Portada</span>}
                        <div className="adm-photo-tools">
                          <button
                            type="button"
                            onClick={() => movePhoto(i, i - 1)}
                            disabled={i === 0}
                            aria-label={`Mover la foto ${i + 1} a la izquierda`}
                            className="adm-icon-btn disabled:opacity-40"
                          >
                            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label={`Quitar la foto ${i + 1}`}
                            className="adm-icon-btn text-[color:var(--adm-bad)]"
                          >
                            <X aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(i, i + 1)}
                            disabled={i === photos.length - 1}
                            aria-label={`Mover la foto ${i + 1} a la derecha`}
                            className="adm-icon-btn disabled:opacity-40"
                          >
                            <ChevronRight aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Upload zone (hidden once the product has its 5 photos) */}
                {photos.length < MAX_PRODUCT_IMAGES ? (
                  <button type="button" className="adm-drop" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus aria-hidden="true" className="h-7 w-7 text-[color:var(--adm-wine)]" />
                    <span className="font-semibold">Agregar fotos</span>
                    <span className="adm-sub">JPG, PNG o WEBP · se comprimen solas · las nuevas se suben al guardar</span>
                  </button>
                ) : (
                  <p className="adm-help">Ya tiene {MAX_PRODUCT_IMAGES} fotos. Quita una para subir otra.</p>
                )}
                {removedPhotos.length > 0 && (
                  <p className="adm-help mt-2" aria-live="polite">
                    {plural(removedPhotos.length, "foto se quitará", "fotos se quitarán")} al guardar. «Cancelar» las
                    conserva.
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/webp,image/jpeg,image/png"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Elegir fotos"
                />
              </div>
            </section>

            {/* Christmas product page address */}
            {isNavidad && (
              <section className="adm-card" aria-labelledby="sec-slug">
                <div className="adm-card-h">
                  <h2 id="sec-slug">Página de Navidad</h2>
                </div>
                <div className="adm-card-b">
                  <div className="adm-field">
                    <label htmlFor="slug">Dirección de la página (URL) *</label>
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
                      className="adm-input font-mono"
                      placeholder="caja-navidena"
                    />
                    <p id="slug_help" className="adm-help">
                      {slug !== "" && !isValidSlug(slug) ? (
                        <span className="adm-error">La dirección solo puede tener minúsculas, números y guiones (máx. 80).</span>
                      ) : (
                        <>
                          Se crea sola desde el nombre en español. Solo minúsculas, números y guiones.{" "}
                          {slug && `Se verá en: crookibakebar.com/navidad/${slug}`}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Combo configuration — only when category=combos */}
            {isCombo && (
              <section className="adm-card" aria-labelledby="sec-combo">
                <div className="adm-card-h">
                  <h2 id="sec-combo">Configuración del combo</h2>
                </div>
                <div className="adm-card-b flex flex-col gap-5">
                  <p className="adm-help">
                    Elige qué galletas y salsas puede escoger el cliente. Los precios extra se suman al precio del combo.
                  </p>
                  <div className="flex items-center gap-3">
                    <Switch checked={includesSalsa} onChange={setIncludesSalsa} labelledBy="includes_salsa_label" />
                    <span id="includes_salsa_label" className="text-sm font-semibold">
                      Incluye una salsa (el cliente elige una sin costo)
                    </span>
                  </div>
                  <fieldset>
                    <legend className="adm-lbl mb-1">Galletas disponibles</legend>
                    <p className="adm-help mb-2">El cliente elige UNA. Precio extra opcional por sabor (ej.: $3.000 por sabor premium).</p>
                    <PickerList
                      idPrefix="combo-cookie"
                      items={allGalletas}
                      picker={cookiePicker}
                      defaultExtra={() => "0"}
                      onToggle={toggleIn(setCookiePicker)}
                      onSetExtra={setExtraIn(setCookiePicker)}
                      emptyText="No hay galletas en el catálogo."
                    />
                  </fieldset>
                  <fieldset>
                    <legend className="adm-lbl mb-1">Salsas disponibles</legend>
                    <p className="adm-help mb-2">Si «Incluye una salsa» está activo, el cliente elige la incluida entre las marcadas.</p>
                    <PickerList
                      idPrefix="combo-salsa"
                      items={allSalsas}
                      picker={salsaPicker}
                      defaultExtra={(s) => String(s.price)}
                      onToggle={toggleIn(setSalsaPicker)}
                      onSetExtra={setExtraIn(setSalsaPicker)}
                      emptyText="No hay salsas en el catálogo."
                    />
                  </fieldset>
                </div>
              </section>
            )}

            {/* Helado configuration — only when category=helados */}
            {isHelado && (
              <section className="adm-card" aria-labelledby="sec-helado">
                <div className="adm-card-h">
                  <h2 id="sec-helado">Configuración del helado</h2>
                </div>
                <div className="adm-card-b">
                  <fieldset>
                    <legend className="adm-lbl mb-1">Salsas que se pueden agregar</legend>
                    <p className="adm-help mb-2">El precio extra se suma al del helado; por defecto es el precio de la salsa.</p>
                    <PickerList
                      idPrefix="helado-salsa"
                      items={allSalsas}
                      picker={salsaPicker}
                      defaultExtra={(s) => String(s.price)}
                      onToggle={toggleIn(setSalsaPicker)}
                      onSetExtra={setExtraIn(setSalsaPicker)}
                      emptyText="No hay salsas en el catálogo."
                    />
                  </fieldset>
                </div>
              </section>
            )}

            {/* Cajas configuration — only when category=cajas */}
            {isBox && (
              <section className="adm-card adm-cq" aria-labelledby="sec-box">
                <div className="adm-card-h">
                  <h2 id="sec-box">Configuración de la caja</h2>
                </div>
                <div className="adm-card-b">
                  <div className="adm-row3">
                    <div className="adm-field">
                      <label htmlFor="box_count">Cantidad de galletas *</label>
                      <input
                        id="box_count"
                        type="number"
                        inputMode="numeric"
                        value={boxCookieCount}
                        onChange={(e) => setBoxCookieCount(e.target.value)}
                        min={2}
                        step={1}
                        className="adm-input"
                        required
                        aria-describedby="box_count_help"
                      />
                      <span id="box_count_help" className="adm-help">Mínimo 2.</span>
                    </div>
                    <div className="adm-field">
                      <label htmlFor="gift_card">Precio tarjeta de regalo</label>
                      <input
                        id="gift_card"
                        type="number"
                        inputMode="numeric"
                        value={giftCardPrice}
                        onChange={(e) => setGiftCardPrice(e.target.value)}
                        min={0}
                        step="100"
                        className="adm-input"
                        aria-describedby="gift_help"
                      />
                    </div>
                    <div className="adm-field">
                      <label htmlFor="gift_card_cake">Precio tarjeta + vela</label>
                      <input
                        id="gift_card_cake"
                        type="number"
                        inputMode="numeric"
                        value={giftCardCakePrice}
                        onChange={(e) => setGiftCardCakePrice(e.target.value)}
                        min={0}
                        step="100"
                        className="adm-input"
                        aria-describedby="gift_help"
                      />
                    </div>
                  </div>
                  <p id="gift_help" className="adm-help mb-4">
                    Los precios de tarjeta son opcionales: vacío = no se ofrece.
                  </p>
                  <fieldset>
                    <legend className="adm-lbl mb-1">Galletas disponibles</legend>
                    <p className="adm-help mb-2">
                      El cliente elige {boxCookieCount || "N"} galletas (puede repetir sabores). Precio extra opcional por sabor.
                    </p>
                    <PickerList
                      idPrefix="box-cookie"
                      items={allGalletas}
                      picker={boxCookiePicker}
                      defaultExtra={() => "0"}
                      onToggle={toggleIn(setBoxCookiePicker)}
                      onSetExtra={setExtraIn(setBoxCookiePicker)}
                      emptyText="No hay galletas en el catálogo."
                    />
                  </fieldset>
                </div>
              </section>
            )}
          </div>

          <div className="adm-sticky-side">
            <section className="adm-card" aria-labelledby="sec-status">
              <div className="adm-card-h">
                <h2 id="sec-status">Estado</h2>
              </div>
              <div className="adm-card-b flex items-center gap-3">
                <Switch
                  checked={form.available}
                  onChange={(v) => setForm({ ...form, available: v })}
                  labelledBy="available_label"
                  describedBy="available_help"
                />
                <div>
                  <b id="available_label">{form.available ? "Disponible" : "Agotado"}</b>
                  <div id="available_help" className="adm-sub">
                    {form.available ? "Se puede pedir en la web" : "Se ve en el menú, pero no se puede pedir"}
                  </div>
                </div>
              </div>
            </section>

            <section className="adm-card" aria-labelledby="sec-org">
              <div className="adm-card-h">
                <h2 id="sec-org">Organización</h2>
              </div>
              <div className="adm-card-b">
                <div className="adm-field">
                  <span className="adm-lbl" id="kind_label">
                    Catálogo
                  </span>
                  <div className="adm-seg" role="group" aria-labelledby="kind_label">
                    {CATEGORY_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={kind === k}
                        onClick={() => {
                          setKind(k);
                          const first = categories.find((c) => c.kind === k);
                          if (first) setForm((f) => ({ ...f, category: first.slug }));
                        }}
                      >
                        {KIND_LABEL_ES[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="category">Categoría *</label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="adm-input"
                    required
                    aria-describedby={categoriesForKind.length === 0 ? "category_error" : undefined}
                  >
                    <option value="">Elegir categoría…</option>
                    {categoriesForKind.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label_es}
                      </option>
                    ))}
                  </select>
                  {categoriesForKind.length === 0 && (
                    <p id="category_error" className="adm-error">
                      No hay categorías de este tipo.{" "}
                      <Link href="/admin/categorias/nueva" className="underline">
                        Crea una primero
                      </Link>
                      .
                    </p>
                  )}
                </div>
                <div className="adm-field">
                  <label htmlFor="display_order">Posición en la categoría</label>
                  <input
                    id="display_order"
                    type="number"
                    inputMode="numeric"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="adm-input"
                    min="0"
                    aria-describedby="display_order_help"
                  />
                  <span id="display_order_help" className="adm-help">
                    Los números más bajos van primero.
                  </span>
                </div>
              </div>
            </section>

            <section className="adm-card adm-hide-m" aria-labelledby="sec-preview">
              <div className="adm-card-h">
                <h2 id="sec-preview">Así se ve en el menú</h2>
              </div>
              <div className="adm-card-b">
                <div className="adm-preview">
                  {cover ? (
                    // Preview of the current cover (stored URL or a local blob).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.preview} alt="" />
                  ) : (
                    <div className="ph" aria-hidden="true">
                      <Cookie className="h-8 w-8" />
                    </div>
                  )}
                  <div className="pb">
                    <b>{form.name_es || "Nombre del producto"}</b>
                    <div>
                      {saleActive && <span className="adm-strike">{money(preview.price)}</span>}
                      <span className="adm-money text-[color:var(--adm-wine)]">{money(effectivePrice(preview))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="adm-side-actions">
              <Link href={listHref} className="adm-btn">
                Cancelar
              </Link>
              <button type="submit" className="adm-btn adm-btn-primary" disabled={busy}>
                {saveIcon}
                {saveLabel}
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="adm-savebar">
        <Link href={listHref} className="adm-btn">
          Cancelar
        </Link>
        <button type="submit" form="product-form" className="adm-btn adm-btn-primary" disabled={busy}>
          {saveIcon}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
