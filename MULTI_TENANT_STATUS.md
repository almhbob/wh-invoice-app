# Multi-Tenant SaaS Implementation Status

This project is being prepared to support renting isolated user accounts to multiple companies.

## Implemented

- Added `CompanyContext` with a default tenant.
- Wrapped the app with `CompanyProvider`.
- Scoped employees to:

```txt
companies/{companyId}/employees/{employeeId}
```

- Employee local session is now stored per company.
- Added Firestore security rules for tenant-isolated collections:

```txt
companies/{companyId}/orders
companies/{companyId}/products
companies/{companyId}/employees
companies/{companyId}/offers
companies/{companyId}/trays
companies/{companyId}/counters
companies/{companyId}/settings
companies/{companyId}/auditLogs
```

## Not fully migrated yet

The following contexts still need to be moved from global collections to company-scoped collections before using the app with real tenants:

- `OrdersContext.tsx`
- `ProductsContext.tsx`
- `OffersContext.tsx`
- `TraysInventoryContext.tsx`
- `PriceChangeContext.tsx`
- `FeaturesContext.tsx`

Current global collections that must not be used for SaaS production:

```txt
orders
products
employees
offers
counters
```

## Production rule

Do not rent the system to multiple companies until every read/write uses this structure:

```txt
companies/{companyId}/{collectionName}/{docId}
```

## Required next implementation

For each context file:

1. Import `useCompany`.
2. Read `companyId` from `useCompany()`.
3. Replace global collection calls like:

```ts
collection(db, "orders")
doc(db, "orders", id)
doc(db, "counters", "orders")
```

with:

```ts
collection(db, "companies", companyId, "orders")
doc(db, "companies", companyId, "orders", id)
doc(db, "companies", companyId, "counters", "orders")
```

4. Add `companyId` into every created document.
5. Reset subscriptions whenever `companyId` changes.
6. Keep counters inside each company.
7. Add audit logs for destructive actions.

## Firestore custom claims required

Every authenticated user must receive claims similar to:

```json
{
  "companyId": "company_001",
  "role": "cashier"
}
```

Platform owners should receive:

```json
{
  "platformRole": "owner"
}
```

## SaaS readiness

Current readiness: **Foundation only**.

Safe for one company: yes.
Safe for multiple rented companies: not yet.

The project must complete all data context migrations before activating real company rental.
