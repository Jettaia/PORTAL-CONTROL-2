(()=>{
 const root=document.getElementById('fin05Page');if(!root)return;
 const make=(tag,text,cls,doc=document)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
 const allowed=()=>!!window.jettaAccount?.fin01&&[window.jettaAccount?.perfil,...(window.jettaAccount?.funcoes||[])].some(role=>['ADMIN','GESTOR','FINANCEIRO'].includes(role));
 const money=value=>{const [whole,fraction='00']=String(value??'0.00').split('.');return 'R$ '+whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+fraction.padEnd(2,'0');};
 const date=value=>value?new Date(value+'Z').toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
 const localDay=value=>value?value.split('-').reverse().join('/'):'';
 const summaryHeaders=['Prestador','Valor devido','Valor pago','Saldo a pagar','Consulta'];
 const detailHeaders=['Número da contratação','Data de criação','Depósito','Centro de custo','Descrição da atividade','Valor devido','Data do pagamento','Valor pago','Consulta'];
 let rows=[],next=null,totalCount=0,totals=null,applied='',generation=0,controller=new AbortController(),printing=false,printRevision=0,printWindow=null;
 root.innerHTML='<header class="fin05-heading"><h2>Extrato por prestador</h2><p>Consulte contratações liberadas, pagamentos e o saldo a pagar de cada prestador.</p></header><form id="fin05Filters" class="fin05-grid"><label>Prestador<select name="prestadorId" aria-label="Prestador do extrato"><option value="">Todos autorizados</option></select></label><label>Depósito<select name="depositoId" aria-label="Depósito do extrato"><option value="">Todos autorizados</option></select></label><label>Criação desde<input name="inicio" type="date"></label><label>Criação até<input name="fim" type="date"></label><div class="fin05-actions"><button type="submit">Aplicar filtros</button><button type="button" id="fin05Clear" class="secondary">Limpar filtros</button></div></form><p class="fin05-period">Todo o histórico por padrão. O período opcional considera a criação da contratação.</p><p id="fin05Message" role="status" aria-live="polite"></p><div class="fin05-toolbar"><h3 id="fin05Title">Resumo por prestador</h3><div class="fin05-actions"><button id="fin05Back" type="button" class="secondary" hidden>Ver resumo por prestador</button><button id="fin05Print" type="button" hidden>Imprimir / salvar PDF</button></div></div><div class="fin05-scroll" tabindex="0" role="region" aria-label="Extrato de contratações"><table><thead id="fin05Head"></thead><tbody id="fin05Rows"></tbody></table></div><p id="fin05Count"></p><button type="button" id="fin05More" hidden>Carregar mais</button><div id="fin05Totals" class="fin05-totals" hidden></div>';
 const $=id=>document.getElementById(id),form=$('fin05Filters'),message=text=>$('fin05Message').textContent=text;
 function individual(query=applied){return new URLSearchParams(query).has('prestadorId');}
 function optionName(name,value,fallback){return [...form.elements[name].options].find(option=>option.value===value)?.textContent||fallback;}
 function providerName(){return optionName('prestadorId',new URLSearchParams(applied).get('prestadorId'),'Prestador');}
 function cancelPrint(){printRevision++;printing=false;if(printWindow&&!printWindow.closed)printWindow.close();printWindow=null;}
 async function api(path){const response=await fetch('/api/financeiro'+path,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.erro||'Não foi possível consultar o extrato.');return data;}
 function renderTotals(parent,data,doc=document){
  parent.replaceChildren();if(!data)return;
  const heading=make('h3',new URLSearchParams(applied).has('inicio')||new URLSearchParams(applied).has('fim')?'Totais do período':'Totais de todo o histórico',undefined,doc);
  const list=make('dl',undefined,undefined,doc);
  for(const [label,key]of [['Valor devido','ValorDevido'],['Valor pago','ValorPago'],['Saldo a pagar','Saldo']]){const pair=make('div',undefined,undefined,doc);pair.append(make('dt',label,undefined,doc),make('dd',money(data[key]),key==='Saldo'?'fin05-balance':'',doc));list.append(pair);}
  parent.append(heading,list);
 }
 function cells(row,isIndividual){return isIndividual?[row.Numero,date(row.DataCriacao),row.Deposito,row.CentroCusto||'—',row.Atividade,money(row.ValorDevido),date(row.DataPagamento),money(row.ValorPago)]:[row.Prestador,money(row.ValorDevido),money(row.ValorPago),money(row.Saldo)];}
 function render(){
  const isIndividual=individual(),headers=isIndividual?detailHeaders:summaryHeaders;
  $('fin05Title').textContent=isIndividual?'Extrato de '+providerName():'Resumo por prestador';
  $('fin05Back').hidden=!isIndividual;$('fin05Print').hidden=!isIndividual;$('fin05Print').disabled=!totals||!rows.length||printing;
  const head=make('tr');for(const [index,label]of headers.entries()){const th=make('th',label,isIndividual&&index===0?'fin05-number':'');th.scope='col';head.append(th);}$('fin05Head').replaceChildren(head);
  const body=$('fin05Rows');body.replaceChildren();
  for(const row of rows){const tr=make('tr');tr.dataset.key=isIndividual?row.ContratacaoId:row.PrestadorId;
   for(const [index,value]of cells(row,isIndividual).entries())tr.append(make('td',value??'—',isIndividual&&index===0?'fin05-number':(isIndividual?[5,7]:[1,2,3]).includes(index)?'fin05-money':''));
   const td=make('td'),button=make('button',isIndividual?'Detalhes':'Ver extrato');button.type='button';button.setAttribute('aria-label',isIndividual?'Detalhes da contratação '+row.Numero:'Ver extrato de '+row.Prestador);
   button.addEventListener('click',()=>{if(isIndividual)window.dispatchEvent(new CustomEvent('jetta:fin01-open',{detail:String(row.ContratacaoId)}));else{const query=new URLSearchParams(applied);query.set('prestadorId',row.PrestadorId);syncForm(query);load(false,query);}});td.append(button);tr.append(td);body.append(tr);
  }
  if(!rows.length){const tr=make('tr'),td=make('td',totals?'Nenhuma contratação encontrada para os filtros informados.':'Selecione os filtros para consultar.');td.colSpan=headers.length;tr.append(td);body.append(tr);}
  $('fin05More').hidden=!next;$('fin05Count').textContent=totals?'Exibindo '+rows.length+' de '+totalCount+' '+(isIndividual?'contratações.':'prestadores.'):'';
  $('fin05Totals').hidden=!totals;renderTotals($('fin05Totals'),totals);
 }
 function syncForm(query){for(const key of ['prestadorId','depositoId','inicio','fim'])form.elements[key].value=query.get(key)||'';}
 async function load(more=false,selected=null){
  if(!allowed())return;const stamp=++generation;cancelPrint();
  if(!more){applied=(selected||new URLSearchParams([...new FormData(form)].filter(([,value])=>value))).toString();rows=[];next=null;totals=null;totalCount=0;render();}
  const query=new URLSearchParams(applied);if(more&&next)query.set('pagina',next);$('fin05More').disabled=true;message('Consultando extrato…');
  try{const data=await api('/extrato?'+query);if(stamp!==generation)return;
   const incoming=individual()?data.contratacoes:data.prestadores;rows=more?[...new Map([...rows,...incoming].map(row=>[String(individual()?row.ContratacaoId:row.PrestadorId),row])).values()]:incoming;
   next=data.proximaPagina;totals=data.totais;totalCount=data.totalRegistros;render();message('Extrato atualizado.');
  }catch(error){if(stamp!==generation||error.name==='AbortError')return;message(error.message);}
  finally{if(stamp===generation)$('fin05More').disabled=false;}
 }
 function options(name,values,key){const select=form.elements[name],old=select.value;select.replaceChildren(new Option('Todos autorizados',''),...values.map(row=>new Option(row.Nome,row[key])));if([...select.options].some(option=>option.value===old))select.value=old;}
 async function enter(){if(!allowed())return;const stamp=++generation;try{const data=await api('/catalogo');if(stamp!==generation)return;options('prestadorId',data.prestadores,'PrestadorId');options('depositoId',data.depositos,'DepositoId');await load(false,new URLSearchParams(applied));}catch(error){if(stamp===generation&&error.name!=='AbortError')message(error.message);}}
 async function print(){
  if(!allowed()||!individual()||!totals||printing)return;
  const stamp=++printRevision,query=new URLSearchParams(applied),name=providerName();printing=true;render();
  const popup=window.open('/fin05-print.html','_blank');if(!popup){printing=false;render();message('Permita a abertura da janela para imprimir o extrato.');return;}printWindow=popup;const ready=new Promise(resolve=>popup.addEventListener('load',resolve,{once:true}));
  try{
   const all=[];let page=1,first;
   do{query.set('pagina',page);const data=await api('/extrato?'+query);if(stamp!==printRevision||popup.closed)return;
    if(!first)first=data;else if(data.totalRegistros!==first.totalRegistros||JSON.stringify(data.totais)!==JSON.stringify(first.totais))throw Error('O extrato mudou durante a preparação. Atualize e imprima novamente.');
    all.push(...data.contratacoes);const after=data.proximaPagina;if(after!==null&&(!Number.isInteger(after)||after<=page))throw Error('Não foi possível reunir o extrato completo.');page=after;
   }while(page!==null);
   if(all.length!==first.totalRegistros||new Set(all.map(row=>String(row.ContratacaoId))).size!==all.length)throw Error('O extrato mudou durante a preparação. Atualize e imprima novamente.');
   await ready;if(stamp!==printRevision||popup.closed)return;popup.opener=null;const doc=popup.document;doc.documentElement.lang='pt-BR';doc.title='Extrato de '+name;doc.body.className='fin05-print';doc.body.replaceChildren();
   const heading=make('h1','Extrato por prestador',undefined,doc),provider=make('h2',name,undefined,doc);
   const period=[query.get('inicio')?'Desde '+localDay(query.get('inicio')):'',query.get('fim')?'Até '+localDay(query.get('fim')):''].filter(Boolean).join(' · ')||'Todo o histórico';
   const depot=optionName('depositoId',query.get('depositoId')||'','Todos autorizados');
   const printButton=make('button','Imprimir / salvar PDF','fin05-print-action',doc);printButton.type='button';printButton.addEventListener('click',()=>popup.print());
   const table=make('table',undefined,undefined,doc),thead=make('thead',undefined,undefined,doc),tr=make('tr',undefined,undefined,doc);for(const [index,label]of detailHeaders.slice(0,-1).entries()){const th=make('th',label,index===0?'fin05-number':'',doc);th.scope='col';tr.append(th);}thead.append(tr);table.append(thead);
   const tbody=make('tbody',undefined,undefined,doc);for(const row of all){const line=make('tr',undefined,undefined,doc);for(const [index,value]of cells(row,true).entries())line.append(make('td',value??'—',index===0?'fin05-number':[5,7].includes(index)?'fin05-money':'',doc));tbody.append(line);}table.append(tbody);
   const footer=make('section',undefined,'fin05-totals',doc);renderTotals(footer,first.totais,doc);doc.body.append(heading,provider,make('p','Depósito: '+depot+' · '+period,undefined,doc),printButton,table,footer);message('Extrato completo preparado para impressão.');
  }catch(error){if(stamp===printRevision&&error.name!=='AbortError'){await ready;if(stamp!==printRevision||popup.closed)return;popup.document.body.textContent='Impressão não preparada: '+error.message;message(error.message);}}
  finally{if(stamp===printRevision){printing=false;render();}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();load();});$('fin05More').addEventListener('click',()=>load(true));$('fin05Clear').addEventListener('click',()=>{form.reset();load();});
 $('fin05Back').addEventListener('click',()=>{const query=new URLSearchParams(applied);query.delete('prestadorId');syncForm(query);load(false,query);});$('fin05Print').addEventListener('click',print);
 window.addEventListener('jetta:fin05',enter);
 window.addEventListener('jetta:auth',()=>{generation++;controller.abort();controller=new AbortController();cancelPrint();rows=[];next=null;totals=null;totalCount=0;applied='';form.reset();options('prestadorId',[],'PrestadorId');options('depositoId',[],'DepositoId');render();message('');});
 render();
})();
