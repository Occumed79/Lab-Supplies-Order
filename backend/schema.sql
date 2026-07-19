CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  provider text NOT NULL DEFAULT 'email',
  role text NOT NULL DEFAULT 'clinic_user',
  active boolean NOT NULL DEFAULT true,
  clinic_id uuid,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinics (
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
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_clinic_id_fkey') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS products (
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
);

CREATE TABLE IF NOT EXISTS clinic_products (
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, product_id)
);

CREATE INDEX IF NOT EXISTS clinic_products_product_idx ON clinic_products(product_id);

CREATE TABLE IF NOT EXISTS orders (
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
);

CREATE TABLE IF NOT EXISTS app_migrations (
  name text PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now()
);
