import * as Reactivity from '@effect/experimental/Reactivity'
import * as PgDrizzle from '@effect/sql-drizzle/Pg'
import { PgClient } from '@effect/sql-pg'
import * as Client from '@effect/sql/SqlClient'
import { Config, Context, Effect, Layer } from 'effect'

const PgLive = Layer.scopedContext(
    Effect.gen(function* () {
        const host = yield* Config.string('DB_HOST')
        const port = yield* Config.number('DB_PORT')
        const database = yield* Config.string('DB_NAME')
        const password = yield* Config.redacted('DB_PASSWORD')
        const username = yield* Config.string('DB_USERNAME')

        const client = yield* PgClient.make({
            password,
            host,
            port,
            database,
            username,
        })

        return Context.make(PgClient.PgClient, client).pipe(Context.add(Client.SqlClient, client))
    }),
).pipe(Layer.provide(Reactivity.layer))

const DrizzleLive = PgDrizzle.layerWithConfig({
    casing: 'snake_case',
}).pipe(Layer.provide(PgLive))

export const layer = Layer.mergeAll(PgLive, DrizzleLive)
