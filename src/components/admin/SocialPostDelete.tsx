"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SOCIAL_BUCKET } from "@/lib/social";

interface Props {
  id: string;
  videoPath: string;
  posterPath: string;
}

// Two taps: the first arms the button, the second removes the post and its files.
export default function SocialPostDelete({ id, videoPath, posterPath }: Props) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("social_posts").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      toast.error(error ? `Error: ${error.message}` : "No se quitó: revisa tu sesión.");
      setBusy(false);
      return;
    }
    // The post is gone from the page; a leftover file is harmless, so only log it.
    const files = await supabase.storage.from(SOCIAL_BUCKET).remove([videoPath, posterPath]);
    if (files.error) console.error("[admin/redes] could not delete files", files.error);
    toast.success("Quitado de la página de inicio");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className={`adm-btn adm-btn-sm w-full ${armed ? "adm-btn-danger-solid" : "adm-btn-danger"}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
      {armed ? "Toca otra vez para quitar" : "Quitar"}
    </button>
  );
}
