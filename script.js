const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Grades atualizadas conforme a imagem da campanha
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"]
};

const CONFIG = {
  valorUnitarioCamiseta: 45,
  adminUsuario: "admin",
  adminSenha: "umadecampi2026",
};

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let campanhaAtual = null;
let setores = [];
let congregacoes = [];
let pedidosCache = [];
let recebimentosCache = [];
let usuariosCache = [];

const el = (id) => document.getElementById(id);

// --- UTILITÁRIOS ---
function salvarSessao() { localStorage.setItem(SESSION_KEY, JSON.stringify(sessao)); }
function limparSessao() { sessao = null; localStorage.removeItem(SESSION_KEY); }
function normalizarTexto(txt) { return String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
function moeda(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatarDataHora(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString("pt-BR");
}
function mostrar(id, exibir = true) { const node = el(id); if (node) node.classList.toggle("hidden", !exibir); }
function preencherTexto(id, valor) { const node = el(id); if (node) node.textContent = String(valor ?? ""); }

function preencherSelect(selectId, options, getValue, getLabel, placeholder = "Selecione") {
  const select = el(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(getValue(item));
    option.textContent = getLabel(item);
    select.appendChild(option);
  });
}

// --- API ---
async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function recarregarTudo() {
  [usuariosCache, setores, congregacoes, pedidosCache, recebimentosCache] = await Promise.all([
    api("usuarios?select=*"),
    api("setores?select=*&order=numero.asc"),
    api("congregacoes?select=*&order=nome.asc"),
    api("pedidos?select=*&order=created_at.desc"),
    api("recebimentos?select=*&order=id.desc")
  ]);
}

// --- LÓGICA DE TAMANHOS ---
function atualizarSelectTamanhos(modeloId, tamanhoId) {
  const modelo = el(modeloId)?.value;
  const grade = GRADES[modelo] || [];
  preencherSelect(tamanhoId, grade, (x) => x, (x) => x, "Escolha o tamanho");
}

// --- RENDERIZAÇÃO ---
function renderTela() {
  mostrar("telaLogin", !sessao);
  mostrar("painelSetor", sessao?.tipo === "setor");
  mostrar("painelAdmin", sessao?.tipo === "admin");

  // Estatísticas do Topo
  preencherTexto("statSetores", setores.length);
  preencherTexto("statIgrejas", congregacoes.length);
  preencherTexto("statPedidos", pedidosCache.length);

  if (sessao?.tipo === "setor") {
    const setorId = sessao.setor_id;
    preencherTexto("tituloPainelSetor", `Painel: ${sessao.setor_nome || 'Setor'}`);
    
    const listaCong = congregacoes.filter(c => String(c.setor_id) === String(setorId));
    preencherSelect("pedidoCongregacao", listaCong, c => c.id, c => c.nome);
    
    const corpo = el("tbodyPedidosSetor");
    const meusPedidos = pedidosCache.filter(p => String(p.setor_id) === String(setorId));
    corpo.innerHTML = meusPedidos.map(p => `
      <tr>
        <td>${formatarDataHora(p.created_at)}</td>
        <td>${congregacoes.find(c => String(c.id) === String(p.congregacao_id))?.nome || '-'}</td>
        <td>${p.modelo}</td>
        <td>${p.tamanho}</td>
        <td>${p.quantidade}</td>
      </tr>`).join("");
  }

  if (sessao?.tipo === "admin") {
    preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
    preencherSelect("recebimentoSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  }
}

// --- EVENTOS ---
function bindEventos() {
  el("formLoginSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = usuariosCache.find(u => u.login === el("loginSetor").value && String(u.senha) === el("senhaSetor").value);
    if (user) {
      sessao = { tipo: "setor", setor_id: user.setor_id, setor_nome: user.nome };
      salvarSessao();
      renderTela();
    } else alert("Acesso negado.");
  });

  el("formLoginAdmin")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (el("loginAdmin").value === CONFIG.adminUsuario && el("senhaAdmin").value === CONFIG.adminSenha) {
      sessao = { tipo: "admin", nome: "Administrador" };
      salvarSessao();
      renderTela();
    } else alert("Senha admin incorreta.");
  });

  // Eventos para mudar tamanhos conforme o modelo
  el("pedidoModelo")?.addEventListener("change", () => atualizarSelectTamanhos("pedidoModelo", "pedidoTamanho"));
  el("pedidoAdminModelo")?.addEventListener("change", () => atualizarSelectTamanhos("pedidoAdminModelo", "pedidoAdminTamanho"));

  // Evento para atualizar congregações no Admin quando muda o setor
  el("pedidoAdminSetor")?.addEventListener("change", (e) => {
    const lista = congregacoes.filter(c => String(c.setor_id) === String(e.target.value));
    preencherSelect("pedidoAdminCongregacao", lista, c => c.id, c => c.nome);
  });

  el("btnLogoutSetor")?.addEventListener("click", () => { limparSessao(); location.reload(); });
  el("btnLogoutAdmin")?.addEventListener("click", () => { limparSessao(); location.reload(); });

  el("formPedidoSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      setor_id: sessao.setor_id,
      congregacao_id: el("pedidoCongregacao").value,
      modelo: el("pedidoModelo").value,
      tamanho: el("pedidoTamanho").value,
      quantidade: parseInt(el("pedidoQuantidade").value),
    };
    await api("pedidos", { method: "POST", body: payload });
    alert("Pedido enviado!");
    await recarregarTudo();
    renderTela();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  await recarregarTudo();
  renderTela();
});
