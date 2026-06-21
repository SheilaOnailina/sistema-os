"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Colaborador } from "@/lib/supabase";

const sessionKey = "sistema-os-colaborador";

function getSessaoSalva() {
  if (typeof window === "undefined") return null;

  const sessao = localStorage.getItem(sessionKey);
  if (!sessao) return null;

  try {
    return JSON.parse(sessao) as Colaborador;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const usuario = getSessaoSalva();

    if (!usuario) {
      router.replace("/login");
      return;
    }

    router.replace(
      usuario.perfil === "GESTOR" || usuario.perfil === "ENCARREGADO"
        ? "/dashboard"
        : "/tecnico",
    );
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-950">Sistema OS</h1>
        <p className="mt-2 text-sm text-slate-500">
          Conferindo acesso e redirecionando...
        </p>
      </section>
    </main>
  );
}
