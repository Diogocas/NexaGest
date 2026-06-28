// NexaGest 6.7.3 - utilitários de interface extraídos do app.js
// Mantém alertas, confirmação e overlay de operação centralizados.
function toastTypeFromMessage(message){
  const text=String(message||'').toLowerCase();
  if(text.includes('erro')||text.includes('inválid')||text.includes('incorreta')||text.includes('bloqueado')||text.includes('não ')||text.includes('sem ')||text.includes('insuficiente'))return 'error';
  if(text.includes('atenção')||text.includes('confira')||text.includes('venc')||text.includes('estoque baixo'))return 'warn';
  if(text.includes('sucesso')||text.includes('salvo')||text.includes('finalizada')||text.includes('registrado')||text.includes('atualizado')||text.includes('aberto')||text.includes('fechado'))return 'success';
  return 'info';
}
function nexagestAlert(message){
  let text=String(message||'');
  let type=toastTypeFromMessage(text);
  let wrap=document.getElementById('nexagest-toast-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='nexagest-toast-wrap';
    document.body.appendChild(wrap);
  }
  let item=document.createElement('div');
  item.className='nexagest-toast '+type;
  let icon={success:'✅',error:'⚠️',warn:'🟡',info:'ℹ️'}[type]||'ℹ️';
  let title={success:'Tudo certo',error:'Atenção',warn:'Aviso',info:'NexaGest'}[type]||'NexaGest';
  item.innerHTML=`<span class="toast-icon">${icon}</span><div><b>${title}</b><p></p></div><button type="button" aria-label="Fechar">×</button>`;
  item.querySelector('p').textContent=text;
  item.querySelector('button').onclick=()=>{item.classList.remove('show');setTimeout(()=>item.remove(),220)};
  wrap.appendChild(item);
  setTimeout(()=>item.classList.add('show'),10);
  setTimeout(()=>{item.classList.remove('show');setTimeout(()=>item.remove(),250)},3600);
  setTimeout(()=>{
    let el=document.querySelector('input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])');
    if(document.activeElement===document.body||document.activeElement?.id==='loginBtn'){
      document.getElementById('loginPass')?.focus();
    }
  },30);
}
window.alert=nexagestAlert;

function closeConfirmModal(){document.getElementById('nexagestConfirmOverlay')?.remove();document.body.classList.remove('modal-open');setTimeout(()=>document.activeElement?.blur?.(),0)}
function confirmAction(message,onConfirm,title='Confirmar ação',okText='Confirmar'){
  closeConfirmModal();
  const overlay=document.createElement('div');
  overlay.id='nexagestConfirmOverlay';
  overlay.className='modal-overlay confirm-overlay open';
  overlay.innerHTML=`<div class="modal-card confirm-card" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p class="muted">${esc(message)}</p><div class="modal-actions"><button class="ghost" id="confirmCancelBtn" type="button">Cancelar</button><button class="danger" id="confirmOkBtn" type="button">${esc(okText)}</button></div></div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  const cancel=()=>closeConfirmModal();
  const ok=()=>{closeConfirmModal();setTimeout(()=>{try{onConfirm&&onConfirm()}finally{setTimeout(()=>{let el=document.querySelector('input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])');el?.focus?.()},40)}},0)};
  document.getElementById('confirmCancelBtn')?.addEventListener('click',cancel);
  document.getElementById('confirmOkBtn')?.addEventListener('click',ok);
  overlay.addEventListener('click',e=>{if(e.target===overlay)cancel()});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape')cancel();if(e.key==='Enter')ok()});
  setTimeout(()=>document.getElementById('confirmCancelBtn')?.focus(),20);
}

let saveStatusTimer=null, operationOverlayTimer=null;
function ensureSaveStatus(){
  let el=document.getElementById('nexagest-save-status');
  if(!el){el=document.createElement('div');el.id='nexagest-save-status';document.body.appendChild(el)}
  return el;
}
function updateSaveStatus(state,opts={}){
  // Notificações de salvamento agora são silenciosas por padrão.
  // Rotinas internas (rede, timers, cache, autosave) salvam o banco sem mostrar
  // a mensagem repetitiva "Dados salvos". Só exibimos quando uma ação do
  // usuário pedir explicitamente feedback visual, ou em caso de erro.
  if(opts.silent && state!=='error')return;
  clearTimeout(saveStatusTimer);
  const el=ensureSaveStatus();
  const map={saving:['syncing','💾 Salvando...'],saved:['saved','✅ Alterações salvas'],error:['error','⚠️ Erro ao salvar']};
  const [cls,label]=map[state]||map.saving;
  el.className='save-status '+cls+' show';
  el.textContent=label;
  if(state==='saved')saveStatusTimer=setTimeout(()=>el.classList.remove('show'),1300);
}
function showOperationOverlay(label='Processando...'){
  closeOperationOverlay();
  const ov=document.createElement('div');
  ov.id='operationOverlay';
  ov.className='operation-overlay';
  ov.innerHTML=`<div class="operation-card"><div class="spinner"></div><b>${label}</b><span>Um instante...</span></div>`;
  document.body.appendChild(ov);
  setTimeout(()=>ov.classList.add('show'),20);
}
function closeOperationOverlay(){
  const ov=document.getElementById('operationOverlay');
  if(ov){ov.classList.remove('show');setTimeout(()=>ov.remove(),180)}
}
async function withOperation(label,fn){
  showOperationOverlay(label);
  try{return await fn()}finally{setTimeout(closeOperationOverlay,250)}
}
