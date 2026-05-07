import "dotenv/config"

export const config = {
  port: Number.parseInt(process.env.PORT ?? "8080", 10),
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  auth0: {
    domain: process.env.AUTH0_DOMAIN ?? "",
    audience: process.env.AUTH0_AUDIENCE ?? "",
  },
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://punch:punch@localhost:5432/punch",
}

export function auth0Issuer(domain: string) {
  const normalized = domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")

  return `https://${normalized}/`
}
