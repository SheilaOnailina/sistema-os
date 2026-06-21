import { createClient } from "@supabase/supabase-js";

export type PerfilColaborador = "GESTOR" | "TECNICO";
export type PrioridadeOS = "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";

export type Colaborador = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  perfil: PerfilColaborador;
  ativo: boolean;
  precisa_trocar_senha: boolean;
  criado_em?: string;
};

export type OrdemServico = {
  id: string;
  numero_os: string | number;
  local: string;
  descricao: string;
  status: "ABERTA" | "EM_EXECUCAO" | "CONCLUIDA" | string;
  prioridade?: PrioridadeOS | string | null;
  solicitante?: string | null;
  colaborador_id?: string | null;
  data_abertura?: string | null;
  data_inicio?: string | null;
  data_conclusao?: string | null;
  relato_tecnico?: string | null;
  insumos_utilizados?: string | null;
  whatsapp_enviado_em?: string | null;
};

type Database = {
  public: {
    Tables: {
      ordens_servico: {
        Row: OrdemServico;
        Insert: Partial<OrdemServico>;
        Update: Partial<OrdemServico>;
        Relationships: [];
      };
      colaboradores: {
        Row: Colaborador;
        Insert: Partial<Colaborador> & Pick<Colaborador, "nome" | "cpf">;
        Update: Partial<Colaborador>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      login_colaborador: {
        Args: {
          cpf_input: string;
          senha_input: string;
        };
        Returns: Pick<
          Colaborador,
          | "id"
          | "nome"
          | "cpf"
          | "telefone"
          | "perfil"
          | "ativo"
          | "precisa_trocar_senha"
        >[];
      };
      alterar_senha_colaborador: {
        Args: {
          colaborador_id_input: string;
          senha_atual_input: string;
          nova_senha_input: string;
        };
        Returns: boolean;
      };
      cadastrar_colaborador: {
        Args: {
          nome_input: string;
          cpf_input: string;
          telefone_input: string | null;
          perfil_input: PerfilColaborador;
        };
        Returns: Colaborador[];
      };
      resetar_senha_colaborador: {
        Args: {
          colaborador_id_input: string;
        };
        Returns: boolean;
      };
      criar_ordem_servico: {
        Args: {
          solicitante_input: string;
          local_input: string;
          descricao_input: string;
          colaborador_id_input: string;
          prioridade_input?: PrioridadeOS | string;
        };
        Returns: OrdemServico[];
      };
      registrar_demanda_solicitada: {
        Args: {
          colaborador_id_input: string;
          solicitante_input: string;
          local_input: string;
          descricao_input: string;
        };
        Returns: OrdemServico;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("As variaveis do Supabase nao foram configuradas.");
    }

    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}
