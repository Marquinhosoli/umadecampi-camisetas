const SUPABASE_URL = "https://dqwlhouwoxbwkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

const tamanhos = ["PP", "P", "M", "G", "GG", "XG", "XXG"];
const modelos = {
  masculino: "Masculino",
  babylook: "Baby Look Feminina",
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

function salvarSessao() {
  if (sessao) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function exportarCSV(nomeArquivo, linhas) {
  const csv = linhas
    .map((linha) =>
      linha.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function resumoGeral() {
  const mapa = {
    masculino: Object.fromEntries(tamanhos.map((t) => [t, 0])),
    babylook: Object.fromEntries(tamanhos.map((t) => [t, 0])),
  };

  pedidosCache.forEach((p) => {
    if (mapa[p.modelo] && mapa[p.modelo][p.tamanho] !== undefined) {
      mapa[p.modelo][p.tamanho] += Number(p.quantidade || 0);
    }
  });

  return mapa;
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

  const statSpans = document.querySelectorAll(".stat span");
  if (statSpans[0]) statSpans[0].textContent = setores.length || 0;
  if (statSpans[1]) statSpans[1].textContent = congregacoes.length || 0;
}

function preencherCongregacoesSetor() {
  const lista = el("listaCongregacoes");
  if (!lista) return;

  lista.innerHTML = "";

  if (!sessao || sessao.tipo !== "setor") return;

  congregacoes
    .filter((c) => c.setor_id === sessao.setor_id)
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
    "itens_pedido?select=id,pedido_id,modelo,tamanho,quantidade"
  );

  const itensPorPedido = new Map();

  (itens || []).forEach((item) => {
    if (!itensPorPedido.has(item.pedido_id)) {
      itensPorPedido.set(item.pedido_id, []);
    }
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

  if (sessao?.tipo === "admin") {
    ativarTab("admin");
    btnSetor.style.opacity = "0.5";
    btnAdmin.style.opacity = "1";
  } else {
    ativarTab("setor");
    btnSetor.style.opacity = "1";
    btnAdmin.style.opacity = "0.5";
  }
}

function renderSetor() {
  const lista = el("listaSetor");
  if (!lista) return;

  lista.innerHTML = "";

  if (!sessao || sessao.tipo !== "setor") {
    lista.innerHTML =
      '<div class="pedido-card">Entre com um login de setor para visualizar e cadastrar pedidos.</div>';
    return;
  }

  const pedidosSetor = pedidosCache.filter((p) => p.setorId === sessao.setor_id);

  if (!pedidosSetor.length) {
    lista.innerHTML =
      '<div class="pedido-card">Ainda não há pedidos cadastrados neste setor.</div>';
    return;
  }

  pedidosSetor.forEach((pedido) => {
    const div = document.createElement("div");
    div.className = "pedido-card";
    div.innerHTML = `
      <strong>${pedido.congregacao}</strong>
      <div>
        <span class="pill">${modelos[pedido.modelo] || pedido.modelo}</span>
        <span class="pill">${pedido.tamanho}</span>
        <span class="pill">Qtd. ${pedido.quantidade}</span>
      </div>
      <div style="margin-top:12px;">
        <button class="secondary" data-remove-item="${pedido.itemId}" data-remove-pedido="${pedido.id}">Remover</button>
      </div>
    `;
    lista.appendChild(div);
  });

  lista.querySelectorAll("[data-remove-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`itens_pedido?id=eq.${btn.dataset.removeItem}`, {
          method: "DELETE",
          prefer: "return=minimal",
        });

        const restantes = await api(
          `itens_pedido?select=id&pedido_id=eq.${btn.dataset.removePedido}`
        );

        if (!restantes || restantes.length === 0) {
          await api(`pedidos?id=eq.${btn.dataset.removePedido}`, {
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
    resumoContainer.innerHTML =
      '<div class="pedido-card">Entre como administrador para visualizar a consolidação geral.</div>';
    tbody.innerHTML =
      '<tr><td colspan="6">Somente o administrador pode visualizar esta área.</td></tr>';
    return;
  }

  const resumo = resumoGeral();

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

  const busca = (el("busca")?.value || "").trim().toLowerCase();

  const filtrados = pedidosCache.filter((p) => {
    if (!busca) return true;

    return (
      p.congregacao.toLowerCase().includes(busca) ||
      getSetorNome(p.setorId).toLowerCase().includes(busca) ||
      (modelos[p.modelo] || p.modelo).toLowerCase().includes(busca) ||
      p.tamanho.toLowerCase().includes(busca)
    );
  });

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum pedido encontrado.</td></tr>';
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
      <td><button class="secondary" data-remove-admin-item="${p.itemId}" data-remove-admin-pedido="${p.id}">Remover</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-remove-admin-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api(`itens_pedido?id=eq.${btn.dataset.removeAdminItem}`, {
          method: "DELETE",
          prefer: "return=minimal",
        });

        const restantes = await api(
          `itens_pedido?select=id&pedido_id=eq.${btn.dataset.removeAdminPedido}`
        );

        if (!restantes || restantes.length === 0) {
          await api(`pedidos?id=eq.${btn.dataset.removeAdminPedido}`, {
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
    });
  });
}

function detectarCampoLogin(usuario) {
  if ("login" in usuario) return usuario.login;
  if ("conecte_se" in usuario) return usuario.conecte_se;
  if ("conectese" in usuario) return usuario.conectese;
  if ("Conecte-se" in usuario) return usuario["Conecte-se"];
  if ("conecte-se" in usuario) return usuario["conecte-se"];
  return "";
}

async function fazerLogin(loginInformado, senhaInformada) {
  const loginErro = el("loginErro");
  if (loginErro) loginErro.textContent = "";

  try {
    const usuarios = await api("usuarios?select=*");

    const usuario = (usuarios || []).find((u) => {
      const loginBanco = detectarCampoLogin(u);

      return (
        String(loginBanco).trim().toLowerCase() ===
          String(loginInformado).trim().toLowerCase() &&
        String(u.senha || "").trim() === String(senhaInformada).trim()
      );
    });

    if (!usuario) {
      if (loginErro) loginErro.textContent = "Login ou senha inválidos.";
      return;
    }

    const tipoBanco = String(usuario.tipo || "").toLowerCase();

    if (tipoBanco === "admin" || tipoBanco === "administrador") {
      sessao = {
        tipo: "admin",
        nome: usuario.nome,
        id: usuario.id,
      };
    } else {
      const setor = setores.find((s) => s.id === usuario.setor_id);

      sessao = {
        tipo: "setor",
        id: usuario.id,
        nome: usuario.nome,
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
  if (!sessao || sessao.tipo !== "setor") return;

  const nomeCongregacao = el("congregacao")?.value.trim() || "";
  const modelo = el("modelo")?.value;
  const tamanho = el("tamanho")?.value;
  const quantidade = Number(el("quantidade")?.value || 0);

  if (!nomeCongregacao) {
    alert("Selecione uma congregação.");
    return;
  }

  const congregacao = congregacoes.find(
    (c) =>
      c.setor_id === sessao.setor_id &&
      c.nome.toLowerCase() === nomeCongregacao.toLowerCase()
  );

  if (!congregacao) {
    alert("Escolha uma congregação válida da lista do seu setor.");
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
        setor_id: sessao.setor_id,
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
    return;
  }

  loginCard.classList.add("hidden");
  app.classList.remove("hidden");

  if (sessao.tipo === "admin") {
    el("welcomeTitle").textContent = "Administrador Geral";
    el("welcomeText").textContent =
      "Acompanhe todos os pedidos e exporte os relatórios para a fábrica.";
  } else {
    el("welcomeTitle").textContent = sessao.setor_nome || "Setor";
    el("welcomeText").textContent = `${sessao.nome} • Lance os pedidos das congregações do seu setor.`;
  }

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
      if (tab.dataset.tab === "admin" && sessao?.tipo !== "admin") return;
      if (tab.dataset.tab === "setor" && sessao?.tipo !== "setor") return;
      ativarTab(tab.dataset.tab);
    });
  });

  el("btnAdicionar")?.addEventListener("click", adicionarPedido);
  el("busca")?.addEventListener("input", renderAdmin);

  el("btnExportarPedidos")?.addEventListener("click", () => {
    if (sessao?.tipo !== "admin") return;

    const linhas = [["Setor", "Congregação", "Modelo", "Tamanho", "Quantidade"]];

    pedidosCache.forEach((p) => {
      linhas.push([
        getSetorNome(p.setorId),
        p.congregacao,
        modelos[p.modelo] || p.modelo,
        p.tamanho,
        p.quantidade,
      ]);
    });

    exportarCSV("pedidos_umadecampi.csv", linhas);
  });

  el("btnExportarResumo")?.addEventListener("click", () => {
    if (sessao?.tipo !== "admin") return;

    const resumo = resumoGeral();
    const linhas = [["Modelo", "Tamanho", "Quantidade"]];

    Object.entries(resumo).forEach(([modelo, tamanhosObj]) => {
      Object.entries(tamanhosObj).forEach(([tamanho, qtd]) => {
        linhas.push([modelos[modelo], tamanho, qtd]);
      });
    });

    exportarCSV("resumo_fabrica_umadecampi.csv", linhas);
  });

  renderSession();
}

iniciar();
