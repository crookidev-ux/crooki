"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Switch } from "./controls";

interface Props {
  slug: string;
  label: string;
  initialVisible: boolean;
}

// Per-row switch on the admin category list: controls whether the category
// (and its products) appears on the customer pages.
export default function CategoryVisibilityToggle({ slug, label, initialVisible }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(initialVisible);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (next: boolean) => {
    if (saving) return;
    setVisible(next);
    setSaving(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .update({ visible: next })
      .eq("slug", slug)
      .select("slug");

    if (error || !data?.length) {
      setVisible(!next);
      toast.error(error ? `Error: ${error.message}` : "No se guardó: revisa tu sesión.");
    } else {
      toast.success(next ? "Categoría visible en la web" : "Categoría oculta de la web");
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Switch checked={visible} onChange={handleToggle} disabled={saving} label={`Visible en la web: ${label}`} />
      <span className="adm-sub w-12" aria-hidden="true">
        {visible ? "Visible" : "Oculta"}
      </span>
    </span>
  );
}
