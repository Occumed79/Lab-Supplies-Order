// Render has used both `npm start` and the backend package start command for the two
// portal services. Route both configurations through the same full-stack startup path.
// The startup module performs one controlled Admin password synchronization from the
// current Render environment, then records it so later deploys do not overwrite it.
await import('../backend/startup.js');
