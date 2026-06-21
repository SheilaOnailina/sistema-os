"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ClipboardList,
  KeyRound,
  LogOut,
  PlusCircle,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react";
import {
  getSupabase,
  type Colaborador,
  type Ocorrencia,
  type OrdemServico,
  type PrioridadeOS,
} from "@/lib/supabase";

const sessionKey = "sistema-os-colaborador";
type ResultadoServico = "REALIZADO" | "INCOMPLETO" | "";
const statusOcorrenciaLabels: Record<string, string> = {
  AGUARDANDO_AVALIACAO: "Em avaliacao",
  GEROU_OS: "Virou OS",
  ARQUIVADA: "Registrada / ciente",
  REGISTRADA_CIENTE: "Registrada / ciente",
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Falha ao conectar ao banco.";
}

function isTabelaAusenteError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "42P01" || error.code === "PGRST205")
  );
}

function getSessaoInicial() {
  if (typeof window === "undefined") return null;

  const sessao = localStorage.getItem(sessionKey);
  return sessao ? (JSON.parse(sessao) as Colaborador) : null;
}

const prioridadeLabels: Record<PrioridadeOS, string> = {
  BAIXA: "Baixa",
  NORMAL: "",
  ALTA: "Alta",
  URGENTE: "Prioridade",
};

const prioridadeStyles: Record<PrioridadeOS, string> = {
  BAIXA: "bg-slate-50 text-slate-600",
  NORMAL: "bg-blue-50 text-blue-700",
  ALTA: "bg-orange-50 text-orange-700",
  URGENTE: "bg-red-50 text-red-700",
};

function normalizePrioridade(prioridade?: string | null): PrioridadeOS {
  if (
    prioridade === "BAIXA" ||
    prioridade === "NORMAL" ||
    prioridade === "ALTA" ||
    prioridade === "URGENTE"
  ) {
    return prioridade;
  }

  return "NORMAL";
}

function prioridadePeso(prioridade?: string | null) {
  const normalizada = normalizePrioridade(prioridade);
  if (normalizada === "URGENTE") return 4;
  if (normalizada === "ALTA") return 3;
  if (normalizada === "NORMAL") return 2;
  return 1;
}

function ordenarOrdens(a: OrdemServico, b: OrdemServico) {
  const diferencaPrioridade = prioridadePeso(b.prioridade) - prioridadePeso(a.prioridade);
  if (diferencaPrioridade !== 0) return diferencaPrioridade;
  return Number(b.numero_os) - Number(a.numero_os);
}

async function listarOrdensDoTecnico(colaboradorId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ordens_servico")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .in("status", ["ABERTA", "EM_EXECUCAO", "AGUARDANDO_VALIDACAO"])
    .order("numero_os", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as OrdemServico[]).sort(ordenarOrdens);
}

async function listarOcorrenciasDoColaborador(colaboradorId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ocorrencias")
    .select("*")
    .eq("registrado_por_colaborador_id", colaboradorId)
    .order("numero_ocorrencia", { ascending: false });

  if (error) {
    if (isTabelaAusenteError(error)) return [];
    throw error;
  }

  return (data ?? []) as Ocorrencia[];
}

export default function PainelTecnicoIndividualPage() {
  const router = useRouter();
  const [usuario] = useState<Colaborador | null>(getSessaoInicial);
  const [listaOS, setListaOS] = useState<OrdemServico[]>([]);
  const [listaOcorrencias, setListaOcorrencias] = useState<Ocorrencia[]>([]);
  const [osSelecionada, setOsSelecionada] = useState<OrdemServico | null>(null);
  const [insumos, setInsumos] = useState("");
  const [resultadoServico, setResultadoServico] = useState<ResultadoServico>("");
  const [usouMaterial, setUsouMaterial] = useState<"SIM" | "NAO" | "">("");
  const [pendencia, setPendencia] = useState("");
  const [registrandoSolicitada, setRegistrandoSolicitada] = useState(false);
  const [salvandoSolicitada, setSalvandoSolicitada] = useState(false);
  const [tipoOcorrencia, setTipoOcorrencia] = useState("MANUTENCAO");
  const [localSolicitado, setLocalSolicitado] = useState("");
  const [descricaoSolicitada, setDescricaoSolicitada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function voltarParaLista() {
    setOsSelecionada(null);
    setResultadoServico("");
    setUsouMaterial("");
    setPendencia("");
    setInsumos("");
  }

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
      return;
    }

    if (usuario.perfil === "GESTOR") {
      router.replace("/dashboard");
    }
  }, [router, usuario]);

  async function buscarOrdens() {
    if (!usuario) return;

    try {
      setAtualizando(true);
      const [ordens, ocorrencias] = await Promise.all([
        usuario.perfil === "TECNICO"
          ? listarOrdensDoTecnico(usuario.id)
          : Promise.resolve([]),
        listarOcorrenciasDoColaborador(usuario.id),
      ]);
      setListaOS(ordens);
      setListaOcorrencias(ocorrencias);
      setErro(null);
    } catch (error) {
      console.error("Erro detalhado do Supabase:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    if (!usuario || usuario.perfil === "GESTOR") return;

    let montado = true;

    Promise.all([
      usuario.perfil === "TECNICO"
        ? listarOrdensDoTecnico(usuario.id)
        : Promise.resolve([]),
      listarOcorrenciasDoColaborador(usuario.id),
    ])
      .then(([ordens, ocorrencias]) => {
        if (!montado) return;
        setListaOS(ordens);
        setListaOcorrencias(ocorrencias);
        setErro(null);
      })
      .catch((error: unknown) => {
        if (!montado) return;
        console.error("Erro detalhado do Supabase:", error);
        setErro(getErrorMessage(error));
      })
      .finally(() => {
        if (montado) setCarregando(false);
      });

    return () => {
      montado = false;
    };
  }, [usuario]);

  const indicadores = useMemo(() => {
    return {
      abertas: listaOS.filter((os) => os.status === "ABERTA").length,
      emExecucao: listaOS.filter((os) => os.status === "EM_EXECUCAO").length,
      solicitadas: listaOcorrencias.filter(
        (ocorrencia) => ocorrencia.status === "AGUARDANDO_AVALIACAO",
      ).length,
    };
  }, [listaOS, listaOcorrencias]);

  async function iniciarDemanda(id: string) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("ordens_servico")
      .update({ status: "EM_EXECUCAO", data_inicio: new Date().toISOString() })
      .eq("id", id)
      .eq("colaborador_id", usuario?.id ?? "");

    if (error) {
      setErro(error.message);
      return;
    }

    await buscarOrdens();
    setOsSelecionada((ordem) =>
      ordem ? { ...ordem, status: "EM_EXECUCAO" } : ordem,
    );
  }

  async function concluirDemanda(id: string) {
    if (!resultadoServico) {
      setErro("Marque se o servico foi realizado ou se ficou incompleto.");
      return;
    }

    if (resultadoServico === "REALIZADO" && !usouMaterial) {
      setErro("Informe se houve uso de material.");
      return;
    }

    if (resultadoServico === "REALIZADO" && usouMaterial === "SIM" && !insumos.trim()) {
      setErro("Informe qual material foi utilizado.");
      return;
    }

    if (resultadoServico === "INCOMPLETO" && !pendencia.trim()) {
      setErro("Informe o que falta para concluir o servico.");
      return;
    }

    const servicoRealizado = resultadoServico === "REALIZADO";
    const relatoTecnico = servicoRealizado
      ? "Servico realizado."
      : `Servico incompleto. Falta: ${pendencia.trim()}`;

    const supabase = getSupabase();
    const { error } = await supabase
      .from("ordens_servico")
      .update({
        status: servicoRealizado ? "CONCLUIDA" : "INCOMPLETA",
        data_conclusao: new Date().toISOString(),
        relato_tecnico: relatoTecnico,
        insumos_utilizados:
          servicoRealizado && usouMaterial === "SIM" ? insumos.trim() : "",
      })
      .eq("id", id)
      .eq("colaborador_id", usuario?.id ?? "");

    if (error) {
      setErro(error.message);
      return;
    }

    alert(
      servicoRealizado
        ? "Ordem de Servico concluida com sucesso!"
        : "Ordem de Servico marcada como incompleta.",
    );
    setOsSelecionada(null);
    setResultadoServico("");
    setUsouMaterial("");
    setPendencia("");
    setInsumos("");
    await buscarOrdens();
  }

  function limparRegistroSolicitado() {
    setTipoOcorrencia("MANUTENCAO");
    setLocalSolicitado("");
    setDescricaoSolicitada("");
  }

  async function registrarDemandaSolicitada() {
    if (!usuario) return;

    if (
      !localSolicitado.trim() ||
      !descricaoSolicitada.trim()
    ) {
      setErro("Informe local e descricao da ocorrencia.");
      return;
    }

    try {
      setSalvandoSolicitada(true);
      const supabase = getSupabase();
      const { error } = await supabase.rpc("registrar_ocorrencia", {
        colaborador_id_input: usuario.id,
        tipo_input: tipoOcorrencia,
        local_input: localSolicitado,
        descricao_input: descricaoSolicitada,
        prioridade_input: "NORMAL",
      });

      if (error) throw error;

      alert("Ocorrencia registrada e enviada para avaliacao do gestor.");
      limparRegistroSolicitado();
      setRegistrandoSolicitada(false);
      setErro(null);
      await buscarOrdens();
    } catch (error) {
      console.error("Erro ao registrar ocorrencia:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvandoSolicitada(false);
    }
  }

  function sair() {
    localStorage.removeItem(sessionKey);
    router.push("/login");
  }

  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-slate-500">Redirecionando para o login...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 font-sans md:p-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-300">
                Painel individual
              </p>
              <h1 className="mt-1 text-xl font-bold">{usuario.nome}</h1>
              <p className="mt-1 text-xs text-slate-300">
                {usuario.perfil === "TECNICO"
                  ? "Minhas Ordens de Servico"
                  : "Registro de ocorrencias"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/alterar-senha"
                className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20"
                aria-label="Alterar senha"
              >
                <KeyRound size={18} aria-hidden="true" />
              </Link>
              <button
                onClick={sair}
                className="rounded-lg bg-white/10 p-2 text-slate-200 transition hover:bg-white/20"
                aria-label="Sair"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Indicador label="Abertas" value={indicadores.abertas} />
            <Indicador label="Em execucao" value={indicadores.emExecucao} />
            <Indicador label="Solicitadas" value={indicadores.solicitadas} />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 p-3 text-xs text-slate-200">
            <UserRound size={16} className="shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">Colaborador logado</p>
              <p className="text-slate-300">
                {usuario.telefone ? `Telefone: ${usuario.telefone}` : "Sem telefone cadastrado"}
              </p>
            </div>
          </div>
        </header>

        <button
          type="button"
          onClick={() => {
            setRegistrandoSolicitada(true);
            setErro(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700"
        >
          <PlusCircle size={18} aria-hidden="true" />
          Registrar ocorrencia
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <ClipboardList size={18} aria-hidden="true" />
              {usuario.perfil === "TECNICO" ? "Minhas demandas" : "Ocorrencias enviadas"}
            </div>
            <button
              onClick={buscarOrdens}
              disabled={atualizando}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={atualizando ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Atualizar
            </button>
          </div>

          {erro && (
            <div className="m-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}

          {carregando ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Buscando suas demandas...
            </p>
          ) : !osSelecionada ? (
            <div className="space-y-3 p-4">
              {usuario.perfil === "TECNICO" && listaOS.map((os) => (
                <button
                  key={os.id}
                  onClick={() => {
                    setOsSelecionada(os);
                    setResultadoServico("");
                    setUsouMaterial("");
                    setPendencia("");
                    setInsumos("");
                    setErro(null);
                  }}
                  className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-600">
                      OS #{os.numero_os}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {normalizePrioridade(os.prioridade) !== "NORMAL" && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            prioridadeStyles[normalizePrioridade(os.prioridade)]
                          }`}
                        >
                          {prioridadeLabels[normalizePrioridade(os.prioridade)]}
                        </span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          os.status === "AGUARDANDO_VALIDACAO"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {os.status === "AGUARDANDO_VALIDACAO"
                          ? "Pendente"
                          : os.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{os.local}</p>
                  <p className="line-clamp-2 text-xs text-slate-500">
                    {os.descricao}
                  </p>
                </button>
              ))}

              {usuario.perfil === "TECNICO" && listaOS.length === 0 && (
                <div className="rounded-2xl bg-slate-50 p-8 text-center">
                  <UserRound
                    size={28}
                    className="mx-auto mb-2 text-slate-300"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-500">
                    Nenhuma demanda pendente para voce.
                  </p>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">
                    Minhas ocorrencias
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">
                    {listaOcorrencias.length} registro(s)
                  </span>
                </div>

                {listaOcorrencias.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">
                    Nenhuma ocorrencia registrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {listaOcorrencias.map((ocorrencia) => (
                      <div
                        key={ocorrencia.id}
                        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-emerald-700">
                            Ocorrencia #{ocorrencia.numero_ocorrencia}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {statusOcorrenciaLabels[ocorrencia.status] ||
                              ocorrencia.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold uppercase text-slate-400">
                          {ocorrencia.tipo}
                        </p>
                        <p className="text-sm font-bold text-slate-800">
                          {ocorrencia.local}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ocorrencia.descricao}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-5">
              <button
                onClick={voltarParaLista}
                className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Minhas OS
              </button>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    OS #{osSelecionada.numero_os}
                  </span>
                  {normalizePrioridade(osSelecionada.prioridade) !== "NORMAL" && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        prioridadeStyles[
                          normalizePrioridade(osSelecionada.prioridade)
                        ]
                      }`}
                    >
                      {prioridadeLabels[
                        normalizePrioridade(osSelecionada.prioridade)
                      ]}
                    </span>
                  )}
                </div>
                <h2 className="mb-1 text-base font-bold text-slate-800">
                  {osSelecionada.local}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {osSelecionada.descricao}
                </p>
              </div>

              {osSelecionada.status === "ABERTA" && (
                <AvisoOperacional
                  titulo="OS aguardando inicio"
                  texto="Confira as informacoes e inicie quando for executar esta demanda."
                  tom="amber"
                />
              )}

              {osSelecionada.status === "AGUARDANDO_VALIDACAO" && (
                <AvisoOperacional
                  titulo="Aguardando validacao"
                  texto="Esta solicitacao foi enviada ao gestor e ainda nao virou uma OS ativa."
                  tom="violet"
                />
              )}

              {osSelecionada.status === "EM_EXECUCAO" && (
                <div className="space-y-4 pt-2">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                      Resultado do servico *
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <OpcaoMarcacao
                        label="Realizado"
                        checked={resultadoServico === "REALIZADO"}
                        onClick={() => {
                          setResultadoServico("REALIZADO");
                          setPendencia("");
                          setErro(null);
                        }}
                      />
                      <OpcaoMarcacao
                        label="Incompleto"
                        checked={resultadoServico === "INCOMPLETO"}
                        onClick={() => {
                          setResultadoServico("INCOMPLETO");
                          setUsouMaterial("");
                          setInsumos("");
                          setErro(null);
                        }}
                      />
                    </div>
                  </div>

                  {resultadoServico === "REALIZADO" && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                        Usou material?
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <OpcaoMarcacao
                          label="Sim"
                          checked={usouMaterial === "SIM"}
                          onClick={() => {
                            setUsouMaterial("SIM");
                            setErro(null);
                          }}
                        />
                        <OpcaoMarcacao
                          label="Nao"
                          checked={usouMaterial === "NAO"}
                          onClick={() => {
                            setUsouMaterial("NAO");
                            setInsumos("");
                            setErro(null);
                          }}
                        />
                      </div>

                      {usouMaterial === "SIM" && (
                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                            Qual material foi utilizado? *
                          </span>
                          <textarea
                            value={insumos}
                            onChange={(event) => setInsumos(event.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: tomada 20A, fita isolante, 2m de cabo..."
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {resultadoServico === "INCOMPLETO" && (
                    <label className="block rounded-2xl border border-slate-200 bg-white p-3">
                      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                        O que falta para concluir? *
                      </span>
                      <textarea
                        value={pendencia}
                        onChange={(event) => setPendencia(event.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: falta peca, depende de autorizacao, precisa retornar ao local..."
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {osSelecionada && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <button
                  onClick={voltarParaLista}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3.5 text-sm font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                >
                  Escolher outra OS
                </button>
                {osSelecionada.status === "AGUARDANDO_VALIDACAO" ? (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-violet-800">
                    Aguardando validacao do gestor
                  </div>
                ) : osSelecionada.status === "ABERTA" ? (
                  <button
                    onClick={() => iniciarDemanda(osSelecionada.id)}
                    className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-emerald-700"
                  >
                    Iniciar esta OS
                  </button>
                ) : (
                  <button
                    onClick={() => concluirDemanda(osSelecionada.id)}
                    className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-blue-700"
                  >
                    Salvar resultado
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {registrandoSolicitada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Registro de ocorrencia
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Nova ocorrencia
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Informe algo observado no setor para o gestor avaliar e,
                  se necessario, transformar em OS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRegistrandoSolicitada(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar registro"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Tipo *
                </span>
                <select
                  value={tipoOcorrencia}
                  onChange={(event) => setTipoOcorrencia(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="MANUTENCAO">Manutencao</option>
                  <option value="LIMPEZA">Limpeza</option>
                  <option value="AR_CONDICIONADO">Ar-condicionado</option>
                  <option value="ESTOQUE">Estoque/insumos</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Local *
                </span>
                <input
                  value={localSolicitado}
                  onChange={(event) => setLocalSolicitado(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Ex: Sala 12, banheiro, corredor..."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  O que foi observado? *
                </span>
                <textarea
                  value={descricaoSolicitada}
                  onChange={(event) => setDescricaoSolicitada(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Descreva a ocorrencia observada..."
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRegistrandoSolicitada(false)}
                disabled={salvandoSolicitada}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarDemandaSolicitada}
                disabled={salvandoSolicitada}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {salvandoSolicitada ? "Salvando..." : "Enviar ocorrencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Indicador({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function AvisoOperacional({
  titulo,
  texto,
  tom,
}: {
  titulo: string;
  texto: string;
  tom: "amber" | "violet";
}) {
  const classes =
    tom === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-violet-200 bg-violet-50 text-violet-900";

  return (
    <div className={`rounded-2xl border p-3 ${classes}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed">{texto}</p>
    </div>
  );
}

function OpcaoMarcacao({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${
        checked
          ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          checked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
        }`}
        aria-hidden="true"
      >
        {checked && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}
