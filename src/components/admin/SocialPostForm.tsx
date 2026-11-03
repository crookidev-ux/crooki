"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InstagramIcon, TikTokIcon } from "@/components/layout/SocialIcons";
import { MAX_CAPTION, parseSocialUrl, SOCIAL_BUCKET, videoFileProblem } from "@/lib/social";

type Poster = { blob: Blob; url: string; ext: "webp" | "jpg" };

const POSTER_WIDTH = 540;

/**
 * First frame of the video as a small image, drawn in this browser. Fails when
 * the browser cannot decode the file, which is also our codec check.
 */
function capturePoster(file: File): Promise<Poster> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const done = (err?: Error) => {
      URL.revokeObjectURL(src);
      video.removeAttribute("src");
      if (err) reject(err);
    };
    video.onerror = () => done(new Error("decode"));
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const scale = POSTER_WIDTH / video.videoWidth;
      const canvas = document.createElement("canvas");
      canvas.width = POSTER_WIDTH;
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx || !video.videoWidth) return done(new Error("decode"));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Older Safari can't encode webp and silently returns PNG: fall back to JPEG.
      canvas.toBlob(
        (webp) => {
          if (webp && webp.type === "image/webp") {
            done();
            return resolve({ blob: webp, url: URL.createObjectURL(webp), ext: "webp" });
          }
          canvas.toBlob(
            (jpg) => {
              if (!jpg) return done(new Error("encode"));
              done();
              resolve({ blob: jpg, url: URL.createObjectURL(jpg), ext: "jpg" });
            },
            "image/jpeg",
            0.82,
          );
        },
        "image/webp",
        0.8,
      );
    };
    video.src = src;
  });
}

const extOf = (file: File) =>
  file.type === "video/quicktime" ? "mov" : file.type === "video/webm" ? "webm" : "mp4";

export default function SocialPostForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const parsed = link.trim() ? parseSocialUrl(link) : null;

  useEffect(() => () => {
    if (poster) URL.revokeObjectURL(poster.url);
  }, [poster]);

  const onFile = async (f: File | undefined) => {
    setFile(null);
    setPoster(null);
    setFileError(null);
    if (!f) return;
    const problem = videoFileProblem(f);
    if (problem === "type") return setFileError("Sube un video MP4, MOV o WEBM.");
    if (problem === "size") return setFileError("El video pesa más de 50 MB. Expórtalo en 720p para que pese menos.");
    setReading(true);
    try {
      setPoster(await capturePoster(f));
      setFile(f);
    } catch {
      setFileError("Este navegador no pudo leer el video. Expórtalo como MP4 (H.264) e inténtalo de nuevo.");
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setLink("");
    setCaption("");
    setFile(null);
    setPoster(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const p = parseSocialUrl(link);
    setLinkError(p ? null : "Pega el enlace de un post o reel de Instagram, o de un video de TikTok.");
    if (!file || !poster) setFileError((prev) => prev ?? "Sube el video del post.");
    if (!p || !file || !poster) return;

    setSaving(true);
    const supabase = createClient();
    const id = crypto.randomUUID();
    const videoPath = `videos/${id}.${extOf(file)}`;
    const posterPath = `posters/${id}.${poster.ext}`;
    const bucket = supabase.storage.from(SOCIAL_BUCKET);
    try {
      const up = await bucket.upload(videoPath, file, { contentType: file.type, cacheControl: "31536000" });
      if (up.error) throw new Error(`video: ${up.error.message}`);
      const upPoster = await bucket.upload(posterPath, poster.blob, {
        contentType: poster.blob.type,
        cacheControl: "31536000",
      });
      if (upPoster.error) throw new Error(`portada: ${upPoster.error.message}`);
      const { error } = await supabase.from("social_posts").insert({
        network: p.network,
        post_url: p.url,
        video_path: videoPath,
        poster_path: posterPath,
        caption: caption.trim().slice(0, MAX_CAPTION),
      });
      if (error) throw new Error(error.message);
      toast.success("Publicado en la página de inicio");
      reset();
      router.refresh();
    } catch (err) {
      // Nothing half-saved: drop whatever files made it up.
      await bucket.remove([videoPath, posterPath]);
      toast.error(`No se guardó (${err instanceof Error ? err.message : "error"}). Revisa tu sesión e inténtalo de nuevo.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col gap-5">
      <h2 className="text-lg font-bold text-gray-900">Agregar un post</h2>

      <div>
        <label htmlFor="social-link" className="block text-sm font-semibold mb-1.5 text-gray-700">
          Enlace del post *
        </label>
        <input
          id="social-link"
          type="url"
          inputMode="url"
          placeholder="https://www.instagram.com/reel/… o https://www.tiktok.com/@crookibakebar/video/…"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
          aria-invalid={linkError ? true : undefined}
          aria-describedby={linkError ? "social-link-error" : "social-link-hint"}
          className={`w-full border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#8b0031] ${linkError ? "border-red-400" : "border-gray-200"}`}
        />
        {linkError ? (
          <p id="social-link-error" role="alert" className="text-red-500 text-xs mt-1">{linkError}</p>
        ) : (
          <p id="social-link-hint" className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            {parsed?.network === "instagram" && <><InstagramIcon className="w-3.5 h-3.5" /> Instagram</>}
            {parsed?.network === "tiktok" && <><TikTokIcon className="w-3.5 h-3.5" /> TikTok</>}
            {!parsed && "En la app: Compartir → Copiar enlace."}
          </p>
        )}
      </div>

      <div>
        <span className="block text-sm font-semibold mb-1.5 text-gray-700">Video del post *</span>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <label
            htmlFor="social-video"
            className="flex-1 w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#8b0031] transition-colors focus-within:ring-2 focus-within:ring-[#8b0031]"
          >
            {reading ? (
              <Loader2 className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
            )}
            <span className="block text-sm text-gray-600">{file ? file.name : "Elige el video (el mismo que publicaste)"}</span>
            <span className="block text-xs text-gray-400 mt-1">MP4 o MOV · máximo 50 MB · vertical 9:16</span>
            <input
              ref={fileInput}
              id="social-video"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={fileError ? "social-video-error" : undefined}
            />
          </label>
          {poster && (
            // Local blob preview; next/image can't load it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster.url} alt="Portada del video" className="w-28 aspect-[9/16] object-cover rounded-xl border border-gray-100" />
          )}
        </div>
        {fileError && (
          <p id="social-video-error" role="alert" className="text-red-500 text-xs mt-1">{fileError}</p>
        )}
      </div>

      <div>
        <label htmlFor="social-caption" className="block text-sm font-semibold mb-1.5 text-gray-700">
          Texto corto (opcional)
        </label>
        <textarea
          id="social-caption"
          rows={2}
          maxLength={MAX_CAPTION}
          placeholder="Ej.: El caso de la galleta roja"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#8b0031]"
        />
      </div>

      <button
        type="submit"
        disabled={saving || reading}
        className="self-start inline-flex items-center gap-2 text-white font-bold px-6 py-3 rounded-full disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b0031]"
        style={{ backgroundColor: "#8b0031" }}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {saving ? "Subiendo video…" : "Publicar en la página"}
      </button>
    </form>
  );
}
