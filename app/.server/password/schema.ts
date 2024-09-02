import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "../user/schema";

export const password_reset_session = sqliteTable("password_reset_session", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  two_factor_verified: integer("two_factor_verified", { mode: "boolean" }),
  email_verified: integer("email_verified", { mode: "boolean" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
});
