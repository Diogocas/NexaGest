// NexaGest 6.7.3 - módulo auxiliar seguro: Backup
(function(){
  const providers = ['Local','Google Drive','OneDrive','Dropbox'];
  const hints = {
    'Google Drive': 'Escolha uma pasta dentro do Google Drive instalado no Windows.',
    'OneDrive': 'Escolha uma pasta dentro do OneDrive instalado no Windows.',
    'Dropbox': 'Escolha uma pasta dentro do Dropbox instalado no Windows.',
    'Local': 'Usa a pasta local padrão do NexaGest ou uma pasta escolhida.'
  };
  const module = {
    name: 'Backup',
    version: '6.7.3',
    providers,
    isCloud(provider){ return provider && provider !== 'Local'; },
    providerLabel(provider){ return providers.includes(provider) ? provider : 'Local'; },
    hint(provider){ return hints[this.providerLabel(provider)]; },
    statusText(provider){ return this.isCloud(provider) ? `Preparado para ${provider} via pasta sincronizada` : 'Backup local'; },
    validateConfig(config){
      config = config || {};
      return { provider: this.providerLabel(config.provider), folder: String(config.folder||''), auto: !!config.auto };
    }
  };
  window.NexaGestBackup = Object.freeze(module);
})();
