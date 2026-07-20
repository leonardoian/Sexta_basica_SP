const NAV_ITEMS = [
  { href: "/index.html", label: "Início" },
  { href: "/referencias.html", label: "Nova referência" },
  { href: "/materiais.html", label: "Materiais" },
  { href: "/boms.html", label: "BOMs" },
  { href: "/estoque.html", label: "Estoque" },
  { href: "/programas.html", label: "Programa" },
  { href: "/resultado.html", label: "Resultado" },
  { href: "/importar.html", label: "Importar Programa" },
];

function renderShell() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const atual = window.location.pathname === "/" ? "/index.html" : window.location.pathname;

  sidebar.innerHTML = `
    <div class="slogo">
      <div class="brand-mark">PLANEJ.</div>
      <div class="brand-sub">COMPRAS</div>
    </div>
    <div class="snl">Navegação</div>
    ${NAV_ITEMS.map(
      (item) =>
        `<a class="ni ${atual === item.href ? "active" : ""}" href="${item.href}"${item.newTab ? ' target="_blank"' : ""}>${item.label}</a>`
    ).join("")}
    <div class="sfoot">
      <span class="muted">InBetta — PCP</span>
    </div>
  `;

  const titleEl = document.getElementById("topbar-title");
  if (titleEl) {
    const atual_item = NAV_ITEMS.find((i) => i.href === atual);
    titleEl.textContent = atual_item ? atual_item.label : "Planej. Compras";
  }

  const dateEl = document.getElementById("topbar-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
}

// Postgres devolve colunas NUMERIC como string com casas fixas (ex: "12.0000").
// Isso converte pra número e formata sem zeros à direita (ex: "12").
function formatNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toString() : v;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Erro na requisição (${res.status})`);
  }
  return data;
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener("DOMContentLoaded", renderShell);
