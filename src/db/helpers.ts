import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { db } from './index';
import { users, ulds, uldHistory, userLogs, backups } from './schema';

function mapRowDates<T extends Record<string, any>>(rows: T[], dateKeys: string[]): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    const cleaned: any = { ...row };
    for (const key of dateKeys) {
      if (cleaned[key] !== null && cleaned[key] !== undefined) {
        const d = new Date(cleaned[key]);
        if (!isNaN(d.getTime())) {
          cleaned[key] = d;
        }
      }
    }
    return cleaned as T;
  });
}

async function syncSequences(tx: any) {
  try {
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`);
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('ulds', 'id'), COALESCE((SELECT MAX(id) FROM ulds), 1))`);
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('uld_history', 'id'), COALESCE((SELECT MAX(id) FROM uld_history), 1))`);
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('user_logs', 'id'), COALESCE((SELECT MAX(id) FROM user_logs), 1))`);
    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('backups', 'id'), COALESCE((SELECT MAX(id) FROM backups), 1))`);
  } catch (seqErr) {
    console.warn('Sequence sync warning (non-fatal):', seqErr);
  }
}

// -----------------------------------------------------------------------------
// 1. Users Queries
// -----------------------------------------------------------------------------
export async function getUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.id));
  } catch (error) {
    console.error('getUsers failed:', error);
    throw new Error('Database error while retrieving users.', { cause: error });
  }
}

export async function updateUserRole(uid: string, role: string) {
  try {
    const result = await db.update(users)
      .set({ role })
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
  } catch (error) {
    console.error('updateUserRole failed:', error);
    throw new Error('Database error while updating user role.', { cause: error });
  }
}

export async function updateUserStatus(uid: string, status: string) {
  try {
    const result = await db.update(users)
      .set({ status })
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
  } catch (error) {
    console.error('updateUserStatus failed:', error);
    throw new Error('Database error while updating user status.', { cause: error });
  }
}

export async function deleteUserByUid(uid: string) {
  try {
    const result = await db.delete(users)
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
  } catch (error) {
    console.error('deleteUserByUid failed:', error);
    throw new Error('Database error while deleting user.', { cause: error });
  }
}

// -----------------------------------------------------------------------------
// 2. ULDs Queries
// -----------------------------------------------------------------------------
export async function getUlds() {
  try {
    return await db.select().from(ulds).orderBy(desc(ulds.id));
  } catch (error) {
    console.error('getUlds failed:', error);
    throw new Error('Database error while retrieving ULDs.', { cause: error });
  }
}

export async function createUld(number: string, type: string, currentStation: string = 'DAC', status: string = 'ACTIVE', email: string) {
  try {
    // Insert ULD
    const result = await db.insert(ulds)
      .values({
        number,
        type,
        currentStation,
        status,
      })
      .returning();

    const newUld = result[0];

    // Log in tracking history
    await db.insert(uldHistory)
      .values({
        uldId: newUld.id,
        uldNumber: number,
        action: 'CREATE',
        originStation: null,
        destinationStation: currentStation,
        performedBy: email,
        remarks: `ULD created at station ${currentStation}`,
      });

    // Log in user logs
    await db.insert(userLogs)
      .values({
        userEmail: email,
        action: 'CREATE_ULD',
        status: 'SUCCESS',
        details: `Created ULD ${number} of type ${type} at ${currentStation}`,
      });

    return newUld;
  } catch (error) {
    console.error('createUld failed:', error);
    throw new Error('Database error while creating ULD. The ULD number might already exist.', { cause: error });
  }
}

export async function deleteUld(id: number, email: string) {
  try {
    const existingList = await db.select().from(ulds).where(eq(ulds.id, id));
    if (existingList.length === 0) {
      throw new Error('ULD not found');
    }
    const uld = existingList[0];

    // Delete ULD
    await db.delete(ulds).where(eq(ulds.id, id));

    // Log history
    await db.insert(uldHistory)
      .values({
        uldId: null, // Uld is deleted, keep history by number
        uldNumber: uld.number,
        action: 'REMOVE',
        originStation: uld.currentStation,
        destinationStation: null,
        performedBy: email,
        remarks: `ULD deleted from station ${uld.currentStation}`,
      });

    // Log user log
    await db.insert(userLogs)
      .values({
        userEmail: email,
        action: 'DELETE_ULD',
        status: 'SUCCESS',
        details: `Deleted ULD ${uld.number} from station ${uld.currentStation}`,
      });

    return { success: true, number: uld.number };
  } catch (error: any) {
    console.error('deleteUld failed:', error);
    throw new Error(error.message || 'Database error while deleting ULD.', { cause: error });
  }
}

export async function deleteUldsBatch(ids: number[], email: string) {
  try {
    const deletedNumbers: string[] = [];

    for (const id of ids) {
      const existingList = await db.select().from(ulds).where(eq(ulds.id, id));
      if (existingList.length > 0) {
        const uld = existingList[0];

        // Delete ULD
        await db.delete(ulds).where(eq(ulds.id, id));

        // Log history
        await db.insert(uldHistory)
          .values({
            uldId: null,
            uldNumber: uld.number,
            action: 'REMOVE',
            originStation: uld.currentStation,
            destinationStation: null,
            performedBy: email,
            remarks: `ULD batch deleted from station ${uld.currentStation}`,
          });

        deletedNumbers.push(uld.number);
      }
    }

    if (deletedNumbers.length > 0) {
      await db.insert(userLogs)
        .values({
          userEmail: email,
          action: 'DELETE_ULD_BATCH',
          status: 'SUCCESS',
          details: `Batch deleted ${deletedNumbers.length} ULDs: ${deletedNumbers.slice(0, 10).join(', ')}${deletedNumbers.length > 10 ? '...' : ''}`,
        });
    }

    return { success: true, count: deletedNumbers.length, numbers: deletedNumbers };
  } catch (error: any) {
    console.error('deleteUldsBatch failed:', error);
    throw new Error(error.message || 'Database error while deleting ULDs in batch.', { cause: error });
  }
}

export async function sendUlds(ids: number[], destination: string, origin: string = 'DAC', email: string, remarks?: string) {
  try {
    const updatedUlds = [];

    for (const id of ids) {
      const existing = await db.select().from(ulds).where(eq(ulds.id, id));
      if (existing.length === 0) continue;
      const uld = existing[0];

      // Update current station
      const updateResult = await db.update(ulds)
        .set({
          currentStation: destination,
          updatedAt: new Date(),
        })
        .where(eq(ulds.id, id))
        .returning();

      updatedUlds.push(updateResult[0]);

      // Log in tracking history
      await db.insert(uldHistory)
        .values({
          uldId: uld.id,
          uldNumber: uld.number,
          action: 'SEND',
          originStation: origin,
          destinationStation: destination,
          performedBy: email,
          remarks: remarks || `Sent from ${origin} to ${destination}`,
        });
    }

    // Log in user logs
    await db.insert(userLogs)
      .values({
        userEmail: email,
        action: 'SEND_ULD',
        status: 'SUCCESS',
        details: `Sent ${ids.length} ULDs from ${origin} to ${destination}. Remarks: ${remarks || 'None'}`,
      });

    return updatedUlds;
  } catch (error) {
    console.error('sendUlds failed:', error);
    throw new Error('Database error while sending ULDs.', { cause: error });
  }
}

export async function receiveUlds(ids: number[], origin: string, email: string) {
  try {
    const updatedUlds = [];

    for (const id of ids) {
      const existing = await db.select().from(ulds).where(eq(ulds.id, id));
      if (existing.length === 0) continue;
      const uld = existing[0];

      // Update current station to DAC
      const updateResult = await db.update(ulds)
        .set({
          currentStation: 'DAC',
          updatedAt: new Date(),
        })
        .where(eq(ulds.id, id))
        .returning();

      updatedUlds.push(updateResult[0]);

      // Log in tracking history
      await db.insert(uldHistory)
        .values({
          uldId: uld.id,
          uldNumber: uld.number,
          action: 'RECEIVE',
          originStation: origin,
          destinationStation: 'DAC',
          performedBy: email,
          remarks: `Received at DAC from ${origin}`,
        });
    }

    // Log in user logs
    await db.insert(userLogs)
      .values({
        userEmail: email,
        action: 'RECEIVE_ULD',
        status: 'SUCCESS',
        details: `Received ${ids.length} ULDs at DAC from ${origin}`,
      });

    return updatedUlds;
  } catch (error) {
    console.error('receiveUlds failed:', error);
    throw new Error('Database error while receiving ULDs.', { cause: error });
  }
}

export async function changeUldStatus(id: number, status: string, email: string) {
  try {
    const existing = await db.select().from(ulds).where(eq(ulds.id, id));
    if (existing.length === 0) {
      throw new Error('ULD not found');
    }
    const uld = existing[0];

    const result = await db.update(ulds)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(ulds.id, id))
      .returning();

    const updatedUld = result[0];

    // Log history
    await db.insert(uldHistory)
      .values({
        uldId: uld.id,
        uldNumber: uld.number,
        action: 'STATUS_CHANGE',
        originStation: uld.currentStation,
        destinationStation: uld.currentStation,
        performedBy: email,
        remarks: `Status changed from ${uld.status} to ${status}`,
      });

    // Log user logs
    await db.insert(userLogs)
      .values({
        userEmail: email,
        action: 'STATUS_CHANGE',
        status: 'SUCCESS',
        details: `Changed ULD ${uld.number} status to ${status}`,
      });

    return updatedUld;
  } catch (error: any) {
    console.error('changeUldStatus failed:', error);
    throw new Error(error.message || 'Database error while changing status.', { cause: error });
  }
}

export async function getUldHistory(number: string) {
  try {
    // Return history of ULD ordered by timestamp descending
    // This allows 3-month track record or longer
    return await db.select()
      .from(uldHistory)
      .where(eq(uldHistory.uldNumber, number))
      .orderBy(desc(uldHistory.timestamp));
  } catch (error) {
    console.error('getUldHistory failed:', error);
    throw new Error('Database error while retrieving ULD history.', { cause: error });
  }
}

// -----------------------------------------------------------------------------
// 3. Auditing / User Logs Queries
// -----------------------------------------------------------------------------
export async function getUserLogs() {
  try {
    return await db.select().from(userLogs).orderBy(desc(userLogs.timestamp));
  } catch (error) {
    console.error('getUserLogs failed:', error);
    throw new Error('Database error while retrieving audit logs.', { cause: error });
  }
}

export async function clearUserLogs(email: string) {
  try {
    await db.delete(userLogs);
    await insertUserLog(email, 'CLEAR_LOGS', 'SUCCESS', 'Cleared all system logs permanently.');
    return { success: true };
  } catch (error: any) {
    console.error('clearUserLogs failed:', error);
    throw new Error(error.message || 'Failed to clear system logs.', { cause: error });
  }
}

export async function insertUserLog(email: string, action: string, status: string, details?: string, ip?: string) {
  try {
    return await db.insert(userLogs)
      .values({
        userEmail: email,
        action,
        status,
        details,
        ipAddress: ip || null,
      })
      .returning();
  } catch (error) {
    console.error('insertUserLog failed:', error);
    // Silent fail in helper, we don't want to crash the main user operation
  }
}

// -----------------------------------------------------------------------------
// 4. Backups and Restore Queries
// -----------------------------------------------------------------------------
export async function getBackups() {
  try {
    // Only return metadata, not the heavy data column to keep it light
    return await db.select({
      id: backups.id,
      name: backups.name,
      description: backups.description,
      createdBy: backups.createdBy,
      createdAt: backups.createdAt,
    }).from(backups).orderBy(desc(backups.createdAt));
  } catch (error) {
    console.error('getBackups failed:', error);
    throw new Error('Database error while retrieving backups.', { cause: error });
  }
}

export async function createDatabaseBackup(name: string, description: string, email: string) {
  try {
    // Serialize all key tables
    const allUsers = await db.select().from(users);
    const allUlds = await db.select().from(ulds);
    const allHistory = await db.select().from(uldHistory);
    const allLogs = await db.select().from(userLogs);

    const serialized = JSON.stringify({
      users: allUsers,
      ulds: allUlds,
      uldHistory: allHistory,
      userLogs: allLogs,
    });

    const result = await db.insert(backups)
      .values({
        name,
        description,
        data: serialized,
        createdBy: email,
      })
      .returning();

    // Log the backup operation
    await insertUserLog(email, 'BACKUP_CREATE', 'SUCCESS', `Created full system backup: ${name}`);

    return result[0];
  } catch (error) {
    console.error('createDatabaseBackup failed:', error);
    throw new Error('Database error while creating backup.', { cause: error });
  }
}

export async function restoreDatabaseBackup(backupId: number, email: string) {
  try {
    // Retrieve the backup
    const backupResult = await db.select().from(backups).where(eq(backups.id, backupId));
    if (backupResult.length === 0) {
      throw new Error('Backup not found');
    }
    const backup = backupResult[0];

    const parsed = JSON.parse(backup.data);

    // Clear and restore tables inside a single transaction
    await db.transaction(async (tx) => {
      // Clear child tables first
      await tx.delete(uldHistory);
      await tx.delete(userLogs);
      await tx.delete(ulds);
      await tx.delete(users);

      // Restore Users
      if (parsed.users && parsed.users.length > 0) {
        const cleanUsers = mapRowDates(parsed.users, ['createdAt']);
        await tx.insert(users).values(cleanUsers as any);
      }

      // Restore ULDs
      if (parsed.ulds && parsed.ulds.length > 0) {
        const cleanUlds = mapRowDates(parsed.ulds, ['createdAt', 'updatedAt']);
        await tx.insert(ulds).values(cleanUlds as any);
      }

      // Restore History
      if (parsed.uldHistory && parsed.uldHistory.length > 0) {
        const cleanHistory = mapRowDates(parsed.uldHistory, ['timestamp']);
        await tx.insert(uldHistory).values(cleanHistory as any);
      }

      // Restore User Logs
      if (parsed.userLogs && parsed.userLogs.length > 0) {
        const cleanLogs = mapRowDates(parsed.userLogs, ['timestamp']);
        await tx.insert(userLogs).values(cleanLogs as any);
      }

      await syncSequences(tx);
    });

    // Log successful restore
    await insertUserLog(email, 'BACKUP_RESTORE', 'SUCCESS', `Restored system state from backup: ${backup.name}`);

    return { success: true, name: backup.name };
  } catch (error: any) {
    throw new Error(error.message || 'Database error while restoring backup.', { cause: error });
  }
}

export async function exportDatabaseData() {
  try {
    const allUsers = await db.select().from(users);
    const allUlds = await db.select().from(ulds);
    const allHistory = await db.select().from(uldHistory);
    const allLogs = await db.select().from(userLogs);
    const allBackups = await db.select().from(backups);

    return {
      users: allUsers,
      ulds: allUlds,
      uldHistory: allHistory,
      userLogs: allLogs,
      backups: allBackups,
    };
  } catch (error) {
    console.error('exportDatabaseData failed:', error);
    throw new Error('Database error during export.', { cause: error });
  }
}

export async function importDatabaseData(parsed: any, email: string) {
  try {
    await db.transaction(async (tx) => {
      // Clear all child and primary tables
      await tx.delete(uldHistory);
      await tx.delete(userLogs);
      await tx.delete(backups);
      await tx.delete(ulds);
      await tx.delete(users);

      // Restore Users
      if (parsed.users && parsed.users.length > 0) {
        const cleanUsers = mapRowDates(parsed.users, ['createdAt']);
        await tx.insert(users).values(cleanUsers as any);
      }

      // Restore ULDs
      if (parsed.ulds && parsed.ulds.length > 0) {
        const cleanUlds = mapRowDates(parsed.ulds, ['createdAt', 'updatedAt']);
        await tx.insert(ulds).values(cleanUlds as any);
      }

      // Restore History
      if (parsed.uldHistory && parsed.uldHistory.length > 0) {
        const cleanHistory = mapRowDates(parsed.uldHistory, ['timestamp']);
        await tx.insert(uldHistory).values(cleanHistory as any);
      }

      // Restore User Logs
      if (parsed.userLogs && parsed.userLogs.length > 0) {
        const cleanLogs = mapRowDates(parsed.userLogs, ['timestamp']);
        await tx.insert(userLogs).values(cleanLogs as any);
      }

      // Restore Backups (if any)
      if (parsed.backups && parsed.backups.length > 0) {
        const cleanBackups = mapRowDates(parsed.backups, ['createdAt']);
        await tx.insert(backups).values(cleanBackups as any);
      }

      await syncSequences(tx);
    });

    await insertUserLog(email, 'BACKUP_RESTORE_JSON', 'SUCCESS', 'Uploaded and fully restored database from external JSON backup.');
    return { success: true };
  } catch (error: any) {
    console.error('importDatabaseData failed:', error);
    throw new Error(error.message || 'Database error during backup restore.', { cause: error });
  }
}

export async function ensureTablesExist() {
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'visitor',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ulds (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        current_station TEXT NOT NULL DEFAULT 'DAC',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS uld_history (
        id SERIAL PRIMARY KEY,
        uld_id INTEGER REFERENCES ulds(id) ON DELETE CASCADE,
        uld_number TEXT NOT NULL,
        action TEXT NOT NULL,
        origin_station TEXT,
        destination_station TEXT,
        performed_by TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        remarks TEXT
      );

      CREATE TABLE IF NOT EXISTS user_logs (
        id SERIAL PRIMARY KEY,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        ip_address TEXT,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS backups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        data TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `));

    // Ensure default Admin accounts exist in users table
    const adminEmails = ['radoanrasel1122@gmail.com', 'codingmaster0088@gmail.com'];
    for (const adminEmail of adminEmails) {
      const mockUid = `mock-${adminEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;
      await db.execute(sql.raw(`
        INSERT INTO users (uid, email, password, role, status)
        VALUES ('${mockUid}', '${adminEmail}', 'radoan.1122', 'admin', 'approved')
        ON CONFLICT (email) DO UPDATE 
        SET role = 'admin', status = 'approved', password = 'radoan.1122';
      `));
    }

    console.log('[DB] Database tables and default admin accounts initialized successfully.');
  } catch (error) {
    console.error('[DB] Failed to ensure tables exist:', error);
  }
}

export async function seedUldsIfEmpty() {
  try {
    const existing = await db.select().from(ulds).limit(10);
    const hasOldFormat = existing.some(u => u.number.includes('UB') || u.number.startsWith('AKE0') || u.number.startsWith('PMC0'));

    if (existing.length > 0 && !hasOldFormat) {
      console.log('[SEED] Database already contains updated ULDs. Skipping auto-seeding.');
      return;
    }

    if (hasOldFormat) {
      console.log('[SEED] Detected old ULD format (e.g. AKE00...UB). Migrating database to AKE-1001 / PMC-10001 format...');
      await db.delete(uldHistory);
      await db.delete(ulds);
    }

    console.log('[SEED] Seeding 174 AKE units (AKE-1001 to AKE-1174) and 55 PMC units (PMC-10001 to PMC-10055)...');

    // Generate 174 AKE numbers: AKE-1001 to AKE-1174
    const akeUlds = [];
    for (let i = 1001; i <= 1174; i++) {
      akeUlds.push({
        number: `AKE-${i}`,
        type: 'AKE' as const,
        currentStation: 'DAC',
        status: 'ACTIVE' as const,
      });
    }

    // Generate 55 PMC numbers: PMC-10001 to PMC-10055
    const pmcUlds = [];
    for (let i = 10001; i <= 10055; i++) {
      pmcUlds.push({
        number: `PMC-${i}`,
        type: 'PMC' as const,
        currentStation: 'DAC',
        status: 'ACTIVE' as const,
      });
    }

    // Insert in batches of 50 to prevent parameter limit violations
    const allSeeds = [...akeUlds, ...pmcUlds];
    const batchSize = 50;
    for (let i = 0; i < allSeeds.length; i += batchSize) {
      const batch = allSeeds.slice(i, i + batchSize);
      await db.insert(ulds).values(batch);
    }

    console.log(`[SEED] Successfully seeded ${allSeeds.length} ULDs (174 AKE & 55 PMC) into database!`);
  } catch (error) {
    console.error('[SEED] Auto-seeding failed:', error);
  }
}
