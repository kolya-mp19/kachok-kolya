import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender', ['male', 'female']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  provider: text('provider'),
  providerId: text('provider_id'),
  gender: genderEnum('gender'),
  createdAt: timestamp('created_at').defaultNow(),
});
