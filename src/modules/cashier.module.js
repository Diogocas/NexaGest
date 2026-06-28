// NexaGest 6.8.4 - módulo Caixa
// Refatoração segura: centraliza cálculo/resumo do caixa e nomes de pagamento
// sem alterar regras de negócio, banco, Electron ou dependências.
(function(){
  const PAYMENT_KEYS = ['Dinheiro','Pix','Cartão Débito','Cartão Crédito','Fiado'];

  function normalizePaymentName(payment){
    const x = String(payment || 'Dinheiro').toLowerCase();
    if (x.includes('pix')) return 'Pix';
    if (x.includes('débito') || x.includes('debito')) return 'Cartão Débito';
    if (x.includes('crédito') || x.includes('credito')) return 'Cartão Crédito';
    if (x.includes('fiado')) return 'Fiado';
    return 'Dinheiro';
  }

  function emptyPaymentTotals(){
    return PAYMENT_KEYS.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
  }

  function currentCashRegister(db, session){
    return ((db && db.cashRegisters) || []).find(c => c.status === 'Aberto' && c.operatorId === (session && session.id)) || null;
  }

  function openCashRegisters(db){
    return ((db && db.cashRegisters) || []).filter(c => c.status === 'Aberto');
  }

  function cashRegisterSales(cashRegister, sales){
    const id = typeof cashRegister === 'string' ? cashRegister : cashRegister && cashRegister.id;
    return (sales || []).filter(s => s.cashRegisterId === id);
  }

  function cashRegisterSummary(cashRegister, sales){
    const registerSales = cashRegisterSales(cashRegister, sales);
    const by = emptyPaymentTotals();
    registerSales.forEach(s => {
      const key = normalizePaymentName(s.payment);
      by[key] = (by[key] || 0) + Number(s.total || 0);
    });
    const movs = (cashRegister && cashRegister.movements) || [];
    const sangrias = movs.filter(m => m.type === 'Sangria').reduce((a,m)=>a+Number(m.value||0),0);
    const suprimentos = movs.filter(m => m.type === 'Suprimento').reduce((a,m)=>a+Number(m.value||0),0);
    const dinheiroVendas = Number(by.Dinheiro || 0);
    const expected = Number((cashRegister && cashRegister.initialAmount) || 0) + dinheiroVendas + suprimentos - sangrias;
    const totalSales = registerSales.reduce((a,s)=>a+Number(s.total||0),0);
    return {
      sales: registerSales,
      by,
      dinheiroVendas,
      pixVendas: by.Pix || 0,
      debitoVendas: by['Cartão Débito'] || 0,
      creditoVendas: by['Cartão Crédito'] || 0,
      fiadoVendas: by.Fiado || 0,
      sangrias,
      suprimentos,
      expected,
      totalSales,
      count: registerSales.length
    };
  }

  function paymentSummaryHtml(summary, money){
    const format = typeof money === 'function' ? money : (v => String(v || 0));
    return `<div class="summary-box cash-close-summary"><div><span>Vendas</span><b>${summary.count}</b></div><div><span>Total vendido</span><b>${format(summary.totalSales)}</b></div><div><span>💵 Dinheiro</span><b>${format(summary.dinheiroVendas)}</b></div><div><span>📱 Pix</span><b>${format(summary.pixVendas)}</b></div><div><span>💳 Débito</span><b>${format(summary.debitoVendas)}</b></div><div><span>💳 Crédito</span><b>${format(summary.creditoVendas)}</b></div><div><span>📝 Fiado</span><b>${format(summary.fiadoVendas)}</b></div><div><span>Sangrias</span><b>${format(summary.sangrias)}</b></div><div><span>Suprimentos</span><b>${format(summary.suprimentos)}</b></div><div class="total"><span>Dinheiro esperado na gaveta</span><b>${format(summary.expected)}</b></div></div>`;
  }

  window.NexaGestCashier = {
    PAYMENT_KEYS,
    normalizePaymentName,
    emptyPaymentTotals,
    currentCashRegister,
    openCashRegisters,
    cashRegisterSales,
    cashRegisterSummary,
    paymentSummaryHtml
  };
})();
