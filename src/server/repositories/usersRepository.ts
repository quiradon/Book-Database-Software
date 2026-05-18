import type { SqliteConnection } from '../database/connection';
import { containsNormalizedSearch, normalizeSearchTerm } from '../search';
import type { ListResult } from './booksRepository';

export interface UserInput {
  nome: string;
  contato: string;
  turma: string;
}

export interface UserInfo extends UserInput {
  id: number;
  emprestimos: number;
  livros_emprestados_ids: string;
  livros_emprestados_nomes: string;
}

export interface ListUsersOptions {
  search?: string;
  turma?: string;
  limit?: number;
  offset?: number;
}

const USER_SEARCH_COLUMNS = ['nome', 'turma', 'contato'];

export class UsersRepository {
  constructor(private readonly db: SqliteConnection) {}

  async list(options: ListUsersOptions = {}): Promise<ListResult<UserInfo>> {
    const params: unknown[] = [];
    const where: string[] = [];
    const search = options.search?.trim() ? normalizeSearchTerm(options.search) : undefined;

    if (options.turma?.trim()) {
      where.push('turma = ?');
      params.push(options.turma.trim());
    }

    const limit = options.limit;
    const offset = search ? 0 : options.offset ?? 0;
    const effectiveLimit = !search && typeof limit === 'number' ? limit + 1 : undefined;

    let sql = `
      SELECT *
      FROM leitores_infos
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY nome COLLATE NOCASE ASC, id ASC
    `;

    if (typeof effectiveLimit === 'number') {
      sql += ' LIMIT ? OFFSET ?';
      params.push(effectiveLimit, offset);
    }

    const rows = await this.db.all<UserInfo>(sql, params);
    const filteredRows = search
      ? rows.filter((row) =>
          containsNormalizedSearch(
            USER_SEARCH_COLUMNS.map((column) => row[column as keyof UserInfo]),
            search,
          ),
        )
      : rows;

    if (search && typeof limit === 'number') {
      const pageOffset = options.offset ?? 0;
      const pagedRows = filteredRows.slice(pageOffset, pageOffset + limit);

      return {
        rows: pagedRows,
        hasMore: filteredRows.length > pageOffset + limit,
      };
    }

    const hasMore = typeof limit === 'number' && filteredRows.length > limit;

    return {
      rows: hasMore && typeof limit === 'number' ? filteredRows.slice(0, limit) : filteredRows,
      hasMore,
    };
  }

  getById(id: number): Promise<UserInfo | undefined> {
    return this.db.get<UserInfo>('SELECT * FROM leitores_infos WHERE id = ?', [id]);
  }

  findByContact(contact: string): Promise<UserInfo | undefined> {
    return this.db.get<UserInfo>('SELECT * FROM leitores_infos WHERE contato = ? COLLATE NOCASE LIMIT 1', [
      contact,
    ]);
  }

  async create(input: UserInput): Promise<number> {
    const result = await this.db.run('INSERT INTO leitores (nome, contato, turma) VALUES (?, ?, ?)', [
      input.nome,
      input.contato,
      input.turma,
    ]);

    return result.lastID;
  }

  async update(id: number, input: UserInput): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE leitores SET nome = ?, contato = ?, turma = ? WHERE id = ?',
      [input.nome, input.contato, input.turma, id],
    );

    return result.changes > 0;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.db.run('DELETE FROM leitores WHERE id = ?', [id]);
    return result.changes > 0;
  }

  exportRawUsers(): Promise<UserInput[]> {
    return this.db.all<UserInput>('SELECT nome, contato, turma FROM leitores ORDER BY nome COLLATE NOCASE ASC');
  }
}
