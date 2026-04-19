import type { AppDatabase } from '../db/client.js';

export interface MemberRow {
  id: number;
  role: string;
  full_name: string;
  email: string;
  phone: string;
  join_date: string;
  status: string;
  archived_at: string | null;
  created_at: string;
}

export async function findMemberByEmail(db: AppDatabase, email: string): Promise<MemberRow | undefined> {
  return db.get(
    `SELECT id, role, full_name, email, phone, join_date, status, archived_at, created_at
     FROM members WHERE LOWER(email) = LOWER(?)`
  , [email.trim().toLowerCase()]);
}

export async function findMemberById(db: AppDatabase, id: number): Promise<MemberRow | undefined> {
  return db.get(
    `SELECT id, role, full_name, email, phone, join_date, status, archived_at, created_at
     FROM members WHERE id = ?`
  , [id]);
}

export async function listMembersByStatus(db: AppDatabase, status: string): Promise<MemberRow[]> {
  return db.all(
    `SELECT id, role, full_name, email, phone, join_date, status, archived_at, created_at
     FROM members WHERE status = ? AND role = 'member'
     ORDER BY LOWER(full_name) ASC, id ASC`
  , [status]);
}

export async function createMember(
  db: AppDatabase,
  data: { full_name: string; email: string; phone: string; join_date: string }
): Promise<MemberRow> {
  const result = await db.run(
    `INSERT INTO members (role, full_name, email, phone, join_date)
     VALUES ('member', ?, LOWER(?), ?, ?)`
  , [data.full_name.trim(), data.email.trim(), data.phone.trim(), data.join_date]);
  return (await findMemberById(db, result.lastRowId))!;
}

export async function updateMember(
  db: AppDatabase,
  id: number,
  data: { full_name?: string; phone?: string }
): Promise<MemberRow | undefined> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (data.full_name !== undefined) {
    sets.push('full_name = ?');
    values.push(data.full_name.trim());
  }
  if (data.phone !== undefined) {
    sets.push('phone = ?');
    values.push(data.phone.trim());
  }
  if (sets.length === 0) return findMemberById(db, id);
  values.push(id);
  await db.run(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`, values);
  return findMemberById(db, id);
}

export async function archiveMember(db: AppDatabase, id: number, archivedAt: string): Promise<void> {
  await db.run(`UPDATE members SET status = 'archived', archived_at = ? WHERE id = ?`, [archivedAt, id]);
}

export async function unarchiveMember(db: AppDatabase, id: number): Promise<void> {
  await db.run(`UPDATE members SET status = 'active', archived_at = NULL WHERE id = ?`, [id]);
}
