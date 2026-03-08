const STORAGE_KEY = 'umadecampi_pedidos_v1';
const SESSION_KEY = 'umadecampi_sessao_v1';

const tamanhos = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
const modelos = {
  masculino: 'Masculino',
  babylook: 'Baby Look Feminina'
};

const setores = Array.from({ length: 21 }, (_, i) => ({
  id: i + 1,
  nome: `Setor ${i + 1}`,
  lider: `Líder ${i + 1}`,
  login: `setor${String(i + 1).padStart(2, '0')}`,
  senha: `umade${String(i + 1).padStart(2, '0')}`,
}));

const congregacoesExemplo = [
  'Sede Central',
  'Congregação Esperança',
  'Congregação Vida Nova',
  'Congregação Ebenézer',
  'Congregação Monte Sião',
  'Congregação Betel',
  'Congregação Manancial',
  'Congregação Vila Nova'
];

let pedidos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let sessao = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

const el = (id) => document.getElementById(id);

function salvarPedidos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos));
}

function salvarSessao() {
  if (sessao) localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  else localStorage.removeItem(SESSION_KEY);
}

function getSetorNome(id) {
  return setores.find(s => s.id === id)?.nome || `Setor ${id}`;
}

function exportarCSV(nomeArquivo, linhas) {
  const csv = linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function resumoGeral() {
  const mapa = {
    masculino: Object.fromEntries(tamanhos.map(t => [t, 0])),
    babylook: Object.fromEntries(tamanhos.map(t => [t, 0]))
  };
  pedidos.forEach(p => {
    if (mapa[p.modelo] && mapa[p.modelo][p.tamanho] !== undefined) {
      mapa[p.modelo][p.tamanho] += Number(p.quantidade || 0);
    }
  });
  return mapa;
}

function renderSession() {
  const app = el('app');
  const loginCard = el('login-card');

  if (!sessao) {
    app.classList.add('hidden');
    loginCard.classList.remove('hidden');
    return;
  }

  loginCard.classList.add('hidden');
  app.classList.remove('hidden');
  el('welcomeTitle').textContent = sessao.tipo === 'admin' ? 'Administrador geral' : sessao.nome;
  el('welcomeText').textContent = sessao.tipo === 'admin'
    ? 'Acompanhe todos os pedidos e exporte os relatórios para a fábrica.'
    : `${sessao.lider} • Lançe os pedidos das congregações do seu setor.`;

  renderSetor();
  renderAdmin();
  atualizarPermissoesTabs();
}

function atualizarPermissoesTabs() {
  const btnSetor = document.querySelector('[data-tab="setor"]');
  const btnAdmin = document.querySelector('[data-tab="admin"]');

  if (sessao?.tipo === 'admin') {
    ativarTab('admin');
    btnSetor.style.opacity = '0.5';
    btnAdmin.style.opacity = '1';
  } else {
    ativarTab('setor');
    btnSetor.style.opacity = '1';
    btnAdmin.style.opacity = '0.5';
  }
}

function ativarTab(nome) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === nome));
  el('tab-setor').classList.toggle('active', nome === 'setor');
  el('tab-admin').classList.toggle('active', nome === 'admin');
}

function renderSetor() {
  const lista = el('listaSetor');
  lista.innerHTML = '';

  if (!sessao || sessao.tipo !== 'setor') {
    lista.innerHTML = '<div class="pedido-card">Entre com um login de setor para visualizar e cadastrar pedidos.</div>';
    return;
  }

  const pedidosSetor = pedidos.filter(p => p.setorId === sessao.id);
  if (!pedidosSetor.length) {
    lista.innerHTML = '<div class="pedido-card">Ainda não há pedidos cadastrados neste setor.</div>';
    return;
  }

  pedidosSetor.forEach(pedido => {
    const div = document.createElement('div');
    div.className = 'pedido-card';
    div.innerHTML = `
      <strong>${pedido.congregacao}</strong>
      <div>
        <span class="pill">${modelos[pedido.modelo]}</span>
        <span class="pill">${pedido.tamanho}</span>
        <span class="pill">Qtd. ${pedido.quantidade}</span>
      </div>
      <div style="margin-top:12px;">
        <button class="secondary" data-remove="${pedido.id}">Remover</button>
      </div>
    `;
    lista.appendChild(div);
  });

  lista.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.remove);
      pedidos = pedidos.filter(p => p.id !== id || p.setorId !== sessao.id);
      salvarPedidos();
      renderSetor();
      renderAdmin();
    });
  });
}

function renderAdmin() {
  const resumoContainer = el('resumoCards');
  const tbody = el('tbodyPedidos');
  resumoContainer.innerHTML = '';
  tbody.innerHTML = '';

  if (!sessao || sessao.tipo !== 'admin') {
    resumoContainer.innerHTML = '<div class="pedido-card">Entre como administrador para visualizar a consolidação geral.</div>';
    tbody.innerHTML = '<tr><td colspan="6">Somente o administrador pode visualizar esta área.</td></tr>';
    return;
  }

  const resumo = resumoGeral();
  Object.entries(resumo).forEach(([modelo, tamanhosObj]) => {
    const bloco = document.createElement('div');
    bloco.className = 'resumo-bloco';
    bloco.innerHTML = `<h4>${modelos[modelo]}</h4>`;
    const grid = document.createElement('div');
    grid.className = 'grid-3';
    Object.entries(tamanhosObj).forEach(([tamanho, qtd]) => {
      const item = document.createElement('div');
      item.className = 'summary-stat';
      item.innerHTML = `<span>${qtd}</span><small>${tamanho}</small>`;
      grid.appendChild(item);
    });
    bloco.appendChild(grid);
    resumoContainer.appendChild(bloco);
  });

  const busca = el('busca').value.trim().toLowerCase();
  const filtrados = pedidos.filter(p => {
    if (!busca) return true;
    return (
      p.congregacao.toLowerCase().includes(busca) ||
      getSetorNome(p.setorId).toLowerCase().includes(busca) ||
      modelos[p.modelo].toLowerCase().includes(busca) ||
      p.tamanho.toLowerCase().includes(busca)
    );
  });

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum pedido encontrado.</td></tr>';
    return;
  }

  filtrados.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${getSetorNome(p.setorId)}</td>
      <td>${p.congregacao}</td>
      <td>${modelos[p.modelo]}</td>
      <td>${p.tamanho}</td>
      <td>${p.quantidade}</td>
      <td><button class="secondary" data-remove-admin="${p.id}">Remover</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-remove-admin]').forEach(btn => {
    btn.addEventListener('click', () => {
      pedidos = pedidos.filter(p => p.id !== Number(btn.dataset.removeAdmin));
      salvarPedidos();
      renderSetor();
      renderAdmin();
    });
  });
}

function iniciar() {
  tamanhos.forEach(t => {
    const option = document.createElement('option');
    option.value = t;
    option.textContent = t;
    el('tamanho').appendChild(option);
  });

  const lista = el('listaCongregacoes');
  congregacoesExemplo.forEach(c => {
    const option = document.createElement('option');
    option.value = c;
    lista.appendChild(option);
  });

  el('btnEntrar').addEventListener('click', () => {
    const login = el('login').value.trim();
    const senha = el('senha').value.trim();
    const erro = el('loginErro');

    if (login === 'admin' && senha === 'umadecampi2026') {
      sessao = { tipo: 'admin', nome: 'Administrador Geral' };
      erro.textContent = '';
      salvarSessao();
      renderSession();
      return;
    }

    const setor = setores.find(s => s.login === login && s.senha === senha);
    if (!setor) {
      erro.textContent = 'Login ou senha inválidos.';
      return;
    }

    sessao = { ...setor, tipo: 'setor' };
    erro.textContent = '';
    salvarSessao();
    renderSession();
  });

  el('btnSair').addEventListener('click', () => {
    sessao = null;
    salvarSessao();
    renderSession();
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'admin' && sessao?.tipo !== 'admin') return;
      if (tab.dataset.tab === 'setor' && sessao?.tipo !== 'setor') return;
      ativarTab(tab.dataset.tab);
    });
  });

  el('btnAdicionar').addEventListener('click', () => {
    if (!sessao || sessao.tipo !== 'setor') return;
    const congregacao = el('congregacao').value.trim();
    const modelo = el('modelo').value;
    const tamanho = el('tamanho').value;
    const quantidade = Number(el('quantidade').value || 0);

    if (!congregacao || quantidade < 1) return;

    pedidos.unshift({
      id: Date.now(),
      setorId: sessao.id,
      congregacao,
      modelo,
      tamanho,
      quantidade,
      criadoEm: new Date().toISOString()
    });

    salvarPedidos();
    el('congregacao').value = '';
    el('quantidade').value = 1;
    renderSetor();
    renderAdmin();
  });

  el('busca').addEventListener('input', renderAdmin);

  el('btnExportarPedidos').addEventListener('click', () => {
    if (sessao?.tipo !== 'admin') return;
    const linhas = [['Setor', 'Congregação', 'Modelo', 'Tamanho', 'Quantidade']];
    pedidos.forEach(p => linhas.push([getSetorNome(p.setorId), p.congregacao, modelos[p.modelo], p.tamanho, p.quantidade]));
    exportarCSV('pedidos_umadecampi.csv', linhas);
  });

  el('btnExportarResumo').addEventListener('click', () => {
    if (sessao?.tipo !== 'admin') return;
    const resumo = resumoGeral();
    const linhas = [['Modelo', 'Tamanho', 'Quantidade']];
    Object.entries(resumo).forEach(([modelo, tamanhosObj]) => {
      Object.entries(tamanhosObj).forEach(([tamanho, qtd]) => {
        linhas.push([modelos[modelo], tamanho, qtd]);
      });
    });
    exportarCSV('resumo_fabrica_umadecampi.csv', linhas);
  });

  renderSession();
}

iniciar();
