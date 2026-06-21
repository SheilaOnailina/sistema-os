"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { getSupabase, type Colaborador } from "@/lib/supabase";

const sessionKey = "sistema-os-colaborador";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel alterar a senha.";
}

export default function AlterarSenhaPage() {
  const router = useRouter();
  const [usuario] = useState<Colaborador | null>(() => {
    if (typeof window === "undefined") return null;

    const sessao = localStorage.getItem(sessionKey);
    return sessao ? (JSON.parse(sessao) as Colaborador) : null;
  });
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
    }
  }, [router, usuario]);

  async function alterarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (!usuario) return;

    if (!senhaAtual || !novaSenha || !confirmacao) {
      setErro("Preencha todos os campos.");
      return;
    }

    if (novaSenha.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (novaSenha !== confirmacao) {
      setErro("A confirmacao nao confere com a nova senha.");
      return;
    }

    try {
      setCarregando(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("alterar_senha_colaborador", {
        colaborador_id_input: usuario.id,
        senha_atual_input: senhaAtual,
        nova_senha_input: novaSenha,
      });

      if (error) throw error;

      if (!data) {
        setErro("Senha atual incorreta.");
        return;
      }

      const usuarioAtualizado = {
        ...usuario,
        precisa_trocar_senha: false,
      };

      localStorage.setItem(sessionKey, JSON.stringify(usuarioAtualizado));
      router.push(
        usuarioAtualizado.perfil === "GESTOR" ||
          usuarioAtualizado.perfil === "ENCARREGADO"
          ? "/dashboard"
          : "/tecnico",
      );
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-700 text-white">
            <LockKeyhole size={22} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            Alterar senha
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {usuario
              ? `${usuario.nome}, atualize sua senha de acesso.`
              : "Carregando usuario..."}
          </p>
        </div>

        {erro && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        )}

        <form onSubmit={alterarSenha} className="space-y-4">
          <CampoSenha
            label="Senha atual"
            value={senhaAtual}
            onChange={setSenhaAtual}
            autoComplete="current-password"
          />
          <CampoSenha
            label="Nova senha"
            value={novaSenha}
            onChange={setNovaSenha}
            autoComplete="new-password"
          />
          <CampoSenha
            label="Confirmar nova senha"
            value={confirmacao}
            onChange={setConfirmacao}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={carregando || !usuario}
            className="h-11 w-full rounded-md bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link
            href={
              usuario?.perfil === "GESTOR" || usuario?.perfil === "ENCARREGADO"
                ? "/dashboard"
                : "/tecnico"
            }
            className="font-semibold text-blue-700 hover:underline"
          >
            Voltar para o painel
          </Link>
        </div>
      </section>
    </main>
  );
}

function CampoSenha({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="password"
        autoComplete={autoComplete}
        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
