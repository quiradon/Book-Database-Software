import type { SqliteConnection } from '../database/connection';

export interface StatsRow {
  total_usuarios: number;
  usuarios_com_emprestimos: number;
  total_livros: number;
  livros_emprestados: number;
  livros_atrasados: number;
}

export class StatsRepository {
  constructor(private readonly db: SqliteConnection) {}

  async get(): Promise<StatsRow> {
    const row = await this.db.get<StatsRow>('SELECT * FROM estatisticas LIMIT 1');

    return (
      row ?? {
        total_usuarios: 0,
        usuarios_com_emprestimos: 0,
        total_livros: 0,
        livros_emprestados: 0,
        livros_atrasados: 0,
      }
    );
  }
}
