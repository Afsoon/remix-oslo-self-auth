import Database from "better-sqlite3";
import { Kyselify } from "drizzle-orm/kysely";
import { Kysely, SqliteDialect, sql } from "kysely";
import {
  email_verification_request,
  passkey_credential,
  security_key_credential,
  sessions,
  totp_credential,
  users,
} from "./user/schema";

interface SQLDatabase {
  users: Kyselify<typeof users>;
  totp_credential: Kyselify<typeof totp_credential>;
  passkey_credential: Kyselify<typeof passkey_credential>;
  security_key_credential: Kyselify<typeof security_key_credential>;
  sessions: Kyselify<typeof sessions>;
  email_verification_request: Kyselify<typeof email_verification_request>;
}

const sqlite = new Database("data/sqlite.db");

export const db = new Kysely<SQLDatabase>({
  dialect: new SqliteDialect({
    database: sqlite,
  }),
});
