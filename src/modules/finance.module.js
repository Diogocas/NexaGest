// NexaGest 6.9.2 - Financeiro PRO
// Camada segura de apoio ao módulo financeiro.
(function(){
  const FINANCE_CATEGORIES = ['Fornecedor','Combustível','Embalagem','Energia','Internet','Aluguel','Mercadoria','Taxas','Comissão','Salário','Impostos','Outros'];
  const PAYMENT_METHODS = ['Dinheiro','Pix','Cartão','Transferência','Boleto'];

  function categories(){ return FINANCE_CATEGORIES.slice(); }
  function paymentMethods(){ return PAYMENT_METHODS.slice(); }
  function normalizeStatus(status){ return status || 'Pago'; }
  function normalizeType(type){ return String(type || '').toLowerCase() === 'entrada' ? 'Entrada' : 'Saída'; }
  function wrapFinanceView(renderer){ return function financeModuleView(){ return renderer(); }; }

  window.NexaGestFinance = {
    categories,
    paymentMethods,
    normalizeStatus,
    normalizeType,
    wrapFinanceView
  };
})();
