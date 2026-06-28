(function(){
  function n(v){ return Number(v || 0); }
  function statusPill(p, stockTypeBadge){
    if(n(p.stock) <= 0) return '<span class="pill bad">Zerado</span>';
    if(n(p.stock) <= n(p.min)) return '<span class="pill warn">Abaixo do mínimo</span>';
    return '<span class="pill good">OK</span>';
  }
  function stockValue(products){ return products.reduce((a,p)=>a + n(p.stock) * n(p.cost), 0); }
  function stockHealth(products){
    const active = products.filter(p=>p.active !== false);
    const low = active.filter(p=>n(p.stock) <= n(p.min) && n(p.stock) > 0);
    const zero = active.filter(p=>n(p.stock) <= 0);
    const ok = active.filter(p=>n(p.stock) > n(p.min));
    return {active, low, zero, ok, total: active.reduce((a,p)=>a+n(p.stock),0), value: stockValue(active)};
  }
  function movementTypes(){
    return ['Entrada','Compra','Devolução','Saída','Venda','Perda','Quebra','Ajuste +','Ajuste -','Inventário +','Inventário -'];
  }
  function movementReasons(){
    return ['Compra','Venda','Perda','Quebra','Ajuste','Inventário','Devolução','Transferência','Conferência','Outro'];
  }
  function renderStockPage(ctx){
    const {db, esc, money, br, product, stockTypeBadge} = ctx;
    const q = localStorage.getItem('stock-q') || '';
    const type = localStorage.getItem('stock-type') || 'Todos';
    const status = localStorage.getItem('stock-status') || 'Todos';
    const products = (db.products || []).filter(p=>p.active !== false);
    const h = stockHealth(products);
    const rows = (db.stockMoves || []).filter(m=>{
      const p = product(m.productId);
      const okQ = !q || [p.name,p.barcode,m.type,m.reason,m.obs].join(' ').toLowerCase().includes(q.toLowerCase());
      const okT = type === 'Todos' || m.type === type || m.reason === type;
      return okQ && okT;
    });
    const critical = products.filter(p=> status==='Todos' ? n(p.stock) <= n(p.min) : status==='Zerados' ? n(p.stock)<=0 : status==='Baixo' ? (n(p.stock)<=n(p.min)&&n(p.stock)>0) : n(p.stock)>n(p.min));
    const selectedProduct = products[0] || {};
    return `<div class="stock-page stock-pro">
      <div class="grid cards">
        <div class="card"><span>Total em estoque</span><b>${h.total}</b><small>${h.active.length} produto(s) ativo(s)</small></div>
        <div class="card"><span>Estoque baixo</span><b>${h.low.length}</b><small>Abaixo do mínimo</small></div>
        <div class="card"><span>Zerados</span><b>${h.zero.length}</b><small>Sem unidade disponível</small></div>
        <div class="card"><span>Valor em custo</span><b>${money(h.value)}</b><small>Estoque × custo</small></div>
      </div>

      <div class="grid two stock-pro-top">
        <div class="panel stock-action-panel">
          <div class="between"><h3>Movimentar estoque</h3><span class="pill good">PRO</span></div>
          <div class="form-grid">
            <div class="field"><label>Produto</label><select id="moveProduct">${products.map(p=>`<option value="${p.id}">${esc(p.name)} — atual: ${n(p.stock)}</option>`).join('')}</select></div>
            <div class="field"><label>Tipo</label><select id="moveType">${movementTypes().map(x=>`<option>${x}</option>`).join('')}</select></div>
            <div class="field"><label>Quantidade</label><input id="moveQty" type="number" min="1" value="1"></div>
            <div class="field"><label>Motivo</label><select id="moveReason">${movementReasons().map(x=>`<option>${x}</option>`).join('')}</select></div>
            <div class="field wide"><label>Observação</label><input id="moveObs" placeholder="Ex.: conferência, lote, validade ou justificativa"></div>
            <div class="field"><label>&nbsp;</label><button id="saveMove">Registrar movimentação</button></div>
          </div>
          <div class="hint">Motivo padronizado + observação livre deixam o histórico mais fácil de auditar.</div>
        </div>

        <div class="panel inventory-panel">
          <div class="between"><h3>Inventário rápido</h3><button class="ghost" id="exportInventory">Exportar inventário</button></div>
          <p class="muted small">Use para conferir o estoque físico e ajustar a diferença automaticamente.</p>
          <div class="form-grid">
            <div class="field"><label>Produto</label><select id="invProduct">${products.map(p=>`<option value="${p.id}">${esc(p.name)} — sistema: ${n(p.stock)}</option>`).join('')}</select></div>
            <div class="field"><label>Qtd. física</label><input id="invQty" type="number" min="0" value="${n(selectedProduct.stock)}"></div>
            <div class="field wide"><label>Observação</label><input id="invObs" placeholder="Ex.: conferência mensal"></div>
            <div class="field"><label>&nbsp;</label><button id="saveInventoryAdjust">Ajustar inventário</button></div>
          </div>
        </div>
      </div>

      <div class="grid two">
        <div class="panel">
          <div class="between"><h3>Produtos críticos</h3><span class="pill ${critical.length?'warn':'good'}">${critical.length?critical.length+' item(ns)':'OK'}</span></div>
          <div class="filters compact"><select id="stockStatus"><option ${status==='Todos'?'selected':''}>Todos</option><option ${status==='Baixo'?'selected':''}>Baixo</option><option ${status==='Zerados'?'selected':''}>Zerados</option><option ${status==='OK'?'selected':''}>OK</option></select></div>
          ${critical.length ? table(['Produto','Estoque','Mínimo','Status'], critical.map(p=>[esc(p.name),n(p.stock),n(p.min),statusPill(p, stockTypeBadge)])) : '<p class="muted">Nenhum produto crítico no filtro selecionado.</p>'}
        </div>
        <div class="panel stock-summary-panel">
          <h3>Resumo de conferência</h3>
          <div class="health-list">
            <div><span>Produtos OK</span><b>${h.ok.length}</b></div>
            <div><span>Abaixo do mínimo</span><b class="warn">${h.low.length}</b></div>
            <div><span>Zerados</span><b class="bad">${h.zero.length}</b></div>
            <div><span>Movimentações</span><b>${(db.stockMoves||[]).length}</b></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="between"><h3>Histórico de estoque</h3><span class="pill">${rows.length}</span></div>
        <div class="filters">
          <input id="stockSearch" placeholder="Buscar produto, tipo, motivo ou observação" value="${esc(q)}">
          <select id="stockType"><option>Todos</option>${movementTypes().map(t=>`<option ${type===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
          <button class="ghost" id="exportStock">Exportar CSV</button>
        </div>
        ${table(['Data','Produto','Tipo','Qtd.','Estoque atual','Observação'], rows.slice(0,150).map(m=>{let p=product(m.productId);return [br(m.date),esc(p.name),stockTypeBadge(m.type),m.qty,(m.stockAfter ?? p.stock),esc(m.obs||m.reason||'')]}))}
      </div>
    </div>`;
  }
  window.NexaGestStock = { renderStockPage };
})();
