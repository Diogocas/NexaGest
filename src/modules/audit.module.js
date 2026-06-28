// NexaGest 8.2.1 - Auditoria Ajustada
// Diagnóstico leve e seguro: não altera banco, Electron, dependências ou regras de negócio.
// Ajuste 8.2.1: módulos que não são expostos no window deixam de reprovar a auditoria.
(function(){
  const REQUIRED_MODULES = [
    'NEXA_FORMAT','NEXA_EVENTS','NexaGestBackup','NexaGestSettings',
    'NexaGestIntegrations','NexaGestPremium','NexaGestDashboard','NexaGestProducts',
    'NexaGestClients','NexaGestSuppliers','NexaGestFinance','NexaGestCashier'
  ];

  const OPTIONAL_MODULES = [
    'NEXA_UI','NexaGestNFe','NexaGestPDV'
  ];

  function checkModules(){
    const required = REQUIRED_MODULES.map(name => ({ name, required: true, ok: !!window[name] }));
    const optional = OPTIONAL_MODULES.map(name => ({
      name,
      required: false,
      ok: !!window[name],
      warning: !window[name] ? 'Módulo funcional, mas não exposto globalmente no window.' : ''
    }));
    return required.concat(optional);
  }

  function findDuplicateDomIds(){
    const seen = new Map();
    const dup = [];
    document.querySelectorAll('[id]').forEach(el => {
      const id = el.id;
      if(!id) return;
      if(seen.has(id)) dup.push(id);
      else seen.set(id, el);
    });
    return [...new Set(dup)];
  }

  function checkCoreGlobals(){
    const names = ['app','save','load','render','login','logout','money','today','uid'];
    return names.map(name => ({
      name,
      ok: typeof window[name] !== 'undefined' || typeof globalThis[name] !== 'undefined',
      required: false
    }));
  }

  function collectRuntimeStatus(){
    const appRoot = document.getElementById('app');
    const visibleButtons = Array.from(document.querySelectorAll('button')).length;
    const inputs = Array.from(document.querySelectorAll('input,select,textarea')).length;
    const currentPage = (window.db && window.page) ? window.page : (document.querySelector('[data-page].active')?.dataset?.page || 'indefinida');
    return {
      appMounted: !!appRoot,
      appHasContent: !!(appRoot && appRoot.innerHTML && appRoot.innerHTML.trim().length),
      visibleButtons,
      inputs,
      currentPage,
      duplicateIds: findDuplicateDomIds()
    };
  }

  function buildMessages(modules, globals, duplicateIds, runtimeErrors){
    const missingRequiredModules = modules.filter(x => x.required && !x.ok).map(x => x.name);
    const optionalNotGlobal = modules.filter(x => !x.required && !x.ok).map(x => x.name);
    const missingGlobals = globals.filter(x=>!x.ok).map(x=>x.name);
    const errors = [];
    const warnings = [];

    if(missingRequiredModules.length){
      errors.push('Módulos obrigatórios ausentes no window: ' + missingRequiredModules.join(', '));
    }
    if(duplicateIds.length){
      errors.push('IDs duplicados encontrados no DOM: ' + duplicateIds.join(', '));
    }
    if(runtimeErrors && runtimeErrors.length){
      warnings.push('Há erros de runtime registrados. Verifique runtimeErrors no relatório.');
    }
    if(optionalNotGlobal.length){
      warnings.push('Módulos opcionais não expostos globalmente: ' + optionalNotGlobal.join(', ') + '. Isso não impede o funcionamento do app.');
    }
    if(missingGlobals.length){
      warnings.push('Globais auxiliares não encontrados: ' + missingGlobals.join(', ') + '. Pode ser normal se a função estiver encapsulada.');
    }

    return { errors, warnings, missingRequiredModules, optionalNotGlobal, missingGlobals };
  }

  function run(){
    const modules = checkModules();
    const globals = checkCoreGlobals();
    const duplicateIds = findDuplicateDomIds();
    const runtimeErrors = (window.__NEXAGEST_RUNTIME_ERRORS__ || []).slice(-10);
    const messages = buildMessages(modules, globals, duplicateIds, runtimeErrors);
    const ok = messages.errors.length === 0;

    const report = {
      app: 'NexaGest',
      version: (window.NEXAGEST_CONFIG && window.NEXAGEST_CONFIG.version) || '8.2.1',
      checkedAt: new Date().toISOString(),
      ok,
      status: ok ? (messages.warnings.length ? 'OK com avisos' : 'OK') : 'Falhou',
      modules,
      globals,
      duplicateIds,
      errors: messages.errors,
      warnings: messages.warnings,
      runtime: collectRuntimeStatus(),
      runtimeErrors,
      notes: [
        'Auditoria leve executada no navegador.',
        'Não modifica dados do cliente.',
        'Módulos opcionais não expostos no window geram aviso, não erro.',
        'Use window.NexaGestAudit.run() no console para repetir a verificação.',
        'Use window.NexaGestAudit.summary() para um resumo simples.'
      ]
    };

    window.__NEXAGEST_LAST_AUDIT__ = report;
    if(report.ok){
      console.info('[NexaGest Audit] ' + report.status, report);
    }else{
      console.warn('[NexaGest Audit]', report);
    }
    return report;
  }

  function summary(){
    const r = run();
    const resumo = {
      app: r.app,
      version: r.version,
      ok: r.ok,
      status: r.status,
      erros: r.errors.length,
      avisos: r.warnings.length,
      modulosObrigatoriosOK: r.modules.filter(m=>m.required && m.ok).length + '/' + r.modules.filter(m=>m.required).length,
      modulosOpcionaisGlobais: r.modules.filter(m=>!m.required && m.ok).length + '/' + r.modules.filter(m=>!m.required).length,
      paginaAtual: r.runtime.currentPage,
      botoesVisiveis: r.runtime.visibleButtons,
      camposVisiveis: r.runtime.inputs
    };
    console.table([resumo]);
    if(r.warnings.length) console.table(r.warnings.map((w,i)=>({n:i+1,aviso:w})));
    if(r.errors.length) console.table(r.errors.map((e,i)=>({n:i+1,erro:e})));
    return resumo;
  }

  function safeRunSoon(){
    try { setTimeout(run, 800); } catch(e) { console.warn('[NexaGest Audit] Falha ao executar auditoria', e); }
  }

  function installGlobalErrorMonitor(){
    if(window.__NEXAGEST_AUDIT_ERROR_MONITOR__) return;
    window.__NEXAGEST_AUDIT_ERROR_MONITOR__ = true;
    window.__NEXAGEST_RUNTIME_ERRORS__ = window.__NEXAGEST_RUNTIME_ERRORS__ || [];
    window.addEventListener('error', ev => {
      window.__NEXAGEST_RUNTIME_ERRORS__.push({
        type: 'error',
        message: ev.message || String(ev.error || ''),
        source: ev.filename || '',
        line: ev.lineno || 0,
        column: ev.colno || 0,
        at: new Date().toISOString()
      });
      window.__NEXAGEST_RUNTIME_ERRORS__ = window.__NEXAGEST_RUNTIME_ERRORS__.slice(-25);
    });
    window.addEventListener('unhandledrejection', ev => {
      window.__NEXAGEST_RUNTIME_ERRORS__.push({
        type: 'promise',
        message: String(ev.reason?.message || ev.reason || 'Promise rejeitada'),
        at: new Date().toISOString()
      });
      window.__NEXAGEST_RUNTIME_ERRORS__ = window.__NEXAGEST_RUNTIME_ERRORS__.slice(-25);
    });
  }

  installGlobalErrorMonitor();

  window.NexaGestAudit = Object.freeze({
    version: '8.2.1',
    run,
    summary,
    checkModules,
    findDuplicateDomIds,
    checkCoreGlobals,
    collectRuntimeStatus
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeRunSoon);
  else safeRunSoon();
})();
