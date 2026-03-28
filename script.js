const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Grades atualizadas conforme a nova campanha 2026/27
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"]
};

const CONFIG = {
  valorUnitarioCamiseta: 45,
  adminUsuario: "admin",
  adminSenha: "umadecampi2026",
  adminPodeEditarForaPrazo: true
};

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
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
function numero(v) { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
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

// --- API E DADOS ---
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

// --- LÓGICA DINÂMICA DE TAMANHOS ---
function atualizarSelectTamanhos(modeloId, tamanhoId) {
  const modelo = el(modeloId)?.value;
  const grade = GRADES[modelo] || [];
  preencherSelect(tamanhoId, grade, (x) => x, (x) => x, "Escolha o tamanho");
}

// --- RENDERIZAÇÃO COMPLETA DO ADMIN ---
function renderPainelAdmin() {
  const totalPecas = pedidosCache.reduce((acc, p) => acc + numero(p.quantidade), 0);
  const totalRecebido = recebimentosCache.reduce((acc, r) => acc + numero(r.valor), 0);

  preencherTexto("statAdminPecas", totalPecas);
  preencherTexto("statAdminTotal", moeda(totalPecas * CONFIG.valorUnitarioCamiseta));
  preencherTexto("statAdminRecebido", moeda(totalRecebido));

  preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  preencherSelect("recebimentoSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  preencherSelect("filtroSetorVisualizacao", setores, s => s.id, s => `${s.numero} - ${s.nome}`, "Todos os setores");

  renderVisualizacaoRapida();
}

function renderVisualizacaoRapida() {
  const corpo = el("tbodyVisualizacaoAdmin");
  if (!corpo) return;

  const busca = normalizarTexto(el("buscaVisualizacao")?.value || "");
  const filtroSetor = el("filtroSetorVisualizacao")?.value || "";

  let lista = congregacoes.map(c => {
    const setor = setores.find(s => String(s.id) === String(c.setor_id));
    const peds = pedidosCache.filter(p => String(p.congregacao_id) === String(c.id));
    const recs = recebimentosCache.filter(r => String(r.congregacao_id) === String(c.id));
    const qtd = peds.reduce((acc, p) => acc + numero(p.quantidade), 0);
    const recebido = recs.reduce((acc, r) => acc + numero(r.valor), 0);
    const total = qtd * CONFIG.valorUnitarioCamiseta;

    return {
      setorNome: setor ? `${setor.numero} - ${setor.nome}` : "-",
      setorId: c.setor_id,
      congregacaoNome: c.nome,
      qtd, total, recebido, saldo: total - recebido
    };
  });

  if (filtroSetor) lista = lista.filter(x => String(x.setorId) === String(filtroSetor));
  if (busca) lista = lista.filter(x => normalizarTexto(x.congregacaoNome).includes(busca));

  corpo.innerHTML = lista.map(x => `
    <tr>
      <td>${x.setorNome}</td>
      <td>${x.congregacaoNome}</td>
      <td>${x.qtd}</td>
      <td>${moeda(x.total)}</td>
      <td>${moeda(x.recebido)}</td>
      <td>${moeda(x.saldo)}</td>
    </tr>`).join("");
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

  el("buscaVisualizacao")?.addEventListener("input", renderVisualizacaoRapida);
  el("filtroSetorVisualizacao")?.addEventListener("change", renderVisualizacaoRapida);
  
  el("formLoginAdmin")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (el("loginAdmin").value === CONFIG.adminUsuario && el("senhaAdmin").value === CONFIG.adminSenha) {
      sessao = { tipo: "admin", nome: "Administrador" };
      salvarSessao();
      location.reload();
    }
  });

  el("btnLogoutAdmin")?.addEventListener("click", () => { limparSessao(); location.reload(); });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  await recarregarTudo();
  mostrar("telaLogin", !sessao);
  mostrar("painelAdmin", sessao?.tipo === "admin");
  if (sessao?.tipo === "admin") renderPainelAdmin();
});
