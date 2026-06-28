// NexaGest 6.8.5 - módulo PDV
// Refatoração segura: centraliza busca, código de barras e cálculos do carrinho
// sem alterar regras de negócio, banco, Electron ou dependências.
(function(){
  function normalizeBarcode(value){
    return String(value || '').replace(/\D/g, '').trim();
  }

  function toNumber(value){
    const n = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function activeProducts(products){
    return (products || []).filter(p => p && p.active !== false);
  }

  function productSearchText(product){
    return [
      product && product.name,
      product && product.category,
      product && product.barcode,
      product && product.brand,
      product && product.supplierName
    ].join(' ').toLowerCase();
  }

  function filterProducts(products, query, limit){
    const raw = String(query || '');
    const needle = raw.toLowerCase().trim();
    const barcode = normalizeBarcode(raw);
    const base = activeProducts(products);
    if(!needle && !barcode) return base;
    const rows = base.filter(p => {
      return productSearchText(p).includes(needle) || String((p && p.barcode) || '').includes(barcode || needle);
    });
    return Number(limit) > 0 ? rows.slice(0, Number(limit)) : rows;
  }

  function findProductByBarcode(products, code){
    const barcode = normalizeBarcode(code);
    if(!barcode) return null;
    return activeProducts(products).find(p => normalizeBarcode(p && p.barcode) === barcode) || null;
  }

  function cartSubtotal(cart, productResolver){
    const getProduct = typeof productResolver === 'function' ? productResolver : (() => ({}));
    return (cart || []).reduce((total, item) => {
      const product = getProduct(item && item.id) || {};
      return total + toNumber(product.sale) * toNumber(item && item.qty);
    }, 0);
  }

  function cartItemCount(cart){
    return (cart || []).reduce((total, item) => total + toNumber(item && item.qty), 0);
  }

  function calcDiscount(subtotal, discountValue, discountPercent){
    const sub = Math.max(0, toNumber(subtotal));
    const value = Math.max(0, toNumber(discountValue));
    const percent = Math.max(0, toNumber(discountPercent));
    return Math.min(sub, value + (sub * percent / 100));
  }

  function saleTotal(subtotal, discount){
    return Math.max(0, toNumber(subtotal) - toNumber(discount));
  }

  window.NexaGestPdv = {
    normalizeBarcode,
    toNumber,
    activeProducts,
    productSearchText,
    filterProducts,
    findProductByBarcode,
    cartSubtotal,
    cartItemCount,
    calcDiscount,
    saleTotal
  };
})();
