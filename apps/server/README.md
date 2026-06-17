# Server File Tree

```text
apps/server/
├── .env.example
├── README.md
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── scripts/
│   ├── auto-migrate.ts
│   └── seed.ts
└── src/
    ├── auth.ts
    ├── billing.ts
    ├── config.ts
    ├── http.ts
    ├── main.ts
    ├── r2.ts
    ├── api/
    │   ├── response.ts
    │   ├── groups/
    │   │   ├── BillingGroup/
    │   │   │   └── BillingGroupLive.ts
    │   │   ├── EmployeesGroup/
    │   │   │   └── EmployeesGroupLive.ts
    │   │   ├── InvitationsGroup/
    │   │   │   └── InvitationsGroupLive.ts
    │   │   ├── MeGroup/
    │   │   │   └── MeGroupLive.ts
    │   │   ├── OrgGroup/
    │   │   │   └── OrganizationGroupLive.ts
    │   │   ├── ScopedResourcesGroup/
    │   │   │   └── ScopedResourcesGroupLive.ts
    │   │   └── index.ts
    │   └── middleware/
    │       ├── organization.ts
    │       └── resourceScope.ts
    └── db/
        ├── SqlLive.ts
        ├── index.ts
        └── schema.ts
```
