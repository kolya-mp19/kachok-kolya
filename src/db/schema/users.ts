import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const genderEnum = pgEnum('gender', ['male', 'female']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  gender: genderEnum('gender'),
  createdAt: timestamp('created_at').defaultNow(),
});
