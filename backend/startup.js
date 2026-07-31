import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

const migrationName = 'admin_password_env_sync_v1';

async function synchronizeAdminPasswordOnce() {
  if (process.env.APP_MODE !== 'admin') return;

  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const adminName = String(process.env.ADMIN_NAME || 'Occu-Med Administrator').trim();

  if (!databaseUrl || !adminEmail || !adminPassword) {
    console.warn('Admin password synchronization skipped because DATABASE_URL, ADMIN_EMAIL, or ADMIN_PASSWORD is missing.');
    return;
  }

  const sql = neon(databaseUrl);

  await sql`CREATE TABLE IF NOT EXISTS app_migrations (
    name text PRIMARY KEY,
    run_at timestamptz NOT NULL DEFAULT now()
  )`;

  const tableCheck = await sql`SELECT to_regclass('public.users') AS users_table`;
  if (!tableCheck[0]?.users_table) {
    console.log('Users table is not initialized yet; the application will seed the Admin account normally.');
    return;
  }

  const completed = await sql`SELECT name FROM app_migrations WHERE name = ${migrationName} LIMIT 1`;
  if (completed.length) return;

  const existing = await sql`SELECT id FROM users WHERE lower(email) = ${adminEmail} LIMIT 1`;
  if (!existing.length) {
    console.log('Admin account is not initialized yet; the application will seed it normally.');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await sql`UPDATE users
    SET name = ${adminName},
        password_hash = ${passwordHash},
        role = 'admin',
        active = true,
        clinic_id = NULL,
        updated_at = now()
    WHERE id = ${existing[0].id}`;
  await sql`INSERT INTO app_migrations (name) VALUES (${migrationName}) ON CONFLICT DO NOTHING`;

  console.log('Admin password synchronized once from the Render environment.');
}

await synchronizeAdminPasswordOnce();
await import('./catalog-launcher.js');
