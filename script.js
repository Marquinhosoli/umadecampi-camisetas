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
