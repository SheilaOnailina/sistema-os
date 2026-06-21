"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { getSupabase, type Colaborador } from "@/lib/supabase";

const sessionKey = "sistema-os-colaborador";

function onlyNumbers(value: string) {
  return value.replace(/\D/g, "");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel entrar.";
}

export default function LoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const cpfLimpo = onlyNumbers(cpf);

    if (!cpfLimpo || !senha) {
      setErro("Informe CPF e senha para continuar.");
      return;
    }

    try {
      setCarregando(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("login_colaborador", {
        cpf_input: cpfLimpo,
        senha_input: senha,
      });

      if (error) throw error;

      const usuario = data?.[0] as Colaborador | undefined;

      if (!usuario) {
        setErro("CPF ou senha invalidos.");
        return;
      }

      localStorage.setItem(sessionKey, JSON.stringify(usuario));

      if (usuario.precisa_trocar_senha) {
        router.push("/alterar-senha");
        return;
      }

      router.push(usuario.perfil === "GESTOR" ? "/dashboard" : "/tecnico");
    } catch (error) {
      console.error("Erro no login:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
            <LockKeyhole size={22} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            Entrar no Sistema OS
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesse com CPF e senha cadastrados pelo gestor.
          </p>
        </div>

        {erro && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        )}

        <form onSubmit={entrar} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              CPF
            </span>
            <div className="relative">
              <UserRound
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                inputMode="numeric"
                autoComplete="username"
                placeholder="Digite somente numeros"
                className="h-11 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Senha
            </span>
            <div className="relative">
              <LockKeyhole
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                className="h-11 w-full rounded-md border border-slate-300 pl-9 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((valor) => !valor)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={carregando}
            className="h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
          Primeiro acesso: use o CPF como senha inicial. Depois o sistema pedira
          uma nova senha.
        </div>

        <div className="mt-4 text-center text-sm">
          <Link href="/" className="font-semibold text-blue-700 hover:underline">
            Voltar para o painel tecnico aberto
          </Link>
        </div>
      </section>
    </main>
  );
}
