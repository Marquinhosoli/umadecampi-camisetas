const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

const tamanhos = ["PP", "P", "M", "G", "GG", "XG", "XXG"];
const modelos = {
  masculino: "Masculino",
  babylook: "Baby Look Feminina",
};

const CONFIG = {
  inicioPedidos: 1,
  fimPedidos: 20,
};

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let setores = [];
let congregacoes = [];
let pedidosCache = [];
let campanhaAtual = null;

const el = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Erro ao consultar o banco.");
  }

  if (response.status === 204) return null;
  return response.json();
}

function getSetorNome(id) {
  return setores.find((s) => s.id === id)?.nome || "Setor";
}

function getCongregacaoNome(id) {
  return congregacoes.find((c) => c.id === id)?.nome || "Congregação";
}

function getStatusEnvioLabel(status) {
  return status === "enviado" ? "Enviado" : "Pendente";
}

function salvarSessao() {
  if (sessao) localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  else localStorage.removeItem(SESSION_KEY);
}

function exportarExcel(nomeArquivo, linhas, nomeAba = "Planilha") {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  XLSX.writeFile(wb, nomeArquivo);
}

function exportarWorkbook(nomeArquivo, abas) {
  const wb = XLSX.utils.book_new();

  abas.forEach((aba) => {
    const ws = XLSX.utils.aoa_to_sheet(aba.linhas || []);
    XLSX.utils.book_append_sheet(wb, ws, aba.nome);
  });

  XLSX.writeFile(wb, nomeArquivo);
}

function pedidosBloqueados() {
  const hoje = new Date();
  const dia = hoje.getDate();

  if (dia < CONFIG.inicioPedidos) return true;
  if (dia > CONFIG.fimPedidos) return true;

  return false;
}

function preencherFiltroSetoresAdmin() {
  const select = el("filtroSetoresAdmin");
  if (!select) return;

  const selecionadosAtuais = getSetoresSelecionadosAdmin();
  select.innerHTML = "";

  setores
    .slice()
    .sort((a, b) => {
      const na = Number(a.numero || 0);
      const nb = Number(b.numero || 0);
      if (na !== nb) return na - nb;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    })
    .forEach((setor) => {
      const option = document.createElement("option");
      option.value = String(setor.id);
      option.textContent = setor.numero ? `${setor.numero} - ${setor.nome}` : setor.nome;
      option.selected = selecionadosAtuais.includes(String(setor.id));
      select.appendChild(option);
    });
}

function preencherSetoresAdminPedido() {
  const select = el("setorAdminPedido");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = `<option value="">Selecione o setor</option>`;

  setores
    .slice()
    .sort((a, b) => {
      const na = Number(a.numero || 0);
      const nb = Number(b.numero || 0);
      if (na !== nb) return na - nb;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    })
    .forEach((setor) => {
      const option = document.createElement("option");
      option.value = String(setor.id);
      option.textContent = setor.numero ? `${setor.numero} - ${setor.nome}` : setor.nome;
      select.appendChild(option);
    });

  if (valorAtual && Array.from(select.options).some((o) => o.value === valorAtual)) {
    select.value = valorAtual;
  }
}

function getSetoresSelecionadosAdmin() {
  const select = el("filtroSetoresAdmin");
  if (!select) return [];
  return Array.from(select.selectedOptions).map((option) => String(option.value));
}

function getFiltroStatusAdmin() {
  return (el("filtroStatusAdmin")?.value || "todos").trim().toLowerCase();
}

function getSetorPedidoAtual() {
  if (!sessao) return null;

  if (sessao.tipo === "setor") {
    return sessao.setor_id || null;
  }

  if (sessao.tipo === "admin") {
    const setorSelecionado = el("setorAdminPedido")?.value || "";
    return setorSelecionado ? Number(setorSelecionado) : null;
  }

  return null;
}

function atualizarVisibilidadeAdminPedido() {
  const wrapper = el("adminSetorWrapper");
  if (!wrapper) return;

  if (sessao?.tipo === "admin") {
    wrapper.classList.remove("hidden");
  } else {
    wrapper.classList.add("hidden");
  }
}

function selecionarTodosSetoresAdmin() {
  const select = el("filtroSetoresAdmin");
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    option.selected = true;
  });

  renderAdmin();
}

function limparSetoresAdmin() {
  const select = el("filtroSetoresAdmin");
  if (!select) return;

  Array.from(select.options).forEach((option) => {
    option.selected = false;
  });

  renderAdmin();
}

function getPedidosAdminFiltrados() {
  const busca = (el("busca")?.value || "").trim().toLowerCase();
  const setoresSelecionados = getSetoresSelecionadosAdmin();
  const filtroStatus = getFiltroStatusAdmin();

  return pedidosCache.filter((p) => {
    const setorIdTexto = String(p.setorId);
    const passouFiltroSetor =
      setoresSelecionados.length === 0 || setoresSelecionados.includes(setorIdTexto);

    if (!passouFiltroSetor) return false;

    if (filtroStatus !== "todos" && (p.statusEnvio || "pendente") !== filtroStatus) {
      return false;
    }

    if (!busca) return true;

    return (
      p.congregacao.toLowerCase().includes(busca) ||
      getSetorNome(p.setorId).toLowerCase().includes(busca) ||
      (modelos[p.modelo] || p.modelo).toLowerCase().includes(busca) ||
      p.tamanho.toLowerCase().includes(busca) ||
      getStatusEnvioLabel(p.statusEnvio).toLowerCase().includes(busca)
    );
  });
}

function resumoGeral(listaPedidos = pedidosCache) {
  const mapa = {
    masculino: Object.fromEntries(tamanhos.map((t) => [t, 0])),
    babylook: Object.fromEntries(tamanhos.map((t) => [t, 0])),
  };

  listaPedidos.forEach((p) => {
    if (mapa[p.modelo] && mapa[p.modelo][p.tamanho] !== undefined) {
      mapa[p.modelo][p.tamanho] += Number(p.quantidade || 0);
    }
  });

  return mapa;
}

function resumoPorSetor(listaPedidos = pedidosCache) {
  const mapa = {};

  listaPedidos.forEach((p) => {
    const nomeSetor = getSetorNome(p.setorId);
    mapa[nomeSetor] = (mapa[nomeSetor] || 0) + Number(p.quantidade || 0);
  });

  return mapa;
}

function rankingSetores(listaPedidos = pedidosCache) {
  return Object.entries(resumoPorSetor(listaPedidos))
    .map(([setor, total]) => ({ setor, total }))
    .sort((a, b) => b.total - a.total || a.setor.localeCompare(b.setor, "pt-BR"));
}

function calcularTotaisGeraisAdmin(listaPedidos = pedidosCache) {
  return listaPedidos.reduce(
    (acc, pedido) => {
      const quantidade = Number(pedido.quantidade || 0);

      acc.totalGeral += quantidade;

      if (pedido.modelo === "masculino") acc.totalMasculino += quantidade;
      if (pedido.modelo === "babylook") acc.totalBabylook += quantidade;

      return acc;
    },
    {
      totalGeral: 0,
      totalMasculino: 0,
      totalBabylook: 0,
    }
  );
}

function renderTotaisGeraisAdmin(listaPedidos = pedidosCache) {
  const container = el("totaisGeraisAdmin");
  if (!container) return;

  container.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    container.innerHTML = `
      <div class="summary-stat">
        <span>0</span>
        <small>Somente administrador</small>
      </div>
    `;
    return;
  }

  const totais = calcularTotaisGeraisAdmin(listaPedidos);

  [
    { titulo: "Total geral", valor: totais.totalGeral },
    { titulo: "Masculino", valor: totais.totalMasculino },
    { titulo: "Baby Look Feminina", valor: totais.totalBabylook },
  ].forEach((card) => {
    const item = document.createElement("div");
    item.className = "summary-stat";
    item.innerHTML = `<span>${card.valor}</span><small>${card.titulo}</small>`;
    container.appendChild(item);
  });
}

function renderRankingSetoresAdmin(listaPedidos = pedidosCache) {
  const container = el("rankingSetoresAdmin");
  if (!container) return;

  container.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    container.innerHTML =
      '<div class="pedido-card">Somente o administrador pode visualizar o ranking.</div>';
    return;
  }

  const ranking = rankingSetores(listaPedidos);

  if (!ranking.length) {
    container.innerHTML =
      '<div class="pedido-card">Nenhum setor encontrado para o ranking com os filtros atuais.</div>';
    return;
  }

  ranking.forEach((itemRanking, index) => {
    const card = document.createElement("div");
    card.className = "pedido-card";
    card.innerHTML = `
      <strong>${index + 1}º lugar • ${itemRanking.setor}</strong>
      <div style="margin-top:8px;">
        <span class="pill">Total ${itemRanking.total}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

async function carregarDadosBase() {
  const [setoresData, congregacoesData, campanhasData] = await Promise.all([
    api("setores?select=id,numero,nome&order=numero.asc"),
    api("congregacoes?select=id,setor_id,nome&order=nome.asc"),
    api("campanhas?select=id,nome,ano,status&order=ano.desc&limit=1"),
  ]);

  setores = setoresData || [];
  congregacoes = congregacoesData || [];
  campanhaAtual = campanhasData?.[0] || null;

  const statSpans = document.querySelectorAll(".stat");
  if (statSpans[0]) statSpans[0].textContent = setores.length || 0;
  if (statSpans[1]) statSpans[1].textContent = congregacoes.length || 0;
}

function preencherCongregacoesSetor() {
  const lista = el("listaCongregacoes");
  if (!lista) return;

  lista.innerHTML = "";

  const setorAtual = getSetorPedidoAtual();
  if (!setorAtual) return;

  congregacoes
    .filter((c) => c.setor_id === setorAtual)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .forEach((c) => {
      const option = document.createElement("option");
      option.value = c.nome;
      lista.appendChild(option);
    });
}

async function carregarPedidos() {
  const pedidos = await api(
    "pedidos?select=id,campanha_id,setor_id,congregacao_id,usuario_id,data&order=data.desc"
  );
  const itens = await api(
    "itens_pedido?select=id,pedido_id,modelo,tamanho,quantidade,status_envio"
  );

  const itensPorPedido = new Map();
  (itens || []).forEach((item) => {
    if (!itensPorPedido.has(item.pedido_id)) itensPorPedido.set(item.pedido_id, []);
    itensPorPedido.get(item.pedido_id).push(item);
  });

  pedidosCache = [];
  (pedidos || []).forEach((pedido) => {
    const lista = itensPorPedido.get(pedido.id) || [];
    lista.forEach((item) => {
      pedidosCache.push({
        id: pedido.id,
        itemId: item.id,
        campanhaId: pedido.campanha_id,
        setorId: pedido.setor_id,
        congregacaoId: pedido.congregacao_id,
        congregacao: getCongregacaoNome(pedido.congregacao_id),
        modelo: item.modelo,
        tamanho: item.tamanho,
        quantidade: Number(item.quantidade || 0),
        statusEnvio: item.status_envio || "pendente",
      });
    });
  });
}

function ativarTab(nome) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === nome);
  });

  el("tab-setor")?.classList.toggle("active", nome === "setor");
  el("tab-admin")?.classList.toggle("active", nome === "admin");
}

function atualizarPermissoesTabs() {
  const btnSetor = document.querySelector('[data-tab="setor"]');
  const btnAdmin = document.querySelector('[data-tab="admin"]');
  if (!btnSetor || !btnAdmin) return;

  btnSetor.style.opacity = "1";
  btnAdmin.style.opacity = sessao?.tipo === "admin" ? "1" : "0.5";

  if (sessao?.tipo === "admin") ativarTab("admin");
  else ativarTab("setor");
}

async function removerPedido(itemId, pedidoId) {
  try {
    await api(`itens_pedido?id=eq.${itemId}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });

    const restantes = await api(`itens_pedido?select=id&pedido_id=eq.${pedidoId}`);

    if (!restantes || restantes.length === 0) {
      await api(`pedidos?id=eq.${pedidoId}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    }

    await carregarPedidos();
    renderSetor();
    renderAdmin();
  } catch (error) {
    console.error(error);
    alert("Não foi possível remover o pedido.");
  }
}

async function editarPedidoAdmin(itemId) {
  const pedido = pedidosCache.find((p) => p.itemId === itemId);
  if (!pedido) return;

  const novaQuantidade = prompt("Nova quantidade:", String(pedido.quantidade));
  if (novaQuantidade === null) return;

  const qtd = Number(novaQuantidade);
  if (!Number.isFinite(qtd) || qtd < 1) {
    alert("Quantidade inválida.");
    return;
  }

  const novoModelo = prompt("Modelo: masculino ou babylook", pedido.modelo);
  if (novoModelo === null) return;

  const modeloFinal = String(novoModelo).trim().toLowerCase();
  if (!["masculino", "babylook"].includes(modeloFinal)) {
    alert("Modelo inválido. Use masculino ou babylook.");
    return;
  }

  const novoTamanho = prompt("Tamanho: PP, P, M, G, GG, XG, XXG
