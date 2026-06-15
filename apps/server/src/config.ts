import "dotenv/config"

export const config = {
  port: Number.parseInt(process.env.PORT ?? "8080", 10),
  corsOrigins: (
    process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  auth0: {
    domain: process.env.AUTH0_DOMAIN ?? "",
    audience: process.env.AUTH0_AUDIENCE ?? "",
  },
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://cron:cron@localhost:5432/cron",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    locationMonthlyPriceId: process.env.STRIPE_LOCATION_MONTHLY_PRICE_ID ?? "",
    locationYearlyPriceId: process.env.STRIPE_LOCATION_YEARLY_PRICE_ID ?? "",
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "cron-assets-private",
  },
}

export function auth0Issuer(domain: string) {
  const normalized = domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")

  return `https://${normalized}/`
}
