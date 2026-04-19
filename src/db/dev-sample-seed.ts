import type { AppDatabase } from './client.js';
import { addDays, getIstDate } from '../lib/date.js';
import { computeEndDate } from '../lib/subscription.js';

const SAMPLE_SENTINEL_EMAIL = 'sample.consistent.01@thebase.fit';

const CONSISTENT_NAMES = [
  'Aarav Mehta',
  'Aditi Rao',
  'Rohan Sen',
  'Ishita Nair',
  'Dev Malhotra',
  'Ananya Shah',
  'Kabir Bedi',
  'Mira Kapoor',
] as const;

const AT_RISK_NAMES = [
  'Yash Khanna',
  'Tara Iyer',
  'Arjun Sethi',
  'Rhea Jain',
  'Neil Dutta',
  'Pooja Bhasin',
  'Karan Vora',
  'Sana Qureshi',
] as const;

const RENEWAL_NAMES = [
  'Farhan Ali',
  'Naina Chopra',
  'Pranav Kulkarni',
  'Diya Arora',
  'Sid Joshi',
  'Mahima Batra',
  'Vikram Sood',
  'Kiara Lal',
] as const;

const NO_PLAN_NAMES = [
  'Om Prakash',
  'Simran Gill',
  'Harsh Tandon',
  'Jiya Basu',
  'Ritvik Anand',
  'Lavanya Menon',
  'Samar Wagle',
  'Ira Thomas',
] as const;

const ARCHIVED_NAMES = [
  'Parth Goel',
  'Niharika Bose',
  'Rudra Yadav',
  'Sonal Desai',
  'Advik Ghosh',
  'Trisha Puri',
  'Manav Bhatia',
  'Reva Pillai',
] as const;

type PackageKey = {
  serviceType: string;
  sessions: number;
  durationMonths: number;
  price: number;
};

type MemberSeed = {
  fullName: string;
  email: string;
  phone: string;
  joinDate: string;
  status?: 'active' | 'archived';
};

async function findMemberIdByEmail(db: AppDatabase, email: string): Promise<number | null> {
  const row = await db.get<{ id: number }>(
    `SELECT id FROM members WHERE LOWER(email) = LOWER(?)`,
    [email],
  );
  return row?.id ?? null;
}

async function findPackageId(db: AppDatabase, key: PackageKey): Promise<number> {
  const row = await db.get<{ id: number }>(
    `SELECT id
     FROM packages
     WHERE service_type = ?
       AND sessions = ?
       AND duration_months = ?
       AND price = ?`,
    [key.serviceType, key.sessions, key.durationMonths, key.price],
  );

  if (!row) {
    throw new Error(`Package not found for ${key.serviceType} / ${key.sessions} / ${key.durationMonths} / ${key.price}`);
  }

  return row.id;
}

async function insertMember(db: AppDatabase, member: MemberSeed): Promise<number> {
  const result = await db.run(
    `INSERT INTO members (role, full_name, email, phone, join_date, status)
     VALUES ('member', ?, LOWER(?), ?, ?, ?)`,
    [member.fullName, member.email, member.phone, member.joinDate, member.status ?? 'active'],
  );

  return result.lastRowId;
}

async function insertSubscription(db: AppDatabase, input: {
  memberId: number;
  packageId: number;
  startDate: string;
  endDate: string;
  totalSessions: number;
  attendedSessions?: number;
  amount: number;
  ownerCompleted?: 0 | 1;
}): Promise<number> {
  const result = await db.run(
    `INSERT INTO subscriptions (
      member_id,
      package_id,
      start_date,
      end_date,
      total_sessions,
      attended_sessions,
      amount,
      owner_completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.memberId,
      input.packageId,
      input.startDate,
      input.endDate,
      input.totalSessions,
      input.attendedSessions ?? 0,
      input.amount,
      input.ownerCompleted ?? 0,
    ],
  );

  return result.lastRowId;
}

async function insertSessions(
  db: AppDatabase,
  input: { memberId: number; subscriptionId: number; dates: string[] },
): Promise<void> {
  for (const date of input.dates) {
    await db.run(
      `INSERT INTO sessions (member_id, subscription_id, date) VALUES (?, ?, ?)`,
      [input.memberId, input.subscriptionId, date],
    );
  }
}

function makeEmail(group: string, index: number) {
  return `sample.${group}.${String(index + 1).padStart(2, '0')}@thebase.fit`;
}

function makePhone(seed: number) {
  return `9${String(seed).padStart(9, '0')}`;
}

function buildDateList(today: string, offsets: number[]) {
  return offsets.map((offset) => addDays(today, offset));
}

export async function applyDevSampleSeed(db: AppDatabase): Promise<void> {
  const existingSentinelId = await findMemberIdByEmail(db, SAMPLE_SENTINEL_EMAIL);
  if (existingSentinelId) {
    return;
  }

  const today = getIstDate();

  const packages = {
    consistent: await findPackageId(db, {
      serviceType: 'Group Personal Training',
      sessions: 36,
      durationMonths: 3,
      price: 42000,
    }),
    atRisk: await findPackageId(db, {
      serviceType: '1:1 Personal Training',
      sessions: 36,
      durationMonths: 3,
      price: 85800,
    }),
    renewalGroup: await findPackageId(db, {
      serviceType: 'Group Personal Training',
      sessions: 12,
      durationMonths: 1,
      price: 14500,
    }),
    renewalMma: await findPackageId(db, {
      serviceType: 'MMA/Kickboxing Personal Training',
      sessions: 12,
      durationMonths: 1,
      price: 26400,
    }),
    noPlanUpcoming: await findPackageId(db, {
      serviceType: 'Group Personal Training',
      sessions: 16,
      durationMonths: 2,
      price: 22800,
    }),
  };

  const consistentTodayDates = buildDateList(today, [-20, -18, -16, -14, -12, -10, -8, -6, -4, -2, 0]);
  const consistentAtRiskDates = buildDateList(today, [-20, -18, -16, -14, -12, -10, -8, -6, -4, -2, -1]);
  const atRiskDates = buildDateList(today, [-13, -10, -8, -7, -4, -2]);
  const renewalDates = buildDateList(today, [-18, -16, -14, -12, -10, -8, -6, -4, -2]);
  const consistentStart = addDays(today, -46);
  const consistentEnd = computeEndDate(consistentStart, 3);
  const atRiskStart = addDays(today, -46);
  const atRiskEnd = computeEndDate(atRiskStart, 3);
  const renewalStart = addDays(today, -27);
  const renewalEnd = computeEndDate(renewalStart, 1);
  const upcomingStart = addDays(today, 4);
  const upcomingEnd = computeEndDate(upcomingStart, 2);

  await db.exec('BEGIN');

  try {
    for (let index = 0; index < CONSISTENT_NAMES.length; index++) {
      const consistentDates = index === 0 ? consistentAtRiskDates : consistentTodayDates;
      const memberId = await insertMember(db, {
        fullName: CONSISTENT_NAMES[index],
        email: makeEmail('consistent', index),
        phone: makePhone(100000000 + index + 1),
        joinDate: addDays(today, -(120 - index * 2)),
      });

      const subscriptionId = await insertSubscription(db, {
        memberId,
        packageId: packages.consistent,
        startDate: consistentStart,
        endDate: consistentEnd,
        totalSessions: 36,
        attendedSessions: consistentDates.length,
        amount: 42000,
      });

      await insertSessions(db, {
        memberId,
        subscriptionId,
        dates: consistentDates,
      });
    }

    for (let index = 0; index < AT_RISK_NAMES.length; index++) {
      const memberId = await insertMember(db, {
        fullName: AT_RISK_NAMES[index],
        email: makeEmail('atrisk', index),
        phone: makePhone(200000000 + index + 1),
        joinDate: addDays(today, -(105 - index * 2)),
      });

      const subscriptionId = await insertSubscription(db, {
        memberId,
        packageId: packages.atRisk,
        startDate: atRiskStart,
        endDate: atRiskEnd,
        totalSessions: 36,
        attendedSessions: atRiskDates.length,
        amount: 85800,
      });

      await insertSessions(db, {
        memberId,
        subscriptionId,
        dates: atRiskDates,
      });
    }

    for (let index = 0; index < RENEWAL_NAMES.length; index++) {
      const memberId = await insertMember(db, {
        fullName: RENEWAL_NAMES[index],
        email: makeEmail('renewal', index),
        phone: makePhone(300000000 + index + 1),
        joinDate: addDays(today, -(85 - index * 2)),
      });

      const isEven = index % 2 === 0;
      const subscriptionId = await insertSubscription(db, {
        memberId,
        packageId: isEven ? packages.renewalGroup : packages.renewalMma,
        startDate: renewalStart,
        endDate: renewalEnd,
        totalSessions: 12,
        attendedSessions: renewalDates.length,
        amount: isEven ? 14500 : 26400,
      });

      await insertSessions(db, {
        memberId,
        subscriptionId,
        dates: renewalDates,
      });
    }

    for (let index = 0; index < NO_PLAN_NAMES.length; index++) {
      const memberId = await insertMember(db, {
        fullName: NO_PLAN_NAMES[index],
        email: makeEmail('noplan', index),
        phone: makePhone(400000000 + index + 1),
        joinDate: addDays(today, -(55 - index * 2)),
      });

      if (index < 4) {
        await insertSubscription(db, {
          memberId,
          packageId: packages.noPlanUpcoming,
          startDate: addDays(upcomingStart, index),
          endDate: computeEndDate(addDays(upcomingStart, index), 2),
          totalSessions: 16,
          attendedSessions: 0,
          amount: 22800,
        });
      }
    }

    for (let index = 0; index < ARCHIVED_NAMES.length; index++) {
      await insertMember(db, {
        fullName: ARCHIVED_NAMES[index],
        email: makeEmail('archived', index),
        phone: makePhone(500000000 + index + 1),
        joinDate: addDays(today, -(180 - index * 3)),
        status: 'archived',
      });
    }

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
