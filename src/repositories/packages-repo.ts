import type { AppDatabase } from '../db/client.js';

export interface PackageRow {
  id: number;
  service_type: string;
  sessions: number;
  duration_months: number;
  price: number;
  consistency_window_days: number;
  consistency_min_days: number;
}

export async function listPackages(db: AppDatabase): Promise<PackageRow[]> {
  return db.all(
    `SELECT * FROM packages ORDER BY service_type ASC, duration_months ASC, sessions ASC, price ASC`
  );
}

export async function findPackageById(db: AppDatabase, id: number): Promise<PackageRow | undefined> {
  return db.get(`SELECT * FROM packages WHERE id = ?`, [id]);
}
