import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  password: text('password'), // User password
  role: text('role').notNull().default('visitor'), // 'admin', 'user', or 'visitor'
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for Users
export const usersRelations = relations(users, ({ many }) => ({
  uldHistory: many(uldHistory),
}));

// 2. ULDs Table (Containers and Pallets)
export const ulds = pgTable('ulds', {
  id: serial('id').primaryKey(),
  number: text('number').notNull().unique(), // e.g. AKE12345BG, PMC98765BG
  type: text('type').notNull(), // 'AKE' or 'PMC'
  status: text('status').notNull().default('ACTIVE'), // 'ACTIVE' or 'DAMAGED'
  currentStation: text('current_station').notNull().default('DAC'), // e.g. DAC, SIN, DXB
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. ULD History Table (Tracking records up to 3+ months)
export const uldHistory = pgTable('uld_history', {
  id: serial('id').primaryKey(),
  uldId: integer('uld_id').references(() => ulds.id, { onDelete: 'cascade' }),
  uldNumber: text('uld_number').notNull(), // Keep redundant for easy lookup and fallback
  action: text('action').notNull(), // 'CREATE', 'REMOVE', 'SEND', 'RECEIVE', 'STATUS_CHANGE'
  originStation: text('origin_station'), // e.g. 'DAC'
  destinationStation: text('destination_station'), // e.g. 'SIN'
  performedBy: text('performed_by').notNull(), // Email of the user who performed action
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  remarks: text('remarks'),
});

// Relations for ULD History
export const uldHistoryRelations = relations(uldHistory, ({ one }) => ({
  uld: one(ulds, {
    fields: [uldHistory.uldId],
    references: [ulds.id],
  }),
}));

// 4. User Logs & Auditing Table (Login, activity, access attempts)
export const userLogs = pgTable('user_logs', {
  id: serial('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  action: text('action').notNull(), // 'LOGIN', 'LOGOUT', 'CREATE_ULD', 'DELETE_ULD', 'SEND_ULD', 'RECEIVE_ULD', 'STATUS_CHANGE', 'BACKUP_CREATE', 'BACKUP_RESTORE', 'UNAUTHORIZED_ACCESS_ATTEMPT'
  status: text('status').notNull(), // 'SUCCESS', 'FAILURE', 'ALERT', 'SUSPICIOUS'
  ipAddress: text('ip_address'),
  details: text('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// 5. Backups Table (Full database state serialization)
export const backups = pgTable('backups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // e.g., "Backup_2026_07_18_08_44"
  description: text('description'),
  data: text('data').notNull(), // JSON serialized database tables string
  createdBy: text('created_by').notNull(), // Email of creator
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
