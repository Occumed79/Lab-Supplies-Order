import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendPlainEmail } from './mailer.js';

const app = express();
const port = Number(process.env.PORT || 10000);
const databaseUrl = process.env.DATABASE_URL;
const appMode = process.env.APP_MODE === 'admin' ? 'admin' : 'clinic';
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || '');
const adminName = String(process.env.ADMIN_NAME || 'Occu-Med Administrator').trim();
const notificationEmail = String(
  process.env.ORDER_NOTIFICATION_EMAIL ||
  process.env.SUPPLY_REQUEST_INBOX ||
  adminEmail,
).trim();
const frontendOrigins = String(process.env.FRONTEND_ORIGIN || '*').split(',').map((value) => value.trim()).filter(Boolean);

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const authSecret = process.env.AUTH_SECRET || process.env.JWT_SECRET || `${databaseUrl}:${appMode}:${adminEmail}:occu-med-lab-portal`;
const sql = neon(databaseUrl);
const allowedStatuses = ['Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes('*') || frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
}));

const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const cleanEmail = (value) => clean(value, 254).toLowerCase();
const positiveInt = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

function serializeUser(user, clinicName = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    clinic_id: user.clinic_id ?? null,
    clinic_name: clinicName,
    last_login_at: user.last_login_at ?? null,
    created_at: user.created_at,
  };
}

function signUser(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role, clinicId: user.clinic_id ?? null, mode: appMode },
    authSecret,
    { expiresIn: '12h', issuer: 'occu-med-lab-supply-portal' },
  );
}

function authRequired(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const auth = jwt.verify(token, authSecret, { issuer: 'occu-med-lab-supply-portal' });
    if (auth.mode !== appMode) return res.status(401).json({ error: 'This session belongs to the other portal.' });
    req.auth = auth;
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

const roleRequired = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth?.role)) return res.status(403).json({ error: 'You do not have access to this action.' });
  return next();
};

const modeRequired = (mode) => (_req, res, next) => {
  if (appMode !== mode) return res.status(404).json({ error: 'Not found.' });
  return next();
};

async function clinicById(id) {
  if (!id || !uuidPattern.test(String(id))) return null;
  const rows = await sql`SELECT * FROM clinics WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

async function clinicForUser(userId) {
  const rows = await sql`
    SELECT c.* FROM users u
    JOIN clinics c ON c.id = u.clinic_id
    WHERE u.id = ${userId} LIMIT 1
  `;
  return rows[0] || null;
}

function normalizeOrder(row) {
  return {
    ...row,
    order_items: Array.isArray(row.order_items) ? row.order_items : JSON.parse(row.order_items || '[]'),
  };
}

async function initDb() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    provider text NOT NULL DEFAULT 'email',
    role text NOT NULL DEFAULT 'clinic_user',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS clinics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    clinic_name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    zip_code text,
    account_status text NOT NULL DEFAULT 'Active',
    last_order_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE clinics ADD COLUMN IF NOT EXISTS contact_name text`;
  await sql`ALTER TABLE clinics ADD COLUMN IF NOT EXISTS email text`;
  await sql`ALTER TABLE clinics ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name text`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
  await sql`UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL OR name = ''`;
  await sql`UPDATE users SET role = 'clinic_user' WHERE role = 'clinic'`;
  await sql`UPDATE users u SET clinic_id = c.id FROM clinics c WHERE c.user_id = u.id AND u.clinic_id IS NULL`;
  await sql`UPDATE clinics c SET email = u.email FROM users u WHERE c.user_id = u.id AND (c.email IS NULL OR c.email = '')`;

  await sql`CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name text NOT NULL,
    product_code text NOT NULL UNIQUE,
    description text,
    category text NOT NULL DEFAULT 'General',
    unit_label text NOT NULL DEFAULT 'Each',
    display_order integer NOT NULL DEFAULT 0,
    price numeric(10,2) NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'Each'`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0`;

  await sql`CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
    submitted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    order_number text NOT NULL UNIQUE,
    order_status text NOT NULL DEFAULT 'Pending',
    requested_by text,
    needed_by date,
    delivery_address text,
    delivery_city text,
    delivery_state text,
    delivery_zip text,
    delivery_method text,
    special_instructions text,
    tracking_number text,
    shipped_at timestamptz,
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
    total_cost numeric(10,2) NOT NULL DEFAULT 0,
    estimated_delivery_date date,
    order_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_by text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS needed_by date`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

  const supplies = [
    ['CRL-CCF', 'CRL Chain of Custody Forms', 'Laboratory chain-of-custody forms for CRL collections.', 'CRL', 'Pack', 10],
    ['CRL-CUP', 'CRL Drug Screen Collection Cups', 'Sealed collection cups for CRL drug-screen specimens.', 'CRL', 'Case', 20],
    ['LABCORP-REQ', 'Labcorp Requisition Forms', 'Blank Labcorp laboratory requisition forms.', 'Labcorp', 'Pack', 30],
    ['LABCORP-CCF', 'Labcorp Chain of Custody Forms', 'Chain-of-custody forms for Labcorp drug-screen collections.', 'Labcorp', 'Pack', 40],
    ['URINE-CUP', 'Urine Specimen Collection Cups', 'Sterile urine specimen cups with secure lids.', 'Collection Supplies', 'Case', 50],
    ['TUBE-SST', 'SST Gold-Top Tubes', 'Serum separator tubes for chemistry and serology testing.', 'Collection Tubes', 'Box', 60],
    ['TUBE-EDTA', 'EDTA Lavender-Top Tubes', 'EDTA tubes for hematology collections.', 'Collection Tubes', 'Box', 70],
    ['TUBE-GRAY', 'Gray-Top Tubes', 'Fluoride/oxalate tubes for glucose-related testing.', 'Collection Tubes', 'Box', 80],
    ['BIO-BAG', 'Biohazard Specimen Bags', 'Leak-resistant specimen transport bags with document pouch.', 'Shipping', 'Pack', 90],
    ['SHIP-PAK', 'Clinical Shipping Paks', 'Compliant outer packaging for specimen or supply shipment.', 'Shipping', 'Pack', 100],
    ['ABSORBENT', 'Absorbent Sheets', 'Absorbent material for compliant specimen packaging.', 'Shipping', 'Pack', 110],
    ['LABELS', 'Specimen Labels', 'Blank specimen identification labels.', 'Collection Supplies', 'Roll', 120],
  ];

  for (const [code, name, description, category, unit, displayOrder] of supplies) {
    await sql`INSERT INTO products (product_code, product_name, description, category, unit_label, display_order, price, stock_quantity, is_available)
      VALUES (${code}, ${name}, ${description}, ${category}, ${unit}, ${displayOrder}, 0, 9999, true)
      ON CONFLICT (product_code) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        unit_label = EXCLUDED.unit_label,
        display_order = EXCLUDED.display_order`;
  }

  if (adminEmail && adminPassword) {
    const existing = await sql`SELECT id FROM users WHERE lower(email) = ${adminEmail} LIMIT 1`;
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    if (existing.length === 0) {
      await sql`INSERT INTO users (name, email, password_hash, provider, role, active) VALUES (${adminName}, ${adminEmail}, ${passwordHash}, 'email', 'admin', true)`;
    } else {
      await sql`UPDATE users SET name = ${adminName}, role = 'admin', active = true, password_hash = ${passwordHash}, clinic_id = NULL, updated_at = now() WHERE id = ${existing[0].id}`;
    }
  }
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'lab-supplies-order', mode: appMode }));

app.post('/auth/login', async (req, res) => {
  try {
    const loginEmail = cleanEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const rows = await sql`SELECT * FROM users WHERE lower(email) = ${loginEmail} LIMIT 1`;
    const user = rows[0];
    const requiredRole = appMode === 'admin' ? 'admin' : 'clinic_user';
    if (!user || user.role !== requiredRole || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const clinic = user.role === 'clinic_user' ? await clinicForUser(user.id) : null;
    if (user.role === 'clinic_user' && (!clinic || clinic.account_status !== 'Active')) {
      return res.status(403).json({ error: 'This clinic account is not active.' });
    }
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
    return res.json({ token: signUser(user), user: serializeUser(user, clinic?.clinic_name || null), clinic, mode: appMode });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/me', authRequired, async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE id = ${req.auth.sub} LIMIT 1`;
  const user = rows[0];
  if (!user || !user.active) return res.status(401).json({ error: 'Account is not active.' });
  const clinic = user.role === 'clinic_user' ? await clinicForUser(user.id) : null;
  return res.json({ user: serializeUser(user, clinic?.clinic_name || null), clinic, mode: appMode });
});

app.get('/products', modeRequired('clinic'), authRequired, roleRequired('clinic_user'), async (_req, res) => {
  const rows = await sql`SELECT id, product_name, product_code, description, category, unit_label, is_available FROM products WHERE is_available = true ORDER BY display_order, category, product_name`;
  return res.json(rows);
});

app.get('/clinic/profile', modeRequired('clinic'), authRequired, roleRequired('clinic_user'), async (req, res) => {
  const clinic = await clinicForUser(req.auth.sub);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  return res.json(clinic);
});

app.get('/orders', authRequired, async (req, res) => {
  try {
    let rows;
    if (appMode === 'admin' && req.auth.role === 'admin') {
      rows = await sql`
        SELECT o.*, c.clinic_name, c.email AS clinic_email, u.name AS submitted_by_name
        FROM orders o
        LEFT JOIN clinics c ON c.id = o.clinic_id
        LEFT JOIN users u ON u.id = o.submitted_by_user_id
        ORDER BY o.created_at DESC
      `;
    } else if (appMode === 'clinic' && req.auth.role === 'clinic_user') {
      const clinic = await clinicForUser(req.auth.sub);
      rows = clinic ? await sql`
        SELECT o.*, c.clinic_name, c.email AS clinic_email, u.name AS submitted_by_name
        FROM orders o
        LEFT JOIN clinics c ON c.id = o.clinic_id
        LEFT JOIN users u ON u.id = o.submitted_by_user_id
        WHERE o.clinic_id = ${clinic.id}
        ORDER BY o.created_at DESC
      ` : [];
    } else {
      return res.status(403).json({ error: 'You do not have access to these requests.' });
    }
    return res.json(rows.map(normalizeOrder));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load requests.' });
  }
});

app.post('/orders', modeRequired('clinic'), authRequired, roleRequired('clinic_user'), async (req, res) => {
  try {
    const clinic = await clinicForUser(req.auth.sub);
    if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const quantities = new Map(requestedItems.map((item) => [String(item.product_id), positiveInt(item.quantity)]).filter(([, quantity]) => quantity > 0));
    if (!quantities.size) return res.status(400).json({ error: 'Select at least one supply item.' });

    const products = await sql`SELECT id, product_name, product_code, category, unit_label FROM products WHERE is_available = true ORDER BY display_order`;
    const orderItems = products.filter((product) => quantities.has(product.id)).map((product) => ({
      product_id: product.id,
      product_name: product.product_name,
      product_code: product.product_code,
      category: product.category,
      unit_label: product.unit_label,
      quantity: quantities.get(product.id),
    }));
    if (!orderItems.length) return res.status(400).json({ error: 'No valid supply items were selected.' });

    const orderNumber = `LS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const neededBy = clean(req.body?.needed_by, 10) || null;
    const requestedBy = clean(req.body?.requested_by || req.auth.name, 160);
    const instructions = clean(req.body?.special_instructions, 2000);
    const rows = await sql`INSERT INTO orders (
      clinic_id, submitted_by_user_id, order_number, order_status, requested_by, needed_by,
      delivery_address, delivery_city, delivery_state, delivery_zip,
      delivery_method, special_instructions, subtotal, shipping_cost, total_cost,
      estimated_delivery_date, order_items
    ) VALUES (
      ${clinic.id}, ${req.auth.sub}, ${orderNumber}, 'Pending', ${requestedBy}, ${neededBy},
      ${clinic.address}, ${clinic.city}, ${clinic.state}, ${clinic.zip_code},
      'Occu-Med Fulfillment', ${instructions}, 0, 0, 0,
      ${neededBy}, ${JSON.stringify(orderItems)}::jsonb
    ) RETURNING *`;
    await sql`UPDATE clinics SET last_order_date = CURRENT_DATE, updated_at = now() WHERE id = ${clinic.id}`;

    const summary = orderItems.map((item) => `- ${item.product_name}: ${item.quantity} ${item.unit_label}`).join('\n');
    await Promise.allSettled([
      notificationEmail ? sendPlainEmail({
        to: notificationEmail,
        subject: `New lab supply request ${orderNumber} — ${clinic.clinic_name}`,
        text: `${clinic.clinic_name} submitted a lab supply request.\n\n${summary}\n\nNeeded by: ${neededBy || 'Not specified'}\nRequested by: ${requestedBy || 'Not specified'}\nInstructions: ${instructions || 'None'}`,
      }) : Promise.resolve(),
      clinic.email ? sendPlainEmail({
        to: clinic.email,
        subject: `Occu-Med lab supply request received — ${orderNumber}`,
        text: `Your lab supply request has been received and is pending review.\n\n${summary}`,
      }) : Promise.resolve(),
    ]);

    return res.status(201).json(normalizeOrder(rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not submit the supply request.' });
  }
});

app.get('/admin/clinics', modeRequired('admin'), authRequired, roleRequired('admin'), async (_req, res) => {
  const rows = await sql`
    SELECT c.*,
      (SELECT count(*)::int FROM users u WHERE u.clinic_id = c.id) AS user_count,
      (SELECT count(*)::int FROM orders o WHERE o.clinic_id = c.id) AS order_count
    FROM clinics c ORDER BY c.clinic_name
  `;
  return res.json(rows);
});

app.post('/admin/clinics', modeRequired('admin'), authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const clinicName = clean(req.body?.clinic_name, 200);
    if (!clinicName) return res.status(400).json({ error: 'Clinic name is required.' });
    const rows = await sql`INSERT INTO clinics (clinic_name, contact_name, email, phone, address, city, state, zip_code, account_status)
      VALUES (${clinicName}, ${clean(req.body?.contact_name, 160)}, ${cleanEmail(req.body?.email)}, ${clean(req.body?.phone, 50)}, ${clean(req.body?.address, 250)}, ${clean(req.body?.city, 120)}, ${clean(req.body?.state, 80)}, ${clean(req.body?.zip_code, 30)}, 'Active') RETURNING *`;
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not create clinic.' });
  }
});

app.patch('/admin/clinics/:id', modeRequired('admin'), authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const clinic = await clinicById(req.params.id);
    if (!clinic) return res.status(404).json({ error: 'Clinic not found.' });
    const status = req.body?.account_status === 'Inactive' ? 'Inactive' : 'Active';
    const rows = await sql`UPDATE clinics SET
      clinic_name = ${clean(req.body?.clinic_name ?? clinic.clinic_name, 200)},
      contact_name = ${clean(req.body?.contact_name ?? clinic.contact_name, 160)},
      email = ${cleanEmail(req.body?.email ?? clinic.email)},
      phone = ${clean(req.body?.phone ?? clinic.phone, 50)},
      address = ${clean(req.body?.address ?? clinic.address, 250)},
      city = ${clean(req.body?.city ?? clinic.city, 120)},
      state = ${clean(req.body?.state ?? clinic.state, 80)},
      zip_code = ${clean(req.body?.zip_code ?? clinic.zip_code, 30)},
      account_status = ${status}, updated_at = now()
      WHERE id = ${clinic.id} RETURNING *`;
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update clinic.' });
  }
});

app.get('/admin/users', modeRequired('admin'), authRequired, roleRequired('admin'), async (_req, res) => {
  const rows = await sql`
    SELECT u.*, c.clinic_name
    FROM users u LEFT JOIN clinics c ON c.id = u.clinic_id
    WHERE u.role = 'clinic_user'
    ORDER BY c.clinic_name NULLS LAST, u.name, u.email
  `;
  return res.json(rows.map((row) => serializeUser(row, row.clinic_name || null)));
});

app.post('/admin/users', modeRequired('admin'), authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const name = clean(req.body?.name, 160);
    const userEmail = cleanEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const clinic = await clinicById(req.body?.clinic_id);
    if (!name || !userEmail || password.length < 8 || !clinic) return res.status(400).json({ error: 'Name, valid email, 8-character password, and clinic are required.' });
    const duplicate = await sql`SELECT id FROM users WHERE lower(email) = ${userEmail} LIMIT 1`;
    if (duplicate.length) return res.status(409).json({ error: 'A user with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await sql`INSERT INTO users (name, email, password_hash, provider, role, active, clinic_id)
      VALUES (${name}, ${userEmail}, ${passwordHash}, 'email', 'clinic_user', true, ${clinic.id}) RETURNING *`;
    return res.status(201).json(serializeUser(rows[0], clinic.clinic_name));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not create clinic user.' });
  }
});

app.patch('/admin/users/:id', modeRequired('admin'), authRequired, roleRequired('admin'), async (req, res) => {
  try {
    if (!uuidPattern.test(String(req.params.id))) return res.status(400).json({ error: 'Invalid user id.' });
    const rows = await sql`SELECT * FROM users WHERE id = ${req.params.id} AND role = 'clinic_user' LIMIT 1`;
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Clinic user not found.' });

    let clinicId = user.clinic_id;
    if (req.body?.clinic_id !== undefined) {
      const clinic = await clinicById(req.body.clinic_id);
      if (!clinic) return res.status(400).json({ error: 'Select a valid clinic.' });
      clinicId = clinic.id;
    }
    let passwordHash = user.password_hash;
    if (req.body?.password !== undefined) {
      const password = String(req.body.password || '');
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      passwordHash = await bcrypt.hash(password, 12);
    }
    const active = req.body?.active === undefined ? user.active : Boolean(req.body.active);
    const name = req.body?.name === undefined ? user.name : clean(req.body.name, 160);
    const updated = await sql`UPDATE users SET name = ${name}, active = ${active}, clinic_id = ${clinicId}, password_hash = ${passwordHash}, updated_at = now() WHERE id = ${user.id} RETURNING *`;
    const clinic = await clinicById(clinicId);
    return res.json(serializeUser(updated[0], clinic?.clinic_name || null));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update clinic user.' });
  }
});

app.delete('/admin/users/:id', modeRequired('admin'), authRequired, roleRequired('admin'), async (req, res) => {
  try {
    if (!uuidPattern.test(String(req.params.id))) return res.status(400).json({ error: 'Invalid user id.' });
    const rows = await sql`DELETE FROM users WHERE id = ${req.params.id} AND role = 'clinic_user' RETURNING id`;
    if (!rows.length) return res.status(404).json({ error: 'Clinic user not found.' });
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not delete clinic user.' });
  }
});

app.patch('/admin/orders/:id', modeRequired('admin'), authRequired, roleRequired('admin'), async (req, res) => {
  try {
    if (!uuidPattern.test(String(req.params.id))) return res.status(400).json({ error: 'Invalid request id.' });
    const status = clean(req.body?.order_status, 30);
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid request status.' });
    const trackingNumber = clean(req.body?.tracking_number, 150);
    const rows = await sql`UPDATE orders SET
      order_status = ${status}, tracking_number = ${trackingNumber},
      shipped_at = CASE WHEN ${status} = 'Shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END,
      updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Request not found.' });
    const clinicRows = await sql`SELECT c.email FROM clinics c JOIN orders o ON o.clinic_id = c.id WHERE o.id = ${rows[0].id} LIMIT 1`;
    if (clinicRows[0]?.email) {
      await sendPlainEmail({
        to: clinicRows[0].email,
        subject: `Lab supply request ${rows[0].order_number}: ${status}`,
        text: `Your Occu-Med lab supply request is now ${status}.${trackingNumber ? `\n\nTracking number: ${trackingNumber}` : ''}`,
      });
    }
    return res.json(normalizeOrder(rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update the request.' });
  }
});

app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

initDb()
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`Lab Supply Portal listening on ${port} in ${appMode} mode`)))
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
