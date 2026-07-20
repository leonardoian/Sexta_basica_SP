const NAV_ITEMS = [
  { href: "/index.html", label: "Início" },
  { href: "/referencias.html", label: "Nova referência" },
  { href: "/materiais.html", label: "Materiais" },
  { href: "/boms.html", label: "BOMs" },
  { href: "/estoque.html", label: "Estoque" },
  { href: "/programas.html", label: "Programa" },
  { href: "/resultado.html", label: "Resultado" },
];

function renderNav() {
  const el = document.getElementById("topbar");
  if (!el) return;
  const atual = window.location.pathname;
  el.innerHTML = `
    <div class="brand">Planej. Compras</div>
    <nav>
      ${NAV_ITEMS.map(
        (item) =>
          `<a href="${item.href}" class="${atual === item.href ? "active" : ""}">${item.label}</a>`
      ).join("")}
    </nav>
  `;
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

document.addEventListener("DOMContentLoaded", renderNav);
