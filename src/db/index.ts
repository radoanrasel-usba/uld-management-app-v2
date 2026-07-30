import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pkg;

export const createPool = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const requiresSSL =
      dbUrl.includes('supabase.co') ||
      dbUrl.includes('render.com') ||
      dbUrl.includes('sslmode=require') ||
      dbUrl.includes('sslmode=no-verify') ||
      dbUrl.includes('ssl=true');

    return new Pool({
      connectionString: dbUrl,
      ssl: requiresSSL ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10,
      keepAlive: true,
    });
  }

  const host = process.env.SQL_HOST;
  const requiresSSL =
    Boolean(host) &&
    !host?.includes('localhost') &&
    !host?.includes('127.0.0.1') &&
    (host?.includes('supabase.co') || host?.includes('render.com') || process.env.NODE_ENV === 'production');

  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });
};

const pool = createPool();

pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

export const db = drizzle(pool, { schema });
export { schema };
