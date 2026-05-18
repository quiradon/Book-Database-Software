import type { SqliteConnection } from './connection';
import { buildSearchText } from '../search';

interface Migration {
  id: number;
  name: string;
  up: (db: SqliteConnection) => Promise<void>;
}

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

const nowInMilliseconds = "(CAST(strftime('%s','now') AS REAL) * 1000)";

const createViewsSql = `
  DROP VIEW IF EXISTS leitores_infos;
  DROP VIEW IF EXISTS livros_infos;
  DROP VIEW IF EXISTS pendencias;
  DROP VIEW IF EXISTS estatisticas;

  CREATE VIEW leitores_infos AS
    SELECT
      leitores.id,
      leitores.nome,
      leitores.turma,
      leitores.contato,
      COUNT(emprestimos.data_emprestimo) AS emprestimos,
      IFNULL(GROUP_CONCAT(emprestimos.livro_id), '') AS livros_emprestados_ids,
      IFNULL(GROUP_CONCAT(livros.titulo), '') AS livros_emprestados_nomes
    FROM leitores
    LEFT JOIN emprestimos ON leitores.id = emprestimos.leitor_id
    LEFT JOIN livros ON emprestimos.livro_id = livros.id
    GROUP BY leitores.id;

  CREATE VIEW livros_infos AS
    SELECT
      livros.*,
      CASE
        WHEN emprestimos.data_emprestimo IS NULL THEN 0
        WHEN ${timestampAsMilliseconds('emprestimos.data_prazo')} < ${nowInMilliseconds} THEN 2
        ELSE 1
      END AS status,
      emprestimos.leitor_id,
      leitores.nome AS leitor_nome,
      leitores.turma AS leitor_turma,
      emprestimos.data_emprestimo,
      emprestimos.data_prazo
    FROM livros
    LEFT JOIN emprestimos ON livros.id = emprestimos.livro_id
    LEFT JOIN leitores ON emprestimos.leitor_id = leitores.id;

  CREATE VIEW pendencias AS
    SELECT
      livros.id AS livro_id,
      livros.titulo AS titulo,
      emprestimos.data_emprestimo,
      emprestimos.data_prazo,
      leitores.id AS leitor_id,
      leitores.nome AS leitor,
      leitores.turma AS turma
    FROM livros
    JOIN emprestimos ON livros.id = emprestimos.livro_id
    JOIN leitores ON emprestimos.leitor_id = leitores.id
    WHERE ${timestampAsMilliseconds('emprestimos.data_prazo')} < ${nowInMilliseconds};

  CREATE VIEW estatisticas AS
    SELECT
      (SELECT COUNT(*) FROM leitores) AS total_usuarios,
      (SELECT COUNT(DISTINCT leitor_id) FROM emprestimos) AS usuarios_com_emprestimos,
      (SELECT COUNT(*) FROM livros) AS total_livros,
      (SELECT COUNT(*) FROM emprestimos WHERE ${timestampAsMilliseconds('data_prazo')} >= ${nowInMilliseconds}) AS livros_emprestados,
      (SELECT COUNT(*) FROM emprestimos WHERE ${timestampAsMilliseconds('data_prazo')} < ${nowInMilliseconds}) AS livros_atrasados;
`;

const createCopyAwareViewsSql = `
  DROP VIEW IF EXISTS leitores_infos;
  DROP VIEW IF EXISTS livros_infos;
  DROP VIEW IF EXISTS pendencias;
  DROP VIEW IF EXISTS estatisticas;

  CREATE VIEW leitores_infos AS
    SELECT
      leitores.id,
      leitores.nome,
      leitores.turma,
      leitores.contato,
      COUNT(emprestimos.id) AS emprestimos,
      IFNULL(GROUP_CONCAT(emprestimos.livro_id), '') AS livros_emprestados_ids,
      IFNULL(GROUP_CONCAT(livros.titulo || ' (' || livros_exemplares.codigo || ')'), '') AS livros_emprestados_nomes
    FROM leitores
    LEFT JOIN emprestimos ON leitores.id = emprestimos.leitor_id
    LEFT JOIN livros ON emprestimos.livro_id = livros.id
    LEFT JOIN livros_exemplares ON emprestimos.exemplar_id = livros_exemplares.id
    GROUP BY leitores.id;

  CREATE VIEW livros_infos AS
    SELECT
      livros.*,
      CASE
        WHEN IFNULL(exemplar_stats.exemplares_atrasados, 0) > 0 THEN 2
        WHEN IFNULL(exemplar_stats.exemplares_emprestados, 0) > 0 THEN 1
        ELSE 0
      END AS status,
      emprestimos.leitor_id,
      leitores.nome AS leitor_nome,
      leitores.turma AS leitor_turma,
      emprestimos.data_emprestimo,
      emprestimos.data_prazo,
      emprestimos.exemplar_id,
      livros_exemplares.codigo AS exemplar_codigo,
      livros_exemplares.numero AS exemplar_numero,
      IFNULL(exemplar_stats.total_exemplares, 0) AS total_exemplares,
      IFNULL(exemplar_stats.exemplares_disponiveis, 0) AS exemplares_disponiveis,
      IFNULL(exemplar_stats.exemplares_emprestados, 0) AS exemplares_emprestados,
      IFNULL(exemplar_stats.exemplares_atrasados, 0) AS exemplares_atrasados
    FROM livros
    LEFT JOIN (
      SELECT
        livros.id AS livro_id,
        COUNT(livros_exemplares.id) AS total_exemplares,
        SUM(CASE WHEN livros_exemplares.id IS NOT NULL AND emprestimos.id IS NULL THEN 1 ELSE 0 END) AS exemplares_disponiveis,
        SUM(CASE WHEN emprestimos.id IS NOT NULL THEN 1 ELSE 0 END) AS exemplares_emprestados,
        SUM(CASE WHEN emprestimos.id IS NOT NULL AND ${timestampAsMilliseconds('emprestimos.data_prazo')} < ${nowInMilliseconds} THEN 1 ELSE 0 END) AS exemplares_atrasados
      FROM livros
      LEFT JOIN livros_exemplares ON livros.id = livros_exemplares.livro_id
      LEFT JOIN emprestimos ON livros_exemplares.id = emprestimos.exemplar_id
      GROUP BY livros.id
    ) exemplar_stats ON livros.id = exemplar_stats.livro_id
    LEFT JOIN emprestimos ON emprestimos.id = (
      SELECT emprestimos_representativos.id
      FROM emprestimos AS emprestimos_representativos
      WHERE emprestimos_representativos.livro_id = livros.id
      ORDER BY
        CASE WHEN ${timestampAsMilliseconds('emprestimos_representativos.data_prazo')} < ${nowInMilliseconds} THEN 0 ELSE 1 END,
        CAST(emprestimos_representativos.data_prazo AS REAL) ASC,
        emprestimos_representativos.id ASC
      LIMIT 1
    )
    LEFT JOIN livros_exemplares ON emprestimos.exemplar_id = livros_exemplares.id
    LEFT JOIN leitores ON emprestimos.leitor_id = leitores.id;

  CREATE VIEW pendencias AS
    SELECT
      livros.id AS livro_id,
      livros.titulo AS titulo,
      livros_exemplares.id AS exemplar_id,
      livros_exemplares.codigo AS exemplar_codigo,
      emprestimos.data_emprestimo,
      emprestimos.data_prazo,
      leitores.id AS leitor_id,
      leitores.nome AS leitor,
      leitores.turma AS turma
    FROM livros
    JOIN emprestimos ON livros.id = emprestimos.livro_id
    JOIN livros_exemplares ON emprestimos.exemplar_id = livros_exemplares.id
    JOIN leitores ON emprestimos.leitor_id = leitores.id
    WHERE ${timestampAsMilliseconds('emprestimos.data_prazo')} < ${nowInMilliseconds};

  CREATE VIEW estatisticas AS
    SELECT
      (SELECT COUNT(*) FROM leitores) AS total_usuarios,
      (SELECT COUNT(DISTINCT leitor_id) FROM emprestimos) AS usuarios_com_emprestimos,
      (SELECT COUNT(*) FROM livros) AS total_livros,
      (SELECT COUNT(*) FROM emprestimos WHERE ${timestampAsMilliseconds('data_prazo')} >= ${nowInMilliseconds}) AS livros_emprestados,
      (SELECT COUNT(*) FROM emprestimos WHERE ${timestampAsMilliseconds('data_prazo')} < ${nowInMilliseconds}) AS livros_atrasados;
`;

const migrations: Migration[] = [
  {
    id: 1,
    name: 'base_schema_and_views',
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS livros (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          titulo TEXT NOT NULL,
          autor TEXT NOT NULL,
          editora TEXT,
          tags TEXT,
          isbn TEXT
        );

        CREATE TABLE IF NOT EXISTS leitores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          turma TEXT NOT NULL,
          contato TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS emprestimos (
          livro_id INTEGER NOT NULL PRIMARY KEY,
          leitor_id INTEGER NOT NULL,
          data_emprestimo TEXT NOT NULL,
          data_prazo TEXT NOT NULL,
          FOREIGN KEY(livro_id) REFERENCES livros(id) ON DELETE RESTRICT,
          FOREIGN KEY(leitor_id) REFERENCES leitores(id) ON DELETE RESTRICT
        );

        ${createViewsSql}
      `);
    },
  },
  {
    id: 2,
    name: 'query_indexes',
    up: async (db) => {
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros(titulo COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_livros_autor ON livros(autor COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_livros_isbn ON livros(isbn);
        CREATE INDEX IF NOT EXISTS idx_leitores_nome ON leitores(nome COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_leitores_turma ON leitores(turma COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_leitor ON emprestimos(leitor_id);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_prazo ON emprestimos(data_prazo);
      `);
    },
  },
  {
    id: 3,
    name: 'timestamp_compatible_views',
    up: async (db) => {
      await db.exec(createViewsSql);
    },
  },
  {
    id: 4,
    name: 'loan_history',
    up: async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS emprestimos_historico (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          livro_id INTEGER,
          leitor_id INTEGER,
          livro_titulo TEXT NOT NULL,
          leitor_nome TEXT NOT NULL,
          leitor_turma TEXT NOT NULL,
          data_emprestimo TEXT NOT NULL,
          data_prazo TEXT NOT NULL,
          data_devolucao TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_historico_livro ON emprestimos_historico(livro_id);
        CREATE INDEX IF NOT EXISTS idx_historico_leitor ON emprestimos_historico(leitor_id);
        CREATE INDEX IF NOT EXISTS idx_historico_status ON emprestimos_historico(status);
        CREATE INDEX IF NOT EXISTS idx_historico_data_devolucao ON emprestimos_historico(data_devolucao);

        INSERT INTO emprestimos_historico (
          livro_id,
          leitor_id,
          livro_titulo,
          leitor_nome,
          leitor_turma,
          data_emprestimo,
          data_prazo,
          data_devolucao,
          status
        )
        SELECT
          emprestimos.livro_id,
          emprestimos.leitor_id,
          livros.titulo,
          leitores.nome,
          leitores.turma,
          emprestimos.data_emprestimo,
          emprestimos.data_prazo,
          NULL,
          'EMPRESTADO'
        FROM emprestimos
        JOIN livros ON livros.id = emprestimos.livro_id
        JOIN leitores ON leitores.id = emprestimos.leitor_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM emprestimos_historico
          WHERE emprestimos_historico.livro_id = emprestimos.livro_id
            AND emprestimos_historico.data_emprestimo = emprestimos.data_emprestimo
        );
      `);
    },
  },
  {
    id: 5,
    name: 'physical_book_copies',
    up: async (db) => {
      await db.exec(`
        DROP VIEW IF EXISTS leitores_infos;
        DROP VIEW IF EXISTS livros_infos;
        DROP VIEW IF EXISTS pendencias;
        DROP VIEW IF EXISTS estatisticas;

        CREATE TABLE IF NOT EXISTS livros_exemplares (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          livro_id INTEGER NOT NULL,
          numero INTEGER NOT NULL,
          codigo TEXT NOT NULL UNIQUE,
          observacao TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(livro_id, numero),
          FOREIGN KEY(livro_id) REFERENCES livros(id) ON DELETE CASCADE
        );

        INSERT INTO livros_exemplares (livro_id, numero, codigo)
        SELECT livros.id, 1, printf('B%04d-E%02d', livros.id, 1)
        FROM livros
        WHERE NOT EXISTS (
          SELECT 1
          FROM livros_exemplares
          WHERE livros_exemplares.livro_id = livros.id
        );
      `);

      const loansHaveExemplar = await tableHasColumn(db, 'emprestimos', 'exemplar_id');

      if (!loansHaveExemplar) {
        await db.exec(`
          ALTER TABLE emprestimos RENAME TO emprestimos_legacy;

          CREATE TABLE emprestimos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            livro_id INTEGER NOT NULL,
            exemplar_id INTEGER NOT NULL UNIQUE,
            leitor_id INTEGER NOT NULL,
            data_emprestimo TEXT NOT NULL,
            data_prazo TEXT NOT NULL,
            FOREIGN KEY(livro_id) REFERENCES livros(id) ON DELETE RESTRICT,
            FOREIGN KEY(exemplar_id) REFERENCES livros_exemplares(id) ON DELETE RESTRICT,
            FOREIGN KEY(leitor_id) REFERENCES leitores(id) ON DELETE RESTRICT
          );

          INSERT INTO emprestimos (livro_id, exemplar_id, leitor_id, data_emprestimo, data_prazo)
          SELECT
            emprestimos_legacy.livro_id,
            (
              SELECT livros_exemplares.id
              FROM livros_exemplares
              WHERE livros_exemplares.livro_id = emprestimos_legacy.livro_id
              ORDER BY livros_exemplares.numero ASC
              LIMIT 1
            ),
            emprestimos_legacy.leitor_id,
            emprestimos_legacy.data_emprestimo,
            emprestimos_legacy.data_prazo
          FROM emprestimos_legacy;

          DROP TABLE emprestimos_legacy;
        `);
      }

      await addColumnIfMissing(db, 'emprestimos_historico', 'exemplar_id', 'INTEGER');
      await addColumnIfMissing(db, 'emprestimos_historico', 'exemplar_codigo', 'TEXT');

      await db.exec(`
        UPDATE emprestimos_historico
        SET
          exemplar_id = (
            SELECT emprestimos.exemplar_id
            FROM emprestimos
            WHERE emprestimos.livro_id = emprestimos_historico.livro_id
              AND emprestimos.data_emprestimo = emprestimos_historico.data_emprestimo
            LIMIT 1
          ),
          exemplar_codigo = (
            SELECT livros_exemplares.codigo
            FROM emprestimos
            JOIN livros_exemplares ON livros_exemplares.id = emprestimos.exemplar_id
            WHERE emprestimos.livro_id = emprestimos_historico.livro_id
              AND emprestimos.data_emprestimo = emprestimos_historico.data_emprestimo
            LIMIT 1
          )
        WHERE exemplar_id IS NULL;

        CREATE INDEX IF NOT EXISTS idx_livros_exemplares_livro ON livros_exemplares(livro_id);
        CREATE INDEX IF NOT EXISTS idx_livros_exemplares_codigo ON livros_exemplares(codigo COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_livro ON emprestimos(livro_id);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_exemplar ON emprestimos(exemplar_id);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_leitor ON emprestimos(leitor_id);
        CREATE INDEX IF NOT EXISTS idx_emprestimos_prazo ON emprestimos(data_prazo);
        CREATE INDEX IF NOT EXISTS idx_historico_exemplar ON emprestimos_historico(exemplar_id);

        ${createCopyAwareViewsSql}
      `);
    },
  },
  {
    id: 6,
    name: 'indexed_search_text',
    up: async (db) => {
      await addColumnIfMissing(db, 'livros', 'search_text', "TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(db, 'leitores', 'search_text', "TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(db, 'emprestimos_historico', 'search_text', "TEXT NOT NULL DEFAULT ''");

      const books = await db.all<{
        id: number;
        titulo: string;
        autor: string;
        editora: string | null;
        isbn: string | null;
        tags: string | null;
      }>('SELECT id, titulo, autor, editora, isbn, tags FROM livros');

      for (const book of books) {
        await db.run('UPDATE livros SET search_text = ? WHERE id = ?', [
          buildSearchText([book.titulo, book.autor, book.editora, book.isbn, book.tags]),
          book.id,
        ]);
      }

      const users = await db.all<{
        id: number;
        nome: string;
        turma: string;
        contato: string;
      }>('SELECT id, nome, turma, contato FROM leitores');

      for (const user of users) {
        await db.run('UPDATE leitores SET search_text = ? WHERE id = ?', [
          buildSearchText([user.nome, user.turma, user.contato]),
          user.id,
        ]);
      }

      const historyItems = await db.all<{
        id: number;
        livro_titulo: string;
        leitor_nome: string;
        leitor_turma: string;
        exemplar_codigo: string | null;
      }>('SELECT id, livro_titulo, leitor_nome, leitor_turma, exemplar_codigo FROM emprestimos_historico');

      for (const historyItem of historyItems) {
        await db.run('UPDATE emprestimos_historico SET search_text = ? WHERE id = ?', [
          buildSearchText([
            historyItem.livro_titulo,
            historyItem.leitor_nome,
            historyItem.leitor_turma,
            historyItem.exemplar_codigo,
          ]),
          historyItem.id,
        ]);
      }

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_livros_search_text ON livros(search_text);
        CREATE INDEX IF NOT EXISTS idx_leitores_search_text ON leitores(search_text);
        CREATE INDEX IF NOT EXISTS idx_historico_search_text ON emprestimos_historico(search_text);
      `);
    },
  },
  {
    id: 7,
    name: 'loaned_book_status_view',
    up: async (db) => {
      await db.exec(createCopyAwareViewsSql);
    },
  },
  {
    id: 8,
    name: 'copy_created_at_backfill',
    up: async (db) => {
      await addColumnIfMissing(db, 'livros_exemplares', 'created_at', 'TEXT');
      await db.exec(`
        UPDATE livros_exemplares
        SET created_at = COALESCE((
          SELECT CAST(MIN(${timestampAsMilliseconds('emprestimos_historico.data_emprestimo')}) - 1 AS TEXT)
          FROM emprestimos_historico
          WHERE emprestimos_historico.exemplar_id = livros_exemplares.id
        ), CURRENT_TIMESTAMP)
        WHERE created_at IS NULL OR created_at = '';
      `);
    },
  },
  {
    id: 9,
    name: 'copy_created_at_before_first_loan',
    up: async (db) => {
      await db.exec(`
        UPDATE livros_exemplares
        SET created_at = (
          SELECT CAST(MIN(${timestampAsMilliseconds('emprestimos_historico.data_emprestimo')}) - 1 AS TEXT)
          FROM emprestimos_historico
          WHERE emprestimos_historico.exemplar_id = livros_exemplares.id
        )
        WHERE (
          SELECT MIN(${timestampAsMilliseconds('emprestimos_historico.data_emprestimo')})
          FROM emprestimos_historico
          WHERE emprestimos_historico.exemplar_id = livros_exemplares.id
        ) IS NOT NULL
        AND ${sortableTimestamp('created_at')} > (
          SELECT MIN(${timestampAsMilliseconds('emprestimos_historico.data_emprestimo')})
          FROM emprestimos_historico
          WHERE emprestimos_historico.exemplar_id = livros_exemplares.id
        );
      `);
    },
  },
];

export async function runMigrations(db: SqliteConnection): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = await db.all<{ id: number }>('SELECT id FROM schema_migrations');
  const appliedIds = new Set(applied.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    await db.transaction(async () => {
      await migration.up(db);
      await db.run('INSERT INTO schema_migrations (id, name) VALUES (?, ?)', [
        migration.id,
        migration.name,
      ]);
    });
  }
}

async function tableHasColumn(db: SqliteConnection, table: string, column: string): Promise<boolean> {
  const rows = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function addColumnIfMissing(
  db: SqliteConnection,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (await tableHasColumn(db, table, column)) {
    return;
  }

  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}
