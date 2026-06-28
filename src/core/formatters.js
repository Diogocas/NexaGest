// NexaGest 6.7.3 - formatadores seguros
// Módulo isolado para padronizar moeda, datas, números e textos sem mexer na lógica das telas.
(function(){
  function toNumber(value){
    if(typeof value==='number')return Number.isFinite(value)?value:0;
    const text=String(value??'').trim();
    if(!text)return 0;
    const normalized=text
      .replace(/R\$|\s/g,'')
      .replace(/\./g,'')
      .replace(',', '.');
    const n=Number(normalized);
    return Number.isFinite(n)?n:0;
  }
  function currency(value){
    return Number(toNumber(value)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  function number(value,digits=0){
    return Number(toNumber(value)||0).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  }
  function percent(value,digits=1){
    return `${Number(toNumber(value)||0).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits})}%`;
  }
  function date(value){
    if(!value)return '';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleDateString('pt-BR');
  }
  function datetime(value){
    if(!value)return '';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value);
    return d.toLocaleString('pt-BR');
  }
  function phone(value){
    const d=String(value??'').replace(/\D/g,'');
    if(d.length===11)return d.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3');
    if(d.length===10)return d.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3');
    return String(value??'');
  }
  function document(value){
    const d=String(value??'').replace(/\D/g,'');
    if(d.length===11)return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');
    if(d.length===14)return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
    return String(value??'');
  }
  function escapeHtml(value=''){
    return String(value??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  window.NEXA_FORMAT={toNumber,currency,number,percent,date,datetime,phone,document,escapeHtml};
  // Compatibilidade com nomes antigos usados no app principal.
  window.formatMoney=window.formatMoney||currency;
  window.formatDate=window.formatDate||date;
  window.formatDateTime=window.formatDateTime||datetime;
})();
