// NexaGest 6.7.3 - utilitários seguros extraídos do app.js
// Contém apenas funções puras/estáveis usadas por várias telas.
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const br=v=>new Date(v).toLocaleString('pt-BR');
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
const DB_KEY='nexagest-v4-2-db';
const APP_CONFIG=window.NEXAGEST_CONFIG||{version:'6.0.0',name:'NexaGest'};
const APP_VERSION=APP_CONFIG.version;
const SECURITY_SALT='nexagest-local-user-v2';
function passwordHash(value){let h=2166136261;let text=SECURITY_SALT+'|'+String(value||'');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return 'fnv1a:'+((h>>>0).toString(16).padStart(8,'0'))}
function checkPassword(user,pass){if(user.passwordHash)return user.passwordHash===passwordHash(pass);if(user.password!==undefined)return user.password===pass;return false}
function secureUser(u){if(u&&!u.passwordHash&&u.password!==undefined){u.passwordHash=passwordHash(u.password);delete u.password}return u}
