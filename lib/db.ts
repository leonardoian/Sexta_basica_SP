import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Instanciado sob demanda (na primeira query), não no import do módulo —
// isso evita que o build do Next falhe quando DATABASE_URL só existe em runtime.
let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!client) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL não definida. Configure em .env.local (veja .env.example).");
    }
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

export const sql = ((...args: Parameters<NeonQueryFunction<false, false>>) =>
  getClient()(...args)) as NeonQueryFunction<false, false>;
