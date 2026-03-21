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
let usuariosCache = [];

const el = (id) => document.getElementById(id);

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
  const n = Number(String(v ?? "").replace(",", "."));
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
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString("pt-BR");
}

function formatarDataHora(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleString("pt-BR");
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mostrar(id, exibir = true) {
  const node = el(id);
  if (!node) return;

  if (exibir) {
    node.classList.remove("hidden");
    node.style.display = "";
  } else {
    node.classList.add("hidden");
    node.style.display = "none";
  }
}

function preencherTexto(id, valor) {
  const node = el(id);
  if (node) node.textContent = String(valor ?? "");
}

function preencherSelect(selectId, options, getValue, getLabel, placeholder = "Selecione") {
  const select = el(selectId);
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(getValue(item));
    option.textContent = getLabel(item);
    select.appendChild(option);
  });

  if (options.some((o) => String(getValue(o)) === String(valorAtual))) {
    select.value = valorAtual;
  }
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
   CAMPANHA
========================= */

function criarCampanhaFallback() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");

  return {
    id: null,
    nome: "Campanha provisória",
    inicio_pedidos: `${ano}-${mes}-${String(CONFIG.inicioPedidos).padStart(2, "0")}`,
    fim_pedidos: `${ano}-${mes}-${String(CONFIG.fimPedidos).padStart(2, "0")}`,
    ativo: true,
    _fallback: true,
  };
}

function campanhaEstaMarcadaComoAtiva(campanha) {
  if (!campanha) return false;

  if (campanha.ativo === true) return true;
  if (campanha.ativa === true) return true;
  if (numero(campanha.ativo) === 1) return true;
  if (numero(campanha.ativa) === 1) return true;

  const status = normalizarTexto(campanha.status || campanha.situacao || "");
  return ["ativa", "ativo", "aberta", "aberto", "em andamento", "andamento"].includes(status);
}

function campanhaTemPeriodoValido(campanha) {
  if (!campanha) return false;
  if (!campanha.inicio_pedidos || !campanha.fim_pedidos) return true;

  const agora = new Date();
  const inicio = new Date(`${campanha.inicio_pedidos}T00:00:00`);
  const fim = new Date(`${campanha.fim_pedidos}T23:59:59`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return true;

  return agora >= inicio && agora <= fim;
}

function campanhaExiste() {
  return !!campanhaAtual;
}

function campanhaEstaAtiva() {
  if (!campanhaAtual) return false;
  if (campanhaAtual._fallback) return true;
  return campanhaEstaMarcadaComoAtiva(campanhaAtual);
}

function campanhaDisponivelParaSetor() {
  if (!campanhaEstaAtiva()) return false;
  return campanhaTemPeriodoValido(campanhaAtual);
}

function campanhaDisponivelParaAdmin() {
  if (!campanhaAtual) return false;
  if (campanhaAtual._fallback) return true;

  if (!campanhaEstaAtiva()) return false;
  if (CONFIG.adminPodeEditarForaPrazo) return true;

  return campanhaTemPeriodoValido(campanhaAtual);
}

async function carregarCampanhaAtual() {
  const tentativas = [
    "campanhas?select=*&ativo=eq.true&order=id.desc&limit=1",
    "campanhas?select=*&ativa=eq.true&order=id.desc&limit=1",
    "campanhas?select=*&status=eq.Ativa&order=id.desc&limit=1",
    "campanhas?select=*&status=eq.ativa&order=id.desc&limit=1",
    "campanhas?select=*&situacao=eq.Ativa&order=id.desc&limit=1",
    "campanhas?select=*&situacao=eq.ativa&order=id.desc&limit=1",
    "campanhas?select=*&order=id.desc&limit=50",
  ];

  for (const rota of tentativas) {
    try {
      const data = await api(rota);
      if (!Array.isArray(data) || !data.length) continue;

      let campanha = null;

      if (rota.includes("limit=50")) {
        campanha =
          data.find((c) => campanhaEstaMarcadaComoAtiva(c)) ||
          data[0] ||
          null;
      } else {
        campanha = data[0] || null;
      }

      if (campanha) {
        campanhaAtual = {
          ...campanha,
          _fallback: false,
        };
        return;
      }
    } catch (e) {
      console.warn("Falha ao tentar carregar campanha:", rota, e);
    }
  }

  campanhaAtual = criarCampanhaFallback();
}

/* =========================
   CARREGAMENTO
========================= */

async function carregarUsuarios() {
  try {
    usuariosCache = await api("usuarios?select=*&order=nome.asc");
  } catch (e) {
    console.warn("Falha ao carregar usuários:", e);
    usuariosCache = [];
  }
}

async function carregarSetores() {
  const tentativas = [
    "setores?select=*&order=numero.asc.nullslast,nome.asc",
    "setores?select=*&order=nome.asc",
    "setores?select=*",
  ];

  for (const rota of tentativas) {
    try {
      setores = await api(rota);
      return;
    } catch (e) {
      console.warn("Falha ao carregar setores:", rota, e);
    }
  }

  setores = [];
}

async function carregarCongregacoes() {
  const tentativas = [
    "congregacoes?select=*&order=nome.asc",
    "congregacoes?select=*",
  ];

  for (const rota of tentativas) {
    try {
      congregacoes = await api(rota);
      return;
    } catch (e) {
      console.warn("Falha ao carregar congregações:", rota, e);
    }
  }

  congregacoes = [];
}

async function carregarPedidos() {
  const camposPreferidos = [
    "id,setor_id,congregacao_id,modelo,tamanho,quantidade,created_at,campanha_id,usuario_id,data",
    "id,setor_id,congregacao_id,modelo,tamanho,quantidade,created_at,campanha_id,data",
    "id,setor_id,congregacao_id,modelo,tamanho,quantidade,created_at,data",
    "id,setor_id,congregacao_id,modelo,tamanho,quantidade,created_at",
    "id,setor_id,congregacao_id,modelo,tamanho,quantidade,data",
    "*",
  ];

  for (const selectBase of camposPreferidos) {
    try {
      if (
        campanhaAtual?.id &&
        !isUuid(campanhaAtual.id) &&
        !Number.isNaN(Number(campanhaAtual.id))
      ) {
        try {
          pedidosCache = await api(
            `pedidos?select=${selectBase}&campanha_id=eq.${Number(campanhaAtual.id)}&order=id.desc`
          );
          return;
        } catch (e) {
          console.warn("Falha ao carregar pedidos por campanha:", e);
        }
      }

      pedidosCache = await api(`pedidos?select=${selectBase}&order=id.desc`);
      return;
    } catch (e) {
      console.warn("Falha ao carregar pedidos:", selectBase, e);
    }
  }

  pedidosCache = [];
}

async function carregarRecebimentos() {
  const camposPreferidos = [
    "id,setor_id,valor,observacao,created_at,campanha_id,data_pagamento,data_recebimento,data_registro,usuario_id",
    "id,setor_id,valor,observacao,created_at,data_pagamento,data_recebimento,data_registro,usuario_id",
    "id,setor_id,valor,observacao,created_at,data_pagamento,data_recebimento,data_registro",
    "*",
  ];

  for (const selectBase of camposPreferidos) {
    try {
      if (
        campanhaAtual?.id &&
        !isUuid(campanhaAtual.id) &&
        !Number.isNaN(Number(campanhaAtual.id))
      ) {
        try {
          recebimentosCache = await api(
            `recebimentos?select=${selectBase}&campanha_id=eq.${Number(campanhaAtual.id)}&order=id.desc`
          );
          return;
        } catch (e) {
          console.warn("Falha ao carregar recebimentos por campanha:", e);
        }
      }

      recebimentosCache = await api(`recebimentos?select=${selectBase}&order=id.desc`);
      return;
    } catch (e) {
      console.warn("Falha ao carregar recebimentos:", selectBase, e);
    }
  }

  recebimentosCache = [];
}

async function recarregarTudo() {
  await carregarCampanhaAtual();
  await carregarUsuarios();
  await carregarSetores();
  await carregarCongregacoes();
  await carregarPedidos();
  await carregarRecebimentos();
}

/* =========================
   HELPERS
========================= */

function dataPedido(item) {
  return item?.created_at || item?.data || null;
}

function dataRecebimento(item) {
  return item?.data_pagamento || item?.data_recebimento || item?.data_registro || item?.created_at || null;
}

function nomeCongregacaoPorId(id) {
  const item = congregacoes.find((c) => String(c.id) === String(id));
  return item ? item.nome : "-";
}

function nomeSetorPorId(id) {
  const item = setores.find((s) => String(s.id) === String(id));
  return item ? item.nome : "-";
}

function numeroSetorPorId(id) {
  const item = setores.find((s) => String(s.id) === String(id));
  return item ? item.numero : "-";
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

function usuarioSetorPorLoginESenha(login, senha) {
  const loginN = normalizarTexto(login);
  const senhaN = String(senha || "").trim();

  return (
    usuariosCache.find((u) => {
      const tipo = normalizarTexto(u.tipo || "");
      return (
        ["setor", "usuario", "usuário"].includes(tipo) &&
        normalizarTexto(u.login || "") === loginN &&
        String(u.senha || "").trim() === senhaN
      );
    }) || null
  );
}

function usuarioAdminPorLoginESenha(login, senha) {
  const loginN = normalizarTexto(login);
  const senhaN = String(senha || "").trim();

  return (
    usuariosCache.find((u) => {
      const tipo = normalizarTexto(u.tipo || "");
      return (
        tipo === "admin" &&
        normalizarTexto(u.login || "") === loginN &&
        String(u.senha || "").trim() === senhaN
      );
    }) || null
  );
}

/* =========================
   LOGIN
========================= */

function encontrarSetorNoCache(loginDigitado) {
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

async function buscarSetorDireto(loginDigitado) {
  const bruto = String(loginDigitado || "").trim();
  const valor = normalizarTexto(loginDigitado);

  try {
    const lista = await api("setores?select=*");
    setores = Array.isArray(lista) ? lista : [];

    return (
      setores.find((s) => {
        const nome = normalizarTexto(s.nome);
        const codigo = normalizarTexto(s.codigo || "");
        const sigla = normalizarTexto(s.sigla || "");
        const idTexto = String(s.id || "").trim();

        return (
          valor === nome ||
          valor === codigo ||
          valor === sigla ||
          bruto === idTexto
        );
      }) || null
    );
  } catch (e) {
    console.error("Erro ao buscar setor direto:", e);
    throw new Error("Não foi possível consultar os setores no banco.");
  }
}

function setorSenhaValida(setor, senhaDigitada) {
  const senhaBanco = String(setor?.senha || "").trim();
  const senhaInformada = String(senhaDigitada || "").trim();
  return senhaBanco === senhaInformada;
}

async function fazerLoginSetor(login, senha) {
  if (!login || !senha) throw new Error("Informe login e senha.");

  const usuario = usuarioSetorPorLoginESenha(login, senha);

  if (usuario && usuario.setor_id) {
    const setorUsuario = getSetorById(usuario.setor_id);

    if (!setorUsuario) {
      throw new Error("Setor do usuário não encontrado.");
    }

    sessao = {
      tipo: "setor",
      usuario_id: usuario.id,
      usuario_nome: usuario.nome || usuario.login || setorUsuario.nome,
      setor_id: setorUsuario.id,
      setor_nome: setorUsuario.nome,
      setor_numero: setorUsuario.numero,
      login_em: new Date().toISOString(),
    };

    salvarSessao();
    return;
  }

  let setor = encontrarSetorNoCache(login);

  if (!setor) {
    setor = await buscarSetorDireto(login);
  }

  if (!setor) {
    throw new Error("Setor inválido.");
  }

  if (!setorSenhaValida(setor, senha)) {
    throw new Error("Senha inválida.");
  }

  sessao = {
    tipo: "setor",
    setor_id: setor.id,
    setor_nome: setor.nome,
    setor_numero: setor.numero,
    login_em: new Date().toISOString(),
  };

  salvarSessao();
}

function fazerLoginAdmin(usuario, senha) {
  const adminBanco = usuarioAdminPorLoginESenha(usuario, senha);

  if (adminBanco) {
    sessao = {
      tipo: "admin",
      usuario_id: adminBanco.id,
      nome: adminBanco.nome || "Administrador",
      login_em: new Date().toISOString(),
    };
    salvarSessao();
    return;
  }

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
  if (sessao?.tipo === "admin") {
    return campanhaDisponivelParaAdmin();
  }

  return campanhaDisponivelParaSetor();
}

/* =========================
   PEDIDOS
========================= */

async function salvarPedido({ setor_id, congregacao_id, modelo, tamanho, quantidade, usuario_id }) {
  if (!campanhaExiste()) {
    throw new Error("Nenhuma campanha encontrada.");
  }

  if (!campanhaEstaAtiva()) {
    throw new Error("A campanha está inativa.");
  }

  if (!setor_id || !congregacao_id || !modelo || !tamanho || !quantidade) {
    throw new Error("Preencha todos os campos do pedido.");
  }

  if (!dentroPrazoPedidos()) {
    throw new Error("Período de pedidos encerrado.");
  }

  const modeloNormalizado = normalizarTexto(modelo);
  const modeloCorrigido =
    modeloNormalizado === "masculino"
      ? "masculino"
      : modeloNormalizado.includes("baby")
      ? "babylook"
      : modelo;

  const payloadBase = {
    setor_id: Number(setor_id),
    congregacao_id: Number(congregacao_id),
    modelo: modeloCorrigido,
    tamanho,
    quantidade: numero(quantidade),
    data: new Date().toISOString(),
  };

  if (usuario_id && !Number.isNaN(Number(usuario_id))) {
    payloadBase.usuario_id = Number(usuario_id);
  }

  if (
    campanhaAtual?.id &&
    !isUuid(campanhaAtual.id) &&
    !Number.isNaN(Number(campanhaAtual.id))
  ) {
    payloadBase.campanha_id = Number(campanhaAtual.id);
  }

  const variantes = [
    ["usuario_id", "data", "campanha_id"],
    ["data", "campanha_id"],
    ["usuario_id", "campanha_id"],
    ["usuario_id", "data"],
    ["campanha_id"],
    ["data"],
    ["usuario_id"],
    [],
  ];

  let ultimoErro = null;

  for (const campos of variantes) {
    const payload = {};
    campos.forEach((campo) => {
      if (payloadBase[campo] !== undefined) payload[campo] = payloadBase[campo];
    });

    payload.setor_id = payloadBase.setor_id;
    payload.congregacao_id = payloadBase.congregacao_id;
    payload.modelo = payloadBase.modelo;
    payload.tamanho = payloadBase.tamanho;
    payload.quantidade = payloadBase.quantidade;

    try {
      await api("pedidos", {
        method: "POST",
        body: payload,
      });
      await carregarPedidos();
      return;
    } catch (e) {
      ultimoErro = e;
    }
  }

  throw ultimoErro || new Error("Não foi possível salvar o pedido.");
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

async function registrarRecebimento({ setor_id, valor, observacao, data_pagamento, usuario_id }) {
  if (!setor_id) throw new Error("Setor não informado.");
  if (!valor) throw new Error("Informe o valor recebido.");

  const congregacao_id = el("recebimentoCongregacao")?.value;

  if (!congregacao_id) {
    throw new Error("Selecione a congregação.");
  }

  const payload = {
    setor_id: setor_id,
    congregacao_id: congregacao_id,
    valor: numero(valor),
    observacao: observacao || null
  };

  if (usuario_id) payload.usuario_id = usuario_id;
  if (campanhaAtual?.id) payload.campanha_id = campanhaAtual.id;

  const tentativas = [
    { ...payload },
    (() => {
      const p = { ...payload };
      delete p.campanha_id;
      return p;
    })(),
    (() => {
      const p = { ...payload };
      delete p.usuario_id;
      return p;
    })(),
    (() => {
      const p = { ...payload };
      delete p.campanha_id;
      delete p.usuario_id;
      return p;
    })(),
  ];

  let ultimoErro = null;

  for (const tentativa of tentativas) {
    try {
      await api("recebimentos", {
        method: "POST",
        body: tentativa,
      });
      await carregarRecebimentos();
      return;
    } catch (e) {
      ultimoErro = e;
    }
  }

  throw ultimoErro || new Error("Não foi possível registrar o recebimento.");
}
/* =========================
   RENDER
========================= */

function renderResumoPublico() {
  preencherTexto("statSetores", setores.length);
  preencherTexto("statIgrejas", congregacoes.length);
  preencherTexto("statPedidos", pedidosCache.length);
  preencherTexto("statTopoCampanha", campanhaEstaAtiva() ? "Ativa" : "Inativa");
  preencherTexto("statTopoPrazo", dentroPrazoPedidos() ? "Aberto" : "Fechado");
  preencherTexto("statTopoValor", moeda(CONFIG.valorUnitarioCamiseta));
  preencherTexto("nomeCampanhaAtual", campanhaAtual?.nome || "Campanha não definida");

  preencherTexto(
    "periodoCampanha",
    campanhaAtual?.inicio_pedidos && campanhaAtual?.fim_pedidos
      ? `${dataBr(campanhaAtual.inicio_pedidos)} até ${dataBr(campanhaAtual.fim_pedidos)}`
      : "Sem período definido"
  );
}

function renderTabelaPedidosSetor() {
  const corpo = el("tbodyPedidosSetor");
  if (!corpo || !sessao?.setor_id) return;

  const lista = pedidosDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="5">Nenhum pedido lançado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((p) => {
      const congregacao = getCongregacaoById(p.congregacao_id);
      return `
        <tr>
          <td>${formatarDataHora(dataPedido(p))}</td>
          <td>${escapeHtml(congregacao?.nome || "-")}</td>
          <td>${escapeHtml(modelos[p.modelo] || p.modelo || "-")}</td>
          <td>${escapeHtml(p.tamanho || "-")}</td>
          <td>${numero(p.quantidade)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderTabelaCongregacoesSetor() {
  const corpo = el("tbodyCongregacoesSetor");
  if (!corpo || !sessao?.setor_id) return;

  const lista = congregacoesDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="2">Nenhuma congregação cadastrada.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista
    .map((c) => {
      const qtd = pedidosDaCongregacao(c.id).reduce((acc, p) => acc + numero(p.quantidade), 0);
      return `
        <tr>
          <td>${escapeHtml(c.nome)}</td>
          <td>${qtd > 0 ? '<span class="pill-success">Com pedido</span>' : '<span class="pill-warning">Sem pedido</span>'}</td>
        </tr>
      `;
    })
    .join("");
}

function renderTabelaRecebimentosAdmin() {
  const corpo = el("tbodyRecebimentosAdmin");
  if (!corpo) return;

  if (!recebimentosCache.length) {
    corpo.innerHTML = `<tr><td colspan="4">Nenhum recebimento encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = recebimentosCache
    .map((r) => {
      const setor = getSetorById(r.setor_id);
      return `
        <tr>
          <td>${formatarDataHora(dataRecebimento(r))}</td>
          <td>${escapeHtml(setor?.nome || "-")}</td>
          <td>${moeda(r.valor)}</td>
          <td>${escapeHtml(r.observacao || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderFaltantesAdmin() {
  const tbody = el("tbodyFaltantesAdmin");
  if (!tbody) return;

  const faltantes = congregacoesQueAindaNaoPediram();

  if (!faltantes.length) {
    tbody.innerHTML = `<tr><td colspan="2">Todas as congregações já fizeram pedido.</td></tr>`;
    return;
  }

  tbody.innerHTML = faltantes
    .sort((a, b) =>
      `${numeroSetorPorId(a.setor_id)} ${a.nome}`.localeCompare(
        `${numeroSetorPorId(b.setor_id)} ${b.nome}`,
        "pt-BR"
      )
    )
    .map((c) => `
      <tr>
        <td>${String(numeroSetorPorId(c.setor_id)).padStart(2, "0")} - ${escapeHtml(nomeSetorPorId(c.setor_id))}</td>
        <td>${escapeHtml(c.nome)}</td>
      </tr>
    `)
    .join("");
}

function renderMapaSetoresCongregacoes() {
  const tbody = el("tbodyMapaSetoresCongregacoes");
  if (!tbody) return;

  if (!congregacoes.length) {
    tbody.innerHTML = `<tr><td colspan="2">Nenhuma congregação cadastrada.</td></tr>`;
    return;
  }

  const lista = [...congregacoes].sort((a, b) =>
    `${numeroSetorPorId(a.setor_id)} ${a.nome}`.localeCompare(
      `${numeroSetorPorId(b.setor_id)} ${b.nome}`,
      "pt-BR"
    )
  );

  tbody.innerHTML = lista
    .map((c) => `
      <tr>
        <td>${String(numeroSetorPorId(c.setor_id)).padStart(2, "0")} - ${escapeHtml(nomeSetorPorId(c.setor_id))}</td>
        <td>${escapeHtml(c.nome)}</td>
      </tr>
    `)
    .join("");
}

function renderPainelSetor() {
  const setorId = sessao.setor_id;
  const setor = getSetorById(setorId);
  const congregacoesSetor = congregacoesDoSetor(setorId);
  const pedidosSetor = pedidosDoSetor(setorId);
  const recebimentosSetor = recebimentosDoSetor(setorId);

  preencherTexto(
    "tituloPainelSetor",
    `Setor ${String(setor?.numero || sessao?.setor_numero || "").padStart(2, "0")} - ${setor?.nome || sessao?.setor_nome || "Setor"}`
  );
  preencherTexto("statSetorCongregacoes", congregacoesSetor.length);
  preencherTexto("statSetorPecas", totalPecasDoSetor(setorId));
  preencherTexto("statSetorTotal", moeda(totalFinanceiroDoSetor(setorId)));
  preencherTexto("statSetorRecebido", moeda(totalRecebidoDoSetor(setorId)));
  preencherTexto("statSetorSaldo", moeda(saldoDoSetor(setorId)));
  preencherTexto("statValorUnitarioSetor", moeda(CONFIG.valorUnitarioCamiseta));
  preencherTexto(
    "mensagemPrazoPedidos",
    campanhaEstaAtiva()
      ? dentroPrazoPedidos()
        ? "Pedidos liberados."
        : "Período de pedidos encerrado."
      : "Campanha inativa."
  );
  preencherTexto(
    "infoSetorDetalhes",
    `Setor: ${setor?.nome || sessao?.setor_nome || "-"} • Congregações: ${congregacoesSetor.length} • Pedidos: ${pedidosSetor.length} • Recebimentos: ${recebimentosSetor.length}`
  );

  preencherSelect(
    "pedidoCongregacao",
    congregacoesSetor,
    (c) => c.id,
    (c) => c.nome,
    "Selecione a congregação"
  );

  renderTabelaPedidosSetor();
  renderTabelaCongregacoesSetor();
}

function renderPainelAdmin() {
  const totalPecas = pedidosCache.reduce((acc, p) => acc + numero(p.quantidade), 0);
  const totalRecebido = recebimentosCache.reduce((acc, r) => acc + numero(r.valor), 0);

  preencherTexto("statAdminSetores", setores.length);
  preencherTexto("statAdminIgrejas", congregacoes.length);
  preencherTexto("statAdminPedidos", pedidosCache.length);
  preencherTexto("statAdminPecas", totalPecas);
  preencherTexto("statAdminTotal", moeda(totalPecas * CONFIG.valorUnitarioCamiseta));
  preencherTexto("statAdminRecebido", moeda(totalRecebido));
  preencherTexto(
    "infoAdminDetalhes",
    `Campanha: ${campanhaAtual?.nome || "Não definida"} • Status: ${campanhaEstaAtiva() ? "Ativa" : "Inativa"} • Setores: ${setores.length} • Congregações: ${congregacoes.length} • Pedidos: ${pedidosCache.length} • Recebido: ${moeda(totalRecebido)}`
  );

  const setoresOrdenados = [...setores].sort(
    (a, b) => numero(a.numero) - numero(b.numero) || String(a.nome).localeCompare(String(b.nome), "pt-BR")
  );

  preencherSelect(
    "pedidoAdminSetor",
    setoresOrdenados,
    (s) => s.id,
    (s) => `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`,
    "Selecione o setor"
  );

  preencherSelect(
    "recebimentoSetor",
    setoresOrdenados,
    (s) => s.id,
    (s) => `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`,
    "Selecione o setor"
  );

  const setorEscolhido = el("pedidoAdminSetor")?.value || "";
  const congregacoesFiltradas = congregacoes
    .filter((c) => !setorEscolhido || String(c.setor_id) === String(setorEscolhido))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  preencherSelect(
    "pedidoAdminCongregacao",
    congregacoesFiltradas,
    (c) => c.id,
    (c) => c.nome,
    "Selecione a congregação"
  );

  renderTabelaRecebimentosAdmin();
  renderFaltantesAdmin();
  renderMapaSetoresCongregacoes();
}

function renderTela() {
  mostrar("telaLogin", !sessao);
  mostrar("painelSetor", sessao?.tipo === "setor");
  mostrar("painelAdmin", sessao?.tipo === "admin");

  renderResumoPublico();

  if (!sessao) return;

  if (sessao.tipo === "setor") {
    renderPainelSetor();
  }

  if (sessao.tipo === "admin") {
    renderPainelAdmin();
  }
}

/* =========================
   MENSAGENS DE ERRO
========================= */

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

  if (texto.includes("JWT")) {
    return "Falha de acesso ao banco. Verifique permissões do Supabase.";
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
      await recarregarTudo();
      await fazerLoginSetor(el("loginSetor")?.value, el("senhaSetor")?.value);
      renderTela();
      alert("Login setor funcionando.");
    } catch (err) {
      console.error("Erro login setor:", err);
      alert(extrairMensagemErro(err));
    }
  });

  el("formLoginAdmin")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await recarregarTudo();
      fazerLoginAdmin(el("loginAdmin")?.value, el("senhaAdmin")?.value);
      renderTela();
      alert("Login admin funcionando.");
    } catch (err) {
      console.error("Erro login admin:", err);
      alert(extrairMensagemErro(err));
    }
  });

  el("btnLogoutSetor")?.addEventListener("click", logout);
  el("btnLogoutAdmin")?.addEventListener("click", logout);

  el("formPedidoSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await salvarPedido({
        setor_id: sessao?.setor_id,
        congregacao_id: el("pedidoCongregacao")?.value,
        modelo: el("pedidoModelo")?.value,
        tamanho: el("pedidoTamanho")?.value,
        quantidade: el("pedidoQuantidade")?.value,
        usuario_id: sessao?.usuario_id,
      });

      if (el("pedidoQuantidade")) el("pedidoQuantidade").value = 1;
      await recarregarTudo();
      renderTela();
      alert("Pedido salvo com sucesso.");
    } catch (err) {
      console.error(err);
      alert(extrairMensagemErro(err));
    }
  });

  el("formPedidoAdmin")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await salvarPedido({
        setor_id: el("pedidoAdminSetor")?.value,
        congregacao_id: el("pedidoAdminCongregacao")?.value,
        modelo: el("pedidoAdminModelo")?.value,
        tamanho: el("pedidoAdminTamanho")?.value,
        quantidade: el("pedidoAdminQuantidade")?.value,
        usuario_id: sessao?.usuario_id,
      });

      if (el("pedidoAdminQuantidade")) el("pedidoAdminQuantidade").value = 1;
      await recarregarTudo();
      renderTela();
      alert("Pedido do admin salvo com sucesso.");
    } catch (err) {
      console.error(err);
      alert(extrairMensagemErro(err));
    }
  });

  el("pedidoAdminSetor")?.addEventListener("change", () => {
    if (sessao?.tipo === "admin") {
      renderPainelAdmin();
    }
  });

  el("formRecebimentoAdmin")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await registrarRecebimento({
        setor_id: el("recebimentoSetor")?.value,
        valor: el("recebimentoValor")?.value,
        observacao: el("recebimentoObs")?.value,
        data_pagamento: new Date().toISOString().slice(0, 10),
        usuario_id: sessao?.usuario_id,
      });

      if (el("recebimentoValor")) el("recebimentoValor").value = "";
      if (el("recebimentoObs")) el("recebimentoObs").value = "";
      await recarregarTudo();
      renderTela();
      alert("Recebimento salvo com sucesso.");
    } catch (err) {
      console.error(err);
      alert(extrairMensagemErro(err));
    }
  });
}

/* =========================
   SESSÃO
========================= */

function validarSessaoAtual() {
  if (!sessao) return;

  if (sessao.tipo === "setor") {
    const existe = setores.some((s) => String(s.id) === String(sessao.setor_id));
    if (!existe && setores.length > 0) {
      limparSessao();
    }
  }
}

/* =========================
   INICIALIZAÇÃO
========================= */
function montarResumoIgrejas() {
  return congregacoes.map((c) => {
    const pedidos = pedidosDaCongregacao(c.id);
    const recebimentos = recebimentosCache.filter(r => String(r.congregacao_id) === String(c.id));

    const qtd = pedidos.reduce((acc, p) => acc + numero(p.quantidade), 0);
    const total = qtd * CONFIG.valorUnitarioCamiseta;
    const recebido = recebimentos.reduce((acc, r) => acc + numero(r.valor), 0);

    let status = "nao_pediu";

    if (qtd > 0 && recebido <= 0) status = "pendente";
    else if (qtd > 0 && recebido > 0 && recebido < total) status = "parcial";
    else if (qtd > 0 && recebido >= total) status = "quitado";

    return { qtd, total, recebido, status };
  });
}

function renderResumoIgrejas() {
  const resumo = montarResumoIgrejas();

  const pediram = resumo.filter(r => r.qtd > 0).length;
  const naoPediram = resumo.filter(r => r.qtd === 0).length;
  const quites = resumo.filter(r => r.status === "quitado").length;
  const parcial = resumo.filter(r => r.status === "parcial").length;
  const pendentes = resumo.filter(r => r.status === "pendente").length;

  el("igPediram").textContent = pediram;
  el("igNaoPediram").textContent = naoPediram;
  el("igQuites").textContent = quites;
  el("igParcial").textContent = parcial;
  el("igPendentes").textContent = pendentes;
}

async function iniciarSistema() {
  bindEventos();

  campanhaAtual = criarCampanhaFallback();
  renderTela();

  try {
    await recarregarTudo();
    validarSessaoAtual();
    renderTela();
    console.log("UMADECAMPI carregado com sucesso");
    console.log("Se aparecer mensagem, existe script antigo ainda rodando.");
  } catch (e) {
    console.error("Erro ao iniciar sistema:", e);
    renderTela();
  }
}

document.addEventListener("DOMContentLoaded", iniciarSistema);
