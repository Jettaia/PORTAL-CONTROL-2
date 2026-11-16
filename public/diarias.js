// Daily attendance view. PC04 owns visibility, contract values and service dates.
(()=>{
 const host=document.getElementById('diariasPage');if(!host)return;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const btn=(text,action,cls='')=>{const e=make('button',text,cls);e.type='button';e.onclick=action;return e;};
 const yes=v=>v===true||v===1||v===1n||v==='1';
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const formatDate=d=>d?.split('-').reverse().join('/')||'—';
 const time=d=>String(d||'').slice(11,16)||'—';
 const roles=()=>[window.jettaAccount?.perfil,...(window.jettaAccount?.funcoes||[])];
 const allowed=()=>!!window.jettaAccount?.pc04&&!!window.jettaAccount?.pc05&&roles().some(r=>['ADMIN','COORDENADOR','GESTOR'].includes(r));
 // Sum integer cents so all values remain exact, including large contracts.
 function cents(value){const v=String(value??'');if(!/^\d+(?:\.\d{1,2})?$/.test(v))return null;const [whole,fraction='']=v.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));}
 const money=value=>value===null?'—':'R$ '+(value/100n).toLocaleString('pt-BR')+','+String(value%100n).padStart(2,'0');
 async function api(url){let res;try{res=await(window.jettaProtectedFetch||fetch)(url,{credentials:'same-origin',cache:'no-store'});}catch{throw Error('Conexão indisponível. Tente atualizar.');}const data=await res.json().catch(()=>null);if(!res.ok||!data)throw Error(res.status>=500?'Falha técnica. Tente atualizar.':'Consulta indisponível para seu acesso.');return data;}
 let date=today(),depot='',query='',rows=[],catalog=null,epoch=0,loading=false,loadError=false;
 const status=make('p','','diarias-message');status.role='status';status.setAttribute('aria-live','polite');const content=make('div');host.append(status,content);
 function reset(){epoch++;loading=false;loadError=false;rows=[];catalog=null;content.replaceChildren();status.textContent='';}
 function group(r){if(r.Status==='CANCELADA')return 'cancelled';if(r.HorarioPendenteId)return 'pending';if(r.SaidaReal||r.Status==='LIBERADA'||r.PagoEmUtc||yes(r.LiberacaoBloqueada))return 'done';return r.EntradaReal?'exit':'entry';}
 const visible=()=>{const q=query.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');return rows.filter(r=>!q||`${r.Prestador} ${r.Numero}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));};
 function summary(){
  const section=make('section',undefined,'diarias-total');section.id='diariasTotal';section.setAttribute('aria-label','Valor total do dia');
  const planned=rows.filter(r=>r.Status!=='CANCELADA'),values=planned.map(r=>cents(r.Valor)),unavailable=loadError||values.some(v=>v===null),total=unavailable?null:values.reduce((sum,v)=>sum+v,0n);
  const title=make('div');title.append(make('span','Valor total do dia','diarias-total-label'),make('small',loading?'Calculando as diárias…':unavailable?'Atualize a consulta para conferir os valores.':planned.length+' diária'+(planned.length===1?' prevista':'s previstas')+' · '+formatDate(date)));
  const amount=make('strong',loading?'—':unavailable?'Indisponível':money(total));section.append(title,amount);
  return section;
 }
 function person(r,key){
  const link=make('a',undefined,'diarias-person');link.href='#contratacoes/'+encodeURIComponent(r.ContratacaoId)+'/resumo';link.setAttribute('aria-label','Abrir contratação '+r.Numero+' de '+r.Prestador);
  link.addEventListener('click',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();location.hash=link.hash;window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'}));});
  const info=make('div',undefined,'diarias-person-info');info.append(make('strong',r.Prestador),make('span','#'+r.Numero+' · '+(r.Tipo||'Atividade não informada'),'diarias-person-meta'));
  const amount=make('span',money(cents(r.Valor)),'diarias-person-value');amount.setAttribute('aria-label','Valor da diária');if(amount.textContent.length>18)link.classList.add('diarias-person-wide');link.append(info,amount);
  const times=make('div',undefined,'diarias-person-times');times.append(make('span','Previsto '+time(r.InicioPrevisto)+' – '+time(r.FimPrevisto)));
  if(r.EntradaReal)times.append(make('span','Entrada '+time(r.EntradaReal)));if(r.SaidaReal)times.append(make('span','Saída '+time(r.SaidaReal)));link.append(times);
  if(key==='pending')link.append(make('small','Horários aguardando aprovação','diarias-person-note'));
  if(key==='cancelled')link.append(make('small','Fora do total previsto','diarias-person-note'));
  if(key==='done'&&!r.SaidaReal)link.append(make('small',r.PagoEmUtc?'Pagamento registrado':'Contratação liberada','diarias-person-note'));
  return link;
 }
 function section(key,label,filtered,secondary=false){
  const group=make(secondary?'details':'section',undefined,'diarias-group '+key);group.dataset.status=key;
  const heading=make(secondary?'summary':'h2');heading.append(make('span',label),make('b',filtered.length));group.append(heading);if(secondary)group.open=key==='pending'&&filtered.length>0;
  const list=make('div',undefined,'diarias-group-list');for(const row of filtered)list.append(person(row,key));if(!filtered.length)list.append(make('p',loading?'Carregando…':query.trim()?'Nenhum prestador para esta busca.':'Nenhum prestador neste grupo.','diarias-empty'));group.append(list);return group;
 }
 function render(){
  content.replaceChildren();if(!catalog)return;if(!catalog.podeOperar||!allowed()){status.textContent='Seu acesso não permite operar Diárias.';return;}
  const surface=make('section',undefined,'diarias-surface'),filters=make('div',undefined,'diarias-filters');
  const searchLabel=make('label','Buscar prestador ou nº','diarias-search'),search=make('input');search.id='diariasSearch';search.type='search';search.placeholder='Nome ou número da contratação';search.maxLength=150;search.value=query;searchLabel.append(search);
  const dateLabel=make('label','Data do serviço'),dateInput=make('input');dateInput.id='diariasDate';dateInput.type='date';dateInput.min='2000-01-01';dateInput.max='9998-12-31';dateInput.value=date;dateLabel.append(dateInput);
  const depotLabel=make('label','Depósito'),select=make('select');select.id='diariasDepot';for(const d of catalog.depositos||[]){const option=make('option',d.Nome);option.value=String(d.DepositoId);select.append(option);}select.value=depot;depotLabel.append(select);
  const refresh=btn('Atualizar',()=>loadRows(),'diarias-refresh');refresh.disabled=loading;filters.append(searchLabel,dateLabel,depotLabel,refresh);filters.querySelectorAll('input,select').forEach(e=>e.disabled=loading);surface.append(filters,summary());
  const filtered=visible(),caption=make('div',undefined,'diarias-list-caption');caption.append(make('span',query.trim()?filtered.length+' de '+rows.length+' prestadores na busca':rows.length+' prestadores no dia'));surface.append(caption);
  const board=make('div',undefined,'diarias-board');for(const [key,label]of [['entry','Aguardando entrada'],['exit','Em serviço'],['done','Concluídas']])board.append(section(key,label,filtered.filter(r=>group(r)===key)));surface.append(board);
  const exceptions=make('div',undefined,'diarias-exceptions');for(const [key,label]of [['pending','Com pendência'],['cancelled','Canceladas']])exceptions.append(section(key,label,filtered.filter(r=>group(r)===key),true));surface.append(exceptions);
  if(!rows.length&&!loading&&!loadError)surface.append(make('p',query.trim()?'Nenhum prestador para esta busca.':'Nenhuma contratação neste dia.','diarias-empty-day'));content.append(surface);
  search.oninput=()=>{const pos=search.selectionStart;query=search.value;render();const next=content.querySelector('#diariasSearch');next.focus({preventScroll:true});next.setSelectionRange(pos,pos);};
  dateInput.onchange=()=>{date=dateInput.value;if(date&&dateInput.validity.valid)loadRows();else{epoch++;rows=[];loadError=true;loading=false;status.textContent='Informe uma data válida.';render();}};
  select.onchange=()=>{depot=select.value;loadRows();};
 }
 async function loadRows(){
  if(host.hidden||!catalog||!allowed())return;const current=++epoch;rows=[];loading=true;loadError=false;status.textContent='Consultando diárias…';render();
  try{
   if(!depot){loadError=true;status.textContent='Nenhum depósito disponível para seu acesso.';return;}
   const loaded=[],cursors=new Set();let cursor;
   do{const params=new URLSearchParams({dataServico:date,depositoId:depot});if(cursor)params.set('antes',cursor);const data=await api('/api/pc04/contratacoes?'+params);if(current!==epoch)return;if(!Array.isArray(data.registros))throw Error('Lista indisponível.');loaded.push(...data.registros);cursor=data.proximaPagina;if(cursor){if(cursors.has(String(cursor)))throw Error('Paginação indisponível. Atualize a consulta.');cursors.add(String(cursor));}}while(cursor);
   rows=loaded;status.textContent='';
  }catch(e){if(current===epoch){rows=[];loadError=true;status.textContent='Não foi possível carregar as diárias. '+e.message;}}
  finally{if(current===epoch){loading=false;render();}}
 }
 async function load(){reset();if(host.hidden||!allowed())return;date=date||today();status.textContent='Consultando depósitos…';const current=epoch;try{const data=await api('/api/pc04/catalogo');if(current!==epoch)return;catalog=data;if(!catalog.podeOperar){status.textContent='Seu acesso não permite operar Diárias.';return;}const depots=catalog.depositos||[];if(!depots.some(d=>String(d.DepositoId)===depot))depot=String(depots[0]?.DepositoId||'');await loadRows();}catch(e){if(current===epoch)status.textContent='Não foi possível carregar as diárias. '+e.message;}}
 window.addEventListener('jetta:diarias',load);window.addEventListener('jetta:auth',()=>{reset();date=today();depot='';query='';});new MutationObserver(()=>{if(host.hidden)reset();}).observe(host,{attributes:true,attributeFilter:['hidden']});
})();
