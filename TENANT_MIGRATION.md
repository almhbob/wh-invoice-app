# Tenant Data Migration

This project has been migrated from global Firestore collections to company-scoped collections.

## New tenant structure

```txt
companies/{companyId}/orders
companies/{companyId}/products
companies/{companyId}/employees
companies/{companyId}/offers
companies/{companyId}/priceChangeRequests
companies/{companyId}/counters
companies/{companyId}/settings
```

## Default company

The default tenant currently used by the app is:

```txt
default-company
```

## Why migration is required

Before applying strict Firestore rules, copy old data from the legacy global collections into the default company path.

Legacy collections include:

```txt
orders
products
employees
offers
priceChangeRequests
counters
```

## Migration script

A migration script has been added here:

```txt
scripts/migrate-global-data-to-default-company.mjs
```

Run it only after Firebase environment variables are available locally or in CI.

```bash
COMPANY_ID=default-company node scripts/migrate-global-data-to-default-company.mjs
```

To delete old global data after confirming the copy:

```bash
COMPANY_ID=default-company DELETE_AFTER_COPY=true node scripts/migrate-global-data-to-default-company.mjs
```

Do not enable `DELETE_AFTER_COPY=true` until you verify the copied data inside Firestore.

## Important

Uploading `firestore.rules` to GitHub does not automatically deploy it to Firebase. Deploy the rules manually from Firebase Console or by using Firebase CLI.

Recommended order:

1. Deploy the latest app build.
2. Run the migration script.
3. Verify data under `companies/default-company`.
4. Deploy Firestore rules.
5. Test login, products, orders, offers, price requests, and reports.
