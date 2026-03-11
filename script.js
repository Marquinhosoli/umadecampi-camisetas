const SUPABASE_URL = "https://dqwlhouwoxbwxkcaytja.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b_tuFrU9PhG3VKYLupMVhg_pWPF6Spj";
const SESSION_KEY = "umadecampi_sessao_supabase_v1";

const tamanhos = ["PP","P","M","G","GG","XG","XXG"];

const modelos = {
  masculino:"Masculino",
  babylook:"Baby Look Feminina"
};

const CONFIG={
  inicioPedidos:1,
  fimPedidos:20
};

let sessao=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");
let setores=[];
let congregacoes=[];
let pedidosCache=[];
let campanhaAtual=null;

const el=id=>document.getElementById(id);

async function api(path,options={}){

  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    method:options.method||"GET",
    headers:{
      apikey:SUPABASE_ANON_KEY,
      Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type":"application/json",
      Prefer:options.prefer||"return=representation",
      ...options.headers
    },
    body:options.body?JSON.stringify(options.body):undefined
  });

  if(!response.ok){
    const text=await response.text();
    throw new Error(text||"Erro Supabase");
  }

  if(response.status===204)return null;

  return response.json();
}

function getSetorNome(id){
  return setores.find(s=>s.id===id)?.nome||"Setor";
}

function getCongregacaoNome(id){
  return congregacoes.find(c=>c.id===id)?.nome||"Congregação";
}

function getStatusEnvioLabel(status){
  return status==="enviado"?"Enviado":"Pendente";
}

function salvarSessao(){
  if(sessao)localStorage.setItem(SESSION_KEY,JSON.stringify(sessao));
  else localStorage.removeItem(SESSION_KEY);
}

function pedidosBloqueados(){

  const hoje=new Date();
  const dia=hoje.getDate();

  if(dia<CONFIG.inicioPedidos)return true;
  if(dia>CONFIG.fimPedidos)return true;

  return false;
}

function preencherSetoresAdminPedido(){

  const select=el("setorAdminPedido");
  if(!select)return;

  const valorAtual=select.value;

  select.innerHTML=`<option value="">Selecione o setor</option>`;

  setores
  .slice()
  .sort((a,b)=>{
    const na=Number(a.numero||0);
    const nb=Number(b.numero||0);

    if(na!==nb)return na-nb;

    return String(a.nome||"").localeCompare(String(b.nome||""),"pt-BR");
  })
  .forEach(setor=>{
    const option=document.createElement("option");

    option.value=setor.id;
    option.textContent=setor.numero?`${setor.numero} - ${setor.nome}`:setor.nome;

    select.appendChild(option);
  });

  if(valorAtual)select.value=valorAtual;
}

function preencherCongregacoesSetor(){

  const lista=el("listaCongregacoes");
  if(!lista)return;

  lista.innerHTML="";

  const setorAtual=getSetorPedidoAtual();
  if(!setorAtual)return;

  congregacoes
  .filter(c=>c.setor_id===setorAtual)
  .sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"))
  .forEach(c=>{
    const option=document.createElement("option");
    option.value=c.nome;
    lista.appendChild(option);
  });
}

function getSetorPedidoAtual(){

  if(!sessao)return null;

  if(sessao.tipo==="setor")return sessao.setor_id;

  if(sessao.tipo==="admin"){
    const setorSelecionado=el("setorAdminPedido")?.value||"";
    return setorSelecionado?Number(setorSelecionado):null;
  }

  return null;
}

async function carregarDadosBase(){

  const [setoresData,congregacoesData,campanhasData]=await Promise.all([
    api("setores?select=id,numero,nome&order=numero.asc"),
    api("congregacoes?select=id,setor_id,nome&order=nome.asc"),
    api("campanhas?select=id,nome,ano,status&order=ano.desc&limit=1")
  ]);

  setores=setoresData||[];
  congregacoes=congregacoesData||[];
  campanhaAtual=campanhasData?.[0]||null;

  const stats=document.querySelectorAll(".stat");

  if(stats[0])stats[0].textContent=setores.length;
  if(stats[1])stats[1].textContent=congregacoes.length;
}

async function carregarPedidos(){

  const pedidos=await api("pedidos?select=id,campanha_id,setor_id,congregacao_id,usuario_id,data");
  const itens=await api("itens_pedido?select=id,pedido_id,modelo,tamanho,quantidade,status_envio");

  const itensPorPedido=new Map();

  (itens||[]).forEach(item=>{
    if(!itensPorPedido.has(item.pedido_id))itensPorPedido.set(item.pedido_id,[]);
    itensPorPedido.get(item.pedido_id).push(item);
  });

  pedidosCache=[];

  (pedidos||[]).forEach(pedido=>{

    const lista=itensPorPedido.get(pedido.id)||[];

    lista.forEach(item=>{
      pedidosCache.push({
        id:pedido.id,
        itemId:item.id,
        setorId:pedido.setor_id,
        congregacaoId:pedido.congregacao_id,
        congregacao:getCongregacaoNome(pedido.congregacao_id),
        modelo:item.modelo,
        tamanho:item.tamanho,
        quantidade:Number(item.quantidade||0),
        statusEnvio:item.status_envio||"pendente"
      });
    });
  });
}

function ativarTab(nome){

  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("active",tab.dataset.tab===nome);
  });

  el("tab-setor")?.classList.toggle("active",nome==="setor");
  el("tab-admin")?.classList.toggle("active",nome==="admin");
}

async function adicionarPedido(){

  if(!sessao)return;

  if(pedidosBloqueados()){
    alert("Período de pedidos encerrado");
    return;
  }

  const setorId=getSetorPedidoAtual();
  const congregacaoNome=el("congregacao").value.trim();
  const modelo=el("modelo").value;
  const tamanho=el("tamanho").value;
  const quantidade=Number(el("quantidade").value);

  if(!setorId){
    alert("Selecione o setor");
    return;
  }

  const congregacao=congregacoes.find(c=>
    c.setor_id===setorId &&
    c.nome.toLowerCase()===congregacaoNome.toLowerCase()
  );

  if(!congregacao){
    alert("Escolha uma congregação válida");
    return;
  }

  const pedidosCriados=await api("pedidos",{
    method:"POST",
    body:{
      campanha_id:campanhaAtual?.id||null,
      setor_id:setorId,
      congregacao_id:congregacao.id,
      usuario_id:sessao.id,
      data:new Date().toISOString()
    }
  });

  const pedidoId=pedidosCriados[0].id;

  await api("itens_pedido",{
    method:"POST",
    body:{
      pedido_id:pedidoId,
      modelo,
      tamanho,
      quantidade,
      status_envio:"pendente"
    }
  });

  el("congregacao").value="";
  el("quantidade").value=1;

  await carregarPedidos();
  renderSession();
}

function renderSession(){

  const app=el("app");
  const loginCard=el("login-card");

  if(!sessao){
    app.classList.add("hidden");
    loginCard.classList.remove("hidden");
    return;
  }

  loginCard.classList.add("hidden");
  app.classList.remove("hidden");

  preencherSetoresAdminPedido();
  preencherCongregacoesSetor();
}

async function fazerLogin(loginInformado,senhaInformada){

  const usuarios=await api("usuarios?select=*");

  const usuario=usuarios.find(u=>
    u.login.toLowerCase()===loginInformado.toLowerCase() &&
    u.senha===senhaInformada
  );

  if(!usuario){
    el("loginErro").textContent="Login inválido";
    return;
  }

  if(usuario.tipo==="admin"){

    sessao={
      tipo:"admin",
      id:usuario.id,
      nome:usuario.nome
    };

  }else{

    sessao={
      tipo:"setor",
      id:usuario.id,
      nome:usuario.nome,
      setor_id:usuario.setor_id,
      setor_nome:getSetorNome(usuario.setor_id)
    };
  }

  salvarSessao();

  await carregarPedidos();

  renderSession();
}

async function iniciar(){

  const tamanhoSelect=el("tamanho");

  if(tamanhoSelect && tamanhoSelect.options.length===0){
    tamanhos.forEach(t=>{
      const option=document.createElement("option");
      option.value=t;
      option.textContent=t;
      tamanhoSelect.appendChild(option);
    });
  }

  await carregarDadosBase();
  await carregarPedidos();

  el("btnEntrar")?.addEventListener("click",async()=>{

    const login=el("login").value.trim();
    const senha=el("senha").value.trim();

    await fazerLogin(login,senha);
  });

  el("btnSair")?.addEventListener("click",()=>{
    sessao=null;
    salvarSessao();
    renderSession();
  });

  document.querySelectorAll(".tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      if(tab.dataset.tab==="admin" && sessao?.tipo!=="admin")return;
      ativarTab(tab.dataset.tab);
    });
  });

  el("setorAdminPedido")?.addEventListener("change",()=>{
    el("congregacao").value="";
    preencherCongregacoesSetor();
  });

  el("btnAdicionar")?.addEventListener("click",adicionarPedido);

  renderSession();
}

iniciar();
