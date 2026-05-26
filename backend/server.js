import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = process.env.PORT || 10000;
const databaseUrl = process.env.DATABASE_URL;
const frontendOrigin = process.env.FRONTEND_ORIGIN || '*';

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = neon(databaseUrl);

app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: frontendOrigin === '*' ? true : frontendOrigin }));

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

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

  const productCount = await sql`SELECT count(*)::int AS count FROM products`;
  if ((productCount[0]?.count || 0) === 0) {
    await sql`INSERT INTO products (product_name, product_code, description, category, price, stock_quantity, is_available) VALUES ('Chain of Custody Forms', 'COC-FORM', 'Standard collection forms.', 'Forms', 0, 500, true), ('Specimen Collection Cups', 'SPEC-CUP', 'Sterile specimen collection cups.', 'Collection Supplies', 0, 250, true), ('Tamper Evident Bags', 'TE-BAG', 'Secure transport bags.', 'Collection Supplies', 0, 400, true), ('Clinical Shipping Pak', 'SHIP-PAK', 'Shipping pak for supplies or documents.', 'Shipping', 0, 200, true)`;
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
    return res.json({ id: user.id, email: user.email, provider: user.provider, role: user.role });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/data', async (req, res) => {
  try {
    const table = String(req.query.table_name || '');
    if (table === 'products') {
      const rows = await sql`SELECT * FROM products ORDER BY category, product_name`;
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
      const rows = await sql`INSERT INTO users (email, password_hash, provider, role) VALUES (${data.email}, ${hash}, ${data.provider || 'email'}, ${data.role || 'clinic'}) RETURNING id, email, provider, role`;
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
