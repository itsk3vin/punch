import { and, eq, inArray } from "drizzle-orm"

import { db } from "../../db/index.js"
import {
  departments,
  employees,
  invitations,
  locations,
  managerScopes,
} from "../../db/schema.js"

const ADMIN_ROLE = "admin"

export type OrganizationalVisibility =
  | { kind: "all" }
  | {
      kind: "scoped"
      wholeBreadthLocationIds: ReadonlySet<string>
      departmentOnlyIds: ReadonlySet<string>
    }

async function scopedManagerVisibility(
  viewer: typeof employees.$inferSelect,
  organizationId: string,
): Promise<OrganizationalVisibility> {
  const scopeRows = await db
    .select({
      scopeType: managerScopes.scopeType,
      scopeId: managerScopes.scopeId,
    })
    .from(managerScopes)
    .where(eq(managerScopes.employeeId, viewer.id))

  const wholeBreadthLocationIds = new Set<string>()
  const departmentOnlyIds = new Set<string>()

  const locationScopeIds = scopeRows
    .filter((r) => r.scopeType === "location")
    .map((r) => r.scopeId)
  const departmentScopeIds = scopeRows
    .filter((r) => r.scopeType === "department")
    .map((r) => r.scopeId)

  if (locationScopeIds.length > 0) {
    const scopedLocations = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(
        eq(locations.organizationId, organizationId),
        inArray(locations.id, locationScopeIds),
      ))
    for (const row of scopedLocations) {
      wholeBreadthLocationIds.add(row.id)
    }
  }

  if (departmentScopeIds.length > 0) {
    const scopedDepartments = await db
      .select({ departmentId: departments.id })
      .from(departments)
      .innerJoin(locations, eq(departments.locationId, locations.id))
      .where(and(
        eq(locations.organizationId, organizationId),
        inArray(departments.id, departmentScopeIds),
      ))

    for (const row of scopedDepartments) {
      departmentOnlyIds.add(row.departmentId)
    }
  }

  return {
    kind: "scoped",
    wholeBreadthLocationIds,
    departmentOnlyIds,
  }
}

export async function getOrganizationalVisibility(
  viewer: typeof employees.$inferSelect,
  organizationId: string,
): Promise<OrganizationalVisibility> {
  if (viewer.organizationId !== organizationId) {
    return {
      kind: "scoped",
      wholeBreadthLocationIds: new Set(),
      departmentOnlyIds: new Set(),
    }
  }

  if (viewer.role === ADMIN_ROLE) {
    return { kind: "all" }
  }

  if (viewer.role === "manager") {
    return scopedManagerVisibility(viewer, organizationId)
  }

  const wholeBreadthLocationIds = new Set<string>()
  const departmentOnlyIds = new Set<string>()
  if (viewer.locationId) {
    wholeBreadthLocationIds.add(viewer.locationId)
  }
  if (viewer.departmentId) {
    departmentOnlyIds.add(viewer.departmentId)
  }
  return { kind: "scoped", wholeBreadthLocationIds, departmentOnlyIds }
}

export async function buildDepartmentParentMap(
  departmentIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(departmentIds.filter((id): id is string => !!id))]
  if (ids.length === 0) {
    return new Map()
  }
  const rows = await db
    .select({
      departmentId: departments.id,
      locationId: departments.locationId,
    })
    .from(departments)
    .where(inArray(departments.id, ids))

  return new Map(rows.map((r) => [r.departmentId, r.locationId]))
}

export async function rollupParentLocationsFromDepartmentScopes(
  visibility: OrganizationalVisibility,
): Promise<ReadonlySet<string>> {
  if (visibility.kind === "all") {
    return new Set()
  }

  const ids = [...visibility.departmentOnlyIds]
  if (ids.length === 0) {
    return new Set()
  }

  const parents = await db
    .select({ locationId: departments.locationId })
    .from(departments)
    .where(inArray(departments.id, ids))

  return new Set(parents.map((row) => row.locationId))
}

export function coworkerMatchesVisibility(
  visibility: OrganizationalVisibility,
  coworker: typeof employees.$inferSelect,
  departmentParents: Map<string, string>,
): boolean {
  if (visibility.kind === "all") {
    return true
  }

  const { wholeBreadthLocationIds, departmentOnlyIds } = visibility

  if (
    coworker.departmentId !== null &&
    coworker.departmentId !== undefined
  ) {
    const parentLoc = departmentParents.get(coworker.departmentId)

    if (departmentOnlyIds.has(coworker.departmentId)) {
      return true
    }

    if (parentLoc !== undefined && wholeBreadthLocationIds.has(parentLoc)) {
      return true
    }
    return false
  }

  if (
    coworker.locationId !== null &&
    coworker.locationId !== undefined &&
    wholeBreadthLocationIds.has(coworker.locationId)
  ) {
    return true
  }

  return false
}

export async function invitationMatchesVisibilityResolved(
  visibility: OrganizationalVisibility,
  invitation: typeof invitations.$inferSelect,
): Promise<boolean> {
  if (visibility.kind === "all") {
    return true
  }

  if (!invitation.departmentId && !invitation.locationId) {
    return false
  }

  const { wholeBreadthLocationIds, departmentOnlyIds } = visibility

  if (
    invitation.locationId !== null &&
    invitation.locationId !== undefined &&
    wholeBreadthLocationIds.has(invitation.locationId)
  ) {
    return true
  }

  if (
    invitation.departmentId !== null &&
    invitation.departmentId !== undefined
  ) {
    if (departmentOnlyIds.has(invitation.departmentId)) {
      return true
    }
    const parentMap = await buildDepartmentParentMap([invitation.departmentId])
    const parentLoc = parentMap.get(invitation.departmentId)
    return (
      parentLoc !== undefined &&
      wholeBreadthLocationIds.has(parentLoc)
    )
  }

  return false
}

export function departmentMatchesVisibility(
  visibility: OrganizationalVisibility,
  department: typeof departments.$inferSelect,
): boolean {
  if (visibility.kind === "all") {
    return true
  }

  const { wholeBreadthLocationIds, departmentOnlyIds } = visibility

  if (departmentOnlyIds.has(department.id)) {
    return true
  }
  return wholeBreadthLocationIds.has(department.locationId)
}
