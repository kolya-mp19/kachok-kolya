import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var pgClient: postgres.Sql | undefined;
}

// This is the single db instance for the app. Import db from here.
// Singleton pattern prevents exhausting the connection pool during Next.js hot reload.
const client = global.pgClient ?? postgres(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== 'production') global.pgClient = client;

export const db = drizzle(client, { schema });
