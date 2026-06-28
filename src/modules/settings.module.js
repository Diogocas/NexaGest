// NexaGest 6.7.3 - módulo auxiliar seguro: Configurações
(function(){
  const sections = ['Empresa','Aparência','Backup','Rede local','Licença e atualização','Diagnóstico'];
  const module = {
    name: 'Configurações',
    version: '6.7.3',
    sections,
    hasSection(section){ return sections.includes(section); },
    networkModes: ['standalone','server','client'],
    safeNetworkMode(mode){ return this.networkModes.includes(mode) ? mode : 'standalone'; }
  };
  window.NexaGestSettings = Object.freeze(module);
})();
