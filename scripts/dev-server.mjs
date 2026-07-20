// Servidor local só para desenvolvimento: serve public/ como estático e
// despacha /api/* pros handlers em api/*.mjs, simulando o runtime de
// Vercel Functions (req.query, req.body, res.status().json()). Não é usado
// em produção — na Vercel cada arquivo em api/ vira uma function isolada.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function enhanceRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
  return res;
}

function readRawBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  enhanceRes(res);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.replace("/api/", "");
    const modPath = path.join(root, "api", `${name}.mjs`);
    try {
      const mod = await import(`${modPath}?t=${Date.now()}`);
      req.query = Object.fromEntries(url.searchParams);
      req.body = await readRawBody(req);
      await mod.default(req, res);
    } catch (e) {
      res.status(404).json({ error: `rota não encontrada: ${name} (${e.message})` });
    }
    return;
  }

  const filePath = path.join(root, "public", url.pathname === "/" ? "/index.html" : url.pathname);
  try {
    const data = await readFile(filePath);
    res.setHeader("Content-Type", MIME[path.extname(filePath)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));
