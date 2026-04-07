import Database from 'better-sqlite3';

export interface PackageRow {
  id: number;
  service_type: string;
  sessions: number;
  duration_months: number;
  price: number;
  consistency_window_days: number;
  consistency_min_days: number;
}

export function listPackages(db: Database.Database): PackageRow[] {
  return db.prepare(
    `SELECT * FROM packages ORDER BY service_type ASC, duration_months ASC, sessions ASC, price ASC`
  ).all() as PackageRow[];
}

export function findPackageById(db: Database.Database, id: number): PackageRow | undefined {
  return db.prepare(`SELECT * FROM packages WHERE id = ?`).get(id) as PackageRow | undefined;
}
