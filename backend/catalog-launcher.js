import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 10000);

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = neon(databaseUrl);
const server = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit',
});

let requestedExitCode = null;

const productCatalog = [
  ['LABCORP-KIT', 'Labcorp Clinical Collection Kit', 'Complete Labcorp clinical collection kit.', 'Collection Kits', 'Kit', 10],
  ['CRL-KIT', 'CRL Clinical Collection Kit', 'Complete Clinical Reference Laboratory collection kit.', 'Collection Kits', 'Kit', 20],
  ['SHIP-PAK', 'FedEx Shipping Envelope', 'FedEx clinical shipping envelope for specimen transport.', 'Shipping', 'Each', 30],
  ['TUBE-HEPARIN', 'Lithium Heparin Green-Top Tubes', 'Lithium heparin tubes for plasma collections.', 'Collection Tubes', 'Box', 40],
  ['TUBE-EDTA', 'EDTA Lavender-Top Tubes', 'EDTA tubes for hematology collections.', 'Collection Tubes', 'Box', 50],
  ['TUBE-RED', 'Plain Serum Red-Top Tubes', 'Plain serum tubes without separator gel.', 'Collection Tubes', 'Box', 60],
  ['TUBE-CITRATE', 'Sodium Citrate Light-Blue-Top Tubes', 'Sodium citrate tubes for coagulation testing.', 'Collection Tubes', 'Box', 70],
  ['TUBE-TIGER', 'Tiger-Top SST Tubes', 'Tiger-top serum separator tubes.', 'Collection Tubes', 'Box', 80],
  ['TUBE-SST', 'Gold-Top SST Tubes', 'Gold-top serum separator tubes for chemistry and serology testing.', 'Collection Tubes', 'Box', 90],
  ['TUBE-TRACE', 'Royal-Blue Trace-Element Tubes', 'Royal-blue tubes for trace-element collections.', 'Collection Tubes', 'Box', 100],
  ['EXEMPT-BOX', 'Exempt Human Specimen Box', 'Compliant outer box for exempt human specimen shipments.', 'Shipping', 'Each', 110],
  ['FEDEX-LABEL', 'FedEx Shipping Labels', 'FedEx labels for clinical specimen shipments.', 'Shipping', 'Pack', 120],
  ['BIO-BAG', 'Biohazard Specimen Bags', 'Leak-resistant specimen transport bags with document pouch.', 'Shipping', 'Pack', 130],
  ['LABCORP-CUP', 'Labcorp Split Urine Cups', 'Split urine collection cups for Labcorp drug-screen specimens.', 'Labcorp', 'Case', 140],
  ['CRL-CUP', 'CRL Split Urine Cups', 'Split urine collection cups for CRL drug-screen specimens.', 'CRL', 'Case', 150],
  ['LABCORP-CCF', 'Labcorp Chain of Custody Forms', 'Chain-of-custody forms for Labcorp drug-screen collections.', 'Labcorp', 'Pack', 160],
  ['CRL-CCF', 'CRL Chain of Custody Forms', 'Laboratory chain-of-custody forms for CRL collections.', 'CRL', 'Pack', 170],
  ['LABCORP-REQ', 'Labcorp Lab Requisition Forms', 'Blank Labcorp laboratory requisition forms.', 'Labcorp', 'Pack', 180],
  ['CRL-REQ', 'CRL Lab Requisition Forms', 'Blank CRL laboratory requisition forms.', 'CRL', 'Pack', 190],
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForServer() {
  const healthUrl = `http://127.0.0.1:${port}/health`;
  let lastError = null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Server exited before catalog synchronization (code ${server.exitCode}).`);

    try {
      const response = await fetch(healthUrl);
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw lastError || new Error('Timed out waiting for the application server.');
}

async function synchronizeCatalog() {
  await waitForServer();

  for (const [code, name, description, category, unit, displayOrder] of productCatalog) {
    await sql`INSERT INTO products (
        product_code, product_name, description, category, unit_label,
        display_order, price, stock_quantity, is_available
      )
      VALUES (${code}, ${name}, ${description}, ${category}, ${unit}, ${displayOrder}, 0, 9999, true)
      ON CONFLICT (product_code) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        unit_label = EXCLUDED.unit_label,
        display_order = EXCLUDED.display_order,
        stock_quantity = 9999,
        is_available = true`;
  }

  const migrationName = 'clinic_products_image_catalog_v2';
  const migration = await sql`SELECT name FROM app_migrations WHERE name = ${migrationName} LIMIT 1`;

  if (!migration.length) {
    // Clinics that still had the complete original 12-item catalog receive the
    // complete artwork-backed catalog. Clinics already customized by an admin
    // keep their existing restrictions and only retain products they had.
    await sql`WITH full_catalog_clinics AS (
        SELECT cp.clinic_id
        FROM clinic_products cp
        JOIN products p ON p.id = cp.product_id
        WHERE p.product_code IN (
          'CRL-CCF', 'CRL-CUP', 'LABCORP-REQ', 'LABCORP-CCF',
          'URINE-CUP', 'TUBE-SST', 'TUBE-EDTA', 'TUBE-GRAY',
          'BIO-BAG', 'SHIP-PAK', 'ABSORBENT', 'LABELS'
        )
        GROUP BY cp.clinic_id
        HAVING count(DISTINCT p.product_code) = 12
      )
      INSERT INTO clinic_products (clinic_id, product_id)
      SELECT f.clinic_id, p.id
      FROM full_catalog_clinics f
      CROSS JOIN products p
      WHERE p.product_code IN (
        'LABCORP-KIT', 'CRL-KIT', 'SHIP-PAK', 'TUBE-HEPARIN',
        'TUBE-EDTA', 'TUBE-RED', 'TUBE-CITRATE', 'TUBE-TIGER',
        'TUBE-SST', 'TUBE-TRACE', 'EXEMPT-BOX', 'FEDEX-LABEL',
        'BIO-BAG', 'LABCORP-CUP', 'CRL-CUP', 'LABCORP-CCF',
        'CRL-CCF', 'LABCORP-REQ', 'CRL-REQ'
      )
      ON CONFLICT DO NOTHING`;

    await sql`INSERT INTO app_migrations (name) VALUES (${migrationName}) ON CONFLICT DO NOTHING`;
  }

  // These legacy products do not have matching uploaded artwork. Keep their
  // database rows for historical orders, but remove them from clinic catalogs.
  await sql`DELETE FROM clinic_products cp
    USING products p
    WHERE cp.product_id = p.id
      AND p.product_code IN ('URINE-CUP', 'TUBE-GRAY', 'ABSORBENT', 'LABELS')`;

  await sql`UPDATE products
    SET is_available = false
    WHERE product_code IN ('URINE-CUP', 'TUBE-GRAY', 'ABSORBENT', 'LABELS')`;

  console.log(`Clinic artwork catalog synchronized: ${productCatalog.length} products.`);
}

server.on('error', (error) => {
  console.error('Unable to launch application server:', error);
  process.exit(1);
});

server.on('exit', (code, signal) => {
  if (signal) console.log(`Application server exited after ${signal}.`);
  process.exit(requestedExitCode ?? code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    requestedExitCode = 0;
    if (!server.killed) server.kill(signal);
  });
}

synchronizeCatalog().catch((error) => {
  console.error('Clinic artwork catalog synchronization failed:', error);
  requestedExitCode = 1;
  if (!server.killed) server.kill('SIGTERM');
});
