// NexaGest 6.7.3 - módulo auxiliar seguro: Integrações
(function(){
  const pixProviders = ['Manual','Mercado Pago','PagSeguro','Outro'];
  const module = {
    name: 'Integrações',
    version: '6.7.3',
    pixProviders,
    pixTestAmount: 10,
    pixTestDescription: 'Teste NexaGest',
    safePixProvider(provider){ return pixProviders.includes(provider) ? provider : 'Manual'; },
    shouldCloseModalKey(event){ return event && event.key === 'Escape'; }
  };
  window.NexaGestIntegrations = Object.freeze(module);
})();
