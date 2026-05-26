import express from 'express';

const app = express();
const port = process.env.PORT || 10000;

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lab-supplies-order-api' });
});

app.get('/', (_req, res) => {
  res.json({ service: 'lab-supplies-order-api', status: 'running' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Lab Supplies API listening on ${port}`);
});
