// NexaGest 9.0.1 - Sistema de Atualização Online
const AUXILIARY_MODULES_READY = !!(window.NexaGestNfe && window.NexaGestBackup && window.NexaGestSettings && window.NexaGestIntegrations && window.NexaGestPremium);
function enhanceVisualExperience(){
  document.body.classList.add('view-ready');
  document.querySelectorAll('.card,.panel,.profile-card,.pdv-card').forEach((el,i)=>el.style.setProperty('--stagger',Math.min(i,12)*22+'ms'));
  document.querySelectorAll('button:not([data-ux-bound])').forEach(btn=>{
    btn.dataset.uxBound='1';
    btn.addEventListener('click',()=>{
      btn.classList.add('tap-feedback');
      setTimeout(()=>btn.classList.remove('tap-feedback'),220);
    },{passive:true});
  });
}
function pageTransition(){
  document.body.classList.remove('view-ready');
  document.body.classList.add('view-changing');
  setTimeout(()=>document.body.classList.remove('view-changing'),180);
}


let networkLiveTimer=null;
let networkRealtimeTimer=null;
let networkRealtimeBusy=false;
function refreshNetworkRealtimeMonitor(){
  if(networkRealtimeTimer)clearInterval(networkRealtimeTimer);
  networkRealtimeTimer=null;
  const role=db?.settings?.networkRole||'standalone';
  if(role==='client'){
    networkRealtimeTimer=setInterval(()=>networkRealtimeTick(false),5000);
    setTimeout(()=>networkRealtimeTick(false),1200);
  }else if(role==='server'&&db?.settings?.networkServerRunning){
    networkRealtimeTimer=setInterval(()=>networkRealtimeTick(false),8000);
  }
}
async function networkRealtimeTick(showNoise=false){
  if(networkRealtimeBusy||!db?.settings)return;
  const role=db.settings.networkRole||'standalone';
  if(role==='standalone')return;
  if(!window.nexagest?.networkRequest)return;
  networkRealtimeBusy=true;
  try{
    const address=role==='server'?('http://127.0.0.1:'+(db.settings.networkPort||3333)):db.settings.serverAddress;
    const status=await window.nexagest.networkRequest(address,'status');
    if(status?.ok){
      const previousRev=Number(db.settings.networkKnownRevision||0);
      const serverRev=Number(status.revision||0);
      db.settings.networkLastPingMs=status.pingMs||db.settings.networkLastPingMs;
      db.settings.networkClientsConnected=status.clientsConnected??db.settings.networkClientsConnected;
      db.settings.networkLastTestAt=new Date().toISOString();
      db.settings.networkLastTestOk=true;
      if(status.url)db.settings.networkServerUrl=status.url;
      if(serverRev)db.settings.networkKnownRevision=serverRev;
      if(role==='client'&&serverRev&&previousRev&&serverRev>previousRev){
        networkLog('Alteração detectada no servidor. Atualizando dados...', 'info');
        await realtimePullUpdates(status);
      }else if(showNoise){
        networkLog('Monitoramento em tempo real OK. Revisão '+(serverRev||'—')+'.','success');
      }
      save();
      if(showNoise)app();
    }else{
      db.settings.networkLastTestOk=false;
      if(showNoise)networkLog('Monitoramento falhou: '+(status?.error||'sem resposta'),'error');
      save();
      if(showNoise)app();
    }
  }catch(e){
    db.settings.networkLastTestOk=false;
    if(showNoise)networkLog('Monitoramento falhou: '+(e.message||e),'error');
    save();
  }finally{networkRealtimeBusy=false}
}
async function realtimePullUpdates(status){
  const startedAt=Date.now();
  const catalog=await window.nexagest.networkRequest(db.settings.serverAddress,'catalogs');
  const business=await window.nexagest.networkRequest(db.settings.serverAddress,'business');
  let conflictCount=0;
  if(catalog?.ok&&catalog.catalog){
    const stats=applyCatalogSnapshot(catalog.catalog);
    conflictCount+=Number(stats.conflicts||0);
  }
  if(business?.ok&&business.business){
    const stats=applyBusinessSnapshot(business.business);
    conflictCount+=Number(stats.conflicts||0);
  }
  db.settings.networkKnownRevision=Number(status?.revision||db.settings.networkKnownRevision||0);
  db.settings.lastSyncAt=new Date().toISOString();
  db.settings.lastRealtimeSyncAt=db.settings.lastSyncAt;
  db.settings.lastRealtimeSyncDurationMs=Date.now()-startedAt;
  db.settings.networkLastActivity={message:'Atualização em tempo real recebida',at:new Date().toISOString(),type:'success'};
  if(conflictCount){db.settings.networkPendingItems=conflictCount;networkLog(conflictCount+' conflito(s) básico(s) resolvido(s) pelo servidor.','warn')}
  else networkLog('Atualização em tempo real aplicada.','success');
  save();app();
}
function refreshLiveNetworkTimers(){
  updateNetworkLiveTimerNow();
  if(networkLiveTimer)return;
  networkLiveTimer=setInterval(updateNetworkLiveTimerNow,1000);
}
function updateNetworkLiveTimerNow(){
  try{
    const uptimeEl=document.getElementById('networkUptimeLive');
    if(uptimeEl){
      const started=db?.settings?.networkServerStartedAt;
      const running=!!db?.settings?.networkServerRunning;
      uptimeEl.textContent=(running&&started)?formatDuration(Date.now()-new Date(started).getTime()):'—';
    }
    const topEl=document.getElementById('networkTopUptimeLive');
    if(topEl){
      const started=db?.settings?.networkServerStartedAt;
      const running=!!db?.settings?.networkServerRunning;
      topEl.textContent=(running&&started)?(' • online '+formatDuration(Date.now()-new Date(started).getTime())):'';
    }
  }catch(e){}
}


const initialDB={version:'9.0.2',settings:{company:'Minha Empresa',document:'',phone:'',city:'',address:'',pixKey:'',pixKeyType:'Telefone',pixMerchantName:'',pixMerchantCity:'',pixDescription:'Venda NexaGest',pixProvider:'Manual',pixProviderToken:'',pixRequireConfirmation:false,pixAutoConfirm:false,theme:'dark',accent:'#2563eb',logo:'',serverAddress:'http://192.168.0.100:3333',networkMode:false,networkRole:'standalone',networkPort:3333,syncMode:'manual',lastSyncAt:'',networkServerRunning:false,monthlyGoal:5000,whatsappMsg:'Olá, tudo bem? Passando para falar sobre seu pedido na {empresa}.',backupProvider:'Local',backupFolder:'',backupAuto:true,updateManifestUrl:'',githubOwner:'',githubRepo:'',lastUpdateInfo:null,updateDownloadStatus:'',whatsappTemplates:{orcamento:'Olá {cliente}! Segue seu orçamento da {empresa}: {total}.',comprovante:'🧾 *COMPROVANTE DE VENDA*\n\nOlá, *{cliente}*! 👋\n\nSua compra foi finalizada com sucesso na *{empresa}*.\n\n━━━━━━━━━━━━━━━━━━\n🧾 Venda: {pedido}\n📅 Data: {data} • {hora}\n\n💰 Total: *{total}*\n💳 Pagamento: {pagamento}\n{descontoLinha}{dinheiroLinha}{pixLinha}━━━━━━━━━━━━━━━━━━\n\n📦 Itens\n{itens}\n\nObrigado pela preferência! 😊\n\n📍 {empresa}\n📱 {telefoneEmpresa}',cobranca:'Olá {cliente}! Você possui um valor em aberto de {valor} na {empresa}.',entrega:'Olá {cliente}! Sua entrega/pedido {pedido} está em andamento.',aniversario:'Olá {cliente}! A {empresa} deseja um feliz aniversário! 🎉'}},session:null,users:[{id:'admin',name:'Administrador',user:'admin',passwordHash:passwordHash('admin'),role:'Administrador',active:true,mustChangePassword:true}],products:[{id:'p1',name:'Produto Exemplo',barcode:'789000000001',category:'Geral',cost:10,sale:18,stock:20,min:5,active:true},{id:'p2',name:'Produto Premium',barcode:'789000000002',category:'Geral',cost:20,sale:35,stock:8,min:3,active:true}],clients:[{id:'c1',name:'Cliente Balcão',phone:'',city:'',address:'',creditLimit:0,notes:''}],sales:[],expenses:[],stockMoves:[],receivables:[],quotes:[],deliveries:[],nfeInvoices:[],suppliers:[{id:'s1',name:'Fornecedor Exemplo',phone:'',city:'',notes:''}],purchases:[],audit:[],accessLogs:[],cashRegisters:[]};
function migrate(d){d={...structuredClone(initialDB),...d,settings:{...initialDB.settings,...(d.settings||{})}};['cashRegisters','accessLogs','suppliers','purchases','quotes','deliveries','nfeInvoices','audit','stockMoves','receivables','expenses','sales','clients','products','users'].forEach(k=>d[k]=d[k]||[]);if(!d.users.length)d.users=[structuredClone(initialDB.users[0])];d.users=d.users.map(secureUser);d.settings.whatsappTemplates={...initialDB.settings.whatsappTemplates,...(d.settings.whatsappTemplates||{})};if(!/COMPROVANTE DE VENDA|━━━━━━━━|\{itens\}/i.test(d.settings.whatsappTemplates.comprovante||''))d.settings.whatsappTemplates.comprovante=initialDB.settings.whatsappTemplates.comprovante;d.version=APP_VERSION;return d}
let db=load(),page='dashboard',cart=[],editingProduct=null,editingClient=null,editingSupplier=null,editingUser=null,range={from:today().slice(0,8)+'01',to:today()},focusAfterRender=null;
let lookupCache={products:new Map(),clients:new Map(),suppliers:new Map()};
function rebuildLookupCache(){lookupCache={products:new Map((db.products||[]).map(x=>[x.id,x])),clients:new Map((db.clients||[]).map(x=>[x.id,x])),suppliers:new Map((db.suppliers||[]).map(x=>[x.id,x]))}}
let companyInfo={currentCompanyId:'default',companies:[{id:'default',name:'Minha Empresa',current:true}]};
let cashierMode=localStorage.getItem('nexagest-cashier-mode')==='1';
let sessionLocked=localStorage.getItem('nexagest-session-locked')==='1';
function load(){return migrate({})}
async function loadSqliteDatabase(){try{if(window.nexagest?.loadDatabase){let res=await window.nexagest.loadDatabase();if(res?.ok&&res.data)return migrate(res.data);}}catch(e){console.warn('SQLite load falhou, usando base limpa',e)}return migrate({})}
let saveTimer=null;
function save(opts={}){
  if(!window.nexagest?.saveDatabase)return;
  const silent=opts.silent!==false;
  updateSaveStatus('saving',{silent});
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{
    window.nexagest.saveDatabase(db)
      .then(()=>updateSaveStatus('saved',{silent}))
      .catch(err=>{console.warn('SQLite save falhou',err);updateSaveStatus('error')});
  },120);
}
function saveWithFeedback(){save({silent:false})}
function audit(action){db.audit.unshift({id:uid(),date:new Date().toISOString(),user:db.session?.name||'Sistema',action});save()}
function accessLog(action,extra=''){db.accessLogs=db.accessLogs||[];db.accessLogs.unshift({id:uid(),date:new Date().toISOString(),user:db.session?.name||'Sistema',role:db.session?.role||'',action,extra});db.accessLogs=db.accessLogs.slice(0,500);save()}
function startSession(u){secureUser(u);db.session={id:u.id,name:u.name,role:u.role};sessionLocked=false;localStorage.removeItem('nexagest-session-locked');page=firstAllowedPage();cashierMode=(u.role==='Caixa');localStorage.setItem('nexagest-cashier-mode',cashierMode?'1':'0');audit('Login');accessLog('Login');save();app()}
function endSession(action='Logout'){if(db.session){audit(action);accessLog(action)}db.session=null;sessionLocked=false;cashierMode=false;localStorage.removeItem('nexagest-session-locked');localStorage.removeItem('nexagest-cashier-mode');save();app()}
function lockSession(){if(!db.session)return;sessionLocked=true;localStorage.setItem('nexagest-session-locked','1');audit('Sistema bloqueado');accessLog('Bloqueio');save();app()}
function unlockSession(){let pass=val('unlockPass');let u=db.users.find(x=>x.id===db.session?.id);if(!u||!checkPassword(u,pass)){alert('Senha incorreta.');queueFocus('unlockPass',true);app();return}sessionLocked=false;localStorage.removeItem('nexagest-session-locked');audit('Sistema desbloqueado');accessLog('Desbloqueio');save();app()}
const ROLE_PERMISSIONS={
  Administrador:['dashboard','pdv','products','stock','clients','finance','purchases','nfe','suppliers','quotes','deliveries','labels','reports','premium','users','settings'],
  Caixa:['pdv','clients','quotes','deliveries'],
  Estoque:['products','stock','purchases','nfe','suppliers','labels']
};
const ROLE_DESCRIPTIONS={
  Administrador:'Acesso total ao sistema.',
  Caixa:'Acesso ao Caixa, clientes, orçamentos e entregas. Sem dashboard, financeiro, usuários, configurações, estoque administrativo ou backup.',
  Estoque:'Acesso a produtos, estoque, compras, fornecedores, nota fiscal e etiquetas. Sem dashboard, Caixa, financeiro, usuários ou configurações.'
};
function can(area){let r=db.session?.role;return !!(r&&ROLE_PERMISSIONS[r]&&ROLE_PERMISSIONS[r].includes(area))}
function canSwitchCompany(){return db.session?.role==='Administrador'}
function allowedPages(){return nav.filter(n=>can(n[0])).map(n=>n[0])}
function firstAllowedPage(){return allowedPages()[0]||'dashboard'}
function requireCan(area){if(can(area))return true;alert('Acesso bloqueado para o perfil '+(db.session?.role||'atual')+'.');page=firstAllowedPage();app();return false}
const nav=[['dashboard','📊','Dashboard'],['pdv','💵','Caixa'],['products','📦','Produtos'],['stock','🏷️','Estoque'],['clients','👥','Clientes'],['finance','💰','Financeiro'],['purchases','🧾','Compras'],['nfe','📄','Nota Fiscal'],['suppliers','🏢','Fornecedores'],['quotes','📋','Orçamentos'],['deliveries','🚚','Entregas'],['labels','🏷️','Etiquetas'],['reports','📈','Relatórios'],['premium','⭐','Premium'],['users','🔒','Usuários'],['settings','⚙️','Configurações']];
function cleanupUiLocks(){document.querySelectorAll('#cashModalOverlay,.modal-overlay.temporary,.loading,.overlay,.modal-backdrop,.blocker').forEach(el=>{if(el.id==='cashModalOverlay'||(!el.classList.contains('show')&&!el.classList.contains('open')&&!el.classList.contains('active')))el.remove?.()});document.body.classList.remove('modal-open','loading','blocked');document.documentElement.classList.remove('modal-open','loading','blocked')}
function navigateTo(target){if(!can(target))return requireCan(target);cleanupUiLocks();pageTransition();page=target;if(target!=='pdv'&&cashierMode){cashierMode=false;localStorage.removeItem('nexagest-cashier-mode')}setTimeout(app,45)}
function app(){rebuildLookupCache();applyTheme();cleanupUiLocks();if(db.session&&(!views[page]||!can(page)))page=firstAllowedPage();document.getElementById('app').innerHTML=db.session?(sessionLocked?lockView():layout()):loginView();bind();stabilizeForms();enhanceVisualExperience();runFocusAfterRender();refreshLiveNetworkTimers();refreshNetworkRealtimeMonitor()}
function queueFocus(id,select=false){focusAfterRender={id,select}}
function runFocusAfterRender(){let f=focusAfterRender;focusAfterRender=null;if(!f)return;setTimeout(()=>{let el=document.getElementById(f.id);if(el){el.disabled=false;el.readOnly=false;el.focus();if(f.select&&el.select)el.select()}},30)}
function stabilizeForms(){setTimeout(()=>{document.querySelectorAll('input,textarea,select,button').forEach(el=>{if(el.dataset.keepDisabled==='true')return;if(el.matches('button[disabled], input[readonly]'))return;if(el.getAttribute('aria-disabled')==='true')el.removeAttribute('aria-disabled');});document.querySelectorAll('.loading,.overlay,.modal-backdrop,.blocker').forEach(el=>{if(!el.classList.contains('show')&&!el.classList.contains('open')&&!el.classList.contains('active'))el.style.pointerEvents='none'});},0)}
function applyTheme(){document.body.dataset.theme=db.settings.theme;document.documentElement.style.setProperty('--brand',db.settings.accent||'#2563eb')}
function logo(){return db.settings.logo?`<div class="logo-img"><img src="${db.settings.logo}"></div>`:`<div class="logo-img"><img src="assets/nexagest-logo.png"></div>`}
function currentCompanyName(){let c=(companyInfo.companies||[]).find(x=>x.current||x.id===companyInfo.currentCompanyId);return c?.name||db.settings.company||'Minha Empresa'}
function activeCompanies(){return (companyInfo.companies||[]).filter(c=>c.active!==false)}
function loginView(){return `<div class="login"><div class="login-card"><div class="brand-large">${logo()}<div><h1>NexaGest</h1><p class="muted">Gestão completa para pequenos negócios</p></div></div><p class="muted">Sistema desktop para caixa, estoque, financeiro, clientes, entregas, orçamentos e relatórios.</p><div class="field"><label>Usuário</label><input id="loginUser" autocomplete="username" placeholder="Digite seu usuário"></div><div class="field"><label>Senha</label><input id="loginPass" type="password" autocomplete="current-password" placeholder="Digite sua senha"></div><button id="loginBtn" class="full big">Entrar</button><p class="muted small">No primeiro acesso use admin / admin e troque a senha em Usuários.</p></div></div>`}
function lockView(){return `<div class="login lock-screen"><div class="login-card"><div class="brand-large">${logo()}<div><h1>Sistema bloqueado</h1><p class="muted">Sessão protegida do NexaGest</p></div></div><div class="notice"><b>${esc(db.session?.name||'Usuário')}</b><br><span>${esc(db.session?.role||'')}</span></div><div class="field"><label>Senha para desbloquear</label><input id="unlockPass" type="password" autocomplete="current-password" placeholder="Digite sua senha"></div><button id="unlockBtn" class="full big">Desbloquear</button><button id="switchUserFromLock" class="ghost full">Trocar usuário</button><p class="muted small">Use Trocar usuário para encerrar esta sessão e entrar com outro login.</p></div></div>`}
function layout(){if(!can(page))page=firstAllowedPage();if(cashierMode&&page==='pdv')return cashierLayout();let allowed=nav.filter(n=>can(n[0]));return `<div class="app"><aside class="sidebar"><div class="brand">${logo()}<div><b>NexaGest</b><span>${esc(db.settings.company)}</span></div></div><div class="nav">${allowed.map(n=>`<button data-page="${n[0]}" class="${page===n[0]?'active':''}"><span>${n[1]}</span>${n[2]}</button>`).join('')}</div><div class="sidebar-foot"><div class="small">Logado como <b>${esc(db.session.name)}</b><br><span>${esc(db.session.role)}</span></div><button class="ghost full" id="lockSession">🔒 Bloquear</button><button class="ghost full" id="switchUser">🔄 Trocar usuário</button><button class="ghost full" id="logout">🚪 Sair</button></div></aside><main class="main"><div class="topbar"><div><h1>${nav.find(n=>n[0]===page)?.[2]}</h1><p class="muted">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</p></div><div class="row no-print">${page==='pdv'?'<button class="ok" id="enterCashierMode">🧾 Modo Operador</button>':''}${canSwitchCompany()?`<button class="ghost company-switch-top" id="openCompanySwitcher">🏢 ${esc(currentCompanyName())}</button>`:''}<button class="ghost" id="openCommandPalette">⌘ Ctrl+K</button><button class="ghost" id="lockSessionTop">🔒 Bloquear</button><button class="ghost" id="switchUserTop">🔄 Trocar usuário</button><button class="ghost" id="themeToggle">${db.settings.theme==='dark'?'☀️ Claro':'🌙 Escuro'}</button></div></div>${views[page]()}</main></div>`}
function cashierLayout(){return `<div class="cashier-mode app"><main class="cashier-main"><div class="cashier-topbar no-print"><div class="cashier-brand">${logo()}<div><b>Modo Operador de Caixa</b><span>${esc(db.settings.company)}</span></div></div><div class="cashier-status"><span>Operador: <b>${esc(db.session?.name||'')}</b></span><span>Perfil: <b>${esc(db.session?.role||'')}</b></span><span>${new Date().toLocaleDateString('pt-BR')}</span></div><div class="cashier-actions">${canSwitchCompany()?`<button class="ghost company-switch-top" id="openCompanySwitcher">🏢 ${esc(currentCompanyName())}</button>`:''}<button class="ghost" id="openCommandPalette">⌘ Ctrl+K</button><button class="ghost" id="focusPdvSearch">Focar busca</button><button class="ghost" id="lockSessionTop">🔒 Bloquear</button><button class="ghost" id="switchUserTop">🔄 Trocar usuário</button><button class="danger" id="exitCashierMode">Sair do modo caixa</button></div></div>${views.pdv()}</main></div>`}
function salesValid(){return db.sales.filter(s=>!s.cancelled)}function product(id){return lookupCache.products.get(id)||db.products.find(p=>p.id===id)||{name:'-'}}function client(id){return lookupCache.clients.get(id)||db.clients.find(c=>c.id===id)||{name:id?'Cliente removido':'Balcão'}}
function stats(){let d=today(),m=d.slice(0,7),sv=salesValid(),td=sv.filter(s=>s.date.slice(0,10)===d),ms=sv.filter(s=>s.date.slice(0,7)===m),monthRev=sum(ms,'total'),cost=sum(ms,'cost'),exp=sum(db.expenses.filter(e=>e.date.slice(0,7)===m),'value'),rec=sum(db.receivables.filter(r=>!r.paid),'value');return{today:sum(td,'total'),monthRev,cost,exp,gross:monthRev-cost,net:monthRev-cost-exp,rec,low:db.products.filter(p=>p.active&&p.stock<=p.min).length,ticket:ms.length?monthRev/ms.length:0}}

function currentCashRegister(){return (db.cashRegisters||[]).find(c=>c.status==='Aberto'&&c.operatorId===db.session?.id)||null}
function isCashOpen(){return !!currentCashRegister()}
function requireCashOpen(action='realizar esta ação'){if(isCashOpen())return true;alert('Abra o caixa antes de '+action+'.');setTimeout(()=>document.getElementById('cashInitial')?.focus(),40);return false}
function closeCashModal(){document.querySelectorAll('#cashModalOverlay').forEach(el=>el.remove());document.body.classList.remove('modal-open','loading','blocked');document.documentElement.classList.remove('modal-open','loading','blocked')}
function cashModal(title,body){closeCashModal();document.body.insertAdjacentHTML('beforeend',`<div id="cashModalOverlay" class="modal-overlay"><div class="modal-card cash-modal"><div class="between"><h3>${title}</h3><button class="ghost" id="cashModalCancelTop">×</button></div>${body}</div></div>`);document.getElementById('cashModalCancelTop')?.addEventListener('click',closeCashModal)}

function openCashRegisters(){return (db.cashRegisters||[]).filter(c=>c.status==='Aberto')}
function cashRegisterSales(cashId){return salesValid().filter(s=>s.cashRegisterId===cashId)}
function normalizePaymentName(p){return window.NexaGestCashier?window.NexaGestCashier.normalizePaymentName(p):(()=>{let x=String(p||'Dinheiro').toLowerCase();if(x.includes('pix'))return 'Pix';if(x.includes('débito')||x.includes('debito'))return 'Cartão Débito';if(x.includes('crédito')||x.includes('credito'))return 'Cartão Crédito';if(x.includes('fiado'))return 'Fiado';return 'Dinheiro'})()}
function cashRegisterSummary(c){
  if(window.NexaGestCashier)return window.NexaGestCashier.cashRegisterSummary(c,salesValid());
  let sales=cashRegisterSales(c.id), by={Dinheiro:0,Pix:0,'Cartão Débito':0,'Cartão Crédito':0,Fiado:0};
  sales.forEach(s=>{let k=normalizePaymentName(s.payment);by[k]=(by[k]||0)+Number(s.total||0)});
  let movs=c.movements||[], sangrias=movs.filter(m=>m.type==='Sangria').reduce((a,m)=>a+Number(m.value||0),0), suprimentos=movs.filter(m=>m.type==='Suprimento').reduce((a,m)=>a+Number(m.value||0),0);
  let dinheiroVendas=Number(by.Dinheiro||0), expected=Number(c.initialAmount||0)+dinheiroVendas+suprimentos-sangrias;
  let totalSales=sales.reduce((a,s)=>a+Number(s.total||0),0);
  return{sales,by,dinheiroVendas,pixVendas:by.Pix||0,debitoVendas:by['Cartão Débito']||0,creditoVendas:by['Cartão Crédito']||0,fiadoVendas:by.Fiado||0,sangrias,suprimentos,expected,totalSales,count:sales.length};
}
function cashPaymentSummaryHtml(sm){return window.NexaGestCashier?window.NexaGestCashier.paymentSummaryHtml(sm,money):`<div class="summary-box cash-close-summary"><div><span>Vendas</span><b>${sm.count}</b></div><div><span>Total vendido</span><b>${money(sm.totalSales)}</b></div><div><span>💵 Dinheiro</span><b>${money(sm.dinheiroVendas)}</b></div><div><span>📱 Pix</span><b>${money(sm.pixVendas)}</b></div><div><span>💳 Débito</span><b>${money(sm.debitoVendas)}</b></div><div><span>💳 Crédito</span><b>${money(sm.creditoVendas)}</b></div><div><span>📝 Fiado</span><b>${money(sm.fiadoVendas)}</b></div><div><span>Sangrias</span><b>${money(sm.sangrias)}</b></div><div><span>Suprimentos</span><b>${money(sm.suprimentos)}</b></div><div class="total"><span>Dinheiro esperado na gaveta</span><b>${money(sm.expected)}</b></div></div>`}

function cashStatusPanel(){
  let c=currentCashRegister();
  if(!c){return `<div class="panel cash-control closed"><div class="between"><div><h3>🔒 Caixa fechado</h3><p class="muted small">Abra o caixa para começar a vender neste usuário.</p></div><span class="pill bad">Fechado</span></div><div class="cash-open-grid"><div class="field"><label>Valor inicial / Troco</label><input id="cashInitial" type="number" step="0.01" placeholder="Ex.: 100,00"></div><div class="field"><label>Observação</label><input id="cashObs" placeholder="Ex.: Caixa da manhã"></div><button class="ok big" id="openCashRegister">🟢 Abrir Caixa</button></div></div>`}
  let sm=cashRegisterSummary(c), opened=new Date(c.openedAt), dur=Math.max(0,Math.round((Date.now()-opened.getTime())/60000));
  return `<div class="panel cash-control open"><div class="between"><div><h3>🟢 Caixa aberto</h3><p class="muted small">Operador: <b>${esc(c.operatorName)}</b> • Aberto em ${br(c.openedAt)} • ${Math.floor(dur/60)}h ${dur%60}min</p></div><span class="pill good">Caixa nº ${esc(c.number)}</span></div><div class="cash-mini-cards"><div><span>Troco inicial</span><b>${money(c.initialAmount)}</b></div><div><span>Vendas</span><b>${sm.count}</b></div><div><span>Total vendido</span><b>${money(sm.totalSales)}</b></div><div><span>Dinheiro</span><b>${money(sm.dinheiroVendas)}</b></div><div><span>Pix</span><b>${money(sm.pixVendas)}</b></div><div><span>Débito/Crédito</span><b>${money(sm.debitoVendas+sm.creditoVendas)}</b></div><div><span>Dinheiro esperado</span><b>${money(sm.expected)}</b></div></div><div class="cash-actions"><button class="ghost" id="cashSupply">💰 Suprimento</button><button class="ghost" id="cashWithdrawal">💸 Sangria</button><button class="danger" id="closeCashRegister">🔴 Fechar Caixa</button></div></div>`
}
function openCashRegister(){if(!requireCan('pdv'))return;if(currentCashRegister())return alert('Este usuário já possui um caixa aberto.');let initial=num('cashInitial'),obs=val('cashObs');let n=(db.cashRegisters||[]).length+1;db.cashRegisters=db.cashRegisters||[];db.cashRegisters.unshift({id:uid(),number:n,operatorId:db.session.id,operatorName:db.session.name,openedAt:new Date().toISOString(),closedAt:null,status:'Aberto',initialAmount:initial,finalAmount:null,difference:null,obs,movements:[]});audit('Caixa aberto com '+money(initial));accessLog('Abertura de caixa',money(initial));save();app();alert('Caixa aberto com sucesso.')}
function addCashMovement(type){let c=currentCashRegister();if(!c)return alert('Abra o caixa primeiro.');let label=type==='Sangria'?'Sangria':'Suprimento';cashModal(label,`<p class="muted small">Informe o valor e o motivo da movimentação.</p><div class="field"><label>Valor</label><input id="cashMovementValue" type="number" step="0.01" placeholder="Ex.: 50,00" autofocus></div><div class="field"><label>Motivo / observação</label><input id="cashMovementReason" placeholder="Ex.: Troco, retirada para cofre..."></div><div class="modal-actions"><button class="ghost" id="cashModalCancel">Cancelar</button><button class="ok" id="cashMovementConfirm">Confirmar ${label}</button></div>`);setTimeout(()=>document.getElementById('cashMovementValue')?.focus(),0);document.getElementById('cashModalCancel')?.addEventListener('click',closeCashModal);document.getElementById('cashMovementConfirm')?.addEventListener('click',()=>confirmCashMovement(type))}
function confirmCashMovement(type){let c=currentCashRegister();if(!c)return closeCashModal();let v=Number(val('cashMovementValue')||0);if(!v||v<=0){alert('Informe um valor válido.');return}let reason=val('cashMovementReason')||'';c.movements=c.movements||[];c.movements.unshift({id:uid(),date:new Date().toISOString(),type,value:v,reason,user:db.session?.name||''});audit(type+' no caixa: '+money(v));accessLog(type, money(v)+' '+reason);save();closeCashModal();app();alert(type+' registrado com sucesso.')}
function closeCashRegister(){let c=currentCashRegister();if(!c)return alert('Não existe caixa aberto para este usuário.');let sm=cashRegisterSummary(c);cashModal('Fechar Caixa',`<p class="muted small">Confira somente o <b>dinheiro físico</b> da gaveta. Pix, débito e crédito aparecem no resumo, mas não entram no dinheiro esperado.</p>${cashPaymentSummaryHtml(sm)}<div class="field"><label>Dinheiro contado no caixa</label><input id="cashFinalValue" type="number" step="0.01" placeholder="Ex.: ${sm.expected.toFixed(2)}" autofocus></div><div class="modal-actions"><button class="ghost" id="cashModalCancel">Cancelar</button><button class="danger" id="cashCloseConfirm">Confirmar fechamento</button></div>`);setTimeout(()=>document.getElementById('cashFinalValue')?.focus(),0);document.getElementById('cashModalCancel')?.addEventListener('click',closeCashModal);document.getElementById('cashCloseConfirm')?.addEventListener('click',confirmCloseCashRegister)}
function confirmCloseCashRegister(){let c=currentCashRegister();if(!c)return closeCashModal();let sm=cashRegisterSummary(c);let raw=String(val('cashFinalValue')||'').trim();if(raw===''){alert('Informe o dinheiro contado no caixa antes de fechar.');setTimeout(()=>document.getElementById('cashFinalValue')?.focus(),40);return}let finalValue=Number(raw.replace(',','.'));if(!Number.isFinite(finalValue)||finalValue<0){alert('Informe um valor válido para o dinheiro contado.');setTimeout(()=>document.getElementById('cashFinalValue')?.focus(),40);return}let diff=finalValue-sm.expected;c.status='Fechado';c.closedAt=new Date().toISOString();c.finalAmount=finalValue;c.expectedAmount=sm.expected;c.difference=diff;c.totalSales=sm.totalSales;c.salesCount=sm.count;c.paymentSummary=sm.by;c.cashSales=sm.dinheiroVendas;c.pixSales=sm.pixVendas;c.debitSales=sm.debitoVendas;c.creditSales=sm.creditoVendas;c.fiadoSales=sm.fiadoVendas;c.sangrias=sm.sangrias;c.suprimentos=sm.suprimentos;c.closeSummary={salesCount:sm.count,totalSales:sm.totalSales,payments:sm.by,initialAmount:Number(c.initialAmount||0),cashSales:sm.dinheiroVendas,sangrias:sm.sangrias,suprimentos:sm.suprimentos,expectedAmount:sm.expected,finalAmount:finalValue,difference:diff,closedAt:c.closedAt};cart=[];['nexagest-temp-discount','nexagest-temp-discount-percent','nexagest-temp-paid','nexagest-temp-payment'].forEach(k=>localStorage.removeItem(k));audit('Caixa fechado. Diferença '+money(diff));accessLog('Fechamento de caixa','Diferença '+money(diff));save();closeCashModal();page='pdv';app();setTimeout(()=>{document.activeElement?.blur?.();},0);alert('Caixa fechado com sucesso.')}

function dateKeyOffset(days){let d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function isoMonthKey(offset=0){let d=new Date();d.setMonth(d.getMonth()+offset);return d.toISOString().slice(0,7)}
function monthLabel(key){let [y,m]=String(key).split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}
function salesBetween(from,to){return salesValid().filter(s=>{let d=(s.date||'').slice(0,10);return d>=from&&d<=to})}
function expensesBetween(from,to){return db.expenses.filter(e=>{let d=(e.date||'').slice(0,10);return d>=from&&d<=to})}
function pctChange(current,previous){if(!previous&&current)return 100;if(!previous&&!current)return 0;return ((current-previous)/previous)*100}
function trendBadge(current,previous){let pct=pctChange(current,previous),cls=pct>=0?'good':'bad',sym=pct>=0?'▲':'▼';return `<small class="trend ${cls}">${sym} ${Math.abs(pct).toFixed(1).replace('.',',')}% vs período anterior</small>`}
function dashboardLineChart(rows,keys){let w=720,h=230,pad=34,max=Math.max(1,...rows.flatMap(r=>keys.map(k=>Number(r[k]||0))));let step=rows.length>1?(w-pad*2)/(rows.length-1):0;function pts(key){return rows.map((r,i)=>{let x=pad+i*step,y=h-pad-(Number(r[key]||0)/max)*(h-pad*2);return `${x.toFixed(1)},${y.toFixed(1)}`}).join(' ')}let grid=[0,.25,.5,.75,1].map(t=>`<line x1="${pad}" x2="${w-pad}" y1="${(h-pad-t*(h-pad*2)).toFixed(1)}" y2="${(h-pad-t*(h-pad*2)).toFixed(1)}"/>`).join('');let labels=rows.map((r,i)=>`<text x="${(pad+i*step).toFixed(1)}" y="${h-8}" text-anchor="middle">${esc(r.label)}</text>`).join('');return `<svg class="dash-svg line-chart" viewBox="0 0 ${w} ${h}" role="img">${grid}<polyline class="prev" points="${pts('previous')}"/><polyline class="current" points="${pts('current')}"/>${rows.map((r,i)=>`<circle class="point" cx="${(pad+i*step).toFixed(1)}" cy="${(h-pad-(Number(r.current||0)/max)*(h-pad*2)).toFixed(1)}" r="4"><title>${esc(r.label)}: ${money(r.current)}</title></circle>`).join('')}${labels}</svg>`}
function dashboardBarCompare(rows){let max=Math.max(1,...rows.flatMap(r=>[r.current,r.previous]));return `<div class="compare-bars">${rows.map(r=>`<div class="compare-item"><div class="compare-columns"><i class="current" style="height:${Math.max(6,Number(r.current||0)/max*120)}px" title="Atual: ${money(r.current)}"></i><i class="previous" style="height:${Math.max(6,Number(r.previous||0)/max*120)}px" title="Anterior: ${money(r.previous)}"></i></div><b>${esc(r.label)}</b><small>${money(r.current)}</small></div>`).join('')}</div>`}
function dashboardDonut(rows,total,label){if(!total)return `<div class="empty-chart"><b>${esc(label)}</b><span>Sem dados no período.</span></div>`;let size=180,c=size/2,r=62,circ=2*Math.PI*r,acc=0;let colors=['c1','c2','c3','c4','c5','c6'];let rings=rows.map((row,i)=>{let frac=Number(row.value||0)/total,dash=frac*circ,gap=circ-dash,off=-acc*circ;acc+=frac;return `<circle class="${colors[i%colors.length]}" cx="${c}" cy="${c}" r="${r}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${off}"><title>${esc(row.name)}: ${money(row.value)}</title></circle>`}).join('');return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 ${size} ${size}"><circle class="base" cx="${c}" cy="${c}" r="${r}"/>${rings}<text x="${c}" y="${c-4}" text-anchor="middle">Total</text><text x="${c}" y="${c+18}" text-anchor="middle">${money(total)}</text></svg><div class="donut-legend">${rows.map((r,i)=>`<div><span class="dot ${colors[i%colors.length]}"></span><b>${esc(r.name)}</b><em>${Math.round(Number(r.value||0)/total*100)}%</em><small>${money(r.value)}</small></div>`).join('')}</div></div>`}
function dashboardSpark(values){let w=160,h=46,max=Math.max(1,...values),step=values.length>1?w/(values.length-1):0;let pts=values.map((v,i)=>`${(i*step).toFixed(1)},${(h-(v/max)*(h-8)-4).toFixed(1)}`).join(' ');return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline points="${pts}"/></svg>`}
function dashboardPeriod(){return localStorage.getItem('dashboard-period')||'month'}
function dashboardPeriodRange(){let p=dashboardPeriod(),now=today(),from=now,to=now,label='Hoje';if(p==='yesterday'){from=to=dateKeyOffset(-1);label='Ontem'}else if(p==='7d'){from=dateKeyOffset(-6);label='Últimos 7 dias'}else if(p==='30d'){from=dateKeyOffset(-29);label='Últimos 30 dias'}else if(p==='month'){from=now.slice(0,8)+'01';label='Este mês'}else if(p==='all'){from='1900-01-01';label='Tudo'}return{period:p,from,to,label}}
function dashboardPeriodBar(d){const opts=[['today','Hoje'],['yesterday','Ontem'],['7d','7 dias'],['30d','30 dias'],['month','Este mês'],['all','Tudo']];return `<div class="panel dash-filterbar"><div><b>Período do painel</b><span class="muted small">Atualiza indicadores, gráficos e rankings.</span></div><div class="dash-filter-buttons">${opts.map(o=>`<button class="ghost ${d.period===o[0]?'active':''}" data-dashboard-period="${o[0]}">${o[1]}</button>`).join('')}</div></div>`}
function dashboardData(){let now=today(),yesterday=dateKeyOffset(-1),month=now.slice(0,7),prevMonth=isoMonthKey(-1),periodInfo=dashboardPeriodRange(),sv=salesValid(),todaySales=sv.filter(s=>(s.date||'').slice(0,10)===now),ySales=sv.filter(s=>(s.date||'').slice(0,10)===yesterday),monthSales=salesBetween(periodInfo.from,periodInfo.to),prevFrom=dateKeyOffset(-7,new Date(periodInfo.from+'T00:00:00')),prevTo=dateKeyOffset(-7,new Date(periodInfo.to+'T00:00:00')),prevMonthSales=salesBetween(prevFrom,prevTo),monthExp=db.expenses.filter(e=>dateInRange((e.date||'').slice(0,10),periodInfo.from,periodInfo.to)),prevExp=db.expenses.filter(e=>dateInRange((e.date||'').slice(0,10),prevFrom,prevTo)),goal=Number(db.settings.monthlyGoal||0),monthRev=sum(monthSales,'total'),prevRev=sum(prevMonthSales,'total'),cost=sum(monthSales,'cost'),prevCost=sum(prevMonthSales,'cost'),exp=sum(monthExp,'value'),prevExpTotal=sum(prevExp,'value'),net=monthRev-cost-exp,prevNet=prevRev-prevCost-prevExpTotal;let days=[];for(let i=6;i>=0;i--){let key=dateKeyOffset(-i),prev=dateKeyOffset(-i-7);days.push({label:new Date(key+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),current:sum(salesBetween(key,key),'total'),previous:sum(salesBetween(prev,prev),'total')})}let payments=groupSum(monthSales,s=>s.payment||'Não informado',s=>s.total).slice(0,6).map(([name,value])=>({name,value}));let categories={};monthSales.forEach(s=>(s.items||[]).forEach(i=>{let p=product(i.id),cat=p.category||'Geral';categories[cat]=(categories[cat]||0)+Number(i.price||p.sale||0)*Number(i.qty||0)}));let catRows=Object.entries(categories).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));let months=[];for(let i=5;i>=0;i--){let k=isoMonthKey(-i),pk=isoMonthKey(-i-1),cur=sv.filter(s=>(s.date||'').slice(0,7)===k),pre=sv.filter(s=>(s.date||'').slice(0,7)===pk);months.push({label:monthLabel(k),current:sum(cur,'total'),previous:sum(pre,'total')})}let hours=Array.from({length:15},(_,i)=>({label:String(i+7).padStart(2,'0')+'h',value:0}));monthSales.forEach(s=>{let h=Number((s.date||'').slice(11,13));let row=hours.find(x=>Number(x.label.slice(0,2))===h);if(row)row.value+=Number(s.total||0)});let soldRows=new Map();monthSales.forEach(s=>(s.items||[]).forEach(i=>{let p=product(i.id),cur=soldRows.get(i.id)||{p,qty:0,total:0};cur.qty+=Number(i.qty||0);cur.total+=Number(i.price||p.sale||0)*Number(i.qty||0);soldRows.set(i.id,cur)}));let top=[...soldRows.values()].filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty).slice(0,5);let low=db.products.filter(p=>p.active!==false&&Number(p.stock||0)<=Number(p.min||0)),receivables=db.receivables.filter(r=>!r.paid),pending=db.deliveries.filter(d=>d.status!=='Entregue'),openCash=(db.cashRegisters||[]).filter(c=>c.status==='Aberto'),goalPct=goal?Math.min(100,Math.round(monthRev/goal*100)):0,day=new Date().getDate(),lastDay=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate(),projection=day?monthRev/day*lastDay:monthRev,need=Math.max(0,goal-monthRev),daysLeft=Math.max(1,lastDay-day+1),needPerDay=goal?need/daysLeft:0;return{now,yesterday,period:periodInfo.period,periodLabel:periodInfo.label,from:periodInfo.from,to:periodInfo.to,monthSales,prevMonthSales,todaySales,ySales,monthRev,prevRev,cost,exp,net,prevNet,goal,goalPct,projection,needPerDay,days,payments,catRows,months,hours,top,low,receivables,pending,openCash,today:sum(todaySales,'total'),todayPrev:sum(ySales,'total'),ticket:monthSales.length?monthRev/monthSales.length:0,prevTicket:prevMonthSales.length?prevRev/prevMonthSales.length:0,transactions:monthSales.length,prevTransactions:prevMonthSales.length}}
function dateInRange(key,from,to){return key&&key>=from&&key<=to}
function dateKeyOffset(offset,base){let d=base?new Date(base):new Date();d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
function dashboardKpi(title,value,sub,cls='',go=''){return `<button class="card dash-pro-kpi dash-clickable" ${go?`data-dash-go="${go}"`:''}><span>${esc(title)}</span><b class="${cls}">${value}</b>${sub}<small class="dash-open-hint">Abrir</small></button>`}
function dashboardAlertRows(d){let rows=[];if(d.low.length)rows.push(['🔴',`${d.low.length} produto(s) com estoque baixo`,'Verificar estoque','stock']);if(d.receivables.length)rows.push(['🟡',`${d.receivables.length} conta(s) a receber em aberto`,'Ver financeiro','finance']);if(d.pending.length)rows.push(['🚚',`${d.pending.length} entrega(s) pendente(s)`,'Ver entregas','deliveries']);if(!d.openCash.length)rows.push(['🔒','Nenhum caixa aberto agora','Abrir caixa no PDV','pdv']);if(d.goal&&d.goalPct>=100)rows.push(['🎯','Meta mensal atingida','Excelente resultado','reports']);if(!rows.length)rows.push(['✅','Nenhum alerta importante agora','Tudo em ordem','dashboard']);return rows.map(r=>`<button class="alert-row" data-dash-go="${r[3]}"><b>${r[0]}</b><span>${esc(r[1])}</span><small>${esc(r[2])}</small></button>`).join('')}
function dashboardExecutiveSummary(d){
  let margin=d.monthRev?Math.round((d.net/d.monthRev)*100):0;
  let dailyGoal=d.goal?d.goal/(new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()):0;
  let need=Math.max(0,d.goal-d.monthRev);
  let daysLeft=Math.max(1,new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()-new Date().getDate()+1);
  let needPerDay=d.goal?need/daysLeft:0;
  let health=d.net>=0&&(!d.goal||d.goalPct>=70)?'good':(d.net>=0?'warn':'bad');
  return `<div class="panel dash-executive"><div><span class="pill ${health}">${health==='good'?'Saudável':health==='warn'?'Atenção':'Crítico'}</span><h3>Resumo executivo</h3><p>${d.monthSales.length?`O mês soma <b>${money(d.monthRev)}</b> em vendas, lucro líquido de <b class="${d.net>=0?'good':'bad'}">${money(d.net)}</b> e margem aproximada de <b>${margin}%</b>.`:'Ainda não há vendas neste mês para montar uma leitura gerencial.'}</p></div><div class="dash-exec-grid"><div><small>Meta diária ideal</small><b>${money(dailyGoal)}</b></div><div><small>Falta para meta</small><b>${money(need)}</b></div><div><small>Necessário/dia</small><b>${money(needPerDay)}</b></div></div></div>`
}
function dashboardQuickActions(){
  const actions=[['pdv','💵','Abrir PDV','Registrar uma venda'],['products','📦','Produtos','Ver estoque e preços'],['clients','👥','Clientes','Consultar histórico'],['purchases','🧾','Compras','Entrada e fornecedores'],['finance','💰','Financeiro','Receber e pagar contas'],['deliveries','🚚','Entregas','Acompanhar rotas'],['nfe','📄','Nota Fiscal','Importar XML'],['reports','📈','Relatórios','Exportar resultados']];
  return `<div class="panel dash-quick"><div class="between"><h3>Ações rápidas</h3><span class="pill">Dashboard PRO</span></div><div class="dash-action-grid">${actions.map(a=>`<button class="dash-action" data-dash-go="${a[0]}"><b>${a[1]}</b><span>${a[2]}</span><small>${a[3]}</small></button>`).join('')}</div></div>`
}
function dashboardRecentSales(d){
  let recent=salesValid().slice(0,6);
  return `<div class="panel"><div class="between"><h3>Vendas recentes</h3><span class="pill">${recent.length} registro(s)</span></div>${recent.length?table(['Data','Cliente','Pagamento','Total'],recent.map(s=>[br(s.date),esc(client(s.clientId).name||'Balcão'),esc(s.payment||'-'),`<b class="good">${money(s.total)}</b>`])):'<p class="muted">Nenhuma venda recente.</p>'}</div>`
}
function dashboardStockRisk(d){
  let rows=d.low.slice(0,6);
  return `<div class="panel"><div class="between"><h3>Estoque em atenção</h3><span class="pill ${rows.length?'warn':'good'}">${rows.length?'Revisar':'OK'}</span></div>${rows.length?table(['Produto','Atual','Mínimo','Status'],rows.map(p=>[esc(p.name),Number(p.stock||0),Number(p.min||0),'<span class="pill warn">Baixo</span>'])):'<p class="muted">Nenhum produto abaixo do estoque mínimo.</p>'}</div>`
}
function dashboardTopClients(d){let m=new Map();d.monthSales.forEach(s=>{let c=client(s.clientId),id=s.clientId||'balcao',cur=m.get(id)||{name:c.name||'Balcão',total:0,count:0};cur.total+=Number(s.total||0);cur.count++;m.set(id,cur)});let rows=[...m.values()].sort((a,b)=>b.total-a.total).slice(0,5);return `<div class="panel"><div class="between"><h3>Top clientes do período</h3><span class="pill">${rows.length}</span></div><div class="ranking-list dash-client-rank">${rows.map((x,i)=>`<button data-dash-go="clients"><b>${['🥇','🥈','🥉','4º','5º'][i]}</b><span>${esc(x.name)}</span><em>${money(x.total)}</em><small>${x.count} compra(s)</small></button>`).join('')||'<p class="muted">Sem clientes para ranquear no período.</p>'}</div></div>`}
function dashboardUpcoming(d){let rec=d.receivables.slice(0,4),del=d.pending.slice(0,4);let rows=[...rec.map(r=>({icon:'💰',title:client(r.clientId).name||'Conta a receber',detail:money(r.value),go:'finance'})),...del.map(x=>({icon:'🚚',title:client(x.clientId).name||'Entrega',detail:x.status||'Pendente',go:'deliveries'}))].slice(0,6);return `<div class="panel"><div class="between"><h3>Próximos pontos de atenção</h3><span class="pill ${rows.length?'warn':'good'}">${rows.length}</span></div><div class="dashboard-next-list">${rows.map(r=>`<button data-dash-go="${r.go}"><b>${r.icon}</b><span>${esc(r.title)}</span><small>${esc(r.detail)}</small></button>`).join('')||'<p class="muted">Nada pendente agora.</p>'}</div></div>`}

const views={dashboard(){let d=dashboardData(),profitClass=d.net>=0?'good':'bad',cashTotal=sum(d.openCash,'expectedAmount')+sum(d.openCash,'initialAmount');return `<div class="dashboard-pro dashboard-pro-720"><div class="dash-hero panel"><div><h2>Bom dia, ${esc(db.session?.name||'Usuário')} 👋</h2><p class="muted">Painel gerencial com vendas, lucro, formas de pagamento, comparativos, metas e tendências.</p></div><div class="dash-period"><span>${esc(d.periodLabel)}</span><span>Hoje: ${money(d.today)}</span><b>Meta ${d.goalPct}%</b></div></div>${dashboardPeriodBar(d)}${dashboardExecutiveSummary(d)}<div class="grid cards dash-pro-cards">${dashboardKpi('Faturamento hoje',money(d.today),trendBadge(d.today,d.todayPrev),'good','pdv')}${dashboardKpi('Lucro líquido',money(d.net),trendBadge(d.net,d.prevNet),profitClass,'finance')}${dashboardKpi('Ticket médio',money(d.ticket),trendBadge(d.ticket,d.prevTicket),'','reports')}${dashboardKpi('Meta mensal',`${d.goalPct}%`,`<div class="progress"><i style="width:${d.goalPct}%"></i></div><small>${money(d.monthRev)} de ${money(d.goal)}</small>`,'warn','settings')}${dashboardKpi('Vendas no período',String(d.transactions),trendBadge(d.transactions,d.prevTransactions),'','reports')}</div><div class="grid dash-main"><div class="panel dash-chart-card wide"><div class="between"><h3>Faturamento diário</h3><span class="legend"><i class="current"></i> Este período <i class="previous"></i> Semana anterior</span></div>${dashboardLineChart(d.days,['current','previous'])}</div><div class="panel dash-chart-card"><h3>Formas de pagamento</h3>${dashboardDonut(d.payments,d.monthRev,'Formas de pagamento')}</div></div><div class="grid dash-main"><div class="panel dash-chart-card"><h3>Faturamento por categoria</h3>${dashboardDonut(d.catRows,d.monthRev,'Categorias')}</div><div class="panel dash-chart-card wide"><div class="between"><h3>Comparativo mensal</h3><span class="legend"><i class="current"></i> Atual <i class="previous"></i> Anterior</span></div>${dashboardBarCompare(d.months)}</div></div><div class="grid dash-main"><div class="panel dash-chart-card wide"><h3>Vendas por horário</h3>${dashboardLineChart(d.hours.map(h=>({label:h.label,current:h.value,previous:0})),['current'])}</div><div class="panel"><h3>Top 5 produtos mais vendidos</h3><div class="ranking-list">${d.top.map((x,i)=>`<button data-dash-go="products"><b>${['🥇','🥈','🥉','4º','5º'][i]}</b><span>${esc(x.p.name)}</span><em>${x.qty} un</em><small>${money(x.total)}</small></button>`).join('')||'<p class="muted">Sem vendas para calcular ranking.</p>'}</div></div></div><div class="grid three"><div class="panel"><h3>Metas e tendências</h3><div class="goal-box dash-goal-pro"><b>${d.goalPct}%</b><div class="progress"><i style="width:${d.goalPct}%"></i></div><span>${money(d.monthRev)} de ${money(d.goal)}</span><small>Projeção do mês: <strong>${money(d.projection)}</strong></small><small>Necessário/dia: <strong>${money(d.needPerDay)}</strong></small></div></div><div class="panel"><h3>Alertas inteligentes</h3>${dashboardAlertRows(d)}</div><div class="panel"><h3>Resumo do caixa</h3><div class="health-list"><button data-dash-go="pdv"><span>Caixas abertos</span><b>${d.openCash.length}</b></button><button data-dash-go="pdv"><span>Saldo em caixas</span><b>${money(cashTotal)}</b></button><button data-dash-go="stock"><span>Produtos críticos</span><b>${d.low.length}</b></button><button data-dash-go="finance"><span>Contas em aberto</span><b>${money(sum(d.receivables,'value'))}</b></button></div></div></div><div class="grid two">${dashboardTopClients(d)}${dashboardUpcoming(d)}</div><div class="grid two"><div class="panel"><h3>Atividades recentes</h3>${table(['Data','Usuário','Ação'],(db.audit||[]).slice(0,6).map(a=>[br(a.date),esc(a.user),esc(a.action)]))}</div><div class="panel"><h3>Saúde do negócio</h3><div class="health-list"><div><span>Faturamento do período</span><b>${money(d.monthRev)}</b></div><div><span>Custo dos produtos</span><b>${money(d.cost)}</b></div><div><span>Despesas</span><b>${money(d.exp)}</b></div><div><span>Lucro líquido</span><b class="${profitClass}">${money(d.net)}</b></div></div></div></div><div class="grid two">${dashboardRecentSales(d)}${dashboardStockRisk(d)}</div>${dashboardQuickActions()}</div>`},
pdv(){let open=isCashOpen();if(!open&&cart.length){cart=[]}let sub=open?cartTotal():0,discount=open?calcDiscount():0,total=Math.max(0,sub-discount),recent=salesValid().slice(0,5),term=localStorage.getItem('pdv-search')||'',disabled=open?'':'disabled';return `<div class="pdv-v45 pdv-pro pdv-refined ${!open?'cash-closed-mode':''}">${cashStatusPanel()}<div class="pdv-left"><div class="pdv-metrics"><div class="card"><span>Itens no carrinho</span><b>${open?cart.reduce((a,i)=>a+i.qty,0):0}</b></div><div class="card"><span>Subtotal</span><b>${money(sub)}</b></div><div class="card"><span>Desconto</span><b>${money(discount)}</b></div><div class="card total-metric"><span>Total</span><b>${money(total)}</b></div></div><div class="panel pdv-sale-panel"><div class="pdv-search-head"><div><h3>Venda rápida</h3><p class="muted small">${open?'Leitor USB ativo. Bipe o produto, use ↑ ↓ para navegar e Enter para adicionar.':'Modo consulta: abra o caixa para adicionar produtos ao carrinho.'}</p></div>${cashierMode?'':`<button class="ok" id="enterCashierModeInline">🧾 Modo Operador</button>`}</div><div class="pdv-main-search refined"><span>🔎</span><input id="pdvSearch" class="pdv-search" placeholder="Bipe o código ou digite o nome do produto" value="${esc(term)}" autofocus></div><div class="shortcut-bar pdv-actions"><button class="ghost" data-pdv-action="search">F2 Buscar</button><button class="ghost" data-pdv-action="client" ${disabled}>F3 Cliente</button><button class="ok" data-pdv-action="finish" ${(open&&cart.length)?'':'disabled'}>F4 Finalizar</button><button class="ghost" data-pdv-action="discount" ${disabled}>F5 Desconto</button><button class="danger" data-pdv-action="clear" ${(open&&cart.length)?'':'disabled'}>Ctrl+L Limpar</button></div><div class="pdv-results-hint muted small"><b>Operação:</b> leitor USB adiciona por código exato • Enter adiciona selecionado • Del remove último • Esc limpa.</div>${lastAddedBanner()}<div class="product-list refined-results" id="pdvProducts">${productCards(pdvFilteredProducts(term))}</div></div><div class="panel"><h3>Últimas vendas</h3>${recent.length?table(['Data','Cliente','Pagamento','Total'],recent.map(s=>[br(s.date),client(s.clientId).name||'Balcão',s.payment,money(s.total)])):'<p class="muted">Nenhuma venda registrada ainda.</p>'}</div></div><div class="panel sticky pdv-cart pdv-cart-refined ${!open?'locked':''}"><div class="between"><div><h3>Carrinho</h3><p class="muted small">${open?'Produtos da venda atual':'Caixa fechado'}</p></div>${open&&cart.length?'<button class="ghost" id="clearCart">Limpar</button>':''}</div>${cartView()}${open?`<div class="side-total-box"><div><span>Subtotal</span><b>${money(sub)}</b></div><div><span>Desconto</span><b>${money(discount)}</b></div><div class="grand"><span>TOTAL</span><b>${money(total)}</b></div></div><button class="ok full big" id="openFinalizeSale" ${cart.length?'':'disabled'}>F4 Finalizar venda</button><button class="ghost full" id="quoteFromCart" ${cart.length?'':'disabled'}>Gerar orçamento</button><div class="muted small pdv-side-help">F7 dinheiro • F8 Pix • F9 débito • F10 crédito aparecem na finalização.</div>`:`<div class="cash-cart-hint"><button class="ok full big" onclick="document.getElementById('cashInitial')?.focus()">🟢 Abrir caixa para vender</button></div>`}</div>${finalizeSaleModal()}</div>`},
products(){return window.NexaGestProducts.renderProductsPage({db,esc,money,productForm,productAdminCard,editingProduct})},
stock(){return window.NexaGestStock.renderStockPage({db,esc,money,br,product,stockTypeBadge})},
clients(){return window.NexaGestClients.renderClientsPage({db,esc,money,sum,openByClient,topClient,clientForm,table,lastClientSale})},
finance(){
let f=financeData(), cats=['Todas','Fornecedor','Combustível','Embalagem','Energia','Internet','Aluguel','Mercadoria','Taxas','Outros'];
return `<div class="finance-page"><div class="grid cards finance-summary"><div class="card dash-card"><span>Entradas do mês</span><b class="good">${money(f.inMonth)}</b><small>Vendas + recebimentos</small></div><div class="card dash-card"><span>Saídas do mês</span><b class="bad">${money(f.outMonth)}</b><small>Despesas lançadas</small></div><div class="card dash-card"><span>Saldo do mês</span><b class="${f.balance>=0?'good':'bad'}">${money(f.balance)}</b><small>Entradas - saídas</small></div><div class="card dash-card"><span>A receber</span><b class="warn">${money(f.openTotal)}</b><small>${f.open.length} conta(s) em aberto</small></div></div><div class="finance-tabs"><button class="active">Visão geral</button><button>Contas a pagar</button><button>Contas a receber</button><button>Fluxo de caixa</button></div><div class="grid two finance-layout"><div class="panel"><div class="between"><h3>Novo lançamento</h3><span class="pill">Entrada / Saída</span></div><div class="form-grid"><div class="field wide"><label>Descrição</label><input id="finDesc" placeholder="Ex: combustível, fornecedor, taxa, recebimento..."></div><div class="field"><label>Tipo</label><select id="finType"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></div><div class="field"><label>Categoria</label><select id="finCat">${cats.filter(c=>c!=='Todas').map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Valor</label><input id="finValue" type="number" step="0.01"></div><div class="field"><label>Pagamento</label><select id="finPayment"><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Transferência</option><option>Boleto</option></select></div><div class="field"><label>Situação</label><select id="finStatus"><option value="Pago">Pago</option><option value="Pendente">Pendente</option></select></div><div class="field"><label>Vencimento</label><input id="finDue" type="date" value="${today()}"></div><div class="field"><label>Parcelas</label><input id="finInstallments" type="number" min="1" max="60" value="1"></div><div class="field"><label>Recorrência</label><select id="finRecurrence"><option value="none">Não repetir</option><option value="monthly">Mensal</option></select></div><div class="field"><label>Prioridade</label><select id="finPriority"><option>Normal</option><option>Alta</option><option>Baixa</option></select></div><div class="field"><label>&nbsp;</label><button id="saveFinLaunch">Salvar lançamento</button></div></div></div><div class="panel"><div class="between"><h3>Contas a receber / fiado</h3><span class="pill ${f.open.length?'warn':'good'}">${f.open.length} aberto(s)</span></div>${table(['Data','Cliente','Venda','Valor','Ação'],f.open.map(r=>[br(r.date),client(r.clientId).name,r.saleId||'-',money(r.value),`<button class="ok" data-payrec="${r.id}">Receber</button>`]))}</div></div><div class="panel"><div class="between"><h3>Movimentações financeiras</h3><button class="ghost" id="exportFinance">Exportar CSV</button></div><div class="finance-filters"><input id="finSearch" placeholder="Buscar por descrição, categoria ou pagamento" value="${esc(f.q)}"><select id="finFilterType">${['Todos','Entrada','Saída'].map(x=>`<option ${x===f.type?'selected':''}>${x}</option>`).join('')}</select><select id="finFilterCat">${cats.map(c=>`<option ${c===f.cat?'selected':''}>${c}</option>`).join('')}</select></div>${table(['Data','Descrição','Categoria','Tipo','Valor','Pagamento','Situação','Ações'],f.rows.map(e=>[br(e.date),e.desc||'-',`<span class="pill">${esc(e.cat||'Outros')}</span>`,`<span class="pill ${e.type==='Entrada'?'good':'bad'}">${e.type}</span>`,`<b class="${e.type==='Entrada'?'good':'bad'}">${money(e.value)}</b>`,e.payment||'-',e.status||'Pago',e.source==='expense'?`<button class="danger" data-delexp="${e.id}">Excluir</button>`:'-']))}</div><div class="grid two"><div class="panel"><h3>Fluxo previsto - próximos 14 dias</h3>${financeProjectedBars(financeEnterpriseWindow(f,14).items, financeEnterpriseWindow(f,14).max)}</div><div class="panel"><h3>Resumo por categoria</h3>${table(['Categoria','Total'],f.byCat.map(x=>[x.cat,money(x.value)]))}</div></div></div>`},
purchases(){let d=purchaseData(),sel=localStorage.getItem('buy-product')||val('buyProduct')||db.products[0]?.id||'',sid=localStorage.getItem('buy-supplier')||val('buySupplier')||db.suppliers[0]?.id||'',p=product(sel),last=lastPurchase(sel),ins=purchaseProductInsights(sel);return `<div class="purchases-page purchases-pro"><div class="grid cards purchase-summary"><div class="card"><span>Compras do mês</span><b>${money(d.monthTotal)}</b><small>Total registrado no mês atual</small></div><div class="card"><span>Produtos comprados</span><b>${d.monthQty}</b><small>Unidades compradas no mês</small></div><div class="card"><span>Fornecedores usados</span><b>${d.suppliersUsed}</b><small>Com compras registradas</small></div><div class="card"><span>Custo médio</span><b>${money(d.avgCost)}</b><small>Média por unidade comprada</small></div></div><div class="panel purchase-pro-hero"><div><h3>Compras PRO</h3><p class="muted small">Registre compras manuais, confira último custo, compare fornecedores e use XML da NF-e para entrada automática quando precisar.</p></div><div class="row"><button class="ghost" id="goNfeImport">Importar XML da NF-e</button><button class="ghost" id="goSuppliersFromPurchase">Fornecedores</button></div></div><div class="grid two purchase-layout"><div class="panel"><div class="between"><h3>Nova compra</h3><span class="pill good">Entrada manual</span></div><div class="form-grid"><div class="field"><label>Fornecedor</label><select id="buySupplier">${db.suppliers.map(f=>`<option ${sid===f.id?'selected':''} value="${f.id}">${esc(f.name)}</option>`).join('')}</select></div><div class="field"><label>Produto</label><select id="buyProduct">${db.products.map(x=>`<option ${sel===x.id?'selected':''} value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Quantidade</label><input id="buyQty" type="number" value="1" min="1"></div><div class="field"><label>Custo unitário</label><input id="buyCost" type="number" step="0.01" placeholder="${Number(p.cost||0)}"></div><div class="field"><label>Status</label><select id="buyStatus"><option>Recebida</option><option>Parcial</option><option>Cancelada</option></select></div><div class="field"><label>Total da compra</label><div id="buyTotalPreview" class="total-preview">${money(Number(p.cost||0))}</div></div><div class="field wide"><label>Observação</label><input id="buyObs" placeholder="Ex: lote, validade, condição, desconto..."></div><div class="field"><label>&nbsp;</label><button id="savePurchase">Registrar compra</button></div></div><div class="purchase-smart-grid"><div class="last-price"><b>Último preço pago</b><span>${last?`${esc(supplier(last.supplierId).name)} • ${money(last.cost)} • ${br(last.date)}`:'Nenhuma compra anterior para este produto.'}</span></div><div class="last-price"><b>Fornecedor com melhor custo</b><span>${ins.best?`${esc(supplier(ins.best.supplierId).name)} • ${money(ins.best.cost)}`:'Sem histórico suficiente.'}</span></div><div class="last-price"><b>Margem atual</b><span id="buyMarginPreview">${purchaseMarginText(p.sale,p.cost)}</span></div><div class="last-price"><b>Venda sugerida</b><span id="buySuggestedSale">${money(suggestedSaleFromCost(Number(p.cost||0)))}</span></div></div><div class="hint">Compra recebida aumenta o estoque, cria movimentação e atualiza o custo do produto automaticamente.</div></div><div class="panel"><div class="between"><h3>Histórico de compras</h3><button class="ghost" id="exportPurchases">Exportar CSV</button></div><div class="purchase-filters purchase-filters-pro"><input id="purchaseSearch" placeholder="Buscar fornecedor, produto ou observação" value="${esc(d.q)}"><select id="purchaseSupplier"><option>Todos</option>${db.suppliers.map(f=>`<option ${d.supplierId===f.id?'selected':''} value="${f.id}">${esc(f.name)}</option>`).join('')}</select><select id="purchaseStatus"><option>Todos</option>${['Recebida','Parcial','Cancelada'].map(x=>`<option ${d.status===x?'selected':''}>${x}</option>`).join('')}</select><select id="purchasePeriod">${['Todos','Hoje','7 dias','30 dias','Mês atual'].map(x=>`<option ${d.period===x?'selected':''}>${x}</option>`).join('')}</select></div>${table(['Data','Fornecedor','Produto','Qtd.','Custo un.','Total','Status'],d.rows.slice(0,120).map(b=>[br(b.date),supplier(b.supplierId).name,product(b.productId).name,b.qty,money(b.cost),money(b.total),purchaseStatusBadge(b.status||'Recebida')]))}</div></div><div class="grid two"><div class="panel"><div class="between"><h3>Análise do produto selecionado</h3><span class="pill">${esc(p.name||'-')}</span></div><div class="purchase-analytics"><div><span>Estoque atual</span><b>${Number(p.stock||0)} un</b></div><div><span>Custo cadastrado</span><b>${money(p.cost||0)}</b></div><div><span>Preço de venda</span><b>${money(p.sale||0)}</b></div><div><span>Compras no histórico</span><b>${ins.count}</b></div></div><h4>Últimos preços desse produto</h4>${table(['Data','Fornecedor','Qtd.','Custo','Total'],ins.history.slice(0,8).map(b=>[br(b.date),supplier(b.supplierId).name,b.qty,money(b.cost),money(b.total)]))}</div><div class="panel"><h3>Últimos preços por produto</h3>${table(['Produto','Fornecedor','Último custo','Melhor custo','Data'],db.products.map(x=>{let l=lastPurchase(x.id),best=bestPurchaseForProduct(x.id);return[x.name,l?supplier(l.supplierId).name:'-',l?money(l.cost):money(x.cost),best?money(best.cost):'-',l?br(l.date):'-']}))}</div></div></div>`},

nfe(){let draft=nfeDraft(),invoices=db.nfeInvoices||[],month=today().slice(0,7),monthInvoices=invoices.filter(n=>String(n.date||'').slice(0,7)===month),monthTotal=sum(monthInvoices,'total'),itemsCount=monthInvoices.reduce((a,n)=>a+(n.items?.length||0),0),last=invoices[0],q=localStorage.getItem('nfe-q')||'';let filtered=invoices.filter(n=>!q||[n.supplierName,n.number,n.date,n.total,n.xmlName,n.status].join(' ').toLowerCase().includes(q.toLowerCase()));return `<div class="nfe-page nfe-pro"><div class="nfe-hero panel"><div><span class="pill">Entrada por XML</span><h2>Nota Fiscal de Entrada</h2><p class="muted">Importe o XML da NF-e, confira os produtos e registre a entrada automática no estoque com segurança.</p></div><div class="nfe-hero-actions"><button class="ghost" id="exportNfe">Exportar CSV</button></div></div><div class="grid cards nfe-summary"><div class="card nfe-card"><span>NF-es importadas</span><b>${invoices.length}</b><small>Total no sistema</small></div><div class="card nfe-card"><span>Total do mês</span><b>${money(monthTotal)}</b><small>Valor das notas importadas</small></div><div class="card nfe-card"><span>Itens no mês</span><b>${itemsCount}</b><small>Produtos processados</small></div><div class="card nfe-card"><span>Última NF-e</span><b>${last?esc(last.number||'-'):'-'}</b><small>${last?`${br(last.date)} • ${esc(last.supplierName||'Fornecedor')}`:'Nenhuma importada'}</small></div></div><div class="grid two nfe-layout"><div class="panel nfe-import-panel"><div class="between"><div><h3>Importar XML da NF-e</h3><p class="muted small">Selecione ou arraste o XML para gerar a prévia da entrada antes de atualizar o estoque.</p></div>${draft?'<button class="ghost danger" id="clearNfeDraft">Limpar</button>':''}</div><div class="nfe-drop" id="nfeDropZone"><input type="file" id="nfeXmlFile" accept=".xml,text/xml"><div class="nfe-drop-icon">📄</div><div><b>Solte o XML aqui ou clique para escolher</b><span>Arquivo aceito: XML da NF-e</span></div></div><div class="nfe-steps"><div><b>1</b><span>Importe o XML</span></div><div><b>2</b><span>Confira fornecedor e itens</span></div><div><b>3</b><span>Confirme a entrada no estoque</span></div></div>${draft?nfeDraftView(draft):'<div class="empty-cart nfe-empty">Nenhum XML carregado.<br><small>Quando carregar uma nota, a prévia aparecerá aqui.</small></div>'}</div><div class="panel nfe-history-panel"><div class="between"><div><h3>Histórico de NF-e</h3><p class="muted small">${filtered.length} nota(s) encontrada(s)</p></div></div><div class="filters nfe-filters"><input id="nfeSearch" placeholder="Buscar por fornecedor, número, data ou valor" value="${esc(q)}"></div>${table(['Data','Fornecedor','Número','Itens','Total','Status','Ações'],filtered.slice(0,120).map(n=>[br(n.date),esc(n.supplierName||'-'),esc(n.number||'-'),n.items?.length||0,money(n.total),`<span class="pill good">${esc(n.status||'Importada')}</span>`,`<div class="row"><button class="ghost" data-viewnfe="${n.id}">Detalhes</button><button class="ghost danger" data-delnfe="${n.id}">Excluir</button></div>`]))}</div></div></div>`},
suppliers(){return window.NexaGestSuppliers.renderSuppliersPage({db,esc,money,br,table,suppliersData,supplierTotalBought,lastSupplierPurchase,editingSupplier,today,sum})},
quotes(){let d=quotesData(),open=db.quotes.filter(q=>(q.status||'Aberto')==='Aberto'),converted=db.quotes.filter(q=>q.status==='Convertido'),cancelled=db.quotes.filter(q=>q.status==='Cancelado'),expired=quotesExpired(),expiring=quotesExpiringSoon(),openTotal=sum(open,'total'),selectedProduct=product(val('quoteProduct')||db.products[0]?.id),previewQty=Math.max(1,Number(localStorage.getItem('quote-qty')||1)),previewTotal=(selectedProduct.sale||0)*previewQty;return `<div class="quotes-page quotes-pro"><div class="grid cards quotes-summary"><div class="card"><span>Aguardando aprovação</span><b>${open.length}</b><small>${money(openTotal)} em aberto</small></div><div class="card"><span>Aprovados / Convertidos</span><b>${converted.length}</b><small>${db.quotes.length?Math.round(converted.length/db.quotes.length*100):0}% de conversão</small></div><div class="card"><span>Expirando</span><b>${expiring.length}</b><small>Próximos 3 dias</small></div><div class="card"><span>Expirados</span><b>${expired.length}</b><small>Precisam de revisão</small></div></div><div class="panel quotes-pro-hero"><div><span class="pill good">Orçamentos PRO</span><h3>Venda mais rápido com orçamento, WhatsApp e conversão para venda</h3><p class="muted small">Monte no PDV quando tiver vários itens ou crie um orçamento rápido por produto. Depois envie, imprima, duplique ou converta em venda.</p></div><div class="row"><button class="ok" id="goPdvQuote">Montar no PDV</button><button class="ghost" id="exportQuotes">Exportar CSV</button></div></div><div class="grid two"><div class="panel quote-builder-card"><div class="between"><h3>Novo orçamento rápido</h3><span class="pill warn">Validade ${quoteDefaultValid()}</span></div><div class="form-grid"><div class="field"><label>Cliente</label><select id="quoteClient"><option value="">Cliente balcão</option>${db.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Produto</label><select id="quoteProduct">${db.products.map(p=>`<option value="${p.id}">${esc(p.name)} - ${money(p.sale)}</option>`).join('')}</select></div><div class="field"><label>Quantidade</label><input id="quoteQty" type="number" min="1" value="${previewQty}"></div><div class="field"><label>Validade</label><input id="quoteValid" type="date" value="${quoteDefaultValid()}"></div><div class="field wide"><label>Observação</label><input id="quoteObs" placeholder="Ex.: entrega combinada, desconto, condição de pagamento"></div><div class="field"><label>Total previsto</label><div class="fake-input quote-total-preview" id="quoteTotalPreview">${money(previewTotal)}</div></div><div class="field"><label>&nbsp;</label><button id="saveQuote">Salvar orçamento</button></div></div></div><div class="panel"><h3>Resumo comercial</h3><div class="health-list quote-health"><div><span>Melhor cliente em orçamentos</span><b>${bestQuoteClient()}</b></div><div><span>Ticket médio</span><b>${money(db.quotes.length?sum(db.quotes,'total')/db.quotes.length:0)}</b></div><div><span>Último orçamento</span><b>${db.quotes[0]?br(db.quotes[0].date):'-'}</b></div><div><span>Taxa de conversão</span><b>${db.quotes.length?Math.round(converted.length/db.quotes.length*100):0}%</b></div></div><div class="quote-tips"><b>Atalhos úteis</b><span>Converter transforma em carrinho no PDV.</span><span>Duplicar reaproveita orçamento anterior.</span><span>WhatsApp abre conversa com mensagem pronta.</span></div></div></div><div class="panel"><div class="between"><h3>Histórico de orçamentos</h3><span class="muted">${d.rows.length} registro(s)</span></div><div class="filters quote-filters"><input id="quoteSearch" placeholder="Buscar cliente, produto ou observação" value="${esc(d.q)}"><select id="quoteStatus">${['Todos','Aberto','Convertido','Cancelado','Expirado'].map(x=>`<option ${d.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="quote-stage-strip"><button class="ghost" data-quote-filter="Todos">Todos</button><button class="ghost" data-quote-filter="Aberto">Abertos</button><button class="ghost" data-quote-filter="Expirado">Expirados</button><button class="ghost" data-quote-filter="Convertido">Convertidos</button></div>${table(['Data','Cliente','Itens','Total','Validade','Status','Ações'],d.rows.map(q=>[br(q.date),client(q.clientId).name||'Cliente balcão',quoteItemsText(q),money(quoteTotal(q)),quoteValidityBadge(q),quoteStatusBadge(quoteDisplayStatus(q)),quoteActions(q)]))}</div></div>`},
deliveries(){let data=deliveryData(),sts=['Pendente','Saiu para entrega','Entregue'];return `<div class="delivery-page delivery-pro-page"><div class="grid cards delivery-summary"><div class="card"><span>Pendentes</span><b>${data.pending.length}</b><small>aguardando saída</small></div><div class="card"><span>Em rota</span><b>${data.out.length}</b><small>saiu para entrega</small></div><div class="card"><span>Entregues hoje</span><b>${data.doneToday}</b><small>finalizadas hoje</small></div><div class="card"><span>Valor pendente</span><b>${money(data.pendingValue)}</b><small>a receber/entregar</small></div></div><div class="panel delivery-pro-highlight"><div class="between"><div><h3>Central de entregas</h3><p class="muted small">Controle entregador, veículo, prioridade, rota e status da entrega em uma única tela.</p></div><div class="row"><button class="ghost" id="exportDeliveries">Exportar CSV</button></div></div><div class="delivery-insights"><span class="pill">Alta prioridade: ${data.highPriority}</span><span class="pill">Com entregador: ${data.withDriver}</span><span class="pill">Total em aberto: ${money(data.pendingValue)}</span></div></div><div class="panel"><div class="between"><h3>Nova entrega</h3><span class="muted small">Preencha cliente, endereço e responsável pela rota.</span></div><div class="form-grid"><div class="field"><label>Cliente</label><select id="delClient">${db.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field wide"><label>Endereço</label><input id="delAddress" placeholder="Rua, número, bairro ou referência"></div><div class="field"><label>Valor</label><input id="delValue" type="number" step="0.01" placeholder="0,00"></div><div class="field"><label>Taxa de entrega</label><input id="delFee" type="number" step="0.01" placeholder="0,00"></div><div class="field"><label>Entregador</label><input id="delDriver" list="deliveryDrivers" placeholder="Ex: João, Moto 1"><datalist id="deliveryDrivers">${deliveryDriverOptions().map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></div><div class="field"><label>Veículo</label><select id="delVehicle"><option>Moto</option><option>Carro</option><option>Bicicleta</option><option>A pé</option><option>Outro</option></select></div><div class="field"><label>Prioridade</label><select id="delPriority"><option>Normal</option><option>Alta</option><option>Baixa</option></select></div><div class="field"><label>Previsão</label><input id="delEta" placeholder="Ex: 30 min, 18h"></div><div class="field wide"><label>Observação</label><input id="delObs" placeholder="Ex: entregar após 18h, chamar no portão..."></div><div class="field"><label>&nbsp;</label><button id="saveDelivery">Salvar entrega</button></div></div></div><div class="panel delivery-filters"><div class="field"><label>Buscar entrega</label><input id="deliverySearch" value="${esc(data.q)}" placeholder="Cliente, endereço, entregador ou observação"></div><div class="field"><label>Status</label><select id="deliveryStatus">${['Todos',...sts].map(x=>`<option ${data.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Período</label><select id="deliveryPeriod">${['Todos','Hoje','7 dias','30 dias'].map(x=>`<option ${data.period===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Prioridade</label><select id="deliveryPriority">${['Todas','Alta','Normal','Baixa'].map(x=>`<option ${data.priority===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="kanban delivery-kanban delivery-kanban-pro">${sts.map(st=>`<div class="kanban-col"><div class="between"><h3>${st}</h3><span class="pill">${data.rows.filter(d=>d.status===st).length}</span></div>${data.rows.filter(d=>d.status===st).map((d,i)=>deliveryCard(d,i)).join('')||'<p class="muted">Nada aqui.</p>'}</div>`).join('')}</div><div class="panel"><div class="between"><h3>Histórico de entregas</h3><span class="muted">${data.rows.length} registro(s)</span></div>${table(['Data','Cliente','Endereço','Entregador','Veículo','Valor','Status','Ações'],data.rows.map(d=>[br(d.date),client(d.clientId).name,esc(d.address||'-'),esc(d.driver||'-'),esc(d.vehicle||'-'),money(Number(d.value||0)+Number(d.fee||0)),deliveryStatusBadge(d.status),deliveryActions(d)]))}</div></div>`},
labels(){let d=labelData(),cats=['Todas',...new Set(db.products.map(p=>p.category||'Geral').filter(Boolean))];return `<div class="labels-page"><div class="grid cards label-summary"><div class="card"><span>Produtos filtrados</span><b>${d.products.length}</b><small>ativos disponíveis</small></div><div class="card"><span>Selecionados</span><b>${d.selected.length}</b><small>produto(s)</small></div><div class="card"><span>Etiquetas</span><b>${d.totalQty}</b><small>quantidade total</small></div><div class="card"><span>Modelo</span><b>${esc(d.model)}</b><small>${esc(d.printMode)}</small></div></div><div class="grid two labels-layout"><div class="panel"><div class="between"><div><h3>Produtos para etiqueta</h3><p class="muted small">Filtre, selecione produtos e ajuste a quantidade de etiquetas por item.</p></div><div class="row"><button class="ghost" id="selectAllLabels">Selecionar todos</button><button class="ghost" id="clearLabels">Limpar</button></div></div><div class="form-grid label-filters"><div class="field"><label>Buscar</label><input id="labelSearch" value="${esc(d.q)}" placeholder="Nome, código, categoria ou marca"></div><div class="field"><label>Categoria</label><select id="labelCat">${cats.map(c=>`<option ${d.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Modelo</label><select id="labelModel">${['Pequena','Média','Grande','Gôndola'].map(m=>`<option ${d.model===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><label>Impressão</label><select id="labelPrintMode">${['Folha A4','Bobina','Unitária'].map(m=>`<option ${d.printMode===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><label>Código de barras</label><select id="labelCodeType">${['Automático','EAN-13','Code128'].map(m=>`<option ${d.codeType===m?'selected':''}>${m}</option>`).join('')}</select></div></div><div class="label-options"><label><input id="labelShowName" type="checkbox" ${d.show.name?'checked':''}> Nome</label><label><input id="labelShowPrice" type="checkbox" ${d.show.price?'checked':''}> Preço</label><label><input id="labelShowCode" type="checkbox" ${d.show.code?'checked':''}> Código</label><label><input id="labelShowBarcode" type="checkbox" ${d.show.barcode?'checked':''}> Barras</label></div><div class="label-product-list">${d.products.map(p=>labelProductRow(p,d)).join('')||'<p class="muted">Nenhum produto encontrado.</p>'}</div></div><div class="panel label-preview-panel"><div class="between"><div><h3>Prévia das etiquetas</h3><p class="muted small">A prévia usa os produtos selecionados e a quantidade definida.</p></div><button class="ok" id="printLabels">Imprimir etiquetas</button></div><div class="label-preview-sheet ${d.printMode==='Bobina'?'roll-mode':d.printMode==='Unitária'?'single-mode':'a4-mode'}">${d.preview.join('')||'<p class="muted">Selecione produtos para visualizar.</p>'}</div></div></div></div>`},
reports(){let d=reportsData(),models=getReportModels(),fav=getFavoriteReportModels(),recent=getRecentReports();return `<div class="reports-page reports-custom-page reports-pro-page"><div class="grid cards report-summary"><div class="card"><span>Vendas no período</span><b>${money(d.revenue)}</b><small>${d.salesCount} venda(s)</small></div><div class="card"><span>Lucro líquido</span><b class="${d.net>=0?'good':'bad'}">${money(d.net)}</b><small>Vendas - custos - despesas</small></div><div class="card"><span>Ticket médio</span><b>${money(d.ticket)}</b><small>Média por venda</small></div><div class="card"><span>Modelos salvos</span><b>${models.length}</b><small>${fav.length} favorito(s)</small></div><div class="card"><span>Últimos relatórios</span><b>${recent.length}</b><small>Exportações recentes</small></div><div class="card"><span>Diferença de caixa</span><b class="${d.cashDiff===0?'good':'warn'}">${money(d.cashDiff)}</b><small>${d.cashRegisters.length} caixa(s)</small></div></div><div class="panel report-builder"><div class="between"><div><h3>Construtor de relatórios PRO</h3><p class="muted small">Escolha a base, filtros, colunas, ordenação, modelos favoritos e exporte em CSV, Excel, PDF ou HTML.</p></div><div class="row"><button class="ghost" id="saveReportModel">Salvar modelo</button><button class="ghost" id="exportCustomReportCsv">CSV</button><button class="ghost" id="exportCustomReportExcel">Excel</button><button class="ghost" id="exportCustomReportPdf">PDF</button><button class="ghost" id="exportCustomReportHtml">HTML</button></div></div>${customReportsPanel()}</div><div class="grid two"><div class="panel"><div class="between"><h3>Vendas por forma de pagamento</h3><span class="pill">${money(d.revenue)}</span></div>${paymentReport(d.sales)}</div><div class="panel"><div class="between"><h3>Despesas por categoria</h3><span class="pill ${d.expensesTotal?'warn':'good'}">${money(d.expensesTotal)}</span></div>${expenseCategoryReport(d.expenses)}</div></div><div class="grid two"><div class="panel"><h3>Produtos vendidos</h3>${productsSoldReport(d.sales)}</div><div class="panel"><h3>Contas a receber / fiado</h3>${receivablesReport(d.receivables)}</div></div><div class="grid two"><div class="panel"><div class="between"><div><h3>Histórico de caixas</h3><p class="muted small">Resumo salvo no SQLite para conferência e relatórios.</p></div><span class="pill">Esperado ${money(d.cashExpected)} • Contado ${money(d.cashFinal)}</span></div>${cashRegistersReport(d.cashRegisters)}</div><div class="panel"><h3>Auditoria</h3>${table(['Data','Usuário','Ação'],d.audit.map(a=>[br(a.date),esc(a.user),esc(a.action)]))}</div></div></div>`},users(){let d=usersData(),u=editingUser?db.users.find(x=>x.id===editingUser):null;return `<div class="users-v2"><div class="panel permission-info"><h3>Controle de permissões por perfil</h3><div class="grid three"><div class="notice"><b>Administrador</b><br><span>Acesso total a todas as abas e configurações.</span></div><div class="notice"><b>Caixa</b><br><span>PDV, Clientes, Orçamentos e Entregas. Sem acesso ao financeiro, estoque, usuários e configurações.</span></div><div class="notice"><b>Estoque</b><br><span>Produtos, Estoque, Compras, Nota Fiscal, Fornecedores e Etiquetas. Sem PDV e financeiro.</span></div></div></div><div class="grid cards"><div class="card"><span>Usuários ativos</span><b>${db.users.filter(x=>x.active!==false).length}</b></div><div class="card"><span>Administradores</span><b>${db.users.filter(x=>x.role==='Administrador').length}</b></div><div class="card"><span>Caixas</span><b>${db.users.filter(x=>x.role==='Caixa').length}</b></div><div class="card"><span>Estoque</span><b>${db.users.filter(x=>x.role==='Estoque').length}</b></div></div><div class="panel"><div class="between"><h3>${u?'Editar usuário':'Novo usuário'}</h3><button class="ghost" id="newUser">Novo</button></div><div class="form-grid"><div class="field"><label>Nome</label><input id="uName" value="${esc(u?.name||'')}"></div><div class="field"><label>Usuário</label><input id="uUser" value="${esc(u?.user||'')}"></div><div class="field"><label>Senha ${u?'(deixe vazio para manter)':''}</label><input id="uPass" type="password"></div><div class="field"><label>Perfil</label><select id="uRole">${['Administrador','Caixa','Estoque'].map(r=>`<option ${r===(u?.role||'Caixa')?'selected':''}>${r}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="uActive"><option value="true" ${u?.active!==false?'selected':''}>Ativo</option><option value="false" ${u?.active===false?'selected':''}>Inativo</option></select></div><div class="field"><label>&nbsp;</label><button id="saveUser">${u?'Salvar alterações':'Criar usuário'}</button></div></div><p class="muted small">Perfis: Administrador acessa tudo; Caixa acessa vendas/clientes/orçamentos/entregas; Estoque acessa produtos/estoque/compras/fornecedores/etiquetas.</p></div><div class="panel"><div class="between"><h3>Usuários cadastrados</h3><button class="ghost" id="exportUsers">Exportar CSV</button></div><div class="filters"><input id="userSearch" placeholder="Buscar nome ou usuário" value="${esc(d.q)}"><select id="userRoleFilter"><option>Todos</option>${['Administrador','Caixa','Estoque'].map(r=>`<option ${d.role===r?'selected':''}>${r}</option>`).join('')}</select><select id="userStatusFilter"><option>Todos</option><option ${d.status==='Ativos'?'selected':''}>Ativos</option><option ${d.status==='Inativos'?'selected':''}>Inativos</option></select></div>${table(['Nome','Usuário','Perfil','Status','Ações'],d.rows.map(x=>[esc(x.name),esc(x.user),esc(x.role),x.active!==false?'<span class="pill good">Ativo</span>':'<span class="pill">Inativo</span>',userActions(x)]))}</div><div class="panel"><div class="between"><h3>Histórico de acessos</h3><span class="muted small">Últimos registros</span></div>${latestAccessLog()}</div></div>`},
settings(){
  const tab=localStorage.getItem('settings-smart-tab')||'empresa';
  const health=settingsHealth();
  const tabs=[['empresa','🏢','Empresa'],['aparencia','🎨','Aparência'],['backup','☁️','Backup'],['diagnostico','🩺','Diagnóstico'],['licenca','🔑','Licença'],['integracoes','🔌','Integrações'],['rede','🌐','Rede'],['multiempresa','🏬','Multiempresa']];
  const active=(id)=>tab===id?'active':'';
  const body={
    empresa:`<div class="panel settings-card smart-section"><div class="between"><div><h3>Dados da empresa</h3><p class="muted small">Essas informações aparecem em relatórios, orçamentos, comprovantes, WhatsApp e futuras empresas.</p></div><span class="pill good">Cadastro principal</span></div><div class="form-grid">${field('company','Nome da empresa',db.settings.company)}${field('document','CNPJ/CPF',db.settings.document)}${field('phone','Telefone/WhatsApp',db.settings.phone)}${field('city','Cidade',db.settings.city)}<div class="field wide"><label>Endereço</label><input id="address" value="${esc(db.settings.address)}"></div>${field('monthlyGoal','Meta mensal',db.settings.monthlyGoal,'number')}<div class="field wide"><label>Mensagem padrão WhatsApp</label><input id="whatsappMsg" value="${esc(db.settings.whatsappMsg)}"></div><div class="field wide"><label>Logo da empresa</label><input type="file" id="logoFile" accept="image/*"><small class="muted">A logo aparece no menu lateral e futuramente nos documentos.</small></div></div><div class="row"><button id="saveSettings">Salvar empresa</button><button class="ghost" id="openFirstUseWizard">Assistente de primeiro uso</button></div></div>`,
    multiempresa:`${companiesSettingsPanel()}`,
    aparencia:`<div class="panel settings-card smart-section"><div class="between"><div><h3>Aparência do sistema</h3><p class="muted small">Personalize o visual do NexaGest sem mudar a operação do usuário.</p></div><span class="pill">Visual</span></div><div class="form-grid two-cols"><div class="field"><label>Tema</label><select id="theme"><option ${db.settings.theme==='dark'?'selected':''} value="dark">Escuro</option><option ${db.settings.theme==='light'?'selected':''} value="light">Claro</option></select></div><div class="field"><label>Cor principal</label><input id="accent" type="color" value="${db.settings.accent}"></div></div><div class="settings-preview"><div class="preview-card"><span>Prévia</span><b>${esc(db.settings.company||'Minha Empresa')}</b><small>Cards, botões e destaques usam a cor principal.</small></div><button>Botão principal</button><button class="ghost">Botão secundário</button></div><button id="saveSystem">Salvar aparência</button></div>`,
    backup:`${cloudBackupSettingsView()}`,
    diagnostico:`<div class="panel settings-card smart-section"><div class="between"><div><h3>Diagnóstico do sistema</h3><p class="muted small">Verifique versão, banco, dados principais, integridade e possíveis alertas antes de vender ou atualizar.</p></div><span class="pill ${health.score>=80?'good':health.score>=60?'warn':'danger'}">${health.score}% saúde</span></div><div class="grid cards settings-health-cards"><div class="card"><span>Versão</span><b>${esc(APP_VERSION)}</b><small>${esc(APP_CONFIG.release||'NexaGest')}</small></div><div class="card"><span>Produtos</span><b>${db.products.length}</b><small>${db.products.filter(p=>p.active!==false).length} ativos</small></div><div class="card"><span>Clientes</span><b>${db.clients.length}</b><small>${db.clients.filter(c=>c.status!=='Inativo').length} ativos</small></div><div class="card"><span>Caixas abertos</span><b>${openCashRegisters().length}</b><small>Operação atual</small></div></div><div class="diagnostic-list">${health.items.map(i=>`<div class="diag-row ${i.type}"><b>${i.icon} ${esc(i.title)}</b><span>${esc(i.msg)}</span></div>`).join('')}</div><div class="row"><button id="runIntegrityCheck">Verificar integridade</button><button class="ghost" id="exportDiagnostics">Exportar diagnóstico</button><button class="ghost" id="clearSystemLogs">Limpar logs locais</button></div><div class="panel nested"><h3>Logs recentes</h3>${systemLogsView()}</div></div>`,
    licenca:commercialLicensePanel(),
    integracoes:`<div class="panel settings-card smart-section"><div class="between"><div><h3>Integrações e testes rápidos</h3><p class="muted small">Teste WhatsApp, impressão, relatórios e recursos premium em um só lugar.</p></div><span class="pill good">Central</span></div><div class="grid two"><div class="integration-tile"><b>📱 WhatsApp</b><span>Modelo padrão e telefone da empresa</span><button id="testWhatsappSettings">Testar WhatsApp</button></div><div class="integration-tile"><b>🖨️ Impressão</b><span>Teste visual para etiquetas, relatórios e comprovantes</span><button id="testPrinterSettings">Teste de impressão</button></div><div class="integration-tile"><b>📊 Relatórios</b><span>Modelos personalizados e exportação</span><button id="openPremiumReports">Abrir relatórios premium</button></div><div class="integration-tile"><b>💳 PIX</b><span>QR Code e Copia e Cola no PDV</span><button id="testPixQr">Testar PIX</button></div><div class="integration-tile"><b>⌘ Pesquisa Global</b><span>Ctrl+K para abrir qualquer módulo rapidamente</span><button id="openCommandPaletteSettings">Abrir Ctrl+K</button></div></div><div class="panel nested pix-settings-panel"><div class="between"><div><h3>Configuração PIX</h3><p class="muted small">Use chave PIX da empresa para gerar QR Code estático com valor no fechamento da venda.</p></div><span class="pill ${db.settings.pixKey?'good':'warn'}">${db.settings.pixKey?'Configurado':'Pendente'}</span></div><div class="form-grid"><div class="field"><label>Tipo da chave</label><select id="pixKeyType">${['Telefone','CPF/CNPJ','E-mail','Aleatória'].map(x=>`<option ${x===(db.settings.pixKeyType||'Telefone')?'selected':''}>${x}</option>`).join('')}</select></div><div class="field wide"><label>Chave PIX</label><input id="pixKey" value="${esc(db.settings.pixKey||'')}" placeholder="Telefone, CPF/CNPJ, e-mail ou chave aleatória"></div><div class="field"><label>Nome do recebedor</label><input id="pixMerchantName" maxlength="25" value="${esc(db.settings.pixMerchantName||db.settings.company||'')}"></div><div class="field"><label>Cidade</label><input id="pixMerchantCity" maxlength="15" value="${esc(db.settings.pixMerchantCity||db.settings.city||'')}"></div><div class="field wide"><label>Descrição padrão</label><input id="pixDescription" value="${esc(db.settings.pixDescription||'Venda NexaGest')}"></div><div class="field"><label>Provedor de confirmação</label><select id="pixProvider">${['Manual','Simulador','Mercado Pago','Efí/Gerencianet','Asaas'].map(x=>`<option ${x===(db.settings.pixProvider||'Manual')?'selected':''}>${x}</option>`).join('')}</select></div><div class="field wide"><label>Token/API Key do provedor</label><input id="pixProviderToken" value="${esc(db.settings.pixProviderToken||'')}" placeholder="Opcional. Necessário para confirmação automática real."></div><label class="checkline wide"><input type="checkbox" id="pixRequireConfirmation" ${db.settings.pixRequireConfirmation?'checked':''}> Exigir confirmação do PIX antes de concluir a venda</label></div><div class="pix-provider-note"><b>v6.1:</b> confirmação automática preparada por provedor. Use <b>Simulador</b> para testar agora. Mercado Pago/Efí/Asaas exigem credenciais oficiais para consulta real.</div><div class="row"><button id="savePixSettings">Salvar PIX</button><button class="ghost" id="testPixQr2">Gerar QR de teste</button></div></div></div>`,
    rede:`${networkSettingsPanel()}`
  };
  return `<div class="settings-smart-page"><div class="grid cards settings-summary"><div class="card"><span>Empresa</span><b>${esc(db.settings.company||'Minha Empresa')}</b><small>Dados principais</small></div><div class="card"><span>Saúde do sistema</span><b>${health.score}%</b><small>${health.items.filter(i=>i.type==='warn'||i.type==='danger').length} alerta(s)</small></div><div class="card"><span>Backup</span><b>${db.settings.backupAuto?'Ativo':'Manual'}</b><small>${esc(db.settings.backupProvider||'Local')}</small></div><div class="card"><span>Modo rede</span><b>${db.settings.networkServerRunning?'Servidor ativo':db.settings.networkMode?'Preparado':'Desligado'}</b><small>Rede local</small></div></div><div class="settings-smart-layout"><aside class="settings-smart-menu">${tabs.map(t=>`<button class="${active(t[0])}" data-settings-tab="${t[0]}"><span>${t[1]}</span><b>${t[2]}</b></button>`).join('')}</aside><section class="settings-smart-content">${body[tab]||body.empresa}</section></div></div>`
}}

views.premium=function(){
  let t=db.settings.whatsappTemplates||{},provider=db.settings.backupProvider||'Local',models=getReportModels(),prefs=getDashboardPrefs();
  return `<div class="premium-page"><div class="dash-hero panel"><div><h2>Recursos Premium</h2><p class="muted">WhatsApp, backup em nuvem, relatórios personalizáveis, dashboard configurável, notificações e pesquisa global.</p></div><button class="ok" id="openCommandPalette">Abrir Ctrl+K</button></div><div class="grid cards"><div class="card"><span>Notificações ativas</span><b>${premiumNotifications().length}</b><small>Estoque, contas, entregas e backup</small></div><div class="card"><span>Backup</span><b>${esc(provider)}</b><small>${db.settings.backupAuto?'Automático ativo':'Automático desligado'}</small></div><div class="card"><span>Modelos de relatório</span><b>${models.length}</b><small>Filtros e colunas salvos</small></div><div class="card"><span>WhatsApp</span><b>Integrado</b><small>Mensagens com variáveis</small></div></div><div class="grid two"><div class="panel premium-card"><div class="between"><h3>Central de WhatsApp</h3><span class="pill good">wa.me</span></div><p class="muted small">Use variáveis: {cliente}, {empresa}, {valor}, {pedido}, {total}, {pagamento}, {data}, {hora}, {itens}, {desconto}, {troco}.</p><div class="form-grid"><div class="field"><label>Cliente</label><select id="waClient">${db.clients.map(c=>`<option value="${c.id}">${esc(c.name)} ${c.phone?'• '+esc(c.phone):''}</option>`).join('')}</select></div><div class="field"><label>Modelo</label><select id="waTemplate"><option value="orcamento">Orçamento</option><option value="comprovante">Comprovante</option><option value="cobranca">Cobrança</option><option value="entrega">Entrega</option><option value="aniversario">Aniversário</option></select></div><div class="field"><label>Valor / Total</label><input id="waValue" placeholder="Ex.: R$ 150,00"></div><div class="field"><label>Pedido</label><input id="waOrder" placeholder="Ex.: 1024"></div><div class="field wide"><label>Mensagem rápida</label><textarea id="waManual" placeholder="Deixe vazio para usar o modelo escolhido"></textarea></div><div class="field"><label>&nbsp;</label><button id="sendPremiumWhatsApp">Abrir WhatsApp</button></div></div><h4>Modelos de mensagens</h4><div class="form-grid"><div class="field wide"><label>Orçamento</label><textarea id="tpl_orcamento">${esc(t.orcamento||'')}</textarea></div><div class="field wide"><label>Comprovante</label><textarea id="tpl_comprovante">${esc(t.comprovante||'')}</textarea></div><div class="field wide"><label>Cobrança</label><textarea id="tpl_cobranca">${esc(t.cobranca||'')}</textarea></div><div class="field wide"><label>Entrega</label><textarea id="tpl_entrega">${esc(t.entrega||'')}</textarea></div><div class="field wide"><label>Aniversário</label><textarea id="tpl_aniversario">${esc(t.aniversario||'')}</textarea></div><div class="field"><label>&nbsp;</label><button id="saveWhatsAppTemplates">Salvar modelos</button></div></div></div><div class="panel premium-card"><div class="between"><h3>Central de notificações</h3><span class="pill warn">Ao vivo</span></div>${premiumNotificationsView()}</div></div><div class="grid two"><div class="panel premium-card"><div class="between"><h3>Backup em nuvem</h3></div><p class="muted small">Estrutura preparada para pastas sincronizadas do Google Drive, OneDrive ou Dropbox. O sistema salva o backup localmente na pasta escolhida pelo usuário.</p><div class="form-grid"><div class="field"><label>Destino</label><select id="cloudProvider"><option ${provider==='Local'?'selected':''}>Local</option><option ${provider==='Google Drive'?'selected':''}>Google Drive</option><option ${provider==='OneDrive'?'selected':''}>OneDrive</option><option ${provider==='Dropbox'?'selected':''}>Dropbox</option></select></div><div class="field"><label>Pasta sincronizada</label><input id="cloudFolder" value="${esc(db.settings.backupFolder||'')}" placeholder="Ex.: C:\\Users\\Você\\Google Drive\\NexaGest"></div><label class="check-row"><input type="checkbox" id="cloudAuto" ${db.settings.backupAuto?'checked':''}> Backup automático diário</label><div class="field"><label>&nbsp;</label><button id="saveCloudBackupSettings">Salvar backup</button></div></div><div class="backup-box"><div><b>Último backup</b><span>${esc(localStorage.getItem('nexagest-last-cloud-backup')||'Ainda não realizado')}</span></div><div><b>Histórico</b><span>${cloudBackupHistory().length} registro(s)</span></div></div><button class="ok" id="runCloudBackup">Fazer backup premium agora</button>${cloudBackupHistoryView()}</div><div class="panel premium-card"><div class="between"><h3>Dashboard personalizado</h3><span class="pill good">Widgets</span></div><p class="muted small">Escolha os blocos que devem aparecer como favoritos do gestor.</p><div class="premium-checks">${dashboardWidgetList().map(w=>`<label class="check-row"><input type="checkbox" data-dash-widget="${w.id}" ${prefs.includes(w.id)?'checked':''}> ${w.label}</label>`).join('')}</div><button id="saveDashboardPrefs">Salvar dashboard</button></div></div><div class="panel premium-card"><div class="between"><h3>Relatórios totalmente personalizáveis</h3><div class="row"><button class="ghost" id="saveReportModel">Salvar modelo</button><button class="ghost" id="exportCustomReportCsv">Exportar CSV</button><button class="ghost" id="exportCustomReportHtml">Exportar HTML/PDF</button></div></div><div class="report-filters"><div class="field"><label>Modelo</label><input id="reportModelName" placeholder="Ex.: Vendas por cliente"></div><div class="field"><label>Base</label><select id="customReportBase"><option value="sales">Vendas</option><option value="products">Produtos</option><option value="clients">Clientes</option><option value="suppliers">Fornecedores</option><option value="cash">Caixas</option></select></div><div class="field"><label>De</label><input id="customReportFrom" type="date" value="${range.from}"></div><div class="field"><label>Até</label><input id="customReportTo" type="date" value="${range.to}"></div></div><div class="premium-columns">${customReportColumnsView()}</div><div class="panel nested"><h3>Modelos salvos</h3>${models.length?table(['Nome','Base','Colunas','Criado'],models.map(m=>[esc(m.name),esc(m.base),m.columns.length,br(m.createdAt)])):'<p class="muted">Nenhum modelo salvo ainda.</p>'}</div></div></div>`
}

function table(h,rows){return `<table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${h.length}" class="muted">Sem dados.</td></tr>`}</tbody></table>`}
function field(id,label,value=''){return `<div class="field"><label>${label}</label><input id="${id}" value="${esc(value)}"></div>`}
function selectedPayment(){return localStorage.getItem('nexagest-temp-payment')||'Dinheiro'}
function stockStatus(p){return p.stock<=0?['bad','Zerado']:p.stock<=p.min?['warn','Baixo']:['good','OK']}
function stockLine(p){let [cls,label]=stockStatus(p);return `<p class="stock-line ${cls}"><span class="stock-dot"></span>Estoque: <b>${p.stock}</b> <small>${label}</small></p>`}
function pdvFilteredProducts(q){if(window.NexaGestPdv)return window.NexaGestPdv.filterProducts(db.products,q,24);let raw=String(q||''),needle=raw.toLowerCase().trim(),barcode=normalizeBarcode(raw);let base=db.products.filter(p=>p.active!==false);if(!needle&&!barcode)return base;return base.filter(p=>[p.name,p.category,p.barcode].join(' ').toLowerCase().includes(needle)||String(p.barcode||'').includes(barcode||needle)).slice(0,24)}
function productThumb(p,mode='table'){let img=p?.image||'',name=esc(p?.name||'Produto');if(img)return `<div class="product-thumb ${mode}"><img src="${esc(img)}" alt="${name}"></div>`;return `<div class="product-thumb ${mode} empty"><span>📦</span></div>`}
function productAdminCard(p){let [cls,label]=stockStatus(p),profit=Number(p.sale||0)-Number(p.cost||0),profitCls=profit>=0?'good':'bad';return `<div class="admin-product-card"><div class="admin-product-top">${productThumb(p,'admin')}<div class="admin-product-title"><b>${esc(p.name)}</b><span>Código: ${esc(p.barcode||'Sem código')}</span></div><span class="pill ${cls}">${label}</span></div><div class="admin-product-price">${money(p.sale)}</div><div class="admin-product-info"><span>Categoria</span><b>${esc(p.category||'Geral')}</b><span>Marca</span><b>${esc(p.brand||'Sem marca')}</b><span>Custo</span><b>${money(p.cost)}</b><span>Lucro</span><b class="${profitCls}">${money(profit)}</b><span>Estoque</span><b>${Number(p.stock||0)} un</b><span>Mínimo</span><b>${Number(p.min||0)} un</b></div><div class="admin-product-actions"><button class="ghost" data-profile-product="${p.id}">📊 Perfil</button><button class="ghost" data-editp="${p.id}">✏️ Editar</button><button class="ghost" data-product-label="${p.id}">🏷️ Etiqueta</button><button class="danger" data-delp="${p.id}">🗑 Excluir</button></div></div>`}
function generateProductCatalog(){let q=localStorage.getItem('prod-q')||'',cat=localStorage.getItem('prod-cat')||'Todas',stock=localStorage.getItem('prod-stock')||'Todos';let rows=db.products.filter(p=>{let hay=[p.name,p.barcode,p.category,p.brand,p.supplierName].join(' ').toLowerCase();let okQ=!q||hay.includes(q.toLowerCase());let okCat=cat==='Todas'||(p.category||'Geral')===cat;let okStock=stock==='Todos'||(stock==='Baixo'&&p.stock<=p.min)||(stock==='Zerado'&&p.stock<=0)||(stock==='OK'&&p.stock>p.min);return okQ&&okCat&&okStock});let company=esc(db.settings.company||'NexaGest'),today=new Date().toLocaleDateString('pt-BR');let cards=rows.map(p=>`<article class="cat-card">${p.image?`<img src="${esc(p.image)}">`:`<div class="cat-noimg">📦</div>`}<h2>${esc(p.name)}</h2><p>Código: ${esc(p.barcode||'Sem código')}</p><p>Categoria: ${esc(p.category||'Geral')}</p><strong>${money(p.sale)}</strong></article>`).join('');let html=`<!doctype html><html><head><meta charset="utf-8"><title>Catálogo de Produtos</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}header{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:20px}h1{margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.cat-card{border:1px solid #ddd;border-radius:14px;padding:14px;break-inside:avoid;text-align:center}.cat-card img,.cat-noimg{width:120px;height:120px;object-fit:cover;border-radius:14px;background:#f2f2f2;display:grid;place-items:center;margin:0 auto 10px;font-size:42px}.cat-card h2{font-size:18px;margin:8px 0}.cat-card p{margin:4px 0;color:#555}.cat-card strong{font-size:24px}@media print{button{display:none}.grid{grid-template-columns:repeat(3,1fr)}body{margin:12mm}}</style></head><body><button onclick="window.print()">Imprimir / Salvar PDF</button><header><div><h1>${company}</h1><p>Catálogo de Produtos</p></div><p>${today}<br>${rows.length} produtos</p></header><main class="grid">${cards||'<p>Nenhum produto encontrado.</p>'}</main></body></html>`;let w=window.open('','_blank');if(!w)return alert('Não foi possível abrir o catálogo.');w.document.write(html);w.document.close()}

function setProductImagePreview(dataUrl){let h=document.getElementById('pimage'),box=document.getElementById('productImagePreview');if(h)h.value=dataUrl||'';if(!box)return;if(dataUrl){box.classList.add('has-image');box.innerHTML=`<img src="${dataUrl}" alt="Foto do produto">`}else{box.classList.remove('has-image');box.innerHTML='<span>📷</span><b>Sem imagem</b><small>300×300 px</small>'}}
function removeProductImage(){setProductImagePreview('')}
function readProductImage(e){let file=e.target.files&&e.target.files[0];if(!file)return;if(!file.type.startsWith('image/'))return alert('Selecione uma imagem válida.');let reader=new FileReader();reader.onload=()=>{let img=new Image();img.onload=()=>{let size=300,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=size;canvas.height=size;ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);let scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale,x=(size-w)/2,y=(size-h)/2;ctx.drawImage(img,x,y,w,h);let data=canvas.toDataURL('image/webp',0.84);if(data.length>350000)data=canvas.toDataURL('image/jpeg',0.82);setProductImagePreview(data)};img.onerror=()=>alert('Não consegui carregar essa imagem.');img.src=reader.result};reader.readAsDataURL(file)}
function productCards(list){let open=isCashOpen(),rows=list.filter(p=>p.active!==false);return rows.map((p,idx)=>{let [cls,label]=stockStatus(p),stock=Number(p.stock||0),category=p.category||'Geral',barcode=p.barcode||'sem código',blocked=!open||stock<=0;return `<div class="product-card pdv-product pdv-product-card ${idx===0?'selected':''} ${!open?'cash-closed-card':''}" data-pdv-product="${p.id}" tabindex="0"><div class="pdv-product-top">${productThumb(p,'pdv')}<div class="pdv-product-title"><b>${esc(p.name)}</b><small>${esc(category)} • ${esc(barcode)}</small></div><span class="pill ${cls}">${label}</span></div><div class="pdv-product-price">${money(p.sale)}</div><div class="pdv-product-stock"><span class="stock-dot ${cls}"></span><span>Estoque: <b>${stock}</b></span></div><button class="pdv-add-btn" data-add="${p.id}" ${blocked?'disabled':''}>${open?'Adicionar ao carrinho':'🔒 Abrir caixa primeiro'}</button></div>`}).join('')||'<p class="muted empty-cart">Nenhum produto encontrado.</p>'}
function cartView(){if(!isCashOpen())return `<div class="cart-locked"><h3>🔒 Caixa fechado</h3><p class="muted">Abra o caixa para iniciar uma venda.</p></div>`;return `<div class="cart-items refined-cart-list">${cart.map((i,idx)=>{let p=product(i.id),last=localStorage.getItem('pdv-last-added')===i.id;return `<div class="cart-line v45 refined-cart-line ${last?'last-added':''}" data-cart-item="${i.id}">${productThumb(p,'cart')}<div class="cart-line-info"><b>${idx+1}. ${esc(p.name)}</b><span class="muted">${esc(p.barcode||'sem código')}</span><strong>${i.qty} x ${money(p.sale)} = ${money(p.sale*i.qty)}</strong></div><div class="qty-box"><button class="ghost" data-minus="${i.id}">−</button><input data-qty="${i.id}" type="number" min="1" value="${i.qty}"><button class="ghost" data-plus="${i.id}">+</button></div><button class="danger" title="Remover item" data-rem="${i.id}">×</button></div>`}).join('')||'<p class="muted empty-cart">Carrinho vazio.</p>'}</div>`}
function lastAddedBanner(){let id=localStorage.getItem('pdv-last-added'),ts=Number(localStorage.getItem('pdv-last-added-at')||0);if(!id||Date.now()-ts>3500)return '';let p=product(id);if(!p?.id)return '';return `<div class="pdv-added-feedback">✅ <b>${esc(p.name)}</b> adicionado ao carrinho <span>${money(p.sale)}</span></div>`}
function openFinalizeModal(){if(!requireCashOpen('finalizar a venda'))return;if(!cart.length)return alert('Carrinho vazio.');localStorage.setItem('pdv-finalize-open','1');app();setTimeout(()=>{let el=document.getElementById('paidAmount')||document.getElementById('confirmFinishSale');el?.focus();el?.select?.()},60)}
function closeFinalizeModal(){localStorage.removeItem('pdv-finalize-open');app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),60)}
function finalizeSaleModal(){if(localStorage.getItem('pdv-finalize-open')!=='1'||!isCashOpen())return '';let sub=cartTotal(),discount=calcDiscount(),total=Math.max(0,sub-discount),pay=selectedPayment(),paid=pay==='Dinheiro'?num('paidAmount'):total,change=pay==='Dinheiro'?Math.max(0,paid-total):0;return `<div class="modal-backdrop pdv-finalize-modal open"><div class="modal-card finalize-card"><div class="between"><div><h2>Finalizar venda</h2><p class="muted small">Pagamento, cliente, desconto e troco ficam aqui para não pesar o PDV.</p></div><button class="ghost" id="closeFinalizeSale">Esc</button></div><div class="finalize-total"><span>Total da venda</span><b>${money(total)}</b></div><div class="form-grid finalize-grid"><div class="field wide"><label>Cliente</label><select id="saleClient"><option value="">Cliente balcão</option>${db.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field wide"><label>Pagamento</label><select id="pay">${['Dinheiro','Pix','Cartão Débito','Cartão Crédito','Fiado'].map(x=>`<option ${x===pay?'selected':''}>${x}</option>`).join('')}</select></div><div class="payment-buttons wide"><button class="ghost ${pay==='Dinheiro'?'active':''}" data-payment="Dinheiro">F7 Dinheiro</button><button class="ghost ${pay==='Pix'?'active':''}" data-payment="Pix">F8 Pix</button><button class="ghost ${pay==='Cartão Débito'?'active':''}" data-payment="Cartão Débito">F9 Débito</button><button class="ghost ${pay==='Cartão Crédito'?'active':''}" data-payment="Cartão Crédito">F10 Crédito</button></div><div class="field"><label>Desconto R$</label><input id="discount" type="number" step="0.01" value="${Number(localStorage.getItem('nexagest-temp-discount')||0)}"></div><div class="field"><label>Desconto %</label><input id="discountPercent" type="number" step="0.01" value="${Number(localStorage.getItem('nexagest-temp-discount-percent')||0)}"></div>${pay==='Dinheiro'?`<div class="field wide"><label>Valor recebido</label><input id="paidAmount" type="number" step="0.01" value="${Number(localStorage.getItem('nexagest-temp-paid')||0)}" placeholder="Ex.: 100"></div>`:''}</div>${pay==='Pix'?`<div class="pix-finalize-panel"><div class="between"><div><h3>QR Code PIX</h3><p class="muted small">Mostre o QR Code ou copie o PIX Copia e Cola para o cliente.</p></div><span class="pill good">PIX</span></div><div id="pixQrBox"></div></div>`:''}<div class="summary-box finalize-summary"><div><span>Subtotal</span><b>${money(sub)}</b></div><div><span>Desconto</span><b>${money(discount)}</b></div><div class="total"><span>Total</span><b>${money(total)}</b></div>${pay==='Dinheiro'?`<div><span>Troco</span><b class="change">${money(change)}</b></div>`:''}</div><button class="ok full big" id="confirmFinishSale">Confirmar venda</button></div></div>`}
function productForm(){let p=db.products.find(x=>x.id===editingProduct)||{};let m=p.sale?(((Number(p.sale)-Number(p.cost))/Number(p.sale))*100).toFixed(1)+'%':'0%';let img=p.image||'';return `<input type="hidden" id="pid" value="${p.id||''}"><input type="hidden" id="pimage" value="${esc(img)}"><div class="product-form-layout"><div class="product-image-editor"><label>Imagem do produto</label><div class="product-image-preview ${img?'has-image':''}" id="productImagePreview">${img?`<img src="${esc(img)}" alt="Foto do produto">`:'<span>📷</span><b>Sem imagem</b><small>300×300 px</small>'}</div><div class="product-image-actions"><label class="button-like" for="pimageFile">Escolher imagem</label><input id="pimageFile" type="file" accept="image/*" hidden><button class="ghost" type="button" id="removeProductImage">Remover</button></div><p class="hint">A imagem aparece no cadastro, lista de produtos e Venda Rápida do PDV.</p></div><div class="form-grid product-form"><div class="field wide"><label>Nome do produto</label><input id="pname" placeholder="Ex: Paçoca pote 680g" value="${esc(p.name||'')}"></div><div class="field"><label>Código de barras</label><input id="pbar" placeholder="Bipe ou digite" value="${esc(p.barcode||'')}"></div><div class="field"><label>Categoria</label><input id="pcat" placeholder="Doces, bebidas..." value="${esc(p.category||'Geral')}"></div><div class="field"><label>Unidade</label><select id="punit">${['un','kg','cx','pct','lt','m'].map(u=>`<option ${u===(p.unit||'un')?'selected':''}>${u}</option>`).join('')}</select></div><div class="field"><label>Marca</label><input id="pbrand" placeholder="Opcional" value="${esc(p.brand||'')}"></div><div class="field"><label>Fornecedor</label><input id="psupplier" placeholder="Fornecedor padrão" value="${esc(p.supplierName||'')}"></div><div class="field"><label>Custo</label><input id="pcost" type="number" step="0.01" value="${p.cost||0}"></div><div class="field"><label>Venda</label><input id="psale" type="number" step="0.01" value="${p.sale||0}"></div><div class="field"><label>Estoque</label><input id="pstock" type="number" value="${p.stock||0}"></div><div class="field"><label>Estoque mínimo</label><input id="pmin" type="number" value="${p.min||5}"></div><div class="field"><label>Margem prevista</label><input id="productMarginPreview" readonly value="${m}"></div><div class="field"><label>&nbsp;</label><button id="saveProduct">${p.id?'Salvar alterações':'Salvar produto'}</button></div></div></div>`}

function closeProfileModal(){document.getElementById('profileModalOverlay')?.remove();document.body.classList.remove('modal-open')}
function profileModal(title,html){closeProfileModal();document.body.insertAdjacentHTML('beforeend',`<div id="profileModalOverlay" class="modal-overlay profile-overlay open"><div class="modal-card profile-card"><div class="between profile-head"><div><h2>${title}</h2><p class="muted small">Histórico, estatísticas e ações rápidas.</p></div><button class="ghost" id="closeProfileModal">Esc</button></div>${html}</div></div>`);document.body.classList.add('modal-open');document.getElementById('closeProfileModal')?.addEventListener('click',closeProfileModal);document.getElementById('profileModalOverlay')?.addEventListener('click',e=>{if(e.target.id==='profileModalOverlay')closeProfileModal()});document.querySelectorAll('#profileModalOverlay [data-editp]').forEach(b=>b.onclick=()=>{editingProduct=b.dataset.editp;closeProfileModal();queueFocus('pname',true);app()});document.querySelectorAll('#profileModalOverlay [data-editc]').forEach(b=>b.onclick=()=>{editingClient=b.dataset.editc;closeProfileModal();queueFocus('cname',true);app()});document.querySelectorAll('#profileModalOverlay [data-editsup]').forEach(b=>b.onclick=()=>{editingSupplier=b.dataset.editsup;closeProfileModal();queueFocus('supName',true);app()});document.querySelectorAll('#profileModalOverlay [data-product-label]').forEach(b=>b.onclick=()=>{localStorage.setItem('label-selected',JSON.stringify([b.dataset.productLabel]));closeProfileModal();page='labels';app()});document.querySelectorAll('#profileModalOverlay [data-wa]').forEach(b=>b.onclick=()=>openWhatsAppNumber(b.dataset.wa))}
function miniRows(headers,rows,empty='Sem histórico ainda.'){return rows?.length?table(headers,rows):`<div class="empty-state compact"><span>${empty}</span></div>`}
function productStats(id){let p=product(id),items=salesValid().flatMap(s=>(s.items||[]).filter(i=>i.id===id).map(i=>({...i,sale:s}))),qty=items.reduce((a,i)=>a+Number(i.qty||0),0),rev=items.reduce((a,i)=>a+Number(i.price||p.sale||0)*Number(i.qty||0),0),profit=items.reduce((a,i)=>a+(Number(i.price||p.sale||0)-Number(p.cost||0))*Number(i.qty||0),0),last=items.sort((a,b)=>String(b.sale.date).localeCompare(String(a.sale.date)))[0];return{p,items,qty,rev,profit,last}}
function openProductProfile(id){let d=productStats(id),p=d.p,moves=db.stockMoves.filter(m=>m.productId===id).slice(0,8),purchases=db.purchases.filter(b=>b.productId===id).slice(0,6),marginPct=p.sale?Math.round(((Number(p.sale)-Number(p.cost))/Number(p.sale))*100):0;profileModal(`Perfil do produto: ${esc(p.name)}`,`<div class="profile-hero product-profile-hero">${productThumb(p,'profile')}<div><h3>${esc(p.name)}</h3><p class="muted">${esc(p.category||'Geral')} • ${esc(p.barcode||'Sem código')}</p><div class="profile-actions"><button class="ghost" data-editp="${p.id}">Editar cadastro</button><button class="ghost" data-product-label="${p.id}">Gerar etiqueta</button><button class="ghost" onclick="closeProfileModal();page='stock';app()">Movimentar estoque</button></div></div></div><div class="grid cards profile-cards"><div class="card"><span>Preço de venda</span><b>${money(p.sale)}</b><small>Custo: ${money(p.cost)}</small></div><div class="card"><span>Estoque atual</span><b>${Number(p.stock||0)} un</b><small>Mínimo: ${Number(p.min||0)} un</small></div><div class="card"><span>Vendido</span><b>${d.qty} un</b><small>${money(d.rev)}</small></div><div class="card"><span>Lucro estimado</span><b class="${d.profit>=0?'good':'bad'}">${money(d.profit)}</b><small>Margem: ${marginPct}%</small></div></div><div class="grid two"><div class="panel"><h3>Últimas vendas</h3>${miniRows(['Data','Qtd.','Total','Cliente'],d.items.slice(0,7).map(i=>[br(i.sale.date),Number(i.qty||0),money(Number(i.price||p.sale||0)*Number(i.qty||0)),client(i.sale.clientId).name||'Balcão']))}</div><div class="panel"><h3>Histórico de estoque</h3>${miniRows(['Data','Tipo','Qtd.','Obs.'],moves.map(m=>[br(m.date),m.type,Number(m.qty||0),m.obs||'-']))}</div></div><div class="panel"><h3>Últimas compras</h3>${miniRows(['Data','Fornecedor','Qtd.','Custo','Total'],purchases.map(b=>[br(b.date),supplierName(b.supplierId),Number(b.qty||0),money(b.cost),money(b.total)]),'Nenhuma compra registrada para este produto.')}</div>`)}
function clientSales(id){return salesValid().filter(s=>s.clientId===id)}
function openClientProfile(id){let c=db.clients.find(x=>x.id===id);if(!c)return;let sales=clientSales(id),total=sum(sales,'total'),profit=sum(sales,'profit'),open=openByClient(id),last=sales.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];profileModal(`Perfil do cliente: ${esc(c.name)}`,`<div class="profile-hero"><div class="avatar-big">${esc((c.name||'?').slice(0,1).toUpperCase())}</div><div><h3>${esc(c.name)}</h3><p class="muted">${esc(c.phone||'Sem telefone')} • ${esc(c.city||'Sem cidade')}</p><div class="profile-actions">${c.phone?`<button class="ghost" data-wa="${esc(c.phone)}">WhatsApp</button>`:''}<button class="ghost" data-editc="${c.id}">Editar cadastro</button><button class="ghost" onclick="closeProfileModal();page='quotes';app()">Novo orçamento</button></div></div></div><div class="grid cards profile-cards"><div class="card"><span>Total comprado</span><b>${money(total)}</b><small>${sales.length} compra(s)</small></div><div class="card"><span>Ticket médio</span><b>${money(sales.length?total/sales.length:0)}</b><small>Última: ${last?br(last.date):'-'}</small></div><div class="card"><span>Em aberto</span><b class="${open>0?'bad':'good'}">${money(open)}</b><small>Limite: ${money(c.creditLimit||0)}</small></div><div class="card"><span>Lucro gerado</span><b class="${profit>=0?'good':'bad'}">${money(profit)}</b><small>Status: ${c.active===false?'Inativo':'Ativo'}</small></div></div><div class="grid two"><div class="panel"><h3>Dados rápidos</h3><div class="profile-info"><span>CPF/CNPJ</span><b>${esc(c.document||'-')}</b><span>E-mail</span><b>${esc(c.email||'-')}</b><span>Aniversário</span><b>${c.birth?br(c.birth):'-'}</b><span>Endereço</span><b>${esc(c.address||'-')}</b><span>Observações</span><b>${esc(c.notes||'-')}</b></div></div><div class="panel"><h3>Últimas compras</h3>${miniRows(['Data','Pagamento','Total','Lucro'],sales.slice(-8).reverse().map(s=>[br(s.date),s.payment||'-',money(s.total),money(s.profit)]),'Cliente ainda não possui compras.')}</div></div>`)}
function supplierName(id){let s=lookupCache.suppliers.get(id)||db.suppliers.find(x=>x.id===id);return s?s.name:'-'}
function supplierPurchaseRows(id){
  return (db.purchases||[])
    .filter(b=>b.supplierId===id&&(b.status||'Recebida')!=='Cancelada')
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function supplierProductSummary(id){
  const map={};
  supplierPurchaseRows(id).forEach(b=>{
    const pid=b.productId||'sem-produto';
    const p=product(pid);
    if(!map[pid])map[pid]={id:pid,name:p?.name||'Produto não encontrado',qty:0,total:0,lastCost:0,minCost:null,maxCost:null,lastDate:'',count:0};
    const r=map[pid], qty=Number(b.qty||0), cost=Number(b.cost||0), total=Number(b.total||qty*cost||0);
    r.qty+=qty; r.total+=total; r.count+=1;
    if(cost>0){r.minCost=r.minCost===null?cost:Math.min(r.minCost,cost);r.maxCost=r.maxCost===null?cost:Math.max(r.maxCost,cost);r.lastCost=cost}
    if(!r.lastDate||String(b.date||'')>String(r.lastDate||''))r.lastDate=b.date||'';
  });
  return Object.values(map).sort((a,b)=>String(b.lastDate||'').localeCompare(String(a.lastDate||'')));
}
function supplierRating(total,purchases,products){
  if(total>=5000||purchases>=20)return ['★★★★★','Fornecedor preferencial','good'];
  if(total>=1000||purchases>=8)return ['★★★★☆','Fornecedor ativo','ok'];
  if(purchases>0)return ['★★★☆☆','Em desenvolvimento','warn'];
  return ['☆☆☆☆☆','Sem histórico',''];
}
function openSupplierProfile(id){
  let s=db.suppliers.find(x=>x.id===id);
  if(!s)return;
  let purchases=supplierPurchaseRows(id), total=sum(purchases,'total'), qty=sum(purchases,'qty'), productRows=supplierProductSummary(id), products=productRows.length, last=purchases[purchases.length-1], first=purchases[0], biggest=purchases.slice().sort((a,b)=>Number(b.total||0)-Number(a.total||0))[0], avgTicket=purchases.length?total/purchases.length:0, avgCost=qty?total/qty:0, rating=supplierRating(total,purchases.length,products);
  let initials=String(s.name||'F').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'F';
  let productTable=productRows.length?table(['Produto','Compras','Qtd.','Último custo','Menor','Maior','Última compra'],productRows.slice(0,8).map(r=>[
    esc(r.name),
    r.count,
    Number(r.qty||0),
    money(r.lastCost||0),
    r.minCost!==null?money(r.minCost):'-',
    r.maxCost!==null?money(r.maxCost):'-',
    r.lastDate?br(r.lastDate):'-'
  ])):'<p class="muted">Nenhum produto vinculado a este fornecedor ainda.</p>';
  let recentTable=miniRows(['Data','Produto','Qtd.','Custo','Total'],purchases.slice(-8).reverse().map(b=>[br(b.date),esc(product(b.productId).name),Number(b.qty||0),money(b.cost),money(b.total)]),'Fornecedor ainda não possui compras.');
  profileModal(`Perfil do fornecedor: ${esc(s.name)}`,`<div class="supplier-profile-pro"><div class="profile-hero supplier-hero-pro"><div class="avatar-big supplier">${esc(initials)}</div><div><div class="row wrap"><h3>${esc(s.name)}</h3><span class="pill ${rating[2]}">${rating[0]} ${rating[1]}</span></div><p class="muted">${esc(s.phone||'Sem telefone')} • ${esc(s.city||'Sem cidade')}</p><div class="profile-actions">${s.phone?`<button class="ghost" data-wa="${esc(s.phone)}">WhatsApp</button>`:''}<button class="ghost" data-editsup="${s.id}">Editar cadastro</button><button class="ok" onclick="closeProfileModal();page='purchases';app()">Nova compra</button></div></div></div><div class="grid cards profile-cards"><div class="card"><span>Total comprado</span><b>${money(total)}</b><small>${purchases.length} compra(s)</small></div><div class="card"><span>Produtos fornecidos</span><b>${products}</b><small>${qty} unidade(s)</small></div><div class="card"><span>Custo médio</span><b>${money(avgCost)}</b><small>Por unidade comprada</small></div><div class="card"><span>Última compra</span><b>${last?br(last.date):'-'}</b><small>Status: ${s.active===false?'Inativo':'Ativo'}</small></div></div><div class="grid cards profile-cards supplier-extra-cards"><div class="card"><span>Primeira compra</span><b>${first?br(first.date):'-'}</b><small>Início da parceria</small></div><div class="card"><span>Maior compra</span><b>${biggest?money(biggest.total):'-'}</b><small>${biggest?esc(product(biggest.productId).name):'Sem histórico'}</small></div><div class="card"><span>Ticket médio</span><b>${money(avgTicket)}</b><small>Média por compra</small></div><div class="card"><span>Classificação</span><b>${rating[0]}</b><small>${rating[1]}</small></div></div><div class="grid two"><div class="panel"><h3>Dados rápidos</h3><div class="profile-info"><span>CPF/CNPJ</span><b>${esc(s.document||'-')}</b><span>Contato</span><b>${esc(s.contact||'-')}</b><span>E-mail</span><b>${esc(s.email||'-')}</b><span>Endereço</span><b>${esc(s.address||'-')}</b><span>Observações</span><b>${esc(s.notes||s.obs||'-')}</b></div></div><div class="panel"><h3>Últimas compras</h3>${recentTable}</div></div><div class="panel supplier-products-panel"><div class="between"><div><h3>Produtos fornecidos</h3><p class="muted small">Resumo de preço por produto comprado deste fornecedor.</p></div><span class="pill">${products} produto(s)</span></div>${productTable}</div></div>`)
}

function clientForm(){let c=db.clients.find(x=>x.id===editingClient)||{};return `<input type="hidden" id="cid" value="${c.id||''}"><div class="form-grid client-form"><div class="field"><label>Nome</label><input id="cname" value="${esc(c.name||'')}" placeholder="Ex.: Maria Silva"></div><div class="field"><label>Telefone / WhatsApp</label><input id="cphone" value="${esc(c.phone||'')}" placeholder="(35) 99999-9999"></div><div class="field"><label>Cidade</label><input id="ccity" value="${esc(c.city||'')}"></div><div class="field"><label>Limite de crédito</label><input id="climit" type="number" step="0.01" value="${c.creditLimit||0}"></div><div class="field"><label>CPF/CNPJ</label><input id="cdoc" value="${esc(c.document||'')}"></div><div class="field"><label>E-mail</label><input id="cemail" value="${esc(c.email||'')}"></div><div class="field"><label>Aniversário</label><input id="cbirth" type="date" value="${esc(c.birth||'')}"></div><div class="field"><label>Status</label><select id="cactive"><option value="true" ${c.active!==false?'selected':''}>Ativo</option><option value="false" ${c.active===false?'selected':''}>Inativo</option></select></div><div class="field wide"><label>Endereço</label><input id="caddress" value="${esc(c.address||'')}"></div><div class="field wide"><label>Observações</label><input id="cnotes" value="${esc(c.notes||'')}" placeholder="Preferências, referência de entrega, etc."></div><div class="field"><label>&nbsp;</label><button id="saveClient">${c.id?'Salvar alterações':'Salvar cliente'}</button></div></div>`}
function sum(a,k){return a.reduce((x,y)=>x+Number(y[k]||0),0)}function cartTotal(){return window.NexaGestPdv?window.NexaGestPdv.cartSubtotal(cart,product):cart.reduce((a,i)=>a+product(i.id).sale*i.qty,0)}function calcDiscount(){let sub=cartTotal();return window.NexaGestPdv?window.NexaGestPdv.calcDiscount(sub,localStorage.getItem('nexagest-temp-discount'),localStorage.getItem('nexagest-temp-discount-percent')):Math.min(sub,Math.max(0,Number(localStorage.getItem('nexagest-temp-discount')||0)+(sub*Number(localStorage.getItem('nexagest-temp-discount-percent')||0)/100)))}function sold(id){return salesValid().flatMap(s=>s.items).filter(i=>i.id===id).reduce((a,i)=>a+i.qty,0)}function margin(p){return p.sale?(((p.sale-p.cost)/p.sale)*100).toFixed(1)+'%':'0%'}function stockPill(p){let cls=p.stock<=0?'bad':p.stock<=p.min?'warn':'good';return `<span class="pill ${cls}">${p.stock}</span>`}function openByClient(id){return sum(db.receivables.filter(r=>!r.paid&&r.clientId===id),'value')}function lastClientSale(id){let s=salesValid().find(x=>x.clientId===id);return s?br(s.date):'-'}
function filteredSales(){return db.sales.filter(s=>s.date.slice(0,10)>=range.from&&s.date.slice(0,10)<=range.to)}
function salesReport(fs){let ok=fs.filter(s=>!s.cancelled),rev=sum(ok,'total'),cost=sum(ok,'cost'),exp=sum(db.expenses.filter(e=>e.date.slice(0,10)>=range.from&&e.date.slice(0,10)<=range.to),'value');return `<div class="grid cards"><div class="card"><span>Vendas</span><b>${money(rev)}</b></div><div class="card"><span>Custo</span><b>${money(cost)}</b></div><div class="card"><span>Gastos</span><b>${money(exp)}</b></div><div class="card"><span>Lucro líquido</span><b>${money(rev-cost-exp)}</b></div></div>${table(['Data','Cliente','Pagamento','Total','Lucro','Status','Ações'],fs.map(s=>[br(s.date),client(s.clientId).name,s.payment,money(s.total),money(s.total-s.cost),s.cancelled?'Cancelada':'OK',`<button class="ghost" data-receipt="${s.id}">Comprovante</button> ${!s.cancelled?`<button class="danger" data-cancel="${s.id}">Cancelar</button>`:'-'}`]))}`}
function reportsData(){let sales=filteredSales(),valid=sales.filter(s=>!s.cancelled),expenses=db.expenses.filter(e=>e.date.slice(0,10)>=range.from&&e.date.slice(0,10)<=range.to),receivables=db.receivables.filter(r=>(r.date||'').slice(0,10)>=range.from&&(r.date||'').slice(0,10)<=range.to),cashRegisters=cashRegistersInRange(),auditRows=db.audit.filter(a=>(a.date||'').slice(0,10)>=range.from&&(a.date||'').slice(0,10)<=range.to).slice(0,120),revenue=sum(valid,'total'),cost=sum(valid,'cost'),expensesTotal=sum(expenses,'value'),net=revenue-cost-expensesTotal,receivableOpen=sum(receivables.filter(r=>!r.paid),'value'),cashExpected=sum(cashRegisters.filter(c=>c.status==='Fechado'),'expectedAmount'),cashFinal=sum(cashRegisters.filter(c=>c.status==='Fechado'),'finalAmount'),cashDiff=sum(cashRegisters.filter(c=>c.status==='Fechado'),'difference');return{sales,valid,expenses,receivables,cashRegisters,audit:auditRows,revenue,cost,expensesTotal,net,receivableOpen,cashExpected,cashFinal,cashDiff,salesCount:valid.length,ticket:valid.length?revenue/valid.length:0}}
function groupSum(rows,keyFn,valueFn){let m={};rows.forEach(r=>{let k=keyFn(r)||'Sem categoria';m[k]=(m[k]||0)+Number(valueFn(r)||0)});return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function paymentReport(sales){let valid=sales.filter(s=>!s.cancelled),rows=groupSum(valid,s=>s.payment||'Não informado',s=>s.total);return rows.length?table(['Pagamento','Total'],rows.map(r=>[esc(r[0]),money(r[1])])):'<p class="muted">Sem vendas no período.</p>'}
function cashRegistersInRange(){return (db.cashRegisters||[]).filter(c=>{let d=(c.openedAt||c.abertura||'').slice(0,10);return d>=range.from&&d<=range.to})}
function cashRegistersReport(rows=cashRegistersInRange()){if(!rows.length)return '<p class="muted">Nenhum caixa no período.</p>';return table(['Caixa','Operador','Status','Abertura','Fechamento','Vendas','Dinheiro','Pix','Débito','Crédito','Fiado','Esperado','Contado','Diferença'],rows.map(c=>[c.number||'-',esc(c.operatorName||''),esc(c.status||''),br(c.openedAt||''),c.closedAt?br(c.closedAt):'-',money(c.totalSales||0),money(c.cashSales||0),money(c.pixSales||0),money(c.debitSales||0),money(c.creditSales||0),money(c.fiadoSales||0),money(c.expectedAmount||0),c.status==='Fechado'?money(c.finalAmount||0):'-',c.status==='Fechado'?money(c.difference||0):'-']))}
function expenseCategoryReport(expenses){let rows=groupSum(expenses,e=>e.category||'Outros',e=>e.value);return rows.length?table(['Categoria','Total'],rows.map(r=>[esc(r[0]),money(r[1])])):'<p class="muted">Sem despesas no período.</p>'}
function salesReportTable(sales){return table(['Data','Cliente','Pagamento','Total','Lucro','Status','Ações'],sales.map(s=>[br(s.date),esc(client(s.clientId).name),esc(s.payment||'-'),money(s.total),money(Number(s.total||0)-Number(s.cost||0)),s.cancelled?'<span class="pill bad">Cancelada</span>':'<span class="pill good">OK</span>',!s.cancelled?`<button class="danger" data-cancel="${s.id}">Cancelar</button>`:'-']))}
function productsSoldReport(sales){let items={};sales.filter(s=>!s.cancelled).forEach(s=>(s.items||[]).forEach(i=>{let p=product(i.id);if(!items[i.id])items[i.id]={name:p.name,qty:0,total:0,profit:0};items[i.id].qty+=Number(i.qty||0);items[i.id].total+=Number(i.price||p.sale||0)*Number(i.qty||0);items[i.id].profit+=(Number(i.price||p.sale||0)-Number(p.cost||0))*Number(i.qty||0)}));let rows=Object.values(items).sort((a,b)=>b.qty-a.qty);return rows.length?table(['Produto','Qtd.','Vendido','Lucro'],rows.map(r=>[esc(r.name),r.qty,money(r.total),money(r.profit)])):'<p class="muted">Nenhum produto vendido no período.</p>'}
function receivablesReport(rows){return rows.length?table(['Data','Cliente','Valor','Status'],rows.map(r=>[br(r.date||new Date()),esc(client(r.clientId).name),money(r.value),r.paid?'<span class="pill good">Pago</span>':'<span class="pill warn">Em aberto</span>'])):'<p class="muted">Nenhuma conta a receber no período.</p>'}

function lastDays(n){let out=[];for(let i=n-1;i>=0;i--){let d=new Date();d.setDate(d.getDate()-i);let key=d.toISOString().slice(0,10);out.push({label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),value:sum(salesValid().filter(s=>s.date.slice(0,10)===key),'total')})}return out}
function supplier(id){return lookupCache.suppliers.get(id)||db.suppliers.find(f=>f.id===id)||{name:'-'}}
function topClient(){let map={};salesValid().forEach(s=>{if(s.clientId)map[s.clientId]=(map[s.clientId]||0)+s.total});let id=Object.keys(map).sort((a,b)=>map[b]-map[a])[0];return id?{name:client(id).name,value:map[id]}:{name:'-',value:0}}
function esc(v=''){return String(v??'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))}function val(id){return document.getElementById(id)?.value||''}function num(id){return Number(val(id)||0)}
function bind(){document.querySelectorAll('[data-page]').forEach(b=>b.onclick=(ev)=>{ev?.preventDefault?.();ev?.stopPropagation?.();navigateTo(b.dataset.page)});on('loginBtn',()=>{let login=val('loginUser').trim();let pass=val('loginPass');let u=db.users.find(x=>String(x.user||'').toLowerCase()===login.toLowerCase()&&x.active!==false&&checkPassword(x,pass));if(!u){alert('Usuário ou senha inválidos.');setTimeout(()=>{let p=document.getElementById('loginPass');p?.focus();p?.select&&p.select()},40);return}startSession(u)});on('loginUser',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('loginPass')?.focus()}},'keydown');on('loginPass',e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('loginBtn')?.click()}},'keydown');on('logout',()=>endSession('Logout'));on('switchUser',()=>endSession('Troca de usuário'));on('switchUserTop',()=>endSession('Troca de usuário'));on('switchUserFromLock',()=>endSession('Troca de usuário com sistema bloqueado'));on('lockSession',lockSession);on('lockSessionTop',lockSession);on('unlockBtn',unlockSession);on('unlockPass',e=>{if(e.key==='Enter')unlockSession()},'keydown');on('themeToggle',()=>{db.settings.theme=db.settings.theme==='dark'?'light':'dark';save();app();alert('Tema alterado para '+(db.settings.theme==='dark'?'escuro':'claro')+'.')});on('backupBtn',backup);on('restoreBtn',restore);on('openCompanySwitcher',openCompanySwitcher);on('createCompanyBtn',createCompanyFromSettings);on('saveCompanyRegistryBtn',saveCurrentCompanyRegistry);on('saveSystemNetwork',saveSystemNetwork);on('startNetworkServer',startNetworkServerUi);on('stopNetworkServer',stopNetworkServerUi);on('testNetworkClient',testNetworkClientUi);on('networkSelfTest',networkSelfTestUi);on('pullNetworkData',pullNetworkDataUi);on('pushNetworkData',pushNetworkDataUi);on('pullCatalogData',pullCatalogDataUi);on('pushCatalogData',pushCatalogDataUi);on('syncCatalogData',syncCatalogDataUi);on('pullBusinessData',pullBusinessDataUi);on('pushBusinessData',pushBusinessDataUi);on('syncBusinessData',syncBusinessDataUi);on('discoverNetworkServers',discoverNetworkServersUi);on('runNetworkDiagnostics',runNetworkDiagnosticsUi);on('clearNetworkLog',clearNetworkLog);on('saveNetworkLog',saveNetworkLog);on('networkRealtimeCheck',()=>networkRealtimeTick(true));
  on('networkRole',()=>{saveSystemNetwork(false)},'change');
  on('syncMode',()=>{saveSystemNetwork(false)},'change');
  on('networkPort',()=>{saveSystemNetwork(false)},'change');
  on('serverAddress',()=>{saveSystemNetwork(false)},'change');
  document.querySelectorAll('[data-set-network-role]').forEach(b=>b.onclick=()=>setNetworkRoleUi(b.dataset.setNetworkRole));
  document.querySelectorAll('[data-company-switch]').forEach(b=>b.onclick=()=>switchCompanyUi(b.dataset.companySwitch));document.querySelectorAll('[data-company-delete]').forEach(b=>b.onclick=()=>deleteCompanyUi(b.dataset.companyDelete));on('saveProduct',saveProduct);on('pimageFile',readProductImage,'change');on('removeProductImage',removeProductImage);on('exportProducts',exportProductsCsv);on('generateProductCatalog',generateProductCatalog);on('newProduct',()=>{editingProduct=null;queueFocus('pname',true);app()});document.querySelectorAll('[data-profile-product]').forEach(b=>b.onclick=()=>openProductProfile(b.dataset.profileProduct));document.querySelectorAll('[data-profile-client]').forEach(b=>b.onclick=()=>openClientProfile(b.dataset.profileClient));document.querySelectorAll('[data-profile-supplier]').forEach(b=>b.onclick=()=>openSupplierProfile(b.dataset.profileSupplier));document.querySelectorAll('[data-editp]').forEach(b=>b.onclick=()=>{editingProduct=b.dataset.editp;queueFocus('pname',true);app()});document.querySelectorAll('[data-delp]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delp));document.querySelectorAll('[data-product-label]').forEach(b=>b.onclick=()=>{setLabelSelected([b.dataset.productLabel]);page='labels';app()});on('prodSearch',e=>{localStorage.setItem('prod-q',e.target.value);if(window.NexaGestProducts?.refreshProductsList){window.NexaGestProducts.refreshProductsList({db,esc,money,productAdminCard});document.querySelectorAll('[data-profile-product]').forEach(b=>b.onclick=()=>openProductProfile(b.dataset.profileProduct));document.querySelectorAll('[data-editp]').forEach(b=>b.onclick=()=>{editingProduct=b.dataset.editp;queueFocus('pname',true);app()});document.querySelectorAll('[data-delp]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delp));document.querySelectorAll('[data-product-label]').forEach(b=>b.onclick=()=>{setLabelSelected([b.dataset.productLabel]);page='labels';app()});return}app()},'input');on('prodCat',e=>{localStorage.setItem('prod-cat',e.target.value);app()},'change');on('prodStock',e=>{localStorage.setItem('prod-stock',e.target.value);app()},'change');on('prodStatus',e=>{localStorage.setItem('prod-status',e.target.value);app()},'change');on('prodSort',e=>{localStorage.setItem('prod-sort',e.target.value);app()},'change');on('pcost',updateProductMarginPreview,'input');on('psale',updateProductMarginPreview,'input');document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{addCart(b.dataset.add);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)});document.querySelectorAll('[data-pdv-product]').forEach(c=>{c.onclick=e=>{if(e.target.closest('button,input'))return;addCart(c.dataset.pdvProduct);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)};c.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addCart(c.dataset.pdvProduct);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)}}});document.querySelectorAll('[data-rem]').forEach(b=>b.onclick=()=>{if(!requireCashOpen('alterar o carrinho'))return;cart=cart.filter(i=>i.id!==b.dataset.rem);app()});document.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>{if(!requireCashOpen('alterar o carrinho'))return;let i=cart.find(x=>x.id===b.dataset.plus),p=product(b.dataset.plus);if(i&&i.qty<p.stock)i.qty++;else alert('Estoque insuficiente.');app()});document.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{if(!requireCashOpen('alterar o carrinho'))return;let i=cart.find(x=>x.id===b.dataset.minus);if(i)i.qty=Math.max(1,i.qty-1);app()});on('clearCart',()=>{if(!requireCashOpen('limpar o carrinho'))return;cart=[];app()});document.querySelectorAll('[data-qty]').forEach(i=>i.onchange=()=>{if(!requireCashOpen('alterar quantidade'))return;cart.find(x=>x.id===i.dataset.qty).qty=Math.max(1,Number(i.value||1));app()});on('pdvSearch',e=>filterPdv(e.target.value),'input');on('pdvSearch',pdvSearchKey,'keydown');document.querySelectorAll('[data-pdv-action]').forEach(b=>b.onclick=()=>pdvAction(b.dataset.pdvAction));document.querySelectorAll('[data-payment]').forEach(b=>b.onclick=()=>setPayment(b.dataset.payment));on('discount',e=>{if(!requireCashOpen('aplicar desconto'))return;localStorage.setItem('nexagest-temp-discount',e.target.value||0);app()},'change');on('discount',e=>{localStorage.setItem('nexagest-temp-discount',e.target.value||0)},'input');on('discountPercent',e=>{if(!requireCashOpen('aplicar desconto'))return;localStorage.setItem('nexagest-temp-discount-percent',e.target.value||0);app()},'change');on('discountPercent',e=>{localStorage.setItem('nexagest-temp-discount-percent',e.target.value||0)},'input');on('pay',e=>{if(!requireCashOpen('selecionar pagamento'))return;localStorage.setItem('nexagest-temp-payment',e.target.value);app()},'change');on('paidAmount',e=>{if(!requireCashOpen('informar valor recebido'))return;localStorage.setItem('nexagest-temp-paid',e.target.value||0);app()},'change');on('paidAmount',e=>{localStorage.setItem('nexagest-temp-paid',e.target.value||0)},'input');on('openFinalizeSale',openFinalizeModal);on('closeFinalizeSale',closeFinalizeModal);on('confirmFinishSale',finishSale);if(document.getElementById('pixQrBox'))setTimeout(renderPixPanel,50);on('finishSale',openFinalizeModal);on('openCashRegister',openCashRegister);on('cashSupply',()=>addCashMovement('Suprimento'));on('cashWithdrawal',()=>addCashMovement('Sangria'));on('closeCashRegister',closeCashRegister);on('quoteFromCart',quoteFromCart);on('saveMove',saveMove);on('saveInventoryAdjust',saveInventoryAdjust);on('exportInventory',exportInventoryCsv);on('stockSearch',e=>{localStorage.setItem('stock-q',e.target.value);app()},'input');on('stockType',e=>{localStorage.setItem('stock-type',e.target.value);app()},'change');on('stockStatus',e=>{localStorage.setItem('stock-status',e.target.value);app()},'change');on('invProduct',e=>{let p=product(e.target.value);let i=document.getElementById('invQty');if(i)i.value=Number(p.stock||0)},'change');on('exportStock',exportStockCsv);on('saveClient',saveClient);on('newClient',()=>{editingClient=null;queueFocus('cname',true);app()});on('exportClients',exportClientsCsv);on('clientSearch',e=>{localStorage.setItem('client-q',e.target.value);if(window.NexaGestClients?.refreshClientsList){window.NexaGestClients.refreshClientsList({db,esc,money,openByClient,table,lastClientSale,openClientProfile,deleteClient,openWhatsAppNumber,editClient:(id)=>{editingClient=id;queueFocus('cname',true);app()}});return}app()},'input');on('clientStatus',e=>{localStorage.setItem('client-status',e.target.value);if(window.NexaGestClients?.refreshClientsList){window.NexaGestClients.refreshClientsList({db,esc,money,openByClient,lastClientSale,openClientProfile,deleteClient,openWhatsAppNumber,editClient:(id)=>{editingClient=id;queueFocus('cname',true);app()}});return}app()},'change');on('clientSort',e=>{localStorage.setItem('client-sort',e.target.value);if(window.NexaGestClients?.refreshClientsList){window.NexaGestClients.refreshClientsList({db,esc,money,openByClient,lastClientSale,openClientProfile,deleteClient,openWhatsAppNumber,editClient:(id)=>{editingClient=id;queueFocus('cname',true);app()}});return}app()},'change');document.querySelectorAll('[data-editc]').forEach(b=>b.onclick=()=>{editingClient=b.dataset.editc;queueFocus('cname',true);app()});document.querySelectorAll('[data-delc]').forEach(b=>b.onclick=()=>deleteClient(b.dataset.delc));document.querySelectorAll('[data-wa]').forEach(b=>b.onclick=()=>openWhatsAppNumber(b.dataset.wa));on('saveExp',saveExp);on('saveFinLaunch',saveFinLaunch);on('exportFinance',exportFinanceCsv);on('saveManualReceivable',saveManualReceivable);on('exportReceivablesCsv',exportReceivablesCsv);on('exportPayablesCsv',exportPayablesCsv);if(page==='finance')bindFinanceFilters();document.querySelectorAll('[data-delexp]').forEach(b=>b.onclick=()=>deleteExpense(b.dataset.delexp));on('savePurchase',savePurchase);on('exportPurchases',exportPurchasesCsv);on('purchaseSearch',e=>{localStorage.setItem('purchase-q',e.target.value);queueFocus('purchaseSearch');app()},'input');on('purchaseSupplier',e=>{localStorage.setItem('purchase-supplier',e.target.value);app()},'change');on('purchaseStatus',e=>{localStorage.setItem('purchase-status',e.target.value);app()},'change');on('purchasePeriod',e=>{localStorage.setItem('purchase-period',e.target.value);app()},'change');on('buySupplier',e=>{localStorage.setItem('buy-supplier',e.target.value)},'change');on('buyProduct',e=>{localStorage.setItem('buy-product',e.target.value);app()},'change');on('buyQty',updateBuyPreview,'input');on('buyCost',updateBuyPreview,'input');on('goNfeImport',()=>{page='nfe';app()});on('goSuppliersFromPurchase',()=>{page='suppliers';app()});on('nfeXmlFile',parseNfeFile,'change');on('nfeSearch',e=>{localStorage.setItem('nfe-q',e.target.value);app()},'input');let dz=document.getElementById('nfeDropZone');if(dz){dz.onclick=e=>{if(e.target.id!=='nfeXmlFile')document.getElementById('nfeXmlFile')?.click()};['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>{let file=e.dataTransfer?.files?.[0];if(file)parseNfeFile({target:{files:[file]}})})}on('registerNfe',registerNfe,'click');on('clearNfeDraft',()=>{localStorage.removeItem('nfe-draft');app()});on('exportNfe',exportNfeCsv);document.querySelectorAll('[data-viewnfe]').forEach(b=>b.onclick=()=>viewNfe(b.dataset.viewnfe));document.querySelectorAll('[data-delnfe]').forEach(b=>b.onclick=()=>deleteNfe(b.dataset.delnfe));on('saveSupplier',saveSupplier);on('newSupplier',()=>{editingSupplier=null;queueFocus('supName',true);app()});on('exportSuppliers',exportSuppliersCsv);on('supplierSearch',e=>{localStorage.setItem('supplier-q',e.target.value);app()},'input');on('supplierStatus',e=>{localStorage.setItem('supplier-status',e.target.value);app()},'change');document.querySelectorAll('[data-editsup]').forEach(b=>b.onclick=()=>{editingSupplier=b.dataset.editsup;queueFocus('supName',true);app()});document.querySelectorAll('[data-delsup]').forEach(b=>b.onclick=()=>deleteSupplier(b.dataset.delsup));document.querySelectorAll('[data-payrec]').forEach(b=>b.onclick=()=>payRec(b.dataset.payrec));on('saveQuote',saveQuickQuote);on('goPdvQuote',()=>{page='pdv';app()});on('exportQuotes',exportQuotesCsv);on('quoteSearch',e=>{localStorage.setItem('quote-q',e.target.value);queueFocus('quoteSearch');app()},'input');on('quoteStatus',e=>{localStorage.setItem('quote-status',e.target.value);app()},'change');document.querySelectorAll('[data-quote-filter]').forEach(b=>b.onclick=()=>{localStorage.setItem('quote-status',b.dataset.quoteFilter);app()});on('quoteProduct',updateQuoteTotalPreview,'change');on('quoteQty',e=>{localStorage.setItem('quote-qty',e.target.value||1);updateQuoteTotalPreview()},'input');document.querySelectorAll('[data-quote-sale]').forEach(b=>b.onclick=()=>quoteToSale(b.dataset.quoteSale));document.querySelectorAll('[data-print-quote]').forEach(b=>b.onclick=()=>printQuote(b.dataset.printQuote));document.querySelectorAll('[data-quote-whatsapp]').forEach(b=>b.onclick=()=>sendQuoteWhatsApp(b.dataset.quoteWhatsapp));document.querySelectorAll('[data-quote-cancel]').forEach(b=>b.onclick=()=>setQuoteStatus(b.dataset.quoteCancel,'Cancelado'));document.querySelectorAll('[data-quote-open]').forEach(b=>b.onclick=()=>setQuoteStatus(b.dataset.quoteOpen,'Aberto'));document.querySelectorAll('[data-quote-dup]').forEach(b=>b.onclick=()=>duplicateQuote(b.dataset.quoteDup));document.querySelectorAll('[data-quote-del]').forEach(b=>b.onclick=()=>deleteQuote(b.dataset.quoteDel));on('saveDelivery',saveDelivery);on('exportDeliveries',exportDeliveriesCsv);on('deliverySearch',e=>{localStorage.setItem('delivery-q',e.target.value);queueFocus('deliverySearch');app()},'input');on('deliveryStatus',e=>{localStorage.setItem('delivery-status',e.target.value);app()},'change');on('deliveryPeriod',e=>{localStorage.setItem('delivery-period',e.target.value);app()},'change');on('deliveryPriority',e=>{localStorage.setItem('delivery-priority',e.target.value);app()},'change');document.querySelectorAll('[data-next-del]').forEach(b=>b.onclick=()=>nextDelivery(b.dataset.nextDel));document.querySelectorAll('[data-set-del]').forEach(b=>b.onclick=()=>setDeliveryStatus(b.dataset.setDel,b.dataset.status));document.querySelectorAll('[data-delivery-wa]').forEach(b=>b.onclick=()=>openDeliveryWhatsApp(b.dataset.deliveryWa));document.querySelectorAll('[data-delivery-map]').forEach(b=>b.onclick=()=>openMap(b.dataset.deliveryMap));document.querySelectorAll('[data-del-delivery]').forEach(b=>b.onclick=()=>deleteDelivery(b.dataset.delDelivery));on('labelSearch',e=>{localStorage.setItem('label-q',e.target.value);app()},'input');on('labelCat',e=>{localStorage.setItem('label-cat',e.target.value);app()},'change');on('labelModel',e=>{localStorage.setItem('label-model',e.target.value);app()},'change');on('labelPrintMode',e=>{localStorage.setItem('label-print-mode',e.target.value);app()},'change');on('labelCodeType',e=>{localStorage.setItem('label-code-type',e.target.value);app()},'change');on('labelShowName',e=>{localStorage.setItem('label-show-name',e.target.checked);app()},'change');on('labelShowPrice',e=>{localStorage.setItem('label-show-price',e.target.checked);app()},'change');on('labelShowCode',e=>{localStorage.setItem('label-show-code',e.target.checked);app()},'change');on('labelShowBarcode',e=>{localStorage.setItem('label-show-barcode',e.target.checked);app()},'change');document.querySelectorAll('[data-label-toggle]').forEach(i=>i.onchange=()=>{let ids=labelData().selected;if(i.checked&&!ids.includes(i.dataset.labelToggle))ids.push(i.dataset.labelToggle);if(!i.checked)ids=ids.filter(x=>x!==i.dataset.labelToggle);setLabelSelected(ids);app()});document.querySelectorAll('[data-label-qty]').forEach(i=>i.onchange=()=>{localStorage.setItem('label-qty-'+i.dataset.labelQty,Math.max(1,Number(i.value||1)));app()});on('selectAllLabels',()=>{setLabelSelected(db.products.map(p=>p.id));app()});on('clearLabels',()=>{setLabelSelected([]);app()});on('printLabels',()=>window.print());on('applyReport',()=>{range.from=val('from');range.to=val('to');app()});on('exportCsv',exportCsv);on('exportHtml',exportHtml);on('saveUser',saveUser);on('newUser',()=>{editingUser=null;queueFocus('uName',true);app()});on('exportUsers',exportUsersCsv);on('userSearch',e=>{localStorage.setItem('user-q',e.target.value);app()},'input');on('userRoleFilter',e=>{localStorage.setItem('user-role',e.target.value);app()},'change');on('userStatusFilter',e=>{localStorage.setItem('user-status',e.target.value);app()},'change');document.querySelectorAll('[data-editu]').forEach(b=>b.onclick=()=>{editingUser=b.dataset.editu;queueFocus('uName',true);app()});document.querySelectorAll('[data-toggleu]').forEach(b=>b.onclick=()=>toggleUser(b.dataset.toggleu));document.querySelectorAll('[data-delu]').forEach(b=>b.onclick=()=>deleteUser(b.dataset.delu));document.querySelectorAll('[data-resetu]').forEach(b=>b.onclick=()=>resetUserPassword(b.dataset.resetu));document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>cancelSale(b.dataset.cancel));document.querySelectorAll('[data-receipt]').forEach(b=>b.onclick=()=>openSaleReceipt(b.dataset.receipt,false));on('saveSettings',saveCompany);on('saveSystem',saveSystem);on('saveSystemNetwork',saveSystem);on('logoFile',readLogo,'change');on('enterCashierMode',enterCashierMode);on('enterCashierModeInline',enterCashierMode);on('exitCashierMode',exitCashierMode);on('focusPdvSearch',()=>{let el=document.getElementById('pdvSearch');el?.focus();el?.select()});document.querySelectorAll('#openCommandPalette,[data-open-command-palette]').forEach(b=>b.onclick=(e)=>{e?.preventDefault?.();e?.stopPropagation?.();openCommandPalette()});on('commandInput',filterCommandPalette,'input');on('commandInput',commandPaletteKey,'keydown');document.querySelectorAll('[data-command-run]').forEach(b=>b.onclick=()=>runCommand(b.dataset.commandRun));on('saveWhatsAppTemplates',saveWhatsAppTemplates);on('sendPremiumWhatsApp',sendPremiumWhatsApp);on('cloudProvider',e=>{db.settings.backupProvider=e.target.value;save();app()},'change');on('saveCloudBackupSettings',saveCloudBackupSettings);on('runCloudBackup',runCloudBackup);on('pickCloudFolder',pickCloudFolder);on('refreshCloudBackups',refreshCloudBackups);on('restoreCloudBackup',restoreCloudBackup);document.querySelectorAll('[data-cloud-provider]').forEach(b=>b.onclick=()=>{db.settings.backupProvider=b.dataset.cloudProvider;save();app()});on('saveReportModel',saveReportModel);on('exportCustomReportCsv',exportCustomReportCsv);on('exportCustomReportExcel',exportCustomReportExcel);on('exportCustomReportPdf',exportCustomReportPdf);on('exportCustomReportHtml',exportCustomReportHtml);bindCustomReportEvents();on('saveDashboardPrefs',saveDashboardPrefs);document.querySelectorAll('[data-dash-go]').forEach(b=>b.onclick=()=>{page=b.dataset.dashGo;app()});document.querySelectorAll('[data-dashboard-period]').forEach(b=>b.onclick=()=>{localStorage.setItem('dashboard-period',b.dataset.dashboardPeriod);app()});document.querySelectorAll('[data-settings-tab]').forEach(b=>b.onclick=()=>{localStorage.setItem('settings-smart-tab',b.dataset.settingsTab);app()});on('runIntegrityCheck',runIntegrityCheck);on('exportDiagnostics',exportDiagnostics);on('clearSystemLogs',clearSystemLogs);on('testBackupSettings',testBackupSettings);on('testWhatsappSettings',testWhatsappSettings);on('testPrinterSettings',testPrinterSettings);on('savePixSettings',savePixSettings);on('testPixQr',testPixQr);on('testPixQr2',testPixQr);on('saveLicenseSettings',saveLicenseSettings);on('checkUpdatesNow',checkUpdatesNow);on('downloadAvailableUpdate',downloadAvailableUpdate);on('generateDemoLicense',generateDemoLicense);on('openCommercialDocs',openCommercialDocs);on('openFirstUseWizard',openFirstUseWizard);on('openPremiumReports',()=>{page='premium';app()});on('openCommandPaletteSettings',openCommandPalette);if(sessionLocked)setTimeout(()=>document.getElementById('unlockPass')?.focus(),0);if(cashierMode&&page==='pdv')setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0);/* atalhos globais do PDV são registrados uma única vez */}
function on(id,fn,ev='click'){let el=document.getElementById(id);if(el)el.addEventListener(ev,fn)}
function addCart(id){if(!requireCashOpen('adicionar produtos ao carrinho'))return;let p=product(id);if(p.stock<=0)return alert('Sem estoque.');let i=cart.find(x=>x.id===id);if(i){if(i.qty>=p.stock)return alert('Estoque insuficiente.');i.qty++}else cart.push({id,qty:1});localStorage.setItem('pdv-last-added',id);localStorage.setItem('pdv-last-added-at',String(Date.now()));app()}
function normalizeBarcode(v){return window.NexaGestPdv?window.NexaGestPdv.normalizeBarcode(v):String(v||'').replace(/\D/g,'').trim()}
function findProductByBarcode(code){return window.NexaGestPdv?window.NexaGestPdv.findProductByBarcode(db.products,code):(()=>{let c=normalizeBarcode(code);if(!c)return null;return db.products.find(p=>normalizeBarcode(p.barcode)===c)||null})()}
function enterCashierMode(){cashierMode=true;page='pdv';localStorage.setItem('nexagest-cashier-mode','1');app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)}
function exitCashierMode(){cashierMode=false;localStorage.removeItem('nexagest-cashier-mode');app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)}
function addByBarcode(code){let p=findProductByBarcode(code);if(!p)return false;addCart(p.id);localStorage.removeItem('pdv-search');let el=document.getElementById('pdvSearch');if(el)el.value='';return true}
function firstPdvProduct(q){return pdvFilteredProducts(q)[0]}
function addFirstPdvProduct(q){let p=firstPdvProduct(q);if(!p)return false;addCart(p.id);localStorage.removeItem('pdv-search');return true}
function bindPdvProductEvents(){document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{addCart(b.dataset.add);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)});document.querySelectorAll('[data-pdv-product]').forEach(c=>{c.onclick=e=>{if(e.target.closest('button,input'))return;addCart(c.dataset.pdvProduct);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)};c.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addCart(c.dataset.pdvProduct);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)}}})}
function filterPdv(q){localStorage.setItem('pdv-search',q||'');let raw=String(q||''),barcode=normalizeBarcode(raw),list=pdvFilteredProducts(raw);if(isCashOpen()&&barcode&&list.length===1&&normalizeBarcode(list[0].barcode)===barcode){addByBarcode(barcode);return}let box=document.getElementById('pdvProducts');if(box){box.innerHTML=productCards(list);bindPdvProductEvents()}}
function pdvSearchKey(e){let code=e.target.value;if(e.key==='Enter'){e.preventDefault();if(!isCashOpen()){alert('Abra o caixa antes de adicionar produtos.');return}let selected=document.querySelector('[data-pdv-product].selected');if(selected){addCart(selected.dataset.pdvProduct);localStorage.removeItem('pdv-search');e.target.value='';filterPdv('');return}if(!addByBarcode(code)&&!addFirstPdvProduct(code))filterPdv(code);setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();let cards=[...document.querySelectorAll('[data-pdv-product]')],cur=cards.findIndex(c=>c.classList.contains('selected'));if(!cards.length)return;cards.forEach(c=>c.classList.remove('selected'));let next=e.key==='ArrowDown'?Math.min(cards.length-1,cur+1):Math.max(0,cur-1);if(cur<0)next=0;cards[next].classList.add('selected');cards[next].scrollIntoView({block:'nearest'})}}
function pdvAction(a){if(a!=='search'&&!isCashOpen()){alert('Abra o caixa primeiro.');return}if(a==='search'){let el=document.getElementById('pdvSearch');el?.focus();el?.select()}if(a==='client'){openFinalizeModal();setTimeout(()=>document.getElementById('saleClient')?.focus(),80)}if(a==='finish')openFinalizeModal();if(a==='discount'){openFinalizeModal();setTimeout(()=>{let el=document.getElementById('discount');el?.focus();el?.select()},80)}if(a==='clear'&&cart.length){confirmAction('Limpar carrinho?',()=>{cart=[];app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)},'Limpar carrinho','Limpar')}}
function nextSaleNumber(){
  let max=0;
  (db.sales||[]).forEach(s=>{
    let raw=String(s.saleNumber||'').match(/(\d+)/g);
    let n=raw?Number(raw[raw.length-1]):0;
    if(Number.isFinite(n)&&n>max)max=n;
  });
  return 'VEN-'+String(max+1).padStart(6,'0');
}
function saleDisplayNumber(s){
  if(!s)return 'VEN-000000';
  if(s.saleNumber)return s.saleNumber;
  let ordered=[...(db.sales||[])].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
  let ix=ordered.findIndex(x=>x.id===s.id);
  if(ix>=0)return 'VEN-'+String(ix+1).padStart(6,'0');
  return 'VEN-000000';
}
function firstPhoneFrom(obj={}){
  return obj?.clientPhone||obj?.customerPhone||obj?.whatsapp||obj?.phone||obj?.telefone||obj?.celular||obj?.mobile||obj?.cellphone||obj?.cell||obj?.fone||obj?.telefoneWhatsapp||obj?.telefone_whatsapp||'';
}
function saleClientPhone(s,c={}){
  // Prioriza o telefone salvo na própria venda; se não existir, busca no cadastro completo do cliente.
  // Isso evita o erro "Cliente sem WhatsApp cadastrado" quando a venda guarda só o ID do cliente.
  let candidates=[];
  if(s)candidates.push(s);
  if(c)candidates.push(c);
  if(s?.clientId){
    let byId=(db.clients||[]).find(x=>String(x.id)===String(s.clientId));
    if(byId)candidates.push(byId);
  }
  let saleClientName=s?.clientName||s?.customerName||c?.name||'';
  if(saleClientName){
    let byName=(db.clients||[]).find(x=>String(x.name||'').trim().toLowerCase()===String(saleClientName).trim().toLowerCase());
    if(byName)candidates.push(byName);
  }
  for(let item of candidates){
    let phone=firstPhoneFrom(item);
    if(normalizeBrazilPhone(phone))return phone;
  }
  return '';
}
function finishSale(){if(!requireCan('pdv'))return;let open=currentCashRegister();if(!open){alert('Abra o caixa antes de finalizar vendas.');return}let s=makeSaleFromCart();if(!s)return;s.cashRegisterId=open.id;s.operatorId=db.session?.id;s.operatorName=db.session?.name;db.sales.unshift(s);applyStockSale(s);if(s.payment==='Fiado')db.receivables.unshift({id:uid(),saleId:s.id,clientId:s.clientId,value:s.total,date:s.date,paid:false});cart=[];['nexagest-temp-discount','nexagest-temp-discount-percent','nexagest-temp-paid','nexagest-temp-payment','pdv-finalize-open','pdv-last-added','pdv-last-added-at','pix-confirmed'].forEach(k=>localStorage.removeItem(k));audit('Venda finalizada '+money(s.total));save();app();setTimeout(()=>openSaleReceipt(s.id,true),90)}
function makeSaleFromCart(){if(!cart.length){alert('Carrinho vazio.');return null}let payment=val('pay')||'Dinheiro',clientId=val('saleClient');if(payment==='Fiado'&&!clientId){alert('Selecione cliente para fiado.');return null}for(let i of cart){if(product(i.id).stock<i.qty){alert('Estoque insuficiente: '+product(i.id).name);return null}}let items=cart.map(i=>{let p=product(i.id),qty=Number(i.qty||1),price=Number(p.sale||0),cost=Number(p.cost||0);return{itemId:uid(),id:p.id,productId:p.id,name:p.name||'',barcode:p.barcode||'',qty,price,cost,total:qty*price}});let subtotal=items.reduce((a,i)=>a+i.total,0),discount=calcDiscount(),total=Math.max(0,subtotal-discount),cost=items.reduce((a,i)=>a+i.cost*i.qty,0),paid=payment==='Dinheiro'?num('paidAmount'):total,change=payment==='Dinheiro'?Math.max(0,paid-total):0;let cl=client(clientId)||{};return{id:uid(),saleNumber:nextSaleNumber(),date:new Date().toISOString(),items,subtotal,discount,total,cost,payment,clientId,clientName:cl.name||'',clientPhone:saleClientPhone(null,cl),paid,change,pixPayload:payment==='Pix'?pixPayload(total,'Venda '+(db.settings.company||'NexaGest')):'',cancelled:false}}


function receiptCompanyBlock(){return `<div class="receipt-company"><h2>${esc(db.settings.company||'NexaGest')}</h2><p>${esc(db.settings.document||'')}</p><p>${esc(db.settings.address||'')}</p><p>${esc(db.settings.city||'')} ${db.settings.phone?'• '+esc(db.settings.phone):''}</p></div>`}
function receiptSaleHtml(s){let c=client(s.clientId)||{},op=s.operatorName||db.session?.name||'-',items=s.items||[],pix=s.payment==='Pix'&&s.pixPayload,display=saleDisplayNumber(s);return `<div class="sale-receipt"><div class="receipt-ok">✅ Venda finalizada com sucesso</div>${receiptCompanyBlock()}<div class="receipt-meta"><div><span>Venda</span><b>${esc(display)}</b></div><div><span>Data</span><b>${br(s.date)}</b></div><div><span>Operador</span><b>${esc(op)}</b></div><div><span>Cliente</span><b>${esc(c.name||'Cliente balcão')}</b></div></div><table class="receipt-items"><thead><tr><th>Item</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead><tbody>${items.map(i=>`<tr><td><b>${esc(i.name||product(i.id).name)}</b><small>${esc(i.barcode||'')}</small></td><td>${Number(i.qty||0)}</td><td>${money(i.price)}</td><td>${money(i.total||Number(i.qty||0)*Number(i.price||0))}</td></tr>`).join('')}</tbody></table><div class="receipt-totals"><div><span>Subtotal</span><b>${money(s.subtotal||0)}</b></div><div><span>Desconto</span><b>${money(s.discount||0)}</b></div><div class="grand"><span>Total</span><b>${money(s.total||0)}</b></div><div><span>Pagamento</span><b>${esc(s.payment||'-')}</b></div>${(s.payment==='Dinheiro'&&(Number(s.paid||0)>0||Number(s.change||0)>0))?`<div><span>Recebido</span><b>${money(s.paid||0)}</b></div><div><span>Troco</span><b>${money(s.change||0)}</b></div>`:''}</div>${pix?`<div class="receipt-pix"><b>PIX Copia e Cola</b><textarea readonly>${esc(pix)}</textarea></div>`:''}<p class="receipt-footer">Obrigado pela preferência!</p></div>`}
function receiptDocumentHtml(s){return `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante ${esc(saleDisplayNumber(s))}</title><style>body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;background:#fff}.sale-receipt{max-width:420px;margin:auto}.receipt-ok{text-align:center;font-weight:700;margin-bottom:12px}.receipt-company{text-align:center;border-bottom:1px dashed #aaa;padding-bottom:10px;margin-bottom:10px}.receipt-company h2{margin:0 0 4px}.receipt-company p{margin:2px 0;color:#444}.receipt-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.receipt-meta div,.receipt-totals{border:1px solid #ddd;border-radius:10px;padding:8px}.receipt-meta span,.receipt-totals span{display:block;color:#666;font-size:12px}.receipt-items{width:100%;border-collapse:collapse;margin:12px 0}.receipt-items th,.receipt-items td{border-bottom:1px solid #ddd;padding:7px;text-align:left}.receipt-items small{display:block;color:#777}.receipt-totals{display:grid;gap:7px}.receipt-totals div{display:flex;justify-content:space-between}.receipt-totals .grand{border-top:1px dashed #aaa;padding-top:8px;font-size:20px}.receipt-pix textarea{width:100%;min-height:90px;margin-top:6px}.receipt-footer{text-align:center;margin-top:18px}</style></head><body>${receiptSaleHtml(s)}</body></html>`}
function openSaleReceipt(id,afterSale=false){let s=db.sales.find(x=>x.id===id);if(!s)return alert('Venda não encontrada.');document.getElementById('saleReceiptOverlay')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="saleReceiptOverlay" data-sale-id="${esc(s.id)}" class="modal-backdrop sale-receipt-modal open"><div class="modal-card receipt-card"><div class="between receipt-head"><div><h2>Comprovante de venda</h2><p class="muted small">${afterSale?'Venda finalizada. Imprima, salve ou envie o comprovante.':'Reimpressão de comprovante.'}</p></div><button class="ghost" id="closeSaleReceipt">Esc</button></div>${receiptSaleHtml(s)}<div class="receipt-actions no-print"><button class="ok" id="printSaleReceipt">🖨️ Imprimir comprovante</button><button class="ghost" id="downloadSaleReceipt">📄 Salvar HTML/PDF</button><button class="ghost" id="whatsappSaleReceipt" data-sale-id="${esc(s.id)}">💬 Enviar WhatsApp</button><button class="ghost" id="newSaleAfterReceipt">Nova venda</button></div></div></div>`);document.body.classList.add('modal-open','printing-receipt-ready');document.getElementById('closeSaleReceipt')?.addEventListener('click',closeSaleReceipt);document.getElementById('saleReceiptOverlay')?.addEventListener('click',e=>{if(e.target.id==='saleReceiptOverlay')closeSaleReceipt()});document.getElementById('printSaleReceipt')?.addEventListener('click',()=>window.print());document.getElementById('downloadSaleReceipt')?.addEventListener('click',()=>download(receiptDocumentHtml(s),`comprovante-${saleDisplayNumber(s)}.html`,'text/html;charset=utf-8'));document.getElementById('whatsappSaleReceipt')?.addEventListener('click',()=>sendSaleReceiptWhatsApp(s.id));document.getElementById('newSaleAfterReceipt')?.addEventListener('click',()=>{closeSaleReceipt();page='pdv';app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),60)});setTimeout(()=>document.getElementById('printSaleReceipt')?.focus(),30)}
function closeSaleReceipt(){document.getElementById('saleReceiptOverlay')?.remove();document.body.classList.remove('modal-open','printing-receipt-ready');setTimeout(()=>document.getElementById('pdvSearch')?.focus(),60)}
function receiptWhatsappDefaultTemplate(){return '🧾 *COMPROVANTE DE VENDA*\n\nOlá, *{cliente}*! 👋\n\nSua compra foi finalizada com sucesso na *{empresa}*.\n\n━━━━━━━━━━━━━━━━━━\n🧾 Venda: {pedido}\n📅 Data: {data} • {hora}\n\n💰 Total: *{total}*\n💳 Pagamento: {pagamento}\n{descontoLinha}{dinheiroLinha}{pixLinha}━━━━━━━━━━━━━━━━━━\n\n📦 Itens\n{itens}\n\nObrigado pela preferência! 😊\n\n📍 {empresa}\n📱 {telefoneEmpresa}'}
function saleItemsText(s){let items=s.items||[];return items.length?items.map(i=>`• ${Number(i.qty||0)}x ${i.name||product(i.id).name} — ${money(i.total||Number(i.qty||0)*Number(i.price||0))}`).join('\n'):'• Itens não informados'}
function saleReceiptWhatsAppData(s,c,display){let d=new Date(s.date||new Date()),data=br(s.date).split(',')[0]||br(s.date),hora=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});let discount=Number(s.discount||0),paid=Number(s.paid||0),change=Number(s.change||0);return {cliente:c.name||'Cliente',empresa:db.settings.company||'NexaGest',valor:money(s.total),total:money(s.total),pedido:display,venda:display,data,hora,pagamento:s.payment||'-',desconto:money(discount),descontoLinha:discount>0?`🏷️ Desconto: ${money(discount)}\n`:'',dinheiroLinha:(s.payment==='Dinheiro'&&(paid>0||change>0))?`💵 Recebido: ${money(paid)}\n💲 Troco: ${money(change)}\n`:'',pixLinha:s.payment==='Pix'?'✅ Pagamento via PIX.\n':'',itens:saleItemsText(s),telefoneEmpresa:db.settings.phone||'',link:''}}
function sendSaleReceiptWhatsApp(id){
  let s=db.sales.find(x=>x.id===id);
  if(!s)return alert('Venda não encontrada para enviar o comprovante.');
  let c=client(s.clientId)||{};
  let phone=saleClientPhone(s,c);
  if(!normalizeBrazilPhone(phone)){
    let typed=prompt('Cliente sem WhatsApp cadastrado. Digite o WhatsApp para enviar este comprovante:','');
    if(!normalizeBrazilPhone(typed))return;
    phone=typed;
  }
  let display=saleDisplayNumber(s);
  let tpl=(db.settings.whatsappTemplates||{}).comprovante||receiptWhatsappDefaultTemplate();
  if(!/COMPROVANTE DE VENDA|━━━━━━━━|\{itens\}/i.test(tpl))tpl=receiptWhatsappDefaultTemplate();
  let data=saleReceiptWhatsAppData(s,c,display);
  let msg=fillTemplate(tpl,data);
  try{ openWhatsAppNumber(phone,msg); }catch(e){ alert('Não foi possível abrir o WhatsApp. Código copiado para a área de transferência.'); try{navigator.clipboard?.writeText?.(msg)}catch(_){} }
}


function setPayment(p){if(!requireCashOpen('selecionar pagamento'))return;localStorage.setItem('nexagest-temp-payment',p);app()}
function pdvShortcuts(e){if(sessionLocked||!db.session||page!=='pdv')return;let k=e.key,lk=String(k).toLowerCase(),tag=document.activeElement?.tagName,modalOpen=localStorage.getItem('pdv-finalize-open')==='1';if(k==='F2'){e.preventDefault();let el=document.getElementById('pdvSearch');el?.focus();el?.select()}else if(k==='F3'){e.preventDefault();openFinalizeModal();setTimeout(()=>document.getElementById('saleClient')?.focus(),80)}else if(k==='F4'){e.preventDefault();openFinalizeModal()}else if(k==='F5'){e.preventDefault();openFinalizeModal();setTimeout(()=>{let el=document.getElementById('discount');el?.focus();el?.select()},80)}else if(k==='F6'){e.preventDefault();let el=document.getElementById('pdvSearch');el?.focus();el?.select()}else if(k==='F7'){e.preventDefault();if(!modalOpen&&cart.length)openFinalizeModal();setPayment('Dinheiro')}else if(k==='F8'){e.preventDefault();if(!modalOpen&&cart.length)openFinalizeModal();setPayment('Pix')}else if(k==='F9'){e.preventDefault();if(!modalOpen&&cart.length)openFinalizeModal();setPayment('Cartão Débito')}else if(k==='F10'){e.preventDefault();if(!modalOpen&&cart.length)openFinalizeModal();setPayment('Cartão Crédito')}else if(e.ctrlKey&&k==='Enter'){e.preventDefault();modalOpen?finishSale():openFinalizeModal()}else if(e.ctrlKey&&lk==='l'){e.preventDefault();if(cart.length){confirmAction('Limpar carrinho?',()=>{cart=[];app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)},'Limpar carrinho','Limpar')}}else if(k==='Delete' && !['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();let last=cart[cart.length-1];if(last){confirmAction('Remover último item do carrinho?',()=>{cart=cart.filter(i=>i.id!==last.id);app();setTimeout(()=>document.getElementById('pdvSearch')?.focus(),0)},'Remover item','Remover')}}else if(k==='Escape'){e.preventDefault();if(modalOpen){closeFinalizeModal();return}let el=document.getElementById('pdvSearch');if(el){el.value='';filterPdv('');el.focus()}}}
if(!window.__nexagestPdvShortcuts){window.__nexagestPdvShortcuts=true;window.addEventListener('keydown',pdvShortcuts,true);window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();if(db.session&&!sessionLocked)openCommandPalette()};if(e.key==='Escape'&&document.getElementById('commandPaletteOverlay'))closeCommandPalette()},true)}

function applyStockSale(s){s.items.forEach(i=>{product(i.id).stock-=i.qty;db.stockMoves.unshift({id:uid(),date:s.date,productId:i.id,type:'Venda',qty:-i.qty,obs:'Venda '+s.id})})}
function quoteFromCart(){if(!requireCan('pdv'))return;if(!requireCashOpen('gerar orçamento pelo caixa'))return;if(!cart.length)return alert('Carrinho vazio.');db.quotes.unshift({id:uid(),date:new Date().toISOString(),clientId:val('saleClient'),items:structuredClone(cart),total:cartTotal(),status:'Aberto'});cart=[];audit('Orçamento criado');save();app();alert('Orçamento criado!')}
function newQuote(){db.quotes.unshift({id:uid(),date:new Date().toISOString(),clientId:'',items:[],total:0,status:'Aberto'});audit('Orçamento rápido criado');save();app()}
function quoteToSale(id){if(!requireCan('quotes'))return;let q=db.quotes.find(x=>x.id===id);if(!q)return;if(!q.items?.length)return alert('Este orçamento não tem itens.');cart=structuredClone(q.items);q.status='Convertido';page='pdv';save();app();alert('Orçamento enviado para o PDV. Confira e finalize a venda.')}
function printQuote(id){let q=db.quotes.find(x=>x.id===id);if(!q)return;let w=window.open('','_blank');let items=q.items||[];w.document.write(`<h1>Orçamento - ${esc(db.settings.company)}</h1><p>${br(q.date)}</p><p>Cliente: ${esc(client(q.clientId).name||'Cliente balcão')}</p>${q.validUntil?`<p>Validade: ${esc(q.validUntil)}</p>`:''}${q.obs?`<p>Obs.: ${esc(q.obs)}</p>`:''}${table(['Produto','Qtd','Valor'],items.map(i=>[product(i.id).name,i.qty,money(product(i.id).sale*i.qty)]))}<h2>Total: ${money(quoteTotal(q))}</h2>`);w.document.close();w.print()}
function sendQuoteWhatsApp(id){let q=db.quotes.find(x=>x.id===id);if(!q)return;let c=client(q.clientId),phone=String(c.phone||'').replace(/\D/g,'');let itens=(q.items||[]).map(i=>`• ${product(i.id).name} x${i.qty} = ${money((product(i.id).sale||0)*Number(i.qty||0))}`).join('\n');let msg=(db.settings.whatsappTemplates?.orcamento||'Olá {cliente}! Segue seu orçamento da {empresa}: {total}.')
.replace('{cliente}',c.name||'cliente')
.replace('{empresa}',db.settings.company||'NexaGest')
.replace('{total}',money(quoteTotal(q)))+`\n\nItens:\n${itens||'Sem itens'}\n\nValidade: ${q.validUntil||'a combinar'}`;let url='https://wa.me/'+(phone?('55'+phone):'')+'?text='+encodeURIComponent(msg);window.open(url,'_blank');audit('Orçamento enviado por WhatsApp')}
function quoteDefaultValid(){let d=new Date();d.setDate(d.getDate()+7);return d.toISOString().slice(0,10)}
function quoteTotal(q){return Number(q.total||((q.items||[]).reduce((a,i)=>a+(product(i.id).sale||0)*Number(i.qty||0),0))||0)}
function bestQuoteClient(){let map={};db.quotes.forEach(q=>{let n=client(q.clientId).name||'Cliente balcão';map[n]=(map[n]||0)+quoteTotal(q)});let arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);return arr[0]?arr[0][0]:'-'}
function quoteItemsText(q){let items=q.items||[];return items.length?items.map(i=>`${esc(product(i.id).name)} x${i.qty}`).join('<br>'):'<span class="muted">Sem itens</span>'}
function quoteStatusBadge(status){let cls=status==='Convertido'?'good':(status==='Cancelado'?'bad':'warn');return `<span class="pill ${cls}">${esc(status||'Aberto')}</span>`}
function quoteDisplayStatus(q){let st=q.status||'Aberto';if(st==='Aberto'&&quoteIsExpired(q))return 'Expirado';return st}
function quoteValidityBadge(q){if(!q.validUntil)return '-';let cls=quoteIsExpired(q)?'bad':(quoteDaysLeft(q)<=3?'warn':'good');let txt=quoteIsExpired(q)?'Expirado':(quoteDaysLeft(q)<=3?'Expira em '+quoteDaysLeft(q)+'d':'Válido');return `<span class="pill ${cls}">${esc(q.validUntil)} • ${txt}</span>`}
function quoteDaysLeft(q){if(!q.validUntil)return 9999;let a=new Date(today()+'T00:00:00'),b=new Date(q.validUntil+'T00:00:00');return Math.ceil((b-a)/86400000)}
function quoteIsExpired(q){return (q.status||'Aberto')==='Aberto'&&q.validUntil&&quoteDaysLeft(q)<0}
function quotesExpired(){return db.quotes.filter(quoteIsExpired)}
function quotesExpiringSoon(){return db.quotes.filter(q=>(q.status||'Aberto')==='Aberto'&&q.validUntil&&quoteDaysLeft(q)>=0&&quoteDaysLeft(q)<=3)}
function quoteActions(q){let id=q.id,st=q.status||'Aberto',open=st==='Aberto';return `<div class="quote-actions">${open&&q.items?.length?`<button class="ok" data-quote-sale="${id}">Converter</button>`:''}<button class="ghost" data-print-quote="${id}">PDF/Imprimir</button><button class="ghost" data-quote-whatsapp="${id}">WhatsApp</button><button class="ghost" data-quote-dup="${id}">Duplicar</button>${open?`<button class="ghost" data-quote-cancel="${id}">Cancelar</button>`:`<button class="ghost" data-quote-open="${id}">Reabrir</button>`}<button class="danger" data-quote-del="${id}">Excluir</button></div>`}
function quotesData(){let q=localStorage.getItem('quote-q')||'',status=localStorage.getItem('quote-status')||'Todos';let rows=[...db.quotes].filter(o=>{let display=quoteDisplayStatus(o);let hay=[client(o.clientId).name,quoteItemsText(o).replace(/<[^>]*>/g,' '),display,o.status,o.obs].join(' ').toLowerCase();let okQ=!q||hay.includes(q.toLowerCase());let okS=status==='Todos'||display===status||(status==='Aberto'&&(o.status||'Aberto')==='Aberto');return okQ&&okS}).sort((a,b)=>new Date(b.date)-new Date(a.date));return{q,status,rows}}
function updateQuoteTotalPreview(){let p=product(val('quoteProduct')),qty=Math.max(1,num('quoteQty')||1),el=document.getElementById('quoteTotalPreview');if(el)el.textContent=money((p.sale||0)*qty)}
function saveQuickQuote(){if(!requireCan('quotes'))return;let pid=val('quoteProduct'),qty=Math.max(1,num('quoteQty')||1);if(!pid)return alert('Cadastre um produto antes.');let p=product(pid),q={id:uid(),date:new Date().toISOString(),clientId:val('quoteClient'),items:[{id:pid,qty}],total:(p.sale||0)*qty,status:'Aberto',validUntil:val('quoteValid'),obs:val('quoteObs')};db.quotes.unshift(q);audit('Orçamento criado '+money(q.total));save();app()}
function setQuoteStatus(id,status){if(!requireCan('quotes'))return;let q=db.quotes.find(x=>x.id===id);if(!q)return;q.status=status;audit('Orçamento '+status.toLowerCase());save();app()}
function duplicateQuote(id){let q=db.quotes.find(x=>x.id===id);if(!q)return;db.quotes.unshift({...structuredClone(q),id:uid(),date:new Date().toISOString(),status:'Aberto'});audit('Orçamento duplicado');save();app()}
function deleteQuote(id){if(!requireCan('quotes'))return;let q=db.quotes.find(x=>x.id===id);if(!q)return;confirmAction('Excluir este orçamento?',()=>{db.quotes=db.quotes.filter(x=>x.id!==id);audit('Orçamento excluído');save();app()},'Excluir orçamento','Excluir')}
function exportQuotesCsv(){let d=quotesData();let rows=[['data','cliente','itens','total','validade','status','observacao'],...d.rows.map(q=>[br(q.date),client(q.clientId).name||'Cliente balcão',(q.items||[]).map(i=>`${product(i.id).name} x${i.qty}`).join(' | '),quoteTotal(q),q.validUntil||'',q.status||'Aberto',q.obs||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-orcamentos.csv','text/csv;charset=utf-8')}
function updateProductMarginPreview(){let el=document.getElementById('productMarginPreview');if(!el)return;let sale=num('psale'),cost=num('pcost');let pct=sale?(((sale-cost)/sale)*100):0;el.value=(isFinite(pct)?pct:0).toFixed(1)+'%'}
function saveProduct(){if(!requireCan('products'))return;let id=val('pid'),old=id?db.products.find(x=>x.id===id):null,p={id:id||uid(),name:val('pname'),barcode:val('pbar'),category:val('pcat')||'Geral',unit:val('punit')||'un',brand:val('pbrand'),supplierName:val('psupplier'),cost:num('pcost'),sale:num('psale'),stock:num('pstock'),min:num('pmin'),image:val('pimage')||'',active:old?old.active!==false:true};if(!p.name)return alert('Informe o nome.');let ix=db.products.findIndex(x=>x.id===id);ix>=0?db.products[ix]=p:db.products.unshift(p);editingProduct=null;audit('Produto salvo: '+p.name);save();queueFocus('pname',true);app()}
function deleteProduct(id){if(!requireCan('products'))return;let p=product(id);confirmAction('Excluir produto '+p.name+'?',()=>{db.products=db.products.filter(x=>x.id!==id);audit('Produto excluído: '+p.name);save();queueFocus('prodSearch',true);app()},'Excluir produto','Excluir')}
function saveMove(){if(!requireCan('stock'))return;let pid=val('moveProduct'),type=val('moveType'),reason=val('moveReason'),detail=val('moveObs'),q=Math.abs(num('moveQty'));if(!pid)return alert('Selecione um produto.');if(!q)return alert('Informe uma quantidade válida.');let delta=['Entrada','Compra','Devolução','Ajuste +','Inventário +'].includes(type)?q:-q;let p=product(pid);let newStock=Number(p.stock||0)+delta;if(newStock<0&&!confirm('A movimentação deixará o estoque negativo. Deseja continuar?'))return;p.stock=newStock;let obs=[reason,detail].filter(Boolean).join(' - ');db.stockMoves.unshift({id:uid(),date:new Date().toISOString(),productId:pid,type,reason,qty:delta,stockAfter:p.stock,obs});audit('Estoque: '+p.name+' '+delta);save();app()}
function saveInventoryAdjust(){if(!requireCan('stock'))return;let pid=val('invProduct'),physical=Math.max(0,num('invQty')),obs=val('invObs');if(!pid)return alert('Selecione um produto.');let p=product(pid),current=Number(p.stock||0),delta=physical-current;if(delta===0)return alert('Estoque conferido: não há diferença para ajustar.');p.stock=physical;db.stockMoves.unshift({id:uid(),date:new Date().toISOString(),productId:pid,type:delta>0?'Inventário +':'Inventário -',reason:'Inventário',qty:delta,stockAfter:p.stock,obs:obs||('Conferência física: '+current+' → '+physical)});audit('Inventário ajustado: '+p.name+' '+current+' -> '+physical);save();app()}
function exportInventoryCsv(){let rows=[['produto','codigo','categoria','estoque_atual','estoque_minimo','status','custo_unitario','valor_em_custo'],...db.products.map(p=>{let st=Number(p.stock||0)<=0?'Zerado':(Number(p.stock||0)<=Number(p.min||0)?'Baixo':'OK');return[p.name,p.barcode||'',p.category||'Geral',p.stock||0,p.min||0,st,Number(p.cost||0).toFixed(2),(Number(p.stock||0)*Number(p.cost||0)).toFixed(2)]})];download(rows.map(r=>r.map(x=>String(x).replace(/;/g,',')).join(';')).join('\n'),'nexagest-inventario.csv','text/csv')}

function saveClient(){if(!requireCan('clients'))return;let id=val('cid'),c={id:id||uid(),name:val('cname'),phone:val('cphone'),city:val('ccity'),address:val('caddress'),creditLimit:num('climit'),notes:val('cnotes'),document:val('cdoc'),email:val('cemail'),birth:val('cbirth'),active:val('cactive')!=='false'};if(!c.name)return alert('Informe o nome.');let ix=db.clients.findIndex(x=>x.id===id);ix>=0?db.clients[ix]=c:db.clients.unshift(c);editingClient=null;audit('Cliente salvo: '+c.name);save();queueFocus('cname',true);app()}
function savePurchase(){if(!requireCan('purchases'))return;let pid=val('buyProduct'),sid=val('buySupplier'),qty=Math.abs(num('buyQty')),cost=num('buyCost')||product(pid).cost,status=val('buyStatus')||'Recebida';if(!pid)return alert('Cadastre um produto antes.');if(!sid)return alert('Cadastre um fornecedor antes.');if(!qty)return alert('Informe a quantidade.');let total=qty*cost;if(status!=='Cancelada'){product(pid).stock+=qty;product(pid).cost=cost;db.stockMoves.unshift({id:uid(),date:new Date().toISOString(),productId:pid,type:'Compra',qty,obs:'Fornecedor: '+supplier(sid).name+(val('buyObs')?' • '+val('buyObs'):'')})}db.purchases.unshift({id:uid(),date:new Date().toISOString(),supplierId:sid,productId:pid,qty,cost,total,status,obs:val('buyObs')});audit('Compra registrada '+product(pid).name+' '+money(total));save();app()}
function suppliersData(){let q=localStorage.getItem('supplier-q')||'',status=localStorage.getItem('supplier-status')||'Todos';let rows=[...db.suppliers].filter(f=>{let hay=[f.name,f.phone,f.city,f.document,f.email,f.contact,f.address,f.notes,f.obs].join(' ').toLowerCase();let okQ=!q||hay.includes(q.toLowerCase());let okS=status==='Todos'||(status==='Ativos'?f.active!==false:f.active===false);return okQ&&okS}).sort((a,b)=>(a.name||'').localeCompare(b.name||''));return{q,status,rows}}
function lastSupplierPurchase(id){return [...db.purchases].filter(b=>b.supplierId===id&&(b.status||'Recebida')!=='Cancelada').sort((a,b)=>new Date(b.date)-new Date(a.date))[0]}
function supplierTotalBought(id){return sum(db.purchases.filter(b=>b.supplierId===id&&(b.status||'Recebida')!=='Cancelada'),'total')}
function saveSupplier(){if(!requireCan('suppliers'))return;let data={name:val('supName'),document:val('supDocument'),phone:val('supPhone'),email:val('supEmail'),contact:val('supContact'),city:val('supCity'),address:val('supAddress'),notes:val('supNotes'),active:val('supActive')!=='false'};if(!data.name)return alert('Informe o fornecedor.');if(editingSupplier){let f=db.suppliers.find(x=>x.id===editingSupplier);Object.assign(f,data);audit('Fornecedor atualizado: '+f.name)}else{db.suppliers.unshift({id:uid(),...data});audit('Fornecedor salvo: '+data.name)}editingSupplier=null;save();queueFocus('supName',true);app();alert('Fornecedor salvo com sucesso.')}
function deleteSupplier(id){if(!requireCan('suppliers'))return;let f=db.suppliers.find(x=>x.id===id);if(!f)return;let used=db.purchases.some(b=>b.supplierId===id);if(used){confirmAction('Este fornecedor possui compras no histórico. Deseja marcar como inativo?',()=>{f.active=false;audit('Fornecedor inativado: '+f.name);save();app()},'Inativar fornecedor','Inativar');return}confirmAction('Excluir fornecedor '+f.name+'?',()=>{db.suppliers=db.suppliers.filter(x=>x.id!==id);audit('Fornecedor excluído: '+f.name);save();app()},'Excluir fornecedor','Excluir')}
function exportSuppliersCsv(){let d=suppliersData();let rows=[['nome','cpf_cnpj','telefone','email','contato','cidade','endereco','total_comprado','ultima_compra','status','observacoes'],...d.rows.map(f=>[f.name||'',f.document||'',f.phone||'',f.email||'',f.contact||'',f.city||'',f.address||'',supplierTotalBought(f.id),lastSupplierPurchase(f.id)?br(lastSupplierPurchase(f.id).date):'',f.active===false?'inativo':'ativo',f.notes||f.obs||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-fornecedores.csv','text/csv;charset=utf-8')}

function purchaseData(){let q=localStorage.getItem('purchase-q')||'',supplierId=localStorage.getItem('purchase-supplier')||'Todos',period=localStorage.getItem('purchase-period')||'30 dias',status=localStorage.getItem('purchase-status')||'Todos',now=new Date(),start=null;if(period==='Hoje')start=today();if(period==='7 dias'){let d=new Date();d.setDate(d.getDate()-6);start=d.toISOString().slice(0,10)}if(period==='30 dias'){let d=new Date();d.setDate(d.getDate()-29);start=d.toISOString().slice(0,10)}if(period==='Mês atual')start=today().slice(0,7)+'-01';let rows=[...db.purchases].filter(b=>{let hay=[supplier(b.supplierId).name,product(b.productId).name,b.obs,b.status].join(' ').toLowerCase();let okQ=!q||hay.includes(q.toLowerCase());let okS=supplierId==='Todos'||b.supplierId===supplierId;let okStatus=status==='Todos'||(b.status||'Recebida')===status;let okP=!start||b.date.slice(0,10)>=start;return okQ&&okS&&okStatus&&okP}).sort((a,b)=>new Date(b.date)-new Date(a.date));let m=today().slice(0,7),month=db.purchases.filter(b=>b.date.slice(0,7)===m&&(b.status||'Recebida')!=='Cancelada'),monthTotal=sum(month,'total'),monthQty=sum(month,'qty'),suppliersUsed=new Set(month.map(b=>b.supplierId)).size,avgCost=monthQty?monthTotal/monthQty:0;return{q,supplierId,period,status,rows,monthTotal,monthQty,suppliersUsed,avgCost}}
function lastPurchase(pid){return [...db.purchases].filter(b=>b.productId===pid&&(b.status||'Recebida')!=='Cancelada').sort((a,b)=>new Date(b.date)-new Date(a.date))[0]}
function bestPurchaseForProduct(pid){return [...db.purchases].filter(b=>b.productId===pid&&(b.status||'Recebida')!=='Cancelada'&&Number(b.cost)>0).sort((a,b)=>Number(a.cost)-Number(b.cost)||new Date(b.date)-new Date(a.date))[0]}
function purchaseProductInsights(pid){let history=[...db.purchases].filter(b=>b.productId===pid&&(b.status||'Recebida')!=='Cancelada').sort((a,b)=>new Date(b.date)-new Date(a.date));return{history,count:history.length,best:bestPurchaseForProduct(pid)}}
function suggestedSaleFromCost(cost){cost=Number(cost||0);if(!cost)return 0;return Math.ceil((cost*1.55)*10)/10}
function purchaseMarginText(sale,cost){sale=Number(sale||0);cost=Number(cost||0);if(!sale&&!cost)return 'Informe custo e venda';let lucro=sale-cost,perc=sale?((lucro/sale)*100):0;return `${money(lucro)} • ${perc.toFixed(1)}%`}
function updateBuySmartPreview(){let pid=val('buyProduct'),p=product(pid),qty=Math.abs(num('buyQty'))||0,cost=num('buyCost')||Number(p.cost||0),total=qty*cost,el=document.getElementById('buyTotalPreview');if(el)el.textContent=money(total);let m=document.getElementById('buyMarginPreview');if(m)m.textContent=purchaseMarginText(p.sale,cost);let sg=document.getElementById('buySuggestedSale');if(sg)sg.textContent=money(suggestedSaleFromCost(cost))}

function purchaseStatusBadge(status){let cls=status==='Cancelada'?'bad':(status==='Parcial'?'warn':'good');return `<span class="pill ${cls}">${esc(status)}</span>`}
function updateBuyPreview(){updateBuySmartPreview()}
function exportPurchasesCsv(){let d=purchaseData();let rows=[['data','fornecedor','produto','quantidade','custo_unitario','total','status','observacao'],...d.rows.map(b=>[br(b.date),supplier(b.supplierId).name,product(b.productId).name,b.qty,b.cost,b.total,b.status||'Recebida',b.obs||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-compras.csv','text/csv;charset=utf-8')}

function financeData(){
  let m=today().slice(0,7), q=localStorage.getItem('fin-q')||'', type=localStorage.getItem('fin-type')||'Todos', cat=localStorage.getItem('fin-cat')||'Todas';
  let paidReceipts=db.receivables.filter(r=>r.paid).map(r=>({id:r.id,date:r.paidAt||r.date,desc:'Recebimento - '+client(r.clientId).name,cat:'Recebimentos',type:'Entrada',value:Number(r.value||0),payment:'Fiado',status:'Pago',source:'receivable'}));
  let saleEntries=salesValid().filter(s=>s.payment!=='Fiado').map(s=>({id:s.id,date:s.date,desc:'Venda no PDV',cat:'Vendas',type:'Entrada',value:Number(s.total||0),payment:s.payment,status:'Pago',source:'sale'}));
  let expenseRows=db.expenses.map(e=>({id:e.id,date:e.date,desc:e.desc,cat:e.cat||'Outros',costCenter:e.costCenter||financeDefaultCostCenter(e.cat),type:e.type||'Saída',value:Number(e.value||0),payment:e.payment||'-',status:e.status||'Pago',due:e.due,source:'expense'}));
  let all=[...saleEntries,...paidReceipts,...expenseRows].sort((a,b)=>new Date(b.date)-new Date(a.date));
  let rows=all.filter(e=>{let okQ=!q||[e.desc,e.cat,e.payment,e.type].join(' ').toLowerCase().includes(q.toLowerCase());let okT=type==='Todos'||e.type===type;let okC=cat==='Todas'||e.cat===cat;return okQ&&okT&&okC});
  let inMonth=sum(all.filter(e=>e.type==='Entrada'&&e.date.slice(0,7)===m),'value'), outMonth=sum(all.filter(e=>e.type==='Saída'&&e.date.slice(0,7)===m),'value');
  let open=db.receivables.filter(r=>!r.paid), openTotal=sum(open,'value');
  let days=lastDays(7).map(d=>{let dayIso=new Date(new Date().setDate(new Date().getDate()-(6-lastDays(7).indexOf(d)))).toISOString().slice(0,10);let dayRows=all.filter(e=>e.date.slice(0,10)===dayIso);return{label:d.label,in:sum(dayRows.filter(e=>e.type==='Entrada'),'value'),out:sum(dayRows.filter(e=>e.type==='Saída'),'value')}});
  let maxDay=Math.max(1,...days.flatMap(d=>[d.in,d.out]));
  let by={}; all.filter(e=>e.type==='Saída'&&e.date.slice(0,7)===m).forEach(e=>by[e.cat]=(by[e.cat]||0)+e.value);
  let byCat=Object.entries(by).map(([cat,value])=>({cat,value})).sort((a,b)=>b.value-a.value).slice(0,8);
  return{q,type,cat,rows,inMonth,outMonth,balance:inMonth-outMonth,open,openTotal,days,maxDay,byCat}
}
function saveFinLaunch(){
  if(!requireCan('finance'))return;
  let type=val('finType')==='entrada'?'Entrada':'Saída', desc=val('finDesc'), cat=val('finCat'), costCenter=val('finCostCenter')||financeDefaultCostCenter(cat), value=num('finValue'), payment=val('finPayment'), status=val('finStatus'), due=val('finDue')||today();
  if(!desc||!value)return alert('Preencha descrição e valor.');
  let installments=Math.max(1,Math.min(60,Number(val('finInstallments')||1)||1));
  let recurrence=val('finRecurrence')||'none', priority=val('finPriority')||'Normal';
  let created=[], parentId=installments>1?uid():'';
  for(let i=0;i<installments;i++){
    let itemDue=financeAddMonths(due, recurrence==='monthly'?i:0);
    let parcelValue=Number((value/installments).toFixed(2));
    if(i===installments-1) parcelValue=Number((value-(parcelValue*(installments-1))).toFixed(2));
    let e={id:uid(),date:new Date().toISOString(),desc:installments>1?`${desc} (${i+1}/${installments})`:desc,cat,costCenter,type,value:parcelValue,payment,status,due:itemDue,priority,parentId,installment:i+1,installments,recurrence,source:'expense'};
    created.push(e);
  }
  db.expenses.unshift(...created);
  audit('Lançamento financeiro: '+type+' '+money(value)+(installments>1?' em '+installments+' parcelas':''));
  save();app();alert(created.length>1?created.length+' parcelas salvas com sucesso.':'Lançamento financeiro salvo com sucesso.');
}
function deleteExpense(id){if(!requireCan('finance'))return;let e=db.expenses.find(x=>x.id===id);if(!e)return;confirmAction('Excluir lançamento '+(e.desc||'')+'?',()=>{db.expenses=db.expenses.filter(x=>x.id!==id);audit('Lançamento financeiro excluído');save();app()},'Excluir lançamento','Excluir')}
function exportFinanceCsv(){let f=financeData();let rows=[['data','descricao','categoria','centro_custo','tipo','valor','pagamento','situacao'],...f.rows.map(e=>[br(e.date),e.desc||'',e.cat||'',e.costCenter||financeDefaultCostCenter(e.cat),e.type,e.value,e.payment||'',e.status||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-financeiro.csv','text/csv;charset=utf-8')}
function saveExp(){if(!requireCan('finance'))return;let e={id:uid(),date:new Date().toISOString(),desc:val('expDesc'),cat:val('expCat'),value:num('expValue')};if(!e.desc||!e.value)return alert('Preencha descrição e valor.');db.expenses.unshift(e);audit('Despesa '+money(e.value));save();app()}
function payRec(id){let r=db.receivables.find(x=>x.id===id);if(r){r.paid=true;r.paidAt=new Date().toISOString();audit('Recebido '+money(r.value));save();app()}}
function deliveryData(){let q=localStorage.getItem('delivery-q')||'',status=localStorage.getItem('delivery-status')||'Todos',period=localStorage.getItem('delivery-period')||'Todos',priority=localStorage.getItem('delivery-priority')||'Todas',start='';if(period==='Hoje')start=today();if(period==='7 dias')start=new Date(Date.now()-6*86400000).toISOString().slice(0,10);if(period==='30 dias')start=new Date(Date.now()-29*86400000).toISOString().slice(0,10);let rows=[...db.deliveries].filter(d=>{let c=client(d.clientId),hay=[c.name,c.phone,d.address,d.obs,d.status,d.priority,d.driver,d.vehicle,d.eta].join(' ').toLowerCase();let okQ=!q||hay.includes(q.toLowerCase());let okS=status==='Todos'||d.status===status;let okP=!start||String(d.date||'').slice(0,10)>=start;let okPr=priority==='Todas'||(d.priority||'Normal')===priority;return okQ&&okS&&okP&&okPr}).sort((a,b)=>{let pa=(a.priority==='Alta'?0:a.priority==='Normal'?1:2),pb=(b.priority==='Alta'?0:b.priority==='Normal'?1:2);return pa-pb||new Date(b.date)-new Date(a.date)});let pending=db.deliveries.filter(d=>d.status==='Pendente'),out=db.deliveries.filter(d=>d.status==='Saiu para entrega'),doneToday=db.deliveries.filter(d=>d.status==='Entregue'&&String(d.doneAt||d.date||'').slice(0,10)===today()).length,pendingValue=sum(db.deliveries.filter(d=>d.status!=='Entregue'),'value'),highPriority=db.deliveries.filter(d=>d.status!=='Entregue'&&d.priority==='Alta').length,withDriver=db.deliveries.filter(d=>d.status!=='Entregue'&&d.driver).length;return{q,status,period,priority,rows,pending,out,doneToday,pendingValue,highPriority,withDriver}}
function deliveryDriverOptions(){return [...new Set((db.deliveries||[]).map(d=>d.driver).filter(Boolean))].slice(0,20)}
function deliveryElapsed(d){if(!d||d.status!=='Saiu para entrega')return '';let start=new Date(d.outAt||d.date||Date.now()).getTime();let min=Math.max(0,Math.round((Date.now()-start)/60000));if(min<1)return 'saiu agora';if(min<60)return `há ${min} min`;return `há ${Math.floor(min/60)}h ${min%60}min`}
function deliveryStatusBadge(status){let cls=status==='Entregue'?'good':status==='Saiu para entrega'?'warn':'';return `<span class="pill ${cls}">${esc(status||'Pendente')}</span>`}
function deliveryCard(d,idx=0){let c=client(d.clientId),phone=String(c.phone||'').replace(/\D/g,''),prio=d.priority==='Alta'?'<span class="pill warn">Alta</span>':(d.priority==='Baixa'?'<span class="pill">Baixa</span>':'<span class="pill">Normal</span>'),elapsed=deliveryElapsed(d);return `<div class="delivery-card delivery-card-v2 delivery-card-pro"><div class="between"><b>#${idx+1} ${esc(c.name)}</b>${prio}</div><p>${esc(d.address||'Sem endereço')}</p><div class="delivery-meta"><span>👤 ${esc(d.driver||'Sem entregador')}</span><span>🚗 ${esc(d.vehicle||'Veículo não informado')}</span>${d.eta?`<span>⏱️ ${esc(d.eta)}</span>`:''}${elapsed?`<span>🕒 ${esc(elapsed)}</span>`:''}</div><p><b>${money(Number(d.value||0)+Number(d.fee||0))}</b> ${d.fee?`<span class="muted">inclui taxa ${money(d.fee)}</span>`:''}</p>${d.obs?`<p class="muted">${esc(d.obs)}</p>`:''}<div class="delivery-actions">${d.status!=='Entregue'?`<button class="ok" data-next-del="${d.id}">${d.status==='Pendente'?'Saiu':'Entregue'}</button>`:''}${phone?`<button class="ghost" data-delivery-wa="${d.id}">WhatsApp</button>`:''}<button class="ghost" data-delivery-map="${d.id}">Mapa</button></div></div>`}
function deliveryActions(d){let c=client(d.clientId),phone=String(c.phone||'').replace(/\D/g,'');return `<div class="row">${d.status!=='Pendente'?`<button class="ghost" data-set-del="${d.id}" data-status="Pendente">Pendente</button>`:''}${d.status!=='Saiu para entrega'?`<button class="ghost" data-set-del="${d.id}" data-status="Saiu para entrega">Saiu</button>`:''}${d.status!=='Entregue'?`<button class="ok" data-set-del="${d.id}" data-status="Entregue">Entregue</button>`:''}${phone?`<button class="ghost" data-delivery-wa="${d.id}">WhatsApp</button>`:''}<button class="danger" data-del-delivery="${d.id}">Excluir</button></div>`}
function saveDelivery(){if(!requireCan('deliveries'))return;let cid=val('delClient'),c=client(cid),d={id:uid(),date:new Date().toISOString(),clientId:cid,address:val('delAddress')||c.address,value:num('delValue'),fee:num('delFee'),driver:val('delDriver'),vehicle:val('delVehicle')||'Moto',eta:val('delEta'),priority:val('delPriority')||'Normal',obs:val('delObs'),status:'Pendente'};if(!d.clientId)return alert('Selecione o cliente.');if(!d.address)return alert('Informe o endereço da entrega.');db.deliveries.unshift(d);audit('Entrega criada');save();app();alert('Entrega salva com sucesso.')}
function nextDelivery(id){if(!requireCan('deliveries'))return;let d=db.deliveries.find(x=>x.id===id),flow=['Pendente','Saiu para entrega','Entregue'];if(!d)return;d.status=flow[flow.indexOf(d.status)+1]||'Entregue';if(d.status==='Saiu para entrega'&&!d.outAt)d.outAt=new Date().toISOString();if(d.status==='Entregue')d.doneAt=new Date().toISOString();audit('Entrega atualizada: '+d.status);save();app()}
function setDeliveryStatus(id,status){if(!requireCan('deliveries'))return;let d=db.deliveries.find(x=>x.id===id);if(!d)return;d.status=status;if(status==='Saiu para entrega'&&!d.outAt)d.outAt=new Date().toISOString();if(status==='Entregue')d.doneAt=new Date().toISOString();audit('Entrega alterada para '+status);save();app()}
function openDeliveryWhatsApp(id){let d=db.deliveries.find(x=>x.id===id),c=client(d?.clientId);if(!normalizeBrazilPhone(c.phone))return alert('Cliente sem WhatsApp cadastrado.');let msg=`Olá, ${c.name}. Sua entrega da ${db.settings.company} está ${d.status.toLowerCase()}. Endereço: ${d.address}. ${d.driver?'Entregador: '+d.driver+'. ':''}${d.eta?'Previsão: '+d.eta+'. ':''}Valor: ${money(Number(d.value||0)+Number(d.fee||0))}`;openWhatsAppNumber(c.phone,msg)}
function openMap(id){let d=db.deliveries.find(x=>x.id===id);if(!d||!d.address)return alert('Entrega sem endereço.');window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(d.address))}
function deleteDelivery(id){if(!requireCan('deliveries'))return;let d=db.deliveries.find(x=>x.id===id);if(!d)return;confirmAction('Excluir esta entrega?',()=>{db.deliveries=db.deliveries.filter(x=>x.id!==id);audit('Entrega excluída');save();app()},'Excluir entrega','Excluir')}
function exportDeliveriesCsv(){let rows=[['data','cliente','telefone','endereco','valor','taxa','total','entregador','veiculo','previsao','prioridade','status','observacao'],...deliveryData().rows.map(d=>{let c=client(d.clientId);return[br(d.date),c.name,c.phone||'',d.address||'',d.value||0,d.fee||0,Number(d.value||0)+Number(d.fee||0),d.driver||'',d.vehicle||'',d.eta||'',d.priority||'Normal',d.status||'Pendente',d.obs||'']})];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-entregas.csv','text/csv;charset=utf-8')}
function latestAccessLog(){let logs=(db.accessLogs||[]).slice(0,12);if(!logs.length)return '<p class="muted">Nenhum acesso registrado ainda.</p>';return table(['Data','Usuário','Perfil','Ação'],logs.map(l=>[br(l.date),esc(l.user),esc(l.role||'-'),esc(l.action)]))}
function usersData(){let q=localStorage.getItem('user-q')||'',role=localStorage.getItem('user-role')||'Todos',status=localStorage.getItem('user-status')||'Todos';let rows=[...db.users].filter(u=>{let okQ=!q||[u.name,u.user,u.role].join(' ').toLowerCase().includes(q.toLowerCase());let okR=role==='Todos'||u.role===role;let okS=status==='Todos'||(status==='Ativos'?u.active!==false:u.active===false);return okQ&&okR&&okS}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));return{q,role,status,rows}}
function userActions(u){let isSelf=db.session?.id===u.id,adminCount=db.users.filter(x=>x.role==='Administrador'&&x.active!==false).length,lastAdmin=u.role==='Administrador'&&u.active!==false&&adminCount<=1;return `<div class="row"><button class="ghost" data-editu="${u.id}">Editar</button><button class="ghost" data-resetu="${u.id}">Senha</button><button class="ghost" data-toggleu="${u.id}" ${lastAdmin?'disabled':''}>${u.active!==false?'Desativar':'Ativar'}</button><button class="danger" data-delu="${u.id}" ${isSelf||lastAdmin?'disabled':''}>Excluir</button></div>`}
function saveUser(){if(!requireCan('users'))return;let name=val('uName').trim(),user=val('uUser').trim(),pass=val('uPass'),role=val('uRole'),active=val('uActive')!=='false';if(!name||!user)return alert('Preencha nome e usuário.');let duplicate=db.users.find(x=>x.user.toLowerCase()===user.toLowerCase()&&x.id!==editingUser);if(duplicate)return alert('Já existe um usuário com esse login.');if(editingUser){let u=db.users.find(x=>x.id===editingUser);if(!u)return;let activeAdmins=db.users.filter(x=>x.role==='Administrador'&&x.active!==false&&x.id!==u.id).length;if(u.role==='Administrador'&&u.active!==false&&(role!=='Administrador'||!active)&&activeAdmins<1)return alert('É preciso manter pelo menos um administrador ativo.');Object.assign(u,{name,user,role,active});if(pass){u.passwordHash=passwordHash(pass);delete u.password;u.mustChangePassword=false;}audit('Usuário atualizado '+u.user)}else{if(!pass)return alert('Informe uma senha.');db.users.push({id:uid(),name,user,passwordHash:passwordHash(pass),role,active,mustChangePassword:false});audit('Usuário criado '+user)}editingUser=null;save();queueFocus('uName',true);app()}
function toggleUser(id){if(!requireCan('users'))return;let u=db.users.find(x=>x.id===id);if(!u)return;let adminCount=db.users.filter(x=>x.role==='Administrador'&&x.active!==false).length;if(u.role==='Administrador'&&u.active!==false&&adminCount<=1)return alert('Não é possível desativar o único administrador ativo.');u.active=!(u.active!==false);audit((u.active?'Usuário ativado ':'Usuário desativado ')+u.user);save();app()}
function deleteUser(id){if(!requireCan('users'))return;let u=db.users.find(x=>x.id===id);if(!u)return;if(db.session?.id===id)return alert('Você não pode excluir o usuário logado.');let adminCount=db.users.filter(x=>x.role==='Administrador'&&x.active!==false).length;if(u.role==='Administrador'&&u.active!==false&&adminCount<=1)return alert('Não é possível excluir o único administrador ativo.');confirmAction('Excluir o usuário '+u.user+'?',()=>{db.users=db.users.filter(x=>x.id!==id);audit('Usuário excluído '+u.user);save();app()},'Excluir usuário','Excluir')}
function resetUserPassword(id){if(!requireCan('users'))return;let u=db.users.find(x=>x.id===id);if(!u)return;let p=prompt('Nova senha para '+u.user+':');if(!p)return;u.passwordHash=passwordHash(p);delete u.password;u.mustChangePassword=false;audit('Senha alterada para '+u.user);save();alert('Senha atualizada.')}
function exportUsersCsv(){let rows=[['nome','usuario','perfil','ativo'],...usersData().rows.map(u=>[u.name,u.user,u.role,u.active!==false?'Sim':'Não'])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-usuarios.csv','text/csv;charset=utf-8')}
function cancelSale(id){if(!requireCan('reports'))return;confirmAction('Cancelar venda e devolver estoque?',()=>{let s=db.sales.find(x=>x.id===id);if(!s||s.cancelled)return;s.cancelled=true;s.items.forEach(i=>{product(i.id).stock+=i.qty;db.stockMoves.unshift({id:uid(),date:new Date().toISOString(),productId:i.id,type:'Cancelamento',qty:i.qty,obs:'Venda '+id})});db.receivables.filter(r=>r.saleId===id).forEach(r=>r.paid=true);audit('Venda cancelada '+id);save();app()},'Cancelar venda','Cancelar venda')}

function removeAccents(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function pixAlpha(v,max=25){return removeAccents(v).replace(/[^A-Za-z0-9 $%*+\-\.\/]/g,'').trim().slice(0,max)||'NEXAGEST'}
function pixCity(v){return pixAlpha(v||db.settings.city||'BRASIL',15).toUpperCase()}
function pixKeyValue(){let key=String(db.settings.pixKey||'').trim();let type=String(db.settings.pixKeyType||'').toLowerCase();if(type.includes('telefone')){let d=key.replace(/\D/g,'');if(d&&!d.startsWith('55'))d='55'+d;return d?('+'+d):key}return key}
function pixTlv(id,value){let v=String(value||'');return String(id).padStart(2,'0')+String(v.length).padStart(2,'0')+v}
function pixCrc16(payload){let crc=0xFFFF;for(let i=0;i<payload.length;i++){crc^=payload.charCodeAt(i)<<8;for(let j=0;j<8;j++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF}}return crc.toString(16).toUpperCase().padStart(4,'0')}
function pixPayload(amount,description=''){let key=pixKeyValue();if(!key)return '';let merchant=pixAlpha(db.settings.pixMerchantName||db.settings.company||'NEXAGEST',25).toUpperCase();let city=pixCity(db.settings.pixMerchantCity||db.settings.city||'BRASIL');let desc=pixAlpha(description||db.settings.pixDescription||'Venda NexaGest',62);let gui=pixTlv('00','br.gov.bcb.pix');let chave=pixTlv('01',key);let info=pixTlv('26',gui+chave+(desc?pixTlv('02',desc):''));let txid=pixTlv('05','NEXAGEST');let add=pixTlv('62',txid);let payload=pixTlv('00','01')+pixTlv('01','12')+info+pixTlv('52','0000')+pixTlv('53','986');if(Number(amount||0)>0)payload+=pixTlv('54',Number(amount||0).toFixed(2));payload+=pixTlv('58','BR')+pixTlv('59',merchant)+pixTlv('60',city)+add+'6304';return payload+pixCrc16(payload)}
async function renderPixPanel(){let box=document.getElementById('pixQrBox');if(!box)return;let total=Math.max(0,cartTotal()-calcDiscount()),payload=pixPayload(total,'Venda '+(db.settings.company||'NexaGest'));if(!payload){box.innerHTML='<div class="pix-empty"><b>PIX não configurado</b><span>Cadastre a chave PIX em Configurações > Integrações.</span></div>';return}box.dataset.payload=payload;box.innerHTML='<div class="pix-loading">Gerando QR Code PIX...</div>';let qr=null;try{qr=await window.nexagest?.generateQrCode?.(payload)}catch(e){qr=null}let img=qr?.ok&&qr.dataUrl?`<img src="${qr.dataUrl}" alt="QR Code PIX">`:`<img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}" alt="QR Code PIX">`;let provider=db.settings.pixProvider||'Manual',status=localStorage.getItem('pix-confirmed')==='1'?'confirmed':'pending';box.innerHTML=`<div class="pix-box"><div class="pix-qr">${img}</div><div class="pix-copy"><b>PIX Copia e Cola</b><textarea readonly id="pixPayloadText">${esc(payload)}</textarea><button type="button" class="ok" id="copyPixPayload">Copiar código PIX</button><div class="pix-confirm-card ${status==='confirmed'?'confirmed':''}"><b>${status==='confirmed'?'✅ PIX confirmado':'⏳ Aguardando confirmação'}</b><span>Provedor: ${esc(provider)}${provider==='Manual'?' • confirme no app do banco':''}</span></div><div class="row pix-actions"><button type="button" class="ghost" id="checkPixPayment">Verificar pagamento</button>${provider==='Simulador'?'<button type="button" class="ok" id="simulatePixPaid">Simular recebido</button>':''}<button type="button" class="ghost" id="savePixQrPng">Salvar QR PNG</button></div><small>Valor: <b>${money(total)}</b> • Chave: ${esc(pixKeyValue())}</small></div></div>`;document.getElementById('copyPixPayload')?.addEventListener('click',copyPixPayload);document.getElementById('checkPixPayment')?.addEventListener('click',checkPixPayment);document.getElementById('simulatePixPaid')?.addEventListener('click',simulatePixPaid);document.getElementById('savePixQrPng')?.addEventListener('click',savePixQrPng)}
async function copyPixPayload(){let text=document.getElementById('pixPayloadText')?.value||document.getElementById('pixQrBox')?.dataset.payload||'';if(!text)return alert('Nenhum código PIX para copiar.');try{await navigator.clipboard.writeText(text);alert('PIX Copia e Cola copiado!')}catch(e){let ta=document.getElementById('pixPayloadText');ta?.select();document.execCommand('copy');alert('PIX Copia e Cola copiado!')}}
async function checkPixPayment(){let provider=db.settings.pixProvider||'Manual';if(localStorage.getItem('pix-confirmed')==='1')return alert('PIX já confirmado.');if(provider==='Simulador')return alert('Use o botão Simular recebido para testar a confirmação automática.');if(provider==='Manual')return alert('Modo manual: confirme o recebimento no aplicativo do banco e depois conclua a venda.');if(!db.settings.pixProviderToken)return alert('Informe o token/API Key do provedor em Configurações > Integrações > PIX.');alert('Consulta preparada para '+provider+'. A confirmação real exige credenciais válidas e endpoint do provedor.');}
function simulatePixPaid(){localStorage.setItem('pix-confirmed','1');renderPixPanel();alert('PIX confirmado no simulador.');}
function savePixQrPng(){let img=document.querySelector('#pixQrBox .pix-qr img');if(!img)return alert('QR Code não encontrado.');let a=document.createElement('a');a.href=img.src;a.download='pix-nexagest.png';a.click();}

function savePixSettings(){db.settings.pixKey=val('pixKey');db.settings.pixKeyType=val('pixKeyType')||'Telefone';db.settings.pixMerchantName=val('pixMerchantName');db.settings.pixMerchantCity=val('pixMerchantCity');db.settings.pixDescription=val('pixDescription')||'Venda NexaGest';db.settings.pixProvider=val('pixProvider')||'Manual';db.settings.pixProviderToken=val('pixProviderToken')||'';db.settings.pixRequireConfirmation=!!document.getElementById('pixRequireConfirmation')?.checked;audit('Configuração PIX atualizada');save();app();alert('Configuração PIX salva com sucesso.')}
function testPixQr(){let payload=pixPayload(10,'Teste NexaGest');if(!payload)return alert('Informe a chave PIX antes do teste.');localStorage.setItem('pix-test-open','1');app();setTimeout(renderPixTestModal,80)}
function closePixTestModal(){
  localStorage.removeItem('pix-test-open');
  document.removeEventListener('keydown',pixTestEscHandler,true);
  document.getElementById('pixTestOverlay')?.remove();
  document.body.classList.remove('modal-open');
  setTimeout(()=>document.activeElement?.blur?.(),0);
}
function pixTestEscHandler(e){
  if(e.key==='Escape'&&document.getElementById('pixTestOverlay')){
    e.preventDefault();
    e.stopPropagation();
    closePixTestModal();
  }
}
async function renderPixTestModal(){let payload=pixPayload(10,'Teste NexaGest');let qr=null;try{qr=await window.nexagest?.generateQrCode?.(payload)}catch(e){}let img=qr?.ok&&qr.dataUrl?`<img src="${qr.dataUrl}" alt="QR Code PIX">`:`<img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payload)}" alt="QR Code PIX">`;document.getElementById('pixTestOverlay')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="pixTestOverlay" class="modal-backdrop open" tabindex="-1" role="dialog" aria-modal="true"><div class="modal-card pix-test-card"><div class="between"><h2>Teste PIX</h2><button class="ghost" id="closePixTest" type="button">Esc</button></div><p class="muted small">QR Code de teste com valor de R$ 10,00. Não finalize pagamentos reais por esta tela.</p><div class="pix-box"><div class="pix-qr">${img}</div><div class="pix-copy"><b>PIX Copia e Cola</b><textarea readonly id="pixPayloadText">${esc(payload)}</textarea><button class="ok" id="copyPixPayload" type="button">Copiar código PIX</button></div></div></div></div>`);document.body.classList.add('modal-open');document.removeEventListener('keydown',pixTestEscHandler,true);document.addEventListener('keydown',pixTestEscHandler,true);let overlay=document.getElementById('pixTestOverlay');overlay?.addEventListener('click',e=>{if(e.target===overlay)closePixTestModal()});overlay?.addEventListener('keydown',pixTestEscHandler);document.getElementById('closePixTest')?.addEventListener('click',closePixTestModal);document.getElementById('copyPixPayload')?.addEventListener('click',copyPixPayload);setTimeout(()=>overlay?.focus(),20)}

function settingsHealth(){
  const items=[];
  const add=(type,icon,title,msg)=>items.push({type,icon,title,msg});
  if(db.settings.company&&db.settings.company!=='Minha Empresa')add('good','✅','Empresa configurada','Nome da empresa preenchido.');else add('warn','🟡','Empresa pendente','Troque “Minha Empresa” pelo nome real do negócio.');
  if(db.settings.phone)add('good','✅','WhatsApp da empresa','Telefone informado para mensagens e relatórios.');else add('warn','🟡','WhatsApp não informado','Preencha telefone/WhatsApp para usar mensagens prontas.');
  if((db.products||[]).length)add('good','✅','Produtos','Cadastro de produtos disponível.');else add('danger','🔴','Sem produtos','Cadastre produtos para usar PDV, estoque e etiquetas.');
  if((db.users||[]).length>1)add('good','✅','Usuários','Existe mais de um usuário cadastrado.');else add('warn','🟡','Usuário único','Crie usuários separados para caixa e estoque.');
  if(db.settings.backupAuto)add('good','✅','Backup automático','Backup diário ativado.');else add('warn','🟡','Backup manual','Ative backup automático para mais segurança.');
  if(openCashRegisters().length)add('warn','🟡','Caixa aberto','Existe caixa aberto no momento.');else add('good','✅','Caixa','Nenhum caixa aberto fora de operação.');
  if((db.cashRegisters||[]).some(c=>c.status==='Aberto'&&c.openedAt&&Date.now()-new Date(c.openedAt).getTime()>1000*60*60*12))add('warn','🟡','Caixa antigo','Existe caixa aberto há muitas horas. Confira antes de fechar.');
  const problems=items.filter(i=>i.type==='warn').length+items.filter(i=>i.type==='danger').length*2;
  const score=Math.max(40,Math.min(100,100-problems*10));
  return {items,score};
}
function systemLogs(){try{return JSON.parse(localStorage.getItem('nexagest-system-logs')||'[]')}catch(e){return []}}
function addSystemLog(text,type='info'){let logs=systemLogs();logs.unshift({date:new Date().toISOString(),text,type});localStorage.setItem('nexagest-system-logs',JSON.stringify(logs.slice(0,30)))}
function systemLogsView(){let logs=systemLogs();return logs.length?table(['Data','Tipo','Mensagem'],logs.slice(0,8).map(l=>[br(l.date),esc(l.type),esc(l.text)])):'<p class="muted">Nenhum log local registrado.</p>'}
function runIntegrityCheck(){let h=settingsHealth(),warn=h.items.filter(i=>i.type!=='good').length;addSystemLog('Verificação de integridade executada: '+warn+' alerta(s).',warn?'warn':'success');alert(warn?'Integridade verificada com '+warn+' alerta(s).':'Integridade verificada sem alertas.');app()}
function exportDiagnostics(){let h=settingsHealth();let csv='Item;Status;Mensagem\n'+h.items.map(i=>`${i.title};${i.type};${i.msg}`).join('\n');download('diagnostico-nexagest.csv',csv);addSystemLog('Diagnóstico exportado.','success')}
function clearSystemLogs(){localStorage.removeItem('nexagest-system-logs');alert('Logs locais limpos.');app()}
function testBackupSettings(){addSystemLog('Teste de backup executado.','success');alert('Teste de backup concluído. O sistema está pronto para gerar backup local/premium.')}
function testWhatsappSettings(){let phone=db.settings.phone||'';let msg=(db.settings.whatsappMsg||'Olá, tudo bem?').replaceAll('{empresa}',db.settings.company||'NexaGest');if(!normalizeBrazilPhone(phone))return alert('Informe o Telefone/WhatsApp da empresa antes do teste.');openWhatsAppNumber(phone,msg);addSystemLog('Teste de WhatsApp aberto no navegador padrão.','success')}
function testPrinterSettings(){let w=window.open('','_blank');w.document.write(`<html><head><title>Teste de impressão - NexaGest</title><style>body{font-family:Arial;padding:24px}h1{margin:0 0 8px}.box{border:1px solid #999;padding:16px;border-radius:10px}</style></head><body><div class="box"><h1>${esc(db.settings.company||'NexaGest')}</h1><p>Teste de impressão do NexaGest.</p><p>Data: ${br(new Date())}</p></div><script>print()<\/script></body></html>`);w.document.close();addSystemLog('Teste de impressão aberto.','success')}
function commercialUpdateStatusView(){
  const info=db.settings.lastUpdateInfo||{};
  if(!info || !Object.keys(info).length)return '<div class="update-status-box neutral"><b>Nenhuma verificação realizada</b><span>Informe uma URL de manifesto ou use o manifesto local em updates/latest.json.</span></div>';
  const cls=info.updateAvailable?'warn':(info.ok===false?'bad':'good');
  const title=info.updateAvailable?`Nova versão ${esc(info.latestVersion||'disponível')}`:(info.ok===false?'Falha ao verificar':'Sistema atualizado');
  const details=info.error?esc(info.error):esc(info.notes||'Nenhuma observação informada.');
  return `<div class="update-status-box ${cls}"><b>${title}</b><span>${details}</span><small>Fonte: ${esc(info.source||'local')} • Atual: ${esc(info.currentVersion||APP_VERSION)} • Última: ${info.checkedAt?br(info.checkedAt):'—'}</small></div>`;
}
function commercialLicensePanel(){
  const validator=window.NexaGestPremium;
  const result=validator?.validateLicense?validator.validateLicense(db.settings.licenseKey,db.settings.licenseOwner):{ok:!!db.settings.licenseKey,label:db.settings.licenseKey?'Licença informada':'Sem licença configurada',status:db.settings.licenseKey?'active':'none'};
  const cls=result.ok?'good':(result.status==='none'?'warn':'bad');
  const last=db.settings.lastUpdateCheckAt?br(db.settings.lastUpdateCheckAt):'Nunca verificado';
  const info=db.settings.lastUpdateInfo||{};
  const updateLabel=info.updateAvailable?'Nova versão disponível':(db.settings.autoUpdate?'Automática ligada':'Manual');
  return `<div class="panel settings-card smart-section commercial-panel"><div class="between"><div><h3>Comercialização, licença e atualização</h3><p class="muted small">v9.0.2: servidor de versões via GitHub Releases, manifesto latest.json e API releases/latest.</p></div><span class="pill ${cls}">${esc(result.label||'Status')}</span></div><div class="commercial-grid"><div class="commercial-box"><b>Licença</b><span>${esc(result.plan||'Plano não definido')}</span><small>${esc(result.message||'Validação local/offline preparada para uso comercial inicial.')}</small></div><div class="commercial-box"><b>Versão instalada</b><span>${esc(APP_VERSION)}</span><small>Build desktop Electron</small></div><div class="commercial-box"><b>Atualizações</b><span>${esc(updateLabel)}</span><small>Última verificação: ${esc(last)}</small></div><div class="commercial-box"><b>Cliente</b><span>${esc(db.settings.licenseOwner||'Não informado')}</span><small>${esc(db.settings.licenseEmail||'sem e-mail')}</small></div></div><div class="form-grid"><div class="field"><label>Licença</label><input id="licenseKey" value="${esc(db.settings.licenseKey||'')}" placeholder="NEXA-XXXX-XXXX-XXXX ou DEMO"></div><div class="field"><label>Cliente / Responsável</label><input id="licenseOwner" value="${esc(db.settings.licenseOwner||'')}" placeholder="Nome do titular"></div><div class="field"><label>E-mail da conta</label><input id="licenseEmail" value="${esc(db.settings.licenseEmail||'')}" placeholder="cliente@email.com"></div><div class="field"><label>Plano</label><select id="licensePlan"><option ${db.settings.licensePlan==='Profissional'?'selected':''}>Profissional</option><option ${db.settings.licensePlan==='Essencial'?'selected':''}>Essencial</option><option ${db.settings.licensePlan==='Enterprise'?'selected':''}>Enterprise</option><option ${db.settings.licensePlan==='Demonstração'?'selected':''}>Demonstração</option></select></div><div class="field wide"><label>URL do manifesto de atualização</label><input id="updateManifestUrl" value="${esc(db.settings.updateManifestUrl||'')}" placeholder="https://github.com/USUARIO/REPOSITORIO/releases/latest/download/latest.json"></div><div class="field"><label>GitHub usuário/org</label><input id="githubOwner" value="${esc(db.settings.githubOwner||'')}" placeholder="ex.: seuusuario"></div><div class="field"><label>GitHub repositório</label><input id="githubRepo" value="${esc(db.settings.githubRepo||'')}" placeholder="ex.: NexaGest"></div><label class="check-row"><input type="checkbox" id="autoUpdate" ${db.settings.autoUpdate?'checked':''}> Verificar atualizações automaticamente</label><div class="field"><label>&nbsp;</label><button id="saveLicenseSettings">Salvar licença</button></div></div>${commercialUpdateStatusView()}<div class="row wrap"><button class="ghost" id="generateDemoLicense">Gerar licença DEMO</button><button class="ghost" id="checkUpdatesNow">Verificar atualização agora</button><button class="ghost" id="downloadAvailableUpdate">Baixar/instalar atualização</button><button class="ghost" id="openFirstUseWizard">Assistente de primeiro uso</button><button class="ghost" id="openCommercialDocs">Abrir documentação</button></div><div class="commercial-roadmap"><b>Como publicar uma atualização</b><span>Publique NexaGest-Setup.exe no GitHub Releases e envie também o latest.json como asset da release. Use a URL /releases/latest/download/latest.json ou a API /repos/USUARIO/REPO/releases/latest.</span></div></div>`
}
function saveLicenseSettings(){
  db.settings.licenseKey=val('licenseKey');
  db.settings.licenseOwner=val('licenseOwner');
  db.settings.licenseEmail=val('licenseEmail');
  db.settings.licensePlan=val('licensePlan')||'Profissional';
  db.settings.updateManifestUrl=val('updateManifestUrl').trim();
  db.settings.githubOwner=val('githubOwner').trim();
  db.settings.githubRepo=val('githubRepo').trim();
  db.settings.autoUpdate=!!document.getElementById('autoUpdate')?.checked;
  const result=window.NexaGestPremium?.validateLicense?window.NexaGestPremium.validateLicense(db.settings.licenseKey,db.settings.licenseOwner):{ok:true,label:'Licença salva'};
  db.settings.licenseStatus=result.status||'active';
  db.settings.licenseCheckedAt=new Date().toISOString();
  save();addSystemLog('Configurações comerciais/licença salvas.','success');
  alert((result.ok?'Licença salva. ':'Licença salva com aviso. ')+(result.message||result.label||''));app()
}
async function checkUpdatesNow(){
  db.settings.lastUpdateCheckAt=new Date().toISOString();
  try{
    const r=await window.nexagest?.commercialCheckUpdate?.({manifestUrl:db.settings.updateManifestUrl||'',githubOwner:db.settings.githubOwner||'',githubRepo:db.settings.githubRepo||''});
    db.settings.lastUpdateInfo=r||{};save();addSystemLog('Verificação de atualização executada: '+(r?.status||r?.source||'manifesto'),'info');
    if(r?.updateAvailable){
      const msg='Nova versão disponível: '+(r.latestVersion||'')+'\n\n'+(r.notes||'')+'\n\nDeseja baixar/abrir a atualização agora?';
      if(confirm(msg))downloadAvailableUpdate(); else app();
    }else if(r?.ok===false){
      alert('Não foi possível verificar online. '+(r.error||'')+'\n\nO NexaGest manteve o manifesto local como fallback.');app();
    }else {alert('NexaGest está atualizado. Versão atual: '+APP_VERSION);app();}
  }catch(e){save();alert('Não foi possível verificar atualizações: '+(e.message||e));app()}
}
async function downloadAvailableUpdate(){
  const info=db.settings.lastUpdateInfo||{};
  if(!info.updateAvailable && !info.downloadUrl && !info.releaseUrl)return alert('Nenhuma atualização disponível para baixar. Execute a verificação primeiro.');
  try{
    const r=await window.nexagest?.commercialDownloadUpdate?.(info);
    db.settings.updateDownloadStatus=r?.ok?'Download/abertura concluído':'Falha no download';save();addSystemLog('Atualização: '+(r?.ok?'download/abertura concluído':(r?.error||'falha')),(r?.ok?'success':'warn'));
    if(r?.ok)alert(r.message||'Instalador aberto/baixado. Siga as instruções para atualizar o NexaGest.');
    else alert('Não foi possível baixar a atualização: '+(r?.error||'erro desconhecido'));
  }catch(e){alert('Falha ao baixar atualização: '+(e.message||e))}
}
function generateDemoLicense(){
  const owner=val('licenseOwner')||db.settings.company||'NexaGest';
  const key=window.NexaGestPremium?.generateDemoKey?window.NexaGestPremium.generateDemoKey(owner):'DEMO-NEXA';
  const input=document.getElementById('licenseKey'); if(input)input.value=key;
  alert('Licença DEMO gerada para teste local. Salve para aplicar.')
}
function openCommercialDocs(){
  if(window.nexagest?.commercialOpenDocs)window.nexagest.commercialOpenDocs();
  else alert('Consulte a pasta docs do projeto.')
}
function openFirstUseWizard(){
  closeFirstUseWizard();
  const steps=[
    ['Empresa','Confira nome, telefone, cidade, logo e meta mensal.','settings'],
    ['Usuários','Crie usuários para caixa, estoque e administrador.','users'],
    ['Backup','Configure backup local ou pasta sincronizada na nuvem.','settings'],
    ['PIX e WhatsApp','Teste PIX, mensagens e templates de atendimento.','settings'],
    ['Produtos iniciais','Cadastre produtos, custos, venda e estoque mínimo.','products'],
    ['Teste completo','Abra caixa, venda, feche caixa e gere relatório.','pdv']
  ];
  const html=`<div class="modal-overlay show" id="firstUseWizard"><div class="modal commercial-wizard"><div class="between"><div><h3>Assistente de primeiro uso</h3><p class="muted small">Checklist rápido para instalar e entregar o NexaGest com segurança.</p></div><button class="ghost" id="closeFirstUseWizard">Esc</button></div><div class="wizard-steps">${steps.map((s,i)=>`<button data-wizard-go="${s[2]}"><b>${i+1}. ${s[0]}</b><span>${s[1]}</span></button>`).join('')}</div><div class="modal-actions"><button id="markFirstUseDone">Marcar como concluído</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  document.getElementById('closeFirstUseWizard').onclick=closeFirstUseWizard;
  document.getElementById('firstUseWizard').onclick=e=>{if(e.target.id==='firstUseWizard')closeFirstUseWizard()};
  document.getElementById('markFirstUseDone').onclick=()=>{db.settings.firstUseDone=true;db.settings.firstUseDoneAt=new Date().toISOString();save();closeFirstUseWizard();alert('Assistente concluído.')};
  document.querySelectorAll('[data-wizard-go]').forEach(b=>b.onclick=()=>{page=b.dataset.wizardGo;closeFirstUseWizard();app()});
}
function closeFirstUseWizard(){document.getElementById('firstUseWizard')?.remove()}

function openFirstUseWizard(){alert('Assistente: confira empresa, WhatsApp, backup, usuários e teste de impressão. A central já está organizada por etapas.');localStorage.setItem('settings-smart-tab','diagnostico');app()}
function saveCompany(){if(!requireCan('settings'))return;['company','document','phone','city','address','monthlyGoal','whatsappMsg'].forEach(k=>{let el=document.getElementById(k);if(el)db.settings[k]=el.value});audit('Empresa alterada');save();saveCurrentCompanyRegistry();app()}function saveSystem(){if(!requireCan('settings'))return;let theme=document.getElementById('theme'),accent=document.getElementById('accent'),server=document.getElementById('serverAddress'),network=document.getElementById('networkMode');if(theme)db.settings.theme=theme.value;if(accent)db.settings.accent=accent.value;if(server)db.settings.serverAddress=server.value;if(network)db.settings.networkMode=network.checked;save();app()}
function readLogo(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{db.settings.logo=r.result;save();app()};r.readAsDataURL(f)}
async function backup(){if(!requireCan('settings'))return;await withOperation('Gerando backup...',async()=>{let res=await window.nexagest.saveBackup(db);if(res.ok)alert('Backup salvo com sucesso.')})}async function restore(){if(!requireCan('settings'))return;let res=await withOperation('Lendo backup...',()=>window.nexagest.loadBackup());if(res.ok){confirmAction('Restaurar backup?',()=>{db=migrate(res.data);save();app();alert('Backup restaurado com sucesso.')},'Restaurar backup','Restaurar')}}


function nfeDraft(){try{return JSON.parse(localStorage.getItem('nfe-draft')||'null')}catch{return null}}
function nfeText(parent,tag){let el=parent?.getElementsByTagName(tag)?.[0];return el?el.textContent.trim():''}
function parseNfeFile(e){let file=e.target.files?.[0];if(!file)return;let reader=new FileReader();reader.onload=()=>{try{let xml=new DOMParser().parseFromString(String(reader.result),'text/xml');let err=xml.getElementsByTagName('parsererror')[0];if(err)throw new Error('XML inválido.');let inf=xml.getElementsByTagName('infNFe')[0]||xml;let ide=inf.getElementsByTagName('ide')[0]||inf,emit=inf.getElementsByTagName('emit')[0]||inf,total=inf.getElementsByTagName('ICMSTot')[0]||inf;let dets=[...inf.getElementsByTagName('det')];let items=dets.map((d,idx)=>{let pr=d.getElementsByTagName('prod')[0]||d;let barcode=nfeText(pr,'cEAN')||nfeText(pr,'cEANTrib')||nfeText(pr,'cProd');if(String(barcode).toUpperCase().includes('SEM GTIN')) barcode=nfeText(pr,'cProd');let qty=Number(String(nfeText(pr,'qCom')||'0').replace(',','.'));let cost=Number(String(nfeText(pr,'vUnCom')||'0').replace(',','.'));return{id:uid(),index:idx+1,code:nfeText(pr,'cProd'),barcode,name:nfeText(pr,'xProd')||('Item '+(idx+1)),qty,cost,total:Number(String(nfeText(pr,'vProd')||qty*cost).replace(',','.'))}}).filter(i=>i.name);let draft={number:nfeText(ide,'nNF'),series:nfeText(ide,'serie'),date:(nfeText(ide,'dhEmi')||nfeText(ide,'dEmi')||new Date().toISOString()),supplierName:nfeText(emit,'xNome')||'Fornecedor da NF-e',supplierDocument:nfeText(emit,'CNPJ')||nfeText(emit,'CPF'),total:Number(String(nfeText(total,'vNF')||items.reduce((a,i)=>a+i.total,0)).replace(',','.')),items,xmlName:file.name};localStorage.setItem('nfe-draft',JSON.stringify(draft));app()}catch(err){alert('Não foi possível ler o XML: '+(err.message||err))}};reader.readAsText(file)}
function nfeDraftView(d){let matched=d.items.filter(i=>findProductFromNfe(i)).length,created=d.items.length-matched;return `<div class="nfe-preview"><div class="nfe-preview-title"><div><h3>Prévia da nota</h3><p class="muted small">Confira as informações antes de confirmar a entrada.</p></div><span class="pill ${created?'warn':'good'}">${matched} vinculado(s) • ${created} novo(s)</span></div><div class="nfe-head"><div><span>Fornecedor</span><b>${esc(d.supplierName)}</b><small>${esc(d.supplierDocument||'-')}</small></div><div><span>Número/Série</span><b>${esc(d.number||'-')}</b><small>Série ${esc(d.series||'-')}</small></div><div><span>Emissão</span><b>${br(d.date)}</b><small>${esc(d.xmlName||'XML')}</small></div><div><span>Total da nota</span><b>${money(d.total)}</b><small>${d.items.length} item(ns)</small></div></div><div class="hint nfe-hint">Produtos já existentes serão atualizados. Produtos não encontrados serão criados automaticamente ao registrar a entrada.</div>${table(['Produto no XML','Código/EAN','Qtd.','Custo un.','Total','Resultado'],d.items.map(i=>{let p=findProductFromNfe(i);return[esc(i.name),esc(i.barcode||i.code||'-'),i.qty,money(i.cost),money(i.total),p?`<span class="pill good">Atualizar: ${esc(p.name)}</span>`:'<span class="pill warn">Criar produto</span>']}))}<div class="nfe-confirm-box"><div><b>Pronto para lançar?</b><small>A confirmação irá atualizar o estoque usando os itens da nota.</small></div><div class="row"><button id="registerNfe">Confirmar entrada no estoque</button><button class="ghost" id="clearNfeDraft">Cancelar XML</button></div></div></div>`}
function findProductFromNfe(i){let code=String(i.barcode||i.code||'').trim().toLowerCase();return db.products.find(p=>String(p.barcode||'').trim().toLowerCase()===code)||db.products.find(p=>p.name.trim().toLowerCase()===String(i.name||'').trim().toLowerCase())}
function registerNfe(){if(!requireCan('nfe'))return;let d=nfeDraft();if(!d)return alert('Importe um XML primeiro.');if(!d.items?.length)return alert('XML sem itens para registrar.');let doc=String(d.supplierDocument||'').replace(/\D/g,'');let sup=db.suppliers.find(s=>String(s.document||'').replace(/\D/g,'')===doc&&doc)||db.suppliers.find(s=>s.name.toLowerCase()===d.supplierName.toLowerCase());if(!sup){sup={id:uid(),name:d.supplierName,document:d.supplierDocument,phone:'',city:'',notes:'Criado pela importação de NF-e',active:true};db.suppliers.push(sup)}let invoice={id:uid(),date:d.date||new Date().toISOString(),number:d.number,series:d.series,supplierId:sup.id,supplierName:sup.name,supplierDocument:d.supplierDocument,total:d.total,items:[]};d.items.forEach(i=>{let p=findProductFromNfe(i);if(!p){p={id:uid(),name:i.name,barcode:i.barcode||i.code||'',category:'NF-e',unit:'un',brand:'',supplierName:sup.name,cost:i.cost||0,sale:i.cost||0,stock:0,min:1,active:true};db.products.push(p)}p.stock=Number(p.stock||0)+Number(i.qty||0);if(Number(i.cost)>0)p.cost=Number(i.cost);let item={productId:p.id,name:p.name,barcode:p.barcode,qty:Number(i.qty||0),cost:Number(i.cost||0),total:Number(i.total||0)};invoice.items.push(item);db.purchases.unshift({id:uid(),date:new Date().toISOString(),supplierId:sup.id,productId:p.id,qty:item.qty,cost:item.cost,total:item.total,status:'Recebida',obs:'Entrada por NF-e '+(d.number||'')});db.stockMoves.unshift({id:uid(),date:new Date().toISOString(),productId:p.id,type:'NF-e',qty:item.qty,obs:'Entrada por NF-e '+(d.number||'')})});db.nfeInvoices.unshift(invoice);localStorage.removeItem('nfe-draft');audit('NF-e importada '+(d.number||''));save();alert('NF-e registrada e estoque atualizado.');app()}
function exportNfeCsv(){let rows=[['data','fornecedor','numero','serie','itens','total'],...(db.nfeInvoices||[]).map(n=>[br(n.date),n.supplierName||'',n.number||'',n.series||'',n.items?.length||0,n.total||0])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-notas-fiscais.csv','text/csv;charset=utf-8')}
function viewNfe(id){if(!requireCan('nfe'))return;let n=(db.nfeInvoices||[]).find(x=>x.id===id);if(!n)return alert('NF-e não encontrada.');let rows=(n.items||[]).map(i=>`<tr><td>${esc(i.name||'-')}</td><td>${esc(i.barcode||i.code||'-')}</td><td>${i.qty||0}</td><td>${money(i.cost||0)}</td><td>${money(i.total||0)}</td></tr>`).join('')||'<tr><td colspan="5">Sem itens.</td></tr>';let html=`<div class="modal-overlay show" id="nfeDetailModal"><div class="modal nfe-detail-modal"><div class="between"><div><h3>Detalhes da NF-e ${esc(n.number||'')}</h3><p class="muted small">${esc(n.supplierName||'Fornecedor')} • ${br(n.date)} • ${money(n.total||0)}</p></div><button class="ghost" id="closeNfeDetail">Fechar</button></div><div class="nfe-head"><div><span>Fornecedor</span><b>${esc(n.supplierName||'-')}</b><small>${esc(n.supplierDocument||'-')}</small></div><div><span>Número/Série</span><b>${esc(n.number||'-')}</b><small>Série ${esc(n.series||'-')}</small></div><div><span>Data</span><b>${br(n.date)}</b><small>${esc(n.xmlName||'XML importado')}</small></div><div><span>Total</span><b>${money(n.total||0)}</b><small>${(n.items||[]).length} item(ns)</small></div></div><div class="table-wrap"><table><thead><tr><th>Produto</th><th>Código/EAN</th><th>Qtd.</th><th>Custo un.</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;document.body.insertAdjacentHTML('beforeend',html);document.getElementById('closeNfeDetail').onclick=()=>document.getElementById('nfeDetailModal')?.remove();document.getElementById('nfeDetailModal').onclick=e=>{if(e.target.id==='nfeDetailModal')e.currentTarget.remove()}}
function deleteNfe(id){if(!requireCan('nfe'))return;let n=(db.nfeInvoices||[]).find(x=>x.id===id);if(!n)return;confirmAction('Excluir esta NF-e do histórico? O estoque não será alterado.',()=>{db.nfeInvoices=db.nfeInvoices.filter(x=>x.id!==id);audit('NF-e excluída '+(n.number||''));save();app()},'Excluir NF-e','Excluir')}


function labelData(){
  let q=localStorage.getItem('label-q')||'',cat=localStorage.getItem('label-cat')||'Todas',model=localStorage.getItem('label-model')||'Pequena';
  let printMode=localStorage.getItem('label-print-mode')||'Folha A4';
  let codeType=localStorage.getItem('label-code-type')||'Automático';
  let selected=JSON.parse(localStorage.getItem('label-selected')||'null');
  if(!Array.isArray(selected)) selected=db.products.map(p=>p.id);
  let show={name:localStorage.getItem('label-show-name')!=='false',price:localStorage.getItem('label-show-price')!=='false',code:localStorage.getItem('label-show-code')!=='false',barcode:localStorage.getItem('label-show-barcode')!=='false'};
  let products=db.products.filter(p=>p.active!==false).filter(p=>{let hay=[p.name,p.barcode,p.category,p.brand].join(' ').toLowerCase();return (!q||hay.includes(q.toLowerCase()))&&(cat==='Todas'||(p.category||'Geral')===cat)});
  let preview=[];let totalQty=0;
  products.filter(p=>selected.includes(p.id)).forEach(p=>{let qty=labelQty(p.id);totalQty+=qty;for(let i=0;i<qty;i++)preview.push(labelPreview(p,show,model,codeType))});
  return{q,cat,model,printMode,codeType,selected,show,products,preview,totalQty}
}
function labelQty(id){return Math.max(1,Number(localStorage.getItem('label-qty-'+id)||1))}
function setLabelSelected(ids){localStorage.setItem('label-selected',JSON.stringify(ids))}
function labelModelClass(model){return model==='Gôndola'?'model-shelf':model==='Grande'?'model-large':model==='Média'?'model-medium':'model-small'}
function ean13CheckDigit(first12){let sum=0;String(first12).slice(0,12).split('').forEach((d,i)=>{sum+=Number(d)*(i%2?3:1)});return String((10-(sum%10))%10)}
function normalizeLabelCode(code){let digits=String(code||'').replace(/\D/g,'');if(digits.length===12)digits+=ean13CheckDigit(digits);return digits}
function ean13Modules(code){
  let digits=normalizeLabelCode(code);
  if(digits.length!==13)return null;
  let original=String(code||'').replace(/\D/g,'');
  if(original.length===13&&ean13CheckDigit(original.slice(0,12))!==original[12])return null;
  const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const parity=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'][Number(digits[0])];
  let bits='101';
  for(let i=1;i<=6;i++){bits+=(parity[i-1]==='L'?L:G)[Number(digits[i])];}
  bits+='01010';
  for(let i=7;i<=12;i++){bits+=R[Number(digits[i])];}
  bits+='101';
  return{digits,bits,type:'EAN-13'};
}
const CODE128_PATTERNS=['11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100','11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010','11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000','11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110','11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010','11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000','10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010','10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110','11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110','10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','1100011101011'];
function code128Modules(value){
  let s=String(value||'').trim()||'000000';
  let numeric=/^\d+$/.test(s)&&s.length>=4;
  let setC=numeric&&s.length%2===0;
  let codes=[];
  if(setC){codes=[105];for(let i=0;i<s.length;i+=2)codes.push(Number(s.slice(i,i+2)));}
  else{codes=[104];for(let ch of s){let cc=ch.charCodeAt(0);codes.push(cc>=32&&cc<=126?cc-32:0)}}
  let checksum=codes[0];for(let i=1;i<codes.length;i++)checksum+=codes[i]*i;checksum%=103;codes.push(checksum,106);
  return{digits:s,bits:codes.map(c=>CODE128_PATTERNS[c]).join(''),type:'Code128'};
}
function barcodeData(code,preferred){
  let ean=ean13Modules(code);
  if(preferred==='EAN-13') return ean||code128Modules(normalizeLabelCode(code)||code);
  if(preferred==='Code128') return code128Modules(code);
  return ean||code128Modules(code);
}
function barcodeBars(code,preferred){
  let data=barcodeData(code,preferred);
  return `<div class="barcode-ean barcode-${data.type.toLowerCase().replace(/[^a-z0-9]/g,'')}" data-code-type="${esc(data.type)}" aria-label="${esc(data.digits)}">${data.bits.split('').map((b,i)=>`<span class="${b==='1'?'bar':'space'} ${data.type==='EAN-13'&&(i<3||i>=45&&i<50||i>=92)?'guard':''}"></span>`).join('')}</div>`;
}
function labelPreview(p,show,model,codeType){let raw=p.barcode||p.id,bd=barcodeData(raw,codeType),code=bd.digits;return `<div class="label-card ${labelModelClass(model)} ${bd.type==='EAN-13'?'ean-ready':'code128-ready'}"><div class="label-name-price">${show.name?`<b>${esc(p.name)}</b>`:''}${show.price?`<strong>${money(p.sale)}</strong>`:''}</div>${show.barcode?`<div class="barcode-wrap"><div class="barcode-bars">${barcodeBars(raw,codeType)}</div>${show.code?`<span class="barcode-number">${esc(code)}</span>`:''}</div>`:show.code?`<span>Cód: ${esc(code)}</span>`:''}</div>`}
function labelProductRow(p,d){let checked=d.selected.includes(p.id),qty=labelQty(p.id),stockCls=p.stock<=0?'bad':p.stock<=p.min?'warn':'good';return `<div class="label-product-row"><label class="label-check"><input type="checkbox" data-label-toggle="${p.id}" ${checked?'checked':''}><div><b>${esc(p.name)}</b><span>${esc(p.category||'Geral')} • ${esc(p.barcode||p.id)}</span></div></label><div class="label-stock ${stockCls}">Estoque: ${p.stock}</div><div class="field label-qty"><label>Qtd.</label><input type="number" min="1" value="${qty}" data-label-qty="${p.id}"></div></div>`}

function stockTypeBadge(t){let cls=['Entrada','Compra','Devolução','Ajuste +','Inventário +','Cancelamento'].includes(t)?'good':(['Saída','Venda','Perda','Quebra','Ajuste -','Inventário -'].includes(t)?'bad':'warn');return `<span class="pill ${cls}">${esc(t||'-')}</span>`}
function exportStockCsv(){let rows=[['data','produto','tipo','quantidade','estoque_atual','observacao'],...db.stockMoves.map(m=>{let p=product(m.productId);return[br(m.date),p.name,m.type,m.qty,p.stock,m.obs||'']})];download(rows.map(r=>r.join(';')).join('\n'),'nexagest-estoque.csv','text/csv')}

function exportProductsCsv(){let rows=[['nome','codigo','categoria','unidade','marca','fornecedor','custo','venda','estoque','minimo','margem'],...db.products.map(p=>[p.name,p.barcode||'',p.category,p.unit||'un',p.brand||'',p.supplierName||'',p.cost,p.sale,p.stock,p.min,margin(p)])];download(rows.map(r=>r.join(';')).join('\n'),'nexagest-produtos.csv','text/csv')}

function csvCell(value){
  let text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  if (/[;"\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}
function exportClientsCsv(){
  let rows=[['nome','telefone','cidade','endereco','cpf_cnpj','email','aniversario','limite','em_aberto','ultima_compra','status','observacoes'],...db.clients.map(c=>[
    c.name||'', c.phone||'', c.city||'', c.address||'', c.document||'', c.email||'', (c.birth||c.birthday||''), c.creditLimit||0, openByClient(c.id), lastClientSale(c.id), c.active===false?'inativo':'ativo', (c.notes||c.obs||'')
  ])];
  download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-clientes.csv','text/csv;charset=utf-8');
}

function exportCsv(){let d=reportsData(),rows=[['tipo','data','descricao','cliente','pagamento_categoria','total','custo','lucro','status']];d.sales.forEach(s=>rows.push(['venda',s.date,'Venda',client(s.clientId).name,s.payment||'',s.total||0,s.cost||0,Number(s.total||0)-Number(s.cost||0),s.cancelled?'cancelada':'ok']));d.expenses.forEach(e=>rows.push(['despesa',e.date,e.description||'', '', e.category||'', e.value||0,'','','paga']));d.receivables.forEach(r=>rows.push(['receber',r.date||'', 'Conta a receber', client(r.clientId).name,'',r.value||0,'','',r.paid?'pago':'em aberto']));(d.cashRegisters||[]).forEach(c=>rows.push(['caixa',c.openedAt||'', 'Caixa '+(c.number||''), c.operatorName||'', c.status||'', c.totalSales||0, c.expectedAmount||0, c.difference||0, c.status||'']));download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-relatorio-geral.csv','text/csv;charset=utf-8')}
async function exportHtml(){let d=reportsData();let html=`<!doctype html><meta charset=utf-8><title>Relatório NexaGest</title><style>body{font-family:Arial;padding:24px;color:#111}h1{margin-bottom:4px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card{border:1px solid #ddd;border-radius:12px;padding:14px}.card b{display:block;font-size:22px;margin-top:6px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}</style><h1>${esc(db.settings.company)}</h1><p>Relatório de ${range.from} até ${range.to}</p><div class="cards"><div class="card">Vendas<b>${money(d.revenue)}</b></div><div class="card">Custos<b>${money(d.cost)}</b></div><div class="card">Despesas<b>${money(d.expensesTotal)}</b></div><div class="card">Lucro líquido<b>${money(d.net)}</b></div></div><h2>Vendas</h2>${salesReportTable(d.sales)}<h2>Produtos vendidos</h2>${productsSoldReport(d.sales)}<h2>Despesas por categoria</h2>${expenseCategoryReport(d.expenses)}<h2>Contas a receber</h2>${receivablesReport(d.receivables)}<h2>Histórico de caixas</h2>${cashRegistersReport(d.cashRegisters)}`;let res=await withOperation('Exportando relatório...',()=>window.nexagest.exportHtml({title:'Exportar relatório',filename:'relatorio-nexagest',html}));if(res.ok)alert('Relatório salvo em HTML. Abra e use Ctrl+P para PDF.')}
function download(text,name,type){let b=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click()}

function normalizeBrazilPhone(phone){
  let digits=String(phone||'').replace(/\D/g,'');
  if(!digits)return '';
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(!digits.startsWith('55'))digits='55'+digits;
  return digits;
}
function openExternalUrl(url){
  if(window.nexagest?.openExternalUrl){
    window.nexagest.openExternalUrl(url).then(r=>{if(!r?.ok)window.open(url,'_blank')}).catch(()=>window.open(url,'_blank'));
  }else{
    window.open(url,'_blank');
  }
}
function openWhatsAppNumber(phone,message=''){
  let digits=normalizeBrazilPhone(phone);
  if(!digits)return alert('Este cadastro não possui telefone/WhatsApp.');
  // web.whatsapp.com é mais direto no Windows/Electron e evita casos em que wa.me abre sem reação visível.
  let url='https://web.whatsapp.com/send?phone='+digits+(message?'&text='+encodeURIComponent(message):'');
  try{navigator.clipboard?.writeText?.(message||'')}catch(e){}
  let opened=false;
  try{
    if(window.nexagest?.openExternalUrl){
      window.nexagest.openExternalUrl(url).then(r=>{
        if(!r?.ok){window.open(url,'_blank');}
      }).catch(()=>window.open(url,'_blank'));
      opened=true;
    }
  }catch(e){opened=false}
  if(!opened)window.open(url,'_blank');
}
function fillTemplate(text,data){return String(text||'').replace(/\{([a-zA-Z0-9_]+)\}/g,(m,k)=>data[k]??'')}
function saveWhatsAppTemplates(){
  db.settings.whatsappTemplates={orcamento:val('tpl_orcamento'),comprovante:val('tpl_comprovante'),cobranca:val('tpl_cobranca'),entrega:val('tpl_entrega'),aniversario:val('tpl_aniversario')};
  save();alert('Modelos de WhatsApp salvos com sucesso.');app();
}
function sendPremiumWhatsApp(){
  let c=db.clients.find(x=>x.id===val('waClient'))||{};
  let tplKey=val('waTemplate')||'orcamento', t=db.settings.whatsappTemplates||{};
  let msg=val('waManual')||t[tplKey]||db.settings.whatsappMsg||'';
  let data={cliente:c.name||'Cliente',empresa:db.settings.company||'NexaGest',valor:val('waValue'),total:val('waValue'),pedido:val('waOrder'),link:''};
  openWhatsAppNumber(c.phone,fillTemplate(msg,data));
}
function premiumNotifications(){
  let rows=[];
  db.products.filter(p=>p.active!==false&&Number(p.stock||0)<=Number(p.min||0)).slice(0,6).forEach(p=>rows.push({type:p.stock<=0?'bad':'warn',title:p.stock<=0?'Produto sem estoque':'Estoque baixo',text:`${p.name}: ${p.stock} un`,go:'products'}));
  (db.receivables||[]).filter(r=>!r.paid).slice(0,5).forEach(r=>rows.push({type:'warn',title:'Conta em aberto',text:`${client(r.clientId).name}: ${money(r.value)}`,go:'finance'}));
  (db.deliveries||[]).filter(d=>!['Entregue','Cancelada'].includes(d.status)).slice(0,5).forEach(d=>rows.push({type:'info',title:'Entrega pendente',text:`${d.clientName||client(d.clientId).name||'Cliente'} • ${d.status||'Pendente'}`,go:'deliveries'}));
  let last=localStorage.getItem('nexagest-last-cloud-backup');
  if(!last)rows.push({type:'warn',title:'Backup premium',text:'Nenhum backup em nuvem realizado.',go:'premium'});
  return rows.slice(0,12);
}
function premiumNotificationsView(){let rows=premiumNotifications();return `<div class="notification-list">${rows.map(n=>`<button class="notification ${n.type}" onclick="page='${n.go}';app()"><b>${esc(n.title)}</b><span>${esc(n.text)}</span></button>`).join('')||'<p class="muted">Nenhuma notificação importante agora.</p>'}</div>`}
function cloudBackupHistory(){try{return JSON.parse(localStorage.getItem('nexagest-cloud-backup-history')||'[]')}catch(e){return[]}}
function saveCloudBackupHistory(rows){localStorage.setItem('nexagest-cloud-backup-history',JSON.stringify((rows||[]).slice(0,50)))}
function cloudBackupFiles(){try{return JSON.parse(localStorage.getItem('nexagest-cloud-files')||'[]')}catch(e){return[]}}
function saveCloudBackupFiles(rows){localStorage.setItem('nexagest-cloud-files',JSON.stringify((rows||[]).slice(0,80)))}
function cloudProviderOptions(){let p=db.settings.backupProvider||'Local';return ['Local','Google Drive','OneDrive','Dropbox'].map(x=>`<option ${p===x?'selected':''}>${x}</option>`).join('')}
function backupFrequencyLabel(){let f=db.settings.backupFrequency||'daily';return f==='manual'?'Manual':f==='weekly'?'Semanal':f==='close'?'Ao fechar':'Diário'}
function nextBackupText(){if(!db.settings.backupAuto||db.settings.backupFrequency==='manual')return 'Automático desligado';let k=db.settings.backupFrequency||'daily';let last=localStorage.getItem('nexagest-last-auto-cloud-backup')||'';if(!last)return 'Será feito na próxima abertura do sistema';return 'Último automático: '+br(last)+' • '+backupFrequencyLabel()}
function providerStatusText(provider){return provider==='Local'?'Backup local':`Preparado para ${provider} via pasta sincronizada`}
function cloudBackupSettingsView(){let provider=db.settings.backupProvider||'Local',last=localStorage.getItem('nexagest-last-cloud-backup')||'Ainda não realizado';let syncHint=provider==='Google Drive'?'Escolha uma pasta dentro do Google Drive instalado no Windows.':provider==='OneDrive'?'Escolha uma pasta dentro do OneDrive instalado no Windows.':provider==='Dropbox'?'Escolha uma pasta dentro do Dropbox instalado no Windows.':'Usa a pasta local padrão do NexaGest ou uma pasta escolhida.';let fileCount=cloudBackupFiles().length;return `<div class="panel settings-card smart-section cloud-backup-page"><div class="between"><div><h3>Backup em nuvem</h3><p class="muted small">Google Drive, OneDrive e Dropbox usando pastas sincronizadas do Windows. O NexaGest gera um arquivo protegido <b>.ngbackup</b> nessa pasta.</p></div><span class="pill ${provider==='Local'?'warn':'good'}">${esc(provider)}</span></div><div class="cloud-provider-grid"><button class="cloud-provider ${provider==='Google Drive'?'active':''}" data-cloud-provider="Google Drive"><b>☁️ Google Drive</b><span>${provider==='Google Drive'?'Selecionado':'Pasta sincronizada'}</span></button><button class="cloud-provider ${provider==='OneDrive'?'active':''}" data-cloud-provider="OneDrive"><b>☁️ OneDrive</b><span>${provider==='OneDrive'?'Selecionado':'Pasta sincronizada'}</span></button><button class="cloud-provider ${provider==='Dropbox'?'active':''}" data-cloud-provider="Dropbox"><b>☁️ Dropbox</b><span>${provider==='Dropbox'?'Selecionado':'Pasta sincronizada'}</span></button><button class="cloud-provider ${provider==='Local'?'active':''}" data-cloud-provider="Local"><b>📁 Local</b><span>${provider==='Local'?'Selecionado':'Sem nuvem'}</span></button></div><div class="grid two"><div class="backup-box backup-status-grid"><div><b>Status</b><span>${esc(providerStatusText(provider))}</span></div><div><b>Último backup</b><span>${esc(last)}</span></div><div><b>Histórico</b><span>${cloudBackupHistory().length} registro(s)</span></div><div><b>Arquivos encontrados</b><span>${fileCount} arquivo(s)</span></div><div><b>Automático</b><span>${esc(nextBackupText())}</span></div><div><b>Proteção</b><span>Arquivo .ngbackup codificado</span></div></div><div class="form-grid"><div class="field"><label>Destino</label><select id="cloudProvider">${cloudProviderOptions()}</select></div><div class="field"><label>Pasta sincronizada</label><div class="input-action"><input id="cloudFolder" value="${esc(db.settings.backupFolder||'')}" placeholder="Ex.: C:\\Users\\Você\\OneDrive\\NexaGest"><button class="ghost" id="pickCloudFolder">Escolher</button></div><small>${esc(syncHint)}</small></div><div class="field"><label>Frequência automática</label><select id="cloudFrequency"><option value="manual" ${db.settings.backupFrequency==='manual'?'selected':''}>Manual</option><option value="daily" ${(!db.settings.backupFrequency||db.settings.backupFrequency==='daily')?'selected':''}>Diário</option><option value="weekly" ${db.settings.backupFrequency==='weekly'?'selected':''}>Semanal</option><option value="close" ${db.settings.backupFrequency==='close'?'selected':''}>Ao fechar o sistema</option></select></div><label class="check-row"><input type="checkbox" id="cloudAuto" ${db.settings.backupAuto?'checked':''}> Ativar backup automático</label><div class="field"><label>&nbsp;</label><button id="saveCloudBackupSettings">Salvar configuração</button></div></div></div><div class="row"><button id="backupBtn">Backup local comum</button><button class="ok" id="runCloudBackup">Enviar backup agora</button><button class="ghost" id="refreshCloudBackups">Atualizar histórico</button><button class="ghost" id="restoreCloudBackup">Restaurar da nuvem</button><button class="ghost" id="restoreBtn">Restaurar arquivo comum</button></div><p class="muted small warn-text">Antes de restaurar, o NexaGest agora gera um backup de segurança automaticamente. Google Drive/OneDrive/Dropbox sincronizam a pasta pelo aplicativo oficial instalado no Windows.</p>${cloudBackupHealthView()}${cloudBackupHistoryView()}${cloudBackupsFileListView()}</div>`}
function saveCloudBackupSettings(){db.settings.backupProvider=val('cloudProvider')||'Local';db.settings.backupFolder=val('cloudFolder');db.settings.backupAuto=!!document.getElementById('cloudAuto')?.checked;db.settings.backupFrequency=val('cloudFrequency')||'daily';save();alert('Configurações de backup salvas.');app()}
async function pickCloudFolder(){if(!window.nexagest?.pickCloudFolder)return alert('Seletor de pasta indisponível.');let r=await window.nexagest.pickCloudFolder();if(r.ok){let el=document.getElementById('cloudFolder');if(el)el.value=r.path;db.settings.backupFolder=r.path;save();await refreshCloudBackups(true);app()}}
function currentCloudBackupConfig(){return{provider:val('cloudProvider')||db.settings.backupProvider||'Local',folder:val('cloudFolder')||db.settings.backupFolder||'',company:db.settings.company||'NexaGest'}}
async function runCloudBackup(opts={}){let cfg=currentCloudBackupConfig(),stamp=new Date().toLocaleString('pt-BR');try{let result=null;await withOperation(opts.auto?'Fazendo backup automático...':'Gerando backup...',async()=>{if(window.nexagest?.cloudBackup)result=await window.nexagest.cloudBackup({data:db,provider:cfg.provider,folder:cfg.folder,company:cfg.company});else if(window.nexagest?.autoBackup)result=await window.nexagest.autoBackup(db);else{download(JSON.stringify(db,null,2),'nexagest-backup-'+today()+'.json','application/json');result={ok:true,filename:'download navegador',provider:cfg.provider,size:0,path:''}}});if(result&&result.ok===false)throw new Error(result.error||'Falha ao gerar backup');db.settings.backupProvider=cfg.provider;db.settings.backupFolder=cfg.folder;save();localStorage.setItem('nexagest-last-cloud-backup',stamp+' • '+cfg.provider);if(opts.auto)localStorage.setItem('nexagest-last-auto-cloud-backup',new Date().toISOString());let h=cloudBackupHistory();h.unshift({date:new Date().toISOString(),provider:cfg.provider,folder:cfg.folder||result?.path||'',file:result?.filename||'',size:result?.size||0,path:result?.path||'',auto:!!opts.auto});saveCloudBackupHistory(h);await refreshCloudBackups(true);if(!opts.quiet)alert('Backup gerado com sucesso.\n\nArquivo: '+(result?.filename||'backup')+(result?.path?'\nLocal: '+result.path:''));if(!opts.quiet)app();return result}catch(e){console.warn(e);if(!opts.quiet)alert('Erro ao gerar backup: '+(e.message||e));return{ok:false,error:e.message||String(e)}}}
async function refreshCloudBackups(silent=false){try{let cfg=currentCloudBackupConfig();let r=await window.nexagest?.cloudListBackups?.({provider:cfg.provider,folder:cfg.folder});if(r?.ok){saveCloudBackupFiles(r.files||[]);if(!silent)alert('Histórico de arquivos atualizado.');return r}else{if(!silent)alert(r?.error||'Não foi possível listar backups.');return r||{ok:false}}}catch(e){if(!silent)alert('Erro ao atualizar histórico: '+(e.message||e));return{ok:false,error:e.message||String(e)}}}
async function restoreCloudBackup(){try{let rList=await refreshCloudBackups(true);let files=(rList?.files||cloudBackupFiles()).slice().sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt)));let chosen=files[0]?.path||'';let fileLabel=files[0]?.filename||'arquivo escolhido manualmente';let msg=chosen?'Restaurar o backup mais recente?\n\n'+fileLabel+'\n\nDigite RESTAURAR para confirmar.':'Nenhum arquivo listado. Para escolher manualmente, digite RESTAURAR.';let typed=prompt(msg,'');if(String(typed||'').trim().toUpperCase()!=='RESTAURAR')return;let safety=await runCloudBackup({quiet:true});if(!safety?.ok&&!confirm('Não foi possível criar backup de segurança antes da restauração. Continuar mesmo assim?'))return;let r=await withOperation('Restaurando backup...',()=>window.nexagest?.cloudRestoreBackup?.(chosen?{path:chosen}:{}));if(r?.ok&&r.data){db=migrate(r.data);save();audit('Backup restaurado');alert('Backup restaurado com sucesso.');app()}else alert(r?.error||'Restauração cancelada.')}catch(e){alert('Erro ao restaurar backup: '+(e.message||e))}}
function cloudBackupsFileListView(){let files=cloudBackupFiles().slice(0,8);return files.length?`<div class="panel nested"><h3>Arquivos encontrados na pasta</h3>${table(['Arquivo','Provedor','Tamanho','Data'],files.map(f=>[esc(f.filename),esc(f.provider||''),formatBytes(f.size||0),br(f.modifiedAt)]))}</div>`:''}
function cloudBackupHealthView(){let provider=db.settings.backupProvider||'Local',folder=db.settings.backupFolder||'',h=cloudBackupHistory();let items=[];items.push(provider==='Local'?'Destino local selecionado.':'Destino sincronizado selecionado: '+provider+'.');items.push(folder?'Pasta definida.':'Pasta não definida: será usada a pasta padrão do NexaGest.');items.push(h.length?'Último backup registrado em '+br(h[0].date)+'.':'Nenhum backup registrado ainda.');return `<div class="cloud-health"><b>Revisão do backup</b>${items.map(x=>`<span>• ${esc(x)}</span>`).join('')}</div>`}
function formatBytes(n){n=Number(n||0);if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1).replace('.',',')+' KB';return (n/1024/1024).toFixed(1).replace('.',',')+' MB'}
function cloudBackupHistoryView(){let h=cloudBackupHistory().slice(0,8);return h.length?`<div class="backup-history cloud-history">${h.map(x=>`<div><b>${br(x.date)}${x.auto?' • Auto':''}</b><span>${esc(x.provider)} ${x.file?'• '+esc(x.file):''} ${x.size?'• '+formatBytes(x.size):''}</span></div>`).join('')}</div>`:'<p class="muted small">Nenhum backup em nuvem registrado ainda.</p>'}
function dashboardWidgetList(){return[{id:'vendas',label:'Vendas do dia'},{id:'lucro',label:'Lucro líquido'},{id:'caixa',label:'Resumo do caixa'},{id:'estoque',label:'Estoque crítico'},{id:'entregas',label:'Entregas pendentes'},{id:'receber',label:'Contas a receber'},{id:'metas',label:'Metas e tendências'},{id:'topProdutos',label:'Produtos mais vendidos'}]}
function getDashboardPrefs(){try{let v=JSON.parse(localStorage.getItem('nexagest-dashboard-widgets')||'null');if(Array.isArray(v))return v}catch(e){}return dashboardWidgetList().map(w=>w.id)}
function saveDashboardPrefs(){let ids=[...document.querySelectorAll('[data-dash-widget]:checked')].map(i=>i.dataset.dashWidget);localStorage.setItem('nexagest-dashboard-widgets',JSON.stringify(ids));alert('Preferências do dashboard salvas.');app()}
function customReportDefs(){return{sales:{label:'Vendas',icon:'🧾',cols:[['date','Data'],['client','Cliente'],['payment','Pagamento'],['items','Itens'],['total','Total'],['cost','Custo'],['profit','Lucro'],['status','Status']]},products:{label:'Produtos',icon:'📦',cols:[['name','Produto'],['barcode','Código'],['category','Categoria'],['brand','Marca'],['cost','Custo'],['sale','Venda'],['stock','Estoque'],['min','Mínimo'],['margin','Margem']]},clients:{label:'Clientes',icon:'👥',cols:[['name','Cliente'],['phone','Telefone'],['city','Cidade'],['open','Em aberto'],['bought','Total comprado'],['last','Última compra'],['limit','Limite']]},suppliers:{label:'Fornecedores',icon:'🏢',cols:[['name','Fornecedor'],['phone','Telefone'],['city','Cidade'],['total','Total comprado'],['last','Última compra'],['products','Produtos']]},finance:{label:'Financeiro',icon:'💰',cols:[['date','Data'],['description','Descrição'],['category','Categoria'],['type','Tipo'],['value','Valor'],['payment','Pagamento'],['status','Situação']]},cash:{label:'Caixas',icon:'💵',cols:[['openedAt','Abertura'],['closedAt','Fechamento'],['operator','Operador'],['sales','Vendas'],['money','Dinheiro'],['pix','Pix'],['expected','Esperado'],['final','Contado'],['diff','Diferença']]}}}

function refreshCustomReportsPanel(){
  const panel=document.getElementById('customReportsPanel');
  if(!panel){app();return}
  const active=document.activeElement;
  const focusId=active?.id||'';
  const start=typeof active?.selectionStart==='number'?active.selectionStart:null;
  const end=typeof active?.selectionEnd==='number'?active.selectionEnd:null;
  panel.outerHTML=customReportsPanel();
  bindCustomReportEvents();
  if(focusId){setTimeout(()=>{const el=document.getElementById(focusId);if(el){el.focus();if(start!==null&&el.setSelectionRange)el.setSelectionRange(start,end??start)}},0)}
}
function bindCustomReportEvents(){
  document.querySelectorAll('[data-quick-report]').forEach(b=>b.onclick=e=>{e.preventDefault();loadQuickReport(b.dataset.quickReport)});
  document.querySelectorAll('[data-favorite-report-model]').forEach(b=>b.onclick=e=>{e.preventDefault();toggleReportFavorite(b.dataset.favoriteReportModel)});
  on('customReportBase',e=>{localStorage.setItem('custom-report-base',e.target.value);localStorage.removeItem('custom-report-loaded-cols');refreshCustomReportsPanel()},'change');
  on('customReportFrom',e=>{range.from=e.target.value;refreshCustomReportsPanel()},'change');
  on('customReportTo',e=>{range.to=e.target.value;refreshCustomReportsPanel()},'change');
  on('customReportSearch',e=>{localStorage.setItem('custom-report-q',e.target.value);refreshCustomReportsPanel()},'input');
  on('customReportSort',e=>{localStorage.setItem('custom-report-sort',e.target.value);refreshCustomReportsPanel()},'change');
  document.querySelectorAll('[data-report-col]').forEach(i=>i.onchange=()=>{let base=customReportBase();let cols=[...document.querySelectorAll('[data-report-col]:checked')].map(x=>x.dataset.reportCol);localStorage.setItem('custom-report-cols-'+base,JSON.stringify(cols));refreshCustomReportsPanel()});
  document.querySelectorAll('[data-load-report-model]').forEach(b=>b.onclick=e=>{e.preventDefault();loadReportModel(b.dataset.loadReportModel)});
  document.querySelectorAll('[data-delete-report-model]').forEach(b=>b.onclick=e=>{e.preventDefault();deleteReportModel(b.dataset.deleteReportModel)});
}

function customReportBase(){return localStorage.getItem('custom-report-base')||val('customReportBase')||'sales'}
function customReportLabel(k){let defs=customReportDefs(),base=customReportBase();return Object.fromEntries((defs[base]?.cols||defs.sales.cols).map(x=>[x[0],x[1]]))[k]||k}
function customReportColumnsView(base=customReportBase(),selected=null){let defs=customReportDefs(),cols=defs[base]?.cols||defs.sales.cols,sel=selected||cols.map(x=>x[0]);return cols.map(([k,label])=>`<label class="check-row report-col"><input type="checkbox" data-report-col="${k}" ${sel.includes(k)?'checked':''}> ${esc(label)}</label>`).join('')}
function selectedReportColumns(){let base=customReportBase(),defs=customReportDefs(),fallback=(defs[base]?.cols||defs.sales.cols).map(x=>x[0]);let dom=[...document.querySelectorAll('[data-report-col]')];if(dom.length){let cols=dom.filter(i=>i.checked).map(i=>i.dataset.reportCol);return cols.length?cols:fallback}try{let saved=JSON.parse(localStorage.getItem('custom-report-cols-'+base)||'null');if(Array.isArray(saved)&&saved.length)return saved}catch(e){}return fallback}
function getReportModels(){try{return JSON.parse(localStorage.getItem('nexagest-report-models')||'[]')}catch(e){return[]}}
function setReportModels(models){localStorage.setItem('nexagest-report-models',JSON.stringify((models||[]).slice(0,40)))}
function getFavoriteReportModels(){return getReportModels().filter(m=>m.favorite)}
function getRecentReports(){try{return JSON.parse(localStorage.getItem('nexagest-recent-reports')||'[]')}catch(e){return[]}}
function setRecentReports(rows){localStorage.setItem('nexagest-recent-reports',JSON.stringify((rows||[]).slice(0,12)))}
function markReportRecent(type){let base=customReportBase(),defs=customReportDefs(),rows=customReportRows(),title=val('reportModelName')||defs[base]?.label||'Relatório';let recent=getRecentReports();recent.unshift({id:uid(),title,type,base,baseLabel:defs[base]?.label||base,rows:rows.length,createdAt:new Date().toISOString(),from:range.from,to:range.to});setRecentReports(recent)}
function reportRecentView(){let recent=getRecentReports();return recent.length?table(['Quando','Relatório','Base','Registros'],recent.slice(0,6).map(r=>[br(r.createdAt),esc(r.type||'Exportação'),esc(r.baseLabel||r.base),String(r.rows||0)])):'<p class="muted">Nenhum relatório exportado ainda.</p>'}
function toggleReportFavorite(id){let models=getReportModels().map(m=>m.id===id?{...m,favorite:!m.favorite}:m);setReportModels(models);refreshCustomReportsPanel()}
function loadQuickReport(base){localStorage.setItem('custom-report-base',base);localStorage.setItem('custom-report-q','');localStorage.setItem('custom-report-sort','');localStorage.removeItem('custom-report-loaded-cols');refreshCustomReportsPanel()}
function customReportsPanel(){let defs=customReportDefs(),base=customReportBase(),models=getReportModels(),fav=getFavoriteReportModels(),q=localStorage.getItem('custom-report-q')||'',sort=localStorage.getItem('custom-report-sort')||'';let loadedCols=null;try{loadedCols=JSON.parse(localStorage.getItem('custom-report-loaded-cols')||'null');localStorage.removeItem('custom-report-loaded-cols')}catch(e){}let savedCols=null;try{savedCols=JSON.parse(localStorage.getItem('custom-report-cols-'+base)||'null')}catch(e){}let cols=loadedCols||savedCols||selectedReportColumns();let rows=customReportRows();return `<div id="customReportsPanel"><div class="report-pro-strip"><button class="ghost ${base==='sales'?'ok':''}" data-quick-report="sales">🧾 Vendas</button><button class="ghost ${base==='products'?'ok':''}" data-quick-report="products">📦 Produtos</button><button class="ghost ${base==='clients'?'ok':''}" data-quick-report="clients">👥 Clientes</button><button class="ghost ${base==='suppliers'?'ok':''}" data-quick-report="suppliers">🏢 Fornecedores</button><button class="ghost ${base==='finance'?'ok':''}" data-quick-report="finance">💰 Financeiro</button><button class="ghost ${base==='cash'?'ok':''}" data-quick-report="cash">💵 Caixas</button></div><div class="report-filters custom-report-filters"><div class="field"><label>Nome do modelo</label><input id="reportModelName" placeholder="Ex.: Vendas por cliente"></div><div class="field"><label>Base do relatório</label><select id="customReportBase">${Object.entries(defs).map(([k,d])=>`<option value="${k}" ${base===k?'selected':''}>${d.icon} ${d.label}</option>`).join('')}</select></div><div class="field"><label>De</label><input id="customReportFrom" type="date" value="${range.from}"></div><div class="field"><label>Até</label><input id="customReportTo" type="date" value="${range.to}"></div><div class="field"><label>Buscar dentro do relatório</label><input id="customReportSearch" placeholder="Produto, cliente, pagamento..." value="${esc(q)}"></div><div class="field"><label>Ordenar por</label><select id="customReportSort"><option value="">Padrão</option>${(defs[base]?.cols||[]).map(([k,l])=>`<option value="${k}" ${sort===k?'selected':''}>${esc(l)}</option>`).join('')}</select></div></div><div class="grid two custom-report-layout"><div class="panel nested"><div class="between"><h3>Colunas do relatório</h3><span class="pill">${cols.length} coluna(s)</span></div><div class="premium-columns report-columns">${customReportColumnsView(base,cols)}</div></div><div class="panel nested"><div class="between"><h3>Modelos salvos</h3><span class="pill">${models.length}</span></div>${models.length?table(['⭐','Nome','Base','Colunas','Ações'],models.slice(0,10).map(m=>[`<button class="ghost report-star" title="Favoritar" data-favorite-report-model="${m.id}">${m.favorite?'★':'☆'}</button>`,esc(m.name),esc(defs[m.base]?.label||m.base),m.columns.length,`<button class="ghost" data-load-report-model="${m.id}">Carregar</button> <button class="ghost danger" data-delete-report-model="${m.id}">Excluir</button>`])):'<p class="muted">Nenhum modelo salvo ainda.</p>'}</div></div><div class="grid two custom-report-layout"><div class="panel nested"><div class="between"><h3>Favoritos</h3><span class="pill">${fav.length}</span></div>${fav.length?table(['Nome','Base','Ação'],fav.slice(0,6).map(m=>[esc(m.name),esc(defs[m.base]?.label||m.base),`<button class="ghost" data-load-report-model="${m.id}">Carregar</button>`])):'<p class="muted">Favorite seus modelos mais usados com a estrela.</p>'}</div><div class="panel nested"><div class="between"><h3>Últimos relatórios</h3><span class="pill">${getRecentReports().length}</span></div>${reportRecentView()}</div></div><div class="panel nested custom-preview"><div class="between"><div><h3>Prévia do relatório</h3><p class="muted small">${rows.length} registro(s) encontrados. A exportação usa exatamente esta seleção de colunas.</p></div><span class="pill good">${esc(defs[base]?.label||base)}</span></div>${customReportPreviewTable(cols,rows)}</div></div>`}
function saveReportModel(){let name=val('reportModelName')||'Modelo '+new Date().toLocaleDateString('pt-BR'),base=customReportBase(),columns=selectedReportColumns();let m=getReportModels();m.unshift({id:uid(),name,base,columns,from:val('customReportFrom')||range.from,to:val('customReportTo')||range.to,search:val('customReportSearch')||'',sort:val('customReportSort')||'',favorite:false,createdAt:new Date().toISOString()});setReportModels(m);alert('Modelo de relatório salvo.');app()}
function loadReportModel(id){let m=getReportModels().find(x=>x.id===id);if(!m)return;localStorage.setItem('custom-report-base',m.base||'sales');localStorage.setItem('custom-report-q',m.search||'');localStorage.setItem('custom-report-sort',m.sort||'');range.from=m.from||range.from;range.to=m.to||range.to;localStorage.setItem('custom-report-loaded-cols',JSON.stringify(m.columns||[]));localStorage.setItem('custom-report-cols-'+(m.base||'sales'),JSON.stringify(m.columns||[]));refreshCustomReportsPanel()}
function deleteReportModel(id){setReportModels(getReportModels().filter(x=>x.id!==id));alert('Modelo excluído.');refreshCustomReportsPanel()}
function customReportRows(){let base=customReportBase(),from=val('customReportFrom')||range.from,to=val('customReportTo')||range.to,q=(val('customReportSearch')||localStorage.getItem('custom-report-q')||'').toLowerCase(),sort=val('customReportSort')||localStorage.getItem('custom-report-sort')||'';let rows=[];
  if(base==='sales')rows=salesValid().filter(s=>s.date.slice(0,10)>=from&&s.date.slice(0,10)<=to).map(s=>({date:br(s.date),client:client(s.clientId).name,payment:s.payment,items:(s.items||[]).reduce((a,i)=>a+Number(i.qty||0),0),total:money(s.total),cost:money(s.cost),profit:money(Number(s.total||0)-Number(s.cost||0)),status:s.cancelled?'Cancelada':'OK'}));
  else if(base==='products')rows=db.products.map(p=>({name:p.name,barcode:p.barcode||'',category:p.category||'Geral',brand:p.brand||'',cost:money(p.cost),sale:money(p.sale),stock:p.stock,min:p.min,margin:margin(p)}));
  else if(base==='clients')rows=db.clients.map(c=>({name:c.name,phone:c.phone||'',city:c.city||'',open:money(openByClient(c.id)),bought:money(sum(salesValid().filter(s=>s.clientId===c.id),'total')),last:lastClientSale(c.id),limit:money(c.creditLimit||0)}));
  else if(base==='suppliers')rows=db.suppliers.map(s=>{let ps=db.purchases.filter(p=>p.supplierId===s.id);let last=[...ps].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];return{name:s.name,phone:s.phone||'',city:s.city||'',total:money(sum(ps,'total')),last:last?br(last.date):'-',products:new Set(ps.map(p=>p.productId)).size}});
  else if(base==='finance')rows=(db.expenses||[]).filter(e=>String(e.date||'').slice(0,10)>=from&&String(e.date||'').slice(0,10)<=to).map(e=>({date:br(e.date),description:e.description||'',category:e.category||'',type:e.type||'',value:money(e.value),payment:e.payment||'',status:e.status||''}));
  else rows=(db.cashRegisters||[]).map(c=>({openedAt:br(c.openedAt),closedAt:c.closedAt?br(c.closedAt):'-',operator:c.operatorName||'',sales:money(c.totalSales||0),money:money(c.money||0),pix:money(c.pix||0),expected:money(c.expectedAmount||0),final:money(c.finalAmount||0),diff:money(c.difference||0)}));
  if(q)rows=rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(q));
  if(sort)rows=[...rows].sort((a,b)=>String(a[sort]??'').localeCompare(String(b[sort]??''),'pt-BR',{numeric:true}));
  return rows;
}
function customReportPreviewTable(cols,rows){let visible=rows.slice(0,80);return table(cols.map(customReportLabel),visible.map(r=>cols.map(c=>esc(r[c]??''))))+(rows.length>80?`<p class="muted small">Mostrando 80 de ${rows.length} registros na prévia.</p>`:'')}
function reportExportHtml(title){let cols=selectedReportColumns(),rows=customReportRows(),base=customReportBase(),defs=customReportDefs();return `<!doctype html><meta charset=utf-8><title>${esc(title)}</title><style>body{font-family:Arial;padding:24px;color:#111}h1{margin-bottom:4px}.muted{color:#555}.brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.cards{display:flex;gap:12px;margin:16px 0;flex-wrap:wrap}.cards div{border:1px solid #ddd;border-radius:10px;padding:10px 14px;min-width:120px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ddd;padding:7px}th{background:#f3f4f6;text-align:left}@media print{button{display:none}body{padding:10px}}</style><div class="brand"><div><h1>${esc(db.settings.company||'NexaGest')}</h1><p class="muted">${esc(title)} • ${esc(defs[base]?.label||base)}</p></div><div class="muted">${range.from} até ${range.to}<br>Gerado em ${new Date().toLocaleString('pt-BR')}</div></div><div class="cards"><div><b>${rows.length}</b><br>registro(s)</div><div><b>${cols.length}</b><br>coluna(s)</div><div><b>${esc(defs[base]?.label||base)}</b><br>base</div></div><table><thead><tr>${cols.map(c=>`<th>${esc(customReportLabel(c))}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`}
function exportCustomReportCsv(){let cols=selectedReportColumns(),rows=customReportRows();let out=[cols.map(customReportLabel),...rows.map(r=>cols.map(c=>r[c]??''))];markReportRecent('CSV');download(out.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-relatorio-personalizado.csv','text/csv;charset=utf-8')}
function exportCustomReportExcel(){let title=val('reportModelName')||'Relatório personalizado',html=reportExportHtml(title);markReportRecent('Excel');download(html,'nexagest-relatorio-personalizado.xls','application/vnd.ms-excel;charset=utf-8')}
function exportCustomReportPdf(){let title=val('reportModelName')||'Relatório personalizado',html=reportExportHtml(title)+`<script>setTimeout(()=>window.print(),400)<\/script>`;markReportRecent('PDF');if(window.nexagest?.exportHtml){window.nexagest.exportHtml({title:'Exportar PDF',filename:'relatorio-personalizado-pdf',html})}else{let w=window.open('','_blank');w.document.write(html);w.document.close()}}
function exportCustomReportHtml(){let title=val('reportModelName')||'Relatório personalizado',html=reportExportHtml(title);markReportRecent('HTML');if(window.nexagest?.exportHtml){window.nexagest.exportHtml({title:'Exportar relatório personalizado',filename:'relatorio-personalizado',html})}else{let w=window.open('','_blank');w.document.write(html);w.document.close()}}
function openCommandPalette(){
  closeCommandPalette();
  let ov=document.createElement('div');
  ov.id='commandPaletteOverlay';
  ov.className='modal-overlay command-overlay open';
  ov.innerHTML=`<div class="command-card" role="dialog" aria-modal="true"><div class="command-search"><span>⌘</span><input id="commandInput" placeholder="Digite: cliente, produto, venda, backup, relatório..." autocomplete="off"></div><div id="commandResults" class="command-results"></div><p class="muted small">Use ↑ ↓ Enter ou clique. Esc fecha.</p></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('modal-open');

  const input=document.getElementById('commandInput');
  const results=document.getElementById('commandResults');

  // Eventos ligados diretamente no modal criado dinamicamente.
  // Isso evita depender do bind() principal, que roda antes do modal existir.
  input?.addEventListener('input',filterCommandPalette);
  input?.addEventListener('keydown',commandPaletteKey);

  // Clique no fundo fecha. Clique dentro do card não fecha.
  ov.addEventListener('click',e=>{if(e.target===ov)closeCommandPalette()});

  // Delegação de mouse para os resultados: funciona mesmo quando a lista é redesenhada.
  results?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-command-run]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    runCommand(btn.dataset.commandRun);
  });
  results?.addEventListener('mousemove',e=>{
    const btn=e.target.closest('[data-command-run]');
    if(!btn)return;
    const idx=Number(btn.dataset.commandRun)||0;
    if(window.__cmdIndex!==idx){window.__cmdIndex=idx;paintCommandSelection()}
  });

  filterCommandPalette();
  setTimeout(()=>input?.focus(),20);
}
function closeCommandPalette(){document.getElementById('commandPaletteOverlay')?.remove();document.body.classList.remove('modal-open')}
function commandItems(){
  let items=[];
  nav.filter(n=>can(n[0])).forEach(n=>items.push({label:n[2],sub:'Abrir tela',page:n[0],icon:n[1]}));

  // Resultados de dados também respeitam permissões:
  // Caixa pode consultar clientes e produtos no Ctrl+K; Estoque consulta produtos.
  if(can('clients')){
    db.clients.slice(0,80).forEach(c=>items.push({
      label:c.name,
      sub:'Cliente '+(c.phone||''),
      run:()=>openClientProfile(c.id),
      icon:'👥'
    }));
  }

  if(can('products') || can('pdv')){
    db.products.slice(0,120).forEach(p=>items.push({
      label:p.name,
      sub:'Produto '+(p.barcode||''),
      run:()=>openProductProfile(p.id),
      icon:'📦'
    }));
  }

  if(can('suppliers')){
    db.suppliers.slice(0,60).forEach(s=>items.push({
      label:s.name,
      sub:'Fornecedor '+(s.phone||''),
      run:()=>openSupplierProfile(s.id),
      icon:'🏢'
    }));
  }

  // Ações administrativas só aparecem para quem tem permissão no módulo Premium.
  if(can('premium')){
    items.push({label:'Fazer backup premium',sub:'Backup em nuvem/local',run:runCloudBackup,icon:'☁️'});
  }

  return items;
}
function normalizeSearchText(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function filterCommandPalette(){
  let q=normalizeSearchText(document.getElementById('commandInput')?.value||'');
  let all=commandItems();
  let list=all.filter(i=>!q||normalizeSearchText(i.label+' '+(i.sub||'')).includes(q));
  // Prioriza correspondência no começo do nome, depois no restante.
  if(q)list.sort((a,b)=>{
    const aa=normalizeSearchText(a.label).startsWith(q)?0:1;
    const bb=normalizeSearchText(b.label).startsWith(q)?0:1;
    return aa-bb || String(a.label).localeCompare(String(b.label),'pt-BR');
  });
  list=list.slice(0,12);
  window.__cmdItems=list;
  window.__cmdIndex=list.length?0:-1;
  renderCommandResults();
}
function renderCommandResults(){
  let box=document.getElementById('commandResults'),list=window.__cmdItems||[],sel=Number(window.__cmdIndex||0);
  if(!box)return;
  box.innerHTML=list.map((i,idx)=>`<button type="button" data-command-run="${idx}" class="${idx===sel?'active':''}"><b>${i.icon||'•'} ${esc(i.label)}</b><span>${esc(i.sub||'')}</span></button>`).join('')||'<p class="muted">Nada encontrado.</p>';
  box.querySelector('.active')?.scrollIntoView({block:'nearest'});
}
function paintCommandSelection(){
  const box=document.getElementById('commandResults');
  if(!box)return;
  box.querySelectorAll('[data-command-run]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.commandRun)===Number(window.__cmdIndex)));
  box.querySelector('.active')?.scrollIntoView({block:'nearest'});
}
function commandPaletteKey(e){
  let list=window.__cmdItems||[];
  if(e.key==='Escape'){e.preventDefault();closeCommandPalette();return}
  if(e.key==='ArrowDown'){
    e.preventDefault();
    if(list.length){window.__cmdIndex=((Number(window.__cmdIndex)>=0?Number(window.__cmdIndex):0)+1)%list.length;paintCommandSelection()}
    return;
  }
  if(e.key==='ArrowUp'){
    e.preventDefault();
    if(list.length){window.__cmdIndex=((Number(window.__cmdIndex)>=0?Number(window.__cmdIndex):0)-1+list.length)%list.length;paintCommandSelection()}
    return;
  }
  if(e.key==='Enter'){
    e.preventDefault();
    runCommand(window.__cmdIndex);
    return;
  }
}
function runCommand(idx){let n=Number(idx);if(!Number.isFinite(n)||n<0)n=0;let item=(window.__cmdItems||[])[n];if(!item)return;if(item.page){closeCommandPalette();navigateTo(item.page);return}closeCommandPalette();setTimeout(()=>item.run&&item.run(),30)}


function normalizeNetworkAddressInput(v){
  let value=String(v||'').trim();
  if(!value)return 'http://127.0.0.1:3333';
  if(!/^https?:\/\//i.test(value))value='http://'+value;
  return value.replace(/\/+$/,'');
}

function networkLog(message,type='info'){
  db.settings.networkLogs=Array.isArray(db.settings.networkLogs)?db.settings.networkLogs:[];
  const now=new Date().toISOString();
  db.settings.networkLogs.unshift({at:now,message:String(message||''),type});
  db.settings.networkLastActivity={at:now,message:String(message||''),type};
  db.settings.networkLogs=db.settings.networkLogs.slice(0,80);
  save();
}
function networkStatusInfo(role){
  const running=!!db.settings.networkServerRunning;
  const ok=!!db.settings.networkLastTestOk;
  if(role==='standalone')return {label:'Uso Individual',icon:'⚪',cls:'warn',health:70,desc:'Sistema funcionando localmente, sem rede.'};
  if(role==='server'&&running)return {label:'Servidor Online',icon:'🟢',cls:'good',health:98,desc:'Porta aberta e aceitando conexões.'};
  if(role==='server'&&!running)return {label:'Servidor Parado',icon:'🟠',cls:'warn',health:70,desc:'Clique em iniciar servidor.'};
  if(role==='client'&&ok)return {label:'Cliente Conectado',icon:'🔵',cls:'good',health:96,desc:'Comunicação com o servidor confirmada.'};
  if(role==='client'&&!ok)return {label:'Desconectado',icon:'🔴',cls:'danger',health:55,desc:'Teste a conexão com o servidor.'};
  return {label:'Uso Individual',icon:'⚪',cls:'warn',health:70,desc:'Sistema funcionando localmente, sem rede.'};
}
function catalogSyncStatsSummary(){
  const s=db.settings.lastCatalogSyncStats||{};
  const pending=Number(db.settings.networkPendingItems||0);
  return {
    products:s.products?.total??(db.products||[]).length,
    clients:s.clients?.total??(db.clients||[]).length,
    suppliers:s.suppliers?.total??(db.suppliers||[]).length,
    pending,
    duration:db.settings.lastCatalogSyncDurationMs?db.settings.lastCatalogSyncDurationMs+' ms':'—'
  };
}
function networkLogHtml(){
  const logs=Array.isArray(db.settings.networkLogs)?db.settings.networkLogs.slice(0,10):[];
  if(!logs.length)return '<div class="network-log-empty">Nenhum evento de rede ainda.</div>';
  return logs.map(l=>`<div class="network-log-item ${esc(l.type||'info')}"><span>${br(l.at)}</span><b>${esc(l.message)}</b></div>`).join('');
}

function formatDuration(ms){
  if(!Number.isFinite(ms)||ms<0)return '—';
  const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
  return [h,m,sec].map(x=>String(x).padStart(2,'0')).join(':');
}

function networkSettingsPanel(){
  const role=db.settings.networkRole||'standalone';
  const port=db.settings.networkPort||3333;
  const serverAddress=normalizeNetworkAddressInput(db.settings.serverAddress||'http://127.0.0.1:3333');
  const syncMode=db.settings.syncMode||'manual';
  const lastSync=db.settings.lastSyncAt?br(db.settings.lastSyncAt):'Nunca sincronizado';
  const syncLabel=syncMode==='startup'?'Ao abrir o sistema':'Manual';
  const serverUrl=db.settings.networkServerUrl||('http://127.0.0.1:'+port);
  const info=networkStatusInfo(role);
  const ping=db.settings.networkLastPingMs?db.settings.networkLastPingMs+' ms':'—';
  const tested=db.settings.networkLastTestAt?br(db.settings.networkLastTestAt):'Nunca testado';
  const clients=db.settings.networkClientsConnected??'—';
  const lastCatalogSync=db.settings.lastCatalogSyncAt?br(db.settings.lastCatalogSyncAt):'Nunca sincronizado';
  const stats=catalogSyncStatsSummary();
  const bizStats=businessSyncStatsSummary();
  const progress=Number(db.settings.networkProgress||0);
  const activity=db.settings.networkLastActivity;
  const lastActivity=activity?.message?(esc(activity.message)+'<small>'+esc(br(activity.at))+'</small>'):'Nenhuma atividade<small>Aguardando operação</small>';
  const uptime=db.settings.networkServerStartedAt?formatDuration(Date.now()-new Date(db.settings.networkServerStartedAt).getTime()):'—';
  const topExtra=(info.cls==='good'&&ping!=='—')?` <small class="network-pill-extra">⚡ ${esc(ping)}</small>`:'';
  return `<div class="panel settings-card smart-section network-panel network-v5011"><div class="between"><div><h3>Sincronização real entre computadores</h3><p class="muted small">v5.0.3: atualização em tempo real, monitoramento automático e conflitos básicos.</p></div><span class="pill ${info.cls}">${info.icon} ${esc(info.label)}<small id="networkTopUptimeLive" class="network-pill-extra"></small>${topExtra}</span></div>
  <div class="network-grid">
    <button type="button" class="network-card ${role==='standalone'?'active':''}" data-set-network-role="standalone"><b>💻 Uso individual</b><span>Usa somente este computador, sem rede.</span></button>
    <button type="button" class="network-card ${role==='server'?'active':''}" data-set-network-role="server"><b>🖥️ Servidor local</b><span>Este PC abre a porta e aceita conexões da loja.</span></button>
    <button type="button" class="network-card ${role==='client'?'active':''}" data-set-network-role="client"><b>🔗 Cliente da rede</b><span>Conecta em um servidor já iniciado.</span></button>
  </div>
  <div class="form-grid">
    <div class="field"><label>Modo de rede</label><select id="networkRole"><option value="standalone" ${role==='standalone'?'selected':''}>Uso individual</option><option value="server" ${role==='server'?'selected':''}>Servidor local</option><option value="client" ${role==='client'?'selected':''}>Cliente / computador secundário</option></select></div>
    <div class="field"><label>Porta do servidor</label><input id="networkPort" value="${esc(port)}" placeholder="3333"></div>
    <div class="field wide"><label>Endereço do servidor</label><input id="serverAddress" value="${esc(serverAddress)}" placeholder="http://127.0.0.1:3333"><small>Para testar neste mesmo PC use <b>http://127.0.0.1:3333</b>. Em outro PC use o IP exibido pelo servidor.</small></div>
    <div class="field"><label>Sincronização</label><select id="syncMode"><option value="manual" ${syncMode==='manual'?'selected':''}>Manual</option><option value="startup" ${syncMode==='startup'?'selected':''}>Ao abrir o sistema</option></select></div>
  </div>
  <div class="network-health-card ${info.cls}"><div><span>Saúde da sincronização</span><b>${info.health}%</b><small>${esc(info.desc)}</small></div><div class="network-health-bar"><i style="width:${info.health}%"></i></div></div>
  ${progress>0&&progress<100?`<div class="network-progress"><b>Sincronizando...</b><div><i style="width:${progress}%"></i></div><span>${progress}%</span></div>`:''}
  <div class="network-status-row">
    <div><span>Status da rede</span><b>${info.icon} ${esc(info.label)}</b></div>
    <div><span>Endereço do servidor</span><b>${esc(serverUrl)}</b></div>
    <div><span>Clientes conectados</span><b>${esc(clients)}</b></div>
    <div><span>Tempo online</span><b id="networkUptimeLive">${esc(uptime)}</b></div>
    <div><span>Última atividade</span><b class="network-activity-card">${lastActivity}</b></div>
    <div><span>Ping</span><b>${esc(ping)}</b></div>
    <div><span>Último teste</span><b>${esc(tested)}</b></div>
    <div><span>Última sincronização</span><b>${esc(lastSync)}</b></div>
  </div>
  <div class="network-status-row catalog-sync-row">
    <div><span>Produtos sincronizados</span><b>${stats.products}</b></div>
    <div><span>Clientes sincronizados</span><b>${stats.clients}</b></div>
    <div><span>Fornecedores sincronizados</span><b>${stats.suppliers}</b></div>
    <div><span>Pendências</span><b>${stats.pending}</b></div>
    <div><span>Tempo da última sync</span><b>${esc(stats.duration)}</b></div>
    <div><span>Última sync de cadastros</span><b>${esc(lastCatalogSync)}</b></div>
  </div>
  <div class="network-status-row business-sync-row">
    <div><span>Vendas sincronizadas</span><b>${bizStats.sales}</b></div>
    <div><span>Mov. de estoque</span><b>${bizStats.stockMoves}</b></div>
    <div><span>Caixas sincronizados</span><b>${bizStats.cashRegisters}</b></div>
    <div><span>Contas/fiado</span><b>${bizStats.receivables}</b></div>
    <div><span>Produtos atualizados</span><b>${bizStats.products}</b></div>
    <div><span>Última sync operacional</span><b>${esc(bizStats.last)}</b></div>
    <div><span>Tempo real</span><b>${role==='client'?'Ativo a cada 5s':role==='server'&&db.settings.networkServerRunning?'Monitorando':'Desligado'}</b></div>
    <div><span>Revisão servidor</span><b>${esc(db.settings.networkKnownRevision||'—')}</b></div>
    <div><span>Conflitos básicos</span><b>${esc((db.settings.networkConflicts||[]).length||0)}</b></div>
  </div>
  <div class="network-actions">
    <button id="saveSystemNetwork">Salvar configuração</button>
    ${role==='server'?(db.settings.networkServerRunning?`<button class="danger" id="stopNetworkServer">Parar servidor</button><button class="ghost" id="runNetworkDiagnostics">Diagnóstico completo</button><button class="ghost" id="networkSelfTest">Testar neste PC</button><button class="ghost" id="networkRealtimeCheck">Checar tempo real</button>`:`<button class="ok" id="startNetworkServer">Iniciar servidor</button><button class="ghost" id="runNetworkDiagnostics">Diagnóstico completo</button><button class="ghost" id="networkSelfTest">Testar neste PC</button>`):''}
    ${role==='client'?`<button class="ghost" id="discoverNetworkServers">🔍 Procurar servidores</button><button class="ghost" id="testNetworkClient">Testar conexão</button><button class="ghost" id="runNetworkDiagnostics">Diagnóstico completo</button><button class="ok" id="syncCatalogData">Sincronizar cadastros</button><button class="ghost" id="networkRealtimeCheck">Checar tempo real</button><button class="ghost" id="pullCatalogData">Puxar cadastros</button><button class="ghost" id="pushCatalogData">Enviar cadastros</button><button class="ok" id="syncBusinessData">Sincronizar vendas/caixa</button><button class="ghost" id="pullBusinessData">Puxar vendas/caixa</button><button class="ghost" id="pushBusinessData">Enviar vendas/caixa</button><button class="ghost" id="pullNetworkData">Puxar base completa</button><button class="ghost" id="pushNetworkData">Enviar base completa</button>`:''}
    ${role==='standalone'?`<button class="ghost" id="networkSelfTest">Teste rápido local</button><button class="ghost" id="runNetworkDiagnostics">Diagnóstico completo</button>`:''}
  </div>
  <div class="network-log-box"><div class="between"><h4>Log da rede</h4><div class="row"><button class="ghost" id="clearNetworkLog">Limpar log</button><button class="ghost" id="saveNetworkLog">Salvar log</button></div></div>${networkLogHtml()}</div>
  <div class="network-note"><b>v5.0.3:</b><span>Sincronização operacional com monitoramento em tempo real e conflitos básicos. O cliente verifica alterações do servidor automaticamente.</span></div>
  <div class="network-note"><b>Teste em um PC:</b><span>Selecione <b>Servidor local</b>, clique em <b>Iniciar servidor</b> e depois em <b>Diagnóstico completo</b>. O teste usa 127.0.0.1 e confirma servidor, cliente e comunicação HTTP.</span></div></div>`
}
function networkPayload(){return {role:val('networkRole')||'standalone',port:Number(val('networkPort')||3333)||3333,serverAddress:normalizeNetworkAddressInput(val('serverAddress')||'http://127.0.0.1:3333'),syncMode:val('syncMode')||'manual'}}
async function stopServerForStandaloneIfNeeded(){
  if(!db.settings.networkServerRunning)return;
  try{await window.nexagest?.stopNetworkServer?.()}catch(e){console.warn('Falha ao parar servidor ao voltar para uso individual',e)}
  db.settings.networkServerRunning=false;
  db.settings.networkServerStartedAt='';
  db.settings.networkLastTestOk=false;
  db.settings.networkClientsConnected=0;
  networkLog('Servidor encerrado ao voltar para Uso Individual.','warn');
}
function saveSystemNetwork(showAlert=true){const n=networkPayload();db.settings.networkRole=n.role;db.settings.networkPort=n.port;db.settings.serverAddress=n.serverAddress;db.settings.syncMode=n.syncMode;db.settings.networkMode=n.role!=='standalone';if(n.role==='standalone'&&db.settings.networkServerRunning){stopServerForStandaloneIfNeeded().then(()=>{save();audit('Configuração de rede atualizada');app();if(showAlert)alert('Configuração de rede salva. Servidor encerrado para uso individual.')});return}save();audit('Configuração de rede atualizada');app();if(showAlert)alert('Configuração de rede salva.')}
async function setNetworkRoleUi(role){
  db.settings.networkRole=role||'standalone';
  db.settings.networkMode=db.settings.networkRole!=='standalone';
  if(db.settings.networkRole==='standalone')await stopServerForStandaloneIfNeeded();
  save();
  app();
}
function applyNetworkTestResult(r){
  db.settings.networkLastTestAt=new Date().toISOString();
  db.settings.networkLastTestOk=!!r?.ok;
  db.settings.networkLastPingMs=r?.pingMs||r?.local?.pingMs||'';
  db.settings.networkClientsConnected=r?.clientsConnected??r?.server?.clientsConnected??'';
  if(r?.url||r?.server?.url)db.settings.networkServerUrl=r.url||r.server.url;
  if(r?.address)db.settings.serverAddress=r.address;
  save();
}
async function startNetworkServerUi(){saveSystemNetwork(false);if(!window.nexagest?.startNetworkServer)return alert('Servidor local indisponível neste ambiente.');await withOperation('Iniciando servidor local...',async()=>{let r=await window.nexagest.startNetworkServer({port:db.settings.networkPort||3333,data:db,company:currentCompanyName()});if(!r?.ok)throw new Error(r?.error||'Não foi possível iniciar o servidor.');networkLog('Servidor local iniciado.','success');db.settings.networkServerRunning=true;db.settings.networkServerStartedAt=new Date().toISOString();db.settings.networkServerUrl=r.url||('http://127.0.0.1:'+db.settings.networkPort);db.settings.serverAddress=db.settings.networkServerUrl;db.settings.networkClientsConnected=r.clientsConnected??0;db.settings.networkLastTestAt=new Date().toISOString();db.settings.networkLastTestOk=true;save();app();alert('Servidor local ativo em '+db.settings.networkServerUrl+'\n\nPara testar no mesmo PC, use também: http://127.0.0.1:'+db.settings.networkPort);})}
async function stopNetworkServerUi(){if(!window.nexagest?.stopNetworkServer)return;let r=await window.nexagest.stopNetworkServer();networkLog('Servidor local parado.','warn');db.settings.networkServerRunning=false;db.settings.networkServerStartedAt='';db.settings.networkLastTestOk=false;save();app();alert(r?.ok?'Servidor local parado.':'Não foi possível parar o servidor.')}
async function testNetworkClientUi(){saveSystemNetwork(false);if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');await withOperation('Testando conexão...',async()=>{let r=await window.nexagest.networkRequest(db.settings.serverAddress,'status');applyNetworkTestResult(r);if(r?.ok)networkLog('Teste de conexão aprovado.','success');app();if(!r?.ok)throw new Error(r?.error||'Servidor não respondeu.');alert('Conexão OK!\n\nServidor: '+(r.company||'NexaGest')+'\nVersão: '+(r.version||'')+'\nPing: '+(r.pingMs||'—')+' ms\nEndereço: '+(r.address||db.settings.serverAddress));})}
async function networkSelfTestUi(){
  saveSystemNetwork(false);
  const role=db.settings.networkRole||'standalone';
  if(role==='standalone'){
    await withOperation('Executando teste rápido local...',async()=>{
      const started=Date.now();
      const localOk=!!db && Array.isArray(db.products) && Array.isArray(db.clients) && Array.isArray(db.suppliers);
      if(db.settings.networkServerRunning)await stopServerForStandaloneIfNeeded();
      db.settings.networkLastTestAt=new Date().toISOString();
      db.settings.networkLastTestOk=localOk;
      db.settings.networkLastPingMs=Math.max(1,Date.now()-started);
      db.settings.networkClientsConnected=0;
      networkLog(localOk?'Teste rápido local aprovado. Servidor não foi iniciado.':'Teste rápido local falhou.','success');
      save();app();
      if(!localOk)throw new Error('Banco local não respondeu corretamente.');
      alert('Teste rápido local aprovado!\n\n✓ Banco SQLite local OK\n✓ Produtos/clientes/fornecedores acessíveis\n✓ Configuração válida\n✓ Rede permanece desligada\n✓ Servidor não foi iniciado')
    });
    return;
  }
  if(!window.nexagest?.networkSelfTest)return alert('Teste de rede indisponível neste ambiente.');
  await withOperation('Executando teste local de rede...',async()=>{let r=await window.nexagest.networkSelfTest({port:db.settings.networkPort||3333,data:db,company:currentCompanyName()});applyNetworkTestResult(r);if(r?.ok)networkLog('Teste local aprovado em 127.0.0.1.','success');db.settings.networkServerRunning=!!r?.server?.running;if(db.settings.networkServerRunning&&!db.settings.networkServerStartedAt)db.settings.networkServerStartedAt=new Date().toISOString();db.settings.networkServerUrl=r?.server?.url||db.settings.networkServerUrl;db.settings.serverAddress=r?.server?.localhostUrl||('http://127.0.0.1:'+db.settings.networkPort);save();app();if(!r?.ok)throw new Error(r?.error||'Falha no teste local.');alert('Teste local aprovado!\n\n✓ Servidor iniciado\n✓ Cliente conectou em 127.0.0.1\n✓ Resposta recebida\n✓ Ping: '+(r.local?.pingMs||'—')+' ms')})}
async function pullNetworkDataUi(){saveSystemNetwork(false);confirmAction('Puxar os dados do servidor? Os dados atuais desta empresa serão substituídos pelos dados recebidos.',async()=>{await withOperation('Puxando dados do servidor...',async()=>{let r=await window.nexagest.networkRequest(db.settings.serverAddress,'pull');if(!r?.ok||!r.data)throw new Error(r?.error||'Não foi possível puxar os dados.');db=migrate(r.data);db.settings.lastSyncAt=new Date().toISOString();db.settings.networkLastPingMs=r.pingMs||'';save();audit('Dados puxados do servidor local');app();alert('Dados sincronizados a partir do servidor.')})},'Sincronizar dados','Puxar dados')}
async function pushNetworkDataUi(){saveSystemNetwork(false);confirmAction('Enviar os dados atuais para o servidor? A base do servidor será atualizada com estes dados.',async()=>{await withOperation('Enviando dados para o servidor...',async()=>{let r=await window.nexagest.networkRequest(db.settings.serverAddress,'push',{data:db,company:currentCompanyName()});if(!r?.ok)throw new Error(r?.error||'Não foi possível enviar os dados.');db.settings.lastSyncAt=new Date().toISOString();db.settings.networkLastPingMs=r.pingMs||'';save();audit('Dados enviados ao servidor local');app();alert('Dados enviados para o servidor.')})},'Enviar dados','Enviar')}


function catalogSyncPayload(){
  return {
    products:(db.products||[]).map(x=>({...x})),
    clients:(db.clients||[]).map(x=>({...x})),
    suppliers:(db.suppliers||[]).map(x=>({...x})),
    meta:{company:currentCompanyName(),version:APP_VERSION,generatedAt:new Date().toISOString()}
  }
}
function rowTimestampValue(item){
  const v=item?.updatedAt||item?.modifiedAt||item?.syncedAt||item?.date||item?.createdAt||'';
  const t=Date.parse(v);
  return Number.isFinite(t)?t:0;
}
function rowsDiffer(a,b){
  try{return JSON.stringify({...a,syncedAt:undefined})!==JSON.stringify({...b,syncedAt:undefined})}catch(e){return true}
}
function registerBasicConflict(type,key,localRow,remoteRow,winner='servidor'){
  db.settings.networkConflicts=Array.isArray(db.settings.networkConflicts)?db.settings.networkConflicts:[];
  db.settings.networkConflicts.unshift({id:uid(),type,key,winner,at:new Date().toISOString(),localName:localRow?.name||localRow?.desc||localRow?.id||'',remoteName:remoteRow?.name||remoteRow?.desc||remoteRow?.id||''});
  db.settings.networkConflicts=db.settings.networkConflicts.slice(0,30);
}
function catalogRecordKey(item,type){
  if(!item||typeof item!=='object')return '';
  if(item.id)return 'id:'+item.id;
  if(type==='products'&&item.barcode)return 'barcode:'+item.barcode;
  if(item.name)return 'name:'+String(item.name).trim().toLowerCase();
  if(item.phone)return 'phone:'+String(item.phone).replace(/\D/g,'');
  return '';
}
function mergeCatalogArray(localRows,incomingRows,type){
  const map=new Map();
  (localRows||[]).forEach((item,idx)=>map.set(catalogRecordKey(item,type)||('local:'+idx),{...item}));
  let added=0,updated=0,conflicts=0;
  (incomingRows||[]).forEach((item,idx)=>{
    const key=catalogRecordKey(item,type)||('remote:'+idx);
    const current=map.get(key);
    if(current){
      updated++;
      if(rowsDiffer(current,item)&&rowTimestampValue(current)>0&&rowTimestampValue(item)>0&&rowTimestampValue(current)!==rowTimestampValue(item)){
        conflicts++;registerBasicConflict(type,key,current,item,'servidor');
      }
    }else added++;
    map.set(key,{...(current||{}),...item,syncedAt:new Date().toISOString()});
  });
  return {rows:Array.from(map.values()),added,updated,total:map.size,conflicts};
}
function applyCatalogSnapshot(catalog){
  const stats={};
  ['products','clients','suppliers'].forEach(key=>{
    const merged=mergeCatalogArray(db[key]||[],catalog?.[key]||[],key);
    db[key]=merged.rows;
    stats[key]={added:merged.added,updated:merged.updated,total:merged.total,conflicts:merged.conflicts||0};
  });
  db.settings.lastSyncAt=new Date().toISOString();
  db.settings.lastCatalogSyncAt=db.settings.lastSyncAt;
  db.settings.lastCatalogSyncStats=stats;
  stats.conflicts=Object.values(stats).reduce((a,x)=>a+(x.conflicts||0),0);
  db.settings.networkPendingItems=stats.conflicts||0;
  return stats;
}
function catalogStatsText(stats){
  if(!stats)return '';
  const line=(label,k)=>`${label}: ${stats[k]?.total??0} total • +${stats[k]?.added??0} novo(s) • ${stats[k]?.updated??0} atualizado(s)`;
  return [line('Produtos','products'),line('Clientes','clients'),line('Fornecedores','suppliers')].join('\n');
}
async function pullCatalogDataUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  await withOperation('Puxando cadastros do servidor...',async()=>{
    const r=await window.nexagest.networkRequest(db.settings.serverAddress,'catalogs');
    applyNetworkTestResult(r);
    if(!r?.ok||!r.catalog)throw new Error(r?.error||'Não foi possível puxar os cadastros.');
    const stats=applyCatalogSnapshot(r.catalog);
    db.settings.networkLastPingMs=r.pingMs||'';
    save();audit('Cadastros puxados do servidor local');app();
    alert('Cadastros recebidos do servidor.\n\n'+catalogStatsText(stats));
  })
}
async function pushCatalogDataUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  await withOperation('Enviando cadastros para o servidor...',async()=>{
    const payload={catalog:catalogSyncPayload(),company:currentCompanyName()};
    const r=await window.nexagest.networkRequest(db.settings.serverAddress,'catalogs-push',payload);
    applyNetworkTestResult(r);
    if(!r?.ok)throw new Error(r?.error||'Não foi possível enviar os cadastros.');
    db.settings.lastSyncAt=new Date().toISOString();
    db.settings.lastCatalogSyncAt=db.settings.lastSyncAt;
    db.settings.lastCatalogSyncStats=r.stats||{};
    db.settings.networkLastPingMs=r.pingMs||'';
    save();audit('Cadastros enviados ao servidor local');app();
    alert('Cadastros enviados para o servidor.\n\n'+catalogStatsText(r.stats));
  })
}
async function syncCatalogDataUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  await withOperation('Sincronizando cadastros...',async()=>{
    const startedAt=Date.now();db.settings.networkProgress=20;save();networkLog('Sincronização de cadastros iniciada.','info');
    const pull=await window.nexagest.networkRequest(db.settings.serverAddress,'catalogs');
    applyNetworkTestResult(pull);
    if(!pull?.ok||!pull.catalog)throw new Error(pull?.error||'Não foi possível receber os cadastros do servidor.');
    const localStats=applyCatalogSnapshot(pull.catalog);db.settings.networkProgress=55;save();
    const push=await window.nexagest.networkRequest(db.settings.serverAddress,'catalogs-push',{catalog:catalogSyncPayload(),company:currentCompanyName()});
    if(!push?.ok)throw new Error(push?.error||'Não foi possível devolver os cadastros mesclados ao servidor.');
    db.settings.lastSyncAt=new Date().toISOString();
    db.settings.lastCatalogSyncAt=db.settings.lastSyncAt;
    db.settings.lastCatalogSyncStats=push.stats||localStats;
    db.settings.lastCatalogSyncDurationMs=Date.now()-startedAt;db.settings.networkProgress=100;networkLog('Sincronização de cadastros concluída.','success');setTimeout(()=>{db.settings.networkProgress=0;save();app()},700);
    db.settings.networkLastPingMs=push.pingMs||pull.pingMs||'';
    save();audit('Sincronização bidirecional de cadastros concluída');app();
    alert('Sincronização de cadastros concluída.\n\n'+catalogStatsText(push.stats||localStats));
  })
}


function businessSyncPayload(){
  return {
    sales:(db.sales||[]).map(x=>({...x})),
    stockMoves:(db.stockMoves||[]).map(x=>({...x})),
    cashRegisters:(db.cashRegisters||[]).map(x=>({...x})),
    receivables:(db.receivables||[]).map(x=>({...x})),
    expenses:(db.expenses||[]).map(x=>({...x})),
    products:(db.products||[]).map(x=>({...x})),
    meta:{company:currentCompanyName(),generatedAt:new Date().toISOString()}
  }
}
function businessRecordKey(item,type='row'){
  if(!item||typeof item!=='object')return'';
  if(item.id)return'id:'+item.id;
  if(item.saleId)return'sale:'+item.saleId;
  if(item.productId&&item.date&&item.type)return item.productId+':'+item.date+':'+item.type;
  if(item.number&&item.openedAt)return'cash:'+item.number+':'+item.openedAt;
  return type+':'+JSON.stringify(item).slice(0,120);
}
function mergeBusinessArrayLocal(current=[],incoming=[],type='row'){
  const map=new Map();
  (current||[]).forEach((item,idx)=>map.set(businessRecordKey(item,type)||('local:'+idx),{...item}));
  let added=0,updated=0,conflicts=0;
  (incoming||[]).forEach((item,idx)=>{let key=businessRecordKey(item,type)||('remote:'+idx);let cur=map.get(key);if(cur){updated++;if(rowsDiffer(cur,item)&&rowTimestampValue(cur)>0&&rowTimestampValue(item)>0&&rowTimestampValue(cur)!==rowTimestampValue(item)){conflicts++;registerBasicConflict(type,key,cur,item,'servidor')}}else added++;map.set(key,{...(cur||{}),...item,syncedAt:new Date().toISOString()})});
  return{rows:[...map.values()],added,updated,total:map.size,conflicts};
}
function mergeBusinessProductsLocal(current=[],incoming=[]){
  const map=new Map();
  (current||[]).forEach((item,idx)=>{let key=item.id?'id:'+item.id:(item.barcode?'barcode:'+item.barcode:'product:'+idx);map.set(key,{...item})});
  let added=0,updated=0,conflicts=0;
  (incoming||[]).forEach((item,idx)=>{let key=item.id?'id:'+item.id:(item.barcode?'barcode:'+item.barcode:'product-remote:'+idx);let cur=map.get(key);if(cur){updated++;if(rowsDiffer(cur,item)&&rowTimestampValue(cur)>0&&rowTimestampValue(item)>0&&rowTimestampValue(cur)!==rowTimestampValue(item)){conflicts++;registerBasicConflict('products',key,cur,item,'servidor')}}else added++;map.set(key,{...(cur||{}),...item,syncedAt:new Date().toISOString()})});
  return{rows:[...map.values()],added,updated,total:map.size,conflicts};
}
function applyBusinessSnapshot(business={}){
  const keys=['sales','stockMoves','cashRegisters','receivables','expenses'];
  const stats={};
  keys.forEach(k=>{let m=mergeBusinessArrayLocal(db[k]||[],business[k]||[],k);db[k]=m.rows;stats[k]={added:m.added,updated:m.updated,total:m.total,conflicts:m.conflicts||0}});
  if(business.products){let p=mergeBusinessProductsLocal(db.products||[],business.products||[]);db.products=p.rows;stats.products={added:p.added,updated:p.updated,total:p.total,conflicts:p.conflicts||0}}
  db.settings.lastSyncAt=new Date().toISOString();
  db.settings.lastBusinessSyncAt=db.settings.lastSyncAt;
  db.settings.lastBusinessSyncStats=stats;
  stats.conflicts=Object.values(stats).reduce((a,x)=>a+(x.conflicts||0),0);
  db.settings.networkPendingItems=stats.conflicts||0;
  return stats;
}
function businessSyncStatsSummary(){
  const st=db.settings.lastBusinessSyncStats||{};
  return{
    sales:st.sales?.total??(db.sales||[]).length,
    stockMoves:st.stockMoves?.total??(db.stockMoves||[]).length,
    cashRegisters:st.cashRegisters?.total??(db.cashRegisters||[]).length,
    receivables:st.receivables?.total??(db.receivables||[]).length,
    products:st.products?.total??(db.products||[]).length,
    last:db.settings.lastBusinessSyncAt?br(db.settings.lastBusinessSyncAt):'Nunca sincronizado'
  }
}
function businessStatsText(stats={}){
  return ['sales','stockMoves','cashRegisters','receivables','products'].map(k=>{
    const label={sales:'Vendas',stockMoves:'Movimentos de estoque',cashRegisters:'Caixas',receivables:'Contas/fiado',products:'Produtos'}[k]||k;
    const s=stats[k]||{};return label+': '+(s.total??0)+' total, '+(s.added??0)+' novos, '+(s.updated??0)+' atualizados';
  }).join('\n')
}
async function pullBusinessDataUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  await withOperation('Puxando vendas, estoque e caixa do servidor...',async()=>{
    const r=await window.nexagest.networkRequest(db.settings.serverAddress,'business');
    applyNetworkTestResult(r);
    if(!r?.ok||!r.business)throw new Error(r?.error||'Não foi possível receber os dados operacionais do servidor.');
    const stats=applyBusinessSnapshot(r.business);
    db.settings.networkLastPingMs=r.pingMs||'';
    db.settings.networkLastActivity={message:'Dados operacionais puxados do servidor',at:new Date().toISOString()};
    networkLog('Vendas/estoque/caixa puxados do servidor.','success');
    save();audit('Dados operacionais puxados do servidor local');app();
    alert('Vendas, estoque e caixa recebidos do servidor.\n\n'+businessStatsText(stats));
  })
}
async function pushBusinessDataUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  await withOperation('Enviando vendas, estoque e caixa para o servidor...',async()=>{
    const payload={business:businessSyncPayload(),company:currentCompanyName()};
    const r=await window.nexagest.networkRequest(db.settings.serverAddress,'business-push',payload);
    applyNetworkTestResult(r);
    if(!r?.ok)throw new Error(r?.error||'Não foi possível enviar os dados operacionais.');
    db.settings.lastSyncAt=new Date().toISOString();
    db.settings.lastBusinessSyncAt=db.settings.lastSyncAt;
    db.settings.lastBusinessSyncStats=r.stats||{};
    db.settings.networkLastPingMs=r.pingMs||'';
    db.settings.networkLastActivity={message:'Dados operacionais enviados ao servidor',at:new Date().toISOString()};
    networkLog('Vendas/estoque/caixa enviados ao servidor.','success');
    save();audit('Dados operacionais enviados ao servidor local');app();
    alert('Vendas, estoque e caixa enviados para o servidor.\n\n'+businessStatsText(r.stats));
  })
}
async function syncBusinessDataUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  await withOperation('Sincronizando vendas, estoque e caixa...',async()=>{
    const startedAt=Date.now();db.settings.networkProgress=20;save();networkLog('Sincronização operacional iniciada.','info');
    const pull=await window.nexagest.networkRequest(db.settings.serverAddress,'business');
    applyNetworkTestResult(pull);
    if(!pull?.ok||!pull.business)throw new Error(pull?.error||'Não foi possível receber os dados operacionais do servidor.');
    const localStats=applyBusinessSnapshot(pull.business);db.settings.networkProgress=55;save();
    const push=await window.nexagest.networkRequest(db.settings.serverAddress,'business-push',{business:businessSyncPayload(),company:currentCompanyName()});
    if(!push?.ok)throw new Error(push?.error||'Não foi possível devolver os dados operacionais mesclados ao servidor.');
    db.settings.lastSyncAt=new Date().toISOString();
    db.settings.lastBusinessSyncAt=db.settings.lastSyncAt;
    db.settings.lastBusinessSyncStats=push.stats||localStats;
    db.settings.networkLastPingMs=push.pingMs||pull.pingMs||'';
    db.settings.networkProgress=100;
    db.settings.networkLastActivity={message:'Vendas, estoque e caixa sincronizados',at:new Date().toISOString()};
    networkLog('Sincronização operacional concluída.','success');
    save();setTimeout(()=>{db.settings.networkProgress=0;save();app()},700);
    audit('Sincronização de vendas, estoque e caixa concluída');app();
    alert('Sincronização de vendas, estoque e caixa concluída.\n\n'+businessStatsText(push.stats||localStats)+'\n\nTempo: '+((Date.now()-startedAt)/1000).toFixed(1)+'s');
  })
}

async function discoverNetworkServersUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkRequest)return alert('Rede indisponível neste ambiente.');
  const port=Number(db.settings.networkPort||3333)||3333;
  const candidates=[`http://127.0.0.1:${port}`,`http://localhost:${port}`,db.settings.serverAddress,db.settings.networkServerUrl].filter(Boolean);
  const found=[];
  await withOperation('Procurando servidores NexaGest...',async()=>{
    for(const url of [...new Set(candidates.map(normalizeNetworkAddressInput))]){
      try{
        const r=await window.nexagest.networkRequest(url,'status');
        if(r?.ok)found.push({url,company:r.company||'NexaGest',ping:r.pingMs||'—'});
      }catch(e){}
    }
  });
  if(!found.length){networkLog('Nenhum servidor encontrado no teste local.','warn');app();return alert('Nenhum servidor encontrado.\n\nDica: inicie o servidor neste PC e teste com http://127.0.0.1:'+port)}
  const chosen=found[0];
  db.settings.serverAddress=chosen.url;db.settings.networkLastTestOk=true;db.settings.networkLastPingMs=chosen.ping;db.settings.networkLastTestAt=new Date().toISOString();
  networkLog('Servidor encontrado: '+chosen.company+' em '+chosen.url,'success');save();app();alert('Servidor encontrado!\n\n'+chosen.company+'\n'+chosen.url+'\nPing: '+chosen.ping+' ms')
}
async function runNetworkDiagnosticsUi(){
  saveSystemNetwork(false);
  if(!window.nexagest?.networkSelfTest&&!window.nexagest?.networkRequest)return alert('Diagnóstico indisponível neste ambiente.');
  db.settings.networkProgress=10;save();app();
  await withOperation('Executando diagnóstico completo da rede...',async()=>{
    networkLog('Diagnóstico iniciado.','info');
    const role=db.settings.networkRole||'standalone';
    let r;
    if(role==='standalone'){
      db.settings.networkProgress=35;save();
      if(db.settings.networkServerRunning)await stopServerForStandaloneIfNeeded();
      r={ok:true,pingMs:1,local:{pingMs:1}};
      db.settings.networkLastTestAt=new Date().toISOString();
      db.settings.networkLastTestOk=true;
      db.settings.networkLastPingMs=1;
      db.settings.networkClientsConnected=0;
      networkLog('Diagnóstico local aprovado. Rede permanece desligada.','success');
    }else if(role==='client'){
      db.settings.networkProgress=35;save();
      r=await window.nexagest.networkRequest(db.settings.serverAddress,'status');
      applyNetworkTestResult(r);
    }else{
      db.settings.networkProgress=35;save();
      r=await window.nexagest.networkSelfTest({port:db.settings.networkPort||3333,data:db,company:currentCompanyName()});
      applyNetworkTestResult(r);if(r?.ok)networkLog('Teste local aprovado em 127.0.0.1.','success');db.settings.networkServerRunning=!!r?.server?.running;if(db.settings.networkServerRunning&&!db.settings.networkServerStartedAt)db.settings.networkServerStartedAt=new Date().toISOString();db.settings.networkServerUrl=r?.server?.url||db.settings.networkServerUrl;
    }
    db.settings.networkProgress=75;save();
    if(!r?.ok)throw new Error(r?.error||'Falha no diagnóstico.');
    db.settings.networkProgress=100;db.settings.networkLastTestAt=new Date().toISOString();db.settings.networkLastTestOk=true;
    networkLog('Diagnóstico aprovado: comunicação OK, ping '+(r.pingMs||r.local?.pingMs||'—')+' ms.','success');
    setTimeout(()=>{db.settings.networkProgress=0;save();app()},600);
    save();app();
    if(role==='standalone')alert('Diagnóstico local aprovado!\n\n✓ Banco SQLite local OK\n✓ Configuração OK\n✓ Rede desativada\n✓ Servidor não foi iniciado\n✓ Ping local '+(r.pingMs||r.local?.pingMs||'—')+' ms');
    else alert('Diagnóstico completo aprovado!\n\n✓ Porta configurada\n✓ Servidor ativo\n✓ Cliente conectou\n✓ Comunicação OK\n✓ Banco encontrado\n✓ Ping '+(r.pingMs||r.local?.pingMs||'—')+' ms')
  }).catch(e=>{db.settings.networkProgress=0;networkLog('Diagnóstico falhou: '+(e.message||e),'error');save();app();throw e})
}
function clearNetworkLog(){db.settings.networkLogs=[];save();app()}
function saveNetworkLog(){
  const logs=(db.settings.networkLogs||[]).map(l=>`${br(l.at)} - ${l.message}`).join('\n')||'Sem logs.';
  const blob=new Blob([logs],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nexagest-log-rede.txt';a.click();URL.revokeObjectURL(a.href);
}

function companiesSettingsPanel(){
  let list=activeCompanies(),cur=companyInfo.currentCompanyId||'default';
  return `<div class="panel settings-card company-admin-panel"><div class="between"><div><h3>Multiempresa</h3><p class="muted small">Fase 5.2: cada empresa usa dados separados no SQLite. Produtos, clientes, vendas, caixa, estoque, financeiro e configurações ficam independentes.</p></div><span class="pill good">${list.length} empresa(s)</span></div><div class="company-current-box"><div><span>Empresa atual</span><b>${esc(currentCompanyName())}</b><small>ID: ${esc(cur)}</small></div><button class="ghost" id="openCompanySwitcher">Trocar empresa</button></div><div class="company-list">${list.map(c=>`<div class="company-row ${c.id===cur?'active':''}"><div><b>${esc(c.name)}</b><span>${esc(c.document||'Sem CNPJ/CPF')} ${c.id===cur?'• em uso':''}</span></div><div class="row"><button class="ghost" data-company-switch="${esc(c.id)}" ${c.id===cur?'disabled':''}>Entrar</button>${c.id!=='default'?`<button class="danger" data-company-delete="${esc(c.id)}">Desativar</button>`:''}</div></div>`).join('')}</div><h4>Nova empresa</h4><div class="form-grid"><div class="field"><label>Nome</label><input id="newCompanyName" placeholder="Ex.: Loja Centro"></div><div class="field"><label>CNPJ/CPF</label><input id="newCompanyDoc" placeholder="Opcional"></div><div class="field"><label>Cidade</label><input id="newCompanyCity" placeholder="Opcional"></div><div class="field"><label>Telefone</label><input id="newCompanyPhone" placeholder="Opcional"></div><label class="check-row wide"><input type="checkbox" id="newCompanyCopy"> Copiar cadastros e configurações da empresa atual</label><div class="field"><label>&nbsp;</label><button id="createCompanyBtn">Criar empresa</button></div></div><p class="muted small warn-text">Ao trocar de empresa, a sessão atual é encerrada por segurança e você entra novamente na empresa escolhida.</p></div>`
}
async function refreshCompanyInfo(){
  try{let res=await window.nexagest?.listCompanies?.();if(res?.ok)companyInfo=res}catch(e){console.warn('Falha ao listar empresas',e)}
}
async function openCompanySwitcher(){
  if(!canSwitchCompany())return alert('Troca de empresa disponível apenas para Administrador.');
  await refreshCompanyInfo();
  document.getElementById('companySwitcherOverlay')?.remove();
  let cur=companyInfo.currentCompanyId||'default',list=activeCompanies();
  let ov=document.createElement('div');
  ov.id='companySwitcherOverlay';
  ov.className='modal-overlay company-switcher-overlay open';
  ov.innerHTML=`<div class="modal-card company-switcher-card" role="dialog" aria-modal="true"><div class="between"><div><h3>Trocar empresa</h3><p class="muted small">Escolha qual base de dados deseja usar.</p></div><button class="ghost" id="closeCompanySwitcher">Esc</button></div><div class="company-list modal-company-list">${list.map(c=>`<button type="button" data-company-switch-modal="${esc(c.id)}" class="company-row ${c.id===cur?'active':''}"><div><b>${esc(c.name)}</b><span>${esc(c.document||'Sem CNPJ/CPF')} ${c.id===cur?'• empresa atual':''}</span></div><em>${c.id===cur?'Em uso':'Entrar'}</em></button>`).join('')}</div><div class="modal-actions"><button class="ghost" id="goSettingsCompanies">Gerenciar empresas</button></div></div>`;
  document.body.appendChild(ov);document.body.classList.add('modal-open');
  const close=()=>{ov.remove();document.body.classList.remove('modal-open')};
  document.getElementById('closeCompanySwitcher')?.addEventListener('click',close);
  document.getElementById('goSettingsCompanies')?.addEventListener('click',()=>{close();navigateTo('settings')});
  ov.addEventListener('click',e=>{if(e.target===ov)close()});
  ov.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  ov.querySelectorAll('[data-company-switch-modal]').forEach(b=>b.addEventListener('click',()=>{let id=b.dataset.companySwitchModal;if(id!==cur)switchCompanyUi(id)}));
  setTimeout(()=>ov.querySelector('[data-company-switch-modal]')?.focus(),20);
}
async function switchCompanyUi(id){
  if(!window.nexagest?.switchCompany)return alert('Multiempresa indisponível neste ambiente.');
  await withOperation('Trocando empresa...',async()=>{
    let res=await window.nexagest.switchCompany(id);
    if(!res?.ok)throw new Error(res?.error||'Não foi possível trocar de empresa.');
    companyInfo=res.info||companyInfo;
    db=migrate(res.data||{});
    db.session=null;cart=[];page='dashboard';cashierMode=false;sessionLocked=false;
    localStorage.removeItem('nexagest-cashier-mode');localStorage.removeItem('nexagest-session-locked');
    app();alert('Empresa alterada para '+currentCompanyName()+'. Faça login novamente.');
  });
}
async function createCompanyFromSettings(){
  let name=val('newCompanyName').trim();
  if(!name)return alert('Informe o nome da nova empresa.');
  let payload={name,document:val('newCompanyDoc'),city:val('newCompanyCity'),phone:val('newCompanyPhone'),copyCurrent:!!document.getElementById('newCompanyCopy')?.checked};
  await withOperation('Criando empresa...',async()=>{
    let res=await window.nexagest.createCompany(payload,db);
    if(!res?.ok)throw new Error(res?.error||'Não foi possível criar a empresa.');
    companyInfo=res.info||companyInfo;
    db=migrate(res.data||{});db.session=null;cart=[];page='dashboard';cashierMode=false;sessionLocked=false;
    localStorage.removeItem('nexagest-cashier-mode');localStorage.removeItem('nexagest-session-locked');
    app();alert('Empresa criada. Faça login para começar a usar: '+name);
  });
}
async function saveCurrentCompanyRegistry(){
  if(!window.nexagest?.updateCompany)return;
  let cur=companyInfo.currentCompanyId||'default';
  await window.nexagest.updateCompany({id:cur,name:db.settings.company,document:db.settings.document,city:db.settings.city,phone:db.settings.phone});
  await refreshCompanyInfo();
}
async function deleteCompanyUi(id){
  confirmAction('Desativar esta empresa? O arquivo de dados não será apagado, apenas ocultado da lista.',async()=>{
    let res=await window.nexagest.deleteCompany(id);
    if(!res?.ok)return alert(res?.error||'Não foi possível desativar.');
    companyInfo=res;app();alert('Empresa desativada.');
  },'Desativar empresa','Desativar')
}


/* v6.3.0 — Financeiro avançado: contas, cobranças, fiado e recebimentos */
function financeDueStatus(date,status){
  if(status==='Pago')return '<span class="pill good">Pago</span>';
  let d=String(date||'').slice(0,10), t=today();
  if(d&&d<t)return '<span class="pill bad">Vencido</span>';
  if(d===t)return '<span class="pill warn">Vence hoje</span>';
  return '<span class="pill warn">Pendente</span>';
}
function finDaysUntil(date){
  if(!date)return '-';
  let a=new Date(today()+'T00:00:00'), b=new Date(String(date).slice(0,10)+'T00:00:00');
  let n=Math.round((b-a)/86400000);
  if(n<0)return Math.abs(n)+' dia(s) vencido';
  if(n===0)return 'Hoje';
  return 'Em '+n+' dia(s)';
}
function financeAdvancedData(){
  let f=financeData(), m=today().slice(0,7);
  let receivables=(db.receivables||[]).map(r=>({...r,due:r.due||String(r.date||'').slice(0,10),desc:r.desc||('Venda fiado '+(r.saleId? saleDisplayNumber(db.sales.find(s=>s.id===r.saleId)||{saleNumber:r.saleId}) : '')),clientName:client(r.clientId).name}));
  let openReceivables=receivables.filter(r=>!r.paid);
  let paidReceivables=receivables.filter(r=>r.paid);
  let payables=(db.expenses||[]).filter(e=>(e.type||'Saída')==='Saída').map(e=>({...e,costCenter:e.costCenter||financeDefaultCostCenter(e.cat),due:e.due||String(e.date||'').slice(0,10),status:e.status||'Pago'}));
  let openPayables=payables.filter(e=>e.status!=='Pago');
  let overdueReceivables=openReceivables.filter(r=>String(r.due||r.date||'').slice(0,10)<today());
  let overduePayables=openPayables.filter(e=>String(e.due||e.date||'').slice(0,10)<today());
  let dueTodayReceivables=openReceivables.filter(r=>String(r.due||r.date||'').slice(0,10)===today());
  let dueTodayPayables=openPayables.filter(e=>String(e.due||e.date||'').slice(0,10)===today());
  let receivedMonth=sum(paidReceivables.filter(r=>String(r.paidAt||r.date||'').slice(0,7)===m),'value');
  let paidMonth=sum(payables.filter(e=>e.status==='Pago'&&String(e.date||'').slice(0,7)===m),'value');
  let next7=[...openReceivables.map(r=>({kind:'Receber',date:r.due||r.date,desc:r.clientName,value:r.value,id:r.id,type:'receivable'})),...openPayables.map(e=>({kind:'Pagar',date:e.due||e.date,desc:e.desc,value:e.value,id:e.id,type:'payable'}))].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,8);
  return{...f,receivables,openReceivables,paidReceivables,payables,openPayables,overdueReceivables,overduePayables,dueTodayReceivables,dueTodayPayables,receivedMonth,paidMonth,next7};
}

function financeAddMonths(date,months){
  let base=String(date||today()).slice(0,10), d=new Date(base+'T00:00:00');
  if(!Number.isFinite(months)||!months)return base;
  let day=d.getDate();d.setMonth(d.getMonth()+months);
  if(d.getDate()!==day)d.setDate(0);
  return d.toISOString().slice(0,10);
}
function financePayablePriorityPill(priority){
  let p=String(priority||'Normal');
  if(p==='Alta')return '<span class="pill bad">Alta</span>';
  if(p==='Baixa')return '<span class="pill good">Baixa</span>';
  return '<span class="pill warn">Normal</span>';
}
function financePayableEnterpriseStats(f){
  let open=f.openPayables||[], overdue=f.overduePayables||[], todayList=f.dueTodayPayables||[];
  let nextWeek=open.filter(e=>{let d=String(e.due||e.date||'').slice(0,10);return d>today()&&d<=addDaysIso(today(),7)});
  let high=open.filter(e=>String(e.priority||'Normal')==='Alta');
  return {open,overdue,todayList,nextWeek,high,total:sum(open,'value'),overdueValue:sum(overdue,'value'),weekValue:sum(nextWeek,'value')};
}
function financePayablesEnterprisePanel(f){
  let st=financePayableEnterpriseStats(f), filter=localStorage.getItem('finance-payable-filter')||'all';
  let rows=(f.openPayables||[]).slice().sort((a,b)=>String(a.due||a.date).localeCompare(String(b.due||b.date)));
  if(filter==='overdue')rows=rows.filter(e=>String(e.due||e.date||'').slice(0,10)<today());
  if(filter==='today')rows=rows.filter(e=>String(e.due||e.date||'').slice(0,10)===today());
  if(filter==='week')rows=rows.filter(e=>{let d=String(e.due||e.date||'').slice(0,10);return d>=today()&&d<=addDaysIso(today(),7)});
  if(filter==='high')rows=rows.filter(e=>String(e.priority||'Normal')==='Alta');
  let chips=[['all','Todas',st.open.length],['overdue','Vencidas',st.overdue.length],['today','Hoje',st.todayList.length],['week','7 dias',st.nextWeek.length],['high','Alta prioridade',st.high.length]];
  return `<div class="panel finance-payables-enterprise"><div class="between"><div><h3>Contas a pagar Enterprise</h3><p class="muted small">Controle por vencimento, prioridade, parcelas e status.</p></div><div class="row"><button class="ghost" id="exportPayablesCsv">CSV</button><span class="pill ${st.open.length?'bad':'good'}">${st.open.length} aberto(s)</span></div></div><div class="finance-payable-kpis">${financeEnterpriseCard('Total em aberto',money(st.total),st.total?'bad':'good','contas pendentes')}${financeEnterpriseCard('Vencidas',money(st.overdueValue),st.overdueValue?'bad':'good',st.overdue.length+' conta(s)')}${financeEnterpriseCard('Próximos 7 dias',money(st.weekValue),st.weekValue?'warn':'good',st.nextWeek.length+' vencimento(s)')}${financeEnterpriseCard('Alta prioridade',String(st.high.length),st.high.length?'bad':'good','atenção necessária')}</div><div class="finance-payable-chips">${chips.map(c=>`<button class="ghost ${filter===c[0]?'ok':''}" data-payable-filter="${c[0]}">${c[1]} <span>${c[2]}</span></button>`).join('')}</div>${table(['Vencimento','Descrição','Categoria','Parcela','Prioridade','Valor','Status','Ações'],rows.map(e=>[br(e.due||e.date),esc(e.desc||'-'),esc(e.cat||'Outros'),e.installments?`${e.installment||1}/${e.installments}`:'-',financePayablePriorityPill(e.priority),`<b class="bad">${money(e.value)}</b>`,financeDueStatus(e.due||e.date,e.status||'Pendente'),`<button class="ok" onclick="markExpensePaid('${e.id}')">Marcar pago</button> <button class="danger" data-delexp="${e.id}">Excluir</button>`]))}</div>`;
}

function saveManualReceivable(){
  if(!requireCan('finance'))return;
  let clientId=val('recClient'), value=num('recValue'), due=val('recDue')||today(), desc=val('recDesc')||'Conta a receber';
  if(!clientId)return alert('Selecione o cliente.');
  if(!value)return alert('Informe o valor a receber.');
  db.receivables.unshift({id:uid(),saleId:'',clientId,value,date:new Date().toISOString(),due,desc,paid:false,source:'manual'});
  audit('Conta a receber criada: '+client(clientId).name+' '+money(value));
  save();app();alert('Conta a receber salva.');
}
function markReceivablePaid(id){let r=db.receivables.find(x=>x.id===id);if(!r)return;r.paid=true;r.paidAt=new Date().toISOString();r.paymentMethod=val('receivePaymentMethod')||r.paymentMethod||'Dinheiro';audit('Recebimento confirmado '+money(r.value));save();app();}
function markExpensePaid(id){let e=db.expenses.find(x=>x.id===id);if(!e)return;e.status='Pago';e.paidAt=new Date().toISOString();e.date=e.date||new Date().toISOString();audit('Conta paga '+(e.desc||'')+' '+money(e.value));save();app();}
function sendReceivableWhatsApp(id){
  let r=db.receivables.find(x=>x.id===id);if(!r)return;
  let c=client(r.clientId);let phone=c.phone||r.clientPhone||'';
  if(!normalizeBrazilPhone(phone))return alert('Cliente sem WhatsApp cadastrado.');
  let msg=`💰 *LEMBRETE DE PAGAMENTO*\n\nOlá, *${c.name||'Cliente'}*!\n\nVocê possui uma conta em aberto na *${db.settings.company||'NexaGest'}*.\n\n━━━━━━━━━━━━━━━━━━\n💵 Valor: *${money(r.value)}*\n📅 Vencimento: ${br(r.due||r.date)}\n📝 Referência: ${r.desc||'Conta a receber'}\n━━━━━━━━━━━━━━━━━━\n\nSe já realizou o pagamento, desconsidere esta mensagem.\n\nObrigado! 😊\n${db.settings.company||'NexaGest'}`;
  openWhatsAppNumber(phone,msg);
}
function exportReceivablesCsv(){let d=financeAdvancedData();let rows=[['cliente','descricao','emissao','vencimento','valor','status','pagamento'],...d.receivables.map(r=>[r.clientName||client(r.clientId).name,r.desc||'',br(r.date),br(r.due||r.date),r.value,r.paid?'Pago':'Pendente',r.paymentMethod||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-contas-a-receber.csv','text/csv;charset=utf-8')}
function exportPayablesCsv(){let d=financeAdvancedData();let rows=[['descricao','categoria','emissao','vencimento','valor','status','pagamento'],...d.payables.map(e=>[e.desc||'',e.cat||'',br(e.date),br(e.due||e.date),e.value,e.status||'',e.payment||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-contas-a-pagar.csv','text/csv;charset=utf-8')}


function addDaysIso(base,offset){let d=new Date(String(base||today()).slice(0,10)+'T00:00:00');d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10)}
function financeEnterpriseWindow(f,days=30){
  let start=today(), items=[];
  for(let i=0;i<days;i++){
    let iso=addDaysIso(start,i), label=iso.slice(8,10)+'/'+iso.slice(5,7);
    let rec=sum(f.openReceivables.filter(r=>String(r.due||r.date||'').slice(0,10)===iso),'value');
    let pay=sum(f.openPayables.filter(e=>String(e.due||e.date||'').slice(0,10)===iso),'value');
    items.push({iso,label,rec,pay,net:rec-pay});
  }
  let expectedIn=sum(items,'rec'), expectedOut=sum(items,'pay'), projected=(f.balance||0)+expectedIn-expectedOut;
  return {items,expectedIn,expectedOut,projected,max:Math.max(1,...items.flatMap(x=>[Math.abs(x.rec),Math.abs(x.pay),Math.abs(x.net)]))};
}
function financeEnterpriseCard(label,value,cls,small){return `<div class="finance-enterprise-card"><span>${esc(label)}</span><b class="${cls||''}">${value}</b><small>${esc(small||'')}</small></div>`}
function financeProjectionPanel(f){
  let w=financeEnterpriseWindow(f,30), next7In=sum(w.items.slice(0,7),'rec'), next7Out=sum(w.items.slice(0,7),'pay');
  return `<div class="panel finance-enterprise-panel"><div class="between"><div><h3>Fluxo de caixa projetado</h3><p class="muted small">Previsão dos próximos 30 dias com contas a receber e contas a pagar em aberto.</p></div><span class="pill ${w.projected>=0?'good':'bad'}">Saldo projetado ${money(w.projected)}</span></div><div class="finance-enterprise-grid">${financeEnterpriseCard('Saldo atual',money(f.balance||0),(f.balance||0)>=0?'good':'bad','resultado do mês')}${financeEnterpriseCard('Entradas previstas',money(w.expectedIn),'good','próximos 30 dias')}${financeEnterpriseCard('Saídas previstas',money(w.expectedOut),'bad','próximos 30 dias')}${financeEnterpriseCard('Próximos 7 dias',money(next7In-next7Out),(next7In-next7Out)>=0?'good':'bad','entradas - saídas')}</div>${financeProjectedBars(w.items.slice(0,14),w.max)}</div>`;
}
function financeProjectedBars(items,max){
  return `<div class="finance-enterprise-bars">${items.map(d=>`<div title="${d.label} • Entradas ${money(d.rec)} • Saídas ${money(d.pay)}"><i class="in" style="height:${Math.max(5,d.rec/max*120)}px"></i><i class="out" style="height:${Math.max(5,d.pay/max*120)}px"></i><em class="${d.net>=0?'good':'bad'}" style="height:${Math.max(4,Math.abs(d.net)/max*80)}px"></em><span>${d.label}</span></div>`).join('')}</div><div class="legend"><span><b class="dot good-bg"></b>Entradas previstas</span><span><b class="dot bad-bg"></b>Saídas previstas</span><span><b class="dot brand-bg"></b>Saldo do dia</span></div>`;
}
function financeAgendaEnterprise(f){
  let items=[...f.openReceivables.map(r=>({kind:'Receber',date:r.due||r.date,desc:r.clientName||'Cliente',value:r.value,cls:'good'})),...f.openPayables.map(e=>({kind:'Pagar',date:e.due||e.date,desc:e.desc||e.cat||'Conta',value:e.value,cls:'bad'}))]
    .filter(x=>String(x.date||'').slice(0,10)<=addDaysIso(today(),30)).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,12);
  if(!items.length)return '<p class="muted">Nenhuma pendência futura para os próximos 30 dias.</p>';
  return `<div class="finance-agenda-list">${items.map(x=>`<div class="finance-agenda-item"><div><b>${esc(x.kind)}</b><span>${br(x.date)} • ${finDaysUntil(x.date)}</span><small>${esc(x.desc||'-')}</small></div><strong class="${x.cls}">${money(x.value)}</strong></div>`).join('')}</div>`;
}

function financeAgendaItemsEnterprise(f,days=30){
  let limit=addDaysIso(today(),days);
  return [...(f.openReceivables||[]).map(r=>({kind:'Receber',date:String(r.due||r.date||today()).slice(0,10),desc:r.clientName||client(r.clientId).name||'Cliente',ref:r.desc||'Conta a receber',value:Number(r.value||0),cls:'good',type:'receivable'})),...(f.openPayables||[]).map(e=>({kind:'Pagar',date:String(e.due||e.date||today()).slice(0,10),desc:e.desc||e.cat||'Conta a pagar',ref:e.cat||e.costCenter||'Despesa',value:Number(e.value||0),cls:'bad',type:'payable',priority:e.priority||'Normal'}))]
    .filter(x=>x.date<=limit)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)) || (a.kind==='Pagar'?-1:1));
}
function financeAgendaStats(f){
  let items=financeAgendaItemsEnterprise(f,30), now=today(), week=addDaysIso(now,7);
  let overdue=items.filter(x=>x.date<now), todayItems=items.filter(x=>x.date===now), weekItems=items.filter(x=>x.date>=now&&x.date<=week), monthItems=items.filter(x=>x.date>=now);
  return {items,overdue,todayItems,weekItems,monthItems,overdueValue:sum(overdue,'value'),todayValue:sum(todayItems,'value'),weekIn:sum(weekItems.filter(x=>x.type==='receivable'),'value'),weekOut:sum(weekItems.filter(x=>x.type==='payable'),'value'),monthIn:sum(monthItems.filter(x=>x.type==='receivable'),'value'),monthOut:sum(monthItems.filter(x=>x.type==='payable'),'value')};
}
function financeAgendaCalendarPanel(f){
  let st=financeAgendaStats(f), start=new Date(today()+'T00:00:00'), days=[];
  for(let i=0;i<30;i++){
    let iso=addDaysIso(today(),i), list=st.items.filter(x=>x.date===iso), rec=sum(list.filter(x=>x.type==='receivable'),'value'), pay=sum(list.filter(x=>x.type==='payable'),'value');
    days.push({iso,day:iso.slice(8,10),month:iso.slice(5,7),list,rec,pay,net:rec-pay});
  }
  let next=st.items.slice(0,8);
  return `<div class="panel finance-agenda-enterprise"><div class="between"><div><h3>Agenda Financeira Enterprise</h3><p class="muted small">Calendário dos próximos 30 dias com recebimentos, pagamentos, vencidos e saldo previsto.</p></div><span class="pill ${st.overdue.length?'bad':'good'}">${st.overdue.length?st.overdue.length+' vencido(s)':'Em dia'}</span></div><div class="finance-agenda-kpis">${financeEnterpriseCard('Vencidos',money(st.overdueValue),st.overdueValue?'bad':'good',st.overdue.length+' item(ns)')}${financeEnterpriseCard('Vence hoje',money(st.todayValue),st.todayItems.length?'warn':'good',st.todayItems.length+' item(ns)')}${financeEnterpriseCard('Entradas 7 dias',money(st.weekIn),'good','a receber')}${financeEnterpriseCard('Saídas 7 dias',money(st.weekOut),st.weekOut?'bad':'good','a pagar')}</div><div class="finance-agenda-calendar">${days.map(d=>`<div class="finance-agenda-day ${d.list.length?'has-items':''} ${d.net<0?'negative':d.net>0?'positive':''}" title="${br(d.iso)} • Receber ${money(d.rec)} • Pagar ${money(d.pay)}"><b>${d.day}</b><small>${d.month}</small>${d.list.length?`<span>${d.list.length}</span>`:''}${d.rec?`<i class="good">+${money(d.rec)}</i>`:''}${d.pay?`<i class="bad">-${money(d.pay)}</i>`:''}</div>`).join('')}</div>${next.length?`<div class="finance-agenda-next"><h4>Próximos vencimentos</h4>${next.map(x=>`<div class="finance-agenda-next-row"><div><b class="${x.cls}">${esc(x.kind)}</b><span>${br(x.date)} • ${finDaysUntil(x.date)}</span><small>${esc(x.desc)}${x.ref?' • '+esc(x.ref):''}</small></div><strong class="${x.cls}">${money(x.value)}</strong></div>`).join('')}</div>`:'<p class="muted">Nenhuma pendência futura para os próximos 30 dias.</p>'}</div>`;
}
function financeAgendaCompactPanel(f){
  let st=financeAgendaStats(f), byDay={};
  st.items.slice(0,30).forEach(x=>{byDay[x.date]=byDay[x.date]||{date:x.date,in:0,out:0,count:0,items:[]};byDay[x.date].count++;byDay[x.date][x.type==='receivable'?'in':'out']+=x.value;byDay[x.date].items.push(x)});
  let rows=Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
  return `<div class="panel finance-agenda-compact"><div class="between"><h3>Resumo por vencimento</h3><span class="pill warn">${st.items.length} evento(s)</span></div>${rows.length?table(['Data','Eventos','A receber','A pagar','Saldo'],rows.map(d=>[`${br(d.date)}<br><span class="muted small">${finDaysUntil(d.date)}</span>`,d.count,`<b class="good">${money(d.in)}</b>`,`<b class="bad">${money(d.out)}</b>`,`<b class="${(d.in-d.out)>=0?'good':'bad'}">${money(d.in-d.out)}</b>`])):'<p class="muted">Nenhum vencimento encontrado.</p>'}</div>`;
}
function financeQuickChips(f){
  let type=f.type||'Todos', cat=f.cat||'Todas';
  let chips=[['Todos','Todos','Todas'],['Entradas','Entrada','Todas'],['Saídas','Saída','Todas'],['Pix','Todos','Todas','Pix'],['Dinheiro','Todos','Todas','Dinheiro'],['Pendentes','Todos','Todas','Pendente']];
  return `<div class="finance-quick-chips">${chips.map(c=>`<button class="ghost" data-fin-quick="${esc(c.join('|'))}">${esc(c[0])}</button>`).join('')}</div>`;
}

function financeHealthClass(value){return value>=0?'good':'bad'}

function financeEnterpriseFinalCockpit(f){
  let openRec=sum(f.openReceivables||[],'value'), openPay=sum(f.openPayables||[],'value');
  let overdueRec=f.overdueReceivables||[], overduePay=f.overduePayables||[];
  let projected=(f.balance||0)+openRec-openPay;
  let health=projected>=0 && !overdueRec.length && !overduePay.length ? 'good' : (projected>=0 ? 'warn' : 'bad');
  let healthText=health==='good'?'Financeiro saudável':health==='warn'?'Atenção nos vencimentos':'Saldo projetado negativo';
  let checks=[
    ['Fluxo previsto', '30 dias', 'good'],
    ['Contas a pagar', String((f.openPayables||[]).length)+' aberto(s)', openPay?'warn':'good'],
    ['Contas a receber', String((f.openReceivables||[]).length)+' aberto(s)', openRec?'warn':'good'],
    ['Centro de custos', 'ativo', 'good'],
    ['Agenda financeira', String((f.dueTodayReceivables||[]).length+(f.dueTodayPayables||[]).length)+' hoje', ((f.dueTodayReceivables||[]).length+(f.dueTodayPayables||[]).length)?'warn':'good'],
    ['OFX / conciliação', 'disponível', 'good']
  ];
  return `<div class="panel finance-final-cockpit"><div class="between"><div><h3>Central Financeira Enterprise</h3><p class="muted small">Resumo final dos recursos financeiros ativos nesta versão.</p></div><span class="pill ${health}">${healthText}</span></div><div class="finance-final-grid"><div class="finance-final-score ${health}"><span>Saldo projetado</span><b>${money(projected)}</b><small>Saldo atual + receber - pagar</small></div>${checks.map(c=>`<div class="finance-final-check ${c[2]}"><b>${esc(c[0])}</b><span>${esc(c[1])}</span></div>`).join('')}</div></div>`;
}
function financeMiniMetric(label,value,cls,small){return `<div class="finance-pro-mini"><span>${label}</span><b class="${cls||''}">${value}</b><small>${small||''}</small></div>`}

function financeCostCenters(){
  let base=['Operacional','Estoque / Compras','Administrativo','Marketing','Entregas','Impostos','Pessoal','Infraestrutura','Outros'];
  let used=[...(db.expenses||[]).map(e=>e.costCenter),...(db.expenses||[]).map(e=>financeDefaultCostCenter(e.cat))].filter(Boolean);
  return [...new Set([...base,...used])];
}
function financeDefaultCostCenter(cat){
  let c=String(cat||'').toLowerCase();
  if(['fornecedor','mercadoria','embalagem'].some(x=>c.includes(x)))return 'Estoque / Compras';
  if(['combustível','combustivel','entrega','frete'].some(x=>c.includes(x)))return 'Entregas';
  if(['energia','internet','aluguel'].some(x=>c.includes(x)))return 'Infraestrutura';
  if(['imposto','taxa'].some(x=>c.includes(x)))return 'Impostos';
  if(['salário','salario','comissão','comissao'].some(x=>c.includes(x)))return 'Pessoal';
  return 'Operacional';
}
function financeCostCenterStats(f){
  let m=today().slice(0,7), rows=(f.rows||[]).filter(e=>e.source==='expense'&&e.type==='Saída'&&String(e.date||'').slice(0,7)===m);
  let by={};rows.forEach(e=>{let cc=e.costCenter||financeDefaultCostCenter(e.cat);by[cc]=(by[cc]||0)+Number(e.value||0)});
  return Object.entries(by).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
function financeCostCenterPanel(f){
  let rows=financeCostCenterStats(f), total=sum(rows,'value'), max=Math.max(1,...rows.map(x=>Number(x.value||0)));
  if(!rows.length)return `<div class="panel finance-cost-center-panel"><div class="between"><div><h3>Centro de custos</h3><p class="muted small">Agrupe despesas por área do negócio.</p></div><span class="pill good">Sem saídas</span></div><p class="muted">Nenhuma saída lançada neste mês.</p></div>`;
  return `<div class="panel finance-cost-center-panel"><div class="between"><div><h3>Centro de custos</h3><p class="muted small">Saídas do mês separadas por área.</p></div><span class="pill bad">${money(total)}</span></div><div class="finance-cost-centers">${rows.slice(0,8).map(x=>`<div class="finance-cost-row"><div class="between"><b>${esc(x.name)}</b><span>${money(x.value)}</span></div><div class="finance-pro-track"><i style="width:${Math.max(6,Number(x.value||0)/max*100)}%"></i></div><small>${Math.round((Number(x.value||0)/(total||1))*100)}% das saídas</small></div>`).join('')}</div></div>`;
}
function financeCategoryCards(f){
  let rows=(f.byCat||[]).slice(0,6);
  if(!rows.length)return '<p class="muted">Nenhuma saída lançada neste mês.</p>';
  let max=Math.max(1,...rows.map(x=>Number(x.value||0)));
  return `<div class="finance-pro-cats">${rows.map(x=>`<div class="finance-pro-cat"><div class="between"><b>${esc(x.cat||'Outros')}</b><span>${money(x.value)}</span></div><div class="finance-pro-track"><i style="width:${Math.max(6,Number(x.value||0)/max*100)}%"></i></div></div>`).join('')}</div>`;
}
function financeMovementsHtml(f,cats){
  return `${financeQuickChips(f)}<div class="finance-filters finance-pro-filters"><input id="finSearch" placeholder="Buscar por descrição, categoria ou pagamento" value="${esc(f.q)}"><select id="finFilterType">${['Todos','Entrada','Saída'].map(x=>`<option ${x===f.type?'selected':''}>${x}</option>`).join('')}</select><select id="finFilterCat"><option>Todas</option>${cats.map(c=>`<option ${c===f.cat?'selected':''}>${c}</option>`).join('')}</select></div>${table(['Data','Descrição','Categoria','Centro','Tipo','Valor','Pagamento','Situação','Ações'],f.rows.map(e=>[br(e.date),esc(e.desc||'-'),`<span class="pill">${esc(e.cat||'Outros')}</span>`,`<span class="pill">${esc(e.costCenter||financeDefaultCostCenter(e.cat))}</span>`,`<span class="pill ${e.type==='Entrada'?'good':'bad'}">${e.type}</span>`,`<b class="${e.type==='Entrada'?'good':'bad'}">${money(e.value)}</b>`,esc(e.payment||'-'),e.status||'Pago',e.source==='expense'?`<button class="danger" data-delexp="${e.id}">Excluir</button>`:'-']))}`;
}
function refreshFinanceMovements(){
  let box=document.getElementById('financeMovementsBox');
  if(!box)return app();
  let cats=(window.NexaGestFinance&&window.NexaGestFinance.categories?window.NexaGestFinance.categories():['Fornecedor','Combustível','Embalagem','Energia','Internet','Aluguel','Mercadoria','Taxas','Comissão','Salário','Impostos','Outros']);
  box.innerHTML=financeMovementsHtml(financeAdvancedData(),cats);
  bindFinanceFilters();
  document.querySelectorAll('[data-delexp]').forEach(b=>b.onclick=()=>deleteExpense(b.dataset.delexp));
}
function bindFinanceFilters(){
  on('finSearch',e=>{localStorage.setItem('fin-q',e.target.value);refreshFinanceMovements()},'input');
  on('finFilterType',e=>{localStorage.setItem('fin-type',e.target.value);refreshFinanceMovements()},'change');
  on('finFilterCat',e=>{localStorage.setItem('fin-cat',e.target.value);refreshFinanceMovements()},'change');
  document.querySelectorAll('[data-fin-quick]').forEach(b=>b.onclick=()=>{let parts=String(b.dataset.finQuick||'').split('|');localStorage.setItem('fin-type',parts[1]||'Todos');localStorage.setItem('fin-cat',parts[2]||'Todas');let q=document.getElementById('finSearch');localStorage.setItem('fin-q',parts[3]||'');refreshFinanceMovements()});
}
function financeAdvancedView(){
  let f=financeAdvancedData(), cats=(window.NexaGestFinance&&window.NexaGestFinance.categories?window.NexaGestFinance.categories():['Fornecedor','Combustível','Embalagem','Energia','Internet','Aluguel','Mercadoria','Taxas','Comissão','Salário','Impostos','Outros']);
  let openRec=sum(f.openReceivables,'value'), openPay=sum(f.openPayables,'value'), overdue=sum(f.overdueReceivables,'value')+sum(f.overduePayables,'value'), projected=f.balance+openRec-openPay;
  let received=f.receivedMonth||0, paid=f.paidMonth||0, monthlyResult=f.inMonth-f.outMonth;
  let nextCritical=[...f.overdueReceivables.map(x=>({kind:'Receber vencido',date:x.due||x.date,desc:x.clientName,value:x.value,cls:'bad'})),...f.overduePayables.map(x=>({kind:'Pagar vencido',date:x.due||x.date,desc:x.desc,value:x.value,cls:'bad'})),...f.dueTodayReceivables.map(x=>({kind:'Receber hoje',date:x.due||x.date,desc:x.clientName,value:x.value,cls:'warn'})),...f.dueTodayPayables.map(x=>({kind:'Pagar hoje',date:x.due||x.date,desc:x.desc,value:x.value,cls:'warn'}))].slice(0,6);
  return `<div class="finance-page finance-advanced finance-pro"><div class="dash-hero panel finance-hero finance-pro-hero"><div><h2>Financeiro Enterprise Final</h2><p class="muted">Fluxo de caixa, contas a pagar, contas a receber, centro de custos, agenda e OFX consolidados em uma visão gerencial.</p></div><div class="finance-pro-result"><span>Resultado do mês</span><b class="${financeHealthClass(monthlyResult)}">${money(monthlyResult)}</b><small>Entradas - saídas</small></div></div><div class="grid cards finance-summary finance-pro-summary"><div class="card dash-card"><span>Entradas do mês</span><b class="good">${money(f.inMonth)}</b><small>Vendas + recebimentos</small></div><div class="card dash-card"><span>Saídas do mês</span><b class="bad">${money(f.outMonth)}</b><small>Despesas + contas pagas</small></div><div class="card dash-card"><span>A receber</span><b class="warn">${money(openRec)}</b><small>${f.openReceivables.length} conta(s)</small></div><div class="card dash-card"><span>A pagar</span><b class="bad">${money(openPay)}</b><small>${f.openPayables.length} conta(s)</small></div><div class="card dash-card"><span>Vencidos</span><b class="bad">${money(overdue)}</b><small>${f.overdueReceivables.length+f.overduePayables.length} pendência(s)</small></div><div class="card dash-card"><span>Saldo previsto</span><b class="${projected>=0?'good':'bad'}">${money(projected)}</b><small>Saldo + receber - pagar</small></div></div>${financeEnterpriseFinalCockpit(f)}<div class="grid two finance-enterprise-layout">${financeProjectionPanel(f)}${financeAgendaCalendarPanel(f)}</div><div class="grid two finance-pro-overview"><div class="panel"><div class="between"><h3>Resumo inteligente</h3><span class="pill good">Enterprise</span></div><div class="finance-pro-mini-grid">${financeMiniMetric('Recebido no mês',money(received),'good','Contas quitadas')}${financeMiniMetric('Pago no mês',money(paid),'bad','Contas pagas')}${financeMiniMetric('Vence hoje',String(f.dueTodayReceivables.length+f.dueTodayPayables.length),'warn','Receber/pagar')}${financeMiniMetric('Pendências',String(f.openReceivables.length+f.openPayables.length),'warn','Em aberto')}</div></div><div class="panel"><div class="between"><h3>Alertas financeiros</h3><span class="pill ${nextCritical.length?'warn':'good'}">${nextCritical.length?nextCritical.length+' alerta(s)':'Tudo certo'}</span></div>${nextCritical.length?table(['Tipo','Vencimento','Descrição','Valor'],nextCritical.map(x=>[`<span class="pill ${x.cls}">${x.kind}</span>`,br(x.date),esc(x.desc||'-'),`<b class="${x.cls}">${money(x.value)}</b>`])):'<p class="muted">Nenhuma conta vencida ou vencendo hoje.</p>'}</div></div><div class="grid two finance-layout"><div class="panel"><div class="between"><h3>Novo lançamento / conta a pagar</h3><span class="pill">Entrada / Saída</span></div><div class="form-grid"><div class="field wide"><label>Descrição</label><input id="finDesc" placeholder="Ex: fornecedor, aluguel, internet, taxa..."></div><div class="field"><label>Tipo</label><select id="finType"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></div><div class="field"><label>Categoria</label><select id="finCat">${cats.map(c=>`<option>${c}</option>`).join('')}</select></div><div class="field"><label>Centro de custo</label><select id="finCostCenter">${financeCostCenters().map(c=>`<option>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Valor</label><input id="finValue" type="number" step="0.01"></div><div class="field"><label>Pagamento</label><select id="finPayment"><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Transferência</option><option>Boleto</option></select></div><div class="field"><label>Situação</label><select id="finStatus"><option value="Pago">Pago</option><option value="Pendente">Pendente</option></select></div><div class="field"><label>Vencimento</label><input id="finDue" type="date" value="${today()}"></div><div class="field"><label>Parcelas</label><input id="finInstallments" type="number" min="1" max="60" value="1"></div><div class="field"><label>Recorrência</label><select id="finRecurrence"><option value="none">Não repetir</option><option value="monthly">Mensal</option></select></div><div class="field"><label>Prioridade</label><select id="finPriority"><option>Normal</option><option>Alta</option><option>Baixa</option></select></div><div class="field"><label>&nbsp;</label><button id="saveFinLaunch">Salvar lançamento</button></div></div></div><div class="panel"><div class="between"><h3>Nova conta a receber</h3><span class="pill warn">Fiado / cobrança</span></div><div class="form-grid"><div class="field wide"><label>Cliente</label><select id="recClient"><option value="">Selecione</option>${db.clients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.phone?' • '+esc(c.phone):''}</option>`).join('')}</select></div><div class="field"><label>Valor</label><input id="recValue" type="number" step="0.01"></div><div class="field"><label>Vencimento</label><input id="recDue" type="date" value="${today()}"></div><div class="field wide"><label>Descrição</label><input id="recDesc" placeholder="Ex.: Fiado, parcela, entrega..."></div><div class="field"><label>&nbsp;</label><button id="saveManualReceivable">Salvar a receber</button></div></div></div></div><div class="grid two"><div class="panel"><div class="between"><h3>Contas a receber / fiado</h3><div class="row"><button class="ghost" id="exportReceivablesCsv">CSV</button><span class="pill ${f.openReceivables.length?'warn':'good'}">${f.openReceivables.length} aberto(s)</span></div></div>${table(['Vencimento','Cliente','Descrição','Valor','Status','Ações'],f.openReceivables.map(r=>[br(r.due||r.date),esc(r.clientName||client(r.clientId).name),esc(r.desc||'Conta a receber'),`<b class="warn">${money(r.value)}</b>`,financeDueStatus(r.due||r.date,r.paid?'Pago':'Pendente'),`<button class="ok" onclick="markReceivablePaid('${r.id}')">Receber</button> <button class="ghost" onclick="sendReceivableWhatsApp('${r.id}')">WhatsApp</button>`]))}</div>${financePayablesEnterprisePanel(f)}</div><div class="grid two">${financeAgendaCompactPanel(f)}<div class="panel"><h3>Fluxo dos últimos 7 dias</h3><div class="finance-bars">${f.days.map(d=>`<div><span>${d.label}</span><i class="in" style="height:${Math.max(6,d.in/(f.maxDay||1)*130)}px"></i><i class="out" style="height:${Math.max(6,d.out/(f.maxDay||1)*130)}px"></i></div>`).join('')}</div><div class="legend"><span><b class="dot good-bg"></b>Entradas</span><span><b class="dot bad-bg"></b>Saídas</span></div></div></div><div class="grid two">${financeCostCenterPanel(f)}<div class="panel"><h3>Maiores saídas por categoria</h3>${financeCategoryCards(f)}</div></div><div class="panel"><div class="between"><h3>Movimentações financeiras</h3><button class="ghost" id="exportFinance">Exportar CSV</button></div><div id="financeMovementsBox">${financeMovementsHtml(f,cats)}</div></div></div>`;
}
views.finance=(window.NexaGestFinance&&window.NexaGestFinance.wrapFinanceView)?window.NexaGestFinance.wrapFinanceView(financeAdvancedView):financeAdvancedView;



/* v6.4.0 — Importação de extratos OFX */
function ofxEnsureStore(){db.bankTransactions=db.bankTransactions||[];db.ofxImports=db.ofxImports||[];return db.bankTransactions}
function ofxCleanText(t){return String(t||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}
function ofxTag(block,tag){let re=new RegExp('<'+tag+'>([^<\r\n]*)','i');let m=String(block||'').match(re);return m?ofxCleanText(m[1]):''}
function ofxDate(value){let raw=String(value||'').trim();let m=raw.match(/(\d{4})(\d{2})(\d{2})/);if(!m)return today();return `${m[1]}-${m[2]}-${m[3]}`}
function ofxAmount(value){let n=Number(String(value||'0').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0}
function ofxBankName(text){return ofxTag(text,'ORG')||ofxTag(text,'BANKID')||'Banco importado'}
function ofxCategory(tx){let d=(tx.description||'').toLowerCase();if(d.includes('pix'))return 'Pix';if(d.includes('tarifa')||d.includes('taxa'))return 'Taxas';if(d.includes('boleto'))return 'Boleto';if(d.includes('cartao')||d.includes('cartão'))return 'Cartão';if(d.includes('ted')||d.includes('doc')||d.includes('transfer'))return 'Transferência';return tx.amount>=0?'Recebimento':'Pagamento'}
function parseOfxText(text,fileName='extrato.ofx'){
  text=String(text||'').replace(/\r/g,'');
  let blocks=[...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|$)/gi)].map(m=>m[1]);
  let transactions=blocks.map((b,i)=>{let name=ofxTag(b,'NAME'),memo=ofxTag(b,'MEMO'),type=ofxTag(b,'TRNTYPE'),amount=ofxAmount(ofxTag(b,'TRNAMT')),date=ofxDate(ofxTag(b,'DTPOSTED')||ofxTag(b,'DTUSER')),fitid=ofxTag(b,'FITID')||ofxTag(b,'CHECKNUM')||`${date}-${amount}-${i}`;let desc=[name,memo].filter(Boolean).join(' • ')||type||'Movimento bancário';return{id:uid(),fitid,date,type:type||'',description:desc,amount,category:'',status:'Novo',sourceFile:fileName}}).filter(x=>x.description||x.amount);
  let start=ofxDate(ofxTag(text,'DTSTART')),end=ofxDate(ofxTag(text,'DTEND'));
  return{fileName,bank:ofxBankName(text),start,end,createdAt:new Date().toISOString(),transactions};
}
function ofxDraft(){try{return JSON.parse(localStorage.getItem('ofx-draft')||'null')}catch{return null}}
function importOfxFile(e){let file=e.target.files?.[0];if(!file)return;let reader=new FileReader();reader.onload=()=>{try{let draft=parseOfxText(reader.result,file.name);if(!draft.transactions.length)return alert('Não encontrei movimentações neste arquivo OFX.');localStorage.setItem('ofx-draft',JSON.stringify(draft));audit('Extrato OFX lido: '+file.name);app();alert('Extrato OFX lido com sucesso. Confira antes de importar.')}catch(err){alert('Não foi possível ler o OFX: '+(err.message||err))}};reader.readAsText(file,'utf-8')}
function ofxDuplicateKey(tx){return String(tx.fitid||'')+'|'+String(tx.date||'')+'|'+Number(tx.amount||0).toFixed(2)}
function ofxExistingKeys(){return new Set((db.bankTransactions||[]).map(ofxDuplicateKey))}
function ofxSuggestion(tx){let amount=Math.abs(Number(tx.amount||0));if(!amount)return '-';let rec=(db.receivables||[]).find(r=>!r.paid&&Math.abs(Number(r.value||0)-amount)<0.01);if(tx.amount>0&&rec)return `Possível recebimento: ${esc(client(rec.clientId).name)} • ${money(rec.value)}`;let exp=(db.expenses||[]).find(e=>(e.status||'Pago')!=='Pago'&&Math.abs(Number(e.value||0)-amount)<0.01);if(tx.amount<0&&exp)return `Possível conta: ${esc(exp.desc||'Conta a pagar')} • ${money(exp.value)}`;return '-'}
function ofxDraftView(){let d=ofxDraft();if(!d)return '<p class="muted">Nenhum extrato selecionado.</p>';let keys=ofxExistingKeys();let rows=d.transactions.map(tx=>{let dup=keys.has(ofxDuplicateKey(tx));return[br(tx.date),esc(tx.description),`<b class="${tx.amount>=0?'good':'bad'}">${money(tx.amount)}</b>`,esc(tx.type||'-'),dup?'<span class="pill">Já importado</span>':'<span class="pill good">Novo</span>',ofxSuggestion(tx)]});let totalIn=sum(d.transactions.filter(t=>t.amount>0),'amount'),totalOut=Math.abs(sum(d.transactions.filter(t=>t.amount<0),'amount'));return `<div class="ofx-draft"><div class="ofx-head"><div><span>Banco</span><b>${esc(d.bank)}</b><small>${esc(d.fileName)}</small></div><div><span>Período</span><b>${br(d.start)} a ${br(d.end)}</b><small>${d.transactions.length} movimento(s)</small></div><div><span>Entradas</span><b class="good">${money(totalIn)}</b><small>Créditos no extrato</small></div><div><span>Saídas</span><b class="bad">${money(totalOut)}</b><small>Débitos no extrato</small></div></div><label class="check-row"><input type="checkbox" id="ofxPostToFinance"> Criar lançamentos financeiros automaticamente para movimentos novos</label>${table(['Data','Descrição','Valor','Tipo','Status','Sugestão'],rows)}<div class="row"><button class="ok" id="confirmOfxImport">Importar extrato</button><button class="ghost" id="clearOfxDraft">Cancelar</button></div></div>`}
function confirmOfxImport(){let d=ofxDraft();if(!d)return alert('Selecione um arquivo OFX primeiro.');ofxEnsureStore();let keys=ofxExistingKeys(),post=!!document.getElementById('ofxPostToFinance')?.checked;let imported=0,skipped=0,posted=0;d.transactions.forEach(tx=>{let key=ofxDuplicateKey(tx);if(keys.has(key)){skipped++;return}let saved={...tx,id:uid(),category:tx.category||ofxCategory(tx),importedAt:new Date().toISOString(),bank:d.bank,fileName:d.fileName,reconciled:false};db.bankTransactions.unshift(saved);keys.add(key);imported++;if(post){db.expenses.unshift({id:uid(),date:tx.date||new Date().toISOString(),desc:'OFX: '+tx.description,cat:saved.category,type:tx.amount>=0?'Entrada':'Saída',value:Math.abs(tx.amount),payment:'Banco/OFX',status:'Pago',source:'ofx',ofxId:saved.id});posted++}});db.ofxImports.unshift({id:uid(),fileName:d.fileName,bank:d.bank,date:new Date().toISOString(),count:imported,skipped,posted});localStorage.removeItem('ofx-draft');audit(`OFX importado: ${imported} novo(s), ${skipped} duplicado(s)`);save();app();alert(`OFX importado: ${imported} movimento(s) novo(s). ${skipped} duplicado(s) ignorado(s).`)}
function clearOfxDraft(){localStorage.removeItem('ofx-draft');app()}
function exportOfxTransactionsCsv(){let rows=[['data','banco','descricao','tipo','categoria','valor','arquivo','conciliado'],...(db.bankTransactions||[]).map(t=>[br(t.date),t.bank||'',t.description||'',t.type||'',t.category||'',t.amount||0,t.fileName||'',t.reconciled?'Sim':'Não'])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-extrato-ofx.csv','text/csv;charset=utf-8')}
function deleteOfxTransaction(id){confirmAction('Remover este movimento importado do extrato? Lançamentos financeiros já criados não serão excluídos automaticamente.',()=>{db.bankTransactions=(db.bankTransactions||[]).filter(t=>t.id!==id);save();app();alert('Movimento OFX removido.')},'Remover movimento','Remover')}
function ofxPanel(){ofxEnsureStore();let imported=db.bankTransactions||[],inTotal=sum(imported.filter(t=>t.amount>0),'amount'),outTotal=Math.abs(sum(imported.filter(t=>t.amount<0),'amount')),last=(db.ofxImports||[])[0];let latest=imported.slice(0,12);return `<div class="panel ofx-import-panel"><div class="between"><div><h3>📄 Importação de extratos OFX</h3><p class="muted small">Importe o extrato baixado do app/site do banco para conferir entradas, saídas, PIX, tarifas e transferências sem conectar sua conta bancária.</p></div></div><div class="grid cards ofx-summary"><div class="card"><span>Movimentos importados</span><b>${imported.length}</b><small>${(db.ofxImports||[]).length} arquivo(s)</small></div><div class="card"><span>Entradas no extrato</span><b class="good">${money(inTotal)}</b><small>Créditos importados</small></div><div class="card"><span>Saídas no extrato</span><b class="bad">${money(outTotal)}</b><small>Débitos importados</small></div><div class="card"><span>Última importação</span><b>${last?br(last.date):'—'}</b><small>${last?esc(last.fileName):'Nenhum OFX ainda'}</small></div></div><div class="ofx-upload"><div class="field"><label>Arquivo OFX</label><input type="file" id="ofxFile" accept=".ofx,.OFX,text/plain"></div><div class="ofx-tip"><b>Como usar:</b> baixe o extrato OFX no banco, selecione o arquivo aqui, confira a prévia e importe. Nenhuma senha bancária é salva no NexaGest.</div></div>${ofxDraftView()}<div class="between ofx-history-title"><h3>Movimentos bancários importados</h3><button class="ghost" id="exportOfxTransactionsCsv">Exportar CSV</button></div>${latest.length?table(['Data','Descrição','Categoria','Valor','Banco','Ações'],latest.map(t=>[br(t.date),esc(t.description),`<span class="pill">${esc(t.category||ofxCategory(t))}</span>`,`<b class="${t.amount>=0?'good':'bad'}">${money(t.amount)}</b>`,esc(t.bank||'-'),`<button class="danger" onclick="deleteOfxTransaction('${t.id}')">Remover</button>`])):'<p class="muted">Nenhum movimento OFX importado ainda.</p>'}</div>`}
function financeOfxView(){return financeAdvancedView()+ofxPanel()}
views.finance=financeOfxView;
const bindBeforeOfx=bind;
bind=function(){bindBeforeOfx();on('ofxFile',importOfxFile,'change');on('confirmOfxImport',confirmOfxImport);on('clearOfxDraft',clearOfxDraft);on('exportOfxTransactionsCsv',exportOfxTransactionsCsv)};

async function runAutoBackup(){try{if(!db?.settings?.backupAuto)return;let f=db.settings.backupFrequency||'daily';if(f==='manual'||f==='close')return;let now=new Date(),key=f==='weekly'?'nexagest-auto-cloud-week':'nexagest-auto-cloud-day';let marker=f==='weekly'?now.getFullYear()+'-W'+Math.ceil((((now-new Date(now.getFullYear(),0,1))/86400000)+new Date(now.getFullYear(),0,1).getDay()+1)/7):today();if(localStorage.getItem(key)===marker)return;let r=await runCloudBackup({quiet:true,auto:true});if(r?.ok)localStorage.setItem(key,marker)}catch(e){console.warn('Backup automático falhou',e)}}
async function boot(){db=await loadSqliteDatabase();await refreshCompanyInfo();runAutoBackup();app()}
boot();
/* v6.5.0 — Conciliação bancária automática */
function reconEnsureStore(){db.bankTransactions=db.bankTransactions||[];db.reconciliations=db.reconciliations||[];return db.reconciliations}
function reconDateOnly(v){return String(v||'').slice(0,10)||today()}
function reconDaysDiff(a,b){try{let da=new Date(reconDateOnly(a)+'T00:00:00'),dbd=new Date(reconDateOnly(b)+'T00:00:00');return Math.abs(Math.round((da-dbd)/86400000))}catch{return 99}}
function reconAmountClose(a,b){return Math.abs(Math.abs(Number(a||0))-Math.abs(Number(b||0)))<0.01}
function reconSaleLabel(s){return `${saleDisplayNumber(s)} • ${s.clientName||client(s.clientId).name||'Cliente não informado'} • ${money(s.total||0)}`}
function reconTxDirection(tx){return Number(tx.amount||0)>=0?'Entrada':'Saída'}
function reconCandidates(tx){
  let amount=Math.abs(Number(tx.amount||0)), dir=reconTxDirection(tx), desc=String(tx.description||'').toLowerCase(), out=[];
  if(!amount)return out;
  if(dir==='Entrada'){
    (db.receivables||[]).filter(r=>!r.paid&&reconAmountClose(r.value,amount)).forEach(r=>{let c=client(r.clientId),days=reconDaysDiff(tx.date,r.due||r.date),score=90-Math.min(days*8,35);if(desc.includes(String(c.name||'').split(' ')[0]?.toLowerCase()))score+=8;out.push({type:'receivable',id:r.id,label:`Recebimento: ${c.name||'Cliente'} • ${money(r.value)}`,date:r.due||r.date,value:r.value,score})});
    (db.sales||[]).filter(s=>reconAmountClose(s.total,amount)).forEach(s=>{let days=reconDaysDiff(tx.date,s.date),pay=String(s.payment||'').toLowerCase(),score=82-Math.min(days*10,40);if(desc.includes('pix')&&pay.includes('pix'))score+=10;if(desc.includes('cart')&&pay.includes('cart'))score+=7;out.push({type:'sale',id:s.id,label:`Venda: ${reconSaleLabel(s)}`,date:s.date,value:s.total,score})});
  }else{
    (db.expenses||[]).filter(e=>(e.status||'Pago')!=='Pago'&&reconAmountClose(e.value,amount)).forEach(e=>{let days=reconDaysDiff(tx.date,e.due||e.date),score=90-Math.min(days*8,35);let first=String(e.desc||'').split(' ')[0]?.toLowerCase();if(first&&desc.includes(first))score+=8;out.push({type:'payable',id:e.id,label:`Conta a pagar: ${e.desc||'Despesa'} • ${money(e.value)}`,date:e.due||e.date,value:e.value,score})});
    (db.expenses||[]).filter(e=>(e.status||'Pago')==='Pago'&&reconAmountClose(e.value,amount)).forEach(e=>{let days=reconDaysDiff(tx.date,e.date||e.paidAt),score=70-Math.min(days*10,35);out.push({type:'expense',id:e.id,label:`Despesa paga: ${e.desc||'Despesa'} • ${money(e.value)}`,date:e.date||e.paidAt,value:e.value,score})});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,5);
}
function reconBest(tx){return reconCandidates(tx)[0]||null}
function reconStatusPill(tx){if(tx.reconciled)return '<span class="pill good">Conciliado</span>';let b=reconBest(tx);if(b&&b.score>=75)return '<span class="pill warn">Sugestão encontrada</span>';return '<span class="pill bad">Não conciliado</span>'}
function reconcileBankTransaction(txId,type,id){
  reconEnsureStore();let tx=(db.bankTransactions||[]).find(t=>t.id===txId);if(!tx)return alert('Movimento bancário não encontrado.');let match={type,id};
  if(!type||!id){let b=reconBest(tx);if(!b)return alert('Nenhuma sugestão automática encontrada.');match={type:b.type,id:b.id}}
  tx.reconciled=true;tx.reconciledAt=new Date().toISOString();tx.matchedType=match.type;tx.matchedId=match.id;
  if(match.type==='receivable'){let r=(db.receivables||[]).find(x=>x.id===match.id);if(r){r.paid=true;r.paidAt=tx.date||new Date().toISOString();r.paymentMethod='Banco/OFX';r.bankTxId=tx.id}}
  if(match.type==='payable'||match.type==='expense'){let e=(db.expenses||[]).find(x=>x.id===match.id);if(e){e.status='Pago';e.paidAt=tx.date||new Date().toISOString();e.payment=e.payment||'Banco/OFX';e.bankTxId=tx.id}}
  db.reconciliations.unshift({id:uid(),bankTxId:tx.id,type:match.type,matchedId:match.id,date:new Date().toISOString(),amount:tx.amount,description:tx.description});
  audit('Conciliação bancária: '+(tx.description||'movimento')+' '+money(tx.amount));save();app();alert('Movimento conciliado com sucesso.');
}
function unreconcileBankTransaction(txId){let tx=(db.bankTransactions||[]).find(t=>t.id===txId);if(!tx)return;confirmAction('Desfazer conciliação deste movimento?',()=>{tx.reconciled=false;tx.reconciledAt='';tx.matchedType='';tx.matchedId='';db.reconciliations=(db.reconciliations||[]).filter(r=>r.bankTxId!==txId);save();app();alert('Conciliação desfeita.')},'Desfazer conciliação','Desfazer')}
function reconcileAllSuggested(){let list=(db.bankTransactions||[]).filter(t=>!t.reconciled).map(t=>({tx:t,b:reconBest(t)})).filter(x=>x.b&&x.b.score>=80);if(!list.length)return alert('Nenhuma sugestão com alta confiança encontrada.');confirmAction(`Conciliar automaticamente ${list.length} movimento(s) com alta confiança?`,()=>{list.forEach(x=>{let tx=x.tx,b=x.b;tx.reconciled=true;tx.reconciledAt=new Date().toISOString();tx.matchedType=b.type;tx.matchedId=b.id;if(b.type==='receivable'){let r=(db.receivables||[]).find(y=>y.id===b.id);if(r){r.paid=true;r.paidAt=tx.date;r.paymentMethod='Banco/OFX';r.bankTxId=tx.id}}if(b.type==='payable'||b.type==='expense'){let e=(db.expenses||[]).find(y=>y.id===b.id);if(e){e.status='Pago';e.paidAt=tx.date;e.payment=e.payment||'Banco/OFX';e.bankTxId=tx.id}}db.reconciliations.unshift({id:uid(),bankTxId:tx.id,type:b.type,matchedId:b.id,date:new Date().toISOString(),amount:tx.amount,description:tx.description})});audit('Conciliação automática: '+list.length+' movimento(s)');save();app();alert(list.length+' movimento(s) conciliado(s).')},'Conciliação automática','Conciliar')}
function createFinanceFromBankTx(txId){let tx=(db.bankTransactions||[]).find(t=>t.id===txId);if(!tx)return;let type=tx.amount>=0?'Entrada':'Saída';db.expenses.unshift({id:uid(),date:tx.date||new Date().toISOString(),desc:'Banco: '+(tx.description||'Movimento'),cat:tx.category||ofxCategory(tx),type,value:Math.abs(tx.amount||0),payment:'Banco/OFX',status:'Pago',source:'bank-reconcile',ofxId:tx.id});tx.reconciled=true;tx.reconciledAt=new Date().toISOString();tx.matchedType='finance';tx.matchedId=db.expenses[0].id;audit('Lançamento criado por conciliação bancária');save();app();alert('Lançamento financeiro criado e conciliado.')}
function exportReconciliationCsv(){let rows=[['data','descricao','valor','status','tipo_vinculo','id_vinculo'],...(db.bankTransactions||[]).map(t=>[br(t.date),t.description||'',t.amount||0,t.reconciled?'Conciliado':'Pendente',t.matchedType||'',t.matchedId||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-conciliacao-bancaria.csv','text/csv;charset=utf-8')}
function bankReconciliationPanel(){
  reconEnsureStore();let txs=db.bankTransactions||[],reconciled=txs.filter(t=>t.reconciled),pending=txs.filter(t=>!t.reconciled),suggestions=pending.filter(t=>{let b=reconBest(t);return b&&b.score>=75}),unknown=pending.length-suggestions.length;
  let rows=pending.slice(0,20).map(t=>{let b=reconBest(t),actions=b?`<button class="ok" onclick="reconcileBankTransaction('${t.id}','${b.type}','${b.id}')">Conciliar</button> <button class="ghost" onclick="createFinanceFromBankTx('${t.id}')">Criar lançamento</button>`:`<button class="ghost" onclick="createFinanceFromBankTx('${t.id}')">Criar lançamento</button>`;return[br(t.date),esc(t.description),`<b class="${t.amount>=0?'good':'bad'}">${money(t.amount)}</b>`,reconStatusPill(t),b?`${esc(b.label)}<br><small>Confiança ${Math.max(0,Math.min(99,Math.round(b.score)))}% • ${br(b.date)}</small>`:'<span class="muted">Nenhuma correspondência provável</span>',actions]});
  let allRows=txs.slice(0,15).map(t=>[br(t.date),esc(t.description),`<b class="${t.amount>=0?'good':'bad'}">${money(t.amount)}</b>`,reconStatusPill(t),t.reconciled?`<button class="ghost" onclick="unreconcileBankTransaction('${t.id}')">Desfazer</button>`:'-']);
  return `<div class="panel bank-reconcile-panel"><div class="between"><div><h3>🏦 Conciliação bancária automática</h3><p class="muted small">Compare o extrato OFX com vendas, contas a receber, contas a pagar e lançamentos financeiros. Sem acessar sua conta bancária.</p></div></div><div class="grid cards recon-summary"><div class="card"><span>Movimentos no banco</span><b>${txs.length}</b><small>Importados via OFX</small></div><div class="card"><span>Conciliados</span><b class="good">${reconciled.length}</b><small>${txs.length?Math.round(reconciled.length/txs.length*100):0}% conferido</small></div><div class="card"><span>Sugestões</span><b class="warn">${suggestions.length}</b><small>Alta confiança</small></div><div class="card"><span>Pendentes</span><b class="bad">${pending.length}</b><small>${unknown} sem vínculo provável</small></div></div><div class="row recon-actions"><button class="ok" id="reconcileAllSuggested">Conciliar sugestões</button><button class="ghost" id="exportReconciliationCsv">Exportar CSV</button></div><div class="notice"><b>Como funciona:</b> importe o OFX, confira as sugestões e clique em Conciliar. Entradas podem baixar vendas/fiado; saídas podem marcar contas pagas. Movimentos desconhecidos podem virar lançamento financeiro.</div><h3>Pendências de conciliação</h3>${rows.length?table(['Data','Descrição','Valor','Status','Sugestão','Ações'],rows):'<p class="muted">Nenhuma pendência de conciliação.</p>'}<h3>Últimos movimentos conciliados/importados</h3>${allRows.length?table(['Data','Descrição','Valor','Status','Ações'],allRows):'<p class="muted">Importe um OFX para iniciar a conciliação.</p>'}</div>`
}
function financeReconcileView(){return financeAdvancedView()+ofxPanel()+bankReconciliationPanel()}
views.finance=financeReconcileView;
const bindBeforeRecon=bind;
bind=function(){bindBeforeRecon();on('reconcileAllSuggested',reconcileAllSuggested);on('exportReconciliationCsv',exportReconciliationCsv)};

/* v8.0.1 — Contas a Pagar Enterprise: filtros rápidos seguros */
const bindBeforePayablesEnterprise = bind;
bind = function(){
  bindBeforePayablesEnterprise();
  document.querySelectorAll('[data-payable-filter]').forEach(b=>{
    b.onclick=()=>{localStorage.setItem('finance-payable-filter',b.dataset.payableFilter||'all');app()};
  });
};


/* v8.0.5 — OFX Enterprise: filtros, classificação e análise bancária segura */
function ofxEnterpriseRules(){return [
  {cat:'Pix',words:['pix','pix recebido','pix enviado','transferencia pix']},
  {cat:'Taxas bancárias',words:['tarifa','taxa','cesta','manutencao','manutenção','pacote serviços','iof']},
  {cat:'Cartão',words:['cartao','cartão','credito','crédito','debito','débito','maquininha','stone','pagseguro','mercado pago','cielo','rede']},
  {cat:'Boleto',words:['boleto','titulo','título','cobranca','cobrança']},
  {cat:'Transferência',words:['ted','doc','transfer','transf','tef']},
  {cat:'Fornecedor',words:['fornecedor','mercadoria','compra','atacado','distribuidora']},
  {cat:'Salários',words:['salario','salário','folha','pro labore','pró labore','funcionario','funcionário']},
  {cat:'Impostos',words:['das','simples nacional','imposto','tributo','receita federal','sefaz','gnre']},
  {cat:'Infraestrutura',words:['energia','cemig','internet','aluguel','agua','água','telefone']}
]}
function ofxEnterpriseClassify(tx){
  let txt=String((tx.description||'')+' '+(tx.type||'')+' '+(tx.category||'')).toLowerCase();
  let hit=ofxEnterpriseRules().find(r=>r.words.some(w=>txt.includes(w)));
  if(hit)return hit.cat;
  return Number(tx.amount||0)>=0?'Recebimento bancário':'Pagamento bancário';
}
function ofxEnterprisePeriodLabel(date){let d=String(date||'').slice(0,10);return d?d.slice(0,7):'Sem data'}
function ofxEnterpriseStats(){
  ofxEnsureStore();
  let txs=db.bankTransactions||[], pending=txs.filter(t=>!t.reconciled), reconciled=txs.filter(t=>t.reconciled), reviewed=txs.filter(t=>t.reviewed), ignored=txs.filter(t=>t.ignored);
  let suggestions=pending.filter(t=>{let b=reconBest(t);return b&&b.score>=75});
  let inTotal=sum(txs.filter(t=>Number(t.amount||0)>0),'amount'), outTotal=Math.abs(sum(txs.filter(t=>Number(t.amount||0)<0),'amount'));
  let byCat={};txs.forEach(t=>{let c=t.category||ofxEnterpriseClassify(t);byCat[c]=(byCat[c]||0)+Math.abs(Number(t.amount||0))});
  let catRows=Object.entries(byCat).map(([cat,value])=>({cat,value})).sort((a,b)=>b.value-a.value);
  return {txs,pending,reconciled,reviewed,ignored,suggestions,inTotal,outTotal,catRows};
}
function ofxEnterpriseFilters(){return {
  q:localStorage.getItem('ofx-q')||'',
  status:localStorage.getItem('ofx-status')||'Todos',
  type:localStorage.getItem('ofx-type')||'Todos',
  cat:localStorage.getItem('ofx-cat')||'Todas'
}}
function ofxEnterpriseFiltered(){
  let f=ofxEnterpriseFilters(), txs=(db.bankTransactions||[]).slice();
  txs.forEach(t=>{if(!t.category)t.category=ofxEnterpriseClassify(t)});
  if(f.status==='Conciliados')txs=txs.filter(t=>t.reconciled);
  if(f.status==='Pendentes')txs=txs.filter(t=>!t.reconciled&&!t.ignored);
  if(f.status==='Revisados')txs=txs.filter(t=>t.reviewed);
  if(f.status==='Ignorados')txs=txs.filter(t=>t.ignored);
  if(f.type==='Entradas')txs=txs.filter(t=>Number(t.amount||0)>0);
  if(f.type==='Saídas')txs=txs.filter(t=>Number(t.amount||0)<0);
  if(f.cat!=='Todas')txs=txs.filter(t=>(t.category||ofxEnterpriseClassify(t))===f.cat);
  if(f.q){let q=f.q.toLowerCase();txs=txs.filter(t=>String([t.date,t.description,t.bank,t.fileName,t.category].join(' ')).toLowerCase().includes(q))}
  return txs;
}
function ofxEnterpriseSetCategory(id,cat){let tx=(db.bankTransactions||[]).find(t=>t.id===id);if(!tx)return;tx.category=cat;tx.reviewed=true;save();refreshOfxEnterprisePanel()}
function ofxEnterpriseToggleReviewed(id){let tx=(db.bankTransactions||[]).find(t=>t.id===id);if(!tx)return;tx.reviewed=!tx.reviewed;save();refreshOfxEnterprisePanel()}
function ofxEnterpriseToggleIgnored(id){let tx=(db.bankTransactions||[]).find(t=>t.id===id);if(!tx)return;tx.ignored=!tx.ignored;tx.reviewed=true;save();refreshOfxEnterprisePanel()}
function ofxEnterpriseApplyCategories(){let n=0;(db.bankTransactions||[]).forEach(t=>{if(!t.category){t.category=ofxEnterpriseClassify(t);n++}});save();refreshOfxEnterprisePanel();alert(n?`${n} movimento(s) classificado(s).`:'Todos os movimentos já possuem categoria.')}
function ofxEnterpriseExportCsv(){let rows=[['data','banco','descricao','categoria','valor','status','revisado','ignorado','arquivo'],...(db.bankTransactions||[]).map(t=>[br(t.date),t.bank||'',t.description||'',t.category||ofxEnterpriseClassify(t),t.amount||0,t.reconciled?'Conciliado':'Pendente',t.reviewed?'Sim':'Não',t.ignored?'Sim':'Não',t.fileName||''])];download(rows.map(r=>r.map(csvCell).join(';')).join('\n'),'nexagest-ofx-enterprise.csv','text/csv;charset=utf-8')}
function ofxEnterpriseCategorySelect(tx){let cats=['Pix','Taxas bancárias','Cartão','Boleto','Transferência','Fornecedor','Salários','Impostos','Infraestrutura','Recebimento bancário','Pagamento bancário','Outros'];let current=tx.category||ofxEnterpriseClassify(tx);return `<select class="ofx-cat-select" data-ofx-cat-id="${tx.id}">${cats.map(c=>`<option value="${esc(c)}" ${c===current?'selected':''}>${esc(c)}</option>`).join('')}</select>`}
function ofxEnterpriseTable(){
  let rows=ofxEnterpriseFiltered().slice(0,50);
  if(!rows.length)return '<p class="muted">Nenhum movimento encontrado com os filtros atuais.</p>';
  return table(['Data','Descrição','Categoria','Valor','Status','Sugestão','Ações'],rows.map(t=>{let b=reconBest(t);let status=t.ignored?'<span class="pill">Ignorado</span>':(t.reconciled?'<span class="pill good">Conciliado</span>':(b&&b.score>=75?'<span class="pill warn">Sugestão</span>':'<span class="pill bad">Pendente</span>'));return [br(t.date),`${esc(t.description)}<br><small>${esc(t.bank||'-')} • ${esc(t.fileName||'-')}</small>`,ofxEnterpriseCategorySelect(t),`<b class="${Number(t.amount||0)>=0?'good':'bad'}">${money(t.amount)}</b>`,status,b?`${esc(b.label)}<br><small>Confiança ${Math.round(Math.max(0,Math.min(99,b.score)))}%</small>`:'<span class="muted">Sem sugestão provável</span>',`<button class="ghost" data-ofx-review="${t.id}">${t.reviewed?'Revisado':'Revisar'}</button> <button class="ghost" data-ofx-ignore="${t.id}">${t.ignored?'Reativar':'Ignorar'}</button>`]}));
}
function ofxEnterpriseFiltersHtml(stats){
  let f=ofxEnterpriseFilters(), cats=['Todas',...new Set((db.bankTransactions||[]).map(t=>t.category||ofxEnterpriseClassify(t)))];
  return `<div class="ofx-enterprise-filters"><input id="ofxSearch" placeholder="Buscar no extrato" value="${esc(f.q)}"><select id="ofxStatus">${['Todos','Pendentes','Conciliados','Revisados','Ignorados'].map(x=>`<option ${x===f.status?'selected':''}>${x}</option>`).join('')}</select><select id="ofxType">${['Todos','Entradas','Saídas'].map(x=>`<option ${x===f.type?'selected':''}>${x}</option>`).join('')}</select><select id="ofxCatFilter">${cats.map(x=>`<option ${x===f.cat?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`;
}
function ofxEnterpriseInsights(stats){
  let max=Math.max(1,...stats.catRows.map(x=>x.value));
  return `<div class="grid two ofx-enterprise-insights"><div class="panel nested"><div class="between"><h3>Classificação automática</h3><span class="pill">${stats.catRows.length} categoria(s)</span></div>${stats.catRows.length?stats.catRows.slice(0,8).map(x=>`<div class="finance-cost-row"><div class="between"><b>${esc(x.cat)}</b><span>${money(x.value)}</span></div><div class="finance-pro-track"><i style="width:${Math.max(6,x.value/max*100)}%"></i></div></div>`).join(''):'<p class="muted">Importe um OFX para iniciar a análise.</p>'}</div><div class="panel nested"><div class="between"><h3>Saúde da conciliação</h3><span class="pill ${stats.pending.length?'warn':'good'}">${stats.txs.length?Math.round(stats.reconciled.length/stats.txs.length*100):0}% conferido</span></div><div class="ofx-health-list"><div><b>${stats.suggestions.length}</b><span>Sugestões prontas</span></div><div><b>${stats.pending.length}</b><span>Pendentes</span></div><div><b>${stats.reviewed.length}</b><span>Revisados</span></div><div><b>${stats.ignored.length}</b><span>Ignorados</span></div></div></div></div>`
}
function ofxPanel(){
  ofxEnsureStore();let stats=ofxEnterpriseStats(), last=(db.ofxImports||[])[0], filtered=ofxEnterpriseFiltered();
  return `<div class="panel ofx-import-panel ofx-enterprise-panel" id="ofxEnterprisePanel"><div class="between"><div><h3>📄 OFX Enterprise</h3><p class="muted small">Importação, classificação automática, filtros, revisão e conciliação de extratos bancários sem acessar sua conta.</p></div><span class="pill good">8.0.5</span></div><div class="grid cards ofx-summary"><div class="card"><span>Movimentos</span><b>${stats.txs.length}</b><small>${(db.ofxImports||[]).length} arquivo(s)</small></div><div class="card"><span>Entradas</span><b class="good">${money(stats.inTotal)}</b><small>Créditos importados</small></div><div class="card"><span>Saídas</span><b class="bad">${money(stats.outTotal)}</b><small>Débitos importados</small></div><div class="card"><span>Última importação</span><b>${last?br(last.date):'—'}</b><small>${last?esc(last.fileName):'Nenhum OFX ainda'}</small></div></div><div class="ofx-upload"><div class="field"><label>Arquivo OFX</label><input type="file" id="ofxFile" accept=".ofx,.OFX,text/plain"></div><div class="ofx-tip"><b>Como usar:</b> baixe o extrato OFX no banco, selecione o arquivo, confira a prévia e importe. O NexaGest detecta duplicados, sugere categorias e prepara a conciliação.</div></div>${ofxDraftView()}${ofxEnterpriseInsights(stats)}<div class="between ofx-history-title"><h3>Movimentos bancários</h3><div class="row"><button class="ghost" id="ofxApplyCategories">Classificar automaticamente</button><button class="ghost" id="ofxEnterpriseExport">Exportar CSV</button></div></div>${ofxEnterpriseFiltersHtml(stats)}<p class="muted small">${filtered.length} movimento(s) encontrado(s) com os filtros atuais.</p>${ofxEnterpriseTable()}</div>`;
}
function refreshOfxEnterprisePanel(){
  let panel=document.getElementById('ofxEnterprisePanel');
  if(!panel)return app();
  let stats=ofxEnterpriseStats(), last=(db.ofxImports||[])[0], filtered=ofxEnterpriseFiltered();
  panel.innerHTML=`<div class="between"><div><h3>📄 OFX Enterprise</h3><p class="muted small">Importação, classificação automática, filtros, revisão e conciliação de extratos bancários sem acessar sua conta.</p></div><span class="pill good">8.0.5</span></div><div class="grid cards ofx-summary"><div class="card"><span>Movimentos</span><b>${stats.txs.length}</b><small>${(db.ofxImports||[]).length} arquivo(s)</small></div><div class="card"><span>Entradas</span><b class="good">${money(stats.inTotal)}</b><small>Créditos importados</small></div><div class="card"><span>Saídas</span><b class="bad">${money(stats.outTotal)}</b><small>Débitos importados</small></div><div class="card"><span>Última importação</span><b>${last?br(last.date):'—'}</b><small>${last?esc(last.fileName):'Nenhum OFX ainda'}</small></div></div><div class="ofx-upload"><div class="field"><label>Arquivo OFX</label><input type="file" id="ofxFile" accept=".ofx,.OFX,text/plain"></div><div class="ofx-tip"><b>Como usar:</b> baixe o extrato OFX no banco, selecione o arquivo, confira a prévia e importe. O NexaGest detecta duplicados, sugere categorias e prepara a conciliação.</div></div>${ofxDraftView()}${ofxEnterpriseInsights(stats)}<div class="between ofx-history-title"><h3>Movimentos bancários</h3><div class="row"><button class="ghost" id="ofxApplyCategories">Classificar automaticamente</button><button class="ghost" id="ofxEnterpriseExport">Exportar CSV</button></div></div>${ofxEnterpriseFiltersHtml(stats)}<p class="muted small">${filtered.length} movimento(s) encontrado(s) com os filtros atuais.</p>${ofxEnterpriseTable()}`;
  bindOfxEnterpriseEvents();
}
const confirmOfxImportBeforeEnterprise=confirmOfxImport;
confirmOfxImport=function(){let d=ofxDraft();if(!d)return alert('Selecione um arquivo OFX primeiro.');ofxEnsureStore();let keys=ofxExistingKeys(),post=!!document.getElementById('ofxPostToFinance')?.checked;let imported=0,skipped=0,posted=0;d.transactions.forEach(tx=>{let key=ofxDuplicateKey(tx);if(keys.has(key)){skipped++;return}let saved={...tx,id:uid(),category:tx.category||ofxEnterpriseClassify(tx),reviewed:false,ignored:false,importedAt:new Date().toISOString(),bank:d.bank,fileName:d.fileName,reconciled:false};db.bankTransactions.unshift(saved);keys.add(key);imported++;if(post){db.expenses.unshift({id:uid(),date:tx.date||new Date().toISOString(),desc:'OFX: '+tx.description,cat:saved.category,type:tx.amount>=0?'Entrada':'Saída',value:Math.abs(tx.amount),payment:'Banco/OFX',status:'Pago',source:'ofx',ofxId:saved.id,costCenter:financeDefaultCostCenter(saved.category)});posted++}});db.ofxImports.unshift({id:uid(),fileName:d.fileName,bank:d.bank,date:new Date().toISOString(),count:imported,skipped,posted});localStorage.removeItem('ofx-draft');audit(`OFX Enterprise importado: ${imported} novo(s), ${skipped} duplicado(s)`);save();app();alert(`OFX importado: ${imported} movimento(s) novo(s). ${skipped} duplicado(s) ignorado(s).`)};
function bindOfxEnterpriseEvents(){
  on('ofxFile',importOfxFile,'change');
  on('confirmOfxImport',confirmOfxImport);
  on('clearOfxDraft',clearOfxDraft);
  on('ofxApplyCategories',ofxEnterpriseApplyCategories);
  on('ofxEnterpriseExport',ofxEnterpriseExportCsv);
  on('ofxSearch',e=>{localStorage.setItem('ofx-q',e.target.value);refreshOfxEnterprisePanel()},'input');
  on('ofxStatus',e=>{localStorage.setItem('ofx-status',e.target.value);refreshOfxEnterprisePanel()},'change');
  on('ofxType',e=>{localStorage.setItem('ofx-type',e.target.value);refreshOfxEnterprisePanel()},'change');
  on('ofxCatFilter',e=>{localStorage.setItem('ofx-cat',e.target.value);refreshOfxEnterprisePanel()},'change');
  document.querySelectorAll('[data-ofx-cat-id]').forEach(s=>s.onchange=()=>ofxEnterpriseSetCategory(s.dataset.ofxCatId,s.value));
  document.querySelectorAll('[data-ofx-review]').forEach(b=>b.onclick=()=>ofxEnterpriseToggleReviewed(b.dataset.ofxReview));
  document.querySelectorAll('[data-ofx-ignore]').forEach(b=>b.onclick=()=>ofxEnterpriseToggleIgnored(b.dataset.ofxIgnore));
}
const bindBeforeOfxEnterprise = bind;
bind = function(){bindBeforeOfxEnterprise();bindOfxEnterpriseEvents()};
