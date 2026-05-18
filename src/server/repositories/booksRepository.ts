import type { SqliteConnection } from '../database/connection';
import { buildSearchText, buildSearchTextCondition } from '../search';

export interface BookInput {
  titulo: string;
  autor: string;
  editora: string;
  isbn: string;
  tags: string;
}

export interface BookInfo extends BookInput {
  id: number;
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

export interface LoanInput {
  livro_id: number;
  exemplar_id?: number;
  leitor_id: number;
  data_emprestimo: number;
  data_prazo: number;
}

export interface LoanRow {
  id: number;
  livro_id: number;
  exemplar_id: number;
  exemplar_codigo: string;
  leitor_id: number;
  data_emprestimo: string;
  data_prazo: string;
}

export interface PendingLoan {
  livro_id: number;
  titulo: string;
  exemplar_id: number;
  exemplar_codigo: string;
  data_emprestimo: string;
  data_prazo: string;
  leitor_id: number;
  leitor: string;
  turma: string;
}

export type LoanHistoryStatus = 'EMPRESTADO' | 'DEVOLVIDO';

export interface LoanHistoryInput {
  livro_id: number;
  leitor_id: number;
  livro_titulo: string;
  leitor_nome: string;
  leitor_turma: string;
  exemplar_id?: number | null;
  exemplar_codigo?: string | null;
  data_emprestimo: string | number;
  data_prazo: string | number;
  data_devolucao?: string | number | null;
  status: LoanHistoryStatus;
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
  status: LoanHistoryStatus;
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

export interface ListBooksOptions {
  search?: string;
  status?: number;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface ListLoanHistoryOptions {
  search?: string;
  status?: LoanHistoryStatus;
  bookId?: number;
  copyId?: number;
  limit?: number;
  offset?: number;
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

export interface BookLabelInfo extends BookCopyInfo {}

export interface ListResult<T> {
  rows: T[];
  hasMore: boolean;
}

const NORMALIZED_ISBN_SQL =
  "REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(isbn, '')), '-', ''), '.', ''), ' ', ''), '/', '')";
const nowInMilliseconds = "(CAST(strftime('%s','now') AS REAL) * 1000)";
const BOOK_INFO_SELECT = `
  id,
  titulo,
  autor,
  editora,
  tags,
  isbn,
  status,
  leitor_id,
  leitor_nome,
  leitor_turma,
  data_emprestimo,
  data_prazo,
  exemplar_id,
  exemplar_codigo,
  exemplar_numero,
  total_exemplares,
  exemplares_disponiveis,
  exemplares_emprestados,
  exemplares_atrasados
`;
const LOAN_HISTORY_SELECT = `
  id,
  livro_id,
  leitor_id,
  livro_titulo,
  leitor_nome,
  leitor_turma,
  exemplar_id,
  exemplar_codigo,
  data_emprestimo,
  data_prazo,
  data_devolucao,
  status,
  created_at
`;

function timestampAsMilliseconds(column: string): string {
  return `(CASE WHEN CAST(${column} AS REAL) < 10000000000 THEN CAST(${column} AS REAL) * 1000 ELSE CAST(${column} AS REAL) END)`;
}

function sortableTimestamp(column: string): string {
  return `(
    CASE
      WHEN ${column} IS NULL THEN 0
      WHEN ${column} GLOB '*[^0-9.]*' THEN CAST(strftime('%s', ${column}) AS REAL) * 1000
      WHEN CAST(${column} AS REAL) < 10000000000 THEN CAST(${column} AS REAL) * 1000
      ELSE CAST(${column} AS REAL)
    END
  )`;
}

export class BooksRepository {
  constructor(private readonly db: SqliteConnection) {}

  async list(options: ListBooksOptions = {}): Promise<ListResult<BookInfo>> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (typeof options.status === 'number') {
      if (options.status === 0) {
        where.push('exemplares_disponiveis > 0');
      } else if (options.status === 1) {
        where.push('exemplares_emprestados > 0');
      } else if (options.status === 2) {
        where.push('exemplares_atrasados > 0');
      }
    }

    if (options.tag?.trim()) {
      where.push("((',' || COALESCE(tags, '') || ',') LIKE ?)");
      params.push(`%,${options.tag.trim()},%`);
    }

    const searchCondition = buildSearchTextCondition('search_text', options.search);
    if (searchCondition) {
      where.push(`(${searchCondition.sql})`);
      params.push(...searchCondition.params);
    }

    const limit = options.limit;
    const offset = options.offset ?? 0;
    const effectiveLimit = typeof limit === 'number' ? limit + 1 : undefined;

    let sql = `
      SELECT ${BOOK_INFO_SELECT}
      FROM livros_infos
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY titulo COLLATE NOCASE ASC, id ASC
    `;

    if (typeof effectiveLimit === 'number') {
      sql += ' LIMIT ? OFFSET ?';
      params.push(effectiveLimit, offset);
    }

    const rows = await this.db.all<BookInfo>(sql, params);
    const hasMore = typeof limit === 'number' && rows.length > limit;

    return {
      rows: hasMore && typeof limit === 'number' ? rows.slice(0, limit) : rows,
      hasMore,
    };
  }

  getById(id: number): Promise<BookInfo | undefined> {
    return this.db.get<BookInfo>(`SELECT ${BOOK_INFO_SELECT} FROM livros_infos WHERE id = ?`, [id]);
  }

  findByNormalizedIsbn(isbn: string): Promise<BookInfo | undefined> {
    return this.db.get<BookInfo>(`SELECT ${BOOK_INFO_SELECT} FROM livros_infos WHERE ${NORMALIZED_ISBN_SQL} = ? LIMIT 1`, [
      isbn,
    ]);
  }

  async create(input: BookInput): Promise<number> {
    const result = await this.db.run(
      'INSERT INTO livros (titulo, autor, editora, isbn, tags, search_text) VALUES (?, ?, ?, ?, ?, ?)',
      [input.titulo, input.autor, input.editora, input.isbn, input.tags, buildBookSearchText(input)],
    );

    await this.createCopy(result.lastID, 1);

    return result.lastID;
  }

  async update(id: number, input: BookInput): Promise<boolean> {
    const result = await this.db.run(
      'UPDATE livros SET titulo = ?, autor = ?, editora = ?, isbn = ?, tags = ?, search_text = ? WHERE id = ?',
      [input.titulo, input.autor, input.editora, input.isbn, input.tags, buildBookSearchText(input), id],
    );

    return result.changes > 0;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.db.run('DELETE FROM livros WHERE id = ?', [id]);
    return result.changes > 0;
  }

  listCopies(bookId: number): Promise<BookCopyInfo[]> {
    return this.db.all<BookCopyInfo>(
      `SELECT
        livros_exemplares.id,
        livros_exemplares.livro_id,
        livros_exemplares.numero,
        livros_exemplares.codigo,
        livros_exemplares.observacao,
        livros.titulo,
        livros.autor,
        livros.editora,
        livros.isbn,
        livros.tags,
        emprestimos.id AS emprestimo_id,
        emprestimos.leitor_id,
        leitores.nome AS leitor_nome,
        leitores.turma AS leitor_turma,
        emprestimos.data_emprestimo,
        emprestimos.data_prazo
      FROM livros_exemplares
      JOIN livros ON livros.id = livros_exemplares.livro_id
      LEFT JOIN emprestimos ON emprestimos.exemplar_id = livros_exemplares.id
      LEFT JOIN leitores ON leitores.id = emprestimos.leitor_id
      WHERE livros_exemplares.livro_id = ?
      ORDER BY livros_exemplares.numero ASC`,
      [bookId],
    );
  }

  listCopiesForBooks(bookIds: number[]): Promise<BookCopyInfo[]> {
    if (bookIds.length === 0) {
      return Promise.resolve([]);
    }

    const placeholders = bookIds.map(() => '?').join(', ');
    return this.db.all<BookCopyInfo>(
      `SELECT
        livros_exemplares.id,
        livros_exemplares.livro_id,
        livros_exemplares.numero,
        livros_exemplares.codigo,
        livros_exemplares.observacao,
        livros.titulo,
        livros.autor,
        livros.editora,
        livros.isbn,
        livros.tags,
        emprestimos.id AS emprestimo_id,
        emprestimos.leitor_id,
        leitores.nome AS leitor_nome,
        leitores.turma AS leitor_turma,
        emprestimos.data_emprestimo,
        emprestimos.data_prazo
      FROM livros_exemplares
      JOIN livros ON livros.id = livros_exemplares.livro_id
      LEFT JOIN emprestimos ON emprestimos.exemplar_id = livros_exemplares.id
      LEFT JOIN leitores ON leitores.id = emprestimos.leitor_id
      WHERE livros_exemplares.livro_id IN (${placeholders})
      ORDER BY livros.titulo COLLATE NOCASE ASC, livros_exemplares.numero ASC`,
      bookIds,
    );
  }

  listCopiesByIds(copyIds: number[]): Promise<BookLabelInfo[]> {
    if (copyIds.length === 0) {
      return Promise.resolve([]);
    }

    const placeholders = copyIds.map(() => '?').join(', ');
    return this.db.all<BookLabelInfo>(
      `SELECT
        livros_exemplares.id,
        livros_exemplares.livro_id,
        livros_exemplares.numero,
        livros_exemplares.codigo,
        livros_exemplares.observacao,
        livros.titulo,
        livros.autor,
        livros.editora,
        livros.isbn,
        livros.tags,
        emprestimos.id AS emprestimo_id,
        emprestimos.leitor_id,
        leitores.nome AS leitor_nome,
        leitores.turma AS leitor_turma,
        emprestimos.data_emprestimo,
        emprestimos.data_prazo
      FROM livros_exemplares
      JOIN livros ON livros.id = livros_exemplares.livro_id
      LEFT JOIN emprestimos ON emprestimos.exemplar_id = livros_exemplares.id
      LEFT JOIN leitores ON leitores.id = emprestimos.leitor_id
      WHERE livros_exemplares.id IN (${placeholders})
      ORDER BY livros.titulo COLLATE NOCASE ASC, livros_exemplares.numero ASC`,
      copyIds,
    );
  }

  getCopyById(copyId: number): Promise<BookCopyInfo | undefined> {
    return this.db.get<BookCopyInfo>(
      `SELECT
        livros_exemplares.id,
        livros_exemplares.livro_id,
        livros_exemplares.numero,
        livros_exemplares.codigo,
        livros_exemplares.observacao,
        livros.titulo,
        livros.autor,
        livros.editora,
        livros.isbn,
        livros.tags,
        emprestimos.id AS emprestimo_id,
        emprestimos.leitor_id,
        leitores.nome AS leitor_nome,
        leitores.turma AS leitor_turma,
        emprestimos.data_emprestimo,
        emprestimos.data_prazo
      FROM livros_exemplares
      JOIN livros ON livros.id = livros_exemplares.livro_id
      LEFT JOIN emprestimos ON emprestimos.exemplar_id = livros_exemplares.id
      LEFT JOIN leitores ON leitores.id = emprestimos.leitor_id
      WHERE livros_exemplares.id = ?`,
      [copyId],
    );
  }

  listCopyMovements(copyId: number): Promise<CopyMovementInfo[]> {
    return this.db.all<CopyMovementInfo>(
      `SELECT *
      FROM (
        SELECT
          'copy-' || livros_exemplares.id AS id,
          'CADASTRADO' AS tipo,
          livros_exemplares.created_at AS data,
          livros.id AS livro_id,
          livros.titulo AS livro_titulo,
          livros_exemplares.id AS exemplar_id,
          livros_exemplares.codigo AS exemplar_codigo,
          NULL AS leitor_id,
          NULL AS leitor_nome,
          NULL AS leitor_turma,
          NULL AS data_prazo
        FROM livros_exemplares
        JOIN livros ON livros.id = livros_exemplares.livro_id
        WHERE livros_exemplares.id = ?

        UNION ALL

        SELECT
          'loan-' || emprestimos_historico.id AS id,
          'EMPRESTADO' AS tipo,
          emprestimos_historico.data_emprestimo AS data,
          emprestimos_historico.livro_id,
          emprestimos_historico.livro_titulo,
          emprestimos_historico.exemplar_id,
          COALESCE(emprestimos_historico.exemplar_codigo, livros_exemplares.codigo) AS exemplar_codigo,
          emprestimos_historico.leitor_id,
          emprestimos_historico.leitor_nome,
          emprestimos_historico.leitor_turma,
          emprestimos_historico.data_prazo
        FROM emprestimos_historico
        LEFT JOIN livros_exemplares ON livros_exemplares.id = emprestimos_historico.exemplar_id
        WHERE emprestimos_historico.exemplar_id = ?

        UNION ALL

        SELECT
          'return-' || emprestimos_historico.id AS id,
          'DEVOLVIDO' AS tipo,
          emprestimos_historico.data_devolucao AS data,
          emprestimos_historico.livro_id,
          emprestimos_historico.livro_titulo,
          emprestimos_historico.exemplar_id,
          COALESCE(emprestimos_historico.exemplar_codigo, livros_exemplares.codigo) AS exemplar_codigo,
          emprestimos_historico.leitor_id,
          emprestimos_historico.leitor_nome,
          emprestimos_historico.leitor_turma,
          emprestimos_historico.data_prazo
        FROM emprestimos_historico
        LEFT JOIN livros_exemplares ON livros_exemplares.id = emprestimos_historico.exemplar_id
        WHERE emprestimos_historico.exemplar_id = ? AND emprestimos_historico.data_devolucao IS NOT NULL
      )
      ORDER BY ${sortableTimestamp('data')} DESC, id DESC`,
      [copyId, copyId, copyId],
    );
  }

  getFirstAvailableCopy(bookId: number): Promise<BookCopyInfo | undefined> {
    return this.db.get<BookCopyInfo>(
      `SELECT
        livros_exemplares.id,
        livros_exemplares.livro_id,
        livros_exemplares.numero,
        livros_exemplares.codigo,
        livros_exemplares.observacao,
        livros.titulo,
        livros.autor,
        livros.editora,
        livros.isbn,
        livros.tags,
        NULL AS emprestimo_id,
        NULL AS leitor_id,
        NULL AS leitor_nome,
        NULL AS leitor_turma,
        NULL AS data_emprestimo,
        NULL AS data_prazo
      FROM livros_exemplares
      JOIN livros ON livros.id = livros_exemplares.livro_id
      LEFT JOIN emprestimos ON emprestimos.exemplar_id = livros_exemplares.id
      WHERE livros_exemplares.livro_id = ? AND emprestimos.id IS NULL
      ORDER BY livros_exemplares.numero ASC
      LIMIT 1`,
      [bookId],
    );
  }

  async createCopy(bookId: number, number: number): Promise<number> {
    const result = await this.db.run(
      'INSERT INTO livros_exemplares (livro_id, numero, codigo) VALUES (?, ?, ?)',
      [bookId, number, formatCopyCode(bookId, number)],
    );

    return result.lastID;
  }

  async deleteAvailableCopy(copyId: number): Promise<boolean> {
    const result = await this.db.run(
      `DELETE FROM livros_exemplares
      WHERE id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM emprestimos
          WHERE emprestimos.exemplar_id = livros_exemplares.id
        )`,
      [copyId],
    );

    return result.changes > 0;
  }

  async returnLoan(bookId: number): Promise<boolean> {
    const result = await this.db.run(
      `DELETE FROM emprestimos
      WHERE id = (
        SELECT id
        FROM emprestimos
        WHERE livro_id = ?
        ORDER BY
          CASE WHEN ${timestampAsMilliseconds('data_prazo')} < ${nowInMilliseconds} THEN 0 ELSE 1 END,
          CAST(data_prazo AS REAL) ASC,
          id ASC
        LIMIT 1
      )`,
      [bookId],
    );
    return result.changes > 0;
  }

  getLoanByBookId(bookId: number): Promise<LoanRow | undefined> {
    return this.db.get<LoanRow>(
      `SELECT emprestimos.*, livros_exemplares.codigo AS exemplar_codigo
      FROM emprestimos
      JOIN livros_exemplares ON livros_exemplares.id = emprestimos.exemplar_id
      WHERE emprestimos.livro_id = ?
      ORDER BY
        CASE WHEN ${timestampAsMilliseconds('emprestimos.data_prazo')} < ${nowInMilliseconds} THEN 0 ELSE 1 END,
        CAST(emprestimos.data_prazo AS REAL) ASC,
        emprestimos.id ASC
      LIMIT 1`,
      [bookId],
    );
  }

  getLoanByCopyId(copyId: number): Promise<LoanRow | undefined> {
    return this.db.get<LoanRow>(
      `SELECT emprestimos.*, livros_exemplares.codigo AS exemplar_codigo
      FROM emprestimos
      JOIN livros_exemplares ON livros_exemplares.id = emprestimos.exemplar_id
      WHERE emprestimos.exemplar_id = ?`,
      [copyId],
    );
  }

  async returnLoanByCopyId(copyId: number): Promise<boolean> {
    const result = await this.db.run('DELETE FROM emprestimos WHERE exemplar_id = ?', [copyId]);
    return result.changes > 0;
  }

  async countLoansByUserId(userId: number): Promise<number> {
    const row = await this.db.get<{ total: number }>(
      'SELECT COUNT(*) AS total FROM emprestimos WHERE leitor_id = ?',
      [userId],
    );

    return row?.total ?? 0;
  }

  async createLoan(input: LoanInput): Promise<void> {
    await this.db.run(
      'INSERT INTO emprestimos (livro_id, exemplar_id, leitor_id, data_emprestimo, data_prazo) VALUES (?, ?, ?, ?, ?)',
      [
        input.livro_id,
        input.exemplar_id,
        input.leitor_id,
        String(input.data_emprestimo),
        String(input.data_prazo),
      ],
    );
  }

  async createLoanHistory(input: LoanHistoryInput): Promise<void> {
    await this.db.run(
      `INSERT INTO emprestimos_historico (
        livro_id,
        leitor_id,
        livro_titulo,
        leitor_nome,
        leitor_turma,
        exemplar_id,
        exemplar_codigo,
        data_emprestimo,
        data_prazo,
        data_devolucao,
        status,
        search_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.livro_id,
        input.leitor_id,
        input.livro_titulo,
        input.leitor_nome,
        input.leitor_turma,
        input.exemplar_id ?? null,
        input.exemplar_codigo ?? null,
        String(input.data_emprestimo),
        String(input.data_prazo),
        input.data_devolucao == null ? null : String(input.data_devolucao),
        input.status,
        buildLoanHistorySearchText(input),
      ],
    );
  }

  async finishLoanHistory(input: {
    livro_id: number;
    exemplar_id?: number;
    data_emprestimo: string | number;
    data_devolucao: string | number;
  }): Promise<boolean> {
    const result = await this.db.run(
      `UPDATE emprestimos_historico
      SET data_devolucao = ?, status = 'DEVOLVIDO'
      WHERE id = (
        SELECT id
        FROM emprestimos_historico
        WHERE livro_id = ?
          AND data_emprestimo = ?
          AND data_devolucao IS NULL
          AND (? IS NULL OR exemplar_id = ?)
        ORDER BY id DESC
        LIMIT 1
      )`,
      [
        String(input.data_devolucao),
        input.livro_id,
        String(input.data_emprestimo),
        input.exemplar_id ?? null,
        input.exemplar_id ?? null,
      ],
    );

    return result.changes > 0;
  }

  async listLoanHistory(options: ListLoanHistoryOptions = {}): Promise<ListResult<LoanHistoryInfo>> {
    const params: unknown[] = [];
    const where: string[] = [];

    if (options.status) {
      where.push('status = ?');
      params.push(options.status);
    }

    if (options.bookId) {
      where.push('livro_id = ?');
      params.push(options.bookId);
    }

    if (options.copyId) {
      where.push('exemplar_id = ?');
      params.push(options.copyId);
    }

    const searchCondition = buildSearchTextCondition('search_text', options.search);
    if (searchCondition) {
      where.push(`(${searchCondition.sql})`);
      params.push(...searchCondition.params);
    }

    const limit = options.limit;
    const offset = options.offset ?? 0;
    const effectiveLimit = typeof limit === 'number' ? limit + 1 : undefined;

    let sql = `
      SELECT ${LOAN_HISTORY_SELECT}
      FROM emprestimos_historico
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CAST(COALESCE(data_devolucao, data_emprestimo) AS REAL) DESC, id DESC
    `;

    if (typeof effectiveLimit === 'number') {
      sql += ' LIMIT ? OFFSET ?';
      params.push(effectiveLimit, offset);
    }

    const rows = await this.db.all<LoanHistoryInfo>(sql, params);
    const hasMore = typeof limit === 'number' && rows.length > limit;

    return {
      rows: hasMore && typeof limit === 'number' ? rows.slice(0, limit) : rows,
      hasMore,
    };
  }

  listPending(): Promise<PendingLoan[]> {
    return this.db.all<PendingLoan>('SELECT * FROM pendencias ORDER BY data_prazo ASC');
  }

  exportRawBooks(): Promise<BookInput[]> {
    return this.db.all<BookInput>('SELECT titulo, autor, editora, isbn, tags FROM livros ORDER BY titulo COLLATE NOCASE ASC');
  }

  exportLoanHistory(): Promise<LoanHistoryInfo[]> {
    return this.db.all<LoanHistoryInfo>(
      `SELECT ${LOAN_HISTORY_SELECT}
      FROM emprestimos_historico
      ORDER BY CAST(COALESCE(data_devolucao, data_emprestimo) AS REAL) DESC, id DESC`,
    );
  }
}

function formatCopyCode(bookId: number, number: number): string {
  return `B${String(bookId).padStart(4, '0')}-E${String(number).padStart(2, '0')}`;
}

function buildBookSearchText(input: BookInput): string {
  return buildSearchText([input.titulo, input.autor, input.editora, input.isbn, input.tags]);
}

function buildLoanHistorySearchText(input: LoanHistoryInput): string {
  return buildSearchText([
    input.livro_titulo,
    input.leitor_nome,
    input.leitor_turma,
    input.exemplar_codigo,
  ]);
}
