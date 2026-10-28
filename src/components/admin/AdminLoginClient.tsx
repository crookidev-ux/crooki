"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminLoginClient() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Credenciales incorrectas. Verificá tu email y contraseña.");
    } else {
      router.push("/admin");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#fdf8f0" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="inline-block text-white text-3xl font-black px-6 py-3 rounded-xl mb-4"
            style={{ backgroundColor: "#8b0031" }}
          >
            CROOKI
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{t("login_title")}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#8b003115" }}
            >
              <Lock className="w-7 h-7" style={{ color: "#8b0031" }} />
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                placeholder="admin@crooki.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                {t("password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ backgroundColor: "#8b0031" }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : null}
              {loading ? "Ingresando..." : t("login")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
