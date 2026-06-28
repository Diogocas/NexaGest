// NexaGest 6.8.2 - módulo Fornecedores
// Refatoração segura: centraliza resumo, formulário e renderização da tela de Fornecedores
// sem alterar regras de negócio, banco, Electron ou dependências.
(function(){
  function monthPurchases(ctx){
    const month = ctx.today().slice(0,7);
    return (ctx.db.purchases || []).filter(b => String(b.date || '').slice(0,7) === month && (b.status || 'Recebida') !== 'Cancelada');
  }
  function summary(ctx){
    const purchases = monthPurchases(ctx);
    return {
      total: (ctx.db.suppliers || []).length,
      active: (ctx.db.suppliers || []).filter(x => x.active !== false).length,
      monthTotal: ctx.sum(purchases, 'total'),
      usedMonth: new Set(purchases.map(x => x.supplierId)).size
    };
  }
  function supplierForm(ctx, supplier){
    const esc = ctx.esc;
    const f = supplier || {};
    return `<div class="form-grid"><div class="field"><label>Nome</label><input id="supName" value="${esc(f.name||'')}"></div><div class="field"><label>CPF/CNPJ</label><input id="supDocument" value="${esc(f.document||'')}"></div><div class="field"><label>Telefone/WhatsApp</label><input id="supPhone" value="${esc(f.phone||'')}"></div><div class="field"><label>E-mail</label><input id="supEmail" value="${esc(f.email||'')}"></div><div class="field"><label>Contato</label><input id="supContact" value="${esc(f.contact||'')}"></div><div class="field"><label>Cidade</label><input id="supCity" value="${esc(f.city||'')}"></div><div class="field wide"><label>Endereço</label><input id="supAddress" value="${esc(f.address||'')}"></div><div class="field"><label>Status</label><select id="supActive"><option value="true" ${f.active!==false?'selected':''}>Ativo</option><option value="false" ${f.active===false?'selected':''}>Inativo</option></select></div><div class="field wide"><label>Observações</label><input id="supNotes" value="${esc(f.notes||f.obs||'')}"></div><div class="field"><label>&nbsp;</label><button id="saveSupplier">${supplier?'Atualizar':'Salvar'}</button></div></div>`;
  }
  function supplierActions(ctx, supplier){
    const esc = ctx.esc;
    return `<button class="ghost" data-profile-supplier="${esc(supplier.id)}">Perfil</button> ${supplier.phone?`<button class="ghost" data-wa="${esc(supplier.phone)}">WhatsApp</button>`:''} <button class="ghost" data-editsup="${esc(supplier.id)}">Editar</button> <button class="ghost danger" data-delsup="${esc(supplier.id)}">Excluir</button>`;
  }
  function renderSuppliersPage(ctx){
    const data = ctx.suppliersData();
    const supplier = ctx.editingSupplier ? (ctx.db.suppliers || []).find(x => x.id === ctx.editingSupplier) : null;
    const s = summary(ctx);
    const esc = ctx.esc;
    const money = ctx.money;
    return `<div class="suppliers-page suppliers-v682"><div class="grid cards supplier-summary"><div class="card"><span>Fornecedores</span><b>${s.total}</b><small>Total cadastrado</small></div><div class="card"><span>Ativos</span><b>${s.active}</b><small>Disponíveis para compras</small></div><div class="card"><span>Compras no mês</span><b>${money(s.monthTotal)}</b><small>Total comprado</small></div><div class="card"><span>Usados no mês</span><b>${s.usedMonth}</b><small>Fornecedores com compras</small></div></div><div class="panel"><div class="between"><h3>${supplier?'Editar fornecedor':'Novo fornecedor'}</h3><div class="row"><button class="ghost" id="exportSuppliers">Exportar CSV</button><button id="newSupplier">Novo</button></div></div>${supplierForm(ctx, supplier)}</div><div class="panel"><div class="between"><h3>Lista de fornecedores</h3><span class="pill">${data.rows.length} resultado(s)</span></div><div class="filters"><input id="supplierSearch" placeholder="Buscar por nome, telefone, cidade, CNPJ ou contato" value="${esc(data.q)}"><select id="supplierStatus">${['Todos','Ativos','Inativos'].map(x=>`<option ${data.status===x?'selected':''}>${x}</option>`).join('')}</select></div>${ctx.table(['Nome','Contato','Telefone','Cidade','Total comprado','Última compra','Status','Ações'],data.rows.map(x=>[esc(x.name||'-'),esc(x.contact||x.email||'-'),esc(x.phone||'-'),esc(x.city||'-'),money(ctx.supplierTotalBought(x.id)),ctx.lastSupplierPurchase(x.id)?ctx.br(ctx.lastSupplierPurchase(x.id).date):'-',x.active===false?'<span class="pill bad">Inativo</span>':'<span class="pill good">Ativo</span>',supplierActions(ctx,x)]))}</div></div>`;
  }
  window.NexaGestSuppliers = {monthPurchases, summary, supplierForm, supplierActions, renderSuppliersPage};
})();
