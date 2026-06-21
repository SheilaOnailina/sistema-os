"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPlus,
  RefreshCw,
  UserRound,
} from "lucide-react";
import {
  getSupabase,
  type Colaborador,
  type OrdemServico,
  type PrioridadeOS,
} from "@/lib/supabase";

type FormState = {
  solicitante: string;
  local: string;
  descricao: string;
  colaboradorId: string;
  prioridade: PrioridadeOS;
};

const initialForm: FormState = {
  solicitante: "",
  local: "",
  descricao: "",
  colaboradorId: "",
  prioridade: "NORMAL",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Nao foi possivel criar a OS.";
}

async function listarTecnicos() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id,nome,cpf,telefone,perfil,ativo,precisa_trocar_senha,criado_em")
    .eq("perfil", "TECNICO")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) throw error;

  return (data ?? []) as Colaborador[];
}

export default function NovaOSPage() {
  const [tecnicos, setTecnicos] = useState<Colaborador[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [ultimaOS, setUltimaOS] = useState<OrdemServico | null>(null);

  async function carregarTecnicos() {
    try {
      setAtualizando(true);
      const dados = await listarTecnicos();
      setTecnicos(dados);
      setErro(null);
    } catch (error) {
      console.error("Erro ao carregar tecnicos:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    let montado = true;

    listarTecnicos()
      .then((dados) => {
        if (!montado) return;
        setTecnicos(dados);
        setErro(null);
      })
      .catch((error: unknown) => {
        if (!montado) return;
        console.error("Erro ao carregar tecnicos:", error);
        setErro(getErrorMessage(error));
      })
      .finally(() => {
        if (montado) setCarregando(false);
      });

    return () => {
      montado = false;
    };
  }, []);

  const tecnicoSelecionado = useMemo(
    () => tecnicos.find((tecnico) => tecnico.id === form.colaboradorId),
    [form.colaboradorId, tecnicos],
  );

  async function criarOS(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);
    setUltimaOS(null);

    if (
      !form.solicitante.trim() ||
      !form.local.trim() ||
      !form.descricao.trim() ||
      !form.colaboradorId
    ) {
      setErro("Preencha solicitante, local, descricao e tecnico responsavel.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("criar_ordem_servico", {
        solicitante_input: form.solicitante.trim(),
        local_input: form.local.trim(),
        descricao_input: form.descricao.trim(),
        colaborador_id_input: form.colaboradorId,
        prioridade_input: form.prioridade,
      });

      if (error) throw error;

      const ordem = data?.[0] as OrdemServico | undefined;
      setUltimaOS(ordem ?? null);
      setSucesso(
        ordem
          ? `OS #${ordem.numero_os} criada para ${tecnicoSelecionado?.nome}.`
          : "OS criada com sucesso.",
      );
      setForm(initialForm);
    } catch (error) {
      console.error("Erro ao criar OS:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Cadastro de demanda
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">
              Nova Ordem de Servico
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Abra uma OS e vincule ao tecnico responsavel.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Dashboard
            </Link>
            <button
              onClick={carregarTecnicos}
              disabled={atualizando}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={atualizando ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Atualizar tecnicos
            </button>
          </div>
        </header>

        {erro && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>{erro}</div>
          </div>
        )}

        {sucesso && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              {sucesso}
              {ultimaOS && (
                <Link href="/dashboard" className="ml-2 font-bold underline">
                  Ver no dashboard
                </Link>
              )}
            </div>
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <form
            onSubmit={criarOS}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-md bg-blue-50 p-2 text-blue-700">
                <ClipboardPlus size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Dados da ordem
                </h2>
                <p className="text-sm text-slate-500">
                  O status inicial sera ABERTA.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Campo
                label="Solicitante"
                value={form.solicitante}
                onChange={(value) =>
                  setForm((atual) => ({ ...atual, solicitante: value }))
                }
                placeholder="Nome de quem solicitou"
              />
              <Campo
                label="Local"
                value={form.local}
                onChange={(value) =>
                  setForm((atual) => ({ ...atual, local: value }))
                }
                placeholder="Ex: Sala 12, bloco A"
              />
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Tecnico responsavel
              </span>
              <select
                value={form.colaboradorId}
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    colaboradorId: event.target.value,
                  }))
                }
                disabled={carregando}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">
                  {carregando ? "Carregando tecnicos..." : "Selecione um tecnico"}
                </option>
                {tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Prioridade
              </span>
              <select
                value={form.prioridade}
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    prioridade: event.target.value as PrioridadeOS,
                  }))
                }
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="NORMAL">Sem prioridade</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Prioridade</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Descricao do problema
              </span>
              <textarea
                value={form.descricao}
                onChange={(event) =>
                  setForm((atual) => ({
                    ...atual,
                    descricao: event.target.value,
                  }))
                }
                rows={6}
                placeholder="Descreva com clareza o que precisa ser feito..."
                className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={salvando || carregando}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ClipboardPlus size={16} aria-hidden="true" />
                {salvando ? "Criando OS..." : "Criar ordem de servico"}
              </button>
              <Link
                href="/dashboard/colaboradores"
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cadastrar tecnico
              </Link>
            </div>
          </form>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-slate-100 p-2 text-slate-700">
                <UserRound size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tecnico selecionado
                </h2>
                <p className="text-sm text-slate-500">
                  A OS aparecera no painel individual dele depois.
                </p>
              </div>
            </div>

            {tecnicoSelecionado ? (
              <div className="mt-5 space-y-3 rounded-md bg-slate-50 p-4 text-sm">
                <div>
                  <p className="font-semibold text-slate-500">Nome</p>
                  <p className="font-bold text-slate-900">{tecnicoSelecionado.nome}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">CPF</p>
                  <p className="font-mono text-slate-700">{tecnicoSelecionado.cpf}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500">Telefone</p>
                  <p className="text-slate-700">{tecnicoSelecionado.telefone || "-"}</p>
                </div>
              </div>
            ) : (
              <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm text-slate-500">
                Selecione um tecnico para vincular esta ordem de servico.
              </p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
