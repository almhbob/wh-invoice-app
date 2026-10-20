# Multi-tenant implementation status

The active data providers use `companies/{companyId}/...`. Products, offers and price-change contexts re-export the tenant-scoped implementations. Trays derive from tenant orders. Shift and branch-operation caches are scoped by company.

## Security migration implemented in source

- Firebase email/password sign-in with trusted `companyId` and `employeeDocId` claims.
- Employee membership bound to Firebase `authUid`; role and active status checked against the server profile.
- No anonymous sign-in, static bootstrap users, fallback administrator or profile-selection impersonation.
- Firestore and Storage rules deny cross-company access, enforce operational roles and deny unknown paths.
- Append-only, UID-attributed audit records.
- Bounded offline continuation on a previously verified device, preserving local orders and the sync outbox.
- Isolated security-emulator tests and a dry-run-first Admin SDK provisioning utility.

## Not a production-readiness certification

These source changes do not establish that deployed rules, authentication providers, accounts, custom claims, Storage download tokens or hosting caches have been migrated.

Follow [SECURITY_MIGRATION.md](SECURITY_MIGRATION.md) before a coordinated app/rules rollout. First sign-in and account provisioning require connectivity. Cold-start offline support and production password-reset delivery require separate deployed-environment verification.

Do not onboard additional companies until the coordinated migration and two-company acceptance tests pass. Do not use the former broad authenticated-user rules as a permanent fallback.
