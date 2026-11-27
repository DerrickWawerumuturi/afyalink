import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

let pool = null;

const DEFAULT_SSL_CA = fileURLToPath(new URL('../../certs/supabase-pooler-ca.pem', import.meta.url));

function sslConfig() {
  const value = process.env.DATABASE_SSL;
  if (value === 'false') return false;
  if (value !== 'true' && !process.env.DATABASE_SSL_CA) return undefined;

  const caPath = process.env.DATABASE_SSL_CA || DEFAULT_SSL_CA;
  let ca;
  try {
    ca = fs.readFileSync(caPath, 'utf8');
  } catch {
    throw new Error(`Unable to read DATABASE_SSL_CA at ${caPath}`);
  }
  return { rejectUnauthorized: true, ca };
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL is not configured');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig(),
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (error) => {
      console.error('Unexpected database pool error:', error.message);
    });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(handler) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
