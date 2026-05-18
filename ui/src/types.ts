export interface BookInfo {
  id: number;
  titulo: string;
  autor: string;
  editora: string;
  isbn: string;
  tags: string;
  status: number;
  leitor_id: number | null;
  leitor_nome: string | null;
  leitor_turma: string | null;
  data_emprestimo: string | null;
  data_prazo: string | null;
  exemplar_id: number | null;
  exemplar_codigo: string | null;
  exemplar_numero: number | null;
  total_exemplares: number;
  exemplares_disponiveis: number;
  exemplares_emprestados: number;
  exemplares_atrasados: number;
}

export interface BookCopyInfo {
  id: number;
  livro_id: number;
  numero: number;
  codigo: string;
  observacao: string | null;
  titulo: string;
  autor: string;
  editora: string;
  isbn: string;
  tags: string;
  emprestimo_id: number | null;
  leitor_id: number | null;
  leitor_nome: string | null;
  leitor_turma: string | null;
  data_emprestimo: string | null;
  data_prazo: string | null;
}

export interface UserInfo {
  id: number;
  nome: string;
  contato: string;
  turma: string;
  emprestimos: number;
  livros_emprestados_ids: string;
  livros_emprestados_nomes: string;
}

export interface LoanHistoryInfo {
  id: number;
  livro_id: number | null;
  leitor_id: number | null;
  livro_titulo: string;
  leitor_nome: string;
  leitor_turma: string;
  exemplar_id: number | null;
  exemplar_codigo: string | null;
  data_emprestimo: string;
  data_prazo: string;
  data_devolucao: string | null;
  status: 'EMPRESTADO' | 'DEVOLVIDO';
  created_at: string;
}

export type CopyMovementType = 'CADASTRADO' | 'EMPRESTADO' | 'DEVOLVIDO';

export interface CopyMovementInfo {
  id: string;
  tipo: CopyMovementType;
  data: string;
  livro_id: number;
  livro_titulo: string;
  exemplar_id: number;
  exemplar_codigo: string;
  leitor_id: number | null;
  leitor_nome: string | null;
  leitor_turma: string | null;
  data_prazo: string | null;
}

export interface AppConfig {
  library_name: string;
  logo_data_url: string;
  max_per_user: number;
  tags: string[];
  turmas: Array<{ nome: string; value: string }>;
}

export interface StatsRow {
  total_usuarios: number;
  usuarios_com_emprestimos: number;
  total_livros: number;
  livros_emprestados: number;
  livros_atrasados: number;
}
