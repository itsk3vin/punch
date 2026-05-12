import "dotenv/config"
import { eq, isNull } from "drizzle-orm"
import { db } from "../src/db/index.js"
import { employees, locations } from "../src/db/schema.js"

async function migrate() {
  console.log("Starting auto-migration...")

  // Get all organizations that have employees without location_id
  const employeesWithoutLocation = await db
    .select()
    .from(employees)
    .where(isNull(employees.locationId))

  if (employeesWithoutLocation.length === 0) {
    console.log("No employees need migration.")
    return
  }

  // Group by organization
  const orgIds = new Set(employeesWithoutLocation.map((e) => e.organizationId))

  for (const orgId of orgIds) {
    if (!orgId) continue

    // Create default location for this organization
    const [defaultLocation] = await db
      .insert(locations)
      .values({
        organizationId: orgId,
        name: "Main Location",
      })
      .returning()

    console.log(`Created default location "${defaultLocation.name}" for org ${orgId}`)

    // Update all employees in this org without a location
    const result = await db
      .update(employees)
      .set({ locationId: defaultLocation.id })
      .where(eq(employees.organizationId, orgId))

    console.log(`Updated ${result.length ?? "all"} employees in org ${orgId} to location ${defaultLocation.id}`)
  }

  console.log("Auto-migration complete.")
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
