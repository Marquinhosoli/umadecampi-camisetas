const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Grade atualizada conforme a imagem da campanha 2026/27
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"]
};

const CONFIG = { valorUnitarioCamiseta: 45, adminUsuario: "admin", adminSenha: "umadecampi2026" };

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let setores = [], congregacoes = [], pedidosCache = [], recebimentosCache = [];

const el = (id) => document.getElementById(id);

async function api(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  return await response.json();
}

async function recarregarTudo() {
  [setores, congregacoes, pedidosCache, recebimentosCache] = await Promise.all([
    api("setores?select=*&order=numero.asc"),
    api("congregacoes?select=*&order=nome.asc"),
    api("pedidos?select=*"),
    api("recebimentos?select=*")
  ]);
}

function renderAdmin() {
  const totalQtd = pedidosCache.reduce((acc, p) => acc + Number(p.quantidade || 0), 0);
  const totalRec = recebimentosCache.reduce((acc, r) => acc + Number(r.valor || 0), 0);

  // Atualiza os cards do print
  if (el("statSetores")) el("statSetores").textContent = setores.length;
  if (el("statIgrejas")) el("statIgrejas").textContent = congregacoes.length;
  if (el("statPedidos")) el("statPedidos").textContent = pedidosCache.length;
  if (el("statAdminPecas")) el("statAdminPecas").textContent = totalQtd;
  if (el("statAdminTotal")) el("statAdminTotal").textContent = (totalQtd * CONFIG.valorUnitarioCamiseta).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

  preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
  preencherSelect("recebimentoSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
}

function preencherSelect(id, options, getValue, getLabel) {
  const s = el(id);
  if (!s) return;
  s.innerHTML = '<option value="">Selecione</option>';
  options.forEach(opt => {
    const o = document.createElement("option");
    o.value = getValue(opt); o.textContent = getLabel(opt);
    s.appendChild(o);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await recarregarTudo();
  if (sessao?.tipo === "admin") {
    el("painelAdmin").classList.remove("hidden");
    el("telaLogin").classList.add("hidden");
    renderAdmin();
  }

  el("pedidoAdminSetor")?.addEventListener("change", (e) => {
    const lista = congregacoes.filter(c => String(c.setor_id) === String(e.target.value));
    preencherSelect("pedidoAdminCongregacao", lista, c => c.id, c => c.nome);
  });

  el("pedidoAdminModelo")?.addEventListener("change", (e) => {
    preencherSelect("pedidoAdminTamanho", GRADES[e.target.value] || [], x => x, x => x);
  });
});
