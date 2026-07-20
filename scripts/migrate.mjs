import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida. Configure .env.local (veja .env.example).");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "..", "db", "schema.sql");

if (!existsSync(schemaPath)) {
  console.error(`Arquivo não encontrado: ${schemaPath}`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(schemaPath, "utf8");

// Divide em statements por ";" no fim de linha, ignorando comentários "--".
const statements = schema
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Aplicando ${statements.length} statement(s) de db/schema.sql em ${new URL(process.env.DATABASE_URL).host}...`);

for (const [i, statement] of statements.entries()) {
  process.stdout.write(`  [${i + 1}/${statements.length}] `);
  await sql(statement);
  console.log("ok");
}

console.log("Migração concluída.");
