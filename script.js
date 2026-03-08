<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pedidos UMADECAMPI</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="container">
    <div class="card hero-card">
      <div class="hero-info">
        <h1>SISTEMA OFICIAL</h1>
        <h2>Pedidos UMADECAMPI</h2>
        <p>Lançamento de pedidos de camisetas por setor e congregação.</p>
      </div>

      <div class="stats">
        <div class="card">
          <span class="stat">21</span>
          <p>Setores</p>
        </div>
        <div class="card">
          <span class="stat">120</span>
          <p>Igrejas</p>
        </div>
      </div>
    </div>

    <div id="login-card" class="card">
      <h3>Acesso ao sistema</h3>
      <p>Entre como administrador ou como líder de setor.</p>

      <div class="grid-2">
        <div>
          <label for="login">Login</label>
          <input id="login" placeholder="admin ou setor01" />
        </div>

        <div>
          <label for="senha">Senha</label>
          <input id="senha" type="password" placeholder="Digite a senha" />
        </div>
      </div>

      <div style="margin-top: 16px;">
        <button id="btnEntrar" class="primary full">Entrar</button>
      </div>

      <p id="loginErro"></p>

      <div class="grid-2" style="margin-top: 20px;">
        <div class="card">
          <h3>Administrador</h3>
          <p>Login: admin</p>
          <p>Senha: umadecampi2026</p>
        </div>

        <div class="card">
          <h3>Exemplo setor</h3>
          <p>Login: setor01</p>
          <p>Senha: umade01</p>
        </div>
      </div>
    </div>

    <div id="app" class="hidden">
      <div class="card hero-card">
        <div class="hero-info">
          <h2 id="welcomeTitle">Setor</h2>
          <p id="welcomeText">Área do sistema.</p>
        </div>

        <div class="hero-actions">
          <button id="btnSair" class="secondary full">Sair</button>
        </div>
      </div>

      <div class="tabs-wrap">
        <button class="tab active" data-tab="setor">Área do setor</button>
        <button class="tab" data-tab="admin">Painel administrativo</button>
      </div>

      <section id="tab-setor" class="tab-content active">
        <div class="grid-2">
          <div class="card">
            <h3>Novo pedido</h3>
            <p class="muted">Cadastre os pedidos da congregação do seu setor.</p>

            <label for="congregacao">Congregação</label>
            <div class="input-with-arrow">
              <input
                id="congregacao"
                list="listaCongregacoes"
                placeholder="Ex.: Congregação Vila Nova"
                autocomplete="off"
              />
              <datalist id="listaCongregacoes"></datalist>
            </div>

            <div class="grid-3 form-grid">
              <div>
                <label for="modelo">Modelo</label>
                <select id="modelo">
                  <option value="masculino">Masculino</option>
                  <option value="babylook">Baby Look Feminina</option>
                </select>
              </div>

              <div>
                <label for="tamanho">Tamanho</label>
                <select id="tamanho"></select>
              </div>

              <div>
                <label for="quantidade">Quantidade</label>
                <input id="quantidade" type="number" min="1" value="1" />
              </div>
            </div>

            <button id="btnAdicionar" class="primary full">Adicionar pedido</button>
          </div>

          <div class="card">
            <h3>Pedidos do setor</h3>
            <p class="muted">Visualize e remova os pedidos do setor logado.</p>
            <div id="listaSetor" class="cards-list"></div>
          </div>
        </div>
      </section>

      <section id="tab-admin" class="tab-content">
        <div class="grid-2 admin-top">
          <div class="card">
            <h3>Resumo geral</h3>
            <p class="muted">Totais por modelo, tamanho e setor.</p>
            <div id="resumoCards" class="cards-list"></div>
          </div>

          <div class="card">
            <h3>Ferramentas</h3>
            <p class="muted">Busque, exporte e gerencie os pedidos.</p>

            <label for="busca">Buscar</label>
            <input id="busca" type="text" placeholder="Setor, congregação, modelo ou tamanho" />

            <div class="action-grid">
              <button id="btnExportarPedidos" class="secondary">Exportar pedidos</button>
              <button id="btnExportarResumo" class="secondary">Exportar resumo</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Pedidos lançados</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Setor</th>
                  <th>Congregação</th>
                  <th>Modelo</th>
                  <th>Tamanho</th>
                  <th>Quantidade</th>
                  <th>Ação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody id="tbodyPedidos"></tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>  
