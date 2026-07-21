const NAV_ITEMS = [
  { href: "/index.html", label: "Início" },
  { href: "/referencias.html", label: "Nova referência" },
  { href: "/materiais.html", label: "Materiais" },
  { href: "/boms.html", label: "Editar lista técnica" },
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

// Combobox com busca por texto (digita e filtra), no lugar de um <select>
// nativo com lista longa. `opcoes` é [{ value, label }]. Retorna um objeto
// com getter/setter de `value` pra ler/pré-preencher a seleção atual.
function criarCombo(containerId, opcoes, { placeholder = "Digite para buscar...", onChange } = {}) {
  const container = document.getElementById(containerId);
  let valorAtual = "";

  container.classList.add("combo");
  container.innerHTML = `
    <input type="text" class="combo-input" placeholder="${placeholder}" autocomplete="off">
    <div class="combo-list"></div>
  `;
  const input = container.querySelector(".combo-input");
  const list = container.querySelector(".combo-list");

  function render(filtro) {
    const termo = filtro.trim().toLowerCase();
    const filtradas = termo ? opcoes.filter((o) => o.label.toLowerCase().includes(termo)) : opcoes;
    list.innerHTML = filtradas.length
      ? filtradas
          .slice(0, 50)
          .map((o) => `<div class="combo-option" data-value="${o.value}">${o.label}</div>`)
          .join("")
      : `<div class="combo-empty">Nenhum resultado</div>`;
    list.classList.add("show");
  }

  input.addEventListener("focus", () => render(input.value));
  input.addEventListener("input", () => {
    valorAtual = "";
    if (onChange) onChange("");
    render(input.value);
  });
  list.addEventListener("mousedown", (e) => {
    const opt = e.target.closest(".combo-option");
    if (!opt) return;
    valorAtual = opt.dataset.value;
    input.value = opt.textContent;
    list.classList.remove("show");
    if (onChange) onChange(valorAtual);
  });
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) list.classList.remove("show");
  });

  return {
    get value() {
      return valorAtual;
    },
    set value(v) {
      valorAtual = v ? String(v) : "";
      const opt = opcoes.find((o) => String(o.value) === valorAtual);
      input.value = opt ? opt.label : "";
    },
  };
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
