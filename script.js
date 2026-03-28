const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Grades atualizadas conforme sua imagem
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"]
};

const CONFIG = {
  valorUnitarioCamiseta: 45,
  adminUsuario: "admin",
  adminSenha: "umadecampi2026"
};

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let setores = [], congregacoes = [], pedidosCache = [], recebimentosCache = [];

const el = (id) => document.getElementById(id);

// --- CONEXÃO COM O BANCO ---
async function api(path, options = {}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return await response.json();
  } catch (e) {
    console.error("Erro na API:", e);
    return [];
  }
}

async function recarregarTudo() {
  [setores, congregacoes, pedidosCache, recebimentosCache] = await Promise.all([
    api("setores?select=*&order=numero.asc"),
    api("congregacoes?select=*&order=nome.asc"),
    api("pedidos?select=*&order=created_at.desc"),
    api("recebimentos?select=*&order=id.desc")
  ]);
}

// --- INTERFACE E CÁLCULOS ---
function preencherSelect(id, options, getValue, getLabel) {
  const s = el(id);
  if (!s) return;
  s.innerHTML = '<option value="">Selecione</option>';
  options.forEach(opt => {
    const o = document.createElement("option");
    o.value = getValue(opt);
    o.textContent = getLabel(opt);
    s.appendChild(o);
  });
}

function renderAdmin() {
  const totalQtd = pedidosCache.reduce((acc, p) => acc + Number(p.quantidade || 0), 0);
  const totalRec = recebimentosCache.reduce((acc, r) => acc + Number(r.valor || 0), 0);

  if (el("statAdminPecas")) el("statAdminPecas").textContent = totalQtd;
  if (el("statAdminTotal")) el("statAdminTotal").textContent = (totalQtd * CONFIG.valorUnitarioCamiseta).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
  if (el("statAdminRecebido")) el("statAdminRecebido").textContent = totalRec.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  preencherSelect("recebimentoSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  renderTabelaResumo();
}

function renderTabelaResumo() {
  const corpo = el("tbodyVisualizacaoAdmin");
  if (!corpo) return;
  corpo.innerHTML = congregacoes.map(c => {
    const setor = setores.find(s => String(s.id) === String(c.setor_id));
    const peds = pedidosCache.filter(p => String(p.congregacao_id) === String(c.id));
    const recs = recebimentosCache.filter(r => String(r.congregacao_id) === String(c.id));
    const qtd = peds.reduce((acc, p) => acc + Number(p.quantidade || 0), 0);
    const pago = recs.reduce((acc, r) => acc + Number(r.valor || 0), 0);
    const total = qtd * CONFIG.valorUnitarioCamiseta;
    return `<tr><td>${setor?.numero || '-'}</td><td>${c.nome}</td><td>${qtd}</td><td>${moeda(total)}</td><td>${moeda(pago)}</td><td>${moeda(total - pago)}</td></tr>`;
  }).join("");
}

function moeda(v) { return Number(v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}); }

// --- EVENTOS ---
function bindEventos() {
  el("formLoginAdmin")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (el("loginAdmin").value === CONFIG.adminUsuario && el("senhaAdmin").value === CONFIG.adminSenha) {
      sessao = { tipo: "admin" };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
      location.reload();
    } else { alert("Senha incorreta!"); }
  });

  el("pedidoAdminSetor")?.addEventListener("change", (e) => {
    const lista = congregacoes.filter(c => String(c.setor_id) === String(e.target.value));
    preencherSelect("pedidoAdminCongregacao", lista, c => c.id, c => c.nome);
  });

  el("pedidoAdminModelo")?.addEventListener("change", (e) => {
    preencherSelect("pedidoAdminTamanho", GRADES[e.target.value] || [], x => x, x => x);
  });

  el("formPedidoAdmin")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      setor_id: el("pedidoAdminSetor").value,
      congregacao_id: el("pedidoAdminCongregacao").value,
      modelo: el("pedidoAdminModelo").value,
      tamanho: el("pedidoAdminTamanho").value,
      quantidade: Number(el("pedidoAdminQuantidade").value)
    };
    await api("pedidos", { method: "POST", body });
    alert("Pedido salvo!");
    location.reload();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindEventos();
  await recarregarTudo();
  if (sessao?.tipo === "admin") {
    el("painelAdmin")?.classList.remove("hidden");
    el("telaLogin")?.classList.add("hidden");
    renderAdmin();
  }
});
