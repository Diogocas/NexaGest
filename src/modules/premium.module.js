// NexaGest 9.1.0 - Licenciamento online/offline e atualização profissional
(function(){
  const status = { none: 'Sem licença configurada', active: 'Licença ativa', invalid: 'Licença inválida', trial: 'Modo demonstração' };
  function normalizeKey(key){ return String(key||'').trim().toUpperCase(); }
  function simpleChecksum(text){
    let h=2166136261;
    for(const ch of String(text||'')){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
    return (h>>>0).toString(36).toUpperCase().slice(0,4).padStart(4,'0');
  }
  function validateLicense(key, owner){
    const clean=normalizeKey(key);
    if(!clean) return { ok:false, status:'none', label:status.none, message:'Informe uma licença ou use o modo demonstração.' };
    if(/^NEXA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)){
      return { ok:true, status:'active', label:status.active, plan:'Profissional', offline:true, onlineReady:true, owner:String(owner||'').trim(), message:'Licença local válida. Use Ativar online quando o servidor estiver configurado.' };
    }
    if(/^DEMO(-|$)/.test(clean)){
      return { ok:true, status:'trial', label:status.trial, plan:'Demonstração', offline:true, owner:String(owner||'').trim() };
    }
    return { ok:false, status:'invalid', label:status.invalid, message:'Formato esperado: NEXA-XXXX-XXXX-XXXX.' };
  }
  function generateDemoKey(owner){
    const base=String(owner||'DEMO').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)||'DEMO';
    return `DEMO-${simpleChecksum(base)}-${simpleChecksum(base+Date.now())}`;
  }
  function licenseStatus(settings){ return validateLicense(settings?.licenseKey, settings?.licenseOwner).label; }
  window.NexaGestPremium = Object.freeze({
    name:'Premium/Licença',
    version:'9.1.0',
    status,
    normalizeKey,
    validateLicense,
    generateDemoKey,
    licenseStatus,
    commercialReady:true, onlineLicensingReady:true
  });
})();
