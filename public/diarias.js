// Daily operational view. PC04 owns visibility; PC05 owns issuance and concurrency.
(()=>{
 const host=document.getElementById('diariasPage');if(!host)return;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const btn=(text,action,cls='')=>{const e=make('button',text,cls);e.type='button';e.onclick=action;return e;};
 const yes=v=>v===true||v===1||v==='1';
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const formatDate=d=>d?.split('-').reverse().join('/')||'—';
 const time=d=>String(d||'').slice(11,16)||'—';
 const roles=()=>[window.jettaAccount?.perfil,...(window.jettaAccount?.funcoes||[])];
 const allowed=()=>!!window.jettaAccount?.pc04&&!!window.jettaAccount?.pc05&&roles().some(r=>['ADMIN','COORDENADOR','GESTOR'].includes(r));
 const errors={REGISTRO_ALTERADO_ATUALIZE:'Outra pessoa alterou esta contratação. Atualize a consulta e revise novamente.',ENTRADA_OBRIGATORIA:'A entrada precisa ser registrada pelo token antes da saída.',HORARIOS_PENDENTES_APROVACAO:'Aguardando aprovação dos horários.',HORARIO_JA_REGISTRADO:'O horário já foi registrado. Atualize a consulta.',CONTRATACAO_FECHADA:'Contratação fechada para tokens.',PERMISSAO_NEGADA:'Seu acesso não permite esta operação.',CONTRATACAO_INDISPONIVEL:'Contratação indisponível para seu acesso.',GERACAO_INDISPONIVEL:'Não há códigos disponíveis agora. Tente mais tarde.',MFA_NECESSARIO:'Confirme sua autenticação para continuar.',OPERACAO_OCUPADA:'Outra operação está em andamento. Atualize e tente novamente.'};
 async function api(url,body){
  let res;try{res=await(window.jettaProtectedFetch||fetch)(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','x-jetta-request':'web'},body:JSON.stringify(body)}:{})});}catch{throw Error(body?'Sem confirmação do servidor. O token pode ter sido gerado; confira antes de gerar novamente.':'Conexão indisponível. Tente atualizar.');}
  const data=await res.json().catch(()=>null);
  if(!res.ok)throw Error(errors[data?.erro]||(res.status>=500?'Falha técnica. Confira a contratação antes de tentar novamente.':data?.erro||'Acesso indisponível.'));
  if(!data)throw Error(body?'Resposta indisponível. Confira a contratação antes de gerar novamente.':'Resposta indisponível.');return data;
 }
 let date=today(),depot='',query='',rows=[],selected=new Set(),catalog=null,epoch=0,loading=false,reviewing=false,issuing=false,kind='AMBOS',reviewRows=[],results=[],returnFocus=null;
 const status=make('p','','diarias-message');status.role='status';status.setAttribute('aria-live','polite');
 const content=make('div');host.append(status,content);
 const dialog=make('dialog',undefined,'diarias-dialog');dialog.id='diariasDialog';dialog.setAttribute('aria-labelledby','diariasDialogTitle');document.body.append(dialog);
 function clearDialog(){reviewRows=[];results=[];dialog.replaceChildren();}
 function closeDialog(){if(issuing||reviewing)return;dialog.close();clearDialog();returnFocus?.focus({preventScroll:true});}
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
 // Secrets never survive route/auth transitions. Already submitted requests may finish;
 // the epoch check prevents any following request or late UI disclosure.
 function reset(){epoch++;loading=false;reviewing=false;issuing=false;selected.clear();rows=[];catalog=null;if(dialog.open)dialog.close();clearDialog();content.replaceChildren();status.textContent='';}
 function group(r){if(r.Status!=='ABERTA'||r.SaidaReal||r.PagoEmUtc||yes(r.LiberacaoBloqueada))return 'done';if(r.HorarioPendenteId)return 'pending';return r.EntradaReal?'exit':'entry';}
 function eligible(r,entryUsed=r.EntradaTokenUsada){
  if(r.Status!=='ABERTA'||r.PagoEmUtc||yes(r.LiberacaoBloqueada))return {reason:'Contratação fechada'};
  if(r.HorarioPendenteId)return {reason:'Aprovação de horários pendente'};
  if(r.SaidaReal)return {reason:'Saída já registrada'};
  if(!r.EntradaReal)return {type:'ENTRADA'};
  if(!yes(entryUsed))return {reason:'Entrada sem token utilizado'};
  return {type:'SAIDA'};
 }
 const visible=()=>{const q=query.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');return rows.filter(r=>!q||`${r.Prestador} ${r.Numero}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));};
 const selectedRows=()=>rows.filter(r=>selected.has(String(r.ContratacaoId)));
 function counts(){const counts=make('div',undefined,'diarias-kpis');const pairs=[['Abertas',rows.filter(r=>r.Status==='ABERTA').length],['Aguardando entrada',rows.filter(r=>group(r)==='entry').length],['Em serviço',rows.filter(r=>group(r)==='exit').length],['Com pendência',rows.filter(r=>group(r)==='pending').length]];for(const [label,n]of pairs){const item=make('span');item.append(make('b',n),document.createTextNode(label));counts.append(item);}return counts;}
 function updateBulk(){const n=selectedRows().map(r=>eligible(r));const count=content.querySelector('[data-selection]'),hint=content.querySelector('[data-availability]'),button=content.querySelector('[data-review]');if(!count)return;count.textContent=selected.size+' selecionada'+(selected.size===1?'':'s');hint.textContent=n.filter(r=>r.type==='ENTRADA').length+' entradas · '+n.filter(r=>r.type==='SAIDA').length+' saídas disponíveis';button.disabled=loading||!selected.size;}
 function render(){
  content.replaceChildren();if(!catalog)return;
  if(!catalog.podeOperar||!allowed()){status.textContent='Seu acesso não permite operar Diárias.';return;}
  content.append(counts());const surface=make('section',undefined,'diarias-surface'),filters=make('div',undefined,'diarias-filters');
  const searchLabel=make('label','Buscar prestador ou nº'),search=make('input');search.id='diariasSearch';search.type='search';search.placeholder='Nome ou número da contratação';search.maxLength=150;search.value=query;searchLabel.append(search);searchLabel.className='diarias-search';
  const dateLabel=make('label','Data do serviço'),dateInput=make('input');dateInput.id='diariasDate';dateInput.type='date';dateInput.min='2000-01-01';dateInput.max='9998-12-31';dateInput.value=date;dateLabel.append(dateInput);
  const depotLabel=make('label','Depósito'),select=make('select');select.id='diariasDepot';for(const d of catalog.depositos||[]){const option=make('option',d.Nome);option.value=String(d.DepositoId);select.append(option);}select.value=depot;depotLabel.append(select);
  const all=btn('Selecionar abertas do dia',()=>{const open=visible().filter(r=>r.Status==='ABERTA'),remove=open.length&&open.every(r=>selected.has(String(r.ContratacaoId)));for(const r of open){const id=String(r.ContratacaoId);if(remove)selected.delete(id);else selected.add(id);}render();},'diarias-secondary');all.disabled=loading||!visible().some(r=>r.Status==='ABERTA');
  const refresh=btn('Atualizar',()=>loadRows(),'diarias-refresh');refresh.disabled=loading;
  filters.append(searchLabel,dateLabel,depotLabel,all,refresh);filters.querySelectorAll('input,select').forEach(e=>e.disabled=loading);surface.append(filters);
  const caption=make('div',undefined,'diarias-list-caption');caption.append(make('span',visible().length+' contratações · '+formatDate(date)));surface.append(caption);
  const groups=make('div',undefined,'diarias-groups');
  for(const [key,label]of [['entry','Aguardando entrada'],['exit','Em serviço'],['pending','Com pendência'],['done','Liberadas / concluídas']]){
   const section=make('section',undefined,'diarias-group'),heading=make('h2',label),list=visible().filter(r=>group(r)===key);heading.append(make('span',list.length));section.append(heading);
   for(const r of list){const id=String(r.ContratacaoId),row=make('label',undefined,'diarias-person'+(selected.has(id)?' selected':'')),check=make('input');check.type='checkbox';check.checked=selected.has(id);check.disabled=loading||r.Status!=='ABERTA';check.setAttribute('aria-label','Selecionar '+r.Prestador);check.onchange=()=>{check.checked?selected.add(id):selected.delete(id);row.classList.toggle('selected',check.checked);updateBulk();};
    const info=make('span',undefined,'diarias-person-info');info.append(make('strong',r.Prestador),make('small','#'+r.Numero+' · '+(r.Tipo||'—')),make('small',time(r.InicioPrevisto)+' – '+time(r.FimPrevisto)));
    const note=eligible(r);if(key==='exit')info.append(make('small',note.type?'Entrada confirmada às '+time(r.EntradaReal):note.reason,'diarias-person-note'));if(key==='done')info.append(make('small',r.Status==='CANCELADA'?'Cancelada':r.Status==='LIBERADA'?'Liberada':'Saída registrada'));
    row.append(check,info);section.append(row);
   }if(!list.length)section.append(make('p',loading?'Carregando…':'Nenhuma contratação','diarias-empty'));groups.append(section);
  }
  if(!rows.length&&!loading)surface.append(make('p','Nenhuma contratação neste dia.','diarias-empty-day'));else surface.append(groups);
  const bulk=make('div',undefined,'diarias-bulk'),info=make('div'),count=make('strong'),available=make('small');count.dataset.selection='';available.dataset.availability='';info.append(count,available);
  const actions=make('div'),clear=btn('Limpar',()=>{selected.clear();render();},'diarias-plain'),review=btn('Gerar tokens em lote',openReview,'diarias-primary');review.dataset.review='';clear.disabled=loading;actions.append(clear,review);bulk.append(info,actions);content.append(surface,bulk);updateBulk();
  search.oninput=()=>{const pos=search.selectionStart;query=search.value;selected.clear();render();const next=content.querySelector('#diariasSearch');next.focus({preventScroll:true});next.setSelectionRange(pos,pos);};
  dateInput.onchange=()=>{date=dateInput.value;if(date&&dateInput.validity.valid)loadRows();else{epoch++;selected.clear();rows=[];status.textContent='Informe uma data válida.';render();}};
  select.onchange=()=>{depot=select.value;loadRows();};
 }
 async function loadRows(){
  if(host.hidden||!catalog||!allowed())return;const current=++epoch;selected.clear();rows=[];loading=true;status.textContent='Consultando diárias…';render();
  try{
   if(!depot){status.textContent='Nenhum depósito disponível para seu acesso.';return;}
   const loaded=[],cursors=new Set();let cursor;
   do{const params=new URLSearchParams({dataServico:date,depositoId:depot});if(cursor)params.set('antes',cursor);const data=await api('/api/pc04/contratacoes?'+params);if(current!==epoch)return;if(!Array.isArray(data.registros))throw Error('Lista indisponível.');loaded.push(...data.registros);cursor=data.proximaPagina;if(cursor){if(cursors.has(String(cursor)))throw Error('Paginação indisponível. Atualize a consulta.');cursors.add(String(cursor));}}while(cursor);
   rows=loaded;status.textContent='';
  }catch(e){if(current===epoch){rows=[];status.textContent='Não foi possível carregar as diárias. '+e.message;}}
  finally{if(current===epoch){loading=false;render();}}
 }
 async function load(){
  reset();if(host.hidden||!allowed())return;date=date||today();status.textContent='Consultando depósitos…';const current=epoch;
  try{const data=await api('/api/pc04/catalogo');if(current!==epoch)return;catalog=data;if(!catalog.podeOperar){status.textContent='Seu acesso não permite operar Diárias.';return;}const depots=catalog.depositos||[];if(!depots.some(d=>String(d.DepositoId)===depot))depot=String(depots[0]?.DepositoId||'');await loadRows();}catch(e){if(current===epoch)status.textContent='Não foi possível carregar as diárias. '+e.message;}
 }
 function shell(title,subtitle){dialog.replaceChildren();const header=make('header',undefined,'diarias-dialog-header'),info=make('div');const h=make('h2',title);h.id='diariasDialogTitle';info.append(h,make('p',subtitle));const close=btn('×',closeDialog,'diarias-close');close.setAttribute('aria-label','Fechar lote');close.disabled=reviewing||issuing;header.append(info,close);const body=make('div',undefined,'diarias-dialog-body'),footer=make('footer',undefined,'diarias-dialog-footer');dialog.append(header,body,footer);return {body,footer};}
 async function openReview(){
  if(loading||reviewing||issuing||!selected.size)return;returnFocus=document.activeElement;reviewRows=[];results=[];kind='AMBOS';reviewing=true;const current=epoch,chosen=selectedRows();const {body}=shell('Revisar tokens em lote','Consultando as contratações selecionadas…');body.append(make('p','Verificando disponibilidade…'));dialog.showModal();updateBulk();
  try{for(const r of chosen){const item={row:r};try{const data=await api('/api/pc04/contratacoes/'+encodeURIComponent(r.ContratacaoId));if(current!==epoch)return;item.row=data.registro;item.eligibility=data.podeOperar===true&&data.pc05===true?eligible({...data.registro,HorarioPendenteId:data.registro.HorarioPendenteId||(data.solicitacoesHorarios||[]).some(s=>s.Status==='PENDENTE')},data.entradaTokenUsada):{reason:'Tokens indisponíveis para seu acesso'};}catch(e){item.eligibility={reason:e.message};}if(current!==epoch)return;reviewRows.push(item);}}
  finally{if(current===epoch){reviewing=false;renderReview();}}
 }
 function disposition(item){const e=item.eligibility;if(e.type&&(kind==='AMBOS'||kind===e.type))return e;return {reason:e.reason||'Tipo indisponível para esta contratação'};}
 function renderReview(){
  const {body,footer}=shell('Gerar tokens em lote',reviewRows.length+' contratações selecionadas · '+formatDate(date));const choices=make('div',undefined,'diarias-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Tipo de token');for(const [key,label]of [['ENTRADA','Só entrada'],['SAIDA','Só saída'],['AMBOS','Entrada e saída']]){const button=btn(label,()=>{kind=key;renderReview();});button.setAttribute('aria-pressed',String(key===kind));choices.append(button);}body.append(choices,make('p','Entrada e saída gera o tipo disponível para cada contratação agora. A saída exige o uso do token de entrada.','diarias-note'));
  const list=make('div',undefined,'diarias-review-list');let total=0;for(const item of reviewRows){const e=disposition(item),line=make('div'),person=make('span');person.append(make('strong',item.row.Prestador),make('small','#'+item.row.Numero));line.append(person,make('span',e.type?'Gerar '+(e.type==='ENTRADA'?'entrada':'saída'):'Ignorada · '+e.reason,'diarias-badge '+(e.type?'ready':'ignored')));if(e.type)total++;list.append(line);}body.append(list,make('p','Cada token vale 1 hora e é usado uma única vez. Gerar novamente substitui o token anterior da mesma contratação e tipo.','diarias-note'));
  const generate=btn('Gerar '+total+' token'+(total===1?'':'s'),generateBatch,'diarias-primary');generate.disabled=!total;footer.append(make('span',total+' de '+reviewRows.length+' contratações aptas'),btn('Voltar',closeDialog,'diarias-secondary'),generate);
 }
 async function generateBatch(){
  if(issuing||reviewing)return;const current=epoch,items=reviewRows.map(item=>({...item,...disposition(item)}));issuing=true;let ui=shell('Gerando tokens…','Aguarde a conclusão do lote.');const progress=make('p','Verificando autorização…');progress.role='status';ui.body.append(progress);
  try{
   if(window.jettaEnsureRecentMfa)await window.jettaEnsureRecentMfa();if(current!==epoch)return;
   for(const [index,item]of items.entries()){
    if(current!==epoch||host.hidden||!allowed())return;
    if(!item.type){results.push({...item,status:'ignored'});continue;}
    progress.textContent='Gerando token '+(index+1)+' de '+items.length+'…';
    try{const out=await api('/api/pc05/contratacoes/'+encodeURIComponent(item.row.ContratacaoId)+'/tokens',{versao:Number(item.row.Versao),tipo:item.type});if(current!==epoch)return;results.push({...item,status:'success',code:String(out.codigo),expires:out.expiraEmUtc});const local=rows.find(r=>String(r.ContratacaoId)===String(item.row.ContratacaoId));if(local)local.Versao=out.versao;}
    catch(e){if(current!==epoch)return;results.push({...item,status:'error',reason:e.message});}
   }
   if(current===epoch){selected.clear();render();renderResults();window.dispatchEvent(new Event('jetta:notifications-refresh'));}
  }catch(e){if(current===epoch){reviewRows=[];ui=shell('Geração não iniciada',e.message);ui.footer.append(btn('Fechar',closeDialog,'diarias-primary'));}}
  finally{if(current===epoch){issuing=false;dialog.querySelector('.diarias-close')?.removeAttribute('disabled');}}
 }
 function renderResults(){
  const success=results.filter(r=>r.status==='success').length,failed=results.filter(r=>r.status==='error').length;
  const {body,footer}=shell(success+(success===1?' token gerado':' tokens gerados'),failed?failed+' contratação(ões) com falha. Os tokens gerados foram preservados.':'Comunique cada token ao respectivo prestador.');
  const list=make('div',undefined,'diarias-result-list');for(const item of results){const line=make('div',undefined,'diarias-result'),person=make('span');person.append(make('strong',item.row.Prestador),make('small','#'+item.row.Numero+(item.type?' · '+(item.type==='ENTRADA'?'Entrada':'Saída'):'')));line.append(person);
   if(item.status==='success'){
    const token=make('div',undefined,'diarias-token'),code=make('input');code.readOnly=true;code.type='text';code.autocomplete='off';code.spellcheck=false;code.value=item.code;code.setAttribute('aria-label','Token de '+item.row.Prestador);const feedback=make('small');feedback.role='status';const copy=btn('Copiar',async()=>{if(!results.includes(item))return;const text=(item.type==='ENTRADA'?'Token de entrada: ':'Token de saída: ')+item.code;try{await navigator.clipboard.writeText(text);if(results.includes(item))feedback.textContent='Token copiado!';}catch{if(!results.includes(item))return;code.focus();code.select();feedback.textContent='Selecione e copie o código.';}},'diarias-secondary');copy.setAttribute('aria-label','Copiar token de '+item.row.Prestador);token.append(code,copy);line.append(token,make('small','Válido até '+new Date(item.expires).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'}),'diarias-expiry'),feedback);
   }else line.append(make('span',(item.status==='ignored'?'Ignorada · ':'Falha · ')+item.reason,'diarias-badge ignored'));list.append(line);
  }body.append(list);footer.append(make('span','Códigos disponíveis até fechar esta janela.'),btn('Concluir',closeDialog,'diarias-primary'));
 }
 window.addEventListener('jetta:diarias',load);
 window.addEventListener('jetta:auth',()=>{reset();date=today();depot='';query='';});
 new MutationObserver(()=>{if(host.hidden)reset();}).observe(host,{attributes:true,attributeFilter:['hidden']});
})();
