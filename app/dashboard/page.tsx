"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Hammer,
  KeyRound,
  LogOut,
  Package,
  Pencil,
  RefreshCw,
  Search,
  MessageCircle,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  getSupabase,
  type Colaborador,
  type Ocorrencia,
  type OrdemServico,
  type PrioridadeOS,
} from "@/lib/supabase";

type StatusKey =
  | "ABERTA"
  | "EM_EXECUCAO"
  | "CONCLUIDA"
  | "INCOMPLETA"
  | "AGUARDANDO_VALIDACAO";
type FiltroDashboard = StatusKey | "INSUMOS" | null;
const sessionKey = "sistema-os-colaborador";

type EdicaoOS = {
  id: string;
  numeroOs: OrdemServico["numero_os"];
  solicitante: string;
  local: string;
  descricao: string;
  colaboradorId: string;
  status: string;
  prioridade: PrioridadeOS;
};

const statusLabels: Record<StatusKey, string> = {
  ABERTA: "Abertas",
  EM_EXECUCAO: "Em execucao",
  CONCLUIDA: "Concluidas",
  INCOMPLETA: "Incompletas",
  AGUARDANDO_VALIDACAO: "Aguardando validacao",
};

const statusStyles: Record<StatusKey, string> = {
  ABERTA: "bg-amber-100 text-amber-800 border-amber-200",
  EM_EXECUCAO: "bg-blue-100 text-blue-800 border-blue-200",
  CONCLUIDA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  INCOMPLETA: "bg-rose-100 text-rose-800 border-rose-200",
  AGUARDANDO_VALIDACAO: "bg-violet-100 text-violet-800 border-violet-200",
};

const prioridadeLabels: Record<PrioridadeOS, string> = {
  BAIXA: "Baixa",
  NORMAL: "",
  ALTA: "Alta",
  URGENTE: "Prioridade",
};

const prioridadeStyles: Record<PrioridadeOS, string> = {
  BAIXA: "border-slate-200 bg-slate-50 text-slate-600",
  NORMAL: "border-blue-200 bg-blue-50 text-blue-700",
  ALTA: "border-orange-200 bg-orange-50 text-orange-700",
  URGENTE: "border-red-200 bg-red-50 text-red-700",
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

  return error instanceof Error ? error.message : "Falha ao buscar os dados.";
}

function isTabelaAusenteError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "42P01" || error.code === "PGRST205")
  );
}

async function listarOrdens() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ordens_servico")
    .select("*")
    .order("numero_os", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as OrdemServico[]).sort(ordenarOrdens);
}

async function listarColaboradores() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("colaboradores")
    .select("id,nome,cpf,telefone,perfil,ativo,precisa_trocar_senha,criado_em");

  if (error) throw error;

  return (data ?? []) as Colaborador[];
}

async function listarOcorrencias() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ocorrencias")
    .select("*")
    .order("numero_ocorrencia", { ascending: false });

  if (error) {
    if (isTabelaAusenteError(error)) return [];
    throw error;
  }

  return (data ?? []) as Ocorrencia[];
}

async function carregarDadosDashboard() {
  const [ordens, colaboradores, ocorrencias] = await Promise.all([
    listarOrdens(),
    listarColaboradores(),
    listarOcorrencias(),
  ]);

  return { ordens, colaboradores, ocorrencias };
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

function normalizeStatus(status: string): StatusKey | "OUTRO" {
  if (
    status === "ABERTA" ||
    status === "EM_EXECUCAO" ||
    status === "CONCLUIDA" ||
    status === "INCOMPLETA" ||
    status === "AGUARDANDO_VALIDACAO"
  ) {
    return status;
  }

  return "OUTRO";
}

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

function formatWhatsAppPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroDashboard, setFiltroDashboard] = useState<FiltroDashboard>(null);
  const [filtroColaboradorId, setFiltroColaboradorId] = useState<string | null>(
    null,
  );
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [redistribuindoId, setRedistribuindoId] = useState<string | null>(null);
  const [validandoId, setValidandoId] = useState<string | null>(null);
  const [avaliandoOcorrenciaId, setAvaliandoOcorrenciaId] = useState<string | null>(null);
  const [tecnicosPorOcorrencia, setTecnicosPorOcorrencia] = useState<Record<string, string>>({});
  const [enviandoWhatsAppId, setEnviandoWhatsAppId] = useState<string | null>(null);
  const [mostrarOcorrenciasPendentes, setMostrarOcorrenciasPendentes] =
    useState(false);
  const [mostrarOrdensValidacao, setMostrarOrdensValidacao] = useState(false);
  const [ordemEmEdicao, setOrdemEmEdicao] = useState<EdicaoOS | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarOrdens() {
    try {
      setAtualizando(true);
      const dados = await carregarDadosDashboard();
      setOrdens(dados.ordens);
      setOcorrencias(dados.ocorrencias);
      setColaboradores(dados.colaboradores);
      setErro(null);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }

  useEffect(() => {
    let montado = true;

    carregarDadosDashboard()
      .then((dados) => {
        if (!montado) return;
        setOrdens(dados.ordens);
        setOcorrencias(dados.ocorrencias);
        setColaboradores(dados.colaboradores);
        setErro(null);
      })
      .catch((error: unknown) => {
        if (!montado) return;
        console.error("Erro ao carregar dashboard:", error);
        setErro(getErrorMessage(error));
      })
      .finally(() => {
        if (montado) setCarregando(false);
      });

    return () => {
      montado = false;
    };
  }, []);

  const nomesColaboradores = useMemo(() => {
    return colaboradores.reduce<Record<string, string>>((mapa, colaborador) => {
      mapa[colaborador.id] = colaborador.nome;
      return mapa;
    }, {});
  }, [colaboradores]);

  const colaboradoresPorId = useMemo(() => {
    return colaboradores.reduce<Record<string, Colaborador>>((mapa, colaborador) => {
      mapa[colaborador.id] = colaborador;
      return mapa;
    }, {});
  }, [colaboradores]);

  const tecnicosAtivos = useMemo(() => {
    return colaboradores
      .filter(
        (colaborador) => colaborador.perfil === "TECNICO" && colaborador.ativo,
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [colaboradores]);

  const ocorrenciasPendentes = useMemo(() => {
    return ocorrencias.filter(
      (ocorrencia) => ocorrencia.status === "AGUARDANDO_AVALIACAO",
    );
  }, [ocorrencias]);

  const ordensAguardandoValidacao = useMemo(() => {
    return ordens
      .filter((ordem) => ordem.status === "AGUARDANDO_VALIDACAO")
      .sort(ordenarOrdens);
  }, [ordens]);

  const indicadores = useMemo(() => {
    const abertas = ordens.filter((ordem) => ordem.status === "ABERTA").length;
    const emExecucao = ordens.filter(
      (ordem) => ordem.status === "EM_EXECUCAO",
    ).length;
    const concluidas = ordens.filter(
      (ordem) => ordem.status === "CONCLUIDA",
    ).length;
    const incompletas = ordens.filter(
      (ordem) => ordem.status === "INCOMPLETA",
    ).length;
    const aguardandoValidacao = ordens.filter(
      (ordem) => ordem.status === "AGUARDANDO_VALIDACAO",
    ).length;
    const comInsumos = ordens.filter((ordem) =>
      ordem.insumos_utilizados?.trim(),
    ).length;

    return {
      total: ordens.length,
      abertas,
      emExecucao,
      concluidas,
      incompletas,
      aguardandoValidacao,
      comInsumos,
    };
  }, [ordens]);

  const rankingColaboradores = useMemo(() => {
    return colaboradores
      .filter((colaborador) => colaborador.perfil === "TECNICO")
      .map((colaborador) => {
        const ordensDoColaborador = ordens.filter(
          (ordem) => ordem.colaborador_id === colaborador.id,
        );
        const abertas = ordensDoColaborador.filter(
          (ordem) => ordem.status === "ABERTA",
        ).length;
        const emExecucao = ordensDoColaborador.filter(
          (ordem) => ordem.status === "EM_EXECUCAO",
        ).length;
        const concluidas = ordensDoColaborador.filter(
          (ordem) => ordem.status === "CONCLUIDA",
        ).length;
        const incompletas = ordensDoColaborador.filter(
          (ordem) => ordem.status === "INCOMPLETA",
        ).length;
        const aguardandoValidacao = ordensDoColaborador.filter(
          (ordem) => ordem.status === "AGUARDANDO_VALIDACAO",
        ).length;

        return {
          id: colaborador.id,
          nome: colaborador.nome,
          ativo: colaborador.ativo,
          abertas,
          emExecucao,
          concluidas,
          incompletas,
          aguardandoValidacao,
          cargaAtual: abertas + emExecucao,
          total: ordensDoColaborador.length,
        };
      })
      .sort((a, b) => {
        if (b.cargaAtual !== a.cargaAtual) return b.cargaAtual - a.cargaAtual;
        return b.total - a.total;
      });
  }, [colaboradores, ordens]);

  const ordensFiltradas = useMemo(() => {
    const ordensPorFiltro = ordens.filter((ordem) => {
      if (!filtroDashboard) return true;
      if (filtroDashboard === "INSUMOS") {
        return Boolean(ordem.insumos_utilizados?.trim());
      }

      return ordem.status === filtroDashboard;
    });

    const ordensPorColaborador = filtroColaboradorId
      ? ordensPorFiltro.filter(
          (ordem) => ordem.colaborador_id === filtroColaboradorId,
        )
      : ordensPorFiltro;

    const termo = busca.trim().toLowerCase();
    if (!termo) return [...ordensPorColaborador].sort(ordenarOrdens);

    return ordensPorColaborador.filter((ordem) => {
      const texto = [
        ordem.numero_os,
        ordem.local,
        ordem.solicitante,
        ordem.descricao,
        ordem.status,
        ordem.colaborador_id ? nomesColaboradores[ordem.colaborador_id] : "",
        ordem.relato_tecnico,
        ordem.insumos_utilizados,
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(termo);
    }).sort(ordenarOrdens);
  }, [busca, filtroColaboradorId, filtroDashboard, nomesColaboradores, ordens]);

  const tituloFiltro = useMemo(() => {
    const statusTexto =
      filtroDashboard === "ABERTA"
        ? "Abertas"
        : filtroDashboard === "EM_EXECUCAO"
          ? "Em execucao"
          : filtroDashboard === "CONCLUIDA"
            ? "Concluidas"
            : filtroDashboard === "INCOMPLETA"
              ? "Incompletas"
              : filtroDashboard === "AGUARDANDO_VALIDACAO"
                ? "Aguardando validacao"
                : filtroDashboard === "INSUMOS"
                  ? "Com insumos"
                  : "Todas as ordens";
    const colaboradorTexto = filtroColaboradorId
      ? nomesColaboradores[filtroColaboradorId] || "Tecnico selecionado"
      : "";

    return colaboradorTexto ? `${statusTexto} - ${colaboradorTexto}` : statusTexto;
  }, [filtroColaboradorId, filtroDashboard, nomesColaboradores]);

  const maiorIndicador = Math.max(
    indicadores.abertas,
    indicadores.emExecucao,
    indicadores.concluidas,
    indicadores.aguardandoValidacao,
    1,
  );

  async function redistribuirOrdem(ordem: OrdemServico, colaboradorId: string) {
    if (!colaboradorId || colaboradorId === ordem.colaborador_id) return;

    try {
      setRedistribuindoId(ordem.id);
      const supabase = getSupabase();
      const { error } = await supabase
        .from("ordens_servico")
        .update({ colaborador_id: colaboradorId })
        .eq("id", ordem.id)
        .neq("status", "CONCLUIDA");

      if (error) throw error;

      const dados = await carregarDadosDashboard();
      setOrdens(dados.ordens);
      setOcorrencias(dados.ocorrencias);
      setColaboradores(dados.colaboradores);
      setErro(null);
    } catch (error) {
      console.error("Erro ao redistribuir OS:", error);
      setErro(getErrorMessage(error));
    } finally {
      setRedistribuindoId(null);
    }
  }

  async function validarDemanda(ordem: OrdemServico) {
    try {
      setValidandoId(ordem.id);
      const supabase = getSupabase();
      const { error } = await supabase
        .from("ordens_servico")
        .update({ status: "ABERTA" })
        .eq("id", ordem.id)
        .eq("status", "AGUARDANDO_VALIDACAO");

      if (error) throw error;

      const dados = await carregarDadosDashboard();
      setOrdens(dados.ordens);
      setOcorrencias(dados.ocorrencias);
      setColaboradores(dados.colaboradores);
      setErro(null);
    } catch (error) {
      console.error("Erro ao validar demanda:", error);
      setErro(getErrorMessage(error));
    } finally {
      setValidandoId(null);
    }
  }

  async function transformarOcorrenciaEmOS(ocorrencia: Ocorrencia) {
    const tecnicoId = tecnicosPorOcorrencia[ocorrencia.id];

    if (!tecnicoId) {
      setErro("Escolha um tecnico para transformar a ocorrencia em OS.");
      return;
    }

    try {
      setAvaliandoOcorrenciaId(ocorrencia.id);
      const gestor = JSON.parse(
        localStorage.getItem(sessionKey) ?? "null",
      ) as Colaborador | null;
      const supabase = getSupabase();
      const { error } = await supabase.rpc("transformar_ocorrencia_em_os", {
        ocorrencia_id_input: ocorrencia.id,
        gestor_id_input: gestor?.id ?? "",
        colaborador_id_input: tecnicoId,
        prioridade_input: normalizePrioridade(ocorrencia.prioridade_sugerida),
      });

      if (error) throw error;

      const dados = await carregarDadosDashboard();
      setOrdens(dados.ordens);
      setOcorrencias(dados.ocorrencias);
      setColaboradores(dados.colaboradores);
      setTecnicosPorOcorrencia((atuais) => {
        const copia = { ...atuais };
        delete copia[ocorrencia.id];
        return copia;
      });
      setErro(null);
    } catch (error) {
      console.error("Erro ao transformar ocorrencia em OS:", error);
      setErro(getErrorMessage(error));
    } finally {
      setAvaliandoOcorrenciaId(null);
    }
  }

  async function registrarCienciaOcorrencia(ocorrencia: Ocorrencia) {
    const confirmou = window.confirm(
      `Registrar ciencia da ocorrencia #${ocorrencia.numero_ocorrencia}?`,
    );

    if (!confirmou) return;

    try {
      setAvaliandoOcorrenciaId(ocorrencia.id);
      const gestor = JSON.parse(
        localStorage.getItem(sessionKey) ?? "null",
      ) as Colaborador | null;
      const supabase = getSupabase();
      const { error } = await supabase.rpc("arquivar_ocorrencia", {
        ocorrencia_id_input: ocorrencia.id,
        gestor_id_input: gestor?.id ?? "",
        observacao_input: null,
      });

      if (error) throw error;

      const dados = await carregarDadosDashboard();
      setOrdens(dados.ordens);
      setOcorrencias(dados.ocorrencias);
      setColaboradores(dados.colaboradores);
      setErro(null);
    } catch (error) {
      console.error("Erro ao registrar ciencia da ocorrencia:", error);
      setErro(getErrorMessage(error));
    } finally {
      setAvaliandoOcorrenciaId(null);
    }
  }

  async function excluirOrdem(ordem: OrdemServico) {
    const confirmou = window.confirm(
      `Excluir a OS #${ordem.numero_os}? Esta acao nao pode ser desfeita.`,
    );

    if (!confirmou) return;

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("ordens_servico")
        .delete()
        .eq("id", ordem.id);

      if (error) throw error;

      setOrdens((atuais) => atuais.filter((item) => item.id !== ordem.id));
      setErro(null);
    } catch (error) {
      console.error("Erro ao excluir OS:", error);
      setErro(getErrorMessage(error));
    }
  }

  function abrirEdicao(ordem: OrdemServico) {
    setOrdemEmEdicao({
      id: ordem.id,
      numeroOs: ordem.numero_os,
      solicitante: ordem.solicitante ?? "",
      local: ordem.local,
      descricao: ordem.descricao,
      colaboradorId: ordem.colaborador_id ?? "",
      status: ordem.status,
      prioridade: normalizePrioridade(ordem.prioridade),
    });
    setErro(null);
  }

  async function abrirWhatsApp(ordem: OrdemServico) {
    const colaborador = ordem.colaborador_id
      ? colaboradoresPorId[ordem.colaborador_id]
      : null;
    const telefone = formatWhatsAppPhone(colaborador?.telefone);

    if (!colaborador || !telefone) return;

    const linkSistema =
      typeof window === "undefined" ? "" : `${window.location.origin}/login`;
    const prioridade = normalizePrioridade(ordem.prioridade);
    const temPrioridade = prioridade !== "NORMAL";
    const mensagem = [
      `Ola, ${colaborador.nome}.`,
      "Voce tem uma demanda no Sistema OS.",
      temPrioridade ? `*PRIORIDADE: ${prioridadeLabels[prioridade] || "Prioridade"}*` : "",
      `OS #${ordem.numero_os}`,
      `Local: ${ordem.local}`,
      `Descricao: ${ordem.descricao}`,
      linkSistema ? `Acesse: ${linkSistema}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`,
      "_blank",
      "noopener,noreferrer",
    );

    try {
      setEnviandoWhatsAppId(ordem.id);
      const agora = new Date().toISOString();
      const supabase = getSupabase();
      const { error } = await supabase
        .from("ordens_servico")
        .update({ whatsapp_enviado_em: agora })
        .eq("id", ordem.id);

      if (error) throw error;

      setOrdens((atuais) =>
        atuais.map((item) =>
          item.id === ordem.id ? { ...item, whatsapp_enviado_em: agora } : item,
        ),
      );
      setErro(null);
    } catch (error) {
      console.error("Erro ao marcar WhatsApp como aberto:", error);
      setErro(getErrorMessage(error));
    } finally {
      setEnviandoWhatsAppId(null);
    }
  }

  function podeEnviarWhatsApp(ordem: OrdemServico) {
    if (!ordem.colaborador_id) return false;
    if (ordem.whatsapp_enviado_em) return false;
    return Boolean(formatWhatsAppPhone(colaboradoresPorId[ordem.colaborador_id]?.telefone));
  }

  async function salvarEdicao() {
    if (!ordemEmEdicao) return;

    const solicitante = ordemEmEdicao.solicitante.trim();
    const local = ordemEmEdicao.local.trim();
    const descricao = ordemEmEdicao.descricao.trim();

    if (!solicitante || !local || !descricao) {
      setErro("Preencha solicitante, local e descricao para salvar a OS.");
      return;
    }

    try {
      setSalvandoEdicao(true);
      const atualizacao: Partial<OrdemServico> = {
        solicitante,
        local,
        descricao,
        prioridade: ordemEmEdicao.prioridade,
      };

      if (ordemEmEdicao.status !== "CONCLUIDA") {
        atualizacao.colaborador_id = ordemEmEdicao.colaboradorId || null;
      }

      const supabase = getSupabase();
      const { error } = await supabase
        .from("ordens_servico")
        .update(atualizacao)
        .eq("id", ordemEmEdicao.id);

      if (error) throw error;

      const dados = await carregarDadosDashboard();
      setOrdens(dados.ordens);
      setOcorrencias(dados.ocorrencias);
      setColaboradores(dados.colaboradores);
      setOrdemEmEdicao(null);
      setErro(null);
    } catch (error) {
      console.error("Erro ao editar OS:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvandoEdicao(false);
    }
  }

  function sair() {
    localStorage.removeItem(sessionKey);
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Gestao de manutencao
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">
              Dashboard de Ordens de Servico
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Acompanhe chamados, execucao, conclusoes e materiais utilizados.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard/nova-os"
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Nova OS
            </Link>
            <Link
              href="/dashboard/colaboradores"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Colaboradores
            </Link>
            <Link
              href="/dashboard/estoque"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Estoque
            </Link>
            <Link
              href="/alterar-senha"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <KeyRound size={16} aria-hidden="true" />
              Minha senha
            </Link>
            <button
              type="button"
              onClick={sair}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
            <button
              onClick={carregarOrdens}
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
            <div>
              <strong>Erro ao carregar dados:</strong> {erro}
            </div>
          </div>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Ocorrencias
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">
                Aguardando avaliacao do gestor
              </h2>
              <p className="text-sm text-slate-500">
                Registros enviados por colaboradores antes de virar OS.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                {ocorrenciasPendentes.length} pendente(s)
              </span>
              <button
                type="button"
                onClick={() =>
                  setMostrarOcorrenciasPendentes((atual) => !atual)
                }
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {mostrarOcorrenciasPendentes ? "Ocultar" : "Ver detalhes"}
              </button>
            </div>
          </div>

          {mostrarOcorrenciasPendentes && (
            <div className="mt-4 space-y-3">
              {ocorrenciasPendentes.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  Nenhuma ocorrencia aguardando avaliacao.
                </div>
              ) : (
                ocorrenciasPendentes.map((ocorrencia) => (
                  <div
                    key={ocorrencia.id}
                    className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1fr_220px_220px]"
                  >
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          Ocorrencia #{ocorrencia.numero_ocorrencia}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-600">
                          {ocorrencia.tipo}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(ocorrencia.criado_em)}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800">
                        {ocorrencia.local}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {ocorrencia.descricao}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Registrado por:{" "}
                        {nomesColaboradores[
                          ocorrencia.registrado_por_colaborador_id
                        ] || "Colaborador nao encontrado"}
                      </p>
                    </div>

                    <select
                      value={tecnicosPorOcorrencia[ocorrencia.id] ?? ""}
                      onChange={(event) =>
                        setTecnicosPorOcorrencia((atuais) => ({
                          ...atuais,
                          [ocorrencia.id]: event.target.value,
                        }))
                      }
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Escolher tecnico</option>
                      {tecnicosAtivos.map((tecnico) => (
                        <option key={tecnico.id} value={tecnico.id}>
                          {tecnico.nome}
                        </option>
                      ))}
                    </select>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      <button
                        type="button"
                        onClick={() => transformarOcorrenciaEmOS(ocorrencia)}
                        disabled={avaliandoOcorrenciaId === ocorrencia.id}
                        className="h-10 rounded-md bg-emerald-600 px-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Virar OS
                      </button>
                      <button
                        type="button"
                        onClick={() => registrarCienciaOcorrencia(ocorrencia)}
                        disabled={avaliandoOcorrenciaId === ocorrencia.id}
                        className="h-10 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Registrar ciencia
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                Ordens solicitadas
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">
                Aguardando validacao do gestor
              </h2>
              <p className="text-sm text-slate-500">
                Demandas enviadas por colaboradores antes de entrar na fila de
                execucao.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700">
                {ordensAguardandoValidacao.length} pendente(s)
              </span>
              <button
                type="button"
                onClick={() => setMostrarOrdensValidacao((atual) => !atual)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {mostrarOrdensValidacao ? "Ocultar" : "Ver detalhes"}
              </button>
            </div>
          </div>

          {mostrarOrdensValidacao && (
            <div className="mt-4 space-y-3">
              {ordensAguardandoValidacao.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  Nenhuma OS aguardando validacao.
                </div>
              ) : (
                ordensAguardandoValidacao.map((ordem) => (
                <div
                  key={ordem.id}
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1fr_180px]"
                >
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        OS #{ordem.numero_os}
                      </span>
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold uppercase text-violet-700">
                        Aguardando validacao
                      </span>
                      {normalizePrioridade(ordem.prioridade) !== "NORMAL" && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                            prioridadeStyles[
                              normalizePrioridade(ordem.prioridade)
                            ]
                          }`}
                        >
                          {
                            prioridadeLabels[
                              normalizePrioridade(ordem.prioridade)
                            ]
                          }
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatDate(ordem.data_abertura)}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">
                      {ordem.local}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {ordem.descricao}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Solicitante: {ordem.solicitante || "-"}
                      {" | "}
                      Tecnico indicado:{" "}
                      {ordem.colaborador_id
                        ? nomesColaboradores[ordem.colaborador_id] ||
                          "Nao encontrado"
                        : "Sem tecnico"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => validarDemanda(ordem)}
                    disabled={validandoId === ordem.id}
                    className="h-10 rounded-md bg-violet-700 px-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Virar OS
                  </button>
                </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Indicador
            titulo="Total de OS"
            valor={indicadores.total}
            detalhe="Clique para ver todas"
            icon={ClipboardList}
            carregando={carregando}
            ativo={filtroDashboard === null}
            onClick={() => {
              setFiltroDashboard(null);
              setFiltroColaboradorId(null);
            }}
          />
          <Indicador
            titulo="Abertas"
            valor={indicadores.abertas}
            detalhe="Clique para filtrar"
            icon={AlertCircle}
            carregando={carregando}
            ativo={filtroDashboard === "ABERTA"}
            onClick={() => {
              setFiltroDashboard("ABERTA");
              setFiltroColaboradorId(null);
            }}
          />
          <Indicador
            titulo="Em execucao"
            valor={indicadores.emExecucao}
            detalhe="Clique para filtrar"
            icon={Hammer}
            carregando={carregando}
            ativo={filtroDashboard === "EM_EXECUCAO"}
            onClick={() => {
              setFiltroDashboard("EM_EXECUCAO");
              setFiltroColaboradorId(null);
            }}
          />
          <Indicador
            titulo="Com insumos"
            valor={indicadores.comInsumos}
            detalhe="Clique para filtrar"
            icon={Package}
            carregando={carregando}
            ativo={filtroDashboard === "INSUMOS"}
            onClick={() => {
              setFiltroDashboard("INSUMOS");
              setFiltroColaboradorId(null);
            }}
          />
          <Indicador
            titulo="Aguardando validacao"
            valor={indicadores.aguardandoValidacao}
            detalhe="Solicitadas por tecnicos"
            icon={CheckCircle2}
            carregando={carregando}
            ativo={filtroDashboard === "AGUARDANDO_VALIDACAO"}
            onClick={() => {
              setFiltroDashboard("AGUARDANDO_VALIDACAO");
              setFiltroColaboradorId(null);
            }}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Resumo por status
                </h2>
                <p className="text-sm text-slate-500">
                  Distribuicao das ordens no momento.
                </p>
              </div>
              <CheckCircle2 size={22} className="text-emerald-600" aria-hidden="true" />
            </div>

            <div className="mt-5 space-y-4">
              {(
                [
                  "ABERTA",
                  "EM_EXECUCAO",
                  "CONCLUIDA",
                  "INCOMPLETA",
                  "AGUARDANDO_VALIDACAO",
                ] as StatusKey[]
              ).map(
                (status) => {
                  const valor =
                    status === "ABERTA"
                      ? indicadores.abertas
                      : status === "EM_EXECUCAO"
                        ? indicadores.emExecucao
                        : status === "CONCLUIDA"
                          ? indicadores.concluidas
                          : status === "INCOMPLETA"
                            ? indicadores.incompletas
                            : indicadores.aguardandoValidacao;
                  const largura = `${Math.max((valor / maiorIndicador) * 100, valor ? 10 : 0)}%`;

                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">
                          {statusLabels[status]}
                        </span>
                        <span className="font-mono text-slate-500">{valor}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: largura }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Ranking de demanda
                  </h2>
                  <p className="text-sm text-slate-500">
                    Abertas + em execucao por tecnico.
                  </p>
                </div>
                <Trophy size={22} className="text-amber-500" aria-hidden="true" />
              </div>

              <div className="mt-5 space-y-3">
                {carregando ? (
                  <p className="py-4 text-center text-sm text-slate-500">
                    Calculando ranking...
                  </p>
                ) : rankingColaboradores.length === 0 ? (
                  <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
                    Nenhum tecnico cadastrado.
                  </p>
                ) : (
                  rankingColaboradores.map((colaborador, index) => (
                    <button
                      type="button"
                      key={colaborador.id}
                      onClick={() => {
                        setFiltroColaboradorId(colaborador.id);
                        setFiltroDashboard(null);
                      }}
                      className={`w-full rounded-md border bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-white hover:shadow-sm ${
                        filtroColaboradorId === colaborador.id
                          ? "border-blue-500 ring-2 ring-blue-100"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {index + 1}. {colaborador.nome}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {colaborador.ativo ? "Ativo" : "Inativo"} - clique
                            para ver demandas
                          </p>
                        </div>
                        <div className="rounded-md bg-white px-2 py-1 text-right shadow-sm">
                          <p className="font-mono text-lg font-bold text-slate-900">
                            {colaborador.cargaAtual}
                          </p>
                          <p className="text-[10px] font-semibold uppercase text-slate-500">
                            atuais
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                          <strong>{colaborador.abertas}</strong> abertas
                        </div>
                        <div className="rounded bg-blue-100 px-2 py-1 text-blue-800">
                          <strong>{colaborador.emExecucao}</strong> exec.
                        </div>
                        <div className="rounded bg-emerald-100 px-2 py-1 text-emerald-800">
                          <strong>{colaborador.concluidas}</strong> concl.
                        </div>
                        <div className="rounded bg-violet-100 px-2 py-1 text-violet-800">
                          <strong>{colaborador.aguardandoValidacao}</strong> valid.
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Relatorio de ordens - {tituloFiltro}
                </h2>
                <p className="text-sm text-slate-500">
                  {ordensFiltradas.length} de {ordens.length} registros exibidos.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                {(filtroDashboard || filtroColaboradorId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroDashboard(null);
                      setFiltroColaboradorId(null);
                    }}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Limpar filtro
                  </button>
                )}
                <label className="relative block w-full md:w-80">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Buscar ordem de servico</span>
                  <input
                    value={busca}
                    onChange={(event) => setBusca(event.target.value)}
                    placeholder="Buscar por local, OS, status..."
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">OS</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Prioridade</th>
                    <th className="px-4 py-3 font-bold">Aprovar</th>
                    <th className="px-4 py-3 font-bold">Editar</th>
                    <th className="px-4 py-3 font-bold">Excluir</th>
                    <th className="px-4 py-3 font-bold">Redistribuir</th>
                    <th className="px-4 py-3 font-bold">WhatsApp</th>
                    <th className="px-4 py-3 font-bold">Local</th>
                    <th className="px-4 py-3 font-bold">Solicitante</th>
                    <th className="px-4 py-3 font-bold">Tecnico</th>
                    <th className="px-4 py-3 font-bold">Descricao</th>
                    <th className="px-4 py-3 font-bold">Insumos</th>
                    <th className="px-4 py-3 font-bold">Relato tecnico</th>
                    <th className="px-4 py-3 font-bold">Abertura</th>
                    <th className="px-4 py-3 font-bold">Conclusao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carregando ? (
                    <tr>
                      <td colSpan={16} className="px-4 py-10 text-center text-slate-500">
                        Carregando dados do Supabase...
                      </td>
                    </tr>
                  ) : ordensFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="px-4 py-10 text-center text-slate-500">
                        Nenhuma ordem encontrada.
                      </td>
                    </tr>
                  ) : (
                    ordensFiltradas.map((ordem) => {
                      const status = normalizeStatus(ordem.status);

                      return (
                        <tr key={ordem.id} className="align-top hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900">
                            #{ordem.numero_os}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${
                                status === "OUTRO"
                                  ? "border-slate-200 bg-slate-100 text-slate-700"
                                  : statusStyles[status]
                              }`}
                            >
                              {ordem.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {normalizePrioridade(ordem.prioridade) === "NORMAL" ? (
                              <span className="text-xs text-slate-400">-</span>
                            ) : (
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${
                                  prioridadeStyles[
                                    normalizePrioridade(ordem.prioridade)
                                  ]
                                }`}
                              >
                                {prioridadeLabels[
                                  normalizePrioridade(ordem.prioridade)
                                ]}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {ordem.status === "AGUARDANDO_VALIDACAO" ? (
                              <button
                                type="button"
                                onClick={() => validarDemanda(ordem)}
                                disabled={validandoId === ordem.id}
                                className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Virar OS
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(ordem)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil size={14} aria-hidden="true" />
                              Editar
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => excluirOrdem(ordem)}
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Excluir
                            </button>
                          </td>
                          <td className="min-w-[190px] px-4 py-3">
                            {ordem.status === "CONCLUIDA" ? (
                              <span className="text-xs font-semibold text-slate-400">
                                Historico fechado
                              </span>
                            ) : (
                              <select
                                value={ordem.colaborador_id ?? ""}
                                onChange={(event) =>
                                  redistribuirOrdem(ordem, event.target.value)
                                }
                                disabled={redistribuindoId === ordem.id}
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                <option value="">Sem tecnico</option>
                                {tecnicosAtivos.map((tecnico) => (
                                  <option key={tecnico.id} value={tecnico.id}>
                                    {tecnico.nome}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => abrirWhatsApp(ordem)}
                              disabled={
                                !podeEnviarWhatsApp(ordem) ||
                                enviandoWhatsAppId === ordem.id
                              }
                              className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                            >
                              <MessageCircle size={14} aria-hidden="true" />
                              {ordem.whatsapp_enviado_em
                                ? "WhatsApp aberto"
                                : "Abrir WhatsApp"}
                            </button>
                            {ordem.whatsapp_enviado_em && (
                              <p className="mt-1 text-[10px] text-slate-400">
                                Aberto em {formatDate(ordem.whatsapp_enviado_em)}
                              </p>
                            )}
                          </td>
                          <td className="max-w-[180px] px-4 py-3 font-semibold text-slate-800">
                            {ordem.local}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {ordem.solicitante || "-"}
                          </td>
                          <td className="max-w-[180px] px-4 py-3 text-slate-700">
                            {ordem.colaborador_id
                              ? nomesColaboradores[ordem.colaborador_id] ||
                                "Nao encontrado"
                              : "Sem tecnico"}
                          </td>
                          <td className="max-w-[260px] px-4 py-3 text-slate-600">
                            {ordem.descricao}
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-slate-600">
                            {ordem.insumos_utilizados || "-"}
                          </td>
                          <td className="max-w-[260px] px-4 py-3 text-slate-600">
                            {ordem.relato_tecnico || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                            {formatDate(ordem.data_abertura)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                            {formatDate(ordem.data_conclusao)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {ordemEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                  Editar chamado
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  OS #{ordemEmEdicao.numeroOs}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Corrija os dados do chamado e salve para atualizar o painel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrdemEmEdicao(null)}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fechar edicao"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Solicitante
                </span>
                <input
                  value={ordemEmEdicao.solicitante}
                  onChange={(event) =>
                    setOrdemEmEdicao({
                      ...ordemEmEdicao,
                      solicitante: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Local</span>
                <input
                  value={ordemEmEdicao.local}
                  onChange={(event) =>
                    setOrdemEmEdicao({
                      ...ordemEmEdicao,
                      local: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Tecnico responsavel
                </span>
                <select
                  value={ordemEmEdicao.colaboradorId}
                  onChange={(event) =>
                    setOrdemEmEdicao({
                      ...ordemEmEdicao,
                      colaboradorId: event.target.value,
                    })
                  }
                  disabled={ordemEmEdicao.status === "CONCLUIDA"}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Sem tecnico</option>
                  {tecnicosAtivos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nome}
                    </option>
                  ))}
                </select>
                {ordemEmEdicao.status === "CONCLUIDA" && (
                  <span className="mt-1 block text-xs text-slate-500">
                    OS concluida mantem o tecnico do historico.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Prioridade
                </span>
                <select
                  value={ordemEmEdicao.prioridade}
                  onChange={(event) =>
                    setOrdemEmEdicao({
                      ...ordemEmEdicao,
                      prioridade: event.target.value as PrioridadeOS,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="NORMAL">Sem prioridade</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Prioridade</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Descricao da demanda
                </span>
                <textarea
                  value={ordemEmEdicao.descricao}
                  onChange={(event) =>
                    setOrdemEmEdicao({
                      ...ordemEmEdicao,
                      descricao: event.target.value,
                    })
                  }
                  rows={5}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOrdemEmEdicao(null)}
                disabled={salvandoEdicao}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
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

function Indicador({
  titulo,
  valor,
  detalhe,
  icon: Icon,
  carregando,
  ativo,
  onClick,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  icon: typeof ClipboardList;
  carregando: boolean;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md ${
        ativo ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{titulo}</p>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-950">
            {carregando ? "--" : valor}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-2 text-blue-700">
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>
    </button>
  );
}
