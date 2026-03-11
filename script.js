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

function pedidosBloqueadosParaSetor() {
  const hoje = new Date();
  const dia = hoje.getDate();

  if (dia < CONFIG.inicioPedidos) return true;
  if (dia > CONFIG.fimPedidos) return true;

  return false;
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
      option.textContent = setor.numero
        ? `${setor.numero} - ${setor.nome}`
        : setor.nome;

      select.appendChild(option);
    });

  if (valorAtual && Array.from(select.options).some((o) => o.value === valorAtual)) {
    select.value = valorAtual;
  }

  preencherCongregacoesSetor();
}
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

  if (sessao?.tipo === "admin") wrapper.classList.remove("hidden");
  else wrapper.classList.add("hidden");
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
    .filter((c) => Number(c.setor_id) === Number(setorAtual))
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

function renderSetor() {
  const lista = el("listaSetor");
  if (!lista) return;

  lista.innerHTML = "";

  if (!sessao || (sessao.tipo !== "setor" && sessao.tipo !== "admin")) {
    lista.innerHTML =
      '<div class="pedido-card">Entre com um login de setor para visualizar e cadastrar pedidos.</div>';
    return;
  }

  const pedidosSetor =
    sessao.tipo === "admin"
      ? pedidosCache
      : pedidosCache.filter((p) => Number(p.setorId) === Number(sessao.setor_id));

  if (!pedidosSetor.length) {
    lista.innerHTML =
      '<div class="pedido-card">Ainda não há pedidos cadastrados neste setor.</div>';
    return;
  }

  pedidosSetor.forEach((pedido) => {
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
        ${
          sessao.tipo === "admin"
            ? `<button class="secondary" data-edit-item="${pedido.itemId}">Editar</button>`
            : ""
        }
        <button class="secondary" data-remove-item="${pedido.itemId}" data-remove-pedido="${pedido.id}">Remover</button>
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
    resumoContainer.innerHTML =
      '<div class="pedido-card">Entre como administrador para visualizar a consolidação geral.</div>';
    tbody.innerHTML =
      '<tr><td colspan="8">Somente o administrador pode visualizar esta área.</td></tr>';
    return;
  }

  preencherFiltroSetoresAdmin();

  const filtrados = getPedidosAdminFiltrados();
  renderTotaisGeraisAdmin(filtrados);
  renderRankingSetoresAdmin(filtrados);

  const resumo = resumoGeral(filtrados);

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

function montarPedidosDetalhadosProducao(listaPedidos) {
  const linhas = [["Setor", "Congregação", "Modelo", "Tamanho", "Quantidade", "Status"]];

  listaPedidos
    .slice()
    .sort((a, b) => {
      const setorA = getSetorNome(a.setorId);
      const setorB = getSetorNome(b.setorId);
      const cmpSetor = setorA.localeCompare(setorB, "pt-BR");
      if (cmpSetor !== 0) return cmpSetor;

      const cmpCong = a.congregacao.localeCompare(b.congregacao, "pt-BR");
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
  const abas = [
    { nome: "Producao Geral", linhas: montarResumoGeralProducao(listaPedidos) },
    { nome: "Masculino", linhas: montarResumoProducaoPorModelo(listaPedidos, "masculino") },
    { nome: "Baby Look", linhas: montarResumoProducaoPorModelo(listaPedidos, "babylook") },
    { nome: "Por Setor", linhas: montarResumoPorSetorProducao(listaPedidos) },
    { nome: "Pedidos Detalhados", linhas: montarPedidosDetalhadosProducao(listaPedidos) },
  ];

  exportarWorkbook(gerarNomeArquivoRelatorioFabrica(), abas);
}

async function fazerLogin(loginInformado, senhaInformada) {
  const loginErro = el("loginErro");
  if (loginErro) loginErro.textContent = "";

  try {
    const usuarios = await api("usuarios?select=*");

    const usuario = (usuarios || []).find((u) => {
      const loginBanco = String(u.login || "").trim().toLowerCase();
      const senhaBanco = String(u.senha || "").trim();
      return (
        loginBanco === String(loginInformado).trim().toLowerCase() &&
        senhaBanco === String(senhaInformada).trim()
      );
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
    } else {
      const setor = setores.find((s) => Number(s.id) === Number(usuario.setor_id));
      sessao = {
        tipo: "setor",
        id: usuario.id,
        nome: usuario.nome || "Líder de setor",
        setor_id: usuario.setor_id,
        setor_nome: setor?.nome || "Setor",
      };
    }

    salvarSessao();
    await carregarPedidos();
    renderSession();
  } catch (error) {
    console.error(error);
    if (loginErro) loginErro.textContent = "Não foi possível fazer login.";
  }
}

async function adicionarPedido() {
  if (!sessao || (sessao.tipo !== "setor" && sessao.tipo !== "admin")) return;

  if (sessao.tipo === "setor" && pedidosBloqueadosParaSetor()) {
    alert("O período de pedidos foi encerrado.");
    return;
  }

  const setorIdAtual = getSetorPedidoAtual();
  const nomeCongregacao = el("congregacao")?.value.trim() || "";
  const modelo = el("modelo")?.value;
  const tamanho = el("tamanho")?.value;
  const quantidade = Number(el("quantidade")?.value || 0);

  if (!setorIdAtual) {
    alert("Selecione um setor.");
    return;
  }

  if (!nomeCongregacao) {
    alert("Selecione uma congregação.");
    return;
  }

  const congregacao = congregacoes.find(
    (c) =>
      Number(c.setor_id) === Number(setorIdAtual) &&
      String(c.nome || "").toLowerCase() === nomeCongregacao.toLowerCase()
  );

  if (!congregacao) {
    alert("Escolha uma congregação válida da lista do setor selecionado.");
    return;
  }

  if (!tamanhos.includes(tamanho)) {
    alert("Selecione um tamanho válido.");
    return;
  }

  if (quantidade < 1) {
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
    return;
  }

  loginCard.classList.add("hidden");
  app.classList.remove("hidden");

  if (sessao.tipo === "admin") {
    if (el("welcomeTitle")) el("welcomeTitle").textContent = "Administrador Geral";
    if (el("welcomeText")) {
      el("welcomeText").textContent =
        "Acompanhe todos os pedidos, lance pedidos em exceção, trate os envios e exporte relatórios.";
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
  preencherCongregacoesSetor();
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

  try {
    await carregarDadosBase();
    await carregarPedidos();
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

    const input = el("congregacao");
    if (input) input.focus();
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

    const filtrados = getPedidosAdminFiltrados();
    exportarRelatorioFabrica(filtrados);
  });

  renderSession();
}

iniciar();
