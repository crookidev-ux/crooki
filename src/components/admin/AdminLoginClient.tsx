"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { Loader2, Lock, TriangleAlert } from "lucide-react";

export default function AdminLoginClient({ noAccess = false }: { noAccess?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    noAccess ? "Esa cuenta no tiene permiso para entrar al panel. Pide acceso a un administrador." : null,
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="rounded-2xl bg-[color:var(--adm-wine)] px-6 py-4">
            <Image src="/crooki-wordmark.png" alt="Crooki" width={661} height={140} className="h-8 w-auto" priority />
          </span>
          <h1 className="text-2xl font-semibold text-[color:var(--adm-wine)]">Acceso al panel</h1>
        </div>

        <div className="adm-card p-6 sm:p-8">
          <div className="mb-6 flex justify-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--adm-wine-50)] text-[color:var(--adm-wine)]">
              <Lock aria-hidden="true" className="h-7 w-7" />
            </span>
          </div>

          {error && (
            <div className="adm-alert mb-5" role="alert">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="adm-field">
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="adm-input"
              />
            </div>
            <div className="adm-field">
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="adm-input"
              />
            </div>
            <button type="submit" disabled={loading} className="adm-btn adm-btn-primary mt-2 w-full">
              {loading && <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin" />}
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
