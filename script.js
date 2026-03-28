const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Novos tamanhos baseados na imagem da campanha 2026/27
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"] // O nome aqui deve ser igual ao do HTML
};

const CONFIG = {
  inicioPedidos: 1, 
  fimPedidos: 20,   
  adminPodeEditarForaPrazo: true,
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

// --- FUNÇÕES DE UTILITÁRIOS ---
function salvarSessao() { localStorage.setItem(SESSION_KEY, JSON.stringify(sessao)); }
function limparSessao() { sessao = null; localStorage.removeItem(SESSION_KEY); }
function normalizarTexto(txt) { return String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
function numero(v) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function moeda(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dataBr(valor) { 
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  return d.toLocaleDateString("pt-BR");
}
function formatarDataHora(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : d.toLocaleString("pt-BR");
}
function escapeHtml(texto) { return String(texto ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function mostrar(id, exibir = true) { const node = el(id); if (node) node.classList.toggle("hidden", !exibir); }
function preencherTexto(id, valor) { const node = el(id); if (node) node.textContent = String(valor ?? ""); }

function preencherSelect(selectId, options, getValue, getLabel, placeholder = "Selecione", manterAtual = true) {
  const select = el(selectId);
  if (!select) return;
  const valorAtual = String(select.value || "");
  select.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(getValue(item));
    option.textContent = getLabel(item);
    select.appendChild(option);
  });
  if (manterAtual && valorAtual && options.some((o) => String(getValue(o)) === valorAtual)) {
    select.value = valorAtual;
  }
}

// --- API SUPABASE ---
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
  if (!response.ok) throw new Error(text || "Erro na comunicação.");
  return text ? JSON.parse(text) : [];
}

// --- LOGICA DE CAMPANHA E DADOS ---
async function carregarCampanhaAtual() {
  try {
    const data = await api("campanhas?select=*&order=id.desc&limit=1");
    campanhaAtual = data[0] || { nome: "Campanha 2026/27", inicio_pedidos: "2026-01-01", fim_pedidos: "2026-12-31", ativo: true, _fallback: true };
  } catch (e) { campanhaAtual = { nome: "Erro ao carregar", ativo: true, _fallback: true }; }
}

async function recarregarTudo() {
  await carregarCampanhaAtual();
  [usuariosCache, setores, congregacoes, pedidosCache, recebimentosCache] = await Promise.all([
    api("usuarios?select=*"),
    api("setores?select=*&order=numero.asc"),
    api("congregacoes?select=*&order=nome.asc"),
    api("pedidos?select=*&order=id.desc"),
    api("recebimentos?select=*&order=id.desc")
  ]);
}

// --- LÓGICA DE LOGIN ---
async function fazerLoginSetor(login, senha) {
  const loginN = normalizarTexto(login);
  const user = usuariosCache.find(u => normalizarTexto(u.login) === loginN && String(u.senha).trim() === String(senha).trim());
  if (!user) throw new Error("Login ou senha inválidos.");
  sessao = { tipo: "setor", setor_id: user.setor_id, usuario_id: user.id, setor_nome: user.nome };
  salvarSessao();
}

function fazerLoginAdmin(usuario, senha) {
  if (usuario === CONFIG.adminUsuario && senha === CONFIG.adminSenha) {
    sessao = { tipo: "admin", nome: "Administrador" };
    salvarSessao();
  } else throw new Error("Admin inválido.");
}

// --- LÓGICA DINÂMICA DE TAMANHOS (AQUI ESTÁ A MUDANÇA) ---
function atualizarSelectTamanhos(modeloId, tamanhoId) {
  const modelo = el(modeloId)?.value;
  const grade = GRADES[modelo] || [];
  preencherSelect(tamanhoId, grade, (x) => x, (x) => x, "Selecione o tamanho", false);
}

// --- RENDERIZAÇÃO ---
function renderTela() {
  mostrar("telaLogin", !sessao);
  mostrar("painelSetor", sessao?.tipo === "setor");
  mostrar("painelAdmin", sessao?.tipo === "admin");

  if (sessao?.tipo === "setor") {
    const listaCong = congregacoes.filter(c => String(c.setor_id) === String(sessao.setor_id));
    preencherSelect("pedidoCongregacao", listaCong, c => c.id, c => c.nome);
    renderTabelaPedidosSetor();
  }
  if (sessao?.tipo === "admin") renderPainelAdmin();
}

function renderTabelaPedidosSetor() {
  const corpo = el("tbodyPedidosSetor");
  const lista = pedidosCache.filter(p => String(p.setor_id) === String(sessao.setor_id));
  corpo.innerHTML = lista.map(p => `
    <tr>
      <td>${formatarDataHora(p.created_at)}</td>
      <td>${escapeHtml(congregacoes.find(c => c.id === p.congregacao_id)?.nome)}</td>
      <td>${p.modelo}</td>
      <td>${p.tamanho}</td>
      <td>${p.quantidade}</td>
    </tr>`).join("");
}

function renderPainelAdmin() {
  preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  preencherSelect("recebimentoSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
}

// --- EVENTOS ---
function bindEventos() {
  el("formLoginSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await fazerLoginSetor(el("loginSetor").value, el("senhaSetor").value); renderTela(); } catch(err) { alert(err.message); }
  });

  el("formLoginAdmin")?.addEventListener("submit", (e) => {
    e.preventDefault();
    try { fazerLoginAdmin(el("loginAdmin").value, el("senhaAdmin").value); renderTela(); } catch(err) { alert(err.message); }
  });

  // Atualização dinâmica de tamanhos para Setor
  el("pedidoModelo")?.addEventListener("change", () => atualizarSelectTamanhos("pedidoModelo", "pedidoTamanho"));

  // Atualização dinâmica de tamanhos para Admin
  el("pedidoAdminModelo")?.addEventListener("change", () => atualizarSelectTamanhos("pedidoAdminModelo", "pedidoAdminTamanho"));

  el("btnLogoutSetor")?.addEventListener("click", () => { limparSessao(); renderTela(); });
  el("btnLogoutAdmin")?.addEventListener("click", () => { limparSessao(); renderTela(); });

  el("formPedidoSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      setor_id: sessao.setor_id,
      congregacao_id: el("pedidoCongregacao").value,
      modelo: el("pedidoModelo").value,
      tamanho: el("pedidoTamanho").value,
      quantidade: numero(el("pedidoQuantidade").value),
      data: new Date().toISOString()
    };
    try {
      await api("pedidos", { method: "POST", body: payload });
      await recarregarTudo();
      renderTela();
      alert("Pedido salvo!");
    } catch(err) { alert("Erro ao salvar."); }
  });
}

// --- INICIALIZAÇÃO ---
async function iniciarSistema() {
  bindEventos();
  await recarregarTudo();
  renderTela();
  // Inicializa os tamanhos do primeiro modelo selecionado
  atualizarSelectTamanhos("pedidoModelo", "pedidoTamanho");
}

document.addEventListener("DOMContentLoaded", iniciarSistema);
