import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3/driver";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const sqlite = new Database("data/sqlite.db");
const db = drizzle(sqlite);

await migrate(db, { migrationsFolder: "app/.server/migrations" });
