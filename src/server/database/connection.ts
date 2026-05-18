import path from 'node:path';
import sqlite3 from 'sqlite3';
import { runMigrations } from './migrations';

sqlite3.verbose();

export interface RunResult {
  lastID: number;
  changes: number;
}

export class SqliteConnection {
  constructor(private readonly client: sqlite3.Database) {}

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
}

export async function openDatabase(projectRoot: string): Promise<SqliteConnection> {
  const dbPath = path.join(projectRoot, 'books.db');
  const sqlite = new sqlite3.Database(dbPath);
  const db = new SqliteConnection(sqlite);

  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
  `);

  await runMigrations(db);

  return db;
}
