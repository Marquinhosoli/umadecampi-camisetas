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
  adminUsuario: "admin",
  adminSenha: "123456",
};

let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
let campanhaAtual = null;
let setores = [];
let congregacoes = [];
let pedidosCache = [];
let recebimentosCache = [];

const el = (id) => document.getElementById(id);
const els = (selector) => Array.from(document.querySelectorAll(selector));

function salvarSessao() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
}

function limparSessao() {
  sessao = null;
  localStorage.removeItem(SESSION_KEY);
}

function normalizarTexto(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isUuid(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor || "").trim()
  );
}

function numero(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function moeda(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBr(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("pt-BR");
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

  if (!response.ok) {
    throw new Error(text || "Erro na comunicação com o Supabase.");
  }

  return text ? JSON.parse(text) : [];
}

/* =========================
   CARREGAMENTO
========================= */

async function carregarCampanhaAtual() {
  try {
    const campanhas = await api(
      `campanhas?select=*&ativo=eq.true&order=id.desc&limit=1`
    );
    if (campanhas.length) {
      campanhaAtual = campanhas[0];
      return;
    }
  } catch (e) {
    console.warn("Tabela campanhas não encontrada ou sem campanha ativa.", e);
  }

  const hoje = new Date();
  campanhaAtual = {
    id: null,
    nome: "Campanha Atual",
    inicio_pedidos: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(CONFIG.inicioPedidos).padStart(2, "0")}`,
    fim_pedidos: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(CONFIG.fimPedidos).padStart(2, "0")}`,
    ativo: true,
  };
}

async function carregarSetores() {
  setores = await api(`setores?select=*&order=nome.asc`);
}

async function carregarCongregacoes() {
  congregacoes = await api(`congregacoes?select=*&order=nome.asc`);
}

async function carregarPedidos() {
  const selectBase =
    "id,setor_id,congregacao_id,modelo,tamanho,quantidade,created_at";

  if (campanhaAtual?.id && !isUuid(campanhaAtual.id) && !Number.isNaN(Number(campanhaAtual.id))) {
    try {
      pedidosCache = await api(
        `pedidos?select=${selectBase},campanha_id&campanha_id=eq.${Number(campanhaAtual.id)}&order=created_at.desc`
      );
      return;
    } catch (e) {
      console.warn("Tabela pedidos sem campanha_id utilizável. Carregando tudo.", e);
    }
  }

  pedidosCache = await api(`pedidos?select=${selectBase}&order=created_at.desc`);
}

async function carregarRecebimentos() {
  try {
    recebimentosCache = await api(`recebimentos?select=*&order=created_at.desc`);
  } catch (e) {
    console.warn("Tabela recebimentos não disponível.", e);
    recebimentosCache = [];
  }
}

async function recarregarTudo() {
  await carregarCampanhaAtual();
  await carregarSetores();
  await carregarCongregacoes();
  await carregarPedidos();
  await carregarRecebimentos();
}

/* =========================
   LOGIN
========================= */

function encontrarSetorPorLogin(loginDigitado) {
  const valor = normalizarTexto(loginDigitado);

  return setores.find((s) => {
    const nome = normalizarTexto(s.nome);
    const codigo = normalizarTexto(s.codigo || "");
    const sigla = normalizarTexto(s.sigla || "");
    const idTexto = String(s.id || "").trim();
    return (
      valor === nome ||
      valor === codigo ||
      valor === sigla ||
      String(loginDigitado || "").trim() === idTexto
    );
  });
}

function setorSenhaValida(setor, senhaDigitada) {
  const senhaBanco = String(setor?.senha || "").trim();
  const senhaInformada = String(senhaDigitada || "").trim();
  return senhaBanco === senhaInformada;
}

async function fazerLoginSetor(login, senha) {
  if (!login || !senha) throw new Error("Informe login e senha.");

  const setor = encontrarSetorPorLogin(login);
  if (!setor) throw new Error("Setor inválido.");
  if (!setorSenhaValida(setor, senha)) throw new Error("Senha inválida.");

  sessao = {
    tipo: "setor",
    setor_id: setor.id,
    setor_nome: setor.nome,
    login_em: new Date().toISOString(),
  };

  salvarSessao();
}

function fazerLoginAdmin(usuario, senha) {
  if (
    String(usuario || "").trim() === CONFIG.adminUsuario &&
    String(senha || "").trim() === CONFIG.adminSenha
  ) {
    sessao = {
      tipo: "admin",
      nome: "Administrador",
      login_em: new Date().toISOString(),
    };
    salvarSessao();
    return;
  }

  throw new Error("Usuário ou senha inválidos.");
}

function logout() {
  limparSessao();
  renderTela();
}

/* =========================
   REGRAS
========================= */

function dentroPrazoPedidos() {
  if (sessao?.tipo === "admin" && CONFIG.adminPodeEditarForaPrazo) return true;
  if (!campanhaAtual?.inicio_pedidos || !campanhaAtual?.fim_pedidos) return true;

  const agora = new Date();
  const inicio = new Date(`${campanhaAtual.inicio_pedidos}T00:00:00`);
  const fim = new Date(`${campanhaAtual.fim_pedidos}T23:59:59`);
  return agora >= inicio && agora <= fim;
}

function getSetorById(setorId) {
  return setores.find((s) => String(s.id) === String(setorId)) || null;
}

function getCongregacaoById(congregacaoId) {
  return congregacoes.find((c) => String(c.id) === String(congregacaoId)) || null;
}

function congregacoesDoSetor(setorId) {
  return congregacoes.filter((c) => String(c.setor_id) === String(setorId));
}

function pedidosDoSetor(setorId) {
  return pedidosCache.filter((p) => String(p.setor_id) === String(setorId));
}

function recebimentosDoSetor(setorId) {
  return recebimentosCache.filter((r) => String(r.setor_id) === String(setorId));
}

function totalPecasDoSetor(setorId) {
  return pedidosDoSetor(setorId).reduce((acc, p) => acc + numero(p.quantidade), 0);
}

function totalFinanceiroDoSetor(setorId) {
  return totalPecasDoSetor(setorId) * CONFIG.valorUnitarioCamiseta;
}

function totalRecebidoDoSetor(setorId) {
  return recebimentosDoSetor(setorId).reduce((acc, r) => acc + numero(r.valor), 0);
}

function saldoDoSetor(setorId) {
  return totalFinanceiroDoSetor(setorId) - totalRecebidoDoSetor(setorId);
}

function pedidosDaCongregacao(congregacaoId) {
  return pedidosCache.filter((p) => String(p.congregacao_id) === String(congregacaoId));
}

function congregacoesQueAindaNaoPediram() {
  return congregacoes.filter((c) => pedidosDaCongregacao(c.id).length === 0);
}

/* =========================
   PEDIDOS
========================= */

async function salvarPedido({ setor_id, congregacao_id, modelo, tamanho, quantidade }) {
  if (!setor_id || !congregacao_id || !modelo || !tamanho || !quantidade) {
    throw new Error("Preencha todos os campos do pedido.");
  }

  if (!dentroPrazoPedidos()) {
    throw new Error("Período de pedidos encerrado.");
  }

  const payload = {
    setor_id: Number(setor_id),
    congregacao_id: Number(congregacao_id),
    modelo,
    tamanho,
    quantidade: numero(quantidade),
  };

  if (campanhaAtual?.id && !isUuid(campanhaAtual.id) && !Number.isNaN(Number(campanhaAtual.id))) {
    payload.campanha_id = Number(campanhaAtual.id);
  }

  await api("pedidos", {
    method: "POST",
    body: payload,
  });

  await carregarPedidos();
}

async function excluirPedido(pedidoId) {
  await api(`pedidos?id=eq.${pedidoId}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });
  await carregarPedidos();
}

/* =========================
   RECEBIMENTOS
========================= */

async function registrarRecebimento({ setor_id, valor, observacao, data_pagamento }) {
  if (!setor_id) throw new Error("Setor não informado.");
  if (!valor) throw new Error("Informe o valor recebido.");

  const payload = {
    setor_id: Number(setor_id),
    valor: numero(valor),
    observacao: observacao || null,
    data_pagamento: data_pagamento || new Date().toISOString().slice(0, 10),
  };

  if (campanhaAtual?.id && !isUuid(campanhaAtual.id) && !Number.isNaN(Number(campanhaAtual.id))) {
    payload.campanha_id = Number(campanhaAtual.id);
  }

  try {
    await api("recebimentos", {
      method: "POST",
      body: payload,
    });
  } catch (e) {
    const msg = String(e.message || "");
    if (msg.includes("Could not find the 'campanha_id' column of 'recebimentos'")) {
      delete payload.campanha_id;
      await api("recebimentos", {
        method: "POST",
        body: payload,
      });
    } else {
      throw e;
    }
  }

  await carregarRecebimentos();
}

/* =========================
   RENDER GERAL
========================= */

function mostrar(id, exibir = true) {
  const node = el(id);
  if (!node) return;
  node.style.display = exibir ? "" : "none";
}

function preencherTexto(id, valor) {
  const node = el(id);
  if (node) node.textContent = valor;
}

function preencherHtml(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function preencherSelect(selectId, options, getValue, getLabel, placeholder = "Selecione") {
  const select = el(selectId);
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = getValue(item);
    option.textContent = getLabel(item);
    select.appendChild(option);
  });

  if (options.some((o) => String(getValue(o)) === String(valorAtual))) {
    select.value = valorAtual;
  }
}

function renderTela() {
  mostrar("telaLogin", !sessao);
  mostrar("painelSetor", sessao?.tipo === "setor");
  mostrar("painelAdmin", sessao?.tipo === "admin");

  preencherTexto("nomeCampanhaAtual", campanhaAtual?.nome || "Campanha Atual");
  preencherTexto("periodoCampanha", campanhaAtual?.inicio_pedidos && campanhaAtual?.fim_pedidos
    ? `${dataBr(campanhaAtual.inicio_pedidos)} até ${dataBr(campanhaAtual.fim_pedidos)}`
    : "Período não definido");

  if (!sessao) {
    renderResumoPublico();
    return;
  }

  if (sessao.tipo === "setor") {
    renderPainelSetor();
  }

  if (sessao.tipo === "admin") {
    renderPainelAdmin();
  }
}

function renderResumoPublico() {
  preencherTexto("statSetores", setores.length);
  preencherTexto("statIgrejas", congregacoes.length);
  preencherTexto("statPedidos", pedidosCache.length);
}

function renderPainelSetor() {
  const setorId = sessao.setor_id;
  const setor = getSetorById(setorId);

  preencherTexto("tituloPainelSetor", setor?.nome || sessao?.setor_nome || "Setor");
  preencherTexto("statSetorCongregacoes", congregacoesDoSetor(setorId).length);
  preencherTexto("statSetorPecas", totalPecasDoSetor(setorId));
  preencherTexto("statSetorTotal", moeda(totalFinanceiroDoSetor(setorId)));
  preencherTexto("statSetorRecebido", moeda(totalRecebidoDoSetor(setorId)));
  preencherTexto("statSetorSaldo", moeda(saldoDoSetor(setorId)));

  preencherSelect(
    "congregacaoPedido",
    congregacoesDoSetor(setorId),
    (c) => c.id,
    (c) => c.nome,
    "Selecione a congregação"
  );

  preencherSelect(
    "modeloPedido",
    Object.entries(modelos).map(([value, label]) => ({ value, label })),
    (m) => m.value,
    (m) => m.label,
    "Selecione o modelo"
  );

  preencherSelect(
    "tamanhoPedido",
    tamanhos.map((t) => ({ value: t, label: t })),
    (t) => t.value,
    (t) => t.label,
    "Selecione o tamanho"
  );

  renderTabelaPedidosSetor();
  renderTabelaCongregacoesSetor();
  renderTabelaRecebimentosSetor();
  atualizarMensagemPrazo();
}

function renderPainelAdmin() {
  preencherTexto("statAdminSetores", setores.length);
  preencherTexto("statAdminIgrejas", congregacoes.length);
  preencherTexto("statAdminPedidos", pedidosCache.length);
  preencherTexto(
    "statAdminPecas",
    pedidosCache.reduce((acc, p) => acc + numero(p.quantidade), 0)
  );
  preencherTexto(
    "statAdminTotal",
    moeda(
      pedidosCache.reduce((acc, p) => acc + numero(p.quantidade), 0) * CONFIG.valorUnitarioCamiseta
    )
  );
  preencherTexto(
    "statAdminRecebido",
    moeda(recebimentosCache.reduce((acc, r) => acc + numero(r.valor), 0))
  );

  preencherSelect(
    "filtroSetorAdmin",
    setores,
    (s) => s.id,
    (s) => s.nome,
    "Todos os setores"
  );

  preencherSelect(
    "recebimentoSetor",
    setores,
    (s) => s.id,
    (s) => s.nome,
    "Selecione o setor"
  );

  renderTabelaResumoSetores();
  renderTabelaPedidosAdmin();
  renderTabelaRecebimentosAdmin();
  renderCongregacoesPendentes();
}

/* =========================
   TABELAS SETOR
========================= */

function renderTabelaPedidosSetor() {
  const corpo = el("tbodyPedidosSetor");
  if (!corpo) return;

  const lista = pedidosDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="7">Nenhum pedido lançado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((p) => {
      const congregacao = getCongregacaoById(p.congregacao_id);
      return `
        <tr>
          <td>${escapeHtml(congregacao?.nome || "-")}</td>
          <td>${escapeHtml(modelos[p.modelo] || p.modelo || "-")}</td>
          <td>${escapeHtml(p.tamanho || "-")}</td>
          <td>${numero(p.quantidade)}</td>
          <td>${moeda(numero(p.quantidade) * CONFIG.valorUnitarioCamiseta)}</td>
          <td>${dataBr(p.created_at)}</td>
          <td>
            <button type="button" class="btn-excluir-pedido" data-id="${p.id}">
              Excluir
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  els(".btn-excluir-pedido").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!confirm("Deseja excluir este pedido?")) return;
      try {
        await excluirPedido(id);
        renderPainelSetor();
        renderPainelAdmin();
      } catch (e) {
        alert(extrairMensagemErro(e));
      }
    };
  });
}

function renderTabelaCongregacoesSetor() {
  const corpo = el("tbodyCongregacoesSetor");
  if (!corpo) return;

  const lista = congregacoesDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="4">Nenhuma congregação cadastrada.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((c) => {
      const qtd = pedidosDaCongregacao(c.id).reduce((acc, p) => acc + numero(p.quantidade), 0);
      const status = qtd > 0 ? "Pedido lançado" : "Pendente";
      return `
        <tr>
          <td>${escapeHtml(c.nome)}</td>
          <td>${qtd}</td>
          <td>${moeda(qtd * CONFIG.valorUnitarioCamiseta)}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");
}

function renderTabelaRecebimentosSetor() {
  const corpo = el("tbodyRecebimentosSetor");
  if (!corpo) return;

  const lista = recebimentosDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="3">Nenhum recebimento lançado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map(
      (r) => `
      <tr>
        <td>${dataBr(r.data_pagamento || r.created_at)}</td>
        <td>${moeda(r.valor)}</td>
        <td>${escapeHtml(r.observacao || "-")}</td>
      </tr>
    `
    )
    .join("");
}

/* =========================
   TABELAS ADMIN
========================= */

function getSetorFiltradoAdmin() {
  const filtro = el("filtroSetorAdmin")?.value || "";
  return filtro ? String(filtro) : "";
}

function renderTabelaResumoSetores() {
  const corpo = el("tbodyResumoSetores");
  if (!corpo) return;

  const filtro = getSetorFiltradoAdmin();
  const lista = filtro
    ? setores.filter((s) => String(s.id) === filtro)
    : setores;

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="7">Nenhum setor encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((s) => {
      const qtdCongregacoes = congregacoesDoSetor(s.id).length;
      const qtdPecas = totalPecasDoSetor(s.id);
      const total = totalFinanceiroDoSetor(s.id);
      const recebido = totalRecebidoDoSetor(s.id);
      const saldo = total - recebido;

      return `
        <tr>
          <td>${escapeHtml(s.nome)}</td>
          <td>${qtdCongregacoes}</td>
          <td>${qtdPecas}</td>
          <td>${moeda(total)}</td>
          <td>${moeda(recebido)}</td>
          <td>${moeda(saldo)}</td>
          <td>${saldo <= 0 ? "Quitado" : "Pendente"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderTabelaPedidosAdmin() {
  const corpo = el("tbodyPedidosAdmin");
  if (!corpo) return;

  const filtro = getSetorFiltradoAdmin();

  let lista = [...pedidosCache];
  if (filtro) {
    lista = lista.filter((p) => String(p.setor_id) === filtro);
  }

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="7">Nenhum pedido encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((p) => {
      const setor = getSetorById(p.setor_id);
      const congregacao = getCongregacaoById(p.congregacao_id);

      return `
        <tr>
          <td>${escapeHtml(setor?.nome || "-")}</td>
          <td>${escapeHtml(congregacao?.nome || "-")}</td>
          <td>${escapeHtml(modelos[p.modelo] || p.modelo || "-")}</td>
          <td>${escapeHtml(p.tamanho || "-")}</td>
          <td>${numero(p.quantidade)}</td>
          <td>${moeda(numero(p.quantidade) * CONFIG.valorUnitarioCamiseta)}</td>
          <td>${dataBr(p.created_at)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderTabelaRecebimentosAdmin() {
  const corpo = el("tbodyRecebimentosAdmin");
  if (!corpo) return;

  const filtro = getSetorFiltradoAdmin();

  let lista = [...recebimentosCache];
  if (filtro) {
    lista = lista.filter((r) => String(r.setor_id) === filtro);
  }

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="4">Nenhum recebimento encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((r) => {
      const setor = getSetorById(r.setor_id);
      return `
        <tr>
          <td>${escapeHtml(setor?.nome || "-")}</td>
          <td>${dataBr(r.data_pagamento || r.created_at)}</td>
          <td>${moeda(r.valor)}</td>
          <td>${escapeHtml(r.observacao || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCongregacoesPendentes() {
  const caixa = el("listaCongregacoesPendentes");
  if (!caixa) return;

  const filtro = getSetorFiltradoAdmin();
  let lista = congregacoesQueAindaNaoPediram();

  if (filtro) {
    lista = lista.filter((c) => String(c.setor_id) === filtro);
  }

  if (!lista.length) {
    caixa.innerHTML = `<div class="empty-state">Todas as congregações já lançaram pedido.</div>`;
    return;
  }

  caixa.innerHTML = lista
    .map((c) => {
      const setor = getSetorById(c.setor_id);
      return `
        <div class="item-pendente">
          <strong>${escapeHtml(c.nome)}</strong>
          <span>${escapeHtml(setor?.nome || "-")}</span>
        </div>
      `;
    })
    .join("");
}

/* =========================
   UTILITÁRIOS DE UI
========================= */

function atualizarMensagemPrazo() {
  preencherTexto(
    "mensagemPrazoPedidos",
    dentroPrazoPedidos()
      ? "Pedidos liberados."
      : "Período de pedidos encerrado."
  );
}

function extrairMensagemErro(e) {
  const texto = String(e?.message || "Erro inesperado.");

  if (texto.includes("PGRST204") && texto.includes("campanha_id")) {
    return "A tabela recebimentos não possui a coluna campanha_id.";
  }

  if (texto.includes("22P02")) {
    return "Um campo numérico está recebendo valor inválido no banco.";
  }

  if (texto.includes("duplicate key")) {
    return "Já existe um registro igual salvo no sistema.";
  }

  return texto;
}

/* =========================
   EVENTOS
========================= */

function bindEventos() {
  el("formLoginSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await fazerLoginSetor(el("loginSetor")?.value, el("senhaSetor")?.value);
      renderTela();
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  el("formLoginAdmin")?.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      fazerLoginAdmin(el("loginAdmin")?.value, el("senhaAdmin")?.value);
      renderTela();
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  el("btnLogoutSetor")?.addEventListener("click", logout);
  el("btnLogoutAdmin")?.addEventListener("click", logout);

  el("formPedido")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const setorId = sessao?.tipo === "setor" ? sessao.setor_id : el("setorPedido")?.value;

      await salvarPedido({
        setor_id: setorId,
        congregacao_id: el("congregacaoPedido")?.value,
        modelo: el("modeloPedido")?.value,
        tamanho: el("tamanhoPedido")?.value,
        quantidade: el("quantidadePedido")?.value,
      });

      e.target.reset();
      renderPainelSetor();
      renderPainelAdmin();
      alert("Pedido lançado com sucesso.");
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  el("formRecebimento")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await registrarRecebimento({
        setor_id: el("recebimentoSetor")?.value,
        valor: el("recebimentoValor")?.value,
        observacao: el("recebimentoObservacao")?.value,
        data_pagamento: el("recebimentoData")?.value,
      });

      e.target.reset();
      renderPainelAdmin();
      if (sessao?.tipo === "setor") renderPainelSetor();
      alert("Recebimento registrado com sucesso.");
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  el("filtroSetorAdmin")?.addEventListener("change", () => {
    renderTabelaResumoSetores();
    renderTabelaPedidosAdmin();
    renderTabelaRecebimentosAdmin();
    renderCongregacoesPendentes();
  });

  el("btnAtualizarDados")?.addEventListener("click", async () => {
    try {
      await recarregarTudo();
      renderTela();
      alert("Dados atualizados.");
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });
}

/* =========================
   VALIDAÇÃO DE SESSÃO
========================= */

function validarSessaoAtual() {
  if (!sessao) return;

  if (sessao.tipo === "setor") {
    const existe = setores.some((s) => String(s.id) === String(sessao.setor_id));
    if (!existe) limparSessao();
  }
}

/* =========================
   INICIALIZAÇÃO
========================= */

async function iniciarSistema() {
  try {
    bindEventos();
    await recarregarTudo();
    validarSessaoAtual();
    renderTela();
  } catch (e) {
    console.error("Erro ao iniciar sistema:", e);
    alert(extrairMensagemErro(e));
  }
}

document.addEventListener("DOMContentLoaded", iniciarSistema);
