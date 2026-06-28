// NexaGest 6.7.3 - módulo auxiliar seguro: Nota Fiscal
(function(){
  const module = {
    name: 'Nota Fiscal',
    version: '6.7.3',
    acceptedExtensions: ['.xml'],
    statuses: ['Importada','Pendente','Erro'],
    steps: ['Importar XML','Conferir fornecedor e itens','Confirmar entrada no estoque'],
    normalizeNumber(value){ return Number(String(value||'').replace(',','.'))||0; },
    safeStatus(status){ return this.statuses.includes(status) ? status : 'Importada'; },
    summary(invoice){
      invoice = invoice || {};
      const items = Array.isArray(invoice.items) ? invoice.items.length : 0;
      return { supplier: invoice.supplierName || '', number: invoice.number || '', items, total: this.normalizeNumber(invoice.total) };
    }
  };
  window.NexaGestNfe = Object.freeze(module);
})();
