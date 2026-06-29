// Clientes
// Melhoria segura da aba Clientes: indicadores, busca sem recarregar, perfil rápido,
// contato por WhatsApp e visão de crédito/fiado sem alterar banco, Electron ou dependências.
(function(){
  const STORAGE_Q='client-q';
  const STORAGE_STATUS='client-status';
  const STORAGE_SORT='client-sort';

  function state(){
    return {
      q: localStorage.getItem(STORAGE_Q) || '',
      status: localStorage.getItem(STORAGE_STATUS) || 'todos',
      sort: localStorage.getItem(STORAGE_SORT) || 'nome'
    };
  }

  function safeNumber(v){ return Number(v||0) || 0; }
  function normalize(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  function dateText(v){
    if(!v) return '-';
    try { return new Date(v).toLocaleDateString('pt-BR'); } catch(e) { return String(v).slice(0,10)||'-'; }
  }
  function initials(name){
    let parts=String(name||'?').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0]||'?')+(parts.length>1?(parts[parts.length-1]?.[0]||''):'');
  }
  function textOfClient(c){
    return [c.name, c.phone, c.city, c.address, c.document, c.email, c.notes, c.obs].join(' ');
  }
  function salesFor(db,id){
    return (db.sales||[]).filter(s=>!s.cancelled && String(s.clientId||'')===String(id));
  }
  function receivablesFor(db,id){
    return (db.receivables||[]).filter(r=>!r.paid && String(r.clientId||'')===String(id));
  }
  function clientStats(db,c,openByClient){
    let sales=salesFor(db,c.id);
    let total=sales.reduce((a,s)=>a+safeNumber(s.total),0);
    let profit=sales.reduce((a,s)=>a+safeNumber(s.profit || (safeNumber(s.total)-safeNumber(s.cost))),0);
    let open=typeof openByClient==='function' ? safeNumber(openByClient(c.id)) : receivablesFor(db,c.id).reduce((a,r)=>a+safeNumber(r.value),0);
    let last=sales.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
    let limit=safeNumber(c.creditLimit);
    let available=Math.max(0, limit-open);
    let ticket=sales.length ? total/sales.length : 0;
    let vip = total>=5000 ? 'Ouro' : total>=1500 ? 'Prata' : total>0 ? 'Bronze' : 'Novo';
    return {sales,total,profit,open,last,limit,available,ticket,vip};
  }
  function birthdayInfo(c){
    if(!c.birth && !c.birthday) return '';
    let raw=c.birth||c.birthday;
    let d=new Date(raw+'T12:00:00');
    if(Number.isNaN(d.getTime())) return '';
    let today=new Date();
    let mmdd=String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    let now=String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
    let tomorrow=new Date(today); tomorrow.setDate(today.getDate()+1);
    let tom=String(tomorrow.getMonth()+1).padStart(2,'0')+'-'+String(tomorrow.getDate()).padStart(2,'0');
    if(mmdd===now) return '<span class="pill good">Aniversário hoje 🎉</span>';
    if(mmdd===tom) return '<span class="pill warn">Aniversário amanhã</span>';
    return '';
  }
  function filterClients(clients, filters, openByClient, db){
    const q = normalize(filters.q || '');
    const status = filters.status || 'todos';
    let list=(clients||[]).filter(c => {
      const stats=clientStats(db||{},c,openByClient);
      const active=c.active!==false;
      const okQ = !q || normalize(textOfClient(c)).includes(q);
      let okStatus=true;
      if(status==='aberto') okStatus=stats.open>0;
      if(status==='sem_aberto') okStatus=stats.open<=0;
      if(status==='ativo') okStatus=active;
      if(status==='inativo') okStatus=!active;
      if(status==='vip') okStatus=stats.total>=1500;
      return okQ && okStatus;
    });
    return sortClients(list, filters.sort || 'nome', db||{}, openByClient);
  }
  function sortClients(list, sort, db, openByClient){
    let arr=[...list];
    arr.sort((a,b)=>{
      let sa=clientStats(db,a,openByClient), sb=clientStats(db,b,openByClient);
      if(sort==='compras') return sb.total-sa.total;
      if(sort==='aberto') return sb.open-sa.open;
      if(sort==='ultima') return String(sb.last?.date||'').localeCompare(String(sa.last?.date||''));
      if(sort==='cidade') return String(a.city||'').localeCompare(String(b.city||''),'pt-BR');
      return String(a.name||'').localeCompare(String(b.name||''),'pt-BR');
    });
    return arr;
  }
  function summary(ctx){
    const clients = ctx.db.clients || [];
    const stats=clients.map(c=>clientStats(ctx.db,c,ctx.openByClient));
    const totalOpen = stats.reduce((a,s)=>a+s.open,0);
    const totalSpent = stats.reduce((a,s)=>a+s.total,0);
    const withOpen = stats.filter(s=>s.open>0).length;
    const active = clients.filter(c=>c.active!==false).length;
    const topIndex=stats.reduce((best,s,i)=>s.total>(stats[best]?.total||0)?i:best,0);
    const top=clients.length ? {name:clients[topIndex]?.name||'-', value:stats[topIndex]?.total||0} : {name:'-',value:0};
    return {count: clients.length, active, withOpen, totalOpen, totalSpent, top};
  }
  function statusPill(c, stats){
    if(c.active===false) return '<span class="pill bad">Inativo</span>';
    if(stats.open>0) return '<span class="pill warn">Fiado</span>';
    return '<span class="pill good">Ativo</span>';
  }
  function vipPill(stats){
    let cls=stats.vip==='Ouro'?'good':stats.vip==='Prata'?'warn':stats.vip==='Bronze'?'':'muted';
    return `<span class="pill ${cls}">${stats.vip}</span>`;
  }
  function actions(ctx, c){
    const esc = ctx.esc;
    return `<div class="row client-actions"><button class="ghost" data-profile-client="${esc(c.id)}">Perfil</button><button class="secondary" data-editc="${esc(c.id)}">Editar</button>${c.id==='c1'?'':`<button class="danger" data-delc="${esc(c.id)}">Excluir</button>`}</div>`;
  }
  function row(ctx,c){
    const esc=ctx.esc, money=ctx.money;
    const stats=clientStats(ctx.db,c,ctx.openByClient);
    const phone=c.phone||'';
    return `<div class="client-pro-row" data-client-row="${esc(c.id)}">
      <div class="client-avatar">${esc(initials(c.name).toUpperCase())}</div>
      <div class="client-main">
        <div class="client-title"><b>${esc(c.name||'Sem nome')}</b>${statusPill(c,stats)}${vipPill(stats)}${birthdayInfo(c)}</div>
        <div class="client-sub">${esc(phone||'Sem telefone')} • ${esc(c.city||'Sem cidade')} ${c.document?'• '+esc(c.document):''}</div>
        <div class="client-meta"><span>Total: <b>${money(stats.total)}</b></span><span>Compras: <b>${stats.sales.length}</b></span><span>Última: <b>${stats.last?dateText(stats.last.date):'-'}</b></span><span>Ticket: <b>${money(stats.ticket)}</b></span></div>
      </div>
      <div class="client-credit">
        <span>Limite</span><b>${money(stats.limit)}</b><small>Aberto: ${money(stats.open)}</small><small>Disponível: ${money(stats.available)}</small>
      </div>
      <div class="client-contact">
        ${phone?`<button class="ok" data-wa="${esc(phone)}">WhatsApp</button>`:'<span class="muted small">Sem WhatsApp</span>'}
        ${c.phone?`<button class="ghost" data-copy-client="${esc(c.phone)}">Copiar tel.</button>`:''}
      </div>
      ${actions(ctx,c)}
    </div>`;
  }
  function listHtml(ctx, list){
    if(!list.length) return '<div class="empty-state"><b>Nenhum cliente encontrado.</b><p class="muted">Tente limpar a busca ou alterar o filtro.</p></div>';
    return `<div class="client-pro-list">${list.map(c=>row(ctx,c)).join('')}</div>`;
  }
  function toolbar(ctx, filters, list){
    const esc=ctx.esc;
    return `<div class="between client-list-head"><div><h3>Lista de clientes</h3><p class="muted small">Busca rápida, crédito, fiado e contato em um só lugar.</p></div><span class="pill">${list.length} encontrado(s)</span></div>
    <div class="client-toolbar client-pro-toolbar">
      <input id="clientSearch" placeholder="Buscar por nome, telefone, CPF/CNPJ, cidade ou e-mail" value="${esc(filters.q)}" autocomplete="off">
      <select id="clientStatus">
        <option value="todos" ${filters.status==='todos'?'selected':''}>Todos</option>
        <option value="ativo" ${filters.status==='ativo'?'selected':''}>Ativos</option>
        <option value="inativo" ${filters.status==='inativo'?'selected':''}>Inativos</option>
        <option value="aberto" ${filters.status==='aberto'?'selected':''}>Com valor em aberto</option>
        <option value="sem_aberto" ${filters.status==='sem_aberto'?'selected':''}>Sem valor em aberto</option>
        <option value="vip" ${filters.status==='vip'?'selected':''}>Clientes VIP</option>
      </select>
      <select id="clientSort">
        <option value="nome" ${filters.sort==='nome'?'selected':''}>Ordenar por nome</option>
        <option value="compras" ${filters.sort==='compras'?'selected':''}>Maior comprador</option>
        <option value="aberto" ${filters.sort==='aberto'?'selected':''}>Maior fiado</option>
        <option value="ultima" ${filters.sort==='ultima'?'selected':''}>Última compra</option>
        <option value="cidade" ${filters.sort==='cidade'?'selected':''}>Cidade</option>
      </select>
    </div>`;
  }
  function renderClientsPage(ctx){
    const filters = state();
    const list = filterClients(ctx.db.clients || [], filters, ctx.openByClient, ctx.db);
    const s = summary(ctx);
    const esc = ctx.esc;
    const money = ctx.money;
    return `<div class="clients-page clients-pro-page">
      <div class="grid cards client-summary client-pro-summary">
        <div class="card"><span>Clientes cadastrados</span><b>${s.count}</b><small>${s.active} ativo(s)</small></div>
        <div class="card"><span>Com fiado aberto</span><b>${s.withOpen}</b><small>${money(s.totalOpen)} a receber</small></div>
        <div class="card"><span>Total comprado</span><b>${money(s.totalSpent)}</b><small>Histórico de vendas</small></div>
        <div class="card"><span>Melhor cliente</span><b>${esc(s.top.name)}</b><small>${money(s.top.value)}</small></div>
      </div>
      <div class="panel client-form-panel"><div class="between"><div><h3>Cadastro de clientes</h3><p class="muted small">Dados completos para vendas, fiado, entregas e WhatsApp.</p></div><div class="row"><button class="ghost" id="exportClients">Exportar CSV</button><button id="newClient">Novo</button></div></div>${ctx.clientForm()}</div>
      <div class="panel client-list-panel">${toolbar(ctx,filters,list)}<div id="clientsList">${listHtml(ctx,list)}</div></div>
    </div>`;
  }
  function bindClientListActions(ctx){
    document.querySelectorAll('[data-profile-client]').forEach(b=>b.onclick=()=>ctx.openClientProfile?.(b.dataset.profileClient));
    document.querySelectorAll('[data-editc]').forEach(b=>b.onclick=()=>ctx.editClient?.(b.dataset.editc));
    document.querySelectorAll('[data-delc]').forEach(b=>b.onclick=()=>ctx.deleteClient?.(b.dataset.delc));
    document.querySelectorAll('[data-wa]').forEach(b=>b.onclick=()=>ctx.openWhatsAppNumber?.(b.dataset.wa));
    document.querySelectorAll('[data-copy-client]').forEach(b=>b.onclick=()=>{
      try{navigator.clipboard?.writeText?.(b.dataset.copyClient||'')}catch(e){}
    });
  }
  function refreshClientsList(ctx){
    const filters=state();
    const list=filterClients(ctx.db.clients||[], filters, ctx.openByClient, ctx.db);
    const box=document.getElementById('clientsList');
    const count=document.querySelector('.client-list-head .pill');
    if(box) box.innerHTML=listHtml(ctx,list);
    if(count) count.textContent=`${list.length} encontrado(s)`;
    bindClientListActions(ctx);
  }

  window.NexaGestClients = {state, textOfClient, filterClients, summary, renderClientsPage, refreshClientsList, bindClientListActions};
})();
