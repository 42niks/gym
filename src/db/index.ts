import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { createSqliteAppDatabase, type AppDatabase } from './client.js';

function getMigrationsDir(): string {
  return path.resolve(import.meta.dirname, '../../migrations');
}

function loadSqlFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function loadPackageSeedSql(): string {
  return loadSqlFile(path.resolve(import.meta.dirname, 'seed.sql'));
}

export function loadCredentialsSeedSql(): string {
  return loadSqlFile(path.resolve(import.meta.dirname, 'seed.credentials.sql'));
}

export function runMigrations(db: Database.Database): void {
  const migrationsDir = getMigrationsDir();
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    (db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[]).map(r => r.filename)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = loadSqlFile(path.join(migrationsDir, file));
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
  }
}

export function seedPackages(db: Database.Database): void {
  db.exec(loadPackageSeedSql());
}

export function createSqliteDatabase(dbPath: string = ':memory:'): Database.Database {
  const db = new Database(dbPath);
  runMigrations(db);
  seedPackages(db);
  return db;
}

export function createLocalDatabase(dbPath: string = ':memory:'): AppDatabase {
  return createSqliteAppDatabase(createSqliteDatabase(dbPath));
}

export async function applyPackageSeed(db: AppDatabase): Promise<void> {
  await db.exec(loadPackageSeedSql());
}

export async function applyCredentialsSeed(db: AppDatabase): Promise<void> {
  await db.exec(loadCredentialsSeedSql());
}
