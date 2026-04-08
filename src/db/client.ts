import Database from 'better-sqlite3';

export type SqlValue = string | number | null;

export interface SqlStatement {
  sql: string;
  params?: SqlValue[];
}

export interface RunResult {
  changes: number;
  lastRowId: number;
}

export interface AppDatabase {
  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  batch(statements: SqlStatement[]): Promise<RunResult[]>;
}

function normalizeParams(params?: SqlValue[]): SqlValue[] {
  return params ?? [];
}

function toRunResult(result: { changes?: number; lastInsertRowid?: number | bigint; meta?: { changes?: number; last_row_id?: number | string } }): RunResult {
  if ('meta' in result && result.meta) {
    return {
      changes: result.meta.changes ?? 0,
      lastRowId: Number(result.meta.last_row_id ?? 0),
    };
  }

  return {
    changes: result.changes ?? 0,
    lastRowId: Number(result.lastInsertRowid ?? 0),
  };
}

export class SqliteAppDatabase implements AppDatabase {
  constructor(private readonly db: Database.Database) {}

  async get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...normalizeParams(params)) as T | undefined;
  }

  async all<T>(sql: string, params?: SqlValue[]): Promise<T[]> {
    return this.db.prepare(sql).all(...normalizeParams(params)) as T[];
  }

  async run(sql: string, params?: SqlValue[]): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...normalizeParams(params));
    return toRunResult(result);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async batch(statements: SqlStatement[]): Promise<RunResult[]> {
    if (statements.length === 0) {
      return [];
    }

    const execute = this.db.transaction((items: SqlStatement[]) => {
      return items.map((item) => {
        const result = this.db.prepare(item.sql).run(...normalizeParams(item.params));
        return toRunResult(result);
      });
    });

    return execute(statements);
  }
}

export class D1AppDatabase implements AppDatabase {
  constructor(private readonly db: D1Database) {}

  async get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined> {
    const statement = this.db.prepare(sql).bind(...normalizeParams(params));
    const result = await statement.first<T>();
    return result ?? undefined;
  }

  async all<T>(sql: string, params?: SqlValue[]): Promise<T[]> {
    const statement = this.db.prepare(sql).bind(...normalizeParams(params));
    const result = await statement.all<T>();
    return result.results ?? [];
  }

  async run(sql: string, params?: SqlValue[]): Promise<RunResult> {
    const statement = this.db.prepare(sql).bind(...normalizeParams(params));
    const result = await statement.run();
    return toRunResult(result);
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  async batch(statements: SqlStatement[]): Promise<RunResult[]> {
    if (statements.length === 0) {
      return [];
    }

    const prepared = statements.map((item) => this.db.prepare(item.sql).bind(...normalizeParams(item.params)));
    const results = await this.db.batch(prepared);
    return results.map((result) => toRunResult(result));
  }
}

export function createSqliteAppDatabase(db: Database.Database): AppDatabase {
  return new SqliteAppDatabase(db);
}

export function createD1AppDatabase(db: D1Database): AppDatabase {
  return new D1AppDatabase(db);
}
