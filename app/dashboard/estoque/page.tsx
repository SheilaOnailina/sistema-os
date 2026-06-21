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
  Loader2,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import {
  getSupabase,
  type Colaborador,
  type MaterialEstoque,
  type MovimentacaoEstoque,
  type PeriodicidadeEstoque,
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
  const [materiaisResult, movimentosResult, colaboradoresResult] =
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
    ]);

  if (materiaisResult.error) {
    if (isTabelaAusenteError(materiaisResult.error)) {
      return { materiais: [], movimentos: [], colaboradores: [] };
    }
    throw materiaisResult.error;
  }

  if (movimentosResult.error && !isTabelaAusenteError(movimentosResult.error)) {
    throw movimentosResult.error;
  }

  if (colaboradoresResult.error) throw colaboradoresResult.error;

  return {
    materiais: (materiaisResult.data ?? []) as MaterialEstoque[],
    movimentos: (movimentosResult.data ?? []) as MovimentacaoEstoque[],
    colaboradores: (colaboradoresResult.data ?? []) as Colaborador[],
  };
}

export default function EstoquePage() {
  const router = useRouter();
  const [usuario] = useState<Colaborador | null>(getSessaoInicial);
  const [materiais, setMateriais] = useState<MaterialEstoque[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentacaoEstoque[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("unidade");
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

  async function atualizarDados() {
    try {
      setCarregando(true);
      const dados = await carregarEstoque();
      setMateriais(dados.materiais);
      setMovimentos(dados.movimentos);
      setColaboradores(dados.colaboradores);
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

    if (usuario.perfil !== "GESTOR") {
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
  }, [router, usuario]);

  async function cadastrarMaterial() {
    if (!nome.trim()) {
      setErro("Informe o nome do material.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = getSupabase();
      const { error } = await supabase.rpc("cadastrar_material_estoque", {
        nome_input: nome,
        unidade_input: unidade,
        estoque_minimo_input: Number(estoqueMinimo || 0),
        periodicidade_input: periodicidade,
        ultimo_recebimento_input: ultimoRecebimento || null,
      });

      if (error) throw error;

      setNome("");
      setUnidade("unidade");
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

        <section className="grid gap-4 md:grid-cols-3">
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
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PlusCircle size={18} className="text-emerald-700" />
              <h2 className="font-bold text-slate-950">Cadastrar material</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome do material" value={nome} onChange={setNome} />
              <Input label="Unidade" value={unidade} onChange={setUnidade} />
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

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-slate-950">Materiais</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Material</th>
                  <th className="px-3 py-3">Saldo</th>
                  <th className="px-3 py-3">Minimo</th>
                  <th className="px-3 py-3">Periodicidade</th>
                  <th className="px-3 py-3">Ultimo recebimento</th>
                  <th className="px-3 py-3">Proximo previsto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materiais.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={6}>
                      Nenhum material cadastrado.
                    </td>
                  </tr>
                ) : (
                  materiais.map((material) => (
                    <tr key={material.id}>
                      <td className="px-3 py-3 font-bold text-slate-900">
                        {material.nome}
                      </td>
                      <td className="px-3 py-3">
                        {numero(material.quantidade_atual)} {material.unidade}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-slate-950">
            Ultimas movimentacoes
          </h2>
          <div className="space-y-2">
            {movimentos.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                Nenhuma movimentacao registrada.
              </div>
            ) : (
              movimentos.map((movimento) => (
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
                      {numero(movimento.quantidade)} unidade(s)
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
            {material.nome} ({numero(material.quantidade_atual)}{" "}
            {material.unidade})
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
