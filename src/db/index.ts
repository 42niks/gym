import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function runMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(import.meta.dirname, '../../migrations');
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
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
  }
}

export function seedPackages(db: Database.Database): void {
  const seedFile = path.resolve(import.meta.dirname, 'seed.sql');
  const sql = fs.readFileSync(seedFile, 'utf-8');
  db.exec(sql);
}

export function createDatabase(dbPath: string = ':memory:'): Database.Database {
  const db = new Database(dbPath);
  runMigrations(db);
  seedPackages(db);
  return db;
}
