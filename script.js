const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Grade atualizada conforme a imagem da campanha 2026/27
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"]
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

// --- UTILITÁRIOS ---
function salvarSessao() { localStorage.setItem(SESSION_KEY, JSON.stringify(sessao)); }
function limparSessao() { sessao = null; localStorage.removeItem(SESSION_KEY); }
function normalizarTexto(txt) { return String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
function numero(v) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
function moeda(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dataBr(valor) { 
  if (!valor) return "-";
  const d = new Date(valor);
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  return d.toLocaleDateString("pt-BR");
}

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

// --- API E CARREGAMENTO ---
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
  return response.ok ? response.json() : [];
}

async function recarregarTudo() {
  [usuariosCache, setores, congregacoes, pedidosCache, recebimentosCache, campanhaArr] = await Promise.all([
    api("usuarios?select=*"),
    api("setores?select=*&order=numero.asc"),
    api("congregacoes?select=*&order=nome.asc"),
    api("pedidos?select=*&order=id.desc"),
    api("recebimentos?select=*&order=id.desc"),
    api("campanhas?select=*&ativo=eq.true&limit=1")
  ]);
  campanhaAtual = campanhaArr[0] || { nome: "Campanha 2026/27", ativo: true };
}

// --- LOGICA DINÂMICA DE TAMANHOS ---
function atualizarSelectTamanhos(modeloId, tamanhoId) {
  const modelo = el(modeloId)?.value;
  const grade = GRADES[modelo] || [];
  preencherSelect(tamanhoId, grade, (x) => x, (x) => x, "Escolha o tamanho");
}

// --- RENDERIZAÇÃO COMPLETA (ADMIN E SETOR) ---
function renderTela() {
  mostrar("telaLogin", !sessao);
  mostrar("painelSetor", sessao?.tipo === "setor");
  mostrar("painelAdmin", sessao?.tipo === "admin");

  preencherTexto("statSetores", setores.length);
  preencherTexto("statIgrejas", congregacoes.length);
  preencherTexto("statPedidos", pedidosCache.length);

  if (sessao?.tipo === "setor") {
    const lista = congregacoes.filter(c => String(c.setor_id) === String(sessao.setor_id));
    preencherSelect("pedidoCongregacao", lista, c => c.id, c => c.nome);
  }

  if (sessao?.tipo === "admin") {
    preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
    preencherSelect("recebimentoSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
    preencherSelect("filtroSetorVisualizacao", setores, s => s.id, s => `${s.numero} - ${s.nome}`, "Todos os setores");
    renderResumosAdmin();
  }
}

function renderResumosAdmin() {
  const totalPecas = pedidosCache.reduce((acc, p) => acc + numero(p.quantidade), 0);
  preencherTexto("statAdminPecas", totalPecas);
  preencherTexto("statAdminTotal", moeda(totalPecas * CONFIG.valorUnitarioCamiseta));
}

// --- EVENTOS ---
function bindEventos() {
  el("pedidoModelo")?.addEventListener("change", () => atualizarSelectTamanhos("pedidoModelo", "pedidoTamanho"));
  el("pedidoAdminModelo")?.addEventListener("change", () => atualizarSelectTamanhos("pedidoAdminModelo", "pedidoAdminTamanho"));
  
  el("pedidoAdminSetor")?.addEventListener("change", (e) => {
    const lista = congregacoes.filter(c => String(c.setor_id) === String(e.target.value));
    preencherSelect("pedidoAdminCongregacao", lista, c => c.id, c => c.nome);
  });

  el("recebimentoSetor")?.addEventListener("change", (e) => {
    const lista = congregacoes.filter(c => String(c.setor_id) === String(e.target.value));
    preencherSelect("recebimentoCongregacao", lista, c => c.id, c => c.nome);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  await recarregarTudo();
  renderTela();
});
