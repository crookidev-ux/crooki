"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "./controls";

// «Disponible» switch on a product row: marks it sold out without opening the
// form. Same pattern as CategoryVisibilityToggle: optimistic, reverted if the
// write fails or touches no row (RLS answers an empty result, not an error).
export default function ProductAvailableToggle({
  id,
  name,
  initialAvailable,
}: {
  id: string;
  name: string;
  initialAvailable: boolean;
}) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [saving, setSaving] = useState(false);

  const change = async (next: boolean) => {
    if (saving) return;
    setAvailable(next);
    setSaving(true);
    const { data, error } = await createClient()
      .from("products")
      .update({ available: next })
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      setAvailable(!next);
      toast.error(error ? `No se guardó: ${error.message}` : "No se guardó: revisa tu sesión.");
    } else {
      toast.success(next ? `«${name}» está disponible` : `«${name}» quedó agotado`);
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Switch checked={available} onChange={change} disabled={saving} label={`Disponible: ${name}`} />
      <span className="adm-sub w-[70px]" aria-hidden="true">
        {available ? "Disponible" : "Agotado"}
      </span>
    </span>
  );
}
