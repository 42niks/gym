import type { AppDatabase } from '../db/client.js';
import { getIstDate } from '../lib/date.js';
import {
  createPackage,
  deletePackage,
  findPackageWithUsageById,
  listPackages,
  listPackagesWithUsage,
  updatePackage,
  type PackageRow,
  type PackageUsageRow,
} from '../repositories/packages-repo.js';

interface PackageDraft {
  service_type: string;
  sessions: number;
  duration_months: number;
  price: number;
  consistency_window_days: number;
  consistency_min_days: number;
  is_active: boolean;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }

  return null;
}

function validateDraft(data: PackageDraft): string | null {
  if (!data.service_type) return 'service_type is required';
  if (data.service_type.length > 120) return 'service_type exceeds 120 characters';
  if (data.sessions <= 0) return 'sessions must be a positive integer';
  if (data.duration_months <= 0) return 'duration_months must be a positive integer';
  if (data.price <= 0) return 'price must be a positive integer';
  if (data.consistency_window_days <= 0) return 'consistency_window_days must be a positive integer';
  if (data.consistency_min_days <= 0) return 'consistency_min_days must be a positive integer';
  if (data.consistency_min_days > data.consistency_window_days) {
    return 'consistency_min_days cannot exceed consistency_window_days';
  }

  return null;
}

function toDraftFromRow(row: PackageRow): PackageDraft {
  return {
    service_type: row.service_type,
    sessions: row.sessions,
    duration_months: row.duration_months,
    price: row.price,
    consistency_window_days: row.consistency_window_days,
    consistency_min_days: row.consistency_min_days,
    is_active: row.is_active === 1,
  };
}

function formatPackage(row: PackageRow) {
  return {
    id: row.id,
    service_type: row.service_type,
    sessions: row.sessions,
    duration_months: row.duration_months,
    price: row.price,
    consistency_window_days: row.consistency_window_days,
    consistency_min_days: row.consistency_min_days,
    is_active: row.is_active === 1,
  };
}

function formatManagedPackage(row: PackageUsageRow) {
  return {
    ...formatPackage(row),
    subscription_count: Number(row.subscription_count),
    active_subscription_count: Number(row.active_subscription_count),
    upcoming_subscription_count: Number(row.upcoming_subscription_count),
  };
}

function buildCreateDraft(body: any): PackageDraft | null {
  const draft: PackageDraft = {
    service_type: typeof body?.service_type === 'string' ? body.service_type.trim() : '',
    sessions: parseInteger(body?.sessions) ?? 0,
    duration_months: parseInteger(body?.duration_months) ?? 0,
    price: parseInteger(body?.price) ?? 0,
    consistency_window_days: parseInteger(body?.consistency_window_days) ?? 0,
    consistency_min_days: parseInteger(body?.consistency_min_days) ?? 0,
    is_active: parseBoolean(body?.is_active) ?? true,
  };

  return draft;
}

function buildUpdateDraft(body: any): Partial<PackageDraft> | null {
  const updates: Partial<PackageDraft> = {};

  if (body?.service_type !== undefined) {
    if (typeof body.service_type !== 'string') return null;
    updates.service_type = body.service_type.trim();
  }
  if (body?.sessions !== undefined) {
    const parsed = parseInteger(body.sessions);
    if (parsed === null) return null;
    updates.sessions = parsed;
  }
  if (body?.duration_months !== undefined) {
    const parsed = parseInteger(body.duration_months);
    if (parsed === null) return null;
    updates.duration_months = parsed;
  }
  if (body?.price !== undefined) {
    const parsed = parseInteger(body.price);
    if (parsed === null) return null;
    updates.price = parsed;
  }
  if (body?.consistency_window_days !== undefined) {
    const parsed = parseInteger(body.consistency_window_days);
    if (parsed === null) return null;
    updates.consistency_window_days = parsed;
  }
  if (body?.consistency_min_days !== undefined) {
    const parsed = parseInteger(body.consistency_min_days);
    if (parsed === null) return null;
    updates.consistency_min_days = parsed;
  }
  if (body?.is_active !== undefined) {
    const parsed = parseBoolean(body.is_active);
    if (parsed === null) return null;
    updates.is_active = parsed;
  }

  return updates;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

export async function listSelectablePackages(db: AppDatabase) {
  const rows = await listPackages(db);
  return rows.map(formatPackage);
}

export async function listManagedPackages(db: AppDatabase) {
  const rows = await listPackagesWithUsage(db, getIstDate());
  return rows.map(formatManagedPackage);
}

export async function createManagedPackage(db: AppDatabase, body: any) {
  const draft = buildCreateDraft(body);
  const validationError = draft ? validateDraft(draft) : 'Invalid package payload';

  if (!draft || validationError) {
    return { error: validationError ?? 'Invalid package payload', status: 400 as const };
  }

  try {
    const id = await createPackage(db, {
      ...draft,
      is_active: draft.is_active ? 1 : 0,
    });
    const row = await findPackageWithUsageById(db, id, getIstDate());
    if (!row) {
      return { error: 'Failed to load created package', status: 500 as const };
    }

    return { data: formatManagedPackage(row), status: 201 as const };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: 'A package with this service type, duration, sessions, and price already exists', status: 409 as const };
    }

    throw error;
  }
}

export async function updateManagedPackage(db: AppDatabase, id: number, body: any) {
  const today = getIstDate();
  const existing = await findPackageWithUsageById(db, id, today);
  if (!existing) {
    return { error: 'Package not found', status: 404 as const };
  }

  const updates = buildUpdateDraft(body);
  if (!updates) {
    return { error: 'Invalid package payload', status: 400 as const };
  }
  if (Object.keys(updates).length === 0) {
    return { error: 'No editable field provided', status: 400 as const };
  }

  const hasHistoricalUsage = Number(existing.subscription_count) > 0;
  const isChangingHistoricalField =
    'service_type' in updates ||
    'sessions' in updates ||
    'duration_months' in updates ||
    'price' in updates;

  if (hasHistoricalUsage && isChangingHistoricalField) {
    return {
      error: 'This package is already in use. Create a new package row to change service type, sessions, duration, or price.',
      status: 409 as const,
    };
  }

  const merged = {
    ...toDraftFromRow(existing),
    ...updates,
  };
  const validationError = validateDraft(merged);
  if (validationError) {
    return { error: validationError, status: 400 as const };
  }

  try {
    await updatePackage(db, id, {
      ...updates,
      ...(updates.is_active !== undefined ? { is_active: updates.is_active ? 1 : 0 } : {}),
    });
    const row = await findPackageWithUsageById(db, id, today);
    if (!row) {
      return { error: 'Package not found after update', status: 500 as const };
    }

    return { data: formatManagedPackage(row), status: 200 as const };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: 'A package with this service type, duration, sessions, and price already exists', status: 409 as const };
    }

    throw error;
  }
}

export async function deleteManagedPackage(db: AppDatabase, id: number) {
  const existing = await findPackageWithUsageById(db, id, getIstDate());
  if (!existing) {
    return { error: 'Package not found', status: 404 as const };
  }

  if (Number(existing.subscription_count) > 0) {
    return {
      error: 'Package cannot be deleted because subscriptions already reference it',
      status: 409 as const,
    };
  }

  await deletePackage(db, id);
  return { data: { ok: true }, status: 200 as const };
}
