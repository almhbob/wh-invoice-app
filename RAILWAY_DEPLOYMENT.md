# Railway Production Deployment Checklist

## Current production app

Railway URL:

```text
https://wh-invoice-app-production-cdcf.up.railway.app
```

Custom domain to attach:

```text
fawtara.sawihasa.digital
```

## Build and start commands

The repository includes `nixpacks.toml` so Railway installs without requiring `pnpm-lock.yaml`:

```bash
pnpm install --no-frozen-lockfile
pnpm run build
pnpm run start
```

## Health check

Use either endpoint:

```text
/healthz
/api/healthz
```

Expected response:

```json
{
  "status": "ok"
}
```

Recommended Railway healthcheck path:

```text
/healthz
```

## Required environment variables

Add these in Railway → Variables:

```text
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

Railway provides `PORT` automatically.

## Domain setup in Railway

1. Open Railway project: `wh-invoice-app`.
2. Go to Settings → Domains.
3. Add custom domain:

```text
fawtara.sawihasa.digital
```

4. Copy the DNS record Railway provides.
5. Add that DNS record in your DNS provider for `sawihasa.digital`.
6. Wait until Railway shows the domain as active.

## Trial company login

```text
Username: trial
PIN: 1234
```

## Important production notes

- Firebase Auth and custom claims are still required before full multi-tenant production hardening.
- Local Bootstrap is for trial/testing only and should be disabled after Auth is complete.
- Firebase Storage rules must be published for contracts, product images, damage images, and logos.
- Firestore rules must be aligned with Auth claims: `companyId`, `role`, and `platformRole`.

## Quick verification after every deployment

1. Open `/healthz`.
2. Open `/` and confirm the first screen is company login.
3. Select the trial company.
4. Login with `trial / 1234`.
5. Open developer dashboard with an authorized admin and verify production readiness panel.
