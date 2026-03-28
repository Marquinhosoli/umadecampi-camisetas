const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

// Grades atualizadas conforme a imagem
const GRADES = {
  "Masculino": ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3", "G4"],
  "Baby Look Feminina": ["PP", "P", "M", "G", "GG", "XG", "G1"],
  "Infantil": ["2", "4", "6", "8", "10", "12", "14"]
};

const CONFIG = { valorUnitarioCamiseta: 45, adminUsuario: "admin", adminSenha: "umadecampi2026" };

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let setores = [], congregacoes = [], pedidosCache = [], recebimentosCache = [];

const el = (id) => document.getElementById(id);

// --- CONEXÃO COM O BANCO ---
async function api(path) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    return await response.json();
  } catch (e) { console.error("Erro na API:", e); return []; }
}

async function recarregarTudo() {
  const [s, c, p, r] = await Promise.all([
    api("setores?select=*&order=numero.asc"),
    api("congregacoes?select=*&order=nome.asc"),
    api("pedidos?select=*"),
    api("recebimentos?select=*")
  ]);
  setores = s; congregacoes = c; pedidosCache = p; recebimentosCache = r;
}

// --- INTERFACE ---
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
  if (el("statAdminPecas")) el("statAdminPecas").textContent = totalQtd;
  
  preencherSelect("pedidoAdminSetor", setores, s => s.id, s => `${s.numero} - ${s.nome}`);
}

// --- INICIALIZAÇÃO ---
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

  el("pedidoAdminModelo")?.addEventListener("change", () => {
    const modelo = el("pedidoAdminModelo").value;
    preencherSelect("pedidoAdminTamanho", GRADES[modelo] || [], x => x, x => x);
  });
});
