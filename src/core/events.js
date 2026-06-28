// NexaGest 6.7.3 - eventos globais seguros
// Centraliza helpers para evitar botões/modais sem ação nas próximas refatorações.
(function(){
  const registry=new Map();
  function on(selector,event,handler,options){
    if(!selector||!event||typeof handler!=='function')return;
    document.addEventListener(event,function(e){
      const target=e.target?.closest?.(selector);
      if(!target)return;
      handler(e,target);
    },options||false);
  }
  function bind(id,event,handler){
    const el=document.getElementById(id);
    if(!el||typeof handler!=='function')return false;
    const key=`${id}:${event}`;
    const old=registry.get(key);
    if(old)el.removeEventListener(event,old);
    el.addEventListener(event,handler);
    registry.set(key,handler);
    return true;
  }
  function closeTopModal(){
    const selectors=['.modal-overlay.open','#nexagestConfirmOverlay','#operationOverlay','.overlay.open','.modal.open'];
    for(const selector of selectors){
      const el=document.querySelector(selector);
      if(!el)continue;
      if(el.id==='operationOverlay')continue;
      const closeBtn=el.querySelector('[data-close], .modal-close, .close, button[aria-label="Fechar"]');
      if(closeBtn){closeBtn.click();return true;}
      el.remove();
      document.body.classList.remove('modal-open');
      return true;
    }
    return false;
  }
  function enableEscClose(){
    if(window.__nexagestEscCloseEnabled)return;
    window.__nexagestEscCloseEnabled=true;
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      const confirmOpen=document.getElementById('nexagestConfirmOverlay');
      if(confirmOpen)return;
      const pixOpen=document.getElementById('pixTestOverlay')||document.querySelector('[data-pix-test-modal="true"]');
      if(pixOpen){e.preventDefault();closeTopModal();}
    });
  }
  function enableEnterClick(selector,buttonSelector){
    on(selector,'keydown',function(e,box){
      if(e.key!=='Enter')return;
      if(e.target?.tagName==='TEXTAREA')return;
      const btn=box.querySelector(buttonSelector||'button[type="submit"], button.primary, button:not(.ghost)');
      if(btn&&!btn.disabled){e.preventDefault();btn.click();}
    });
  }
  window.NEXA_EVENTS={on,bind,closeTopModal,enableEscClose,enableEnterClick};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enableEscClose);else enableEscClose();
})();
