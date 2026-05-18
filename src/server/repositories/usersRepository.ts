import type { SqliteConnection } from '../database/connection';
import { buildSearchText, buildSearchTextCondition } from '../search';
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

export class UsersRepository {
  constructor(private readonly db: SqliteConnection) {}

  async list(options: ListUsersOptions = {}): Promise<ListResult<UserInfo>> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (options.turma?.trim()) {
      where.push('leitores_infos.turma = ?');
      params.push(options.turma.trim());
    }

    const searchCondition = buildSearchTextCondition('leitores.search_text', options.search);
    if (searchCondition) {
      where.push(`(${searchCondition.sql})`);
      params.push(...searchCondition.params);
    }

    const limit = options.limit;
    const offset = options.offset ?? 0;
    const effectiveLimit = typeof limit === 'number' ? limit + 1 : undefined;

    let sql = `
      SELECT leitores_infos.*
      FROM leitores_infos
      JOIN leitores ON leitores.id = leitores_infos.id
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY leitores_infos.nome COLLATE NOCASE ASC, leitores_infos.id ASC
    `;

    if (typeof effectiveLimit === 'number') {
      sql += ' LIMIT ? OFFSET ?';
      params.push(effectiveLimit, offset);
    }

    const rows = await this.db.all<UserInfo>(sql, params);
    const hasMore = typeof limit === 'number' && rows.length > limit;

    return {
      rows: hasMore && typeof limit === 'number' ? rows.slice(0, limit) : rows,
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
    const result = await this.db.run('INSERT INTO leitores (nome, contato, turma, search_text) VALUES (?, ?, ?, ?)', [
      input.nome,
      input.contato,
      input.turma,
      buildUserSearchText(input),
    ]);

    return result.lastID;
  }

  async update(id: number, input: UserInput): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE leitores SET nome = ?, contato = ?, turma = ?, search_text = ? WHERE id = ?',
      [input.nome, input.contato, input.turma, buildUserSearchText(input), id],
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

function buildUserSearchText(input: UserInput): string {
  return buildSearchText([input.nome, input.turma, input.contato]);
}
