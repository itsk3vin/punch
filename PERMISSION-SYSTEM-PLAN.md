# Permission System Architecture Plan

## Overview

This document outlines the plan for adding a hierarchical permission system to support organizations with locations, departments, regional managers, and scoped access control.

## Resource Hierarchy

```
Organization
├── Location (e.g., "Store #3")
│   ├── Department (e.g., "Kitchen")
│   └── Department (e.g., "Front of House")
├── Location (e.g., "Store #5")
│   └── Department (e.g., "Bar")
└── Location Group (e.g., "North Region")
    ├── Location A
    └── Location B
```

## Role Model: Role Tier + Scope

Two orthogonal concepts:

- **Role Tier** — what operations you can perform (`admin`, `manager`, `employee`)
- **Scope** — which resources you can perform them on

| Role | Can Always | Scope-Aware Actions |
|---|---|---|
| `admin` | Billing, invites, org profile, delete org | Everything in the org |
| `manager` | — | View/manage schedules, employee visibility, scoped invites, create departments within scope |
| `employee` | View own schedule, set own availability | — |

### Permission Inheritance (downward only)

- `location_group` → all locations in the group → all departments in those locations
- `location` → all departments in that location
- `department` → that department only

A department manager does **not** gain location-manager rights for the parent location (cannot manage sibling departments).

### Admin-Only Endpoints

Billing, sending invites, revoking access, updating org profile, deleting the org, creating location groups.

---

## Database Schema

### New Tables

#### `locations`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `organization_id` | `uuid FK` | Not null |
| `name` | `text` | Not null |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `departments`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `location_id` | `uuid FK` | Not null |
| `name` | `text` | Not null |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `location_groups`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `organization_id` | `uuid FK` | Not null |
| `name` | `text` | Not null |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `location_group_locations`
| Column | Type | Notes |
|---|---|---|
| `location_group_id` | `uuid FK` | Composite PK? |
| `location_id` | `uuid FK` | |

#### `manager_scopes`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | |
| `employee_id` | `uuid FK` | Not null |
| `scope_type` | `text` | `'location_group'`, `'location'`, or `'department'` |
| `scope_id` | `uuid` | References the table indicated by `scope_type` |
| `created_at` | `timestamptz` | |

### Modified Tables

#### `employees` — add columns
- `location_id` (`uuid FK`, nullable) — their primary work location
- `department_id` (`uuid FK`, nullable) — their primary work department

#### `invitations` — add columns
- `location_id` (`uuid FK`, nullable) — scoped invitation target
- `department_id` (`uuid FK`, nullable) — scoped invitation target

### Migration: Auto-Create Default Location

For every existing organization, create a single `locations` row named `"Main Location"`. Assign every existing `employee` to this default location. This ensures backward compatibility without manual admin setup.

---

## Middleware (Effect Layer)

Build a scoped authorization toolkit alongside the existing middleware.

### Auth Functions

```ts
// Existing (stays):
requireOrganizationAdmin(organizationId)  // billing, org profile, invites

// New:
requireLocationAccess(locationId)
// - admin of the owning org? → allow
// - manager with location scope for this location? → allow
// - manager with location_group scope containing this location? → allow
// - otherwise → deny

requireDepartmentAccess(departmentId)
// - admin of the owning org? → allow
// - manager with department scope for this department? → allow
// - manager with location scope for the parent location? → allow
// - manager with location_group scope containing the parent location? → allow
// - otherwise → deny

requireManagerOrAdmin(organizationId)
// - admin of the org? → allow
// - manager with ANY scope in this org? → allow (used for creating locations/departments)

requireInvitationAuthority(organizationId, locationId?, departmentId?)
// - admin of the org? → allow
// - manager whose scope covers the specified location/department? → allow
```

---

## API Endpoints

### New Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/locations` | `requireManagerOrAdmin` | Create location (admin or any manager in org) |
| `GET` | `/locations` | `requireOrganizationAccess` | List locations, filtered by scope |
| `POST` | `/departments` | `requireManagerOrAdmin` | Create department (admin or manager of parent location) |
| `GET` | `/departments` | `requireOrganizationAccess` | List departments, filtered by scope |
| `POST` | `/location-groups` | `requireOrganizationAdmin` | Admin only |
| `GET` | `/location-groups` | `requireOrganizationAccess` | List groups |
| `POST` | `/manager-scopes` | `requireOrganizationAdmin` | Assign scope to employee |

### Modified Endpoints

| Endpoint | Change |
|---|---|
| `GET /me` | Include `employee.location_id`, `employee.department_id`, `scopes[]` array |
| `GET /employees/org/:id` | For managers, filter to employees within accessible locations/departments |
| `POST /organizations/:id/invitations` | Accept `role: "manager"` + `location_id`/`department_id` for scoped invites |
| `POST /organizations/:id/invitations/:id/resend` | Scoped — `requireInvitationAuthority` |
| `POST /organizations/:id/invitations/:id/revoke` | Scoped — `requireInvitationAuthority` |
| `PUT /employee/update` | Allow admins to set `location_id`/`department_id` |

---

## Frontend Changes

### `MeResponse` Update

```ts
type MeResponse = {
  status: "ready"
  employee: {
    ...,
    locationId: string | null
    departmentId: string | null
  }
  organization: { ... }
  scopes: Array<
    { type: "location_group"; id: string; name: string }
    | { type: "location"; id: string; name: string }
    | { type: "department"; id: string; name: string }
  >
}
```

### Navigation & Access Control

- **Settings sidebar:** Hide "Billing" and "Company profile" unless `role === 'admin'`
- **Members page:** Admin — full CRUD with scope assignment. Manager — read-only view of their scoped employees + ability to send/rescind invites to their location/department
- **Invite dialog:** Add location/department selectors (filtered by inviter's scope) and role selector with `manager` option
- **Schedule page:** Location/department selectors based on scopes
- **New settings pages:** Locations management, Departments management, Location Groups management

---

## Discrete Migration Path

### Stage 1 — Schema
- Add all new tables and columns to `schema.ts`
- Generate and apply Drizzle migration
- Run auto-migration script to create "Main Location" for each existing org and assign all employees

### Stage 2 — Middleware
- Build `requireLocationAccess`, `requireDepartmentAccess`, `requireManagerOrAdmin`, `requireInvitationAuthority`
- Update `GET /me` to return `location_id`, `department_id`, and `scopes[]`

### Stage 3 — API Endpoints
- Implement locations, departments, groups, and manager scopes CRUD
- Update invitation endpoints to be scope-aware

### Stage 4 — Frontend
- Update `MeResponse` type and `useEmployee` hook
- Conditional navigation based on role
- Members page updates for scoped invites and manager role
- New settings pages for locations/departments management
- Schedule page location/department selectors

### Stage 5 — Cutover
- Update employee listing and schedule endpoints to use scoped middleware
- Existing employees without locations continue to work for non-scheduling features
