(()=>{
 const root=document.getElementById('fin05Page');if(!root)return;
 const make=(tag,text,cls,doc=document)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
 const allowed=()=>!!window.jettaAccount?.fin01&&[window.jettaAccount?.perfil,...(window.jettaAccount?.funcoes||[])].some(role=>['ADMIN','COORDENADOR','GESTOR','FINANCEIRO'].includes(role));
 const money=value=>{const [whole,fraction='00']=String(value??'0.00').split('.');return 'R$ '+whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fraction.padEnd(2,'0');};
 const date=value=>value?new Date(value+'Z').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 const localDay=value=>value?value.split('-').reverse().join('/'):'—';
 const documentText=value=>{const text=String(value??'');return /^\d{11}$/.test(text)?text.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):/^\d{14}$/.test(text)?text.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5'):text||'—';};
 const balance=row=>{const cents=BigInt(String(row.ValorDevido).replace('.',''))-BigInt(String(row.ValorPago).replace('.','')),absolute=cents<0n?-cents:cents;return(cents<0n?'-':'')+String(absolute/100n)+'.'+String(absolute%100n).padStart(2,'0');};
 const detailHeaders=['Número da contratação','Data do serviço','Data de criação','Centro de custo','Descrição da atividade','Valor devido','Data do pagamento','Valor pago','Saldo a pagar','Consulta'];
 let rows=[],deposits=[],next=null,totals=null,applied='',generation=0,summaryRequest=0,controller=new AbortController(),printing=false,printRevision=0,printWindow=null;
 let exportVersion=0,exportBusy=false;
 const collapsedDepots=new Set();
 const details=new Map(),keyOf=row=>String(row.DepositoId)+':'+String(row.PrestadorId);
 root.innerHTML='<header class="fin05-heading"><h2>Extrato</h2></header><form id="fin05Filters" class="fin05-grid"><label>Prestador<select name="prestadorId" aria-label="Prestador do extrato"><option value="">Todos autorizados</option></select></label><label>Depósito<select name="depositoId" aria-label="Depósito do extrato"><option value="">Todos autorizados</option></select></label><label>Criação desde<input name="inicio" type="date"></label><label>Criação até<input name="fim" type="date"></label><div class="fin05-actions"><label class="fin05-movement"><input name="somenteMovimentacao" type="checkbox" checked>Somente com movimentação</label><button type="submit">Aplicar filtros</button><button type="button" id="fin05Clear" class="secondary">Limpar filtros</button></div></form><p id="fin05Message" role="status" aria-live="polite"></p><div class="fin05-toolbar"><h3>Prestadores por depósito</h3><div class="fin05-actions"><button type="button" id="fin05Export" disabled>Exportar em Excel</button><button type="button" id="fin05ExportPdf" disabled>Exportar em PDF</button></div></div><div id="fin05Groups"></div><button type="button" id="fin05More" hidden>Carregar mais prestadores</button><div id="fin05Totals" class="fin05-totals" hidden></div>';
 const $=id=>document.getElementById(id),form=$('fin05Filters'),message=text=>$('fin05Message').textContent=text;
 function button(text,action,cls){const node=make('button',text,cls);node.type='button';node.addEventListener('click',action);return node;}
 function cancelPrint(){printRevision++;printing=false;if(printWindow&&!printWindow.closed)printWindow.close();printWindow=null;}
 async function api(path){const response=await fetch('/api/financeiro'+path,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.erro||'Não foi possível consultar o extrato.');return data;}
 function renderTotals(parent,data,doc=document,title){
  parent.replaceChildren();if(!data)return;const query=new URLSearchParams(applied),heading=make('h3',title||(query.has('inicio')||query.has('fim')?'Totais do período':'Totais de todo o histórico'),undefined,doc),list=make('dl',undefined,undefined,doc);
  for(const [label,key]of [['Valor devido','ValorDevido'],['Valor pago','ValorPago'],['Saldo a pagar','Saldo']]){const pair=make('div',undefined,undefined,doc);pair.append(make('dt',label,undefined,doc),make('dd',money(data[key]),key==='Saldo'?'fin05-balance':'',doc));list.append(pair);}parent.append(heading,list);
 }
 function detailCells(row){return[row.Numero,localDay(row.DataServico),date(row.DataCriacao),row.CentroCusto||'—',row.Atividade,money(row.ValorDevido),date(row.DataPagamento),money(row.ValorPago),money(balance(row))];}
 function detailTable(records,doc=document,withActions=true){
  const table=make('table',undefined,'fin05-contracts',doc),head=make('thead',undefined,undefined,doc),tr=make('tr',undefined,undefined,doc);
  for(const[index,label]of(withActions?detailHeaders:detailHeaders.slice(0,-1)).entries()){const th=make('th',label,index===0?'fin05-number':'',doc);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=make('tbody',undefined,undefined,doc);
  for(const row of records){const line=make('tr',undefined,undefined,doc);for(const[index,value]of detailCells(row).entries())line.append(make('td',value??'—',index===0?'fin05-number':[5,7,8].includes(index)?'fin05-money':'',doc));if(withActions){const td=make('td'),action=button('Detalhes',()=>window.dispatchEvent(new CustomEvent('jetta:fin01-open',{detail:String(row.ContratacaoId)})));action.setAttribute('aria-label','Detalhes da contratação '+row.Numero);td.append(action);line.append(td);}body.append(line);}table.append(body);return table;
 }
 function renderDetail(row,state){
  const panel=make('section',undefined,'fin05-inline'),key=keyOf(row);panel.dataset.fin05Detail=key;panel.id='fin05-detail-'+row.DepositoId+'-'+row.PrestadorId;panel.hidden=!state.open;panel.setAttribute('aria-label','Contratações de '+row.Prestador+' em '+row.Deposito);if(!state.open)return panel;
  const toolbar=make('div',undefined,'fin05-detail-toolbar'),heading=make('h4','Contratações de '+row.Prestador),printButton=button('Imprimir / salvar PDF',()=>print(row));printButton.disabled=printing||!state.rows.length||state.loading;toolbar.append(heading,printButton);panel.append(toolbar);
  if(state.rows.length){const scroll=make('div',undefined,'fin05-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Contratações de '+row.Prestador);scroll.append(detailTable(state.rows));panel.append(scroll);}
  if(state.loading){const text=make('p','Consultando contratações…');text.setAttribute('role','status');panel.append(text);}else if(state.error){const error=make('p',state.error);error.setAttribute('role','alert');panel.append(error,button('Tentar novamente',()=>loadDetails(row,!!state.rows.length),'secondary'));}else if(state.loaded&&!state.rows.length)panel.append(make('p','Nenhuma contratação encontrada para os filtros informados.'));
  if(state.loaded){panel.append(make('p','Exibindo '+state.rows.length+' de '+state.count+' contratações.','fin05-detail-count'));if(state.totals)panel.append(make('p','Valor devido: '+money(state.totals.ValorDevido)+' · Valor pago: '+money(state.totals.ValorPago)+' · Saldo a pagar: '+money(state.totals.Saldo),'fin05-detail-total'));}
  if(state.next){const more=button('Carregar mais contratações',()=>loadDetails(row,true),'secondary');more.disabled=state.loading;panel.append(more);}return panel;
 }
 function render(){
  exportControls();
  const focused=document.activeElement?.dataset.fin05Expand,focusedDepot=document.activeElement?.dataset.fin05DepotToggle,groups=$('fin05Groups');groups.replaceChildren();
  for(const depot of deposits){
   const records=rows.filter(row=>String(row.DepositoId)===String(depot.DepositoId)),section=make('section',undefined,'fin05-depot');section.dataset.fin05Depot=String(depot.DepositoId);
   const depotKey=String(depot.DepositoId),depotBody=make('div',undefined,'fin05-depot-body'),header=make('h4',undefined,'fin05-depot-title');depotBody.id='fin05-depot-body-'+depotKey;depotBody.hidden=collapsedDepots.has(depotKey);
   const toggle=button('',()=>{depotBody.hidden=!depotBody.hidden;if(depotBody.hidden)collapsedDepots.add(depotKey);else collapsedDepots.delete(depotKey);toggle.setAttribute('aria-expanded',String(!depotBody.hidden));},'fin05-depot-heading');toggle.dataset.fin05DepotToggle=depotKey;toggle.setAttribute('aria-expanded',String(!depotBody.hidden));toggle.setAttribute('aria-controls',depotBody.id);
   const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','m9 5 7 7-7 7');icon.append(path);
   const title=make('span',depot.Deposito,'fin05-depot-name'),count=make('span',depot.QuantidadePrestadores+' '+(Number(depot.QuantidadePrestadores)===1?'prestador':'prestadores'),'fin05-depot-count-label');toggle.append(icon,title,count);header.append(toggle);section.append(header,depotBody);
   const depotTotals=make('div',undefined,'fin05-depot-totals');renderTotals(depotTotals,depot,document,'Totais do depósito');depotBody.append(depotTotals);
   if(records.length){const scroll=make('div',undefined,'fin05-scroll fin05-provider-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Prestadores de '+depot.Deposito);
    const table=make('table',undefined,'fin05-providers'),head=make('thead'),line=make('tr');for(const label of ['Prestador','CPF/CNPJ','Contratações','Valor devido','Valor pago','Saldo a pagar']){const th=make('th',label);th.scope='col';line.append(th);}head.append(line);table.append(head);const body=make('tbody');
    for(const row of records){const key=keyOf(row),state=details.get(key)||{open:false,rows:[],next:null,loaded:false};if(!details.has(key))details.set(key,state);
     const tr=make('tr',undefined,'fin05-provider-row');tr.dataset.key=key;const provider=make('td'),toggle=button('',()=>{state.open=!state.open;if(state.open&&!state.loaded&&!state.loading)loadDetails(row);else render();},'fin05-provider-toggle');toggle.dataset.fin05Expand=key;toggle.setAttribute('aria-label','Expandir contratações de '+row.Prestador);toggle.setAttribute('aria-expanded',String(state.open));toggle.setAttribute('aria-controls','fin05-detail-'+row.DepositoId+'-'+row.PrestadorId);
     const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','m9 5 7 7-7 7');icon.append(path);toggle.append(icon,make('span',row.Prestador));provider.append(toggle);tr.append(provider);
     for(const[index,value]of[documentText(row.CPF),row.QuantidadeContratacoes,money(row.ValorDevido),money(row.ValorPago),money(row.Saldo)].entries())tr.append(make('td',value,index>=2?'fin05-money':''));body.append(tr);
     const detailRow=make('tr',undefined,'fin05-detail-row'),cell=make('td');detailRow.hidden=!state.open;cell.colSpan=6;cell.append(renderDetail(row,state));detailRow.append(cell);body.append(detailRow);
    }table.append(body);scroll.append(table);depotBody.append(scroll);
   }
   if(records.length<Number(depot.QuantidadePrestadores))depotBody.append(make('p','Exibindo '+records.length+' de '+depot.QuantidadePrestadores+' prestadores neste depósito. Use “Carregar mais prestadores” para continuar.','fin05-depot-count'));groups.append(section);
  }
  if(!deposits.length)groups.append(make('p',totals?'Nenhum prestador encontrado para os filtros informados.':'Consulte os filtros para carregar os prestadores.','fin05-empty'));
  $('fin05More').hidden=!next;$('fin05Totals').hidden=!totals;renderTotals($('fin05Totals'),totals);
  if(focused)for(const node of groups.querySelectorAll('[data-fin05-expand]'))if(node.dataset.fin05Expand===focused){node.focus({preventScroll:true});break;}
  if(focusedDepot)for(const node of groups.querySelectorAll('[data-fin05-depot-toggle]'))if(node.dataset.fin05DepotToggle===focusedDepot){node.focus({preventScroll:true});break;}
 }
 function filterQuery(){const query=new URLSearchParams();for(const key of ['prestadorId','depositoId','inicio','fim'])if(form.elements[key].value)query.set(key,form.elements[key].value);query.set('somenteMovimentacao',form.elements.somenteMovimentacao.checked?'1':'0');return query;}
 function pairQuery(row){const query=new URLSearchParams(applied);query.delete('agrupamento');query.delete('somenteMovimentacao');query.delete('pagina');query.set('prestadorId',row.PrestadorId);query.set('depositoId',row.DepositoId);return query;}
 async function loadDetails(row,more=false){
  if(!allowed())return;const key=keyOf(row),state=details.get(key);if(!state||state.loading)return;const stamp=generation,query=pairQuery(row);if(more&&state.next)query.set('pagina',state.next);state.loading=true;state.error='';render();
  try{const data=await api('/extrato?'+query);if(stamp!==generation||details.get(key)!==state)return;state.rows=more?[...new Map([...state.rows,...data.contratacoes].map(record=>[String(record.ContratacaoId),record])).values()]:data.contratacoes;state.next=data.proximaPagina;state.count=data.totalRegistros;state.totals=data.totais;state.loaded=true;}
  catch(error){if(stamp!==generation||error.name==='AbortError')return;state.error=error.message;}
  finally{if(stamp===generation&&details.get(key)===state){state.loading=false;render();}}
 }
 async function load(more=false,selected=null){
  if(!allowed())return;const request=++summaryRequest;
  if(!more){generation++;resetExport();controller.abort();controller=new AbortController();cancelPrint();applied=(selected||filterQuery()).toString();rows=[];deposits=[];details.clear();collapsedDepots.clear();next=null;totals=null;render();}
  const stamp=generation,query=new URLSearchParams(applied);query.set('agrupamento','deposito');if(!query.has('somenteMovimentacao'))query.set('somenteMovimentacao','1');if(more&&next)query.set('pagina',next);$('fin05More').disabled=true;message('Consultando extrato…');
  try{const data=await api('/extrato?'+query);if(stamp!==generation||request!==summaryRequest)return;rows=more?[...new Map([...rows,...data.prestadores].map(row=>[keyOf(row),row])).values()]:data.prestadores;deposits=data.depositos;next=data.proximaPagina;totals=data.totais;render();message('Extrato atualizado.');}
  catch(error){if(stamp!==generation||request!==summaryRequest||error.name==='AbortError')return;message(error.message);}
  finally{if(stamp===generation&&request===summaryRequest)$('fin05More').disabled=false;}
 }
 function options(name,values,key){const select=form.elements[name],old=select.value;select.replaceChildren(new Option('Todos autorizados',''),...values.map(row=>new Option(row.Nome,row[key])));if([...select.options].some(option=>option.value===old))select.value=old;}
 async function enter(){if(!allowed())return;const stamp=++generation;try{const data=await api('/extrato/catalogo');if(stamp!==generation)return;options('prestadorId',data.prestadores,'PrestadorId');options('depositoId',data.depositos,'DepositoId');await load(false,new URLSearchParams(applied));}catch(error){if(stamp===generation&&error.name!=='AbortError')message(error.message);}}
 async function print(row){
  if(!allowed()||printing)return;const query=pairQuery(row),stamp=++printRevision,name=row.Prestador;printing=true;
  const popup=window.open('/fin05-print.html','_blank');if(!popup){printing=false;render();message('Permita a abertura da janela para imprimir o extrato.');return;}printWindow=popup;const ready=new Promise(resolve=>popup.addEventListener('load',resolve,{once:true}));render();
  try{const all=[];let page=1,first;
   do{query.set('pagina',page);const data=await api('/extrato?'+query);if(stamp!==printRevision||popup.closed)return;
    if(!first)first=data;else if(data.totalRegistros!==first.totalRegistros||JSON.stringify(data.totais)!==JSON.stringify(first.totais))throw Error('O extrato mudou durante a preparação. Atualize e imprima novamente.');
    all.push(...data.contratacoes);const after=data.proximaPagina;if(after!==null&&(!Number.isInteger(after)||after<=page))throw Error('Não foi possível reunir o extrato completo.');page=after;
   }while(page!==null);
   if(all.length!==first.totalRegistros||new Set(all.map(record=>String(record.ContratacaoId))).size!==all.length)throw Error('O extrato mudou durante a preparação. Atualize e imprima novamente.');
   await ready;if(stamp!==printRevision||popup.closed)return;popup.opener=null;const doc=popup.document;doc.documentElement.lang='pt-BR';doc.title='Extrato de '+name;doc.body.className='fin05-print';doc.body.replaceChildren();
   const period=[query.get('inicio')?'Desde '+localDay(query.get('inicio')):'',query.get('fim')?'Até '+localDay(query.get('fim')):''].filter(Boolean).join(' · ')||'Todo o histórico';
   const action=make('button','Imprimir / salvar PDF','fin05-print-action',doc);action.type='button';action.addEventListener('click',()=>popup.print());const footer=make('section',undefined,'fin05-totals',doc);renderTotals(footer,first.totais,doc);
   doc.body.append(make('h1','Extrato',undefined,doc),make('h2',name,undefined,doc),make('p','CPF/CNPJ: '+documentText(row.CPF)+' · Depósito: '+row.Deposito+' · '+period,undefined,doc),action,detailTable(all,doc,false),footer);message('Extrato completo preparado para impressão.');
  }catch(error){if(stamp===printRevision&&error.name!=='AbortError'){await ready;if(stamp!==printRevision||popup.closed)return;popup.document.body.textContent='Impressão não preparada: '+error.message;message(error.message);}}
  finally{if(stamp===printRevision){printing=false;render();}}
 }

 function exportControls(){for(const id of ['fin05Export','fin05ExportPdf'])$(id).disabled=exportBusy||!totals;}
 function resetExport(){exportVersion++;exportBusy=false;exportControls();}
 async function exportStatement(format){
  if(!allowed()||exportBusy||!totals||root.hidden)return;
  const stamp=++exportVersion,revision=generation,signal=controller.signal,query=new URLSearchParams(applied),kind=format==='pdf'?'PDF':'Excel',mime=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  query.set('agrupamento','deposito');if(!query.has('somenteMovimentacao'))query.set('somenteMovimentacao','1');query.delete('pagina');
  const valid=()=>stamp===exportVersion&&revision===generation&&!signal.aborted&&allowed()&&!root.hidden;
  exportBusy=true;exportControls();message('Preparando arquivo '+kind+'…');
  try{
   const response=await fetch('/api/financeiro/extrato/exportar.'+format+'?'+query,{signal,credentials:'same-origin',cache:'no-store'});if(!valid())return;
   if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.erro||'Não foi possível exportar o extrato. Tente novamente.');}
   if(response.headers.get('content-type')?.split(';')[0].trim()!==mime)throw Error('O servidor não retornou um arquivo '+kind+' válido.');
   const blob=await response.blob();if(!valid())return;
   const filename=/filename="([^"\\/]+)"/.exec(response.headers.get('content-disposition')||'')?.[1];
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename&&/^[A-Za-z0-9_.-]+$/.test(filename)&&filename.endsWith('.'+format)?filename:'extrato.'+format;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Arquivo '+kind+' exportado.');
  }catch(error){if(valid()&&error.name!=='AbortError')message(error.message);}
  finally{if(stamp===exportVersion){exportBusy=false;exportControls();}}
 }
 $('fin05Export').addEventListener('click',()=>exportStatement('xlsx'));
 $('fin05ExportPdf').addEventListener('click',()=>exportStatement('pdf'));
 new MutationObserver(()=>{if(root.hidden)resetExport();}).observe(root,{attributes:true,attributeFilter:['hidden']});
 form.addEventListener('submit',event=>{event.preventDefault();load();});$('fin05More').addEventListener('click',()=>load(true));$('fin05Clear').addEventListener('click',()=>{form.reset();load();});
 window.addEventListener('jetta:fin05',enter);
 window.addEventListener('jetta:auth',()=>{generation++;summaryRequest++;resetExport();controller.abort();controller=new AbortController();cancelPrint();details.clear();collapsedDepots.clear();rows=[];deposits=[];next=null;totals=null;applied='';form.reset();options('prestadorId',[],'PrestadorId');options('depositoId',[],'DepositoId');render();message('');});
 render();
})();
