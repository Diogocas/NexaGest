// NexaGest 6.9.2 - Produtos busca sem recarregar
// Refatoração funcional segura: melhora filtros, indicadores e organização visual
// sem alterar banco, Electron ou dependências.
(function(){
  const STOCK_OPTIONS = ['Todos','OK','Baixo','Zerado'];
  const STATUS_OPTIONS = ['Ativos','Inativos','Todos'];
  const SORT_OPTIONS = [
    ['nome','Nome A-Z'],
    ['estoque-baixo','Estoque baixo primeiro'],
    ['maior-estoque','Maior estoque'],
    ['maior-preco','Maior preço'],
    ['maior-margem','Maior margem']
  ];
  function state(){
    return {
      q: localStorage.getItem('prod-q') || '',
      cat: localStorage.getItem('prod-cat') || 'Todas',
      stock: localStorage.getItem('prod-stock') || 'Todos',
      status: localStorage.getItem('prod-status') || 'Ativos',
      sort: localStorage.getItem('prod-sort') || 'nome'
    };
  }
  function categories(products){
    return [...new Set((products || []).map(p => p.category || 'Geral'))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
  }
  function matchesStock(p, stock){
    const current = Number(p.stock || 0);
    const min = Number(p.min || 0);
    return stock === 'Todos' ||
      (stock === 'Baixo' && current <= min && current > 0) ||
      (stock === 'Zerado' && current <= 0) ||
      (stock === 'OK' && current > min);
  }
  function matchesStatus(p, status){
    if(status === 'Todos') return true;
    if(status === 'Inativos') return p.active === false;
    return p.active !== false;
  }
  function marginValue(p){
    const sale = Number(p.sale || 0), cost = Number(p.cost || 0);
    return sale ? ((sale - cost) / sale) * 100 : 0;
  }
  function sortProducts(rows, sort){
    const list = [...(rows || [])];
    if(sort === 'estoque-baixo') return list.sort((a,b)=>(Number(a.stock||0)-Number(a.min||0))-(Number(b.stock||0)-Number(b.min||0)) || String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
    if(sort === 'maior-estoque') return list.sort((a,b)=>Number(b.stock||0)-Number(a.stock||0));
    if(sort === 'maior-preco') return list.sort((a,b)=>Number(b.sale||0)-Number(a.sale||0));
    if(sort === 'maior-margem') return list.sort((a,b)=>marginValue(b)-marginValue(a));
    return list.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  }
  function filterProducts(products, filters){
    const q = String(filters.q || '').toLowerCase().trim();
    const cat = filters.cat || 'Todas';
    const stock = filters.stock || 'Todos';
    const status = filters.status || 'Ativos';
    const rows = (products || []).filter(p => {
      const hay = [p.name, p.barcode, p.category, p.brand, p.supplierName, p.unit].join(' ').toLowerCase();
      const okQ = !q || hay.includes(q);
      const okCat = cat === 'Todas' || (p.category || 'Geral') === cat;
      return okQ && okCat && matchesStock(p, stock) && matchesStatus(p, status);
    });
    return sortProducts(rows, filters.sort || 'nome');
  }
  function summary(products){
    const list = products || [];
    const active = list.filter(p=>p.active!==false);
    const totalCost = active.reduce((a,p)=>a+Number(p.cost||0)*Number(p.stock||0),0);
    const totalSale = active.reduce((a,p)=>a+Number(p.sale||0)*Number(p.stock||0),0);
    return {
      count: active.length,
      inactive: list.length - active.length,
      totalStock: active.reduce((a,p)=>a+Number(p.stock||0),0),
      valueCost: totalCost,
      valueSale: totalSale,
      projectedProfit: totalSale - totalCost,
      low: active.filter(p=>Number(p.stock||0)<=Number(p.min||0)&&Number(p.stock||0)>0).length,
      zero: active.filter(p=>Number(p.stock||0)<=0).length
    };
  }
  function options(list, selected){
    return list.map(item=>{
      const value = Array.isArray(item) ? item[0] : item;
      const label = Array.isArray(item) ? item[1] : item;
      return `<option value="${value}" ${selected===value?'selected':''}>${label}</option>`;
    }).join('');
  }
  function renderProductsPage(ctx){
    const products = ctx.db.products || [];
    const filters = state();
    const cats = categories(products);
    const rows = filterProducts(products, filters);
    const s = summary(products);
    const esc = ctx.esc;
    const money = ctx.money;
    const productForm = ctx.productForm;
    const productAdminCard = ctx.productAdminCard;
    const editingProduct = ctx.editingProduct;
    return `<div class="products-page products-v680 products-v690 products-v429">
      <div class="products-hero panel">
        <div>
          <h2>Produtos</h2>
          <p class="muted">Cadastro, preços, estoque, margem e etiquetas em um só lugar.</p>
        </div>
        <div class="row products-hero-actions"><button class="ghost" id="generateProductCatalog">📖 Catálogo</button><button class="ghost" id="exportProducts">Exportar CSV</button></div>
      </div>
      <div class="grid cards products-kpis">
        <div class="card"><span>Produtos ativos</span><b>${s.count}</b><small>${s.inactive} inativo(s)</small></div>
        <div class="card"><span>Itens em estoque</span><b>${s.totalStock}</b><small>${s.zero} zerado(s)</small></div>
        <div class="card"><span>Estoque baixo</span><b>${s.low}</b><small>abaixo do mínimo</small></div>
        <div class="card"><span>Valor de venda</span><b>${money(s.valueSale)}</b><small>Custo: ${money(s.valueCost)}</small></div>
        <div class="card"><span>Lucro projetado</span><b class="${s.projectedProfit>=0?'good':'bad'}">${money(s.projectedProfit)}</b><small>com estoque atual</small></div>
      </div>
      <div class="grid two products-layout">
        <div class="panel"><div class="between"><h3>${editingProduct?'Editar produto':'Novo produto'}</h3><button class="ghost" id="newProduct">Novo</button></div>${productForm()}</div>
        <div class="panel products-list-panel">
          <div class="between products-list-head"><div><h3>Lista de produtos</h3><p class="muted small" id="productsFoundCount">${rows.length} ${rows.length===1?'produto encontrado':'produtos encontrados'}</p></div></div>
          <div class="filters products-filters products-filters-v690">
            <input id="prodSearch" placeholder="Buscar por nome, código, marca ou fornecedor" value="${esc(filters.q)}">
            <select id="prodCat"><option>Todas</option>${cats.map(c=>`<option ${filters.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
            <select id="prodStock">${options(STOCK_OPTIONS, filters.stock)}</select>
            <select id="prodStatus">${options(STATUS_OPTIONS, filters.status)}</select>
            <select id="prodSort">${options(SORT_OPTIONS, filters.sort)}</select>
          </div>
          ${rows.length?`<div class="admin-products-grid" id="productsGrid">${rows.map(p=>productAdminCard(p)).join('')}</div>`:`<div class="admin-products-grid" id="productsGrid"><div class="empty-state"><b>Nenhum produto encontrado.</b><span>Altere a busca ou cadastre um novo produto.</span></div></div>`}
        </div>
      </div>
    </div>`;
  }
  
  function refreshProductsList(ctx){
    const products = ctx.db.products || [];
    const filters = state();
    const rows = filterProducts(products, filters);
    const grid = document.getElementById('productsGrid');
    const count = document.getElementById('productsFoundCount');
    if(count) count.textContent = `${rows.length} ${rows.length===1?'produto encontrado':'produtos encontrados'}`;
    if(grid){
      grid.innerHTML = rows.length
        ? rows.map(p=>ctx.productAdminCard(p)).join('')
        : '<div class="empty-state"><b>Nenhum produto encontrado.</b><span>Altere a busca ou cadastre um novo produto.</span></div>';
    }
    return rows;
  }
  window.NexaGestProducts = {state, categories, matchesStock, matchesStatus, filterProducts, sortProducts, summary, renderProductsPage, refreshProductsList};
})();
