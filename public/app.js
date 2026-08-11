// ---------- autenticação ----------
function getAuthData() {
  try {
    return JSON.parse(localStorage.getItem("pc_auth") || "null");
  } catch {
    return null;
  }
}

function getToken() {
  const auth = getAuthData();
  return auth ? auth.token : null;
}

function getUsuarioLogado() {
  const auth = getAuthData();
  return auth ? auth.usuario : null;
}

function logout() {
  localStorage.removeItem("pc_auth");
  window.location.href = "/login.html";
}

// roda assim que o script carrega (antes de qualquer chamada de API) —
// sem token, manda pro login direto, sem esperar a página terminar de montar
(function guardaSessao() {
  if (window.location.pathname === "/login.html") return;
  if (!getToken()) window.location.replace("/login.html");
})();

const NAV_ITEMS = [
  { href: "/index.html", label: "Início", ic: "◈" },
  { href: "/referencias.html", label: "Nova referência", ic: "◉" },
  { href: "/materiais.html", label: "Materiais", ic: "☰" },
  { href: "/boms.html", label: "Editar lista técnica", ic: "⊞" },
  { href: "/estoque.html", label: "Estoque", ic: "⊟" },
  { href: "/programas.html", label: "Programa", ic: "⊕" },
  { href: "/resultado.html", label: "Resultado", ic: "◎" },
  { href: "/importar.html", label: "Importar Programa", ic: "⬆" },
  { href: "/usuarios.html", label: "Usuários", ic: "◈" },
];

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("overlay-sb")?.classList.toggle("open");
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("overlay-sb")?.classList.remove("open");
}

function renderShell() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const atual = window.location.pathname === "/" ? "/index.html" : window.location.pathname;

  sidebar.innerHTML = `
    <div class="slogo">
      <div class="tag">Sistema de</div>
      <div class="name">PLANEJ.<br><span>COMPRAS</span></div>
    </div>
    <div class="snav">
      <div class="snl">Navegação</div>
      ${NAV_ITEMS.map(
        (item) =>
          `<a class="ni ${atual === item.href ? "active" : ""}" href="${item.href}"${item.newTab ? ' target="_blank"' : ""}><span class="ic">${item.ic}</span>${item.label}</a>`
      ).join("")}
    </div>
    <div class="sfoot">
      <div class="un">${getUsuarioLogado()?.nome || ""}</div>
      <div class="ur">${getUsuarioLogado()?.login || ""}</div>
      <button type="button" class="btn-out" onclick="logout()">Sair</button>
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

  const topbar = document.querySelector(".topbar");
  if (topbar && !topbar.querySelector(".btn-menu")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-menu";
    btn.textContent = "☰";
    btn.onclick = toggleSidebar;
    topbar.firstElementChild
      ? topbar.insertBefore(btn, topbar.firstElementChild)
      : topbar.appendChild(btn);
  }

  if (!document.getElementById("overlay-sb")) {
    const overlay = document.createElement("div");
    overlay.id = "overlay-sb";
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }

  if (!document.getElementById("toast-container")) {
    const toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
}

function toast(mensagem, tipo = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast toast-${tipo}`;
  const icone = tipo === "ok" ? "✓" : tipo === "err" ? "✕" : "ℹ";
  el.innerHTML = `<span class="toast-icon">${icone}</span><span>${mensagem}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

// Postgres devolve colunas NUMERIC como string com casas fixas (ex: "12.0000").
// Isso converte pra número e formata sem zeros à direita (ex: "12").
function formatNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toString() : v;
}

async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Erro na requisição (${res.status})`);
  }
  return data;
}

// POST com acompanhamento de progresso de envio (0-100). `fetch` não expõe
// progresso de upload, então usa XMLHttpRequest aqui — só nesse caso.
// `onProgress(pct)` é chamado a cada pedaço enviado.
function apiUpload(path, body, onProgress) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.upload.addEventListener("progress", (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 401) {
        logout();
        reject(new Error("Sessão expirada. Faça login novamente."));
        return;
      }
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error((data && data.error) || `Erro na requisição (${xhr.status})`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Falha de rede na requisição.")));
    xhr.send(JSON.stringify(body));
  });
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
