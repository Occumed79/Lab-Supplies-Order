import { readFileSync, writeFileSync } from 'node:fs';

const appPath = new URL('../src/App.tsx', import.meta.url);
const apiBaseUrl = process.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  console.log('VITE_API_BASE_URL is not set. Leaving App.tsx API base unchanged.');
  process.exit(0);
}

const source = readFileSync(appPath, 'utf8');
const updated = source.replace(
  "const BASE_URL = import.meta.env.DEV ? '/api' : 'https://alex6oks0k.lastapp.dev';",
  `const BASE_URL = import.meta.env.DEV ? '/api' : '${apiBaseUrl.replace(/\/$/, '')}';`
);

if (source === updated) {
  console.log('No LastApp API base URL replacement was needed.');
} else {
  writeFileSync(appPath, updated);
  console.log(`Configured production API base URL: ${apiBaseUrl.replace(/\/$/, '')}`);
}
