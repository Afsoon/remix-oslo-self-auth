import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/.server/**/*.ts",
  out: "./app/.server/migrations",
  dialect: "sqlite",
});
