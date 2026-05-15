# OCCU-MED Lab Supply Portal

React + Vite + TypeScript app for clinic registration, clinic login, admin login, lab supply ordering, checkout, confirmation, profile management, admin clinic dashboard, and clinic order history.

## What was fixed

- Rebuilt the project into a normal Vite structure.
- Restored the fuller app source from the uploaded backup file.
- Fixed the Tailwind/PostCSS build failures caused by invalid `@apply` opacity classes for CSS-variable colors.
- Added Vite environment typings so `import.meta.env` compiles correctly.
- Removed/cleaned unused TypeScript items that failed strict `tsc` checks.
- Aligned the API base URL and local proxy to the API documentation base URL.
- Confirmed both production build and TypeScript validation pass.

## Commands

```bash
npm install
npm run build
npm run dev
```

## Validation completed

```bash
npx tsc --noEmit
npm run build
```

Both commands passed successfully.

## Backend/API note

The app is wired to the LastApp API documented in the uploaded API file. In development, `/api` is proxied through Vite. In production, the app calls the production LastApp URL directly.
