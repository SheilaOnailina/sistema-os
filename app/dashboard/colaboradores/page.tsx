"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  getSupabase,
  type Colaborador,
  type PerfilColaborador,
} from "@/lib/supabase";

type FormState = {
  nome: string;
  cpf: string;
  telefone: string;
  perfil: PerfilColaborador;
  permissao_modulo_manutencao: boolean;
  permissao_modulo_estoque: boolean;
  permissao_modulo_ar_condicionado: boolean;
};

const initialForm: FormState = {
  nome: "",
  cpf: "",
  telefone: "",
  perfil: "TECNICO",
  permissao_modulo_manutencao: true,
  permissao_modulo_estoque: false,
  permissao_modulo_ar_condicionado: false,
};

const sessionKey = "sistema-os-colaborador";

function getSessaoInicial() {
  if (typeof window === "undefined") return null;

  const sessao = localStorage.getItem(sessionKey);
  return sessao ? (JSON.parse(sessao) as Colaborador) : null;
}

function onlyNumbers(value: string) {
  return value.replace(/\D/g, "");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel concluir.";
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function listarColaboradores() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("colaboradores")
    .select(
      "id,nome,cpf,telefone,perfil,ativo,precisa_trocar_senha,permissao_modulo_manutencao,permissao_modulo_estoque,permissao_modulo_ar_condicionado,criado_em",
    )
    .order("nome", { ascending: true });

  if (error) throw error;

  return (data ?? []) as Colaborador[];
}

export default function ColaboradoresPage() {
  const router = useRouter();
  const [usuario] = useState<Colaborador | null>(getSessaoInicial);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [colaboradorEmEdicao, setColaboradorEmEdicao] =
    useState<Colaborador | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormState>(initialForm);
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function carregarColaboradores() {
    try {
      setAtualizando(true);
      const dados = await listarColaboradores();
      setColaboradores(dados);
      setErro(null);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
      return;
    }

    if (usuario.perfil !== "GESTOR") {
      router.replace("/dashboard");
      return;
    }

    let montado = true;

    listarColaboradores()
      .then((dados) => {
        if (!montado) return;
        setColaboradores(dados);
        setErro(null);
      })
      .catch((error: unknown) => {
        if (!montado) return;
        console.error("Erro ao carregar colaboradores:", error);
        setErro(getErrorMessage(error));
      })
      .finally(() => {
        if (montado) setCarregando(false);
      });

    return () => {
      montado = false;
    };
  }, [router, usuario]);

  const indicadores = useMemo(() => {
    const ativos = colaboradores.filter((colaborador) => colaborador.ativo).length;
    const tecnicos = colaboradores.filter(
      (colaborador) => colaborador.perfil === "TECNICO",
    ).length;
    const gestores = colaboradores.filter(
      (colaborador) => colaborador.perfil === "GESTOR",
    ).length;
    const encarregados = colaboradores.filter(
      (colaborador) => colaborador.perfil === "ENCARREGADO",
    ).length;
    const solicitantes = colaboradores.filter(
      (colaborador) => colaborador.perfil === "SOLICITANTE",
    ).length;

    return {
      total: colaboradores.length,
      ativos,
      tecnicos,
      gestores,
      encarregados,
      solicitantes,
    };
  }, [colaboradores]);

  const colaboradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const listaBase = mostrarInativos
      ? colaboradores
      : colaboradores.filter((colaborador) => colaborador.ativo);

    if (!termo) return listaBase;

    return listaBase.filter((colaborador) => {
      const texto = [
        colaborador.nome,
        colaborador.cpf,
        colaborador.telefone,
        colaborador.perfil,
        colaborador.ativo ? "ativo" : "inativo",
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(termo);
    });
  }, [busca, colaboradores, mostrarInativos]);

  async function cadastrarColaborador(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSucesso(null);

    const cpfLimpo = onlyNumbers(form.cpf);
    const telefoneLimpo = onlyNumbers(form.telefone);

    if (!form.nome.trim()) {
      setErro("Informe o nome do colaborador.");
      return;
    }

    if (cpfLimpo && cpfLimpo.length !== 11) {
      setErro("O CPF precisa ter 11 numeros.");
      return;
    }

    if (telefoneLimpo.length < 6) {
      setErro("Informe um telefone com pelo menos 6 numeros para a senha inicial.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("cadastrar_colaborador", {
        nome_input: form.nome.trim(),
        cpf_input: cpfLimpo || null,
        telefone_input: telefoneLimpo || null,
        perfil_input: form.perfil,
      });

      if (error) throw error;

      const colaboradorCriado = data?.[0] as Colaborador | undefined;
      if (colaboradorCriado) {
        await supabase
          .from("colaboradores")
          .update({
            permissao_modulo_manutencao:
              form.perfil === "GESTOR" || form.permissao_modulo_manutencao,
            permissao_modulo_estoque:
              form.perfil === "GESTOR" || form.permissao_modulo_estoque,
            permissao_modulo_ar_condicionado:
              form.perfil === "GESTOR" || form.permissao_modulo_ar_condicionado,
          })
          .eq("id", colaboradorCriado.id);
      }

      setForm(initialForm);
      setSucesso(
        "Colaborador cadastrado. A senha inicial sao os 6 primeiros digitos do telefone.",
      );
      await carregarColaboradores();
    } catch (error) {
      console.error("Erro ao cadastrar colaborador:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(colaborador: Colaborador) {
    setErro(null);
    setSucesso(null);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("alternar_status_colaborador", {
        colaborador_id_input: colaborador.id,
        ativo_input: !colaborador.ativo,
      });

      if (error) throw error;

      if (!data) {
        setErro("Nao foi possivel atualizar o status do colaborador.");
        return;
      }

      setSucesso(
        colaborador.ativo
          ? "Colaborador desativado."
          : "Colaborador ativado.",
      );
      await carregarColaboradores();
    } catch (error) {
      console.error("Erro ao atualizar colaborador:", error);
      setErro(getErrorMessage(error));
    }
  }

  function abrirEdicao(colaborador: Colaborador) {
    setColaboradorEmEdicao(colaborador);
    setFormEdicao({
      nome: colaborador.nome,
      cpf: colaborador.cpf ?? "",
      telefone: colaborador.telefone ?? "",
      perfil: colaborador.perfil,
      permissao_modulo_manutencao:
        colaborador.permissao_modulo_manutencao ?? true,
      permissao_modulo_estoque:
        colaborador.permissao_modulo_estoque ?? colaborador.perfil === "GESTOR",
      permissao_modulo_ar_condicionado:
        colaborador.permissao_modulo_ar_condicionado ??
        colaborador.perfil === "GESTOR",
    });
    setErro(null);
    setSucesso(null);
  }

  async function salvarEdicaoColaborador() {
    if (!colaboradorEmEdicao) return;

    setErro(null);
    setSucesso(null);

    const cpfLimpo = onlyNumbers(formEdicao.cpf);
    const telefoneLimpo = onlyNumbers(formEdicao.telefone);

    if (!formEdicao.nome.trim()) {
      setErro("Informe o nome para salvar.");
      return;
    }

    if (cpfLimpo && cpfLimpo.length !== 11) {
      setErro("O CPF precisa ter 11 numeros.");
      return;
    }

    if (telefoneLimpo && telefoneLimpo.length < 6) {
      setErro("O telefone precisa ter pelo menos 6 numeros.");
      return;
    }

    try {
      setSalvandoEdicao(true);
      const supabase = getSupabase();
      const { error } = await supabase
        .from("colaboradores")
        .update({
          nome: formEdicao.nome.trim(),
          cpf: cpfLimpo || null,
          telefone: telefoneLimpo || null,
          perfil: formEdicao.perfil,
          permissao_modulo_manutencao:
            formEdicao.perfil === "GESTOR" ||
            formEdicao.permissao_modulo_manutencao,
          permissao_modulo_estoque:
            formEdicao.perfil === "GESTOR" ||
            formEdicao.permissao_modulo_estoque,
          permissao_modulo_ar_condicionado:
            formEdicao.perfil === "GESTOR" ||
            formEdicao.permissao_modulo_ar_condicionado,
        })
        .eq("id", colaboradorEmEdicao.id);

      if (error) throw error;

      setColaboradorEmEdicao(null);
      setSucesso("Dados do colaborador atualizados.");
      await carregarColaboradores();
    } catch (error) {
      console.error("Erro ao editar colaborador:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function resetarSenha(colaborador: Colaborador) {
    const confirmou = window.confirm(
      `Resetar a senha de ${colaborador.nome} para os 6 primeiros digitos do telefone cadastrado?`,
    );

    if (!confirmou) return;

    setErro(null);
    setSucesso(null);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("resetar_senha_colaborador", {
        colaborador_id_input: colaborador.id,
      });

      if (error) throw error;

      if (!data) {
        setErro("Nao foi possivel resetar a senha.");
        return;
      }

      setSucesso(
        "Senha resetada. A senha voltou a ser os 6 primeiros digitos do telefone.",
      );
      await carregarColaboradores();
    } catch (error) {
      console.error("Erro ao resetar senha:", error);
      setErro(getErrorMessage(error));
    }
  }

  async function excluirColaborador(colaborador: Colaborador) {
    const confirmou = window.confirm(
      `Remover ${colaborador.nome} da lista de colaboradores? Se houver historico vinculado, o sistema vai apenas ocultar o cadastro para preservar os registros.`,
    );

    if (!confirmou) return;

    setErro(null);
    setSucesso(null);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("remover_colaborador", {
        colaborador_id_input: colaborador.id,
      });

      if (error) throw error;

      if (data === "DESATIVADO_COM_HISTORICO") {
        setSucesso(
          "Colaborador removido da lista. O historico dele foi preservado.",
        );
        await carregarColaboradores();
        return;
      }

      if (data === "NAO_ENCONTRADO") {
        setErro("Colaborador nao encontrado.");
        return;
      }

      setSucesso("Colaborador excluido da lista.");
      await carregarColaboradores();
    } catch (error) {
      console.error("Erro ao excluir colaborador:", error);
      setErro(getErrorMessage(error));
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Gestao de equipe
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">
              Colaboradores
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cadastre tecnicos, gestores e solicitantes. A senha inicial sera os 6 primeiros digitos do telefone.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar ao dashboard
            </Link>
            <button
              onClick={carregarColaboradores}
              disabled={atualizando}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={atualizando ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Atualizar
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
            <div>{sucesso}</div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-6">
          <Indicador titulo="Total" valor={indicadores.total} detalhe="Cadastrados" />
          <Indicador titulo="Ativos" valor={indicadores.ativos} detalhe="Podem acessar" />
          <Indicador titulo="Tecnicos" valor={indicadores.tecnicos} detalhe="Perfil tecnico" />
          <Indicador titulo="Gestores" valor={indicadores.gestores} detalhe="Perfil gestor" />
          <Indicador
            titulo="Encarregados"
            valor={indicadores.encarregados}
            detalhe="Acesso intermediario"
          />
          <Indicador
            titulo="Solicitantes"
            valor={indicadores.solicitantes}
            detalhe="Registram ocorrencias"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={cadastrarColaborador}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-md bg-blue-50 p-2 text-blue-700">
                <UserPlus size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Novo colaborador
                </h2>
                <p className="text-sm text-slate-500">
                  O telefone sera usado como senha inicial: os 6 primeiros digitos.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Campo
                label="Nome completo"
                value={form.nome}
                onChange={(value) => setForm((atual) => ({ ...atual, nome: value }))}
                placeholder="Ex: Maria da Silva"
              />
              <Campo
                label="CPF"
                value={form.cpf}
                onChange={(value) => setForm((atual) => ({ ...atual, cpf: value }))}
                placeholder="Somente numeros"
                inputMode="numeric"
              />
              <Campo
                label="Telefone"
                value={form.telefone}
                onChange={(value) =>
                  setForm((atual) => ({ ...atual, telefone: value }))
                }
                placeholder="Somente numeros"
                inputMode="tel"
              />

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Perfil
                </span>
                <select
                  value={form.perfil}
                  onChange={(event) =>
                    setForm((atual) => ({
                      ...atual,
                      perfil: event.target.value as PerfilColaborador,
                    }))
                  }
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="TECNICO">Tecnico</option>
                  <option value="SOLICITANTE">Solicitante</option>
                  <option value="ENCARREGADO">Encarregado</option>
                  <option value="GESTOR">Gestor</option>
                </select>
              </label>

              <PermissoesAcesso
                form={form}
                onChange={(patch) =>
                  setForm((atual) => ({ ...atual, ...patch }))
                }
              />

              <button
                type="submit"
                disabled={salvando}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus size={16} aria-hidden="true" />
                {salvando ? "Cadastrando..." : "Cadastrar colaborador"}
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 p-2 text-slate-700">
                  <UsersRound size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Equipe cadastrada
                  </h2>
                  <p className="text-sm text-slate-500">
                    {colaboradoresFiltrados.length} de {colaboradores.length} registros.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                <button
                  type="button"
                  onClick={() => setMostrarInativos((valor) => !valor)}
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {mostrarInativos ? "Ocultar inativos" : "Ver inativos"}
                </button>

                <label className="relative block w-full md:w-80">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Buscar colaborador</span>
                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar por nome, CPF ou perfil..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Nome</th>
                    <th className="px-4 py-3 font-bold">CPF</th>
                    <th className="px-4 py-3 font-bold">Telefone</th>
                    <th className="px-4 py-3 font-bold">Perfil</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Senha</th>
                    <th className="px-4 py-3 font-bold">Criado em</th>
                    <th className="px-4 py-3 font-bold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carregando ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Carregando colaboradores...
                      </td>
                    </tr>
                  ) : colaboradoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Nenhum colaborador encontrado.
                      </td>
                    </tr>
                  ) : (
                    colaboradoresFiltrados.map((colaborador) => (
                      <tr key={colaborador.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {colaborador.nome}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-600">
                          {colaborador.cpf || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {colaborador.telefone || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                            {colaborador.perfil}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`rounded-full border px-2 py-1 text-xs font-bold ${
                              colaborador.ativo
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }`}
                          >
                            {colaborador.ativo ? "ATIVO" : "INATIVO"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {colaborador.precisa_trocar_senha
                            ? "Troca pendente"
                            : "Senha criada"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {formatDate(colaborador.criado_em)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => abrirEdicao(colaborador)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                            >
                              <Pencil size={14} aria-hidden="true" />
                              Editar
                            </button>
                            <button
                              onClick={() => resetarSenha(colaborador)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <KeyRound size={14} aria-hidden="true" />
                              Resetar
                            </button>
                            <button
                              onClick={() => alternarAtivo(colaborador)}
                              className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              {colaborador.ativo ? "Desativar" : "Ativar"}
                            </button>
                            <button
                              onClick={() => excluirColaborador(colaborador)}
                              className="h-8 rounded-md border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {colaboradorEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                  Editar colaborador
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {colaboradorEmEdicao.nome}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Atualize dados como telefone, nome, CPF ou perfil.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setColaboradorEmEdicao(null)}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fechar edicao"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <Campo
                label="Nome completo"
                value={formEdicao.nome}
                onChange={(value) =>
                  setFormEdicao((atual) => ({ ...atual, nome: value }))
                }
                placeholder="Ex: Maria da Silva"
              />
              <Campo
                label="CPF"
                value={formEdicao.cpf}
                onChange={(value) =>
                  setFormEdicao((atual) => ({ ...atual, cpf: value }))
                }
                placeholder="Somente numeros"
                inputMode="numeric"
              />
              <Campo
                label="Telefone"
                value={formEdicao.telefone}
                onChange={(value) =>
                  setFormEdicao((atual) => ({ ...atual, telefone: value }))
                }
                placeholder="Somente numeros"
                inputMode="tel"
              />

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Perfil
                </span>
                <select
                  value={formEdicao.perfil}
                  onChange={(event) =>
                    setFormEdicao((atual) => ({
                      ...atual,
                      perfil: event.target.value as PerfilColaborador,
                    }))
                  }
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="TECNICO">Tecnico</option>
                  <option value="SOLICITANTE">Solicitante</option>
                  <option value="ENCARREGADO">Encarregado</option>
                  <option value="GESTOR">Gestor</option>
                </select>
              </label>

              <PermissoesAcesso
                form={formEdicao}
                onChange={(patch) =>
                  setFormEdicao((atual) => ({ ...atual, ...patch }))
                }
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setColaboradorEmEdicao(null)}
                disabled={salvandoEdicao}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicaoColaborador}
                disabled={salvandoEdicao}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvandoEdicao ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "numeric" | "tel";
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
        inputMode={inputMode}
        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function PermissoesAcesso({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
}) {
  const gestor = form.perfil === "GESTOR";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-bold text-slate-800">Permissoes de acesso</p>
      <p className="mt-1 text-xs text-slate-500">
        Marque quais modulos aparecem no painel inicial do colaborador.
      </p>
      <div className="mt-3 space-y-2">
        <CheckPermissao
          label="Modulo de manutencao"
          checked={gestor || form.permissao_modulo_manutencao}
          disabled={gestor}
          onChange={(checked) =>
            onChange({ permissao_modulo_manutencao: checked })
          }
        />
        <CheckPermissao
          label="Modulo de estoque"
          checked={gestor || form.permissao_modulo_estoque}
          disabled={gestor}
          onChange={(checked) => onChange({ permissao_modulo_estoque: checked })}
        />
        <CheckPermissao
          label="Modulo de manutencao de ar-condicionado"
          checked={gestor || form.permissao_modulo_ar_condicionado}
          disabled={gestor}
          onChange={(checked) =>
            onChange({ permissao_modulo_ar_condicionado: checked })
          }
        />
      </div>
      {gestor && (
        <p className="mt-2 text-xs font-semibold text-blue-700">
          Gestor tem acesso total automaticamente.
        </p>
      )}
    </div>
  );
}

function CheckPermissao({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-slate-950">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}
