const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

const tamanhos = ["PP","P","M","G","GG","XG","XXG"];
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
  
  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
  return d.toLocaleDateString("pt-BR");
}

function formatarDataHora(valor) {
  if (!valor) return "-";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor); 
  
  return d.toLocaleString("pt-BR", {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
  });
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
  node.classList.toggle("hidden", !exibir);
}

function preencherTexto(id, valor) {
  const node = el(id);
  if (node) node.textContent = String(valor ?? "");
}

function preencherSelect(selectId, options, getValue, getLabel, placeholder = "Selecione", manterAtual = true) {
  const select = el(selectId);
  if (!select) return;

  const valorAtual = String(select.value || "");
  select.innerHTML = `<option value="">${placeholder}</option>`;

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(getValue(item));
    option.textContent = getLabel(item);
    select.appendChild(option);
  });

  if (!options.length) {
    select.value = "";
    return;
  }

  const existeAtual = options.some((o) => String(getValue(o)) === valorAtual);

  if (manterAtual && valorAtual && existeAtual) {
    select.value = valorAtual;
  } else {
    select.value = String(getValue(options[0]));
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
  if (campanha.ativo === true || campanha.ativa === true) return true;
  const status = normalizarTexto(campanha.status || campanha.situacao || "");
  return ["ativa","ativo","aberta","aberto","em andamento","andamento"].includes(status);
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
  return campanhaEstaAtiva() && campanhaTemPeriodoValido(campanhaAtual);
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
    "campanhas?select=*&order=id.desc&limit=50",
  ];

  for (const rota of tentativas) {
    try {
      const data = await api(rota);
      if (!Array.isArray(data) || !data.length) continue;

      let campanha = null;
      if (rota.includes("limit=50")) {
        campanha = data.find((c) => campanhaEstaMarcadaComoAtiva(c)) || data[0] || null;
      } else {
        campanha = data[0] || null;
      }

      if (campanha) {
        campanhaAtual = { ...campanha, _fallback: false };
        return;
      }
    } catch (e) {}
  }

  campanhaAtual = criarCampanhaFallback();
}

async function carregarUsuarios() {
  try {
    usuariosCache = await api("usuarios?select=*&order=nome.asc");
  } catch (e) {
    usuariosCache = [];
  }
}

async function carregarSetores() {
  try {
    setores = await api("setores?select=*&order=numero.asc.nullslast,nome.asc");
  } catch (e) {
    try {
      setores = await api("setores?select=*&order=nome.asc");
    } catch (err) {
      setores = [];
    }
  }
}

async function carregarCongregacoes() {
  try {
    congregacoes = await api("congregacoes?select=*&order=nome.asc");
  } catch (e) {
    congregacoes = [];
  }
}

async function carregarPedidos() {
  try {
    pedidosCache = await api("pedidos?select=*&order=data.desc.nullslast,created_at.desc.nullslast,id.desc");
  } catch (e) {
    try {
      pedidosCache = await api("pedidos?select=*&order=id.desc");
    } catch (err) {
      pedidosCache = [];
    }
  }
}

async function carregarRecebimentos() {
  try {
    recebimentosCache = await api("recebimentos?select=*&order=data_recebimento.desc.nullslast,id.desc");
  } catch (e) {
    try {
      recebimentosCache = await api("recebimentos?select=*&order=id.desc");
    } catch (err) {
      recebimentosCache = [];
    }
  }
}

async function recarregarTudo() {
  await carregarCampanhaAtual();
  await carregarUsuarios();
  await carregarSetores();
  await carregarCongregacoes();
  await carregarPedidos();
  await carregarRecebimentos();
}

function getSetorById(setorId) {
  return setores.find((s) => String(s.id) === String(setorId)) || null;
}

function getCongregacaoById(congregacaoId) {
  return congregacoes.find((c) => String(c.id) === String(congregacaoId)) || null;
}

function nomeSetorPorId(id) {
  const setor = getSetorById(id);
  return setor ? setor.nome : "-";
}

function numeroSetorPorId(id) {
  const setor = getSetorById(id);
  return setor ? setor.numero : "-";
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

function pedidosDaCongregacao(congregacaoId) {
  return pedidosCache.filter((p) => String(p.congregacao_id) === String(congregacaoId));
}

function recebimentosDaCongregacao(congregacaoId) {
  return recebimentosCache.filter((r) => String(r.congregacao_id) === String(congregacaoId));
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
  }) || null;
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

  const setor = encontrarSetorNoCache(login);
  if (!setor) throw new Error("Setor inválido.");

  if (String(setor?.senha || "").trim() !== String(senha || "").trim()) {
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

function dentroPrazoPedidos() {
  if (sessao?.tipo === "admin") return campanhaDisponivelParaAdmin();
  return campanhaDisponivelParaSetor();
}

// ---------------------------------------------------------
// REQUISIÇÕES E CADASTROS
// ---------------------------------------------------------

async function salvarPedido({ setor_id, congregacao_id, modelo, tamanho, quantidade, usuario_id }) {
  if (!campanhaExiste()) throw new Error("Nenhuma campanha encontrada.");
  if (!campanhaEstaAtiva()) throw new Error("A campanha está inativa.");
  if (!setor_id || !congregacao_id || !modelo || !tamanho || !quantidade) {
    throw new Error("Preencha todos os campos do pedido.");
  }
  if (!dentroPrazoPedidos()) throw new Error("Período de pedidos encerrado.");

  const modeloNormalizado = normalizarTexto(modelo);
  const modeloCorrigido =
    modeloNormalizado === "masculino"
      ? "masculino"
      : modeloNormalizado.includes("baby")
      ? "babylook"
      : modelo;

  const payload = {
    setor_id: String(setor_id),
    congregacao_id: String(congregacao_id),
    modelo: modeloCorrigido,
    tamanho: String(tamanho),
    quantidade: numero(quantidade),
    data: new Date().toISOString(),
  };

  if (usuario_id) payload.usuario_id = String(usuario_id);
  if (campanhaAtual?.id != null) payload.campanha_id = String(campanhaAtual.id);

  const tentativas = [
    { ...payload },
    (() => { const p = { ...payload }; delete p.campanha_id; return p; })(),
    (() => { const p = { ...payload }; delete p.usuario_id; return p; })(),
    (() => { const p = { ...payload }; delete p.campanha_id; delete p.usuario_id; return p; })(),
  ];

  let ultimoErro = null;

  for (const tentativa of tentativas) {
    try {
      await api("pedidos", { method: "POST", body: tentativa });
      await carregarPedidos();
      return;
    } catch (e) {
      ultimoErro = e;
    }
  }

  throw ultimoErro || new Error("Não foi possível salvar o pedido.");
}

async function registrarRecebimento({ setor_id, congregacao_id, valor, observacao, usuario_id }) {
  if (!setor_id) throw new Error("Setor não informado.");
  if (!congregacao_id) throw new Error("Selecione a congregação.");
  if (!valor) throw new Error("Informe o valor recebido.");

  const payload = {
    setor_id: String(setor_id),
    congregacao_id: String(congregacao_id),
    valor: numero(valor),
    observacao: observacao || null,
    data_recebimento: new Date().toISOString().slice(0, 10),
  };

  if (usuario_id) payload.usuario_id = String(usuario_id);
  if (campanhaAtual?.id != null) payload.campanha_id = String(campanhaAtual.id);

  const tentativas = [
    { ...payload },
    (() => { const p = { ...payload }; delete p.campanha_id; return p; })(),
    (() => { const p = { ...payload }; delete p.usuario_id; return p; })(),
    (() => { const p = { ...payload }; delete p.campanha_id; delete p.usuario_id; return p; })(),
  ];

  let ultimoErro = null;

  for (const tentativa of tentativas) {
    try {
      await api("recebimentos", { method: "POST", body: tentativa });
      await carregarRecebimentos();
      return;
    } catch (e) {
      ultimoErro = e;
    }
  }

  throw ultimoErro || new Error("Não foi possível registrar o recebimento.");
}

async function deletarPedidoBanco(id) {
  if(!confirm("⚠️ Tem certeza que deseja EXCLUIR este pedido permanentemente?")) return;
  try {
    await api(`pedidos?id=eq.${id}`, { method: "DELETE" });
    await carregarPedidos();
    renderTela();
    alert("Pedido excluído com sucesso.");
  } catch(e) {
    alert("Erro ao excluir: " + extrairMensagemErro(e));
  }
}

async function deletarRecebimentoBanco(id) {
  if(!confirm("⚠️ Tem certeza que deseja EXCLUIR este recebimento permanentemente?")) return;
  try {
    await api(`recebimentos?id=eq.${id}`, { method: "DELETE" });
    await carregarRecebimentos();
    renderTela();
    alert("Recebimento excluído com sucesso.");
  } catch(e) {
    alert("Erro ao excluir: " + extrairMensagemErro(e));
  }
}

async function prorrogarPrazoAdmin(diasExtras) {
  if (!campanhaAtual || campanhaAtual._fallback) {
    alert("Nenhuma campanha oficial rodando no banco de dados para prorrogar. Crie uma na tabela 'campanhas'.");
    return;
  }
  
  let dataBase = new Date(campanhaAtual.fim_pedidos + "T23:59:59");
  let hoje = new Date();
  
  if (Number.isNaN(dataBase.getTime()) || dataBase < hoje) {
      dataBase = hoje; 
  }
  
  dataBase.setDate(dataBase.getDate() + Number(diasExtras));
  let novoFimStr = dataBase.toISOString().split('T')[0];
  
  try {
    await api(`campanhas?id=eq.${campanhaAtual.id}`, {
      method: "PATCH",
      body: { fim_pedidos: novoFimStr }
    });
    
    await carregarCampanhaAtual(); 
    renderTela();
    alert(`Sucesso! O prazo foi prorrogado para o dia ${dataBr(novoFimStr)}.`);
  } catch (err) {
    alert("Erro ao prorrogar prazo: " + extrairMensagemErro(err));
  }
}

// ---------------------------------------------------------
// MODAL E EDIÇÃO
// ---------------------------------------------------------

function abrirModalEdicao(tipo, id) {
  const modal = el("modalEdit");
  el("editId").value = id;
  el("editType").value = tipo;

  mostrar("fieldsPedido", tipo === 'pedido');
  mostrar("fieldsRecebimento", tipo === 'recebimento');

  if (tipo === 'pedido') {
    const ped = pedidosCache.find(p => String(p.id) === String(id));
    el("modalEditTitle").textContent = "Editar Pedido";
    el("editQtd").value = ped.quantidade;
    el("editTamanho").value = ped.tamanho;
  } else {
    const rec = recebimentosCache.find(r => String(r.id) === String(id));
    el("modalEditTitle").textContent = "Editar Recebimento";
    el("editValor").value = rec.valor;
    el("editObs").value = rec.observacao || "";
  }
  
  modal.classList.remove("hidden");
}

function fecharModal() {
  el("modalEdit").classList.add("hidden");
}

// ---------------------------------------------------------
// EXPORTAÇÃO E EXCEL
// ---------------------------------------------------------

function exportarParaExcel() {
  if (typeof XLSX === "undefined") {
    alert("A biblioteca do Excel ainda está carregando ou ocorreu um erro de internet. Aguarde alguns segundos e tente novamente.");
    return;
  }

  const wb = XLSX.utils.book_new();

  const prodGeral = [
    { Modelo: "Masculino", PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XXG: 0, TOTAL: 0 },
    { Modelo: "Baby Look", PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XXG: 0, TOTAL: 0 }
  ];

  const mascSetorMap = {};
  const babySetorMap = {};
  const pedDetalhados = [];

  setoresOrdenados().forEach(s => {
    const nomeSetor = `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`;
    mascSetorMap[s.id] = { Setor: nomeSetor, PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XXG: 0, TOTAL: 0 };
    babySetorMap[s.id] = { Setor: nomeSetor, PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0, XXG: 0, TOTAL: 0 };
  });

  pedidosCache.forEach(p => {
    const setor = getSetorById(p.setor_id);
    const nomeSetor = setor ? `${String(setor.numero || "").padStart(2, "0")} - ${setor.nome}` : "-";
    const cong = getCongregacaoById(p.congregacao_id);
    const nomeCong = cong ? cong.nome : "-";
    
    const isMasc = normalizarTexto(p.modelo) === "masculino";
    const tam = (p.tamanho || "").toUpperCase();
    const qtd = numero(p.quantidade);

    pedDetalhados.push({
      ID: p.id,
      Data: formatarDataHora(dataPedido(p)),
      Setor: nomeSetor,
      Congregação: nomeCong,
      Modelo: isMasc ? "Masculino" : "Baby Look Feminina",
      Tamanho: tam,
      Quantidade: qtd
    });

    if (!["PP", "P", "M", "G", "GG", "XG", "XXG"].includes(tam)) return;

    const prodRef = isMasc ? prodGeral[0] : prodGeral[1];
    prodRef[tam] += qtd;
    prodRef.TOTAL += qtd;

    if (p.setor_id) {
      const setorMap = isMasc ? mascSetorMap : babySetorMap;
      if (setorMap[p.setor_id]) {
        setorMap[p.setor_id][tam] += qtd;
        setorMap[p.setor_id].TOTAL += qtd;
      }
    }
  });

  const mascArr = Object.values(mascSetorMap).filter(s => s.TOTAL > 0);
  const babyArr = Object.values(babySetorMap).filter(s => s.TOTAL > 0);

  const totalPorSetor = setoresOrdenados().map(s => {
    const nomeSetor = `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`;
    const totalMasc = mascSetorMap[s.id] ? mascSetorMap[s.id].TOTAL : 0;
    const totalBaby = babySetorMap[s.id] ? babySetorMap[s.id].TOTAL : 0;
    return {
      Setor: nomeSetor,
      "Total Peças": totalMasc + totalBaby
    };
  }).filter(s => s["Total Peças"] > 0);

  const resumoFin = montarResumoIgrejasDetalhado().map(x => ({
    Setor: x.setorNome,
    Congregação: x.congregacaoNome,
    "Total Peças": x.qtd,
    "Valor Total (R$)": x.total,
    "Valor Pago (R$)": x.recebido,
    "Saldo Devedor (R$)": x.saldo,
    "Status Pagamento": x.status
  }));

  const wsGeral = XLSX.utils.json_to_sheet(prodGeral);
  const wsMasc = XLSX.utils.json_to_sheet(mascArr);
  const wsBaby = XLSX.utils.json_to_sheet(babyArr);
  const wsSetor = XLSX.utils.json_to_sheet(totalPorSetor);
  const wsFin = XLSX.utils.json_to_sheet(resumoFin);
  const wsDetalhados = XLSX.utils.json_to_sheet(pedDetalhados);

  XLSX.utils.book_append_sheet(wb, wsGeral, "Produção Geral");
  XLSX.utils.book_append_sheet(wb, wsMasc, "Masculino");
  XLSX.utils.book_append_sheet(wb, wsBaby, "Baby Look");
  XLSX.utils.book_append_sheet(wb, wsSetor, "Por Setor");
  XLSX.utils.book_append_sheet(wb, wsDetalhados, "Pedidos Detalhados");
  XLSX.utils.book_append_sheet(wb, wsFin, "Financeiro");

  const hoje = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Relatorio_Fabrica_UMADECAMPI_${hoje}.xlsx`);
}

// ---------------------------------------------------------
// RENDERIZAÇÃO
// ---------------------------------------------------------

function dataPedido(item) {
  return item?.created_at || item?.data || null;
}

function dataRecebimento(item) {
  return item?.data_recebimento || item?.data_pagamento || item?.created_at || item?.data || "-";
}

function montarResumoIgrejasDetalhado() {
  return congregacoes.map((c) => {
    const setor = getSetorById(c.setor_id);
    const pedidos = pedidosDaCongregacao(c.id);
    const recebimentos = recebimentosDaCongregacao(c.id);

    const qtd = pedidos.reduce((acc, p) => acc + numero(p.quantidade), 0);
    const total = qtd * CONFIG.valorUnitarioCamiseta;
    const recebido = recebimentos.reduce((acc, r) => acc + numero(r.valor), 0);
    const saldo = Math.max(total - recebido, 0);

    let status = "Sem Pedido";
    let statusClass = "pill-info";

    if (qtd > 0) {
      if (recebido <= 0) {
        status = "Pendente";
        statusClass = "pill-danger"; 
      } else if (recebido > 0 && recebido < (total - 0.05)) { 
        status = "Parcial";
        statusClass = "pill-warning"; 
      } else {
        status = "Quitado";
        statusClass = "pill-success"; 
      }
    }

    return {
      setorId: c.setor_id,
      setorNome: `${String(setor?.numero || "").padStart(2, "0")} - ${setor?.nome || "-"}`,
      congregacaoId: c.id,
      congregacaoNome: c.nome || "-",
      qtd,
      total,
      recebido,
      saldo,
      status,
      statusClass,
    };
  });
}

function renderResumoIgrejas() {
  const resumo = montarResumoIgrejasDetalhado();

  preencherTexto("igPediram", resumo.filter(r => r.qtd > 0).length);
  preencherTexto("igNaoPediram", resumo.filter(r => r.qtd === 0).length);
  preencherTexto("igQuites", resumo.filter(r => r.qtd > 0 && r.recebido >= r.total).length);
  preencherTexto("igParcial", resumo.filter(r => r.qtd > 0 && r.recebido > 0 && r.recebido < r.total).length);
  preencherTexto("igPendentes", resumo.filter(r => r.qtd > 0 && r.recebido <= 0).length);
  preencherTexto("igComRecebimento", resumo.filter(r => r.recebido > 0).length);
}

function renderTabelaPedidosSetor() {
  const corpo = el("tbodyPedidosSetor");
  if (!corpo || !sessao?.setor_id) return;

  const lista = pedidosDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="5">Nenhum pedido lançado.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista.map((p) => {
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
  }).join("");
}

function renderTabelaCongregacoesSetor() {
  const corpo = el("tbodyCongregacoesSetor");
  if (!corpo || !sessao?.setor_id) return;

  const lista = congregacoesDoSetor(sessao.setor_id);

  if (!lista.length) {
    corpo.innerHTML = `<tr><td colspan="2">Nenhuma congregação cadastrada.</td></tr>`;
    return;
  }

  corpo.innerHTML = lista.map((c) => {
    const qtd = pedidosDaCongregacao(c.id).reduce((acc, p) => acc + numero(p.quantidade), 0);
    return `
      <tr>
        <td>${escapeHtml(c.nome)}</td>
        <td>${qtd > 0 ? '<span class="pill pill-success">Com pedido</span>' : '<span class="pill pill-warning">Sem pedido</span>'}</td>
      </tr>
    `;
  }).join("");
}

function renderTabelaRecebimentosAdmin() {
  const corpo = el("tbodyRecebimentosAdmin");
  if (!corpo) return;

  if (!recebimentosCache.length) {
    corpo.innerHTML = `<tr><td colspan="6">Nenhum recebimento encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = recebimentosCache.map((r) => {
    const setor = getSetorById(r.setor_id);
    const congregacao = getCongregacaoById(r.congregacao_id);
    return `
      <tr>
        <td>${formatarDataHora(dataRecebimento(r))}</td>
        <td>${escapeHtml(setor?.nome || "-")}</td>
        <td>${escapeHtml(congregacao?.nome || "-")}</td>
        <td>${moeda(r.valor)}</td>
        <td>${escapeHtml(r.observacao || "-")}</td>
        <td class="td-actions">
          <button type="button" class="primary btn-sm" onclick="abrirModalEdicao('recebimento', '${r.id}')">✏️</button>
          <button type="button" class="danger btn-sm" onclick="deletarRecebimentoBanco('${r.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderTabelaPedidosAdmin() {
  const corpo = el("tbodyGerenciarPedidosAdmin");
  if (!corpo) return;

  if (!pedidosCache.length) {
    corpo.innerHTML = `<tr><td colspan="7">Nenhum pedido encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = pedidosCache.map((p) => {
    const setor = getSetorById(p.setor_id);
    const congregacao = getCongregacaoById(p.congregacao_id);
    return `
      <tr>
        <td>${formatarDataHora(dataPedido(p))}</td>
        <td>${escapeHtml(setor?.nome || "-")}</td>
        <td>${escapeHtml(congregacao?.nome || "-")}</td>
        <td>${escapeHtml(modelos[p.modelo] || p.modelo || "-")}</td>
        <td>${escapeHtml(p.tamanho || "-")}</td>
        <td>${numero(p.quantidade)}</td>
        <td class="td-actions">
          <button type="button" class="primary btn-sm" onclick="abrirModalEdicao('pedido', '${p.id}')">✏️</button>
          <button type="button" class="danger btn-sm" onclick="deletarPedidoBanco('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
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

function renderVisualizacaoRapida() {
  const tbody = el("tbodyVisualizacaoAdmin");
  if (!tbody) return;

  let linhas = montarResumoIgrejasDetalhado();
  const tipo = el("tipoVisualizacaoAdmin")?.value || "pediram";
  const filtroSetor = el("filtroSetorVisualizacao")?.value || "";
  const busca = normalizarTexto(el("buscaVisualizacao")?.value || "");

  if (tipo === "pediram") {
    linhas = linhas.filter(x => x.qtd > 0);
  } else if (tipo === "pagaram") {
    linhas = linhas.filter(x => x.recebido > 0);
  } else if (tipo === "pendentes") {
    linhas = linhas.filter(x => x.qtd > 0 && x.saldo > 0);
  } else if (tipo === "semPedido") {
    linhas = linhas.filter(x => x.qtd === 0);
  }

  if (filtroSetor) {
    linhas = linhas.filter(x => String(x.setorId) === String(filtroSetor));
  }

  if (busca) {
    linhas = linhas.filter(x =>
      normalizarTexto(x.setorNome).includes(busca) ||
      normalizarTexto(x.congregacaoNome).includes(busca)
    );
  }

  if (!linhas.length) {
    tbody.innerHTML = `<tr><td colspan="7">Nenhum resultado encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = linhas
    .sort((a, b) => `${a.setorNome} ${a.congregacaoNome}`.localeCompare(`${b.setorNome} ${b.congregacaoNome}`, "pt-BR"))
    .map((x) => `
      <tr>
        <td>${escapeHtml(x.setorNome)}</td>
        <td>${escapeHtml(x.congregacaoNome)}</td>
        <td>${x.qtd}</td>
        <td>${moeda(x.total)}</td>
        <td>${moeda(x.recebido)}</td>
        <td>${moeda(x.saldo)}</td>
        <td><span class="pill ${x.statusClass}">${escapeHtml(x.status)}</span></td>
      </tr>
    `)
    .join("");
}

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

function atualizarBadgeCampanha() {
  const statusCampanha = campanhaEstaAtiva() ? "Campanha: Ativa" : "Campanha: Inativa";
  const statusPrazo = dentroPrazoPedidos() ? "Prazo: Aberto" : "Prazo: Fechado";

  preencherTexto("badgeCampanhaStatus", statusCampanha);
  preencherTexto("badgeCampanhaPrazo", statusPrazo);
  preencherTexto(
    "statusAdminCampanha",
    campanhaEstaAtiva()
      ? (dentroPrazoPedidos() ? "Campanha ativa • Prazo aberto" : "Campanha ativa • Prazo fechado")
      : "Campanha inativa"
  );
  preencherTexto(
    "mensagemPrazoPedidos",
    campanhaEstaAtiva()
      ? (dentroPrazoPedidos() ? "Pedidos liberados." : "Período de pedidos encerrado.")
      : "Campanha inativa."
  );
  
  preencherTexto("msgVencimentoAtual", campanhaAtual?.fim_pedidos ? `Vencimento: ${dataBr(campanhaAtual.fim_pedidos)}` : "Sem data de vencimento");
}

function popularTamanhos() {
  preencherSelect("pedidoTamanho", tamanhos, (x) => x, (x) => x, "Selecione");
  preencherSelect("pedidoAdminTamanho", tamanhos, (x) => x, (x) => x, "Selecione");
  preencherSelect("editTamanho", tamanhos, (x) => x, (x) => x, "Selecione");
}

function setoresOrdenados() {
  return [...setores].sort(
    (a, b) => numero(a.numero) - numero(b.numero) || String(a.nome).localeCompare(String(b.nome), "pt-BR")
  );
}

function atualizarCongregacoesPedidoAdmin() {
  const setorId = el("pedidoAdminSetor")?.value || "";
  const lista = congregacoes
    .filter((c) => String(c.setor_id) === String(setorId))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  preencherSelect(
    "pedidoAdminCongregacao",
    lista,
    (c) => c.id,
    (c) => c.nome,
    lista.length ? "Selecione a congregação" : "Nenhuma congregação encontrada",
    false
  );
}

function atualizarCongregacoesRecebimentoAdmin() {
  const setorId = el("recebimentoSetor")?.value || "";
  const lista = congregacoes
    .filter((c) => String(c.setor_id) === String(setorId))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  preencherSelect(
    "recebimentoCongregacao",
    lista,
    (c) => c.id,
    (c) => c.nome,
    lista.length ? "Selecione a congregação" : "Nenhuma congregação encontrada",
    false
  );
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
    "infoSetorDetalhes",
    `Setor: ${setor?.nome || sessao?.setor_nome || "-"} • Congregações: ${congregacoesSetor.length} • Pedidos: ${pedidosSetor.length} • Recebimentos: ${recebimentosSetor.length}`
  );

  preencherSelect(
    "pedidoCongregacao",
    congregacoesSetor.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")),
    (c) => c.id,
    (c) => c.nome,
    "Selecione a congregação",
    false
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

  const listaSetores = setoresOrdenados();

  preencherSelect(
    "pedidoAdminSetor",
    listaSetores,
    (s) => s.id,
    (s) => `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`,
    "Selecione o setor"
  );

  preencherSelect(
    "recebimentoSetor",
    listaSetores,
    (s) => s.id,
    (s) => `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`,
    "Selecione o setor"
  );

  preencherSelect(
    "filtroSetorVisualizacao",
    listaSetores,
    (s) => s.id,
    (s) => `${String(s.numero || "").padStart(2, "0")} - ${s.nome}`,
    "Todos os setores"
  );

  atualizarCongregacoesPedidoAdmin();
  atualizarCongregacoesRecebimentoAdmin();
  renderResumoIgrejas();
  renderTabelaPedidosAdmin();
  renderTabelaRecebimentosAdmin();
  renderFaltantesAdmin();
  renderVisualizacaoRapida();
}

function renderTela() {
  mostrar("telaLogin", !sessao);
  mostrar("painelSetor", sessao?.tipo === "setor");
  mostrar("painelAdmin", sessao?.tipo === "admin");

  renderResumoPublico();
  atualizarBadgeCampanha();

  if (sessao?.tipo === "setor") renderPainelSetor();
  if (sessao?.tipo === "admin") renderPainelAdmin();
}

function extrairMensagemErro(e) {
  const texto = String(e?.message || "Erro inesperado.");

  if (texto.includes("PGRST204") && texto.includes("campanha_id")) return "A tabela não possui a coluna campanha_id.";
  if (texto.includes("PGRST204") && texto.includes("usuario_id")) return "A tabela não possui a coluna usuario_id.";
  if (texto.includes("PGRST204") && texto.includes("data_recebimento")) return "A tabela não possui a coluna data_recebimento.";
  if (texto.includes("PGRST204") && texto.includes("congregacao_id")) return "A tabela não possui a coluna congregacao_id.";
  if (texto.includes("22P02")) return "Há um campo com tipo diferente no banco. Verifique IDs ou valores numéricos.";
  return texto;
}

function bindEventos() {
  el("formLoginSetor")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await recarregarTudo();
      await fazerLoginSetor(el("loginSetor")?.value, el("senhaSetor")?.value);
      renderTela();
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  el("formLoginAdmin")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await recarregarTudo();
      fazerLoginAdmin(el("loginAdmin")?.value, el("senhaAdmin")?.value);
      renderTela();
    } catch (err) {
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
      el("pedidoQuantidade").value = 1;
      await recarregarTudo();
      renderTela();
      alert("Pedido salvo com sucesso.");
    } catch (err) {
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
      el("pedidoAdminQuantidade").value = 1;
      await recarregarTudo();
      renderTela();
      alert("Pedido do admin salvo com sucesso.");
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  el("formRecebimentoAdmin")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await registrarRecebimento({
        setor_id: el("recebimentoSetor")?.value,
        congregacao_id: el("recebimentoCongregacao")?.value,
        valor: el("recebimentoValor")?.value,
        observacao: el("recebimentoObs")?.value,
        usuario_id: sessao?.usuario_id,
      });
      el("recebimentoValor").value = "";
      el("recebimentoObs").value = "";
      await recarregarTudo();
      renderTela();
      alert("Recebimento salvo com sucesso.");
    } catch (err) {
      alert(extrairMensagemErro(err));
    }
  });

  // Evento do FORMULARIO DE EDIÇÃO (Modal)
  el("formEdit")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = el("editId").value;
    const tipo = el("editType").value;

    try {
      if (tipo === 'pedido') {
        await api(`pedidos?id=eq.${id}`, {
          method: "PATCH",
          body: {
            quantidade: numero(el("editQtd").value),
            tamanho: el("editTamanho").value
          }
        });
        await carregarPedidos();
      } else {
        await api(`recebimentos?id=eq.${id}`, {
          method: "PATCH",
          body: {
            valor: numero(el("editValor").value),
            observacao: el("editObs").value
          }
        });
        await carregarRecebimentos();
      }
      fecharModal();
      renderTela();
      alert("Registro atualizado com sucesso!");
    } catch(err) {
      alert(extrairMensagemErro(err));
    }
  });
  
  el("btnProrrogar")?.addEventListener("click", () => {
    const dias = el("diasProrrogacao")?.value;
    if (dias && dias > 0) {
      prorrogarPrazoAdmin(dias);
    }
  });
  
  el("btnExportarExcel")?.addEventListener("click", exportarParaExcel);

  el("pedidoAdminSetor")?.addEventListener("change", atualizarCongregacoesPedidoAdmin);
  el("recebimentoSetor")?.addEventListener("change", atualizarCongregacoesRecebimentoAdmin);
  el("tipoVisualizacaoAdmin")?.addEventListener("change", renderVisualizacaoRapida);
  el("filtroSetorVisualizacao")?.addEventListener("change", renderVisualizacaoRapida);
  el("buscaVisualizacao")?.addEventListener("input", renderVisualizacaoRapida);
}

function validarSessaoAtual() {
  if (!sessao) return;

  if (sessao.tipo === "setor") {
    const existe = setores.some((s) => String(s.id) === String(sessao.setor_id));
    if (!existe && setores.length > 0) limparSessao();
  }
}

async function iniciarSistema() {
  popularTamanhos();
  bindEventos();
  campanhaAtual = criarCampanhaFallback();
  renderTela();

  try {
    await recarregarTudo();
    validarSessaoAtual();
    renderTela();
  } catch (e) {
    console.error("Erro ao iniciar sistema:", e);
    renderTela();
  }
}

document.addEventListener("DOMContentLoaded", iniciarSistema);
