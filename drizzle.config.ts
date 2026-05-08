import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit auto-loads .env before this file runs, so DATABASE_URL=postgres is already set.
// override: true forces .env.local to win when it exists (local dev → localhost).
// If .env.local is absent (CI / VPS), this is a no-op and .env values stay.
config({ path: '.env.local', override: true });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
