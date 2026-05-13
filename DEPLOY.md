# W&H Invoice App - Permanent Server Deployment

This repository is now prepared for permanent hosting on Railway or Render.

## What changed

- The app no longer depends on Replit-specific environment variables for production builds.
- Expo is exported as a web build into `static-build/`.
- `server/serve.js` serves the production build and exposes health checks.
- `/api/healthz` and `/healthz` return JSON health status.
- `railway.json` is included for Railway deployment.
- `render.yaml` is included for Render deployment.
- `package.json` no longer uses monorepo-only `workspace:*` or `catalog:` values.

## Railway

1. Open Railway.
2. Create a new project from GitHub.
3. Select `almhbob/wh-invoice-app`.
4. Railway will use `railway.json` automatically.
5. Add environment variables from `.env.example`.
6. After deployment, test:

```bash
https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/healthz
```

## Render

1. Open Render.
2. Create a new Web Service from GitHub.
3. Select `almhbob/wh-invoice-app`.
4. Render can use `render.yaml`.
5. Add environment variables from `.env.example`.
6. Test:

```bash
https://YOUR-RENDER-DOMAIN.onrender.com/api/healthz
```

## Local production test

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile=false
pnpm run build
pnpm run start
```

Open:

```bash
http://localhost:3000/api/healthz
```

## Required production variables

```env
NODE_ENV=production
EXPO_PUBLIC_API_URL=https://your-permanent-server-domain.example
EXPO_PUBLIC_FIREBASE_API_KEY=replace_me
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=replace_me
EXPO_PUBLIC_FIREBASE_PROJECT_ID=replace_me
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=replace_me
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=replace_me
EXPO_PUBLIC_FIREBASE_APP_ID=replace_me
```

## Notes

The current server hosts the Expo web app and provides health checks. Mobile APK builds still need EAS or Expo tooling. Firestore rules and Firebase project settings should be configured before using real customer invoices.
