import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { runMigrations } from './migrations';

sqlite3.verbose();

export const DATABASE_FILE_NAME = 'books.db';

export interface DatabaseImportResult {
  backupPath: string | null;
  databasePath: string;
  sizeBytes: number;
}

export interface RunResult {
  lastID: number;
  changes: number;
}

export class SqliteConnection {
  constructor(
    private readonly dbPath: string,
    private client: sqlite3.Database,
  ) {}

  get filePath(): string {
    return this.dbPath;
  }

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.exec(sql, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this.client.run(sql, params, function runCallback(error: Error | null) {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          lastID: this.lastID,
          changes: this.changes,
        });
      });
    });
  }

  get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.client.get(sql, params, (error, row: T | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(row);
      });
    });
  }

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.client.all(sql, params, (error, rows: T[]) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(rows);
      });
    });
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const result = await operation();
      await this.exec('COMMIT;');
      return result;
    } catch (error) {
      await this.exec('ROLLBACK;');
      throw error;
    }
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async checkpoint(): Promise<void> {
    await this.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  }

  async replaceWithFile(sourcePath: string): Promise<{ backupPath: string | null }> {
    await this.checkpoint();
    await this.close();

    const incomingPath = `${this.dbPath}.incoming`;
    const backupPath = await copyCurrentDatabaseBackup(this.dbPath);

    try {
      await removeDatabaseSidecars(this.dbPath);
      await fs.copyFile(sourcePath, incomingPath);
      await fs.rename(incomingPath, this.dbPath);
      await this.reopen();
      return { backupPath };
    } catch (error) {
      await fs.rm(incomingPath, { force: true }).catch(() => undefined);

      if (backupPath) {
        await fs.copyFile(backupPath, this.dbPath).catch(() => undefined);
      }

      await this.reopen().catch(() => undefined);
      throw error;
    }
  }

  private async reopen(): Promise<void> {
    this.client = await createSqliteClient(this.dbPath);
    await configureDatabase(this);
  }
}

export async function openDatabase(projectRoot: string): Promise<SqliteConnection> {
  return openDatabaseAt(databasePath(projectRoot));
}

export async function openDatabaseAt(dbPath: string): Promise<SqliteConnection> {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const sqlite = await createSqliteClient(dbPath);
  const db = new SqliteConnection(dbPath, sqlite);

  await configureDatabase(db);

  return db;
}

export function databasePath(projectRoot: string): string {
  return path.join(projectRoot, DATABASE_FILE_NAME);
}

export async function importDatabaseBuffer(
  db: SqliteConnection,
  projectRoot: string,
  buffer: Buffer,
): Promise<DatabaseImportResult> {
  if (buffer.length === 0) {
    throw new Error('Arquivo de banco vazio.');
  }

  const importDir = await fs.mkdtemp(path.join(projectRoot, 'db-import-'));
  const tempPath = path.join(importDir, DATABASE_FILE_NAME);

  try {
    await fs.writeFile(tempPath, buffer);
    await validateImportedDatabase(tempPath);
    const { backupPath } = await db.replaceWithFile(tempPath);

    return {
      backupPath,
      databasePath: db.filePath,
      sizeBytes: buffer.length,
    };
  } finally {
    await fs.rm(importDir, { recursive: true, force: true });
  }
}

async function configureDatabase(db: SqliteConnection): Promise<void> {
  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
  `);

  await runMigrations(db);
}

async function validateImportedDatabase(dbPath: string): Promise<void> {
  const sqlite = await createSqliteClient(dbPath);
  const db = new SqliteConnection(dbPath, sqlite);

  try {
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('livros', 'leitores')",
    );
    const tableNames = new Set(tables.map((table) => table.name));

    if (!tableNames.has('livros') || !tableNames.has('leitores')) {
      throw new Error('Esse arquivo nao parece ser um banco do Book DB.');
    }
  } finally {
    await db.close().catch(() => undefined);
  }

  const migrated = await openDatabaseAt(dbPath);
  try {
    await migrated.checkpoint();
  } finally {
    await migrated.close().catch(() => undefined);
  }
}

function createSqliteClient(dbPath: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const sqlite = new sqlite3.Database(dbPath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(sqlite);
    });
  });
}

async function copyCurrentDatabaseBackup(dbPath: string): Promise<string | null> {
  const backupPath = backupDatabasePath(dbPath);

  try {
    await fs.copyFile(dbPath, backupPath);
    return backupPath;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

function backupDatabasePath(dbPath: string): string {
  const parsed = path.parse(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(parsed.dir, `${parsed.name}.backup-${timestamp}${parsed.ext}`);
}

async function removeDatabaseSidecars(dbPath: string): Promise<void> {
  await Promise.all(
    [`${dbPath}-wal`, `${dbPath}-shm`].map(async (sidecarPath) => {
      await fs.rm(sidecarPath, { force: true });
    }),
  );
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === 'ENOENT');
}
