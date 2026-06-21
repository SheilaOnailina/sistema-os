"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import {
  getSupabase,
  type Colaborador,
  type MaterialEstoque,
  type MovimentacaoEstoque,
  type PeriodicidadeEstoque,
  type SolicitacaoMaterial,
  type UnidadeMedida,
} from "@/lib/supabase";

const sessionKey = "sistema-os-colaborador";

const periodicidadeLabels: Record<PeriodicidadeEstoque, string> = {
  SEM_PREVISAO: "Sem previsao",
  MENSAL: "Mensal",
  BIMESTRAL: "Bimestral",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

const periodicidades: PeriodicidadeEstoque[] = [
  "SEM_PREVISAO",
  "MENSAL",
  "BIMESTRAL",
  "TRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
];

function getSessaoInicial() {
  if (typeof window === "undefined") return null;

  const sessao = localStorage.getItem(sessionKey);
  return sessao ? (JSON.parse(sessao) as Colaborador) : null;
}

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

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T00:00:00`));
}

function diasAte(value?: string | null) {
  if (!value) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(`${value}T00:00:00`);
  return Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
}

function numero(value: unknown) {
  return Number(value ?? 0);
}

async function carregarEstoque() {
  const supabase = getSupabase();
  const [
    materiaisResult,
    movimentosResult,
    colaboradoresResult,
    unidadesResult,
    solicitacoesResult,
  ] =
    await Promise.all([
      supabase
        .from("materiais_estoque")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("movimentacoes_estoque")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(20),
      supabase
        .from("colaboradores")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("unidades_medida")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true }),
      supabase
        .from("solicitacoes_materiais")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(50),
    ]);

  if (materiaisResult.error) {
    if (isTabelaAusenteError(materiaisResult.error)) {
      return {
        materiais: [],
        movimentos: [],
        colaboradores: [],
        unidades: [],
        solicitacoes: [],
      };
    }
    throw materiaisResult.error;
  }

  if (movimentosResult.error && !isTabelaAusenteError(movimentosResult.error)) {
    throw movimentosResult.error;
  }

  if (colaboradoresResult.error) throw colaboradoresResult.error;
  if (unidadesResult.error && !isTabelaAusenteError(unidadesResult.error)) {
    throw unidadesResult.error;
  }
  if (
    solicitacoesResult.error &&
    !isTabelaAusenteError(solicitacoesResult.error)
  ) {
    throw solicitacoesResult.error;
  }

  return {
    materiais: (materiaisResult.data ?? []) as MaterialEstoque[],
    movimentos: (movimentosResult.data ?? []) as MovimentacaoEstoque[],
    colaboradores: (colaboradoresResult.data ?? []) as Colaborador[],
    unidades: (unidadesResult.data ?? []) as UnidadeMedida[],
    solicitacoes: (solicitacoesResult.data ?? []) as SolicitacaoMaterial[],
  };
}

export default function EstoquePage() {
  const router = useRouter();
  const [usuario] = useState<Colaborador | null>(getSessaoInicial);
  const [materiais, setMateriais] = useState<MaterialEstoque[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentacaoEstoque[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoMaterial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("Unidade");
  const [unidadePersonalizada, setUnidadePersonalizada] = useState("");
  const [quantidadeInicial, setQuantidadeInicial] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [periodicidade, setPeriodicidade] =
    useState<PeriodicidadeEstoque>("SEM_PREVISAO");
  const [ultimoRecebimento, setUltimoRecebimento] = useState("");

  const [materialEntradaId, setMaterialEntradaId] = useState("");
  const [quantidadeEntrada, setQuantidadeEntrada] = useState("");
  const [observacaoEntrada, setObservacaoEntrada] = useState("");

  const [materialSaidaId, setMaterialSaidaId] = useState("");
  const [quantidadeSaida, setQuantidadeSaida] = useState("");
  const [colaboradorSaidaId, setColaboradorSaidaId] = useState("");
  const [motivoSaida, setMotivoSaida] = useState("");
  const [buscaMateriais, setBuscaMateriais] = useState("");
  const [buscaMovimentos, setBuscaMovimentos] = useState("");
  const [materialEmEdicao, setMaterialEmEdicao] =
    useState<MaterialEstoque | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editUnidade, setEditUnidade] = useState("Unidade");
  const [editUnidadePersonalizada, setEditUnidadePersonalizada] = useState("");
  const [editEstoqueMinimo, setEditEstoqueMinimo] = useState("0");
  const [editPeriodicidade, setEditPeriodicidade] =
    useState<PeriodicidadeEstoque>("SEM_PREVISAO");
  const [editUltimoRecebimento, setEditUltimoRecebimento] = useState("");

  const podeConfigurar = usuario?.perfil === "GESTOR";
  const podeAprovar =
    usuario?.perfil === "GESTOR" || usuario?.perfil === "ENCARREGADO";

  const opcoesUnidade = useMemo(() => {
    const base = ["Unidade", "Kg", "Metro", "Litro", "Pacote"];
    const cadastradas = unidades.map((item) => item.nome);
    return Array.from(new Set([...base, ...cadastradas])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [unidades]);

  const nomesMateriais = useMemo(() => {
    return materiais.reduce<Record<string, string>>((mapa, material) => {
      mapa[material.id] = material.nome;
      return mapa;
    }, {});
  }, [materiais]);

  const nomesColaboradores = useMemo(() => {
    return colaboradores.reduce<Record<string, string>>((mapa, colaborador) => {
      mapa[colaborador.id] = colaborador.nome;
      return mapa;
    }, {});
  }, [colaboradores]);

  const alertas = useMemo(() => {
    return materiais.filter((material) => {
      const saldoBaixo =
        numero(material.quantidade_atual) <= numero(material.estoque_minimo);
      const dias = diasAte(material.proximo_recebimento);
      const recebimentoProximo = dias !== null && dias <= 7;
      return saldoBaixo || recebimentoProximo;
    });
  }, [materiais]);

  const materiaisFiltrados = useMemo(() => {
    const termo = buscaMateriais.trim().toLowerCase();
    if (!termo) return materiais;

    return materiais.filter((material) =>
      [
        material.nome,
        material.unidade,
        material.periodicidade,
        material.ultimo_recebimento,
        material.proximo_recebimento,
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [buscaMateriais, materiais]);

  const movimentosFiltrados = useMemo(() => {
    const termo = buscaMovimentos.trim().toLowerCase();
    if (!termo) return movimentos;

    return movimentos.filter((movimento) =>
      [
        nomesMateriais[movimento.material_id],
        movimento.tipo,
        movimento.motivo,
        movimento.observacao,
        movimento.colaborador_id
          ? nomesColaboradores[movimento.colaborador_id]
          : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [buscaMovimentos, movimentos, nomesColaboradores, nomesMateriais]);

  const solicitacoesPendentes = useMemo(() => {
    return solicitacoes.filter(
      (solicitacao) => solicitacao.status === "PENDENTE",
    );
  }, [solicitacoes]);

  async function atualizarDados() {
    try {
      setCarregando(true);
      const dados = await carregarEstoque();
      setMateriais(dados.materiais);
      setMovimentos(dados.movimentos);
      setColaboradores(dados.colaboradores);
      setUnidades(dados.unidades);
      setSolicitacoes(dados.solicitacoes);
      setErro(null);
    } catch (error) {
      console.error("Erro ao carregar estoque:", error);
      setErro(getErrorMessage(error));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
      return;
    }

    if (!podeAprovar) {
      router.replace("/tecnico");
      return;
    }

    let montado = true;

    carregarEstoque()
      .then((dados) => {
        if (!montado) return;
        setMateriais(dados.materiais);
        setMovimentos(dados.movimentos);
        setColaboradores(dados.colaboradores);
        setUnidades(dados.unidades);
        setSolicitacoes(dados.solicitacoes);
        setErro(null);
      })
      .catch((error: unknown) => {
        if (!montado) return;
        console.error("Erro ao carregar estoque:", error);
        setErro(getErrorMessage(error));
      })
      .finally(() => {
        if (montado) setCarregando(false);
      });

    return () => {
      montado = false;
    };
  }, [router, usuario, podeAprovar]);

  async function cadastrarMaterial() {
    if (!nome.trim()) {
      setErro("Informe o nome do material.");
      return;
    }

    const unidadeFinal =
      unidade === "OUTRA" ? unidadePersonalizada.trim() : unidade;

    if (!unidadeFinal) {
      setErro("Informe a unidade de medida.");
      return;
    }

    if (quantidadeInicial && Number(quantidadeInicial) < 0) {
      setErro("A quantidade inicial nao pode ser negativa.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("cadastrar_material_estoque", {
        nome_input: nome,
        unidade_input: unidadeFinal,
        estoque_minimo_input: Number(estoqueMinimo || 0),
        periodicidade_input: periodicidade,
        ultimo_recebimento_input: ultimoRecebimento || null,
      });

      if (error) throw error;

      const materialCriado = data as MaterialEstoque | null;
      if (materialCriado?.id && Number(quantidadeInicial || 0) > 0) {
        const { error: movimentoError } = await supabase.rpc(
          "registrar_movimentacao_estoque",
          {
            material_id_input: materialCriado.id,
            tipo_input: "ENTRADA",
            quantidade_input: Number(quantidadeInicial),
            colaborador_id_input: null,
            motivo_input: "Saldo inicial",
            observacao_input: "Entrada informada no cadastro do material",
            ordem_servico_id_input: null,
            registrado_por_colaborador_id_input: usuario?.id ?? null,
          },
        );

        if (movimentoError) throw movimentoError;
      }

      setNome("");
      setUnidade("Unidade");
      setUnidadePersonalizada("");
      setQuantidadeInicial("");
      setEstoqueMinimo("0");
      setPeriodicidade("SEM_PREVISAO");
      setUltimoRecebimento("");
      await atualizarDados();
    } catch (error) {
      console.error("Erro ao cadastrar material:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvando(false);
    }
  }

  async function registrarMovimentacao(tipo: "ENTRADA" | "SAIDA") {
    const materialId = tipo === "ENTRADA" ? materialEntradaId : materialSaidaId;
    const quantidade =
      tipo === "ENTRADA" ? quantidadeEntrada : quantidadeSaida;

    if (!materialId) {
      setErro("Escolha o material.");
      return;
    }

    if (!quantidade || Number(quantidade) <= 0) {
      setErro("Informe uma quantidade maior que zero.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { error } = await supabase.rpc("registrar_movimentacao_estoque", {
        material_id_input: materialId,
        tipo_input: tipo,
        quantidade_input: Number(quantidade),
        colaborador_id_input:
          tipo === "SAIDA" ? colaboradorSaidaId || null : null,
        motivo_input:
          tipo === "ENTRADA" ? "Entrada de material" : motivoSaida,
        observacao_input:
          tipo === "ENTRADA" ? observacaoEntrada : "Saida manual pelo gestor",
        ordem_servico_id_input: null,
        registrado_por_colaborador_id_input: usuario?.id ?? null,
      });

      if (error) throw error;

      setMaterialEntradaId("");
      setQuantidadeEntrada("");
      setObservacaoEntrada("");
      setMaterialSaidaId("");
      setQuantidadeSaida("");
      setColaboradorSaidaId("");
      setMotivoSaida("");
      await atualizarDados();
    } catch (error) {
      console.error("Erro ao movimentar estoque:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvando(false);
    }
  }

  function abrirEdicaoMaterial(material: MaterialEstoque) {
    const unidadeExiste = opcoesUnidade.includes(material.unidade);
    setMaterialEmEdicao(material);
    setEditNome(material.nome);
    setEditUnidade(unidadeExiste ? material.unidade : "OUTRA");
    setEditUnidadePersonalizada(unidadeExiste ? "" : material.unidade || "");
    setEditEstoqueMinimo(String(numero(material.estoque_minimo)));
    setEditPeriodicidade(material.periodicidade as PeriodicidadeEstoque);
    setEditUltimoRecebimento(material.ultimo_recebimento ?? "");
    setErro(null);
  }

  async function salvarEdicaoMaterial() {
    if (!materialEmEdicao) return;

    if (!editNome.trim()) {
      setErro("Informe o nome do material.");
      return;
    }

    const unidadeFinal =
      editUnidade === "OUTRA" ? editUnidadePersonalizada.trim() : editUnidade;

    if (!unidadeFinal) {
      setErro("Informe a unidade de medida.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { error } = await supabase.rpc("atualizar_material_estoque", {
        material_id_input: materialEmEdicao.id,
        nome_input: editNome,
        unidade_input: unidadeFinal,
        estoque_minimo_input: Number(editEstoqueMinimo || 0),
        periodicidade_input: editPeriodicidade,
        ultimo_recebimento_input: editUltimoRecebimento || null,
      });

      if (error) throw error;

      setMaterialEmEdicao(null);
      await atualizarDados();
    } catch (error) {
      console.error("Erro ao editar material:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvando(false);
    }
  }

  async function responderSolicitacao(
    solicitacao: SolicitacaoMaterial,
    autorizar: boolean,
  ) {
    if (!usuario) return;

    const mensagem = autorizar
      ? "Autorizar esta solicitacao e baixar o saldo do estoque?"
      : "Recusar esta solicitacao de material?";

    if (!window.confirm(mensagem)) return;

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { error } = await supabase.rpc("responder_solicitacao_material", {
        solicitacao_id_input: solicitacao.id,
        autorizador_id_input: usuario.id,
        autorizar_input: autorizar,
        observacao_input: autorizar ? "Autorizada" : "Recusada",
      });

      if (error) throw error;

      await atualizarDados();
    } catch (error) {
      console.error("Erro ao responder solicitacao:", error);
      setErro(getErrorMessage(error));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Estoque
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">
                Controle de materiais
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre insumos, registre entradas e acompanhe alertas de
                reposicao.
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
                type="button"
                onClick={atualizarDados}
                disabled={carregando}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={carregando ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                Atualizar
              </button>
            </div>
          </div>
        </header>

        {erro && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {erro}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <ResumoCard
            titulo="Materiais cadastrados"
            valor={materiais.length}
            detalhe="Itens ativos no estoque"
            icon={Boxes}
          />
          <ResumoCard
            titulo="Alertas"
            valor={alertas.length}
            detalhe="Baixo saldo ou recebimento proximo"
            icon={AlertTriangle}
          />
          <ResumoCard
            titulo="Movimentacoes"
            valor={movimentos.length}
            detalhe="Ultimos registros exibidos"
            icon={CalendarClock}
          />
          <ResumoCard
            titulo="Solicitacoes"
            valor={solicitacoesPendentes.length}
            detalhe="Aguardando autorizacao"
            icon={CheckCircle2}
          />
        </section>

        {podeAprovar && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Solicitacoes de material
                </p>
                <h2 className="text-lg font-bold text-slate-950">
                  Aguardando autorizacao
                </h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">
                {solicitacoesPendentes.length} pendente(s)
              </span>
            </div>

            {solicitacoesPendentes.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                Nenhuma solicitacao de material pendente.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {solicitacoesPendentes.map((solicitacao) => {
                  const material = nomesMateriais[solicitacao.material_id];
                  const colaborador = nomesColaboradores[solicitacao.colaborador_id];
                  const materialCompleto = materiais.find(
                    (item) => item.id === solicitacao.material_id,
                  );

                  return (
                    <div
                      key={solicitacao.id}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">
                            {material || "Material"}
                          </p>
                          <p className="text-sm text-slate-500">
                            Solicitado por: {colaborador || "Colaborador"}
                          </p>
                          <p className="text-sm text-slate-500">
                            Quantidade: {numero(solicitacao.quantidade)}{" "}
                            {materialCompleto?.unidade || ""}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {solicitacao.motivo}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                          Pendente
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => responderSolicitacao(solicitacao, true)}
                          disabled={salvando}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          Autorizar
                        </button>
                        <button
                          type="button"
                          onClick={() => responderSolicitacao(solicitacao, false)}
                          disabled={salvando}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          <XCircle size={16} aria-hidden="true" />
                          Recusar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          {podeConfigurar && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PlusCircle size={18} className="text-emerald-700" />
              <h2 className="font-bold text-slate-950">Cadastrar material</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome do material" value={nome} onChange={setNome} />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Unidade de medida
                </span>
                <select
                  value={unidade}
                  onChange={(event) => setUnidade(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {opcoesUnidade.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value="OUTRA">Outra unidade</option>
                </select>
              </label>
              {unidade === "OUTRA" && (
                <Input
                  label="Digite a nova unidade"
                  value={unidadePersonalizada}
                  onChange={setUnidadePersonalizada}
                  placeholder="Ex: Caixa, Rolo, Galão..."
                />
              )}
              <Input
                label="Quantidade inicial"
                type="number"
                value={quantidadeInicial}
                onChange={setQuantidadeInicial}
                placeholder="Ex: 10"
              />
              <Input
                label="Estoque minimo"
                type="number"
                value={estoqueMinimo}
                onChange={setEstoqueMinimo}
              />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Periodicidade de recebimento
                </span>
                <select
                  value={periodicidade}
                  onChange={(event) =>
                    setPeriodicidade(event.target.value as PeriodicidadeEstoque)
                  }
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {periodicidades.map((item) => (
                    <option key={item} value={item}>
                      {periodicidadeLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Ultimo recebimento"
                type="date"
                value={ultimoRecebimento}
                onChange={setUltimoRecebimento}
              />
            </div>
            <button
              type="button"
              onClick={cadastrarMaterial}
              disabled={salvando}
              className="mt-4 h-11 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Cadastrar material"}
            </button>
          </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-slate-950">Alertas atuais</h2>
            {carregando ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Carregando estoque...
              </div>
            ) : alertas.length === 0 ? (
              <div className="rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                Nenhum alerta no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {alertas.map((material) => (
                  <div
                    key={material.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <p className="font-bold text-amber-950">{material.nome}</p>
                    <p className="text-sm text-amber-800">
                      Saldo: {numero(material.quantidade_atual)}{" "}
                      {material.unidade} | minimo:{" "}
                      {numero(material.estoque_minimo)}
                    </p>
                    {material.proximo_recebimento && (
                      <p className="text-sm text-amber-800">
                        Proximo recebimento:{" "}
                        {formatDate(material.proximo_recebimento)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {podeConfigurar && (
          <section className="grid gap-4 xl:grid-cols-2">
            <MovimentoBox
              titulo="Registrar entrada"
              icon={ArrowUpCircle}
              materiais={materiais}
              materialId={materialEntradaId}
              setMaterialId={setMaterialEntradaId}
              quantidade={quantidadeEntrada}
              setQuantidade={setQuantidadeEntrada}
              observacao={observacaoEntrada}
              setObservacao={setObservacaoEntrada}
              onSalvar={() => registrarMovimentacao("ENTRADA")}
              disabled={salvando}
              buttonLabel="Salvar entrada"
            />

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ArrowDownCircle size={18} className="text-red-700" />
                <h2 className="font-bold text-slate-950">Registrar saida</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <SelectMaterial
                  materiais={materiais}
                  value={materialSaidaId}
                  onChange={setMaterialSaidaId}
                />
                <Input
                  label="Quantidade"
                  type="number"
                  value={quantidadeSaida}
                  onChange={setQuantidadeSaida}
                />
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Colaborador que retirou
                  </span>
                  <select
                    value={colaboradorSaidaId}
                    onChange={(event) => setColaboradorSaidaId(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  >
                    <option value="">Sem colaborador vinculado</option>
                    {colaboradores.map((colaborador) => (
                      <option key={colaborador.id} value={colaborador.id}>
                        {colaborador.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Motivo"
                  value={motivoSaida}
                  onChange={setMotivoSaida}
                  placeholder="Ex: cafe, limpeza, reposicao..."
                />
              </div>
              <button
                type="button"
                onClick={() => registrarMovimentacao("SAIDA")}
                disabled={salvando}
                className="mt-4 h-11 rounded-md bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Salvar saida"}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="font-bold text-slate-950">Materiais</h2>
            <label className="relative block w-full md:w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <span className="sr-only">Buscar material</span>
              <input
                value={buscaMateriais}
                onChange={(event) => setBuscaMateriais(event.target.value)}
                placeholder="Buscar por nome, unidade..."
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Material</th>
                  <th className="px-3 py-3">Quantidade</th>
                  <th className="px-3 py-3">Minimo</th>
                  <th className="px-3 py-3">Periodicidade</th>
                  <th className="px-3 py-3">Ultimo recebimento</th>
                  <th className="px-3 py-3">Proximo previsto</th>
                  <th className="px-3 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materiaisFiltrados.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={7}>
                      Nenhum material cadastrado.
                    </td>
                  </tr>
                ) : (
                  materiaisFiltrados.map((material) => (
                    <tr key={material.id}>
                      <td className="px-3 py-3 font-bold text-slate-900">
                        {material.nome}
                      </td>
                      <td className="px-3 py-3">
                        Quantidade: {numero(material.quantidade_atual)}{" "}
                        {material.unidade}
                      </td>
                      <td className="px-3 py-3">
                        {numero(material.estoque_minimo)}
                      </td>
                      <td className="px-3 py-3">
                        {periodicidadeLabels[
                          material.periodicidade as PeriodicidadeEstoque
                        ] || material.periodicidade}
                      </td>
                      <td className="px-3 py-3">
                        {formatDate(material.ultimo_recebimento)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDate(material.proximo_recebimento)}
                      </td>
                      <td className="px-3 py-3">
                        {podeConfigurar ? (
                          <button
                            type="button"
                            onClick={() => abrirEdicaoMaterial(material)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Editar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Somente gestor
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="font-bold text-slate-950">Ultimas movimentacoes</h2>
            <label className="relative block w-full md:w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <span className="sr-only">Buscar movimentacao</span>
              <input
                value={buscaMovimentos}
                onChange={(event) => setBuscaMovimentos(event.target.value)}
                placeholder="Buscar por material, motivo..."
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          <div className="space-y-2">
            {movimentosFiltrados.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                Nenhuma movimentacao registrada.
              </div>
            ) : (
              movimentosFiltrados.map((movimento) => (
                <div
                  key={movimento.id}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {nomesMateriais[movimento.material_id] || "Material"} -
                      {movimento.tipo === "ENTRADA" ? " entrada" : " saida"}
                    </p>
                    <p className="text-sm text-slate-500">
                      Quantidade: {numero(movimento.quantidade)}
                      {movimento.colaborador_id
                        ? ` | ${nomesColaboradores[movimento.colaborador_id]}`
                        : ""}
                      {movimento.motivo ? ` | ${movimento.motivo}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {movimento.criado_em
                      ? new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(movimento.criado_em))
                      : "-"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {materialEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Editar material
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {materialEmEdicao.nome}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMaterialEmEdicao(null)}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar edicao"
              >
                <XCircle size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2">
              <Input label="Nome do material" value={editNome} onChange={setEditNome} />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Unidade de medida
                </span>
                <select
                  value={editUnidade}
                  onChange={(event) => setEditUnidade(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {opcoesUnidade.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value="OUTRA">Outra unidade</option>
                </select>
              </label>
              {editUnidade === "OUTRA" && (
                <Input
                  label="Digite a nova unidade"
                  value={editUnidadePersonalizada}
                  onChange={setEditUnidadePersonalizada}
                  placeholder="Ex: Caixa, Rolo, Galão..."
                />
              )}
              <Input
                label="Estoque minimo"
                type="number"
                value={editEstoqueMinimo}
                onChange={setEditEstoqueMinimo}
              />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Periodicidade
                </span>
                <select
                  value={editPeriodicidade}
                  onChange={(event) =>
                    setEditPeriodicidade(event.target.value as PeriodicidadeEstoque)
                  }
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {periodicidades.map((item) => (
                    <option key={item} value={item}>
                      {periodicidadeLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Ultimo recebimento"
                type="date"
                value={editUltimoRecebimento}
                onChange={setEditUltimoRecebimento}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setMaterialEmEdicao(null)}
                disabled={salvando}
                className="h-10 rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicaoMaterial}
                disabled={salvando}
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ResumoCard({
  titulo,
  valor,
  detalhe,
  icon: Icon,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  icon: typeof Boxes;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{titulo}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{valor}</p>
          <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
        </div>
        <Icon size={22} className="text-slate-400" aria-hidden="true" />
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SelectMaterial({
  materiais,
  value,
  onChange,
}: {
  materiais: MaterialEstoque[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        Material
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">Escolha um material</option>
        {materiais.map((material) => (
          <option key={material.id} value={material.id}>
            {material.nome} - Quantidade: {numero(material.quantidade_atual)}{" "}
            {material.unidade}
          </option>
        ))}
      </select>
    </label>
  );
}

function MovimentoBox({
  titulo,
  icon: Icon,
  materiais,
  materialId,
  setMaterialId,
  quantidade,
  setQuantidade,
  observacao,
  setObservacao,
  onSalvar,
  disabled,
  buttonLabel,
}: {
  titulo: string;
  icon: typeof ArrowUpCircle;
  materiais: MaterialEstoque[];
  materialId: string;
  setMaterialId: (value: string) => void;
  quantidade: string;
  setQuantidade: (value: string) => void;
  observacao: string;
  setObservacao: (value: string) => void;
  onSalvar: () => void;
  disabled: boolean;
  buttonLabel: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={18} className="text-emerald-700" />
        <h2 className="font-bold text-slate-950">{titulo}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SelectMaterial
          materiais={materiais}
          value={materialId}
          onChange={setMaterialId}
        />
        <Input
          label="Quantidade"
          type="number"
          value={quantidade}
          onChange={setQuantidade}
        />
        <div className="md:col-span-2">
          <Input
            label="Observacao"
            value={observacao}
            onChange={setObservacao}
            placeholder="Ex: nota, fornecedor, setor..."
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onSalvar}
        disabled={disabled}
        className="mt-4 h-11 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {disabled ? "Salvando..." : buttonLabel}
      </button>
    </div>
  );
}
