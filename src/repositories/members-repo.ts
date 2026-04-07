import Database from 'better-sqlite3';

export interface MemberRow {
  id: number;
  role: string;
  full_name: string;
  email: string;
  phone: string;
  join_date: string;
  status: string;
  created_at: string;
}

export function findMemberByEmail(db: Database.Database, email: string): MemberRow | undefined {
  return db.prepare(
    `SELECT id, role, full_name, email, phone, join_date, status, created_at
     FROM members WHERE LOWER(email) = LOWER(?)`
  ).get(email.trim().toLowerCase()) as MemberRow | undefined;
}

export function findMemberById(db: Database.Database, id: number): MemberRow | undefined {
  return db.prepare(
    `SELECT id, role, full_name, email, phone, join_date, status, created_at
     FROM members WHERE id = ?`
  ).get(id) as MemberRow | undefined;
}

export function listMembersByStatus(db: Database.Database, status: string): MemberRow[] {
  return db.prepare(
    `SELECT id, role, full_name, email, phone, join_date, status, created_at
     FROM members WHERE status = ? AND role = 'member'
     ORDER BY LOWER(full_name) ASC, id ASC`
  ).all(status) as MemberRow[];
}

export function createMember(
  db: Database.Database,
  data: { full_name: string; email: string; phone: string; join_date: string }
): MemberRow {
  const stmt = db.prepare(
    `INSERT INTO members (role, full_name, email, phone, join_date)
     VALUES ('member', ?, LOWER(?), ?, ?)`
  );
  const result = stmt.run(data.full_name.trim(), data.email.trim(), data.phone.trim(), data.join_date);
  return findMemberById(db, Number(result.lastInsertRowid))!;
}

export function updateMember(
  db: Database.Database,
  id: number,
  data: { full_name?: string; phone?: string }
): MemberRow | undefined {
  const sets: string[] = [];
  const values: any[] = [];
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
  db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return findMemberById(db, id);
}

export function archiveMember(db: Database.Database, id: number): void {
  db.prepare(`UPDATE members SET status = 'archived' WHERE id = ?`).run(id);
}

export function unarchiveMember(db: Database.Database, id: number): void {
  db.prepare(`UPDATE members SET status = 'active' WHERE id = ?`).run(id);
}
