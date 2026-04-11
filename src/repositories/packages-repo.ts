import type { AppDatabase } from '../db/client.js';

export interface PackageRow {
  id: number;
  service_type: string;
  sessions: number;
  duration_months: number;
  price: number;
  consistency_window_days: number;
  consistency_min_days: number;
  is_active: number;
}

export interface PackageUsageRow extends PackageRow {
  subscription_count: number;
  active_subscription_count: number;
  upcoming_subscription_count: number;
}

export async function listPackages(
  db: AppDatabase,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<PackageRow[]> {
  return db.all(
    `SELECT *
     FROM packages
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY is_active DESC, service_type ASC, duration_months ASC, sessions ASC, price ASC, id ASC`
  );
}

export async function listPackagesWithUsage(db: AppDatabase, today: string): Promise<PackageUsageRow[]> {
  return db.all(
    `SELECT
        p.*,
        COUNT(s.id) AS subscription_count,
        COALESCE(SUM(CASE
          WHEN s.owner_completed = 0
            AND ? BETWEEN s.start_date AND s.end_date
            AND s.attended_sessions < s.total_sessions
          THEN 1
          ELSE 0
        END), 0) AS active_subscription_count,
        COALESCE(SUM(CASE
          WHEN s.owner_completed = 0
            AND s.start_date > ?
          THEN 1
          ELSE 0
        END), 0) AS upcoming_subscription_count
     FROM packages p
     LEFT JOIN subscriptions s ON s.package_id = p.id
     GROUP BY p.id
     ORDER BY p.is_active DESC, p.service_type ASC, p.duration_months ASC, p.sessions ASC, p.price ASC, p.id ASC`,
    [today, today],
  );
}

export async function findPackageById(
  db: AppDatabase,
  id: number,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<PackageRow | undefined> {
  return db.get(
    `SELECT *
     FROM packages
     WHERE id = ? ${activeOnly ? 'AND is_active = 1' : ''}`,
    [id],
  );
}

export async function findPackageWithUsageById(
  db: AppDatabase,
  id: number,
  today: string,
): Promise<PackageUsageRow | undefined> {
  return db.get(
    `SELECT
        p.*,
        COUNT(s.id) AS subscription_count,
        COALESCE(SUM(CASE
          WHEN s.owner_completed = 0
            AND ? BETWEEN s.start_date AND s.end_date
            AND s.attended_sessions < s.total_sessions
          THEN 1
          ELSE 0
        END), 0) AS active_subscription_count,
        COALESCE(SUM(CASE
          WHEN s.owner_completed = 0
            AND s.start_date > ?
          THEN 1
          ELSE 0
        END), 0) AS upcoming_subscription_count
     FROM packages p
     LEFT JOIN subscriptions s ON s.package_id = p.id
     WHERE p.id = ?
     GROUP BY p.id`,
    [today, today, id],
  );
}

export async function createPackage(
  db: AppDatabase,
  data: Omit<PackageRow, 'id'>,
): Promise<number> {
  const result = await db.run(
    `INSERT INTO packages (
      service_type,
      sessions,
      duration_months,
      price,
      consistency_window_days,
      consistency_min_days,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.service_type,
      data.sessions,
      data.duration_months,
      data.price,
      data.consistency_window_days,
      data.consistency_min_days,
      data.is_active,
    ],
  );

  return result.lastRowId;
}

export async function updatePackage(
  db: AppDatabase,
  id: number,
  data: Partial<Omit<PackageRow, 'id'>>,
): Promise<void> {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return;
  }

  const sql = `UPDATE packages SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`;
  await db.run(sql, [...entries.map(([, value]) => value), id]);
}

export async function deletePackage(db: AppDatabase, id: number): Promise<void> {
  await db.run(`DELETE FROM packages WHERE id = ?`, [id]);
}
