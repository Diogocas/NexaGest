// NexaGest 13.1.0 - Licenciamento offline por período ou permanente
(function(){
  const status = {
    none: 'Sem licença configurada',
    active: 'Licença ativa',
    period: 'Licença por período',
    pending: 'Aguardando ativação',
    invalid: 'Licença inválida',
    expired: 'Licença expirada'
  };
  const SECRET = 'NEXAGEST-LIC-OFFLINE-13';
  function normalizeKey(key){ return String(key||'').trim().toUpperCase(); }
  function simpleChecksum(text){
    let h=2166136261;
    for(const ch of String(text||'')){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
    return (h>>>0).toString(36).toUpperCase().slice(0,8).padStart(8,'0');
  }
  function b64urlDecode(text){
    try{
      let s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');
      while(s.length%4)s+='=';
      return decodeURIComponent(escape(atob(s)));
    }catch(e){ return ''; }
  }
  function parseSignedLicense(clean){
    const raw=String(clean||'').trim();
    const m=raw.match(/^NEXA-([A-Z0-9_-]+)\.([A-Z0-9]{8})$/i);
    if(!m)return null;
    const json=b64urlDecode(m[1]);
    if(!json)return null;
    const sig=simpleChecksum(json+SECRET);
    if(sig!==String(m[2]).toUpperCase())return { invalid:true, message:'Assinatura da licença inválida.' };
    try{return JSON.parse(json)}catch(e){return { invalid:true, message:'Dados da licença inválidos.' }}
  }
  function ymd(date){
    if(!date)return '';
    const d=date instanceof Date?date:new Date(date);
    if(isNaN(d))return '';
    return d.toISOString().slice(0,10);
  }
  function addDays(date, days){
    const d=date instanceof Date?new Date(date):new Date(String(date||ymd(new Date()))+'T00:00:00');
    d.setDate(d.getDate()+Math.max(1,Number(days||1)));
    return ymd(d);
  }
  function daysLeft(expiresAt){
    if(!expiresAt)return null;
    const exp=new Date(String(expiresAt)+'T23:59:59');
    if(isNaN(exp))return null;
    return Math.ceil((exp-new Date())/86400000);
  }
  function validateLicense(key, owner, settings){
    const clean=normalizeKey(key);
    if(!clean) return { ok:false, validLicense:false, status:'none', label:status.none, message:'Informe a licença recebida para ativar o NexaGest.' };
    const signed=parseSignedLicense(clean);
    if(signed){
      if(signed.invalid)return { ok:false, validLicense:false, status:'invalid', label:status.invalid, message:signed.message };
      const type=(signed.type==='period'||signed.type==='periodo'||signed.type==='demo')?'period':'permanent';
      const durationDays=Math.max(1,Number(signed.days||signed.durationDays||signed.periodDays||30));
      const base={ validLicense:true, type, durationDays, owner:signed.owner||owner||'', email:signed.email||'', id:signed.id||'', issuedAt:signed.issuedAt||'', offline:true };
      if(type==='period'){
        const activatedKey=normalizeKey(settings?.licenseActivationKey||'');
        const activatedAt=settings?.licenseActivatedAt||'';
        const expiresAt=settings?.licenseExpiresAt||'';
        if(activatedKey!==clean || !activatedAt || !expiresAt){
          return { ...base, ok:true, status:'pending', label:status.pending, needsActivation:true, message:`Licença por período pronta para ativar. A contagem de ${durationDays} dia(s) começa na primeira ativação.` };
        }
        const left=daysLeft(expiresAt);
        if(Number.isFinite(left) && left<0){
          return { ...base, ok:false, status:'expired', label:status.expired, activatedAt, expiresAt, daysLeft:left, message:'A licença expirou. Entre em contato para renovar ou inserir uma nova licença.' };
        }
        return { ...base, ok:true, status:'period', label:status.period, activatedAt, expiresAt, daysLeft:left, message:`Licença por período ativa. Restam ${left} dia(s).` };
      }
      return { ...base, ok:true, status:'active', label:status.active, activatedAt:settings?.licenseActivatedAt||'', expiresAt:'', message:'Licença permanente offline válida.' };
    }
    return { ok:false, validLicense:false, status:'invalid', label:status.invalid, message:'Formato inválido. Use uma licença gerada no NexaGest License Manager DEV.' };
  }
  function licenseStatus(settings){ return validateLicense(settings?.licenseKey, settings?.licenseOwner, settings).label; }
  window.NexaGestPremium = Object.freeze({
    name:'Licença',
    version:'13.1.0',
    status,
    normalizeKey,
    parseSignedLicense,
    addDays,
    validateLicense,
    licenseStatus,
    commercialReady:true,
    offlineLicensingReady:true
  });
})();
