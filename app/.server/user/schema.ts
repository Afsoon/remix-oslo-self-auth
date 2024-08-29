import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  email_verified: integer("email_verified", { mode: "boolean" }),
  recovery_code: text("recovery_code"),
});

export const totp_credential = sqliteTable("totp_credential", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  key: text("key").notNull(),
});

export const passkey_credential = sqliteTable("passkey_credential", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  name: text("name").notNull(),
  public_key: text("public_keyu").notNull(),
  algorithm: text("algorithm").notNull(),
});

export const security_key_credential = sqliteTable("security_key_credential", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
  name: text("name").notNull(),
  public_key: text("public_keyu").notNull(),
  algorithm: text("algorithm").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  two_factor_verified: integer("two_factor_verified", { mode: "boolean" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
});

export const email_verification_request = sqliteTable("email_verification_request", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
});
