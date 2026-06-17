import "dotenv/config"
import { faker } from "@faker-js/faker"
import { eq } from "drizzle-orm"
import { db, sql } from "../src/db/index.js"
import {
  employees,
  invitations,
  locations,
  managerScopes,
  organizations,
  products,
  prices,
  subscriptions,
  customers,
} from "../src/db/schema.js"

const ADMIN_USER_ID = "google-oauth2|116423573323662097945"
const ORGANIZATION_NAME = "Cron"
const ORGANIZATION_SLUG = "cron"

const locationSeeds = [
  {
    name: "Lincoln Park",
    address: "2001 N Clark St",
    city: "Chicago",
    state: "IL",
  },
  {
    name: "Gold Coast",
    address: "111 W Oak St",
    city: "Chicago",
    state: "IL",
  },
  {
    name: "West Loop",
    address: "850 W Fulton Market",
    city: "Chicago",
    state: "IL",
  },
]

function fakeEmployee(locationId: string, role = "employee") {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()

  return {
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    name: `${firstName} ${lastName}`,
    locationId,
    role,
  }
}

async function findOrCreateLocation(
  organizationId: string,
  seed: typeof locationSeeds[number],
) {
  const existing = await db
    .select()
    .from(locations)
    .where(eq(locations.organizationId, organizationId))

  const match = existing.find((location) => location.name === seed.name)
  if (match) {
    return match
  }

  const [created] = await db
    .insert(locations)
    .values({
      organizationId,
      ...seed,
    })
    .returning()

  return created
}

async function seed() {
  faker.seed(20260523)

  const [organization] = await db
    .insert(organizations)
    .values({
      name: ORGANIZATION_NAME,
      slug: ORGANIZATION_SLUG,
      logoUrl: "https://example.com/cron-demo-logo.png",
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: ORGANIZATION_NAME,
        updatedAt: new Date(),
      },
    })
    .returning()

  const seededLocations: (typeof locations.$inferSelect)[] = []
  for (const locationSeed of locationSeeds) {
    seededLocations.push(await findOrCreateLocation(organization.id, locationSeed))
  }

  const [admin] = await db
    .insert(employees)
    .values({
      userId: ADMIN_USER_ID,
      organizationId: organization.id,
      email: "kevinroosey@gmail.com",
      name: "Kevin Roosey",
      role: "admin",
    })
    .onConflictDoUpdate({
      target: employees.userId,
      set: {
        organizationId: organization.id,
        email: "kevinroosey@gmail.com",
        name: "Kevin Roosey",
        role: "admin",
        updatedAt: new Date(),
      },
    })
    .returning()

  const managers: (typeof employees.$inferSelect)[] = []
  for (const location of seededLocations) {
    const [manager] = await db
      .insert(employees)
      .values({
        ...fakeEmployee(location.id, "manager"),
        organizationId: organization.id,
      })
      .returning()

    await db
      .insert(managerScopes)
      .values({
        employeeId: manager.id,
        scopeType: "location",
        scopeId: location.id,
      })

    managers.push(manager)
  }

  const employeeValues = Array.from({ length: 45 }, (_, index) => {
    const location = seededLocations[index % seededLocations.length]

    return {
      ...fakeEmployee(location.id),
      organizationId: organization.id,
    }
  })

  const seededEmployees = await db
    .insert(employees)
    .values(employeeValues)
    .returning()

  const inviteValues = Array.from({ length: 3 }, (_, index) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const location = seededLocations[index % seededLocations.length]

    return {
      organizationId: organization.id,
      locationId: location.id,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      name: `${firstName} ${lastName}`,
      role: "employee",
      invitedBy: admin.id,
    }
  })

  const seededInvites = await db
    .insert(invitations)
    .values(inviteValues)
    .returning()
  

  const productValues: (typeof products.$inferInsert)[] = [
    {
      id: "prod_Ui2pa2NYyY0XaF",
      name: "Essentials",
      description: "Essentials plan",
      active: true,
    },
  ]

  const seededProducts = await db
    .insert(products)
    .values(productValues)
    .returning()

  const priceValues: (typeof prices.$inferInsert)[] = [
    {
      id: "price_1Tick4ACPPOkdETh1hk3FiGs",
      productId: seededProducts[0].id,
      unitAmount: 2800,
      interval: "month",
      active: true,
    }, 
    {
      id: "price_1TicmLACPPOkdEThzVaSqrNf",
      productId: seededProducts[0].id,
      unitAmount: 25200,
      interval: "year",
      active: true,
    }
  ]
  const seededPrices = await db
    .insert(prices)
    .values(priceValues)
    .returning()

  const customerValues: (typeof customers.$inferInsert)[] = [
    {
      organizationId: organization.id,
      stripeCustomerId: "cus_Ui67SZyrJSzetQ",
    }
  ]

  const seededCustomers = await db
    .insert(customers)
    .values(customerValues)
    .returning()

  const subscriptionValues: (typeof subscriptions.$inferInsert)[] = [
    {
      id: "sub_1TjPRDACPPOkdEThjWpn7n4o",
      customerId: seededCustomers[0].stripeCustomerId,
      status: "active",
      priceId: seededPrices[0].id,
      quantity: 1,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
    }
  ]
  const seededSubscriptions = await db
    .insert(subscriptions)
    .values(subscriptionValues)
    .returning()

  console.log("Seed complete")
  console.table({
    organization: organization.id,
    admin: admin.id,
    locations: seededLocations.length,
    managers: managers.length,
    employees: seededEmployees.length,
    unacceptedInvites: seededInvites.length,
    products: seededProducts.length,
    prices: seededPrices.length,
    customers: seededCustomers.length,
    subscriptions: seededSubscriptions.length,
  })
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error)
  })
  .finally(async () => {
    await sql.end()
  })
