// Render has used both `npm start` and this direct start path for the two portal services.
// Route both configurations into the same full-stack launcher so the UI and API always
// run together. Do not pass ADMIN_PASSWORD into the runtime initializer: an existing
// administrator's database password must survive deploys and service restarts.
delete process.env.ADMIN_PASSWORD;

await import('../backend/catalog-launcher.js');
