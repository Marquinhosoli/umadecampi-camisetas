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
  adminPodeEditarForaPrazo: true,
  valorUnitarioCamiseta: 45,
};

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let setores = [];
let congregacoes = [];
let pedidosCache = [];
let campanhaAtual = null;
let recebimentosCache = [];

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
  return setores.find((s) => String(s.id) === String(id))?.nome || "Setor";
}

function getCongregacaoNome(id) {
  return congregacoes.find((c) => String(c.id) === String(id))?.nome || "Congregação";
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

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarDataBR(data) {
  if (!data) return "-";
  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString("pt-BR");
}

function formatarDataHoraBR(data) {
  if (!data) return "-";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleString("pt-BR");
}

function pedidosBloqueadosParaSetor() {
  const hoje = new Date();
  const dia = hoje.getDate();
  return dia < CONFIG.inicioPedidos || dia > CONFIG.fimPedidos;
}

function adminPodeEditarForaPrazo() {
  return !!CONFIG.adminPodeEditarForaPrazo;
}

function podeEditarPedidosNaSessao() {
  if (!sessao) return false;

  if (sessao.tipo === "admin") {
    if (pedidosBloqueadosParaSetor()) return adminPodeEditarForaPrazo();
    return true;
  }

  if (sessao.tipo === "setor") {
    return !pedidosBloqueadosParaSetor();
  }

  return false;
}

function getSetorSessaoTexto() {
  if (!sessao || sessao.tipo !== "setor") return null;
  return String(sessao.setor_id || "").trim() || null;
}

function pedidoPertenceAoSetorDaSessao(pedido) {
  if (!sessao || sessao.tipo !== "setor") return false;
  return String(pedido?.setorId) === String(getSetorSessaoTexto());
}

function atualizarAvisoPeriodoPedidos() {
  const aviso = el("avisoPeriodoPedidos");
  const btnAdicionar = el("btnAdicionar");
  if (!aviso || !btnAdicionar) return;

  if (!sessao) {
    aviso.classList.add("hidden");
    aviso.innerHTML = "";
    btnAdicionar.disabled = true;
    return;
  }

  if (sessao.tipo === "admin") {
    if (pedidosBloqueadosParaSetor()) {
      aviso.classList.remove("hidden");
      aviso.innerHTML = `
        <strong>Período fechado para setores</strong>
        <p>Os líderes de setor só podem lançar pedidos do dia ${CONFIG.inicioPedidos} ao dia ${CONFIG.fimPedidos} de cada mês. Como administrador, você ainda pode lançar e ajustar pedidos.</p>
      `;
    } else {
      aviso.classList.add("hidden");
      aviso.innerHTML = "";
    }

    btnAdicionar.disabled = false;
    return;
  }

  if (sessao.tipo === "setor" && pedidosBloqueadosParaSetor()) {
    aviso.classList.remove("hidden");
    aviso.innerHTML = `
      <strong>Período fechado para pedidos</strong>
      <p>Os líderes de setor só podem lançar, editar e remover pedidos do dia ${CONFIG.inicioPedidos} ao dia ${CONFIG.fimPedidos} de cada mês.</p>
    `;
    btnAdicionar.disabled = true;
  } else {
    aviso.classList.add("hidden");
    aviso.innerHTML = "";
    btnAdicionar.disabled = false;
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
    return String(sessao.setor_id || "").trim() || null;
  }

  if (sessao.tipo === "admin") {
    const select = el("setorAdminPedido");
    const valor = String(select?.value || "").trim();
    return valor || null;
  }

  return null;
}

function atualizarVisibilidadeAdminPedido() {
  const wrapper = el("adminSetorWrapper");
  if (!wrapper) return;

  if (sessao?.tipo === "admin") wrapper.classList.remove("hidden");
  else wrapper.classList.add("hidden");
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

  const valorAtual = String(select.value || "");
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

  preencherCongregacoesSetor();
}

function preencherSetoresFinanceiro() {
  const select = el("financeiroSetor");
  if (!select) return;

  const valorAtual = String(select.value || "");
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
      String(p.congregacao || "").toLowerCase().includes(busca) ||
      getSetorNome(p.setorId).toLowerCase().includes(busca) ||
      (modelos[p.modelo] || p.modelo).toLowerCase().includes(busca) ||
      String(p.tamanho || "").toLowerCase().includes(busca) ||
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

function calcularIndicadoresAdmin(listaPedidos = pedidosCache) {
  const totais = calcularTotaisGeraisAdmin(listaPedidos);

  const idsPedidos = new Set();
  const idsSetores = new Set();
  const idsCongregacoes = new Set();
  let totalPendentes = 0;
  let totalEnviados = 0;

  listaPedidos.forEach((pedido) => {
    if (pedido.id !== undefined && pedido.id !== null) {
      idsPedidos.add(String(pedido.id));
    }

    if (pedido.setorId !== undefined && pedido.setorId !== null) {
      idsSetores.add(String(pedido.setorId));
    }

    if (pedido.congregacaoId !== undefined && pedido.congregacaoId !== null) {
      idsCongregacoes.add(String(pedido.congregacaoId));
    }

    if ((pedido.statusEnvio || "pendente") === "enviado") totalEnviados += 1;
    else totalPendentes += 1;
  });

  return {
    totalPedidos: idsPedidos.size,
    totalItens: listaPedidos.length,
    totalGeral: totais.totalGeral,
    totalMasculino: totais.totalMasculino,
    totalBabylook: totais.totalBabylook,
    setoresParticipantes: idsSetores.size,
    congregacoesParticipantes: idsCongregacoes.size,
    setoresSemPedidos: Math.max(setores.length - idsSetores.size, 0),
    congregacoesSemPedidos: Math.max(congregacoes.length - idsCongregacoes.size, 0),
    totalPendentes,
    totalEnviados,
  };
}

function getCongregacoesComPedidos(listaPedidos = pedidosCache) {
  const ids = new Set();
  listaPedidos.forEach((pedido) => {
    if (pedido.congregacaoId !== undefined && pedido.congregacaoId !== null) {
      ids.add(String(pedido.congregacaoId));
    }
  });
  return ids;
}

function listarCongregacoesSemPedidos(listaPedidos = pedidosCache) {
  const congregacoesComPedidos = getCongregacoesComPedidos(listaPedidos);

  return congregacoes
    .filter((congregacao) => !congregacoesComPedidos.has(String(congregacao.id)))
    .map((congregacao) => ({
      id: congregacao.id,
      nome: congregacao.nome,
      setorId: congregacao.setor_id,
      setorNome: getSetorNome(congregacao.setor_id),
    }))
    .sort((a, b) => {
      const cmpSetor = String(a.setorNome).localeCompare(String(b.setorNome), "pt-BR");
      if (cmpSetor !== 0) return cmpSetor;
      return String(a.nome).localeCompare(String(b.nome), "pt-BR");
    });
}

function calcularFinanceiroPorSetor(listaPedidos = pedidosCache) {
  const mapa = {};

  listaPedidos.forEach((pedido) => {
    const setorNome = getSetorNome(pedido.setorId);
    const quantidade = Number(pedido.quantidade || 0);
    const valor = quantidade * Number(CONFIG.valorUnitarioCamiseta || 0);

    if (!mapa[setorNome]) {
      mapa[setorNome] = {
        setor: setorNome,
        quantidade: 0,
        valor: 0,
      };
    }

    mapa[setorNome].quantidade += quantidade;
    mapa[setorNome].valor += valor;
  });

  return Object.values(mapa).sort(
    (a, b) => b.valor - a.valor || a.setor.localeCompare(b.setor, "pt-BR")
  );
}

function calcularFinanceiroGeral(listaPedidos = pedidosCache) {
  return listaPedidos.reduce(
    (acc, pedido) => {
      const quantidade = Number(pedido.quantidade || 0);
      acc.quantidade += quantidade;
      acc.valor += quantidade * Number(CONFIG.valorUnitarioCamiseta || 0);
      return acc;
    },
    { quantidade: 0, valor: 0 }
  );
}

function getRecebimentosFiltradosAdmin() {
  const setoresSelecionados = getSetoresSelecionadosAdmin();

  return recebimentosCache
    .filter((item) => {
      if (!setoresSelecionados.length) return true;
      return setoresSelecionados.includes(String(item.setor_id));
    })
    .sort((a, b) => {
      const dataA = new Date(a.data_registro || a.data_recebimento || 0).getTime();
      const dataB = new Date(b.data_registro || b.data_recebimento || 0).getTime();
      return dataB - dataA;
    });
}

function calcularRecebidoPorSetor(listaRecebimentos = recebimentosCache) {
  const mapa = {};

  listaRecebimentos.forEach((item) => {
    const setorNome = getSetorNome(item.setor_id);
    const valor = Number(item.valor || 0);

    if (!mapa[setorNome]) {
      mapa[setorNome] = {
        setor: setorNome,
        valor: 0,
        registros: 0,
      };
    }

    mapa[setorNome].valor += valor;
    mapa[setorNome].registros += 1;
  });

  return Object.values(mapa).sort(
    (a, b) => b.valor - a.valor || a.setor.localeCompare(b.setor, "pt-BR")
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

  const indicadores = calcularIndicadoresAdmin(listaPedidos);
  const financeiro = calcularFinanceiroGeral(listaPedidos);

  const cards = [
    { titulo: "Pedidos", valor: indicadores.totalPedidos },
    { titulo: "Itens lançados", valor: indicadores.totalItens },
    { titulo: "Camisetas totais", valor: indicadores.totalGeral },
    { titulo: "Valor total", valor: formatarMoeda(financeiro.valor) },
    { titulo: "Masculino", valor: indicadores.totalMasculino },
    { titulo: "Baby Look Feminina", valor: indicadores.totalBabylook },
    { titulo: "Setores participantes", valor: `${indicadores.setoresParticipantes}/${setores.length}` },
    { titulo: "Congregações participantes", valor: `${indicadores.congregacoesParticipantes}/${congregacoes.length}` },
    { titulo: "Setores sem pedidos", valor: indicadores.setoresSemPedidos },
    { titulo: "Congregações sem pedidos", valor: indicadores.congregacoesSemPedidos },
    { titulo: "Itens pendentes", valor: indicadores.totalPendentes },
    { titulo: "Itens enviados", valor: indicadores.totalEnviados },
  ];

  cards.forEach((card) => {
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
    const posicao = index + 1;
    const medalha = posicao === 1 ? "🥇" : posicao === 2 ? "🥈" : posicao === 3 ? "🥉" : "🏅";

    const card = document.createElement("div");
    card.className = "pedido-card";
    card.innerHTML = `
      <strong>${medalha} ${posicao}º lugar • ${itemRanking.setor}</strong>
      <div style="margin-top:8px;">
        <span class="pill">Total ${itemRanking.total}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderCongregacoesSemPedidosAdmin(listaPedidos = pedidosCache) {
  const resumo = el("congregacoesSemPedidosResumo");
  const container = el("congregacoesSemPedidosAdmin");
  if (!resumo || !container) return;

  resumo.innerHTML = "";
  container.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    resumo.innerHTML =
      '<div class="pedido-card">Somente o administrador pode visualizar esta área.</div>';
    return;
  }

  const lista = listarCongregacoesSemPedidos(listaPedidos);

  const cardResumo = document.createElement("div");
  cardResumo.className = "pedido-card";

  if (!lista.length) {
    cardResumo.innerHTML = `
      <strong>Todas as congregações já lançaram pedidos</strong>
      <div style="margin-top:8px;">
        <span class="pill">0 pendentes</span>
      </div>
    `;
    resumo.appendChild(cardResumo);
    return;
  }

  cardResumo.innerHTML = `
    <strong>${lista.length} congregação(ões) sem pedidos</strong>
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
      <span class="pill">Pendentes: ${lista.length}</span>
      <button id="abrirModalCongregacoes" class="secondary" type="button">Ver lista completa</button>
    </div>
  `;

  resumo.appendChild(cardResumo);

  lista.forEach((item) => {
    const card = document.createElement("div");
    card.className = "pedido-card";
    card.innerHTML = `
      <strong>${item.nome}</strong>
      <div style="margin-top:8px;">
        <span class="pill">${item.setorNome}</span>
      </div>
    `;
    container.appendChild(card);
  });

  el("abrirModalCongregacoes")?.addEventListener("click", () => {
    el("modalCongregacoesSemPedidos")?.classList.remove("hidden");
  });
}

function renderFinanceiroPorSetorAdmin(listaPedidos = pedidosCache) {
  const container = el("financeiroPorSetorAdmin");
  if (!container) return;

  container.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    container.innerHTML =
      '<div class="pedido-card">Somente o administrador pode visualizar o financeiro.</div>';
    return;
  }

  const financeiro = calcularFinanceiroPorSetor(listaPedidos);
  const recebidos = calcularRecebidoPorSetor(getRecebimentosFiltradosAdmin());
  const recebidosMap = Object.fromEntries(recebidos.map((r) => [r.setor, r]));
  const geral = calcularFinanceiroGeral(listaPedidos);

  if (!financeiro.length) {
    container.innerHTML =
      '<div class="pedido-card">Nenhum pedido encontrado para o financeiro.</div>';
    return;
  }

  const totalRecebido = recebidos.reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const resumo = document.createElement("div");
  resumo.className = "pedido-card";
  resumo.innerHTML = `
    <strong>Total geral estimado</strong>
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
      <span class="pill">Camisetas: ${geral.quantidade}</span>
      <span class="pill">Estimado: ${formatarMoeda(geral.valor)}</span>
      <span class="pill">Recebido: ${formatarMoeda(totalRecebido)}</span>
      <span class="pill">Unitário: ${formatarMoeda(CONFIG.valorUnitarioCamiseta)}</span>
    </div>
  `;
  container.appendChild(resumo);

  financeiro.forEach((item) => {
    const recebido = Number(recebidosMap[item.setor]?.valor || 0);
    const saldo = item.valor - recebido;

    const card = document.createElement("div");
    card.className = "pedido-card";
    card.innerHTML = `
      <strong>${item.setor}</strong>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <span class="pill">Qtd. ${item.quantidade}</span>
        <span class="pill">Estimado: ${formatarMoeda(item.valor)}</span>
        <span class="pill">Recebido: ${formatarMoeda(recebido)}</span>
        <span class="pill">Saldo: ${formatarMoeda(saldo)}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderResumoFinanceiroSetores() {
  const container = el("financeiroResumoSetores");
  if (!container) return;

  container.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    container.innerHTML =
      '<div class="pedido-card">Somente o administrador pode visualizar esta área.</div>';
    return;
  }

  const recebidos = calcularRecebidoPorSetor(getRecebimentosFiltradosAdmin());
  const estimados = calcularFinanceiroPorSetor(getPedidosAdminFiltrados());
  const estimadosMap = Object.fromEntries(estimados.map((item) => [item.setor, item]));

  if (!estimados.length && !recebidos.length) {
    container.innerHTML =
      '<div class="pedido-card">Nenhum dado financeiro encontrado.</div>';
    return;
  }

  const nomes = new Set([
    ...estimados.map((item) => item.setor),
    ...recebidos.map((item) => item.setor),
  ]);

  Array.from(nomes)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach((setor) => {
      const estimado = Number(estimadosMap[setor]?.valor || 0);
      const camisetas = Number(estimadosMap[setor]?.quantidade || 0);
      const recebido = Number(recebidos.find((r) => r.setor === setor)?.valor || 0);
      const saldo = estimado - recebido;

      const card = document.createElement("div");
      card.className = "pedido-card";
      card.innerHTML = `
        <strong>${setor}</strong>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <span class="pill">Qtd. ${camisetas}</span>
          <span class="pill">Estimado: ${formatarMoeda(estimado)}</span>
          <span class="pill">Recebido: ${formatarMoeda(recebido)}</span>
          <span class="pill">Saldo: ${formatarMoeda(saldo)}</span>
        </div>
      `;
      container.appendChild(card);
    });
}

function renderHistoricoRecebimentos() {
  const tbody = el("tbodyRecebimentos");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    tbody.innerHTML = '<tr><td colspan="5">Somente o administrador pode visualizar esta área.</td></tr>';
    return;
  }

  const lista = getRecebimentosFiltradosAdmin();

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum recebimento registrado.</td></tr>';
    return;
  }

  lista.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatarDataBR(item.data_recebimento)}</td>
      <td>${getSetorNome(item.setor_id)}</td>
      <td>${formatarMoeda(item.valor)}</td>
      <td>${item.observacao || "-"}</td>
      <td>${item.usuario_nome || item.usuario_id || "-"}</td>
    `;
    tbody.appendChild(tr);
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
  const select = el("congregacao");
  if (!select) return;

  const valorAtual = String(select.value || "");
  select.innerHTML = `<option value="">Selecione a congregação</option>`;

  const setorIdAtual = getSetorPedidoAtual();
  if (!setorIdAtual) return;

  const listaCongregacoes = congregacoes
    .filter((c) => String(c.setor_id) === String(setorIdAtual))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  listaCongregacoes.forEach((c) => {
    const option = document.createElement("option");
    option.value = String(c.id);
    option.textContent = c.nome;
    select.appendChild(option);
  });

  if (valorAtual && Array.from(select.options).some((o) => o.value === valorAtual)) {
    select.value = valorAtual;
  }
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

async function carregarRecebimentos() {
  try {
    const recebimentos = await api(
      "recebimentos?select=id,setor_id,valor,data_recebimento,observacao,usuario_id,data_registro&order=data_registro.desc"
    );

    recebimentosCache = (recebimentos || []).map((item) => ({
      ...item,
      usuario_nome:
        String(item.usuario_id || "") === String(sessao?.id || "") && sessao?.nome
          ? sessao.nome
          : `Usuário ${item.usuario_id || "-"}`,
    }));
  } catch (error) {
    console.error(error);
    recebimentosCache = [];
  }
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
  if (!sessao) return;

  const pedido = pedidosCache.find(
    (p) => String(p.itemId) === String(itemId) && String(p.id) === String(pedidoId)
  );

  if (!pedido) {
    alert("Pedido não encontrado.");
    return;
  }

  if (sessao.tipo === "setor") {
    if (!pedidoPertenceAoSetorDaSessao(pedido)) {
      alert("Você só pode remover pedidos do seu próprio setor.");
      return;
    }

    if (!podeEditarPedidosNaSessao()) {
      alert("O período de pedidos foi encerrado. Não é possível remover pedidos agora.");
      return;
    }
  }

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
  if (sessao?.tipo !== "admin") return;

  if (!podeEditarPedidosNaSessao()) {
    alert("Não é possível editar pedidos fora do período configurado.");
    return;
  }

  const pedido = pedidosCache.find((p) => String(p.itemId) === String(itemId));
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

  const novoTamanho = prompt("Tamanho: PP, P, M, G, GG, XG, XXG", pedido.tamanho);
  if (novoTamanho === null) return;

  const tamanhoFinal = String(novoTamanho).trim().toUpperCase();
  if (!tamanhos.includes(tamanhoFinal)) {
    alert("Tamanho inválido.");
    return;
  }

  try {
    await api(`itens_pedido?id=eq.${itemId}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        quantidade: qtd,
        modelo: modeloFinal,
        tamanho: tamanhoFinal,
      },
    });

    await carregarPedidos();
    renderSetor();
    renderAdmin();
  } catch (error) {
    console.error(error);
    alert("Não foi possível editar o pedido.");
  }
}

async function atualizarStatusPedidosFiltrados(novoStatus) {
  if (sessao?.tipo !== "admin") return;

  const filtrados = getPedidosAdminFiltrados();
  if (!filtrados.length) {
    alert("Nenhum pedido encontrado com os filtros atuais.");
    return;
  }

  const ids = [...new Set(filtrados.map((p) => p.itemId).filter(Boolean))];
  if (!ids.length) {
    alert("Nenhum item válido encontrado para atualização.");
    return;
  }

  const confirmacao = confirm(
    `${novoStatus === "enviado" ? "Marcar" : "Voltar"} ${ids.length} item(ns) como ${getStatusEnvioLabel(novoStatus).toLowerCase()}?`
  );
  if (!confirmacao) return;

  try {
    const filtroIds = ids.join(",");
    await api(`itens_pedido?id=in.(${filtroIds})`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: { status_envio: novoStatus },
    });

    await carregarPedidos();
    renderSetor();
    renderAdmin();
    alert(`Status atualizado para ${getStatusEnvioLabel(novoStatus).toLowerCase()} com sucesso.`);
  } catch (error) {
    console.error(error);
    alert("Não foi possível atualizar o status dos pedidos filtrados.");
  }
}

async function registrarRecebimento(event) {
  try {
    if (event) event.preventDefault();

    const selectSetor = el("financeiroSetor");
    const inputValor = el("financeiroValor");
    const inputData = el("financeiroData");
    const inputObs = el("financeiroObservacao");

    if (!selectSetor) {
      alert("Campo de setor não encontrado.");
      return;
    }

    const setorId = String(selectSetor.value || "").trim();
    const valorTexto = String(inputValor?.value || "").trim();
    const dataRecebimento = String(inputData?.value || "").trim();
    const observacao = String(inputObs?.value || "").trim();

    if (!setorId) {
      alert("Selecione o setor.");
      selectSetor.focus();
      return;
    }

    if (!valorTexto) {
      alert("Digite o valor.");
      inputValor?.focus();
      return;
    }

    const valor = Number(valorTexto.replace(/\./g, "").replace(",", "."));

    if (!Number.isFinite(valor) || valor <= 0) {
      alert("Valor inválido.");
      inputValor?.focus();
      return;
    }

    if (!dataRecebimento) {
      alert("Informe a data.");
      inputData?.focus();
      return;
    }

    const payload = {
      setor_id: setorId,
      valor: valor,
      data_recebimento: dataRecebimento,
      observacao: observacao,
      usuario_id: sessao?.id ?? null,
      data_registro: new Date().toISOString(),
    };

    console.log("Payload enviado para recebimentos:", payload);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/recebimentos`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const texto = await response.text();
    console.log("Resposta recebimentos status:", response.status);
    console.log("Resposta recebimentos body:", texto);

    if (!response.ok) {
      alert(`Erro ao registrar: ${texto}`);
      return;
    }

    alert("Recebimento registrado com sucesso.");

    selectSetor.value = "";
    if (inputValor) inputValor.value = "";
    if (inputObs) inputObs.value = "";

    await carregarRecebimentos();
    renderAdmin();
  } catch (erro) {
    console.error("Erro ao registrar recebimento:", erro);
    alert(`Não foi possível registrar o recebimento. ${erro.message || erro}`);
  }
}
function renderSetor() {
  const lista = el("listaSetor");
  if (!lista) return;

  lista.innerHTML = "";

  if (!sessao || (sessao.tipo !== "setor" && sessao.tipo !== "admin")) {
    lista.innerHTML =
      '<div class="pedido-card">Entre com um login de setor para visualizar e cadastrar pedidos.</div>';
    return;
  }

  const setorAtual = getSetorPedidoAtual();

  if (sessao.tipo === "admin" && !setorAtual) {
    lista.innerHTML =
      '<div class="pedido-card">Selecione um setor para visualizar os pedidos e as congregações.</div>';
    return;
  }

  const pedidosSetor = pedidosCache.filter((p) => String(p.setorId) === String(setorAtual));

  if (!pedidosSetor.length) {
    lista.innerHTML =
      '<div class="pedido-card">Ainda não há pedidos cadastrados neste setor.</div>';
    return;
  }

  const setorPodeEditar = sessao.tipo === "admin" || podeEditarPedidosNaSessao();

  pedidosSetor.forEach((pedido) => {
    const botoes = [];

    if (sessao.tipo === "admin") {
      botoes.push(`<button class="secondary" data-edit-item="${pedido.itemId}">Editar</button>`);
    }

    if (setorPodeEditar) {
      botoes.push(
        `<button class="secondary" data-remove-item="${pedido.itemId}" data-remove-pedido="${pedido.id}">Remover</button>`
      );
    }

    const div = document.createElement("div");
    div.className = "pedido-card";
    div.innerHTML = `
      <strong>${getSetorNome(pedido.setorId)} • ${pedido.congregacao}</strong>
      <div>
        <span class="pill">${modelos[pedido.modelo] || pedido.modelo}</span>
        <span class="pill">${pedido.tamanho}</span>
        <span class="pill">Qtd. ${pedido.quantidade}</span>
        <span class="pill">${getStatusEnvioLabel(pedido.statusEnvio)}</span>
      </div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        ${botoes.join("")}
      </div>
    `;
    lista.appendChild(div);
  });

  lista.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await removerPedido(btn.dataset.removeItem, btn.dataset.removePedido);
    });
  });

  lista.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await editarPedidoAdmin(btn.dataset.editItem);
    });
  });
}

function renderAdmin() {
  const resumoContainer = el("resumoCards");
  const tbody = el("tbodyPedidos");
  if (!resumoContainer || !tbody) return;

  resumoContainer.innerHTML = "";
  tbody.innerHTML = "";

  if (!sessao || sessao.tipo !== "admin") {
    renderTotaisGeraisAdmin([]);
    renderRankingSetoresAdmin([]);
    renderCongregacoesSemPedidosAdmin([]);
    renderFinanceiroPorSetorAdmin([]);
    renderResumoFinanceiroSetores();
    renderHistoricoRecebimentos();

    resumoContainer.innerHTML =
      '<div class="pedido-card">Entre como administrador para visualizar a consolidação geral.</div>';
    tbody.innerHTML =
      '<tr><td colspan="8">Somente o administrador pode visualizar esta área.</td></tr>';
    return;
  }

  preencherFiltroSetoresAdmin();
  preencherSetoresFinanceiro();

  const filtrados = getPedidosAdminFiltrados();
  renderTotaisGeraisAdmin(filtrados);
  renderRankingSetoresAdmin(filtrados);
  renderCongregacoesSemPedidosAdmin(filtrados);
  renderFinanceiroPorSetorAdmin(filtrados);
  renderResumoFinanceiroSetores();
  renderHistoricoRecebimentos();

  const indicadores = calcularIndicadoresAdmin(filtrados);
  const resumo = resumoGeral(filtrados);

  if (campanhaAtual?.nome) {
    const blocoCampanha = document.createElement("div");
    blocoCampanha.className = "resumo-bloco";
    blocoCampanha.innerHTML = `
      <h4>Campanha atual</h4>
      <div class="grid-3">
        <div class="summary-stat">
          <span>${campanhaAtual.nome}</span>
          <small>Nome da campanha</small>
        </div>
        <div class="summary-stat">
          <span>${campanhaAtual.ano || "-"}</span>
          <small>Ano</small>
        </div>
        <div class="summary-stat">
          <span>${campanhaAtual.status || "ativa"}</span>
          <small>Status</small>
        </div>
      </div>
    `;
    resumoContainer.appendChild(blocoCampanha);
  }

  const blocoParticipacao = document.createElement("div");
  blocoParticipacao.className = "resumo-bloco";
  blocoParticipacao.innerHTML = "<h4>Painel de participação</h4>";

  const gridParticipacao = document.createElement("div");
  gridParticipacao.className = "grid-3";

  [
    { titulo: "Pedidos", valor: indicadores.totalPedidos },
    { titulo: "Itens lançados", valor: indicadores.totalItens },
    { titulo: "Setores participantes", valor: `${indicadores.setoresParticipantes}/${setores.length}` },
    { titulo: "Congregações participantes", valor: `${indicadores.congregacoesParticipantes}/${congregacoes.length}` },
    { titulo: "Itens pendentes", valor: indicadores.totalPendentes },
    { titulo: "Itens enviados", valor: indicadores.totalEnviados },
  ].forEach((itemInfo) => {
    const item = document.createElement("div");
    item.className = "summary-stat";
    item.innerHTML = `<span>${itemInfo.valor}</span><small>${itemInfo.titulo}</small>`;
    gridParticipacao.appendChild(item);
  });

  blocoParticipacao.appendChild(gridParticipacao);
  resumoContainer.appendChild(blocoParticipacao);

  Object.entries(resumo).forEach(([modelo, tamanhosObj]) => {
    const bloco = document.createElement("div");
    bloco.className = "resumo-bloco";
    bloco.innerHTML = `<h4>${modelos[modelo]}</h4>`;

    const grid = document.createElement("div");
    grid.className = "grid-3";

    Object.entries(tamanhosObj).forEach(([tamanho, qtd]) => {
      const item = document.createElement("div");
      item.className = "summary-stat";
      item.innerHTML = `<span>${qtd}</span><small>${tamanho}</small>`;
      grid.appendChild(item);
    });

    bloco.appendChild(grid);
    resumoContainer.appendChild(bloco);
  });

  const setoresResumo = resumoPorSetor(filtrados);
  const blocoSetores = document.createElement("div");
  blocoSetores.className = "resumo-bloco";
  blocoSetores.innerHTML = "<h4>Total por setor</h4>";

  const gridSetor = document.createElement("div");
  gridSetor.className = "grid-3";

  Object.entries(setoresResumo)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .forEach(([setor, qtd]) => {
      const item = document.createElement("div");
      item.className = "summary-stat";
      item.innerHTML = `<span>${qtd}</span><small>${setor}</small>`;
      gridSetor.appendChild(item);
    });

  blocoSetores.appendChild(gridSetor);
  resumoContainer.appendChild(blocoSetores);

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="8">Nenhum pedido encontrado.</td></tr>';
    return;
  }

  filtrados.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${getSetorNome(p.setorId)}</td>
      <td>${p.congregacao}</td>
      <td>${modelos[p.modelo] || p.modelo}</td>
      <td>${p.tamanho}</td>
      <td>${p.quantidade}</td>
      <td>${getStatusEnvioLabel(p.statusEnvio)}</td>
      <td><button class="secondary" data-edit-admin-item="${p.itemId}">Editar</button></td>
      <td><button class="secondary" data-remove-admin-item="${p.itemId}" data-remove-admin-pedido="${p.id}">Remover</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-remove-admin-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await removerPedido(btn.dataset.removeAdminItem, btn.dataset.removeAdminPedido);
    });
  });

  tbody.querySelectorAll("[data-edit-admin-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await editarPedidoAdmin(btn.dataset.editAdminItem);
    });
  });
}

function montarResumoProducaoPorModelo(listaPedidos, modelo) {
  const linhas = [["Tamanho", "Quantidade"]];
  const totais = Object.fromEntries(tamanhos.map((t) => [t, 0]));

  listaPedidos.forEach((pedido) => {
    if (pedido.modelo === modelo && totais[pedido.tamanho] !== undefined) {
      totais[pedido.tamanho] += Number(pedido.quantidade || 0);
    }
  });

  tamanhos.forEach((tamanho) => {
    linhas.push([tamanho, totais[tamanho]]);
  });

  linhas.push(["TOTAL", tamanhos.reduce((acc, t) => acc + totais[t], 0)]);
  return linhas;
}

function montarResumoGeralProducao(listaPedidos) {
  const linhas = [["Modelo", "Tamanho", "Quantidade"]];
  const resumo = resumoGeral(listaPedidos);

  ["masculino", "babylook"].forEach((modelo) => {
    tamanhos.forEach((tamanho) => {
      linhas.push([modelos[modelo], tamanho, resumo[modelo][tamanho] || 0]);
    });
  });

  linhas.push([]);
  const totais = calcularTotaisGeraisAdmin(listaPedidos);
  linhas.push(["Resumo", "Quantidade"]);
  linhas.push(["Total geral", totais.totalGeral]);
  linhas.push(["Masculino", totais.totalMasculino]);
  linhas.push(["Baby Look Feminina", totais.totalBabylook]);

  return linhas;
}

function montarResumoPorSetorProducao(listaPedidos) {
  const linhas = [["Setor", "Total"]];
  rankingSetores(listaPedidos).forEach(({ setor, total }) => {
    linhas.push([setor, total]);
  });
  return linhas;
}

function montarResumoFinanceiroPorSetor(listaPedidos) {
  const linhas = [["Setor", "Quantidade", "Valor estimado"]];
  const financeiro = calcularFinanceiroPorSetor(listaPedidos);

  financeiro.forEach((item) => {
    linhas.push([item.setor, item.quantidade, item.valor]);
  });

  const geral = calcularFinanceiroGeral(listaPedidos);
  linhas.push([]);
  linhas.push(["TOTAL", geral.quantidade, geral.valor]);

  return linhas;
}

function montarCongregacoesSemPedidosExportacao(listaPedidos) {
  const linhas = [["Setor", "Congregação"]];
  const lista = listarCongregacoesSemPedidos(listaPedidos);

  lista.forEach((item) => {
    linhas.push([item.setorNome, item.nome]);
  });

  return linhas;
}

function montarRecebimentosExportacao(listaRecebimentos) {
  const linhas = [["Data", "Setor", "Valor", "Observação", "Usuário", "Registrado em"]];

  listaRecebimentos.forEach((item) => {
    linhas.push([
      item.data_recebimento || "",
      getSetorNome(item.setor_id),
      Number(item.valor || 0),
      item.observacao || "",
      item.usuario_nome || item.usuario_id || "",
      formatarDataHoraBR(item.data_registro),
    ]);
  });

  return linhas;
}

function montarResumoRecebidoPorSetorExportacao(listaRecebimentos) {
  const linhas = [["Setor", "Valor recebido", "Registros"]];
  const resumo = calcularRecebidoPorSetor(listaRecebimentos);

  resumo.forEach((item) => {
    linhas.push([item.setor, item.valor, item.registros]);
  });

  return linhas;
}

function montarPedidosDetalhadosProducao(listaPedidos) {
  const linhas = [["Setor", "Congregação", "Modelo", "Tamanho", "Quantidade", "Status"]];

  listaPedidos
    .slice()
    .sort((a, b) => {
      const setorA = getSetorNome(a.setorId);
      const setorB = getSetorNome(b.setorId);
      const cmpSetor = setorA.localeCompare(setorB, "pt-BR");
      if (cmpSetor !== 0) return cmpSetor;

      const cmpCong = String(a.congregacao || "").localeCompare(String(b.congregacao || ""), "pt-BR");
      if (cmpCong !== 0) return cmpCong;

      const cmpModelo = (modelos[a.modelo] || a.modelo).localeCompare(
        modelos[b.modelo] || b.modelo,
        "pt-BR"
      );
      if (cmpModelo !== 0) return cmpModelo;

      const idxA = tamanhos.indexOf(a.tamanho);
      const idxB = tamanhos.indexOf(b.tamanho);
      if (idxA !== idxB) return idxA - idxB;

      return Number(a.quantidade || 0) - Number(b.quantidade || 0);
    })
    .forEach((p) => {
      linhas.push([
        getSetorNome(p.setorId),
        p.congregacao,
        modelos[p.modelo] || p.modelo,
        p.tamanho,
        p.quantidade,
        getStatusEnvioLabel(p.statusEnvio),
      ]);
    });

  return linhas;
}

function gerarNomeArquivoRelatorioFabrica() {
  const data = new Date();
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const dd = String(data.getDate()).padStart(2, "0");
  return `relatorio_fabrica_umadecampi_${yyyy}-${mm}-${dd}.xlsx`;
}

function exportarRelatorioFabrica(listaPedidos) {
  const recebimentosFiltrados = getRecebimentosFiltradosAdmin();

  const abas = [
    { nome: "Producao Geral", linhas: montarResumoGeralProducao(listaPedidos) },
    { nome: "Masculino", linhas: montarResumoProducaoPorModelo(listaPedidos, "masculino") },
    { nome: "Baby Look", linhas: montarResumoProducaoPorModelo(listaPedidos, "babylook") },
    { nome: "Por Setor", linhas: montarResumoPorSetorProducao(listaPedidos) },
    { nome: "Financeiro", linhas: montarResumoFinanceiroPorSetor(listaPedidos) },
    { nome: "Sem Pedidos", linhas: montarCongregacoesSemPedidosExportacao(listaPedidos) },
    { nome: "Recebimentos", linhas: montarRecebimentosExportacao(recebimentosFiltrados) },
    { nome: "Recebido por Setor", linhas: montarResumoRecebidoPorSetorExportacao(recebimentosFiltrados) },
    { nome: "Pedidos Detalhados", linhas: montarPedidosDetalhadosProducao(listaPedidos) },
  ];

  exportarWorkbook(gerarNomeArquivoRelatorioFabrica(), abas);
}

async function fazerLogin(loginInformado, senhaInformada) {
  const loginErro = el("loginErro");
  if (loginErro) loginErro.textContent = "";

  try {
    const usuarios = await api("usuarios?select=id,nome,login,senha,tipo,setor_id");

    const loginDigitado = String(loginInformado || "").trim().toLowerCase();
    const senhaDigitada = String(senhaInformada || "").trim();

    const usuario = (usuarios || []).find((u) => {
      const loginBanco = String(u.login || "").trim().toLowerCase();
      const senhaBanco = String(u.senha || "").trim();

      return loginBanco === loginDigitado && senhaBanco === senhaDigitada;
    });

    if (!usuario) {
      if (loginErro) loginErro.textContent = "Login ou senha inválidos.";
      return;
    }

    const tipoBanco = String(usuario.tipo || "").trim().toLowerCase();

    if (tipoBanco === "admin" || tipoBanco === "administrador") {
      sessao = {
        tipo: "admin",
        nome: usuario.nome || "Administrador",
        id: usuario.id,
      };
    } else if (
      tipoBanco === "setor" ||
      tipoBanco === "lider_setor" ||
      tipoBanco === "líder de setor" ||
      tipoBanco === "lider de setor"
    ) {
      const setor = setores.find((s) => String(s.id) === String(usuario.setor_id));

      if (!usuario.setor_id || !setor) {
        if (loginErro) {
          loginErro.textContent =
            "Este usuário de setor está sem setor vinculado ou com setor inválido.";
        }
        return;
      }

      sessao = {
        tipo: "setor",
        id: usuario.id,
        nome: usuario.nome || "Líder de setor",
        setor_id: String(usuario.setor_id),
        setor_nome: setor?.nome || "Setor",
      };
    } else {
      if (loginErro) loginErro.textContent = "Tipo de usuário inválido.";
      return;
    }

    salvarSessao();
    await carregarPedidos();
    await carregarRecebimentos();
    renderSession();
  } catch (error) {
    console.error(error);
    if (loginErro) loginErro.textContent = "Não foi possível fazer login.";
  }
}

async function adicionarPedido() {
  if (!sessao || (sessao.tipo !== "setor" && sessao.tipo !== "admin")) return;

  if (!podeEditarPedidosNaSessao()) {
    alert("O período de pedidos foi encerrado.");
    return;
  }

  const setorIdAtual = getSetorPedidoAtual();
  const congregacaoId = String(el("congregacao")?.value || "").trim();
  const modelo = el("modelo")?.value;
  const tamanho = el("tamanho")?.value;
  const quantidade = Number(el("quantidade")?.value || 0);

  if (!setorIdAtual) {
    alert("Selecione um setor.");
    return;
  }

  if (!congregacaoId) {
    alert("Selecione uma congregação.");
    return;
  }

  const congregacao = congregacoes.find(
    (c) =>
      String(c.id) === String(congregacaoId) &&
      String(c.setor_id) === String(setorIdAtual)
  );

  if (!congregacao) {
    alert("Escolha uma congregação válida da lista do setor selecionado.");
    return;
  }

  if (!tamanhos.includes(tamanho)) {
    alert("Selecione um tamanho válido.");
    return;
  }

  if (!["masculino", "babylook"].includes(modelo)) {
    alert("Selecione um modelo válido.");
    return;
  }

  if (!Number.isFinite(quantidade) || quantidade < 1) {
    alert("Informe uma quantidade válida.");
    return;
  }

  try {
    const pedidosCriados = await api("pedidos", {
      method: "POST",
      body: {
        campanha_id: campanhaAtual?.id || null,
        setor_id: setorIdAtual,
        congregacao_id: congregacao.id,
        usuario_id: sessao.id,
        data: new Date().toISOString(),
      },
    });

    const pedidoCriado = pedidosCriados?.[0];
    if (!pedidoCriado?.id) throw new Error("Falha ao criar pedido.");

    await api("itens_pedido", {
      method: "POST",
      body: {
        pedido_id: pedidoCriado.id,
        modelo,
        tamanho,
        quantidade,
        status_envio: "pendente",
      },
    });

    if (el("congregacao")) el("congregacao").value = "";
    if (el("quantidade")) el("quantidade").value = 1;

    await carregarPedidos();
    preencherCongregacoesSetor();
    renderSetor();
    renderAdmin();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar o pedido.");
  }
}

function renderSession() {
  const app = el("app");
  const loginCard = el("login-card");
  if (!app || !loginCard) return;

  if (!sessao) {
    app.classList.add("hidden");
    loginCard.classList.remove("hidden");

    if (el("welcomeTitle")) el("welcomeTitle").textContent = "Setor";
    if (el("welcomeText")) el("welcomeText").textContent = "Área do sistema.";

    atualizarVisibilidadeAdminPedido();
    atualizarAvisoPeriodoPedidos();
    return;
  }

  loginCard.classList.add("hidden");
  app.classList.remove("hidden");

  if (sessao.tipo === "admin") {
    if (el("welcomeTitle")) el("welcomeTitle").textContent = "Administrador Geral";
    if (el("welcomeText")) {
      el("welcomeText").textContent =
        "Acompanhe todos os pedidos, lance pedidos em exceção, trate os envios, registre recebimentos e exporte relatórios.";
    }
  } else {
    if (el("welcomeTitle")) el("welcomeTitle").textContent = sessao.setor_nome || "Setor";
    if (el("welcomeText")) {
      el("welcomeText").textContent =
        `${sessao.nome} • Lance os pedidos das congregações do seu setor.`;
    }
  }

  atualizarVisibilidadeAdminPedido();
  preencherSetoresAdminPedido();
  preencherSetoresFinanceiro();
  preencherCongregacoesSetor();
  atualizarAvisoPeriodoPedidos();
  renderSetor();
  renderAdmin();
  atualizarPermissoesTabs();
}

async function iniciar() {
  const tamanhoSelect = el("tamanho");
  if (tamanhoSelect && tamanhoSelect.options.length === 0) {
    tamanhos.forEach((t) => {
      const option = document.createElement("option");
      option.value = t;
      option.textContent = t;
      tamanhoSelect.appendChild(option);
    });
  }

  if (el("financeiroData")) {
    el("financeiroData").value = new Date().toISOString().slice(0, 10);
  }

  try {
    await carregarDadosBase();
    await carregarPedidos();
    await carregarRecebimentos();

    if (sessao?.tipo === "setor") {
      const setorExiste = setores.some((s) => String(s.id) === String(sessao.setor_id));
      if (!setorExiste) {
        sessao = null;
        salvarSessao();
      }
    }
  } catch (error) {
    console.error(error);
    if (el("loginErro")) {
      el("loginErro").textContent = "Não foi possível conectar ao banco de dados.";
    }
  }

  el("btnEntrar")?.addEventListener("click", async () => {
    const login = el("login")?.value.trim() || "";
    const senha = el("senha")?.value.trim() || "";

    if (!login || !senha) {
      if (el("loginErro")) el("loginErro").textContent = "Preencha login e senha.";
      return;
    }

    await fazerLogin(login, senha);
  });

  el("senha")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      el("btnEntrar")?.click();
    }
  });

  el("login")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      el("btnEntrar")?.click();
    }
  });

  el("btnSair")?.addEventListener("click", () => {
    sessao = null;
    salvarSessao();
    renderSession();
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (!sessao) return;
      if (tab.dataset.tab === "admin" && sessao?.tipo !== "admin") return;
      ativarTab(tab.dataset.tab);
    });
  });

  el("setorAdminPedido")?.addEventListener("change", () => {
    if (el("congregacao")) el("congregacao").value = "";
    preencherCongregacoesSetor();
    renderSetor();
  });

  el("btnAdicionar")?.addEventListener("click", adicionarPedido);
  el("busca")?.addEventListener("input", renderAdmin);
  el("filtroStatusAdmin")?.addEventListener("change", renderAdmin);
  el("filtroSetoresAdmin")?.addEventListener("change", renderAdmin);
  el("btnTodosSetores")?.addEventListener("click", selecionarTodosSetoresAdmin);
  el("btnLimparSetores")?.addEventListener("click", limparSetoresAdmin);

  el("btnMarcarEnviados")?.addEventListener("click", async () => {
    await atualizarStatusPedidosFiltrados("enviado");
  });

  el("btnVoltarPendentes")?.addEventListener("click", async () => {
    await atualizarStatusPedidosFiltrados("pendente");
  });

  el("btnRegistrarRecebimento")?.addEventListener("click", registrarRecebimento);

  el("btnExportarPedidos")?.addEventListener("click", () => {
    if (sessao?.tipo !== "admin") return;

    const filtrados = getPedidosAdminFiltrados();
    const linhas = [["Setor", "Congregação", "Modelo", "Tamanho", "Quantidade", "Status"]];

    filtrados.forEach((p) => {
      linhas.push([
        getSetorNome(p.setorId),
        p.congregacao,
        modelos[p.modelo] || p.modelo,
        p.tamanho,
        p.quantidade,
        getStatusEnvioLabel(p.statusEnvio),
      ]);
    });

    exportarExcel("pedidos_umadecampi.xlsx", linhas, "Pedidos");
  });

  el("btnExportarResumo")?.addEventListener("click", () => {
    if (sessao?.tipo !== "admin") return;
    exportarRelatorioFabrica(getPedidosAdminFiltrados());
  });

  el("fecharModalCongregacoes")?.addEventListener("click", () => {
    el("modalCongregacoesSemPedidos")?.classList.add("hidden");
  });

  el("modalCongregacoesSemPedidos")?.addEventListener("click", (event) => {
    if (event.target.id === "modalCongregacoesSemPedidos") {
      el("modalCongregacoesSemPedidos")?.classList.add("hidden");
    }
  });

  renderSession();
}

iniciar();
