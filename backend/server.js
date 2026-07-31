import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';
import { sendPlainEmail } from './mailer.js';

const app = express();
const port = process.env.PORT || 10000;
const databaseUrl = process.env.DATABASE_URL;
const frontendOrigin = process.env.FRONTEND_ORIGIN || '';
const publicFrontendUrl = (process.env.PUBLIC_FRONTEND_URL || 'https://occu-med-lab-supplies-clinic.onrender.com').replace(/\/$/, '');
const adminEmail = process.env.ADMIN_EMAIL || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = neon(databaseUrl);

const allowedOrigins = new Set([
  ...frontendOrigin.split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean),
  publicFrontendUrl,
  'https://occu-med-lab-supplies-clinic.onrender.com',
  'https://lab-supplies-order.onrender.com'
]);

app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has('*') || allowedOrigins.has(origin) || /^https?:\/\/localhost(?::\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  }
}));

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function normalizeRole(role) {
  return role === 'clinic_user' ? 'clinic' : role;
}

function validNewPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function normalizeOrder(row) {
  return {
    ...row,
    subtotal: n(row.subtotal),
    shipping_cost: n(row.shipping_cost),
    total_cost: n(row.total_cost),
    order_items: Array.isArray(row.order_items) ? row.order_items : JSON.parse(row.order_items || '[]')
  };
}

async function initDb() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), email text UNIQUE NOT NULL, password_hash text NOT NULL, provider text NOT NULL DEFAULT 'email', role text NOT NULL DEFAULT 'clinic', created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS clinics (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid REFERENCES users(id) ON DELETE SET NULL, clinic_name text NOT NULL, phone text, address text, city text, state text, zip_code text, account_status text NOT NULL DEFAULT 'Active', last_order_date date, created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS products (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), product_name text NOT NULL, product_code text NOT NULL UNIQUE, description text, category text NOT NULL DEFAULT 'General', price numeric(10,2) NOT NULL DEFAULT 0, stock_quantity integer NOT NULL DEFAULT 0, is_available boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS orders (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL, order_number text NOT NULL UNIQUE, order_status text NOT NULL DEFAULT 'Pending', delivery_address text, delivery_city text, delivery_state text, delivery_zip text, delivery_method text, special_instructions text, subtotal numeric(10,2) NOT NULL DEFAULT 0, shipping_cost numeric(10,2) NOT NULL DEFAULT 0, total_cost numeric(10,2) NOT NULL DEFAULT 0, estimated_delivery_date date, order_items jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS invitations (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL, clinic_email text NOT NULL, clinic_name text NOT NULL, invitation_message text, invitation_status text NOT NULL DEFAULT 'Sent', token text UNIQUE NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz)`;
  await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at)`;

  const productCatalog = [
    ['Labcorp Clinical Collection Kit', 'LABCORP-KIT', 'Complete Labcorp clinical collection kit.', 'Collection Kits'],
    ['CRL Clinical Collection Kit', 'CRL-KIT', 'Complete Clinical Reference Laboratory collection kit.', 'Collection Kits'],
    ['FedEx Shipping Envelope', 'SHIP-PAK', 'FedEx clinical shipping envelope for specimen transport.', 'Shipping'],
    ['Lithium Heparin Green-Top Tubes', 'TUBE-HEPARIN', 'Lithium heparin tubes for plasma collections.', 'Collection Tubes'],
    ['EDTA Lavender-Top Tubes', 'TUBE-EDTA', 'EDTA tubes for hematology collections.', 'Collection Tubes'],
    ['Plain Serum Red-Top Tubes', 'TUBE-RED', 'Plain serum tubes without separator gel.', 'Collection Tubes'],
    ['Sodium Citrate Light-Blue-Top Tubes', 'TUBE-CITRATE', 'Sodium citrate tubes for coagulation testing.', 'Collection Tubes'],
    ['Tiger-Top SST Tubes', 'TUBE-TIGER', 'Tiger-top serum separator tubes.', 'Collection Tubes'],
    ['Gold SST Tubes', 'TUBE-SST', 'Gold-top serum separator tubes for chemistry and serology testing.', 'Collection Tubes'],
    ['Royal Blue Trace Element Tubes', 'TUBE-TRACE', 'Royal-blue tubes for trace-element collections.', 'Collection Tubes'],
    ['Exempt Human Specimen Box', 'EXEMPT-BOX', 'Compliant outer box for exempt human specimen shipments.', 'Shipping'],
    ['FedEx Shipping Labels', 'FEDEX-LABEL', 'FedEx labels for clinical specimen shipments.', 'Shipping'],
    ['Biohazard Bags', 'BIO-BAG', 'Leak-resistant specimen transport bags with document pouch.', 'Shipping'],
    ['Labcorp Split Urine Cups', 'LABCORP-CUP', 'Split urine collection cups for Labcorp drug-screen specimens.', 'Labcorp'],
    ['CRL Split Urine Cups', 'CRL-CUP', 'Split urine collection cups for CRL drug-screen specimens.', 'CRL'],
    ['Labcorp Chain of Custody Forms', 'LABCORP-CCF', 'Chain-of-custody forms for Labcorp drug-screen collections.', 'Labcorp'],
    ['CRL Chain of Custody Forms', 'CRL-CCF', 'Laboratory chain-of-custody forms for CRL collections.', 'CRL'],
    ['Labcorp Lab Requisition Forms', 'LABCORP-REQ', 'Blank Labcorp laboratory requisition forms.', 'Labcorp'],
    ['CRL Lab Requisition Forms', 'CRL-REQ', 'Blank CRL laboratory requisition forms.', 'CRL']
  ];

  for (const [productName, productCode, description, category] of productCatalog) {
    await sql`INSERT INTO products (product_name, product_code, description, category, price, stock_quantity, is_available)
      VALUES (${productName}, ${productCode}, ${description}, ${category}, 0, 9999, true)
      ON CONFLICT (product_code) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        stock_quantity = 9999,
        is_available = true`;
  }

  await sql`UPDATE products
    SET is_available = false
    WHERE product_code IN ('COC-FORM', 'SPEC-CUP', 'TE-BAG', 'URINE-CUP', 'TUBE-GRAY', 'ABSORBENT', 'LABELS')`;

  await sql`UPDATE users SET role = 'clinic' WHERE role = 'clinic_user'`;
  await sql`DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day' OR used_at IS NOT NULL`;

  if (adminEmail && adminPassword) {
    const existing = await sql`SELECT id FROM users WHERE lower(email) = lower(${adminEmail}) LIMIT 1`;
    if (existing.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await sql`INSERT INTO users (email, password_hash, provider, role) VALUES (${adminEmail}, ${hash}, 'email', 'admin')`;
    }
  }
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'lab-supplies-order-api' }));
app.get('/', (_req, res) => res.json({ service: 'lab-supplies-order-api', status: 'running' }));

app.post('/data/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const rows = await sql`SELECT id, email, password_hash, provider, role FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ id: user.id, email: user.email, provider: user.provider, role: normalizeRole(user.role) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const rows = await sql`SELECT id, email FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
    const user = rows[0];

    if (user) {
      await sql`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ${user.id} AND used_at IS NULL`;

      const token = crypto.randomBytes(32).toString('hex');
      const hash = tokenHash(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (${user.id}, ${hash}, ${expiresAt})`;

      const requestOrigin = String(req.headers.origin || '').replace(/\/$/, '');
      const resetBaseUrl = allowedOrigins.has(requestOrigin) ? requestOrigin : publicFrontendUrl;
      const resetUrl = `${resetBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      try {
        const result = await sendPlainEmail({
          to: user.email,
          subject: 'Reset your OCCU-MED Lab Supply Portal password',
          text: `Use the link below within 30 minutes to set a new password:\n\n${resetUrl}\n\nIf you did not request this reset, you can ignore this message.`
        });
        if (result?.skipped) {
          console.error('Password reset email skipped because SMTP is not configured.');
        }
      } catch (mailError) {
        console.error('Failed to send password reset email:', mailError);
      }
    }

    return res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not start the password reset.' });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const newPassword = String(req.body?.password || '');
    if (!token) return res.status(400).json({ error: 'Reset token is required.' });
    if (!validNewPassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.' });
    }

    const hash = tokenHash(token);
    const rows = await sql`SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ${hash} AND used_at IS NULL AND expires_at > now() LIMIT 1`;
    const reset = rows[0];
    if (!reset) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await sql.transaction([
      sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${reset.user_id}`,
      sql`UPDATE password_reset_tokens SET used_at = now() WHERE id = ${reset.id}`,
      sql`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ${reset.user_id} AND used_at IS NULL`
    ]);

    return res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not reset the password.' });
  }
});

app.get('/data', async (req, res) => {
  try {
    const table = String(req.query.table_name || '');
    if (table === 'products') {
      const rows = await sql`SELECT * FROM products WHERE is_available = true ORDER BY category, product_name`;
      return res.json(rows.map((p) => ({ ...p, price: n(p.price) })));
    }
    if (table === 'clinics') {
      if (req.query.user_id) return res.json(await sql`SELECT * FROM clinics WHERE user_id = ${req.query.user_id} ORDER BY clinic_name`);
      return res.json(await sql`SELECT * FROM clinics ORDER BY clinic_name`);
    }
    if (table === 'orders') {
      const rows = req.query.clinic_id ? await sql`SELECT * FROM orders WHERE clinic_id = ${req.query.clinic_id} ORDER BY created_at DESC` : await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return res.json(rows.map(normalizeOrder));
    }
    if (table === 'invitations') return res.json(await sql`SELECT * FROM invitations ORDER BY sent_at DESC`);
    return res.status(400).json({ error: 'Unsupported table_name' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Data request failed' });
  }
});

app.post('/data', async (req, res) => {
  try {
    const table = req.body?.table_name;
    const data = req.body?.data || {};
    if (table === 'users') {
      if (!data.email || !data.password) return res.status(400).json({ error: 'Email and password are required.' });
      const hash = await bcrypt.hash(data.password, 12);
      const rows = await sql`INSERT INTO users (email, password_hash, provider, role) VALUES (${data.email}, ${hash}, ${data.provider || 'email'}, ${normalizeRole(data.role || 'clinic')}) RETURNING id, email, provider, role`;
      return res.json(rows[0]);
    }
    if (table === 'clinics') {
      if (data.id) {
        const rows = await sql`UPDATE clinics SET clinic_name=${data.clinic_name}, phone=${data.phone}, address=${data.address}, city=${data.city}, state=${data.state}, zip_code=${data.zip_code}, account_status=${data.account_status || 'Active'} WHERE id=${data.id} RETURNING *`;
        return res.json(rows[0]);
      }
      const rows = await sql`INSERT INTO clinics (user_id, clinic_name, phone, address, city, state, zip_code, account_status, last_order_date) VALUES (${data.user_id}, ${data.clinic_name}, ${data.phone}, ${data.address}, ${data.city}, ${data.state}, ${data.zip_code}, ${data.account_status || 'Active'}, ${data.last_order_date || null}) RETURNING *`;
      return res.json(rows[0]);
    }
    if (table === 'orders') {
      const rows = await sql`INSERT INTO orders (clinic_id, order_number, order_status, delivery_address, delivery_city, delivery_state, delivery_zip, delivery_method, special_instructions, subtotal, shipping_cost, total_cost, estimated_delivery_date, order_items) VALUES (${data.clinic_id}, ${data.order_number}, ${data.order_status || 'Pending'}, ${data.delivery_address}, ${data.delivery_city}, ${data.delivery_state}, ${data.delivery_zip}, ${data.delivery_method}, ${data.special_instructions || ''}, ${n(data.subtotal)}, ${n(data.shipping_cost)}, ${n(data.total_cost)}, ${data.estimated_delivery_date}, ${JSON.stringify(data.order_items || [])}::jsonb) RETURNING *`;
      await sql`UPDATE clinics SET last_order_date = CURRENT_DATE WHERE id = ${data.clinic_id}`;
      return res.json(normalizeOrder(rows[0]));
    }
    if (table === 'invitations') {
      const token = uuidv4();
      const rows = await sql`INSERT INTO invitations (admin_user_id, clinic_email, clinic_name, invitation_message, invitation_status, token) VALUES (${data.admin_user_id || null}, ${data.clinic_email}, ${data.clinic_name}, ${data.invitation_message || ''}, 'Sent', ${token}) RETURNING *`;
      return res.json(rows[0]);
    }
    return res.status(400).json({ error: 'Unsupported table_name' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Data write failed' });
  }
});

initDb().then(() => {
  app.listen(port, '0.0.0.0', () => console.log(`Lab Supplies API listening on ${port}`));
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
